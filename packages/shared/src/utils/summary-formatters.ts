import type { ProjectFile, SummaryFormat, SummaryOptions } from '@promptliano/schemas'
import { buildCombinedFileSummariesXml } from './project-summary-formatter'

/**
 * Build project summary in the specified format
 */
export function buildProjectSummaryWithFormat(
  files: ProjectFile[],
  format: SummaryFormat,
  options?: Partial<SummaryOptions>
): string {
  switch (format) {
    case 'xml':
      return buildCombinedFileSummariesXml(files, {
        includeEmptySummaries: true
      })
    case 'json':
      return buildJsonSummary(files, options)
    case 'markdown':
      return buildMarkdownSummary(files, options)
    default:
      throw new Error(`Unsupported format: ${format}`)
  }
}

/**
 * Build JSON format summary
 */
function buildJsonSummary(files: ProjectFile[], options?: Partial<SummaryOptions>): string {
  const summary = {
    version: '2.0',
    generated: Date.now(),
    fileCount: files.length,
    files: files.map((file) => {
      const fileSummary: any = {
        id: file.id,
        name: file.name,
        path: file.path,
        summary: file.summary || getDefaultSummary(file)
      }

      // Conditionally include imports/exports
      if (options?.includeImports !== false && file.imports?.length) {
        fileSummary.imports = file.imports.map((imp) => ({
          source: imp.source,
          specifiers: imp.specifiers
        }))
      }

      if (options?.includeExports !== false && file.exports?.length) {
        fileSummary.exports = file.exports.map((exp) => ({
          type: exp.type,
          source: exp.source,
          specifiers: exp.specifiers
        }))
      }

      return fileSummary
    })
  }

  return JSON.stringify(summary, null, 2)
}

/**
 * Build Markdown format summary
 */
function buildMarkdownSummary(files: ProjectFile[], options?: Partial<SummaryOptions>): string {
  const lines: string[] = [
    '# Project Summary',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Total Files: ${files.length}`,
    ''
  ]

  // Group files by directory for better organization
  const filesByDir = groupFilesByDirectory(files)

  for (const [dir, dirFiles] of Object.entries(filesByDir)) {
    lines.push(`## ${dir || 'Root'}`)
    lines.push('')

    for (const file of dirFiles) {
      const fileType = getFileTypeDescription(file.name)
      lines.push(`### ${file.name}`)
      lines.push(`- **Type**: ${fileType}`)
      lines.push(`- **Path**: \`${file.path}\``)

      if (file.summary) {
        lines.push(`- **Summary**: ${file.summary}`)
      }

      // Include imports if requested
      if (options?.includeImports !== false && file.imports?.length) {
        lines.push('- **Imports**:')
        for (const imp of file.imports.slice(0, 5)) {
          // Limit to first 5
          lines.push(`  - ${imp.source}`)
        }
        if (file.imports.length > 5) {
          lines.push(`  - ... and ${file.imports.length - 5} more`)
        }
      }

      // Include exports if requested
      if (options?.includeExports !== false && file.exports?.length) {
        lines.push('- **Exports**:')
        const exportNames = file.exports
          .flatMap((exp) => exp.specifiers?.map((s) => s.exported) || [])
          .filter(Boolean)
          .slice(0, 5)

        for (const name of exportNames) {
          lines.push(`  - ${name}`)
        }
        if (exportNames.length < file.exports.length) {
          lines.push(`  - ... and more`)
        }
      }

      lines.push('')
    }
  }

  return lines.join('\n')
}

/**
 * Group files by their directory
 */
function groupFilesByDirectory(files: ProjectFile[]): Record<string, ProjectFile[]> {
  const groups: Record<string, ProjectFile[]> = {}

  for (const file of files) {
    const dir = file.path.substring(0, file.path.lastIndexOf('/'))
    if (!groups[dir]) {
      groups[dir] = []
    }
    groups[dir].push(file)
  }

  // Sort directories and files within each directory
  const sortedGroups: Record<string, ProjectFile[]> = {}
  const sortedDirs = Object.keys(groups).sort()

  for (const dir of sortedDirs) {
    const group = groups[dir]
    if (group) {
      sortedGroups[dir] = group.sort((a, b) => a.name.localeCompare(b.name))
    }
  }

  return sortedGroups
}

