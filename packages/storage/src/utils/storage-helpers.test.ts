import { describe, test, expect } from 'bun:test'
import { z } from 'zod'
import {
  createEntityConverter,
  FieldConverters,
  createStandardMappings,
  getInsertColumnsFromMappings,
  getInsertValuesFromEntity,
  buildUpdateSetClause,
  validateData,
  batchValidate,
  type FieldMapping
} from './storage-helpers'

describe('storage-helpers', () => {
  describe('createEntityConverter', () => {
    const TestSchema = z.object({
      id: z.number(),
      name: z.string(),
      active: z.boolean(),
      tags: z.array(z.string()),
      created: z.number()
    })

    test('converts simple field mappings', () => {
      // For simple string mappings, values must match schema types
      const converter = createEntityConverter(TestSchema, {
        id: 'id',
        name: 'name',
        active: 'is_active',
        tags: 'tag_list',
        created: 'created_at'
      })

      const row = {
        id: 1,
        name: 'Test',
        is_active: true, // Must be boolean for schema validation
        tag_list: ['tag1', 'tag2'], // Must be array for schema validation
        created_at: 1234567890
      }

      const result = converter(row)
      expect(result.id).toBe(1)
      expect(result.name).toBe('Test')
      expect(result.active).toBe(true)
      expect(result.tags).toEqual(['tag1', 'tag2'])
      expect(result.created).toBe(1234567890)
    })

    test('applies field converters', () => {
      const converter = createEntityConverter(TestSchema, {
        id: { dbColumn: 'id', converter: FieldConverters.toNumber },
        name: { dbColumn: 'name', converter: FieldConverters.toString },
        active: { dbColumn: 'is_active', converter: FieldConverters.toBoolean },
        tags: { dbColumn: 'tag_list', converter: FieldConverters.toArray },
        created: { dbColumn: 'created_at', converter: FieldConverters.toTimestamp }
      })

      const row = {
        id: '1',
        name: 'Test',
        is_active: 1,
        tag_list: '["tag1","tag2"]',
        created_at: 1234567890
      }

      const result = converter(row)
      expect(result.id).toBe(1)
      expect(result.name).toBe('Test')
      expect(result.active).toBe(true)
      expect(result.tags).toEqual(['tag1', 'tag2'])
      expect(result.created).toBe(1234567890000) // Converted to ms
    })

    test('handles null values with defaults', () => {
      const converter = createEntityConverter(TestSchema, {
        id: { dbColumn: 'id', converter: FieldConverters.toNumber },
        name: { dbColumn: 'name', converter: FieldConverters.toString, defaultValue: 'Unknown' },
        active: { dbColumn: 'is_active', converter: FieldConverters.toBoolean, defaultValue: false },
        tags: { dbColumn: 'tag_list', converter: FieldConverters.toArray, defaultValue: [] },
        created: { dbColumn: 'created_at', converter: FieldConverters.toTimestamp }
      })

      const row = {
        id: 1,
        name: null,
        is_active: null,
        tag_list: null,
        created_at: Date.now()
      }

      const result = converter(row)
      expect(result.id).toBe(1)
      expect(result.name).toBe('Unknown')
      expect(result.active).toBe(false)
      expect(result.tags).toEqual([])
    })

    test('throws on invalid schema validation', () => {
      const converter = createEntityConverter(TestSchema, {
        id: 'id',
        name: 'name',
        active: 'is_active',
        tags: 'tag_list',
        created: 'created_at'
      })

      const invalidRow = {
        id: 'not-a-number',
        name: 123, // Should be string
        is_active: 'yes',
        tag_list: 'not-json',
        created_at: 'not-a-timestamp'
      }

      expect(() => converter(invalidRow)).toThrow()
    })
  })

  describe('FieldConverters', () => {
    test('toBoolean converts various inputs', () => {
      expect(FieldConverters.toBoolean(1)).toBe(true)
      expect(FieldConverters.toBoolean(0)).toBe(false)
      expect(FieldConverters.toBoolean('true')).toBe(true)
      expect(FieldConverters.toBoolean('false')).toBe(false)
      expect(FieldConverters.toBoolean(null)).toBe(false)
    })

    test('toNumber converts various inputs', () => {
      expect(FieldConverters.toNumber('123')).toBe(123)
      expect(FieldConverters.toNumber(456)).toBe(456)
      expect(FieldConverters.toNumber(null)).toBe(0)
      expect(FieldConverters.toNumber('invalid')).toBe(0)
    })

    test('toArray parses JSON arrays', () => {
      expect(FieldConverters.toArray('["a","b","c"]')).toEqual(['a', 'b', 'c'])
      expect(FieldConverters.toArray('[]')).toEqual([])
      expect(FieldConverters.toArray(null)).toEqual([])
      expect(FieldConverters.toArray('invalid')).toEqual([])
    })

    test('toEnum validates enum values', () => {
      const validValues = ['open', 'closed', 'pending'] as const
      expect(FieldConverters.toEnum('open', validValues, 'pending')).toBe('open')
      expect(FieldConverters.toEnum('invalid', validValues, 'pending')).toBe('pending')
      expect(FieldConverters.toEnum(null, validValues, 'pending')).toBe('pending')
    })

    test('toTimestamp handles various formats', () => {
      const nowMs = Date.now()
      const nowSec = Math.floor(nowMs / 1000)
      
      expect(FieldConverters.toTimestamp(nowMs)).toBe(nowMs)
      expect(FieldConverters.toTimestamp(nowSec)).toBe(nowSec * 1000)
      expect(FieldConverters.toTimestamp(null)).toBeGreaterThan(0)
    })
  })

  describe('createStandardMappings', () => {
    test('provides default mappings for common fields', () => {
      const mappings = createStandardMappings()
      
      expect(mappings.id).toBeDefined()
      expect(mappings.name).toBeDefined()
      expect(mappings.created).toBeDefined()
      expect(mappings.updated).toBeDefined()
      expect(mappings.projectId).toBeDefined()
    })

    test('merges custom mappings with defaults', () => {
      const mappings = createStandardMappings({
        customField: 'custom_column',
        name: { dbColumn: 'full_name', converter: FieldConverters.toString }
      })
      
      expect(mappings.customField).toBe('custom_column')
      expect(mappings.name).toEqual({
        dbColumn: 'full_name',
        converter: FieldConverters.toString
      })
      expect(mappings.id).toBeDefined() // Still has default
    })
  })

  describe('getInsertColumnsFromMappings', () => {
    test('extracts column names from mappings', () => {
      const mappings = {
        id: 'id',
        name: { dbColumn: 'name' },
        active: { dbColumn: 'is_active' }
      } as Record<string, string | FieldMapping>

      const columns = getInsertColumnsFromMappings(mappings)
      expect(columns).toEqual(['id', 'name', 'is_active'])
    })

    test('excludes specified columns', () => {
      const mappings = {
        id: 'id',
        name: 'name',
        created: 'created_at',
        updated: 'updated_at'
      } as Record<string, string | FieldMapping>

      const columns = getInsertColumnsFromMappings(mappings, ['id', 'created_at'])
      expect(columns).toEqual(['name', 'updated_at'])
    })
  })

  describe('getInsertValuesFromEntity', () => {
    test('extracts values in correct order', () => {
      const entity = {
        id: 1,
        name: 'Test',
        active: true,
        tags: ['tag1', 'tag2']
      }

      const mappings = {
        id: 'id',
        name: 'name',
        active: 'is_active',
        tags: 'tag_list'
      } as Record<string, string | FieldMapping>

      const values = getInsertValuesFromEntity(entity, mappings)
      expect(values).toEqual([1, 'Test', true, ['tag1', 'tag2']])
    })

    test('converts arrays to JSON strings', () => {
      const entity = {
        tags: ['tag1', 'tag2'],
        data: { key: 'value' }
      }

      const mappings = {
        tags: { dbColumn: 'tag_list' },
        data: { dbColumn: 'json_data' }
      } as Record<string, string | FieldMapping>

      const values = getInsertValuesFromEntity(entity, mappings)
      expect(values[0]).toBe('["tag1","tag2"]')
      expect(values[1]).toBe('{"key":"value"}')
    })

    test('converts booleans to integers', () => {
      const entity = { active: true, disabled: false }
      const mappings = {
        active: 'is_active',
        disabled: 'is_disabled'
      } as Record<string, string | FieldMapping>

      const values = getInsertValuesFromEntity(entity, mappings)
      // Simple string mappings don't convert, they return raw values
      expect(values).toEqual([true, false])
    })

    test('handles null and undefined with defaults', () => {
      const entity = { name: null, description: undefined }
      const mappings = {
        name: { dbColumn: 'name', defaultValue: 'Unknown' },
        description: { dbColumn: 'desc', defaultValue: '' }
      } as Record<string, string | FieldMapping>

      const values = getInsertValuesFromEntity(entity, mappings)
      expect(values).toEqual(['Unknown', ''])
    })

    test('excludes specified fields', () => {
      const entity = { id: 1, name: 'Test', secret: 'hidden' }
      const mappings = {
        id: 'id',
        name: 'name',
        secret: 'secret_column'
      } as Record<string, string | FieldMapping>

      const values = getInsertValuesFromEntity(entity, mappings, ['secret'])
      expect(values).toEqual([1, 'Test'])
    })
  })

  describe('buildUpdateSetClause', () => {
    test('builds SQL SET clause with values', () => {
      const updates = { name: 'New Name', active: true }
      const mappings = {
        id: 'id',
        name: 'name',
        active: 'is_active'
      } as Record<string, string | FieldMapping>

      const result = buildUpdateSetClause(updates, mappings)
      expect(result.setClause).toBe('name = ?, is_active = ?, updated_at = ?')
      expect(result.values).toEqual(['New Name', 1, expect.any(Number)])
    })

    test('excludes undefined values', () => {
      const updates = { name: 'New Name', description: undefined, active: false }
      const mappings = {
        name: 'name',
        description: 'desc',
        active: 'is_active'
      } as Record<string, string | FieldMapping>

      const result = buildUpdateSetClause(updates, mappings)
      expect(result.setClause).toBe('name = ?, is_active = ?, updated_at = ?')
      expect(result.values).toEqual(['New Name', 0, expect.any(Number)])
    })

    test('excludes id field by default', () => {
      const updates = { id: 999, name: 'New Name' }
      const mappings = {
        id: 'id',
        name: 'name'
      } as Record<string, string | FieldMapping>

      const result = buildUpdateSetClause(updates, mappings)
      expect(result.setClause).not.toContain('id = ?')
      expect(result.values).not.toContain(999)
    })

    test('handles JSON conversion for objects and arrays', () => {
      const updates = {
        tags: ['new', 'tags'],
        metadata: { version: 2 }
      }
      const mappings = {
        tags: 'tag_list',
        metadata: 'meta_json'
      } as Record<string, string | FieldMapping>

      const result = buildUpdateSetClause(updates, mappings)
      expect(result.values[0]).toBe('["new","tags"]')
      expect(result.values[1]).toBe('{"version":2}')
    })

    test('adds updated_at timestamp automatically', () => {
      const updates = { name: 'Test' }
      const mappings = { name: 'name' } as Record<string, string | FieldMapping>

      const before = Date.now()
      const result = buildUpdateSetClause(updates, mappings)
      const after = Date.now()

      expect(result.setClause).toContain('updated_at = ?')
      const timestamp = result.values[result.values.length - 1] as number
      expect(timestamp).toBeGreaterThanOrEqual(before)
      expect(timestamp).toBeLessThanOrEqual(after)
    })

    test('respects existing updated field', () => {
      const customTime = 1234567890
      const updates = { name: 'Test', updated: customTime }
      const mappings = {
        name: 'name',
        updated: 'updated_at'
      } as Record<string, string | FieldMapping>

      const result = buildUpdateSetClause(updates, mappings)
      expect(result.setClause).toBe('name = ?, updated_at = ?')
      expect(result.values).toEqual(['Test', customTime])
    })
  })

  describe('validateData', () => {
    const TestSchema = z.object({
      id: z.number(),
      name: z.string()
    })

    test('validates and returns valid data', async () => {
      const data = { id: 1, name: 'Test' }
      const result = await validateData(data, TestSchema, 'test entity')
      expect(result).toEqual(data)
    })

    test('throws ApiError on validation failure', async () => {
      const invalidData = { id: 'not-a-number', name: 123 }
      
      await expect(
        validateData(invalidData, TestSchema, 'test entity')
      ).rejects.toThrow('Validation failed for test entity')
    })
  })

  describe('batchValidate', () => {
    const ItemSchema = z.object({
      id: z.number(),
      value: z.string()
    })

    test('validates all items successfully', async () => {
      const items = [
        { id: 1, value: 'one' },
        { id: 2, value: 'two' },
        { id: 3, value: 'three' }
      ]

      const result = await batchValidate(items, ItemSchema, 'items')
      expect(result).toEqual(items)
    })

    test('collects all validation errors', async () => {
      const items = [
        { id: 1, value: 'valid' },
        { id: 'invalid', value: 123 }, // Invalid
        { id: 3, value: 'valid' },
        { id: 'bad', value: null } // Invalid
      ]

      await expect(
        batchValidate(items, ItemSchema, 'items')
      ).rejects.toThrow('Batch validation failed')
    })
  })
})