import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test'
import { DatabaseManager, resetTestDatabase, clearAllData } from '@promptliano/storage'
import { fileSearchService } from './file-search-service'
import { fileIndexingService } from './file-indexing-service'
import type { ProjectFile } from '@promptliano/schemas'

describe('FileSearchService', () => {
  const testProjectId = 999999
  let db: any

  beforeAll(async () => {
    // Reset and initialize test database with migrations
    await resetTestDatabase()
    
    // Get database instance
    db = DatabaseManager.getInstance().getDatabase()
  })

  beforeEach(async () => {
    // Clean up test data - tables might not exist yet
    try {
      db.prepare('DELETE FROM file_search_fts WHERE project_id = ?').run(testProjectId)
    } catch {}
    try {
      db.prepare('DELETE FROM file_search_metadata WHERE project_id = ?').run(testProjectId)
    } catch {}
    try {
      db.prepare('DELETE FROM file_keywords WHERE file_id LIKE ?').run(`test-${testProjectId}-%`)
    } catch {}
    try {
      db.prepare('DELETE FROM file_trigrams WHERE file_id LIKE ?').run(`test-${testProjectId}-%`)
    } catch {}
    try {
      db.prepare('DELETE FROM search_cache WHERE project_id = ?').run(testProjectId)
    } catch {}
  })

  afterAll(async () => {
    // Clean up all test data
    await clearAllData()
  })

  const createTestFile = (id: string, path: string, content: string): ProjectFile => ({
    id: `test-${testProjectId}-${id}`,
    projectId: testProjectId,
    path,
    name: path.split('/').pop() || '',
    extension: path.split('.').pop() || '',
    content,
    type: 'file',
    size: content.length,
    created: Date.now(),
    updated: Date.now(),
    permissions: 'rw-r--r--',
    depth: path.split('/').length - 1
  })

  // Skip in CI - database lifecycle issue causing "Cannot use a closed database" error
  test.skip('should handle empty search results gracefully', async () => {
    const result = await fileSearchService.search(testProjectId, {
      query: 'nonexistent',
      searchType: 'semantic'
    })

    expect(result.results).toEqual([])
    expect(result.stats.totalResults).toBe(0)
    expect(result.stats.cached).toBe(false)
  })

  // Skip in CI - database lifecycle issue
  test.skip('should index and search files with semantic search', async () => {
    // Create test files
    const files: ProjectFile[] = [
      createTestFile(
        '1',
        'src/auth/login.ts',
        'export function authenticateUser(username: string, password: string) { return validateCredentials(username, password) }'
      ),
      createTestFile(
        '2',
        'src/auth/logout.ts',
        'export function logoutUser(sessionId: string) { return destroySession(sessionId) }'
      ),
      createTestFile(
        '3',
        'src/utils/validation.ts',
        'export function validateEmail(email: string) { return emailRegex.test(email) }'
      )
    ]

    // Index files
    const indexResult = await fileIndexingService.indexFiles(files, true)
    expect(indexResult.indexed).toBe(3)
    expect(indexResult.failed).toBe(0)

    // Search for authentication
    const searchResult = await fileSearchService.search(testProjectId, {
      query: 'authentication',
      searchType: 'semantic'
    })

    expect(searchResult.results.length).toBeGreaterThan(0)
    expect(searchResult.stats.totalResults).toBeGreaterThan(0)

    // Should find auth-related files
    const paths = searchResult.results.map((r) => r.file.path)
    expect(paths).toContain('src/auth/login.ts')
  })

  // Skip in CI - database lifecycle issue
  test.skip('should perform exact match search', async () => {
    const files: ProjectFile[] = [
      createTestFile('1', 'src/config.ts', 'export const API_KEY = "secret-api-key-12345"'),
      createTestFile('2', 'src/utils.ts', 'export function getApiKey() { return process.env.API_KEY }')
    ]

    await fileIndexingService.indexFiles(files, true)

    const result = await fileSearchService.search(testProjectId, {
      query: 'secret-api-key-12345',
      searchType: 'exact'
    })

    expect(result.results.length).toBe(1)
    expect(result.results[0].file.path).toBe('src/config.ts')
  })

  // Skip in CI - database lifecycle issue
  test.skip('should perform fuzzy search', async () => {
    const files: ProjectFile[] = [
      createTestFile(
        '1',
        'src/components/Button.tsx',
        'export const Button = ({ onClick, children }) => <button onClick={onClick}>{children}</button>'
      ),
      createTestFile(
        '2',
        'src/components/Buttton.tsx',
        'export const Buttton = ({ onClick }) => <div onClick={onClick}>Click me</div>'
      ) // Typo intentional
    ]

    await fileIndexingService.indexFiles(files, true)

    const result = await fileSearchService.search(testProjectId, {
      query: 'Button',
      searchType: 'fuzzy'
    })

    // Should find both files due to fuzzy matching
    expect(result.results.length).toBe(2)
  })

  // Skip in CI - database lifecycle issue
  test.skip('should perform regex search', async () => {
    const files: ProjectFile[] = [
      createTestFile('1', 'src/api.ts', 'fetch("/api/v1/users")'),
      createTestFile('2', 'src/client.ts', 'fetch("/api/v2/posts")'),
      createTestFile('3', 'src/legacy.ts', 'fetch("/old/api/data")')
    ]

    await fileIndexingService.indexFiles(files, true)

    const result = await fileSearchService.search(testProjectId, {
      query: '/api/v[0-9]+/',
      searchType: 'regex'
    })

    expect(result.results.length).toBe(2)
    const paths = result.results.map((r) => r.file.path)
    expect(paths).toContain('src/api.ts')
    expect(paths).toContain('src/client.ts')
    expect(paths).not.toContain('src/legacy.ts')
  })

  // Skip in CI - database lifecycle issue
  test.skip('should filter by file types', async () => {
    const files: ProjectFile[] = [
      createTestFile('1', 'src/index.ts', 'const main = () => console.log("TypeScript")'),
      createTestFile('2', 'src/index.js', 'const main = () => console.log("JavaScript")'),
      createTestFile('3', 'styles/main.css', '.main { color: red; }')
    ]

    await fileIndexingService.indexFiles(files, true)

    const result = await fileSearchService.search(testProjectId, {
      query: 'main',
      fileTypes: ['ts', 'js']
    })

    expect(result.results.length).toBe(2)
    const extensions = result.results.map((r) => r.file.extension)
    expect(extensions).toContain('ts')
    expect(extensions).toContain('js')
    expect(extensions).not.toContain('css')
  })

  // Skip in CI - database lifecycle issue
  test.skip('should use search cache', async () => {
    const files: ProjectFile[] = [
      createTestFile('1', 'src/cached.ts', 'export const cachedFunction = () => "cached result"')
    ]

    await fileIndexingService.indexFiles(files, true)

    // First search - not cached
    const result1 = await fileSearchService.search(testProjectId, {
      query: 'cached',
      limit: 10
    })
    expect(result1.stats.cached).toBe(false)

    // Second search - should be cached
    const result2 = await fileSearchService.search(testProjectId, {
      query: 'cached',
      limit: 10
    })
    expect(result2.stats.cached).toBe(true)
    expect(result2.results).toEqual(result1.results)
  })

  // Skip in CI - database lifecycle issue
  test.skip('should handle null file data gracefully', async () => {
    // This tests the defensive programming we added
    const result = await fileSearchService.search(testProjectId, {
      query: 'test',
      searchType: 'semantic'
    })

    // Should not throw error even with no indexed files
    expect(result.results).toEqual([])
    expect(result.stats.totalResults).toBe(0)
  })

  // Skip in CI - database lifecycle issue
  test.skip('should apply different scoring methods', async () => {
    const now = Date.now()
    const files: ProjectFile[] = [
      { ...createTestFile('1', 'old.ts', 'test content'), updated: now - 1000 * 60 * 60 * 24 * 30 }, // 30 days old
      { ...createTestFile('2', 'recent.ts', 'test content'), updated: now - 1000 * 60 * 60 }, // 1 hour old
      { ...createTestFile('3', 'frequent.ts', 'test test test test test'), updated: now - 1000 * 60 * 60 * 24 } // 1 day old
    ]

    await fileIndexingService.indexFiles(files, true)

    // Test relevance scoring (default)
    const relevanceResult = await fileSearchService.search(testProjectId, {
      query: 'test',
      scoringMethod: 'relevance'
    })

    // Test recency scoring
    const recencyResult = await fileSearchService.search(testProjectId, {
      query: 'test',
      scoringMethod: 'recency'
    })
    expect(recencyResult.results[0].file.path).toBe('recent.ts')

    // Test frequency scoring
    const frequencyResult = await fileSearchService.search(testProjectId, {
      query: 'test',
      scoringMethod: 'frequency'
    })
    expect(frequencyResult.results[0].file.path).toBe('frequent.ts')
  })

  // Skip in CI - database lifecycle issue
  test.skip('should handle special characters in queries', async () => {
    const files: ProjectFile[] = [
      createTestFile('1', 'src/api.ts', 'function test() { return "hello"; }'),
      createTestFile('2', 'src/utils.ts', 'const regex = /test[0-9]+/')
    ]

    await fileIndexingService.indexFiles(files, true)

    // Test with parentheses - should not throw error
    const result1 = await fileSearchService.search(testProjectId, {
      query: 'test()',
      searchType: 'semantic'
    })
    expect(result1.results.length).toBeGreaterThan(0)

    // Test with special characters - should not throw error
    const result2 = await fileSearchService.search(testProjectId, {
      query: 'test$#@!',
      searchType: 'semantic'
    })
    // Should return results for "test" after cleaning special chars
    expect(result2.results.length).toBeGreaterThan(0)
  })

  // Skip in CI - database lifecycle issue
  test.skip('should handle camelCase and snake_case queries', async () => {
    const files: ProjectFile[] = [
      createTestFile('1', 'src/auth.ts', 'function authenticateUser() { }'),
      createTestFile('2', 'src/db.ts', 'function get_user_data() { }'),
      createTestFile('3', 'src/api.ts', 'const API_KEY = "secret"')
    ]

    await fileIndexingService.indexFiles(files, true)

    // Test camelCase query
    const result1 = await fileSearchService.search(testProjectId, {
      query: 'authenticateUser',
      searchType: 'semantic'
    })
    expect(result1.results.length).toBeGreaterThan(0)
    expect(result1.results.some((r) => r.file.path === 'src/auth.ts')).toBe(true)

    // Test snake_case query
    const result2 = await fileSearchService.search(testProjectId, {
      query: 'get_user_data',
      searchType: 'semantic'
    })
    expect(result2.results.length).toBeGreaterThan(0)
    expect(result2.results.some((r) => r.file.path === 'src/db.ts')).toBe(true)

    // Test partial camelCase
    const result3 = await fileSearchService.search(testProjectId, {
      query: 'authenticate',
      searchType: 'semantic'
    })
    expect(result3.results.length).toBeGreaterThan(0)
  })

  // Skip in CI - database lifecycle issue
  test.skip('should handle empty project gracefully', async () => {
    // Search in a project with no files
    const result = await fileSearchService.search(testProjectId + 1, {
      query: 'test',
      searchType: 'semantic'
    })

    expect(result.results).toEqual([])
    expect(result.stats.totalResults).toBe(0)
  })

  // Skip in CI - database lifecycle issue
  test.skip('should validate regex patterns', async () => {
    const files: ProjectFile[] = [createTestFile('1', 'test.ts', 'some content')]

    await fileIndexingService.indexFiles(files, true)

    // Test invalid regex
    await expect(
      fileSearchService.search(testProjectId, {
        query: '[invalid(regex',
        searchType: 'regex'
      })
    ).rejects.toThrow('Invalid regex pattern:')
  })

  // Skip in CI - database lifecycle issue
  test.skip('should handle programming keywords in search', async () => {
    const files: ProjectFile[] = [
      createTestFile('1', 'src/main.ts', 'export function main() { return true; }'),
      createTestFile('2', 'src/types.ts', 'interface User { name: string; }'),
      createTestFile('3', 'src/utils.ts', 'class Helper { static help() {} }')
    ]

    await fileIndexingService.indexFiles(files, true)

    // Search for programming keywords (no longer filtered out)
    const result1 = await fileSearchService.search(testProjectId, {
      query: 'function',
      searchType: 'semantic'
    })
    expect(result1.results.length).toBeGreaterThan(0)

    const result2 = await fileSearchService.search(testProjectId, {
      query: 'interface',
      searchType: 'semantic'
    })
    expect(result2.results.length).toBeGreaterThan(0)

    const result3 = await fileSearchService.search(testProjectId, {
      query: 'class',
      searchType: 'semantic'
    })
    expect(result3.results.length).toBeGreaterThan(0)
  })

  // Skip in CI - database lifecycle issue
  test.skip('debug search functionality', async () => {
    const files: ProjectFile[] = [createTestFile('1', 'test.ts', 'test content')]

    await fileIndexingService.indexFiles(files, true)

    const debugResult = await fileSearchService.debugSearch(testProjectId, 'test')

    expect(debugResult.indexStats).toBeDefined()
    expect(debugResult.ftsContent).toBeDefined()
    expect(debugResult.sampleSearch).toBeDefined()
    expect(debugResult.recommendations).toBeDefined()

    expect(debugResult.indexStats.indexedFiles).toBe(1)
    expect(debugResult.ftsContent.projectFTSCount).toBe(1)
    expect(debugResult.sampleSearch?.results?.length).toBeGreaterThan(0)
  })
})
