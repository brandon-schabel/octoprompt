import { describe, test, expect, beforeEach } from 'bun:test'
import {
  extractKeywords,
  calculateTextRelevance,
  mergeFileSuggestions,
  filterFilesByPattern,
  groupFilesByDirectory,
  SuggestionMetricsTracker,
  getFileCategory
} from './file-suggestion-utils'
import type { ProjectFile, RelevanceScore } from '@promptliano/schemas'

// Helper to create test files
function createTestFile(overrides: Partial<ProjectFile> = {}): ProjectFile {
  return {
    id: 1,
    projectId: 1,
    name: 'file.ts',
    path: '/src/file.ts',
    extension: 'ts',
    size: 1000,
    content: '',
    summary: null,
    summaryLastUpdated: null,
    meta: null,
    checksum: 'abc123',
    imports: [],
    exports: [],
    created: Date.now(),
    updated: Date.now(),
    ...overrides
  }
}

describe('file-suggestion-utils', () => {
  describe('extractKeywords', () => {
    test('extracts keywords from text', () => {
      const text = 'The quick brown fox jumps over the lazy dog. Fox and dog are animals.'
      const keywords = extractKeywords(text)

      expect(keywords).toContain('fox')
      expect(keywords).toContain('dog')
      expect(keywords).toContain('quick')
      expect(keywords).toContain('brown')
      expect(keywords).toContain('lazy')
      expect(keywords).toContain('jumps')
      expect(keywords).toContain('animals')
    })

    test('filters out stop words', () => {
      const text = 'The quick and the brown but the fox'
      const keywords = extractKeywords(text)

      expect(keywords).not.toContain('the')
      expect(keywords).not.toContain('and')
      expect(keywords).not.toContain('but')
      expect(keywords).toContain('quick')
      expect(keywords).toContain('brown')
      expect(keywords).toContain('fox')
    })

    test('respects minimum word length', () => {
      const text = 'a ab abc abcd abcde'
      const keywords = extractKeywords(text, { minWordLength: 4 })

      expect(keywords).not.toContain('a')
      expect(keywords).not.toContain('ab')
      expect(keywords).not.toContain('abc')
      expect(keywords).toContain('abcd')
      expect(keywords).toContain('abcde')
    })

    test('limits maximum keywords', () => {
      const text = 'one two three four five six seven eight nine ten eleven twelve'
      const keywords = extractKeywords(text, { maxKeywords: 5 })

      expect(keywords).toHaveLength(5)
    })

    test('uses custom stop words', () => {
      const text = 'react component state props hooks'
      const keywords = extractKeywords(text, { customStopWords: ['react', 'component'] })

      expect(keywords).not.toContain('react')
      expect(keywords).not.toContain('component')
      expect(keywords).toContain('state')
      expect(keywords).toContain('props')
      expect(keywords).toContain('hooks')
    })

    test('filters out pure numbers', () => {
      const text = 'version 123 build 456 test'
      const keywords = extractKeywords(text)

      expect(keywords).not.toContain('123')
      expect(keywords).not.toContain('456')
      expect(keywords).toContain('version')
      expect(keywords).toContain('build')
      expect(keywords).toContain('test')
    })

    test('handles special characters', () => {
      const text = 'user@email.com hello-world test_case file.txt'
      const keywords = extractKeywords(text)

      expect(keywords).toContain('user')
      expect(keywords).toContain('email')
      expect(keywords).toContain('com')
      expect(keywords).toContain('hello-world')
      expect(keywords).toContain('test_case')
      expect(keywords).toContain('file')
      expect(keywords).toContain('txt')
    })

    test('sorts by frequency', () => {
      const text = 'test test test code code function'
      const keywords = extractKeywords(text)

      expect(keywords[0]).toBe('test') // Most frequent
      expect(keywords[1]).toBe('code') // Second most frequent
      expect(keywords[2]).toBe('function') // Least frequent
    })

    test('handles empty text', () => {
      const keywords = extractKeywords('')
      expect(keywords).toEqual([])
    })

    test('handles text with only stop words', () => {
      const keywords = extractKeywords('the and but or if')
      expect(keywords).toEqual([])
    })
  })

  describe('calculateTextRelevance', () => {
    test('calculates relevance between similar texts', () => {
      const text1 = 'React component with hooks and state management'
      const text2 = 'React hooks for managing component state'

      const relevance = calculateTextRelevance(text1, text2)

      expect(relevance).toBeGreaterThan(0.3)
      expect(relevance).toBeLessThanOrEqual(1)
    })

    test('returns 0 for completely different texts', () => {
      const text1 = 'authentication security login password'
      const text2 = 'chart graph visualization data'

      const relevance = calculateTextRelevance(text1, text2)

      expect(relevance).toBe(0)
    })

    test('returns 1 for identical texts', () => {
      const text = 'test component service utility'
      const relevance = calculateTextRelevance(text, text)

      expect(relevance).toBe(1)
    })

    test('handles empty texts', () => {
      expect(calculateTextRelevance('', 'test')).toBe(0)
      expect(calculateTextRelevance('test', '')).toBe(0)
      expect(calculateTextRelevance('', '')).toBe(0)
    })

    test('is symmetric', () => {
      const text1 = 'user authentication system'
      const text2 = 'login security module'

      const relevance1 = calculateTextRelevance(text1, text2)
      const relevance2 = calculateTextRelevance(text2, text1)

      expect(relevance1).toBe(relevance2)
    })
  })

  describe('mergeFileSuggestions', () => {
    test('merges suggestions from multiple sources', () => {
      const suggestions = [
        { fileIds: [1, 2, 3], source: 'keyword' },
        { fileIds: [2, 4, 5], source: 'path' },
        { fileIds: [1, 5, 6], source: 'type' }
      ]

      const result = mergeFileSuggestions(suggestions)

      expect(result.mergedFileIds).toContain(1) // Appears in 2 sources
      expect(result.mergedFileIds).toContain(2) // Appears in 2 sources
      expect(result.mergedFileIds).toContain(5) // Appears in 2 sources
      expect(result.mergedFileIds).toContain(3) // Appears in 1 source
      expect(result.mergedFileIds).toContain(4) // Appears in 1 source
      expect(result.mergedFileIds).toContain(6) // Appears in 1 source
    })

    test('averages scores from multiple sources', () => {
      const score1: RelevanceScore = {
        fileId: 1,
        totalScore: 0.8,
        keywordScore: 0.9,
        pathScore: 0.7,
        typeScore: 0.8,
        recencyScore: 0.6,
        importScore: 0.5
      }

      const score2: RelevanceScore = {
        fileId: 1,
        totalScore: 0.6,
        keywordScore: 0.5,
        pathScore: 0.7,
        typeScore: 0.6,
        recencyScore: 0.8,
        importScore: 0.7
      }

      const suggestions = [
        { fileIds: [1], scores: [score1], source: 'source1' },
        { fileIds: [1], scores: [score2], source: 'source2' }
      ]

      const result = mergeFileSuggestions(suggestions)
      const mergedScore = result.mergedScores.get(1)!

      expect(mergedScore.totalScore).toBe(0.7) // Average of 0.8 and 0.6
      expect(mergedScore.keywordScore).toBe(0.7) // Average of 0.9 and 0.5
      expect(mergedScore.pathScore).toBe(0.7) // Average of 0.7 and 0.7
    })

    test('creates default scores when not provided', () => {
      const suggestions = [{ fileIds: [1, 2], source: 'test' }]

      const result = mergeFileSuggestions(suggestions)
      const score = result.mergedScores.get(1)!

      expect(score.totalScore).toBe(0.5)
      expect(score.keywordScore).toBe(0)
      expect(score.pathScore).toBe(0)
    })

    test('sorts by score and source count', () => {
      const suggestions = [
        {
          fileIds: [1, 2],
          scores: [
            { fileId: 1, totalScore: 0.5, keywordScore: 0, pathScore: 0, typeScore: 0, recencyScore: 0, importScore: 0 },
            { fileId: 2, totalScore: 0.9, keywordScore: 0, pathScore: 0, typeScore: 0, recencyScore: 0, importScore: 0 }
          ],
          source: 'source1'
        },
        { fileIds: [1, 3], source: 'source2' } // File 1 appears in 2 sources
      ]

      const result = mergeFileSuggestions(suggestions)

      // File 2 has higher score (0.9) but only 1 source
      // File 1 has lower score (0.5) but 2 sources (0.5 + 0.2 = 0.7)
      // File 3 has default score (0.5) and 1 source (0.5 + 0.1 = 0.6)
      expect(result.mergedFileIds[0]).toBe(2) // Highest total
    })

    test('handles empty suggestions', () => {
      const result = mergeFileSuggestions([])

      expect(result.mergedFileIds).toEqual([])
      expect(result.mergedScores.size).toBe(0)
    })
  })

  describe('filterFilesByPattern', () => {
    const files = [
      createTestFile({ id: 1, path: '/src/components/Button.tsx' }),
      createTestFile({ id: 2, path: '/src/utils/helper.ts' }),
      createTestFile({ id: 3, path: '/tests/Button.test.tsx' }),
      createTestFile({ id: 4, path: '/docs/README.md' }),
      createTestFile({ id: 5, path: '/src/services/api.ts' })
    ]

    test('filters by include patterns', () => {
      const filtered = filterFilesByPattern(files, {
        include: ['component', 'service']
      })

      expect(filtered).toHaveLength(2)
      expect(filtered[0].id).toBe(1)
      expect(filtered[1].id).toBe(5)
    })

    test('filters by exclude patterns', () => {
      const filtered = filterFilesByPattern(files, {
        exclude: ['test', 'docs']
      })

      expect(filtered).toHaveLength(3)
      expect(filtered.map(f => f.id)).toEqual([1, 2, 5])
    })

    test('combines include and exclude patterns', () => {
      const filtered = filterFilesByPattern(files, {
        include: ['src'],
        exclude: ['utils']
      })

      expect(filtered).toHaveLength(2)
      expect(filtered.map(f => f.id)).toEqual([1, 5])
    })

    test('is case insensitive', () => {
      const filtered = filterFilesByPattern(files, {
        include: ['COMPONENT', 'SERVICE']
      })

      expect(filtered).toHaveLength(2)
    })

    test('returns all files when no patterns', () => {
      const filtered = filterFilesByPattern(files, {})

      expect(filtered).toEqual(files)
    })

    test('handles empty include array', () => {
      const filtered = filterFilesByPattern(files, {
        include: []
      })

      expect(filtered).toEqual(files)
    })

    test('handles empty exclude array', () => {
      const filtered = filterFilesByPattern(files, {
        exclude: []
      })

      expect(filtered).toEqual(files)
    })
  })

  describe('groupFilesByDirectory', () => {
    test('groups files by directory', () => {
      const files = [
        createTestFile({ id: 1, path: '/src/components/Button.tsx' }),
        createTestFile({ id: 2, path: '/src/components/Input.tsx' }),
        createTestFile({ id: 3, path: '/src/utils/helper.ts' }),
        createTestFile({ id: 4, path: '/tests/Button.test.tsx' }),
        createTestFile({ id: 5, path: 'package.json' })
      ]

      const groups = groupFilesByDirectory(files)

      expect(groups.size).toBe(4)
      expect(groups.get('/src/components')).toHaveLength(2)
      expect(groups.get('/src/utils')).toHaveLength(1)
      expect(groups.get('/tests')).toHaveLength(1)
      expect(groups.get('/')).toHaveLength(1)
    })

    test('handles root files', () => {
      const files = [
        createTestFile({ path: 'README.md' }),
        createTestFile({ path: 'package.json' })
      ]

      const groups = groupFilesByDirectory(files)

      expect(groups.size).toBe(1)
      expect(groups.get('/')).toHaveLength(2)
    })

    test('handles deeply nested paths', () => {
      const files = [
        createTestFile({ path: '/a/b/c/d/e/f/file.ts' })
      ]

      const groups = groupFilesByDirectory(files)

      expect(groups.get('/a/b/c/d/e/f')).toHaveLength(1)
    })

    test('handles empty file list', () => {
      const groups = groupFilesByDirectory([])

      expect(groups.size).toBe(0)
    })
  })

  describe('SuggestionMetricsTracker', () => {
    let tracker: SuggestionMetricsTracker

    beforeEach(() => {
      tracker = new SuggestionMetricsTracker()
    })

    test('tracks metrics lifecycle', () => {
      const id = 'test-123'

      // Start tracking
      tracker.startTracking(id, 100, 'fast')
      let metrics = tracker.getMetrics(id)

      expect(metrics).toBeDefined()
      expect(metrics?.totalFiles).toBe(100)
      expect(metrics?.strategy).toBe('fast')
      expect(metrics?.filesAnalyzed).toBe(0)

      // Update metrics
      tracker.updateMetrics(id, { 
        filesAnalyzed: 50,
        cacheHit: true,
        tokensUsed: 1000
      })
      metrics = tracker.getMetrics(id)

      expect(metrics?.filesAnalyzed).toBe(50)
      expect(metrics?.cacheHit).toBe(true)
      expect(metrics?.tokensUsed).toBe(1000)

      // Finish tracking
      const files = [createTestFile(), createTestFile()]
      const finalMetrics = tracker.finishTracking(id, 75, files)

      expect(finalMetrics?.filesAnalyzed).toBe(75)
      expect(finalMetrics?.endTime).toBeDefined()
      expect(finalMetrics?.tokensSaved).toBeDefined()
    })

    test('handles multiple tracked operations', () => {
      tracker.startTracking('op1', 50, 'fast')
      tracker.startTracking('op2', 100, 'thorough')

      expect(tracker.getMetrics('op1')?.totalFiles).toBe(50)
      expect(tracker.getMetrics('op2')?.totalFiles).toBe(100)
    })

    test('clears metrics', () => {
      const id = 'test-clear'
      tracker.startTracking(id, 10, 'fast')

      expect(tracker.getMetrics(id)).toBeDefined()

      tracker.clearMetrics(id)

      expect(tracker.getMetrics(id)).toBeUndefined()
    })

    test('returns all metrics', () => {
      tracker.startTracking('op1', 10, 'fast')
      tracker.startTracking('op2', 20, 'balanced')

      const allMetrics = tracker.getAllMetrics()

      expect(allMetrics.size).toBe(2)
      expect(allMetrics.has('op1')).toBe(true)
      expect(allMetrics.has('op2')).toBe(true)
    })

    test('calculates average metrics', async () => {
      // Complete two operations
      tracker.startTracking('op1', 100, 'fast')
      await new Promise(resolve => setTimeout(resolve, 1)) // Add small delay
      tracker.finishTracking('op1', 50, [])

      tracker.startTracking('op2', 200, 'thorough')
      await new Promise(resolve => setTimeout(resolve, 1)) // Add small delay
      tracker.finishTracking('op2', 100, [])

      const avgMetrics = tracker.getAverageMetrics()

      expect(avgMetrics.totalSuggestions).toBe(2)
      expect(avgMetrics.avgFilesAnalyzed).toBe(75) // (50 + 100) / 2
      expect(avgMetrics.avgDuration).toBeGreaterThan(0)
    })

    test('handles empty metrics for averages', () => {
      const avgMetrics = tracker.getAverageMetrics()

      expect(avgMetrics.avgDuration).toBe(0)
      expect(avgMetrics.avgFilesAnalyzed).toBe(0)
      expect(avgMetrics.avgTokensSaved).toBe(0)
      expect(avgMetrics.totalSuggestions).toBe(0)
    })

    test('ignores incomplete operations in averages', () => {
      tracker.startTracking('incomplete', 100, 'fast')
      tracker.startTracking('complete', 50, 'fast')
      tracker.finishTracking('complete', 25, [])

      const avgMetrics = tracker.getAverageMetrics()

      expect(avgMetrics.totalSuggestions).toBe(1) // Only completed ones
      expect(avgMetrics.avgFilesAnalyzed).toBe(25)
    })
  })

  describe('getFileCategory', () => {
    test('categorizes test files', () => {
      expect(getFileCategory(createTestFile({ path: '/src/Button.test.ts' }))).toBe('test')
      expect(getFileCategory(createTestFile({ path: '/src/Button.spec.ts' }))).toBe('test')
      expect(getFileCategory(createTestFile({ path: '/tests/component.test.ts' }))).toBe('test')
    })

    test('categorizes component files', () => {
      expect(getFileCategory(createTestFile({ path: '/src/components/Button.tsx' }))).toBe('component')
      expect(getFileCategory(createTestFile({ path: '/Button.component.tsx' }))).toBe('component')
    })

    test('categorizes service files', () => {
      expect(getFileCategory(createTestFile({ path: '/src/auth.service.ts' }))).toBe('service')
      expect(getFileCategory(createTestFile({ path: '/services/api.ts' }))).toBe('service')
    })

    test('categorizes API/route files', () => {
      expect(getFileCategory(createTestFile({ path: '/src/routes/user.ts' }))).toBe('api')
      expect(getFileCategory(createTestFile({ path: '/api/auth.ts' }))).toBe('api')
    })

    test('categorizes hook files', () => {
      expect(getFileCategory(createTestFile({ path: '/src/hooks/useAuth.ts' }))).toBe('hook')
      expect(getFileCategory(createTestFile({ path: '/useHook.ts' }))).toBe('hook')
    })

    test('categorizes utility files', () => {
      expect(getFileCategory(createTestFile({ path: '/src/utils/helper.ts' }))).toBe('utility')
      expect(getFileCategory(createTestFile({ path: '/helpers/format.ts' }))).toBe('utility')
    })

    test('categorizes schema/model files', () => {
      expect(getFileCategory(createTestFile({ path: '/src/schemas/user.ts' }))).toBe('schema')
      expect(getFileCategory(createTestFile({ path: '/models/product.ts' }))).toBe('schema')
    })

    test('categorizes config files', () => {
      expect(getFileCategory(createTestFile({ path: '/config/app.ts' }))).toBe('config')
      expect(getFileCategory(createTestFile({ path: 'webpack.config.js' }))).toBe('config')
      expect(getFileCategory(createTestFile({ extension: 'json' }))).toBe('config')
    })

    test('categorizes style files', () => {
      expect(getFileCategory(createTestFile({ path: '/styles/main.css' }))).toBe('style')
      expect(getFileCategory(createTestFile({ extension: 'scss' }))).toBe('style')
    })

    test('categorizes by extension', () => {
      expect(getFileCategory(createTestFile({ extension: 'ts' }))).toBe('typescript')
      expect(getFileCategory(createTestFile({ extension: 'tsx' }))).toBe('react')
      expect(getFileCategory(createTestFile({ extension: 'py' }))).toBe('python')
      expect(getFileCategory(createTestFile({ extension: 'go' }))).toBe('go')
      expect(getFileCategory(createTestFile({ extension: 'rs' }))).toBe('rust')
      expect(getFileCategory(createTestFile({ extension: 'md' }))).toBe('docs')
    })

    test('returns other for unknown types', () => {
      expect(getFileCategory(createTestFile({ extension: 'xyz' }))).toBe('other')
      expect(getFileCategory(createTestFile({ extension: '' }))).toBe('other')
    })

    test('prioritizes path patterns over extensions', () => {
      const file = createTestFile({ 
        path: '/src/Button.test.tsx',
        extension: 'tsx' // Would be 'react' by extension
      })

      expect(getFileCategory(file)).toBe('test') // Path pattern wins
    })
  })
})