/**
 * Get default summary for files without AI-generated summaries
 */
function getDefaultSummary(file: ProjectFile): string {
  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'unknown'
  const fileType = getFileTypeDescription(fileExt)
  const sizeStr = file.size ? `${file.size} bytes` : 'size unknown'
  return `${fileType} file (${sizeStr})`
}

/**
 * Get human-readable file type description
 */
function getFileTypeDescription(fileOrExt: string): string {
  const ext = fileOrExt.includes('.') ? fileOrExt.split('.').pop()?.toLowerCase() || 'unknown' : fileOrExt.toLowerCase()

  const fileTypeMap: Record<string, string> = {
    ts: 'TypeScript',
    tsx: 'TypeScript React',
    js: 'JavaScript',
    jsx: 'JavaScript React',
    py: 'Python',
    java: 'Java',
    cpp: 'C++',
    c: 'C',
    cs: 'C#',
    go: 'Go',
    rs: 'Rust',
    php: 'PHP',
    rb: 'Ruby',
    swift: 'Swift',
    kt: 'Kotlin',
    html: 'HTML',
    css: 'CSS',
    scss: 'SCSS',
    json: 'JSON',
    yaml: 'YAML',
    yml: 'YAML',
    xml: 'XML',
    toml: 'TOML',
    md: 'Markdown',
    sql: 'SQL',
    sh: 'Shell Script',
    dockerfile: 'Dockerfile',
    gitignore: 'Git Ignore',
    env: 'Environment Config'
  }

  return fileTypeMap[ext] || 'Unknown'
}

/**
 * Apply compression techniques to reduce token usage
 */
export function compressSummary(summary: string, options?: Partial<SummaryOptions>): string {
  let compressed = summary

  // Apply abbreviations
  compressed = applyAbbreviations(compressed)

  // Compress paths if in minimal mode
  if (options?.depth === 'minimal') {
    compressed = compressPaths(compressed)
  }

  // Remove redundant whitespace
  compressed = compressed.replace(/\s+/g, ' ').trim()

  return compressed
}

/**
 * Apply common abbreviations to reduce size
 */
function applyAbbreviations(text: string): string {
  const abbreviations: Record<string, string> = {
    'TypeScript React': 'TSX',
    TypeScript: 'TS',
    'JavaScript React': 'JSX',
    JavaScript: 'JS',
    'packages/': 'p/',
    'src/': 's/',
    'components/': 'c/',
    'services/': 'svc/',
    'utilities/': 'u/',
    configuration: 'config',
    authentication: 'auth',
    authorization: 'authz',
    database: 'db',
    application: 'app'
  }

  let result = text
  for (const [full, abbr] of Object.entries(abbreviations)) {
    result = result.replace(new RegExp(full, 'gi'), abbr)
  }

  return result
}

/**
 * Compress file paths by removing common prefixes
 */
function compressPaths(text: string): string {
  // Find common path prefix
  const pathRegex = /(?:^|\s)\/[\w\-\/\.]+/g
  const paths = text.match(pathRegex) || []

  if (paths.length < 2) return text

  // Find common prefix
  const commonPrefix = findCommonPrefix(paths)

  if (commonPrefix.length > 3) {
    // Replace common prefix with ...
    return text.replace(new RegExp(commonPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '...')
  }

  return text
}

/**
 * Find common prefix among paths
 */
function findCommonPrefix(paths: string[]): string {
  if (!paths.length) return ''

  let prefix = paths[0]
  if (!prefix) return ''
  
  for (let i = 1; i < paths.length; i++) {
    const currentPath = paths[i]
    if (!currentPath) continue
    while (!currentPath.startsWith(prefix)) {
      prefix = prefix.substring(0, prefix.lastIndexOf('/'))
      if (!prefix) break
    }
  }

  return prefix ?? ''
}
