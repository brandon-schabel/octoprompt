// import-resolver.ts
// This file implements the logic to recursively find and resolve all file imports for a given file.
// It supports:
// - Relative imports (e.g. "./something", "../other")
// - Alias imports as defined in tsconfig paths (e.g. "@/..." or "@ui/...")
// - Ignores package imports (like "react", "@tanstack/react-router")
// - Recursively includes all imports of imported files
//
// Assumptions:
// - All files (including tsconfigs) are provided in memory as ProjectFile objects.
// - The "projectRoot" is the root directory of the project.
// - We have no server file system access, so all resolution must be done in-memory.
// - We must parse tsconfig files found in the project to extract path aliases.
// - A file extension might need to be inferred. We'll try common extensions like .ts, .tsx, .js, .jsx if needed.
// - If a file cannot be resolved, it's skipped. Package imports are also skipped.
// - Returns a list of all fileIds that are imported by a given file, recursively.

import type { ProjectFile } from '@promptliano/schemas'

interface AliasMap {
  [aliasPrefix: string]: string[]
  // Example: { "@/*": ["./src/*"] }
  // Multiple patterns can exist, we might simplify and only handle the first match
}

interface TsConfig {
  compilerOptions?: {
    baseUrl?: string
    paths?: Record<string, string[]>
  }
  references?: { path: string }[]
  files?: string[]
}

function parseTsConfig(content: string): TsConfig | null {
  try {
    return JSON.parse(content)
  } catch {
    return null
  }
}

/**
 * Gathers all aliases from any tsconfig files in the project.
 * If multiple tsconfigs are found, merges their paths.
 * The projectRoot is used along with baseUrl for absolute resolution.
 */
export function gatherAliasesFromTsconfigs(allFiles: ProjectFile[], projectRoot: string): AliasMap {
  const aliasMap: AliasMap = {}

  const tsconfigFiles = allFiles.filter(
    (f) => f.path.endsWith('tsconfig.json') || (f.path.endsWith('.json') && f.path.includes('tsconfig'))
  )

  for (const tscFile of tsconfigFiles) {
    if (!tscFile.content) {
      continue
    }
    const tsconfig = parseTsConfig(tscFile.content)
    if (!tsconfig || !tsconfig.compilerOptions) {
      continue
    }

    const { paths } = tsconfig.compilerOptions
    if (paths) {
      for (const key of Object.keys(paths)) {
        aliasMap[key] = paths[key] ?? []
      }
    }
  }

  return aliasMap
}

function normalizePath(p: string): string {
  const parts = p.split('/')
  const normalizedParts: string[] = []
  for (const part of parts) {
    if (part === '' || part === '.') {
      // Skip empty or '.' segments
      continue
    } else if (part === '..') {
      // Remove the last segment if possible
      normalizedParts.pop()
    } else {
      normalizedParts.push(part)
    }
  }
  // For absolute paths, prepend a '/'
  // Check if original path started with '/'
  if (p.startsWith('/')) {
    return '/' + normalizedParts.join('/')
  }
  return normalizedParts.join('/')
}

export type TsconfigCache = Map<string, AliasMap>

const possibleExtensions = ['', '.ts', '.tsx', '.js', '.jsx', '.json']

export function buildTsconfigAliasMap(allFiles: ProjectFile[]): TsconfigCache {
  const tsconfigFiles = allFiles.filter(
    (f) =>
      (f.path.endsWith('tsconfig.json') || (f.path.endsWith('.json') && f.path.includes('tsconfig'))) && !!f.content
  )

  const cache = new Map<string, AliasMap>()

  for (const file of tsconfigFiles) {
    const tsconfig = parseTsConfig(file?.content ?? '')
    if (!tsconfig || !tsconfig.compilerOptions || !tsconfig.compilerOptions.paths) {
      continue
    }
    const dir = file.path.slice(0, file.path.lastIndexOf('/'))
    const aliasMap: AliasMap = {}
    for (const key of Object.keys(tsconfig.compilerOptions.paths)) {
      aliasMap[key] = tsconfig.compilerOptions.paths[key] ?? []
    }
    cache.set(dir, aliasMap)
  }

  return cache
}

function findNearestTsconfigDir(filePath: string, tsconfigCache: TsconfigCache): string | null {
  let current = filePath
  while (current.includes('/')) {
    current = current.slice(0, current.lastIndexOf('/'))
    if (tsconfigCache.has(current)) {
      return current
    }
  }
  return null
}

