import { describe, test, expect } from 'bun:test'
import { CompactFileFormatter, calculateTokenSavings } from './compact-file-formatter'
import type { ProjectFile, CompactLevel } from '@promptliano/schemas'

// Helper to create test files
function createTestFile(overrides: Partial<ProjectFile> = {}): ProjectFile {
  return {
    id: 1,
    projectId: 1,
    name: 'test.ts',
    path: '/src/test.ts',
    extension: 'ts',
    size: 1000,
    content: '',
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

describe('CompactFileFormatter', () => {
  describe('ultraCompact', () => {
    test('formats files with only id and path', () => {
      const files = [
        createTestFile({ id: 1, path: '/src/index.ts' }),
        createTestFile({ id: 2, path: '/src/utils/helper.ts' })
      ]

      const result = CompactFileFormatter.ultraCompact(files)
      const parsed = JSON.parse(result)

      expect(parsed).toHaveLength(2)
      expect(parsed[0]).toEqual({ i: 1, p: '/src/index.ts' })
      expect(parsed[1]).toEqual({ i: 2, p: '/src/utils/helper.ts' })
    })

    test('truncates long paths', () => {
      const file = createTestFile({
        path: '/very/long/path/to/deeply/nested/file/in/project/structure/component.tsx'
      })

      const result = CompactFileFormatter.ultraCompact([file])
      const parsed = JSON.parse(result)

      expect(parsed[0].p.length).toBeLessThanOrEqual(50)
      expect(parsed[0].p).toContain('...')
    })

    test('handles empty file list', () => {
      const result = CompactFileFormatter.ultraCompact([])
      expect(JSON.parse(result)).toEqual([])
    })
  })

  describe('compact', () => {
    test('includes id, path, and summary', () => {
      const files = [
        createTestFile({ 
          id: 1, 
          path: '/src/index.ts',
          summary: 'Main entry point for the application'
        })
      ]

      const result = CompactFileFormatter.compact(files)
      const parsed = JSON.parse(result)

      expect(parsed[0]).toHaveProperty('i', 1)
      expect(parsed[0]).toHaveProperty('p', '/src/index.ts')
      expect(parsed[0]).toHaveProperty('s', 'Main entry point for the application')
    })

    test('truncates long summaries', () => {
      const file = createTestFile({
        summary: 'This is a very long summary that exceeds the maximum allowed length and should be truncated appropriately'
      })

      const result = CompactFileFormatter.compact([file])
      const parsed = JSON.parse(result)

      expect(parsed[0].s.length).toBeLessThanOrEqual(40)
      expect(parsed[0].s).toEndWith('...')
    })

    test('handles missing summary', () => {
      const file = createTestFile({ summary: null })

      const result = CompactFileFormatter.compact([file])
      const parsed = JSON.parse(result)

      expect(parsed[0].s).toBe('')
    })

    test('cleans newlines from summary', () => {
      const file = createTestFile({
        summary: 'First line\nSecond line\nThird line'
      })

      const result = CompactFileFormatter.compact([file])
      const parsed = JSON.parse(result)

      expect(parsed[0].s).not.toContain('\n')
      expect(parsed[0].s).toContain('First line Second line')
    })
  })

  describe('standard', () => {
    test('includes all fields', () => {
      const file = createTestFile({
        id: 1,
        path: '/src/component.tsx',
        summary: 'React component',
        extension: 'tsx',
        updated: 1609459200000
      })

      const result = CompactFileFormatter.standard([file])
      const parsed = JSON.parse(result)

      expect(parsed[0]).toEqual({
        i: 1,
        p: '/src/component.tsx',
        s: 'React component',
        t: 'tsx',
        m: 1609459200000
      })
    })

    test('allows longer paths and summaries', () => {
      const file = createTestFile({
        path: '/src/components/features/dashboard/widgets/analytics/chart.tsx',
        summary: 'Complex analytics chart component with multiple data visualization options'
      })

      const result = CompactFileFormatter.standard([file])
      const parsed = JSON.parse(result)

      expect(parsed[0].p.length).toBeLessThanOrEqual(60)
      expect(parsed[0].s.length).toBeLessThanOrEqual(50)
    })
  })

  describe('format', () => {
    const files = [
      createTestFile({ id: 1, path: '/src/index.ts', summary: 'Entry' }),
      createTestFile({ id: 2, path: '/src/utils.ts', summary: 'Utilities' })
    ]

    test('formats as ultra compact', () => {
      const result = CompactFileFormatter.format(files, 'ultra')

      expect(result.format).toBe('ultra')
      expect(result.total).toBe(2)
      expect(result.files[0]).not.toHaveProperty('s')
      expect(result.files[0]).not.toHaveProperty('t')
    })

    test('formats as compact by default', () => {
      const result = CompactFileFormatter.format(files)

      expect(result.format).toBe('compact')
      expect(result.files[0]).toHaveProperty('s')
      expect(result.files[0]).not.toHaveProperty('t')
    })

    test('formats as standard', () => {
      const result = CompactFileFormatter.format(files, 'standard')

      expect(result.format).toBe('standard')
      expect(result.files[0]).toHaveProperty('s')
      expect(result.files[0]).toHaveProperty('t')
      expect(result.files[0]).toHaveProperty('m')
    })
  })

  describe('toAIPrompt', () => {
    test('creates human-readable prompt', () => {
      const files = [
        createTestFile({ id: 1, path: '/src/index.ts', summary: 'Main entry' }),
        createTestFile({ id: 2, path: '/src/utils.ts', summary: 'Helper functions' })
      ]

      const prompt = CompactFileFormatter.toAIPrompt(files)

      expect(prompt).toContain('Project contains 2 files:')
      expect(prompt).toContain('[1] /src/index.ts - Main entry')
      expect(prompt).toContain('[2] /src/utils.ts - Helper functions')
    })

    test('handles files without summaries', () => {
      const files = [
        createTestFile({ id: 1, path: '/src/index.ts', summary: null })
      ]

      const prompt = CompactFileFormatter.toAIPrompt(files)

      expect(prompt).toContain('[1] /src/index.ts\n')
      expect(prompt).not.toContain(' - \n')
    })

    test('respects format level', () => {
      const files = [
        createTestFile({ id: 1, path: '/very/long/path/file.ts', summary: 'Test' })
      ]

      const ultraPrompt = CompactFileFormatter.toAIPrompt(files, 'ultra')
      
      expect(ultraPrompt).not.toContain(' - Test')
    })
  })

  describe('categorizedSummary', () => {
    test('groups files by category', () => {
      const files = [
        createTestFile({ path: '/src/user.service.ts', extension: 'ts' }),
        createTestFile({ path: '/src/auth.service.ts', extension: 'ts' }),
        createTestFile({ path: '/src/Button.component.tsx', extension: 'tsx' }),
        createTestFile({ path: '/src/utils/helper.ts', extension: 'ts' }),
        createTestFile({ path: '/src/index.test.ts', extension: 'ts' })
      ]

      const summary = CompactFileFormatter.categorizedSummary(files)

      expect(summary).toContain('Services (2):')
      expect(summary).toContain('Components (1):')
      expect(summary).toContain('Utilities (1):')
      expect(summary).toContain('Tests (1):')
    })

    test('limits files per category to 5', () => {
      const files = Array.from({ length: 10 }, (_, i) => 
        createTestFile({ 
          id: i, 
          path: `/src/service${i}.service.ts`,
          extension: 'ts' 
        })
      )

      const summary = CompactFileFormatter.categorizedSummary(files)

      expect(summary).toContain('Services (10):')
      expect(summary).toContain('...and 5 more')
      
      // Should show exactly 5 service files
      const serviceLines = summary.split('\n').filter(line => line.includes('service') && line.startsWith('-'))
      expect(serviceLines).toHaveLength(5)
    })

    test('includes summaries when available', () => {
      const files = [
        createTestFile({ 
          path: '/src/auth.service.ts',
          summary: 'Handles user authentication and authorization'
        })
      ]

      const summary = CompactFileFormatter.categorizedSummary(files)

      expect(summary).toContain('auth.service.ts: Handles user authentication')
    })

    test('categorizes by extension when no pattern matches', () => {
      const files = [
        createTestFile({ path: '/src/styles.css', extension: 'css' }),
        createTestFile({ path: '/src/data.json', extension: 'json' }),
        createTestFile({ path: '/README.md', extension: 'md' })
      ]

      const summary = CompactFileFormatter.categorizedSummary(files)

      expect(summary).toContain('Styles (1):')
      expect(summary).toContain('Data/Config (1):')
      expect(summary).toContain('Documentation (1):')
    })

    test('handles unknown extensions', () => {
      const files = [
        createTestFile({ path: '/src/unknown.xyz', extension: 'xyz' })
      ]

      const summary = CompactFileFormatter.categorizedSummary(files)

      expect(summary).toContain('Other (1):')
    })
  })

  describe('path truncation', () => {
    test('preserves short paths', () => {
      const files = [
        createTestFile({ path: '/src/index.ts' })
      ]

      const result = CompactFileFormatter.ultraCompact(files)
      const parsed = JSON.parse(result)

      expect(parsed[0].p).toBe('/src/index.ts')
    })

    test('truncates middle of long paths', () => {
      const files = [
        createTestFile({ 
          path: '/src/components/features/dashboard/widgets/analytics/performance/chart.tsx' 
        })
      ]

      const result = CompactFileFormatter.format(files, 'ultra')

      expect(result.files[0].p).toContain('/...')
      expect(result.files[0].p).toContain('/chart.tsx')
      expect(result.files[0].p.length).toBeLessThanOrEqual(50)
    })

    test('handles paths with few segments', () => {
      const files = [
        createTestFile({ path: '/verylongfilenamethatshouldbetruncatedtomeetthe50characterlimit.ts' })
      ]

      const result = CompactFileFormatter.ultraCompact(files)
      const parsed = JSON.parse(result)

      expect(parsed[0].p).toEndWith('...')
      expect(parsed[0].p.length).toBeLessThanOrEqual(50)
    })

    test('handles root files', () => {
      const files = [
        createTestFile({ path: 'package.json' })
      ]

      const result = CompactFileFormatter.ultraCompact(files)
      const parsed = JSON.parse(result)

      expect(parsed[0].p).toBe('package.json')
    })
  })

  describe('summary truncation', () => {
    test('preserves short summaries', () => {
      const files = [
        createTestFile({ summary: 'Short summary' })
      ]

      const result = CompactFileFormatter.compact(files)
      const parsed = JSON.parse(result)

      expect(parsed[0].s).toBe('Short summary')
    })

    test('truncates long summaries with ellipsis', () => {
      const files = [
        createTestFile({ 
          summary: 'This is a very long summary that definitely exceeds the maximum character limit'
        })
      ]

      const result = CompactFileFormatter.compact(files)
      const parsed = JSON.parse(result)

      expect(parsed[0].s).toEndWith('...')
      expect(parsed[0].s.length).toBe(40)
    })

    test('handles empty and null summaries', () => {
      const files = [
        createTestFile({ summary: '' }),
        createTestFile({ summary: null }),
        createTestFile({ summary: undefined })
      ]

      const result = CompactFileFormatter.compact(files)
      const parsed = JSON.parse(result)

      expect(parsed[0].s).toBe('')
      expect(parsed[1].s).toBe('')
      expect(parsed[2].s).toBe('')
    })

    test('removes newlines and trims whitespace', () => {
      const files = [
        createTestFile({ summary: '  Line one\n\nLine two  \n  Line three  ' })
      ]

      const result = CompactFileFormatter.compact(files)
      const parsed = JSON.parse(result)

      expect(parsed[0].s).toBe('Line one  Line two     Line three')
    })
  })

  describe('calculateTokenSavings', () => {
    test('calculates token savings for file list', () => {
      const files = Array.from({ length: 10 }, (_, i) => 
        createTestFile({ 
          id: i,
          path: `/src/file${i}.ts`,
          summary: `File ${i} summary`
        })
      )

      const savings = calculateTokenSavings(files)

      expect(savings.oldTokens).toBeGreaterThan(0)
      expect(savings.newTokens).toBeGreaterThan(0)
      expect(savings.newTokens).toBeLessThan(savings.oldTokens)
      expect(savings.savings).toBe(savings.oldTokens - savings.newTokens)
      expect(savings.savingsPercent).toBeGreaterThan(0)
      expect(savings.savingsPercent).toBeLessThan(100)
    })

    test('estimates old format at ~125 tokens per file', () => {
      const files = [createTestFile()]

      const savings = calculateTokenSavings(files)

      expect(savings.oldTokens).toBeCloseTo(125, -1)
    })

    test('shows significant savings for large file lists', () => {
      const files = Array.from({ length: 100 }, (_, i) => 
        createTestFile({ 
          id: i,
          path: `/src/component${i}.tsx`,
          summary: 'React component'
        })
      )

      const savings = calculateTokenSavings(files)

      expect(savings.savingsPercent).toBeGreaterThan(50)
    })

    test('handles empty file list', () => {
      const savings = calculateTokenSavings([])

      expect(savings.oldTokens).toBe(0)
      expect(savings.newTokens).toBeGreaterThan(0) // JSON array brackets
      expect(savings.savings).toBeLessThan(0)
    })
  })
})