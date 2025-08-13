import { describe, test, expect } from 'bun:test'
import { buildProjectSummaryWithFormat, compressSummary } from './summary-formatters'
import type { ProjectFile } from '@promptliano/schemas'

// Helper to create test files
function createTestFile(overrides: Partial<ProjectFile> = {}): ProjectFile {
  return {
    id: 1,
    projectId: 1,
    name: 'test.ts',
    path: '/src/test.ts',
    extension: 'ts',
    size: 1000,
    content: 'test content',
    summary: 'Test file summary',
    summaryLastUpdated: Date.now(),
    meta: null,
    checksum: 'abc123',
    imports: [],
    exports: [],
    created: Date.now(),
    updated: Date.now(),
    ...overrides
  }
}

describe('summary-formatters', () => {
  describe('buildProjectSummaryWithFormat', () => {
    const testFiles: ProjectFile[] = [
      createTestFile({
        id: 1,
        name: 'index.ts',
        path: '/src/index.ts',
        summary: 'Main entry point',
        imports: [{ source: './utils', specifiers: [{ type: 'named', local: 'helper', imported: 'helper' }] }],
        exports: [
          { type: 'default', source: null, specifiers: [{ type: 'default', local: 'App', exported: 'default' }] }
        ]
      }),
      createTestFile({
        id: 2,
        name: 'utils.ts',
        path: '/src/utils.ts',
        summary: 'Utility functions',
        exports: [{ type: 'named', source: null, specifiers: [{ type: 'named', local: 'helper', exported: 'helper' }] }]
      }),
      createTestFile({
        id: 3,
        name: 'config.json',
        path: '/config.json',
        extension: 'json',
        summary: null
      })
    ]

    describe('XML format', () => {
      test('generates XML summary', () => {
        const result = buildProjectSummaryWithFormat(testFiles, 'xml')

        expect(result).toContain('<summary_memory>')
        expect(result).toContain('<file>')
        expect(result).toContain('<file_id>1</file_id>')
        expect(result).toContain('<name>index.ts</name>')
        expect(result).toContain('<summary>Main entry point</summary>')
      })

      test('includes empty summaries when specified', () => {
        const result = buildProjectSummaryWithFormat(testFiles, 'xml', { includeEmptySummaries: true })

        expect(result).toContain('config.json')
      })
    })

    describe('JSON format', () => {
      test('generates JSON summary', () => {
        const result = buildProjectSummaryWithFormat(testFiles, 'json')
        const parsed = JSON.parse(result)

        expect(parsed.version).toBe('2.0')
        expect(parsed.fileCount).toBe(3)
        expect(parsed.files).toHaveLength(3)
        expect(parsed.files[0].name).toBe('index.ts')
        expect(parsed.files[0].summary).toBe('Main entry point')
      })

      test('includes imports when not disabled', () => {
        const result = buildProjectSummaryWithFormat(testFiles, 'json')
        const parsed = JSON.parse(result)

        expect(parsed.files[0].imports).toBeDefined()
        expect(parsed.files[0].imports[0].source).toBe('./utils')
      })

      test('excludes imports when disabled', () => {
        const result = buildProjectSummaryWithFormat(testFiles, 'json', { includeImports: false })
        const parsed = JSON.parse(result)

        expect(parsed.files[0].imports).toBeUndefined()
      })

      test('includes exports when not disabled', () => {
        const result = buildProjectSummaryWithFormat(testFiles, 'json')
        const parsed = JSON.parse(result)

        expect(parsed.files[0].exports).toBeDefined()
        expect(parsed.files[0].exports[0].type).toBe('default')
      })

      test('excludes exports when disabled', () => {
        const result = buildProjectSummaryWithFormat(testFiles, 'json', { includeExports: false })
        const parsed = JSON.parse(result)

        expect(parsed.files[0].exports).toBeUndefined()
      })

      test('provides default summary for files without AI summary', () => {
        const result = buildProjectSummaryWithFormat(testFiles, 'json')
        const parsed = JSON.parse(result)

        const configFile = parsed.files.find((f: any) => f.name === 'config.json')
        expect(configFile.summary).toContain('JSON file')
        expect(configFile.summary).toContain('1000 bytes')
      })
    })

    describe('Markdown format', () => {
      test('generates Markdown summary', () => {
        const result = buildProjectSummaryWithFormat(testFiles, 'markdown')

        expect(result).toContain('# Project Summary')
        expect(result).toContain('Total Files: 3')
        expect(result).toContain('### index.ts')
        expect(result).toContain('- **Summary**: Main entry point')
        expect(result).toContain('- **Type**: TypeScript')
      })

      test('groups files by directory', () => {
        const result = buildProjectSummaryWithFormat(testFiles, 'markdown')

        expect(result).toContain('## /src')
        expect(result).toContain('## Root')
      })

      test('includes imports section', () => {
        const result = buildProjectSummaryWithFormat(testFiles, 'markdown')

        expect(result).toContain('- **Imports**:')
        expect(result).toContain('  - ./utils')
      })

      test('excludes imports when disabled', () => {
        const result = buildProjectSummaryWithFormat(testFiles, 'markdown', { includeImports: false })

        expect(result).not.toContain('- **Imports**:')
      })

      test('truncates long import lists', () => {
        const fileWithManyImports = createTestFile({
          imports: Array.from({ length: 10 }, (_, i) => ({
            source: `./module${i}`,
            specifiers: []
          }))
        })

        const result = buildProjectSummaryWithFormat([fileWithManyImports], 'markdown')

        expect(result).toContain('... and 5 more')
      })

      test('includes export names', () => {
        const result = buildProjectSummaryWithFormat(testFiles, 'markdown')

        expect(result).toContain('- **Exports**:')
        expect(result).toContain('  - helper')
      })
    })

    describe('error handling', () => {
      test('throws error for unsupported format', () => {
        expect(() => {
          buildProjectSummaryWithFormat(testFiles, 'invalid' as any)
        }).toThrow('Unsupported format: invalid')
      })

      test('handles empty file list', () => {
        const jsonResult = buildProjectSummaryWithFormat([], 'json')
        const parsed = JSON.parse(jsonResult)

        expect(parsed.fileCount).toBe(0)
        expect(parsed.files).toEqual([])

        const markdownResult = buildProjectSummaryWithFormat([], 'markdown')
        expect(markdownResult).toContain('Total Files: 0')
      })

      test('handles files with missing optional fields', () => {
        const minimalFile = {
          id: 1,
          projectId: 1,
          name: 'minimal.txt',
          path: '/minimal.txt',
          extension: 'txt',
          created: Date.now(),
          updated: Date.now()
        } as ProjectFile

        const result = buildProjectSummaryWithFormat([minimalFile], 'json')
        const parsed = JSON.parse(result)

        expect(parsed.files[0].name).toBe('minimal.txt')
        expect(parsed.files[0].summary).toContain('Unknown file')
      })
    })
  })

  describe('compressSummary', () => {
    describe('basic compression', () => {
      test('removes redundant whitespace', () => {
        const input = 'This  has   multiple    spaces\n\n\nand newlines'
        const result = compressSummary(input)

        expect(result).toBe('This has multiple spaces and newlines')
      })

      test('applies abbreviations', () => {
        const input = 'TypeScript file in packages/src/components/services/authentication'
        const result = compressSummary(input)

        expect(result).toContain('TS')
        expect(result).toContain('p/')
        expect(result).toContain('s/')
        expect(result).toContain('c/')
        expect(result).toContain('svc/')
        expect(result).toContain('auth')
      })

      test('handles case-insensitive abbreviations', () => {
        const input = 'TYPESCRIPT typescript TypeScript'
        const result = compressSummary(input)

        expect(result).toBe('TS TS TS')
      })
    })

    describe('path compression', () => {
      test('compresses common path prefixes in minimal mode', () => {
        const input = `
          File at /src/components/Button.tsx
          File at /src/components/Input.tsx
          File at /src/components/Modal.tsx
        `
        const result = compressSummary(input, { depth: 'minimal' })

        expect(result).toContain('...')
        expect(result).not.toContain('/src/components')
      })

      test('does not compress paths in standard mode', () => {
        const input = 'File at /src/components/Button.tsx and /src/components/Input.tsx'
        const result = compressSummary(input, { depth: 'standard' })

        expect(result).toContain('s/c/Button.tsx') // Only abbreviations applied
      })

      test('handles single path without compression', () => {
        const input = 'File at /src/components/Button.tsx'
        const result = compressSummary(input, { depth: 'minimal' })

        expect(result).toContain('s/c/Button.tsx')
      })

      test('preserves short common prefixes', () => {
        const input = 'Files at /a/file1.txt and /a/file2.txt'
        const result = compressSummary(input, { depth: 'minimal' })

        // Prefix too short (< 3 chars), should not compress
        expect(result).toContain('/a/')
      })
    })

    describe('edge cases', () => {
      test('handles empty string', () => {
        const result = compressSummary('')
        expect(result).toBe('')
      })

      test('handles whitespace-only string', () => {
        const result = compressSummary('   \n\n\t  ')
        expect(result).toBe('')
      })

      test('preserves single spaces', () => {
        const input = 'Normal sentence with single spaces.'
        const result = compressSummary(input)

        expect(result).toBe('Normal sentence with single spaces.')
      })

      test('handles text without paths or abbreviatable words', () => {
        const input = 'Lorem ipsum dolor sit amet'
        const result = compressSummary(input)

        expect(result).toBe('Lorem ipsum dolor sit amet')
      })

      test('handles special regex characters in paths', () => {
        const input = 'Path with special chars: /src/[id]/page.tsx'
        const result = compressSummary(input, { depth: 'minimal' })

        // Should not throw and handle special chars gracefully
        expect(result).toBeDefined()
        expect(result.length).toBeLessThanOrEqual(input.length)
      })
    })

    describe('comprehensive abbreviations', () => {
      test('applies all defined abbreviations', () => {
        const input = `
          TypeScript React component
          JavaScript React component  
          packages/src/components/services/utilities/
          configuration authentication authorization
          database application
        `
        const result = compressSummary(input)

        expect(result).toContain('TSX')
        expect(result).toContain('JSX')
        expect(result).toContain('p/')
        expect(result).toContain('s/')
        expect(result).toContain('c/')
        expect(result).toContain('svc/')
        expect(result).toContain('u/')
        expect(result).toContain('config')
        expect(result).toContain('auth')
        expect(result).toContain('authz')
        expect(result).toContain('db')
        expect(result).toContain('app')
      })

      test('does not over-abbreviate', () => {
        const input = 'authentication is not authorization'
        const result = compressSummary(input)

        expect(result).toBe('auth is not authz')
      })
    })

    describe('performance', () => {
      test('handles large text efficiently', () => {
        const largeText = 'TypeScript '.repeat(1000) + 'packages/src/components/ '.repeat(100)
        const startTime = performance.now()
        const result = compressSummary(largeText)
        const endTime = performance.now()

        expect(endTime - startTime).toBeLessThan(100) // Should be fast
        expect(result.length).toBeLessThan(largeText.length)
      })

      test('maintains idempotency', () => {
        const input = 'TypeScript file in packages/src/components'
        const first = compressSummary(input)
        const second = compressSummary(first)

        expect(second).toBe(first) // Should not change after first compression
      })
    })
  })
})
