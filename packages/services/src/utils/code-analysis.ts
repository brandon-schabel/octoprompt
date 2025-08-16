import { parseSync } from '@swc/core'
import type {
  Module,
  ImportDeclaration,
  ExportDeclaration,
  ExportAllDeclaration,
  ExportNamedDeclaration,
  ExportDefaultDeclaration,
  ModuleItem
} from '@swc/core'
import type { ImportInfo, ExportInfo } from '@promptliano/schemas'

export interface CodeAnalysisResult {
  imports: ImportInfo[]
  exports: ExportInfo[]
}

function isImportDeclaration(item: ModuleItem): item is ImportDeclaration {
  return item.type === 'ImportDeclaration'
}

function isExportDeclaration(item: ModuleItem): item is ExportDeclaration {
  return item.type === 'ExportDeclaration'
}

function isExportAllDeclaration(item: ModuleItem): item is ExportAllDeclaration {
  return item.type === 'ExportAllDeclaration'
}

function isExportNamedDeclaration(item: ModuleItem): item is ExportNamedDeclaration {
  return item.type === 'ExportNamedDeclaration'
}

function isExportDefaultDeclaration(item: ModuleItem): item is ExportDefaultDeclaration {
  return item.type === 'ExportDefaultDeclaration'
}

function isExportDefaultExpression(item: ModuleItem): boolean {
  return item.type === 'ExportDefaultExpression'
}

function analyzePythonImportsExports(content: string, filename: string): CodeAnalysisResult | null {
  try {
    const imports: ImportInfo[] = []
    const exports: ExportInfo[] = [] // In Python: top-level defs/classes as "named exports"

    // Simple regex for imports (handles import x, from y import z as w)
    const importRegex =
      /^\s*(?:from\s+([\w.]+)\s+)?import\s+([\w.*]+(?:\s+as\s+\w+)?(?:\s*,\s*[\w.*]+(?:\s+as\s+\w+)?)*)/gm
    let match
    while ((match = importRegex.exec(content)) !== null) {
      const source = match[1] || '' // from source
      const specifiersStr = match[2]
      const specifiers = specifiersStr.split(',').map((s) => {
        const parts = s.trim().split(/\s+as\s+/)
        return {
          type: 'named' as const,
          imported: parts[0].trim(),
          local: parts[1]?.trim() || parts[0].trim()
        }
      })
      imports.push({ source, specifiers })
    }

    // Top-level defs/classes for "exports" (must start at column 0, no indentation)
    const exportRegex = /^(def|class)\s+(\w+)\s*(?:\(|:)/gm
    while ((match = exportRegex.exec(content)) !== null) {
      const exportName = match[2] ?? ''
      exports.push({
        type: 'named',
        specifiers: [{ exported: exportName, local: exportName }]
      })
    }

    return { imports, exports }
  } catch (error) {
    console.error(`Failed to analyze Python file ${filename}:`, error)
    return null
  }
}

export function analyzeCodeImportsExports(content: string, filename: string): CodeAnalysisResult | null {
  try {
    const isTypeScript = filename.endsWith('.ts') || filename.endsWith('.tsx')
    const isJavaScript = filename.endsWith('.js') || filename.endsWith('.jsx')
    const isPython = filename.endsWith('.py')

    if (!isTypeScript && !isJavaScript && !isPython) {
      return null
    }

    // Return empty result for empty content
    if (!content.trim()) {
      return { imports: [], exports: [] }
    }

    if (isPython) {
      return analyzePythonImportsExports(content, filename)
    }

    const ast = parseSync(content, {
      syntax: isTypeScript ? 'typescript' : 'ecmascript',
      tsx: filename.endsWith('.tsx'),
      jsx: filename.endsWith('.jsx')
    }) as Module

    const imports: ImportInfo[] = []
    const exports: ExportInfo[] = []

    for (const item of ast.body) {
      if (isImportDeclaration(item)) {
        const importInfo: ImportInfo = {
          source: item.source.value,
          specifiers: []
        }

        for (const specifier of item.specifiers) {
          switch (specifier.type) {
            case 'ImportDefaultSpecifier':
              importInfo.specifiers.push({
                type: 'default',
                local: specifier.local.value
              })
              break
            case 'ImportNamespaceSpecifier':
              importInfo.specifiers.push({
                type: 'namespace',
                local: specifier.local.value
              })
              break
            case 'ImportSpecifier':
              importInfo.specifiers.push({
                type: 'named',
                imported: specifier.imported?.value || specifier.local.value,
                local: specifier.local.value
              })
              break
          }
        }

        imports.push(importInfo)
      } else if (isExportAllDeclaration(item)) {
        exports.push({
          type: 'all',
          source: item.source.value
        })
      } else if (isExportNamedDeclaration(item)) {
        const exportInfo: ExportInfo = {
          type: 'named',
          source: item.source?.value,
          specifiers: []
        }

        if (item.specifiers) {
          for (const specifier of item.specifiers) {
            if (specifier.type === 'ExportSpecifier') {
              exportInfo.specifiers?.push({
                local: specifier.orig?.value,
                exported: specifier.exported?.value || specifier.orig?.value || ''
              })
            }
          }
        }

        exports.push(exportInfo)
      } else if (isExportDefaultDeclaration(item)) {
        exports.push({
          type: 'default'
        })
      } else if (isExportDefaultExpression(item)) {
        exports.push({
          type: 'default'
        })
      } else if (isExportDeclaration(item)) {
        if (item.declaration) {
          if (item.declaration.type === 'FunctionDeclaration' || item.declaration.type === 'ClassDeclaration') {
            if (item.declaration.identifier) {
              exports.push({
                type: 'named',
                specifiers: [
                  {
                    exported: item.declaration.identifier.value,
                    local: item.declaration.identifier.value
                  }
                ]
              })
            }
          } else if (item.declaration.type === 'VariableDeclaration') {
            const specifiers: ExportInfo['specifiers'] = []
            for (const decl of item.declaration.declarations) {
              if (decl.id.type === 'Identifier') {
                specifiers.push({
                  exported: decl.id.value,
                  local: decl.id.value
                })
              }
            }
            if (specifiers.length > 0) {
              exports.push({
                type: 'named',
                specifiers
              })
            }
          }
        }
      }
    }

    return { imports, exports }
  } catch (error: any) {
    const isTruncationError = error?.message?.includes('truncated') || error?.message?.includes("Expected ']'")
    if (!isTruncationError) {
      console.error(`Failed to analyze file ${filename}:`, error.message || error)
    }
    return null
  }
}
