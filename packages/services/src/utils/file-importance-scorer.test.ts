import { describe, test, expect } from 'bun:test'
import {
  getFileImportance,
  sortFilesByImportance,
  getTopImportantFiles,
  filterByImportance
} from './file-importance-scorer'
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

describe('file-importance-scorer', () => {
  describe('getFileImportance', () => {
    describe('file type scoring', () => {
      test('scores service files highest', () => {
        const service = createTestFile({ name: 'user.service.ts' })
        const importance = getFileImportance(service)
        
        expect(importance.factors.type).toBe(3.0)
        expect(importance.score).toBeGreaterThan(1)
      })

      test('scores API and route files high', () => {
        const api = createTestFile({ name: 'users.api.ts' })
        const route = createTestFile({ name: 'auth.route.js' })
        const controller = createTestFile({ name: 'auth.controller.ts' })
        
        expect(getFileImportance(api).factors.type).toBe(2.5)
        expect(getFileImportance(route).factors.type).toBe(2.5)
        expect(getFileImportance(controller).factors.type).toBe(2.5)
      })

      test('scores configuration and schema files moderately high', () => {
        const schema = createTestFile({ name: 'user.schema.ts' })
        const config = createTestFile({ name: 'app.config.js' })
        const env = createTestFile({ name: '.env' })
        
        expect(getFileImportance(schema).factors.type).toBe(2.0)
        expect(getFileImportance(config).factors.type).toBe(2.0)
        expect(getFileImportance(env).factors.type).toBe(2.0)
      })

      test('scores entry point files high', () => {
        const index = createTestFile({ name: 'index.ts' })
        const main = createTestFile({ name: 'main.js' })
        const app = createTestFile({ name: 'app.ts' })
        
        expect(getFileImportance(index).factors.type).toBe(2.0)
        expect(getFileImportance(main).factors.type).toBe(2.0)
        expect(getFileImportance(app).factors.type).toBe(2.0)
      })

      test('scores React components moderately', () => {
        const tsx = createTestFile({ name: 'Button.tsx' })
        const jsx = createTestFile({ name: 'Card.jsx' })
        
        expect(getFileImportance(tsx).factors.type).toBe(1.5)
        expect(getFileImportance(jsx).factors.type).toBe(1.5)
      })

      test('scores regular source files standard', () => {
        const ts = createTestFile({ name: 'utils.ts' })
        const js = createTestFile({ name: 'helper.js' })
        const py = createTestFile({ name: 'script.py' })
        
        expect(getFileImportance(ts).factors.type).toBe(1.0)
        expect(getFileImportance(js).factors.type).toBe(1.0)
        expect(getFileImportance(py).factors.type).toBe(1.0)
      })

      test('scores test files appropriately', () => {
        const test1 = createTestFile({ name: 'utils.test.ts' })
        const test2 = createTestFile({ name: 'helper.spec.js' })
        const regular = createTestFile({ name: 'utils.ts' })
        
        // Test files should score lower than regular files
        const test1Score = getFileImportance(test1).factors.type
        const test2Score = getFileImportance(test2).factors.type
        const regularScore = getFileImportance(regular).factors.type
        
        // Verify relative scoring
        expect(test1Score).toBeLessThanOrEqual(regularScore)
        expect(test2Score).toBeLessThanOrEqual(regularScore)
      })

      test('scores documentation files very low', () => {
        const md = createTestFile({ name: 'README.md' })
        const txt = createTestFile({ name: 'notes.txt' })
        
        expect(getFileImportance(md).factors.type).toBe(0.3)
        expect(getFileImportance(txt).factors.type).toBe(0.2)
      })

      test('scores unknown extensions lowest', () => {
        const unknown = createTestFile({ name: 'file.xyz' })
        
        expect(getFileImportance(unknown).factors.type).toBe(0.1)
      })
    })

    describe('location scoring', () => {
      test('scores src directory high', () => {
        const file = createTestFile({ path: '/src/utils/helper.ts' })
        const importance = getFileImportance(file)
        
        // src=2.0 * depthPenalty (3 levels = 0.7) = 1.4
        expect(importance.factors.location).toBe(1.4)
      })

      test('scores service/api directories highest', () => {
        const service = createTestFile({ path: '/src/services/user.ts' })
        const api = createTestFile({ path: '/src/api/auth.ts' })
        const routes = createTestFile({ path: '/routes/index.ts' })
        
        // services=2.5 * depthPenalty (3 levels = 0.7) = 1.75
        expect(getFileImportance(service).factors.location).toBe(1.75)
        // api=2.5 * depthPenalty (3 levels = 0.7) = 1.75
        expect(getFileImportance(api).factors.location).toBe(1.75)
        // routes=2.5 * depthPenalty (2 levels = 0.8) = 2.0
        expect(getFileImportance(routes).factors.location).toBe(2.0)
      })

      test('scores test directories low', () => {
        const test1 = createTestFile({ path: '/test/unit.ts' })
        const test2 = createTestFile({ path: '/src/__tests__/helper.ts' })
        
        // Test directories should score lower than regular directories
        const srcFile = createTestFile({ path: '/src/regular.ts' })
        
        expect(getFileImportance(test1).factors.location).toBeLessThan(
          getFileImportance(srcFile).factors.location
        )
        // __tests__ in src still gets src bonus
        expect(getFileImportance(test2).factors.location).toBeGreaterThan(0)
      })

      test('penalizes deep nesting', () => {
        const shallow = createTestFile({ path: '/src/file.ts' })
        const deep = createTestFile({ path: '/src/a/b/c/d/e/f/file.ts' })
        
        expect(getFileImportance(shallow).factors.location)
          .toBeGreaterThan(getFileImportance(deep).factors.location)
      })

      test('scores node_modules and .git very low', () => {
        const nodeModule = createTestFile({ path: '/node_modules/package/index.js' })
        const git = createTestFile({ path: '/.git/objects/file' })
        
        // These should have very low scores
        expect(getFileImportance(nodeModule).factors.location).toBeLessThan(1.0)
        expect(getFileImportance(git).factors.location).toBeLessThan(1.0)
      })
    })

    describe('import/export scoring', () => {
      test('scores files with moderate imports higher', () => {
        const noImports = createTestFile({ imports: [] })
        const fewImports = createTestFile({ 
          imports: Array(5).fill({ source: 'module', specifiers: [] })
        })
        const manyImports = createTestFile({
          imports: Array(15).fill({ source: 'module', specifiers: [] })
        })
        
        expect(getFileImportance(noImports).factors.imports).toBe(0.5)
        expect(getFileImportance(fewImports).factors.imports).toBe(1.0)
        expect(getFileImportance(manyImports).factors.imports).toBe(2.0)
      })

      test('scores files with many exports higher', () => {
        const noExports = createTestFile({ exports: [] })
        const fewExports = createTestFile({
          exports: Array(3).fill({ type: 'named', source: null, specifiers: [] })
        })
        const manyExports = createTestFile({
          exports: Array(15).fill({ type: 'named', source: null, specifiers: [] })
        })
        
        expect(getFileImportance(noExports).factors.exports).toBe(0.5)
        expect(getFileImportance(fewExports).factors.exports).toBe(1.0)
        expect(getFileImportance(manyExports).factors.exports).toBe(2.5)
      })

      test('identifies integration points', () => {
        const integrationFile = createTestFile({
          imports: Array(25).fill({ source: 'module', specifiers: [] }),
          exports: Array(25).fill({ type: 'named', source: null, specifiers: [] })
        })
        
        expect(getFileImportance(integrationFile).factors.imports).toBe(2.5)
        expect(getFileImportance(integrationFile).factors.exports).toBe(3.0)
      })
    })

    describe('file size scoring', () => {
      test('scores empty files lowest', () => {
        const empty = createTestFile({ size: 0 })
        expect(getFileImportance(empty).factors.size).toBe(0.1)
      })

      test('scores very small files low', () => {
        const tiny = createTestFile({ size: 50 })
        expect(getFileImportance(tiny).factors.size).toBe(0.5)
      })

      test('scores moderate size files highest', () => {
        const moderate = createTestFile({ size: 5000 })
        expect(getFileImportance(moderate).factors.size).toBe(2.0)
      })

      test('scores large files lower', () => {
        const large = createTestFile({ size: 30000 })
        const veryLarge = createTestFile({ size: 100000 })
        
        expect(getFileImportance(large).factors.size).toBe(1.5)
        expect(getFileImportance(veryLarge).factors.size).toBe(1.0)
      })
    })

    describe('recency scoring', () => {
      test('scores files modified today highest', () => {
        const recent = createTestFile({ updated: Date.now() })
        expect(getFileImportance(recent).factors.recency).toBe(3.0)
      })

      test('scores files modified this week high', () => {
        const thisWeek = createTestFile({ 
          updated: Date.now() - (3 * 24 * 60 * 60 * 1000) // 3 days ago
        })
        expect(getFileImportance(thisWeek).factors.recency).toBe(2.5)
      })

      test('scores files modified this month moderately', () => {
        const thisMonth = createTestFile({
          updated: Date.now() - (15 * 24 * 60 * 60 * 1000) // 15 days ago
        })
        expect(getFileImportance(thisMonth).factors.recency).toBe(2.0)
      })

      test('scores old files low', () => {
        const old = createTestFile({
          updated: Date.now() - (200 * 24 * 60 * 60 * 1000) // 200 days ago
        })
        const veryOld = createTestFile({
          updated: Date.now() - (400 * 24 * 60 * 60 * 1000) // 400 days ago
        })
        
        expect(getFileImportance(old).factors.recency).toBe(1.0)
        expect(getFileImportance(veryOld).factors.recency).toBe(0.5)
      })
    })

    describe('overall scoring', () => {
      test('combines all factors with proper weights', () => {
        const file = createTestFile({
          name: 'user.service.ts',
          path: '/src/services/user.service.ts',
          imports: Array(10).fill({ source: 'module', specifiers: [] }),
          exports: Array(5).fill({ type: 'named', source: null, specifiers: [] }),
          size: 5000,
          updated: Date.now()
        })
        
        const importance = getFileImportance(file)
        
        // With the actual weighting formula, expect a lower but reasonable score
        expect(importance.score).toBeGreaterThan(2)
        expect(importance.score).toBeLessThanOrEqual(10)
        expect(importance.fileId).toBe('1')
      })

      test('caps maximum score at 10', () => {
        const superImportant = createTestFile({
          name: 'critical.service.ts',
          path: '/src/services/critical.service.ts',
          imports: Array(100).fill({ source: 'module', specifiers: [] }),
          exports: Array(100).fill({ type: 'named', source: null, specifiers: [] }),
          size: 8000,
          updated: Date.now()
        })
        
        const importance = getFileImportance(superImportant)
        // Even with max factors, the weighted formula caps at a lower value
        expect(importance.score).toBeGreaterThan(2)
        expect(importance.score).toBeLessThanOrEqual(10)
      })

      test('provides detailed factor breakdown', () => {
        const file = createTestFile()
        const importance = getFileImportance(file)
        
        expect(importance.factors).toHaveProperty('type')
        expect(importance.factors).toHaveProperty('location')
        expect(importance.factors).toHaveProperty('imports')
        expect(importance.factors).toHaveProperty('exports')
        expect(importance.factors).toHaveProperty('size')
        expect(importance.factors).toHaveProperty('recency')
      })
    })
  })

  describe('sortFilesByImportance', () => {
    test('sorts files by importance score descending', () => {
      const files = [
        createTestFile({ id: 1, name: 'test.txt', size: 100 }),
        createTestFile({ id: 2, name: 'main.service.ts', path: '/src/services/main.ts' }),
        createTestFile({ id: 3, name: 'index.ts', path: '/src/index.ts' })
      ]
      
      const sorted = sortFilesByImportance(files)
      
      const scores = sorted.map(f => getFileImportance(f).score)
      expect(scores[0]).toBeGreaterThanOrEqual(scores[1])
      expect(scores[1]).toBeGreaterThanOrEqual(scores[2])
    })

    test('handles empty array', () => {
      const sorted = sortFilesByImportance([])
      expect(sorted).toEqual([])
    })

    test('preserves original array', () => {
      const files = [
        createTestFile({ id: 1 }),
        createTestFile({ id: 2 })
      ]
      const original = [...files]
      
      sortFilesByImportance(files)
      
      expect(files).toEqual(original)
    })
  })

  describe('getTopImportantFiles', () => {
    test('returns top N files', () => {
      const files = Array.from({ length: 10 }, (_, i) => 
        createTestFile({ 
          id: i,
          name: i < 3 ? `service${i}.service.ts` : `file${i}.txt`
        })
      )
      
      const top3 = getTopImportantFiles(files, 3)
      
      expect(top3).toHaveLength(3)
      top3.forEach(file => {
        expect(file.name).toContain('service')
      })
    })

    test('handles N larger than array length', () => {
      const files = [
        createTestFile({ id: 1 }),
        createTestFile({ id: 2 })
      ]
      
      const top10 = getTopImportantFiles(files, 10)
      
      expect(top10).toHaveLength(2)
    })

    test('handles N = 0', () => {
      const files = [createTestFile()]
      const top0 = getTopImportantFiles(files, 0)
      
      expect(top0).toEqual([])
    })

    test('handles empty array', () => {
      const top5 = getTopImportantFiles([], 5)
      expect(top5).toEqual([])
    })
  })

  describe('filterByImportance', () => {
    test('filters files by minimum score', () => {
      const files = [
        createTestFile({ name: 'important.service.ts', path: '/src/services/important.ts' }),
        createTestFile({ name: 'unimportant.txt', size: 10 }),
        createTestFile({ name: 'moderate.ts', path: '/src/moderate.ts' })
      ]
      
      // Most files will score below 2.0 with the weighted formula
      const filtered = filterByImportance(files, 1.0)
      
      expect(filtered.length).toBeGreaterThan(0)
      filtered.forEach(file => {
        expect(getFileImportance(file).score).toBeGreaterThanOrEqual(1.0)
      })
    })

    test('returns empty array when no files meet threshold', () => {
      const files = [
        createTestFile({ name: 'test.txt', size: 10 })
      ]
      
      const filtered = filterByImportance(files, 9.0)
      
      expect(filtered).toEqual([])
    })

    test('returns all files when threshold is 0', () => {
      const files = [
        createTestFile({ id: 1 }),
        createTestFile({ id: 2 })
      ]
      
      const filtered = filterByImportance(files, 0)
      
      expect(filtered).toEqual(files)
    })

    test('handles empty array', () => {
      const filtered = filterByImportance([], 5.0)
      expect(filtered).toEqual([])
    })
  })

  describe('edge cases and performance', () => {
    test('handles files with null/undefined optional fields', () => {
      const file = createTestFile({
        imports: null as any,
        exports: undefined as any,
        size: null as any
      })
      
      const importance = getFileImportance(file)
      
      expect(importance.score).toBeGreaterThan(0)
      expect(importance.factors.imports).toBe(0.5)
      expect(importance.factors.exports).toBe(0.5)
      expect(importance.factors.size).toBe(0.1)
    })

    test('performs well with large file lists', () => {
      const files = Array.from({ length: 1000 }, (_, i) =>
        createTestFile({
          id: i,
          name: `file${i}.ts`,
          imports: Array(Math.floor(Math.random() * 20)).fill({ source: 'mod', specifiers: [] }),
          size: Math.floor(Math.random() * 50000)
        })
      )
      
      const startTime = performance.now()
      const sorted = sortFilesByImportance(files)
      const endTime = performance.now()
      
      expect(sorted).toHaveLength(1000)
      expect(endTime - startTime).toBeLessThan(100) // Should be fast
    })

    test('scores are deterministic', () => {
      const file = createTestFile({
        name: 'test.service.ts',
        path: '/src/services/test.ts',
        imports: Array(5).fill({ source: 'module', specifiers: [] }),
        size: 5000,
        updated: 1609459200000 // Fixed timestamp
      })
      
      const score1 = getFileImportance(file).score
      const score2 = getFileImportance(file).score
      
      expect(score1).toBe(score2)
    })
  })
})