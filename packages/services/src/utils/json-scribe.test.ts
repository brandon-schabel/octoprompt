import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'
import { writeJson, readJson, jsonScribe } from './json-scribe'
import { z, ZodError } from 'zod'
import path from 'node:path'
import { rmSync, mkdirSync } from 'node:fs'

// Test directory for file operations
const TEST_DIR = path.join(process.cwd(), '.test-json-scribe')

describe('json-scribe', () => {
  beforeEach(() => {
    // Create test directory
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    // Clean up test directory
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  describe('resolveJsonPath (internal)', () => {
    // Testing through the public API since resolveJsonPath is not exported

    test('adds .json extension if missing', async () => {
      const filePath = 'test-file'
      await writeJson({ 
        path: filePath, 
        data: { test: true },
        basePath: TEST_DIR 
      })

      const expectedPath = path.join(TEST_DIR, 'test-file.json')
      const file = Bun.file(expectedPath)
      expect(await file.exists()).toBe(true)
    })

    test('preserves existing .json extension', async () => {
      const filePath = 'test-file.json'
      await writeJson({ 
        path: filePath, 
        data: { test: true },
        basePath: TEST_DIR 
      })

      const expectedPath = path.join(TEST_DIR, 'test-file.json')
      const file = Bun.file(expectedPath)
      expect(await file.exists()).toBe(true)
    })

    test('handles array paths', async () => {
      await writeJson({ 
        path: ['sub', 'dir', 'file'], 
        data: { test: true },
        basePath: TEST_DIR 
      })

      const expectedPath = path.join(TEST_DIR, 'sub', 'dir', 'file.json')
      const file = Bun.file(expectedPath)
      expect(await file.exists()).toBe(true)
    })

    test('handles absolute paths', async () => {
      const absolutePath = path.join(TEST_DIR, 'absolute-test.json')
      await writeJson({ 
        path: absolutePath, 
        data: { test: true }
      })

      const file = Bun.file(absolutePath)
      expect(await file.exists()).toBe(true)
    })

    test('normalizes slashes in paths', async () => {
      const mixedPath = 'sub\\dir/file'
      await writeJson({ 
        path: mixedPath, 
        data: { test: true },
        basePath: TEST_DIR 
      })

      const expectedPath = path.join(TEST_DIR, 'sub', 'dir', 'file.json')
      const file = Bun.file(expectedPath)
      expect(await file.exists()).toBe(true)
    })
  })

  describe('writeJson', () => {
    test('writes data to JSON file', async () => {
      const data = { name: 'test', value: 123, nested: { prop: 'value' } }
      const result = await writeJson({
        path: 'test-write.json',
        data,
        basePath: TEST_DIR
      })

      expect(result).toEqual(data)

      // Verify file contents
      const filePath = path.join(TEST_DIR, 'test-write.json')
      const fileContent = await Bun.file(filePath).json()
      expect(fileContent).toEqual(data)
    })

    test('creates nested directories if needed', async () => {
      const data = { test: 'nested' }
      await writeJson({
        path: ['deeply', 'nested', 'dir', 'file.json'],
        data,
        basePath: TEST_DIR
      })

      const filePath = path.join(TEST_DIR, 'deeply', 'nested', 'dir', 'file.json')
      const file = Bun.file(filePath)
      expect(await file.exists()).toBe(true)
      expect(await file.json()).toEqual(data)
    })

    test('validates data with Zod schema', async () => {
      const schema = z.object({
        name: z.string(),
        age: z.number().min(0).max(120)
      })

      const validData = { name: 'John', age: 25 }
      const result = await writeJson({
        path: 'validated.json',
        data: validData,
        schema,
        basePath: TEST_DIR
      })

      expect(result).toEqual(validData)
    })

    test('throws ZodError for invalid data', async () => {
      const schema = z.object({
        name: z.string(),
        age: z.number().min(0).max(120)
      })

      const invalidData = { name: 'John', age: 150 } // Age too high

      await expect(
        writeJson({
          path: 'invalid.json',
          data: invalidData,
          schema,
          basePath: TEST_DIR
        })
      ).rejects.toThrow(ZodError)
    })

    test('transforms data with Zod schema', async () => {
      const schema = z.object({
        name: z.string().trim().toLowerCase(),
        age: z.number().default(0)
      })

      const input = { name: '  JOHN  ' }
      const result = await writeJson({
        path: 'transformed.json',
        data: input,
        schema,
        basePath: TEST_DIR
      })

      expect(result.name).toBe('john') // Trimmed and lowercased
      expect(result.age).toBe(0) // Default applied

      // Verify file contains transformed data
      const filePath = path.join(TEST_DIR, 'transformed.json')
      const fileContent = await Bun.file(filePath).json()
      expect(fileContent.name).toBe('john')
      expect(fileContent.age).toBe(0)
    })

    test('handles async schema validation', async () => {
      const schema = z.object({
        url: z.string().refine(
          async (val) => {
            // Simulate async validation
            await new Promise(resolve => setTimeout(resolve, 10))
            return val.startsWith('https://')
          },
          { message: 'URL must use HTTPS' }
        )
      })

      const validData = { url: 'https://example.com' }
      const result = await writeJson({
        path: 'async-valid.json',
        data: validData,
        schema,
        basePath: TEST_DIR
      })

      expect(result).toEqual(validData)
    })

    test('pretty prints JSON with 2-space indentation', async () => {
      const data = { 
        level1: { 
          level2: { 
            value: 'nested' 
          } 
        } 
      }

      await writeJson({
        path: 'pretty.json',
        data,
        basePath: TEST_DIR
      })

      const filePath = path.join(TEST_DIR, 'pretty.json')
      const fileContent = await Bun.file(filePath).text()
      
      expect(fileContent).toContain('  "level1"') // 2 spaces
      expect(fileContent).toContain('    "level2"') // 4 spaces
      expect(fileContent).toContain('      "value"') // 6 spaces
    })

    test('overwrites existing files', async () => {
      const path1 = path.join(TEST_DIR, 'overwrite.json')
      
      // Write initial data
      await writeJson({
        path: path1,
        data: { version: 1 }
      })

      // Overwrite with new data
      await writeJson({
        path: path1,
        data: { version: 2, new: true }
      })

      const fileContent = await Bun.file(path1).json()
      expect(fileContent).toEqual({ version: 2, new: true })
      expect(fileContent).not.toHaveProperty('version', 1)
    })

    test('throws error for invalid path inputs', async () => {
      await expect(
        writeJson({
          path: '',
          data: { test: true }
        })
      ).rejects.toThrow('Invalid path input')

      await expect(
        writeJson({
          path: [],
          data: { test: true }
        })
      ).rejects.toThrow('Invalid path input')

      await expect(
        writeJson({
          path: ['', ''],
          data: { test: true }
        })
      ).rejects.toThrow('Invalid path input')
    })
  })

  describe('readJson', () => {
    test('reads and parses JSON file', async () => {
      const data = { name: 'test', value: 456, array: [1, 2, 3] }
      const filePath = path.join(TEST_DIR, 'read-test.json')
      await Bun.write(filePath, JSON.stringify(data))

      const result = await readJson({
        path: 'read-test.json',
        basePath: TEST_DIR
      })

      expect(result).toEqual(data)
    })

    test('returns null for non-existent file', async () => {
      const result = await readJson({
        path: 'non-existent.json',
        basePath: TEST_DIR
      })

      expect(result).toBeNull()
    })

    test('handles array paths', async () => {
      const data = { test: 'array-path' }
      const filePath = path.join(TEST_DIR, 'sub', 'dir', 'file.json')
      mkdirSync(path.dirname(filePath), { recursive: true })
      await Bun.write(filePath, JSON.stringify(data))

      const result = await readJson({
        path: ['sub', 'dir', 'file'],
        basePath: TEST_DIR
      })

      expect(result).toEqual(data)
    })

    test('adds .json extension when reading', async () => {
      const data = { test: 'no-extension' }
      const filePath = path.join(TEST_DIR, 'file.json')
      await Bun.write(filePath, JSON.stringify(data))

      const result = await readJson({
        path: 'file', // Without extension
        basePath: TEST_DIR
      })

      expect(result).toEqual(data)
    })

    test('throws error for invalid JSON', async () => {
      const filePath = path.join(TEST_DIR, 'invalid.json')
      await Bun.write(filePath, 'not valid json {')

      await expect(
        readJson({
          path: 'invalid.json',
          basePath: TEST_DIR
        })
      ).rejects.toThrow('Failed to read or parse JSON')
    })

    test('uses generic type parameter', async () => {
      interface User {
        id: number
        name: string
        email: string
      }

      const userData: User = {
        id: 1,
        name: 'Alice',
        email: 'alice@example.com'
      }

      const filePath = path.join(TEST_DIR, 'user.json')
      await Bun.write(filePath, JSON.stringify(userData))

      const result = await readJson<User>({
        path: 'user.json',
        basePath: TEST_DIR
      })

      expect(result).not.toBeNull()
      if (result) {
        expect(result.id).toBe(1)
        expect(result.name).toBe('Alice')
        expect(result.email).toBe('alice@example.com')
      }
    })

    test('handles deeply nested JSON', async () => {
      const deepData = {
        level1: {
          level2: {
            level3: {
              level4: {
                value: 'deep'
              }
            }
          }
        }
      }

      const filePath = path.join(TEST_DIR, 'deep.json')
      await Bun.write(filePath, JSON.stringify(deepData))

      const result = await readJson({
        path: 'deep.json',
        basePath: TEST_DIR
      })

      expect(result).toEqual(deepData)
    })

    test('handles large JSON files', async () => {
      const largeArray = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        value: `item-${i}`,
        nested: { prop: i * 2 }
      }))

      const filePath = path.join(TEST_DIR, 'large.json')
      await Bun.write(filePath, JSON.stringify(largeArray))

      const result = await readJson({
        path: 'large.json',
        basePath: TEST_DIR
      })

      expect(result).toEqual(largeArray)
      expect(Array.isArray(result)).toBe(true)
      expect((result as any).length).toBe(1000)
    })
  })

  describe('jsonScribe namespace', () => {
    test('provides write and read methods', () => {
      expect(jsonScribe.write).toBe(writeJson)
      expect(jsonScribe.read).toBe(readJson)
    })

    test('works with the namespace methods', async () => {
      const data = { using: 'namespace' }
      
      await jsonScribe.write({
        path: 'namespace-test.json',
        data,
        basePath: TEST_DIR
      })

      const result = await jsonScribe.read({
        path: 'namespace-test.json',
        basePath: TEST_DIR
      })

      expect(result).toEqual(data)
    })
  })

  describe('integration scenarios', () => {
    test('write with schema then read back', async () => {
      const userSchema = z.object({
        id: z.number(),
        username: z.string().min(3),
        email: z.string().email(),
        createdAt: z.date().transform(d => d.toISOString())
      })

      const userData = {
        id: 123,
        username: 'testuser',
        email: 'test@example.com',
        createdAt: new Date('2024-01-01')
      }

      // Write with validation
      const written = await writeJson({
        path: 'user-data.json',
        data: userData,
        schema: userSchema,
        basePath: TEST_DIR
      })

      expect(written.createdAt).toBe('2024-01-01T00:00:00.000Z')

      // Read back
      const read = await readJson({
        path: 'user-data.json',
        basePath: TEST_DIR
      })

      expect(read).toEqual({
        id: 123,
        username: 'testuser',
        email: 'test@example.com',
        createdAt: '2024-01-01T00:00:00.000Z' // Date is now a string
      })
    })

    test('handles concurrent writes to different files', async () => {
      const writes = Array.from({ length: 10 }, (_, i) => 
        writeJson({
          path: `concurrent-${i}.json`,
          data: { index: i, timestamp: Date.now() },
          basePath: TEST_DIR
        })
      )

      const results = await Promise.all(writes)

      expect(results).toHaveLength(10)
      results.forEach((result, i) => {
        expect(result.index).toBe(i)
      })

      // Verify all files exist
      const reads = Array.from({ length: 10 }, (_, i) =>
        readJson({
          path: `concurrent-${i}.json`,
          basePath: TEST_DIR
        })
      )

      const readResults = await Promise.all(reads)
      readResults.forEach((result, i) => {
        expect(result).not.toBeNull()
        expect((result as any).index).toBe(i)
      })
    })

    test('maintains data integrity through write-read cycle', async () => {
      const complexData = {
        string: 'test',
        number: 42,
        float: 3.14159,
        boolean: true,
        null: null,
        array: [1, 'two', { three: 3 }],
        object: {
          nested: {
            deeply: {
              value: 'found'
            }
          }
        },
        unicode: '😀🎉',
        special: 'line1\nline2\ttab',
        empty: '',
        zero: 0,
        false: false
      }

      await writeJson({
        path: 'complex.json',
        data: complexData,
        basePath: TEST_DIR
      })

      const result = await readJson({
        path: 'complex.json',
        basePath: TEST_DIR
      })

      expect(result).toEqual(complexData)
    })
  })
})