function resolveAliasImport(importPath: string, currentFilePath: string, tsconfigCache: TsconfigCache): string[] {
  const tsconfigDir = findNearestTsconfigDir(currentFilePath, tsconfigCache)
  if (!tsconfigDir) {
    return []
  }

  const aliases = tsconfigCache.get(tsconfigDir)!
  for (const aliasKey of Object.keys(aliases)) {
    const prefix = aliasKey.replace(/\/\*$/, '')
    if (importPath === prefix || importPath.startsWith(prefix + '/')) {
      const remainder = importPath.slice(prefix.length).replace(/^\//, '')
      const targetPatterns = aliases[aliasKey]
      if (!targetPatterns) continue
      const resolvedPaths: string[] = []
      for (const pattern of targetPatterns) {
        const basePattern = pattern.replace(/\/\*$/, '')
        let resolved = ''
        if (pattern.includes('/*')) {
          resolved = basePattern + '/' + remainder
        } else {
          resolved = remainder ? basePattern + '/' + remainder : basePattern
        }

        const fullPath = normalizePath(tsconfigDir + '/' + resolved)
        resolvedPaths.push(fullPath)
      }
      return resolvedPaths
    }
  }

  return []
}

function resolveImportPath(
  importPath: string,
  currentFile: ProjectFile,
  allFiles: ProjectFile[],
  tsconfigCache: TsconfigCache
): ProjectFile | null {
  if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
    const tsconfigDir = findNearestTsconfigDir(currentFile.path, tsconfigCache)
    const aliases = tsconfigDir ? tsconfigCache.get(tsconfigDir) : undefined
    if (!aliases || !isAliasImport(importPath, aliases)) {
      return null
    }
  }

  let resolvedPaths: string[] = []

  if (importPath.startsWith('@')) {
    resolvedPaths = resolveAliasImport(importPath, currentFile.path, tsconfigCache)
  } else if (importPath.startsWith('/')) {
    resolvedPaths = [normalizePath(importPath)]
  } else {
    const currentDir = currentFile.path.slice(0, currentFile.path.lastIndexOf('/'))
    const combined = normalizePath(currentDir + '/' + importPath)
    resolvedPaths = [combined]
  }

  for (const base of resolvedPaths) {
    for (const ext of possibleExtensions) {
      const candidate = base + ext
      const found = allFiles.find((f) => normalizePath(f.path) === candidate)
      if (found) {
        return found
      }
    }
  }
  return null
}

function isAliasImport(importPath: string, aliases: AliasMap): boolean {
  // If any alias key matches the start of importPath (like "@/"), consider it an alias import.
  // Aliases can have patterns like "@/*", "@ui/*"
  // We'll match the part before the first slash against alias keys.
  // i.e. if importPath = "@/components/ui/menubar",
  // keys might be "@/*": first part is "@"
  // or "@ui/*": first segment is "@ui"
  //
  // We'll need to test each alias key pattern.

  for (const aliasKey of Object.keys(aliases)) {
    const prefix = aliasKey.replace(/\/\*$/, '') // remove /* at the end for comparison
    if (importPath === prefix || importPath.startsWith(prefix + '/')) {
      return true
    }
  }
  return false
}

/**
 * Parses import statements from a file's content.
 * Returns an array of import paths.
 * This is a simple regex-based approach. A more robust approach might use a real parser.
 */
function extractImportsFromContent(content: string): string[] {
  // Match both ESM import forms:
  // import ... from '...';
  // import('...')
  // Also handle dynamic imports: `import("...")`
  // We'll not be perfect here, but good enough for common scenarios.

  const importPaths: string[] = []
  const importRegex = /\bimport(?:[\s\S]*?)from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  let match: RegExpExecArray | null
  while ((match = importRegex.exec(content)) !== null) {
    const path = match[1] || match[2]
    if (path) {
      importPaths.push(path)
    }
  }
  return importPaths
}

/**
 * Recursively resolves all imports of a given file.
 * visitedIds is used to prevent infinite loops.
 *
 * Returns an array of fileIds (excluding the root fileId) that the file depends on.
 */
export function getRecursiveImports(
  fileId: number,
  allFiles: ProjectFile[],
  tsconfigCache: TsconfigCache,
  visitedIds = new Set<number>()
): number[] {
  if (visitedIds.has(fileId)) {
    return []
  }
  visitedIds.add(fileId)

  const file = allFiles.find((f) => f.id === fileId)
  if (!file || !file.content) {
    return []
  }

  const imports = extractImportsFromContent(file.content)

  const result: number[] = []

  for (const imp of imports) {
    const resolvedFile = resolveImportPath(imp, file, allFiles, tsconfigCache)
    if (resolvedFile && resolvedFile.id !== fileId) {
      if (!visitedIds.has(resolvedFile.id)) {
        result.push(resolvedFile.id)
        const subImports = getRecursiveImports(resolvedFile.id, allFiles, tsconfigCache, visitedIds)
        for (const si of subImports) {
          if (!result.includes(si)) {
            result.push(si)
          }
        }
      }
    }
  }

  return result
}
