import { describe, test, expect } from 'bun:test'
import {
  toBoolean,
  fromBoolean,
  toNumber,
  fromNumber,
  toString,
  fromString,
  toJson,
  fromJson,
  toArray,
  fromArray,
  toObject,
  fromObject,
  toTimestamp,
  fromTimestamp,
  isNullish,
  isValidJson,
  ensureString,
  ensureNumber,
  ensureBoolean,
  safeJsonParse,
  batchConvert,
  rowsToRecord,
  SqliteConverters
} from './sqlite-converters'

describe('SqliteConverters', () => {
  describe('Boolean Converters', () => {
    describe('toBoolean', () => {
      test('converts SQLite INTEGER to boolean', () => {
        expect(toBoolean(1)).toBe(true)
        expect(toBoolean(0)).toBe(false)
      })

      test('handles string values', () => {
        expect(toBoolean('1')).toBe(true)
        expect(toBoolean('0')).toBe(false)
        expect(toBoolean('true')).toBe(true)
        expect(toBoolean('false')).toBe(false)
        expect(toBoolean('TRUE')).toBe(true)
        expect(toBoolean('FALSE')).toBe(false)
      })

      test('handles boolean values', () => {
        expect(toBoolean(true)).toBe(true)
        expect(toBoolean(false)).toBe(false)
      })

      test('handles null/undefined with fallback', () => {
        expect(toBoolean(null)).toBe(false)
        expect(toBoolean(undefined)).toBe(false)
        expect(toBoolean(null, true)).toBe(true)
        expect(toBoolean(undefined, true)).toBe(true)
      })

      test('handles invalid values with fallback', () => {
        expect(toBoolean('invalid')).toBe(false)
        expect(toBoolean('invalid', true)).toBe(true)
        expect(toBoolean({})).toBe(false)
        expect(toBoolean([])).toBe(false)
      })
    })

    describe('fromBoolean', () => {
      test('converts boolean to SQLite INTEGER', () => {
        expect(fromBoolean(true)).toBe(1)
        expect(fromBoolean(false)).toBe(0)
      })

      test('handles null/undefined', () => {
        expect(fromBoolean(null)).toBe(0)
        expect(fromBoolean(undefined)).toBe(0)
      })
    })
  })

  describe('Number Converters', () => {
    describe('toNumber', () => {
      test('handles number values', () => {
        expect(toNumber(42)).toBe(42)
        expect(toNumber(0)).toBe(0)
        expect(toNumber(-10)).toBe(-10)
        expect(toNumber(3.14)).toBe(3.14)
      })

      test('handles string values', () => {
        expect(toNumber('42')).toBe(42)
        expect(toNumber('0')).toBe(0)
        expect(toNumber('-10')).toBe(-10)
        expect(toNumber('3.14')).toBe(3.14)
      })

      test('handles null/undefined with fallback', () => {
        expect(toNumber(null)).toBe(0)
        expect(toNumber(undefined)).toBe(0)
        expect(toNumber(null, 100)).toBe(100)
        expect(toNumber(undefined, -1)).toBe(-1)
      })

      test('handles invalid values with fallback', () => {
        expect(toNumber('invalid')).toBe(0)
        expect(toNumber('invalid', 99)).toBe(99)
        expect(toNumber(NaN)).toBe(0)
        expect(toNumber(NaN, 10)).toBe(10)
      })
    })

    describe('fromNumber', () => {
      test('converts number for SQLite storage', () => {
        expect(fromNumber(42)).toBe(42)
        expect(fromNumber(0)).toBe(0)
        expect(fromNumber(-10)).toBe(-10)
      })

      test('handles null/undefined', () => {
        expect(fromNumber(null)).toBe(null)
        expect(fromNumber(undefined)).toBe(null)
      })

      test('handles NaN', () => {
        expect(fromNumber(NaN)).toBe(null)
      })
    })
  })

  describe('String Converters', () => {
    describe('toString', () => {
      test('handles string values', () => {
        expect(toString('hello')).toBe('hello')
        expect(toString('')).toBe('')
      })

      test('converts numbers to string', () => {
        expect(toString(42)).toBe('42')
        expect(toString(0)).toBe('0')
        expect(toString(3.14)).toBe('3.14')
      })

      test('converts booleans to string', () => {
        expect(toString(true)).toBe('true')
        expect(toString(false)).toBe('false')
      })

      test('handles null/undefined with fallback', () => {
        expect(toString(null)).toBe('')
        expect(toString(undefined)).toBe('')
        expect(toString(null, 'default')).toBe('default')
        expect(toString(undefined, 'fallback')).toBe('fallback')
      })
    })

    describe('fromString', () => {
      test('handles string values', () => {
        expect(fromString('hello')).toBe('hello')
        expect(fromString('')).toBe('')
      })

      test('handles null/undefined', () => {
        expect(fromString(null)).toBe(null)
        expect(fromString(undefined)).toBe(null)
      })
    })
  })

  describe('JSON Converters', () => {
    describe('toJson', () => {
      test('parses valid JSON', () => {
        expect(toJson('{"key":"value"}', {})).toEqual({ key: 'value' })
        expect(toJson('[1,2,3]', [])).toEqual([1, 2, 3])
        expect(toJson('"string"', '')).toBe('string')
        expect(toJson('42', 0)).toBe(42)
        expect(toJson('true', false)).toBe(true)
      })

      test('handles invalid JSON with fallback', () => {
        expect(toJson('invalid', 'fallback')).toBe('fallback')
        expect(toJson('{broken', {})).toEqual({})
        expect(toJson('[1,2,', [])).toEqual([])
      })

      test('handles null/undefined with fallback', () => {
        expect(toJson(null, 'default')).toBe('default')
        expect(toJson(undefined, [])).toEqual([])
        expect(toJson('', {})).toEqual({})
      })

      test('logs warning with context', () => {
        // Store original console.warn
        const originalWarn = console.warn
        let warnCalled = false
        let warnMessage = ''

        // Mock console.warn
        console.warn = (msg: string) => {
          warnCalled = true
          warnMessage = msg
        }

        toJson('invalid', {}, 'test.field')

        expect(warnCalled).toBe(true)
        expect(warnMessage).toContain('Failed to parse JSON for test.field')

        // Restore original console.warn
        console.warn = originalWarn
      })
    })

    describe('fromJson', () => {
      test('stringifies values', () => {
        expect(fromJson({ key: 'value' })).toBe('{"key":"value"}')
        expect(fromJson([1, 2, 3])).toBe('[1,2,3]')
        expect(fromJson('string')).toBe('"string"')
        expect(fromJson(42)).toBe('42')
        expect(fromJson(true)).toBe('true')
      })

      test('handles null/undefined', () => {
        expect(fromJson(null)).toBe(null)
        expect(fromJson(undefined)).toBe(null)
        expect(fromJson(null, 'fallback')).toBe('fallback')
      })

      test('handles circular references', () => {
        const obj: any = { key: 'value' }
        obj.circular = obj

        // Store original console.warn
        const originalWarn = console.warn
        let warnCalled = false

        // Mock console.warn
        console.warn = () => {
          warnCalled = true
        }

        expect(fromJson(obj)).toBe(null)
        expect(warnCalled).toBe(true)

        // Restore original console.warn
        console.warn = originalWarn
      })
    })
  })

  describe('Array Converters', () => {
    describe('toArray', () => {
      test('parses JSON arrays', () => {
        expect(toArray('[1,2,3]')).toEqual([1, 2, 3])
        expect(toArray('[]')).toEqual([])
        expect(toArray('["a","b","c"]')).toEqual(['a', 'b', 'c'])
      })

      test('handles non-array JSON with fallback', () => {
        expect(toArray('{"key":"value"}')).toEqual([])
        expect(toArray('"string"')).toEqual([])
        expect(toArray('42')).toEqual([])
      })

      test('handles invalid JSON with fallback', () => {
        expect(toArray('invalid')).toEqual([])
        expect(toArray('invalid', [1, 2])).toEqual([1, 2])
      })

      test('handles null/undefined', () => {
        expect(toArray(null)).toEqual([])
        expect(toArray(undefined)).toEqual([])
        expect(toArray(null, ['default'])).toEqual(['default'])
      })
    })

    describe('fromArray', () => {
      test('stringifies arrays', () => {
        expect(fromArray([1, 2, 3])).toBe('[1,2,3]')
        expect(fromArray([])).toBe('[]')
        expect(fromArray(['a', 'b'])).toBe('["a","b"]')
      })

      test('handles null/undefined', () => {
        expect(fromArray(null)).toBe('[]')
        expect(fromArray(undefined)).toBe('[]')
      })

      test('handles non-array values', () => {
        expect(fromArray('not an array' as any)).toBe('[]')
        expect(fromArray({} as any)).toBe('[]')
      })
    })
  })

  describe('Object Converters', () => {
    describe('toObject', () => {
      test('parses JSON objects', () => {
        expect(toObject('{"key":"value"}')).toEqual({ key: 'value' })
        expect(toObject('{}')).toEqual({})
        expect(toObject('{"a":1,"b":2}')).toEqual({ a: 1, b: 2 })
      })

      test('handles non-object JSON with fallback', () => {
        expect(toObject('[1,2,3]')).toEqual({})
        expect(toObject('"string"')).toEqual({})
        expect(toObject('42')).toEqual({})
        expect(toObject('null')).toEqual({})
      })

      test('handles invalid JSON with fallback', () => {
        expect(toObject('invalid')).toEqual({})
        expect(toObject('invalid', { default: true })).toEqual({ default: true })
      })

      test('handles null/undefined', () => {
        expect(toObject(null)).toEqual({})
        expect(toObject(undefined)).toEqual({})
        expect(toObject(null, { fallback: 'value' })).toEqual({ fallback: 'value' })
      })
    })

    describe('fromObject', () => {
      test('stringifies objects', () => {
        expect(fromObject({ key: 'value' })).toBe('{"key":"value"}')
        expect(fromObject({})).toBe('{}')
        expect(fromObject({ a: 1, b: 2 })).toBe('{"a":1,"b":2}')
      })

      test('handles null/undefined', () => {
        expect(fromObject(null)).toBe('{}')
        expect(fromObject(undefined)).toBe('{}')
      })

      test('handles non-object values', () => {
        expect(fromObject([1, 2] as any)).toBe('{}')
        expect(fromObject('string' as any)).toBe('{}')
      })
    })
  })

  describe('Timestamp Converters', () => {
    describe('toTimestamp', () => {
      const nowMs = Date.now()
      const nowSec = Math.floor(nowMs / 1000)

      test('handles millisecond timestamps', () => {
        expect(toTimestamp(nowMs)).toBe(nowMs)
        expect(toTimestamp(1609459200000)).toBe(1609459200000) // 2021-01-01
      })

      test('converts second timestamps to milliseconds', () => {
        expect(toTimestamp(nowSec)).toBe(nowSec * 1000)
        expect(toTimestamp(1609459200)).toBe(1609459200000) // 2021-01-01
      })

      test('handles null/undefined with fallback', () => {
        const fallback = 1000000000000
        expect(toTimestamp(null, fallback)).toBe(fallback)
        expect(toTimestamp(undefined, fallback)).toBe(fallback)

        // Without explicit fallback, uses Date.now()
        const before = Date.now()
        const result = toTimestamp(null)
        const after = Date.now()
        expect(result).toBeGreaterThanOrEqual(before)
        expect(result).toBeLessThanOrEqual(after)
      })

      test('handles zero with fallback', () => {
        const fallback = 1609459200000
        expect(toTimestamp(0, fallback)).toBe(fallback)
      })
    })

    describe('fromTimestamp', () => {
      test('handles number timestamps', () => {
        expect(fromTimestamp(1609459200000)).toBe(1609459200000)
        expect(fromTimestamp(0)).toBe(0)
      })

      test('handles Date objects', () => {
        const date = new Date('2021-01-01')
        expect(fromTimestamp(date)).toBe(date.getTime())
      })

      test('handles null/undefined', () => {
        expect(fromTimestamp(null)).toBe(null)
        expect(fromTimestamp(undefined)).toBe(null)
      })
    })
  })

  describe('Type Guards', () => {
    describe('isNullish', () => {
      test('identifies null and undefined', () => {
        expect(isNullish(null)).toBe(true)
        expect(isNullish(undefined)).toBe(true)
      })

      test('rejects other values', () => {
        expect(isNullish(0)).toBe(false)
        expect(isNullish('')).toBe(false)
        expect(isNullish(false)).toBe(false)
        expect(isNullish([])).toBe(false)
        expect(isNullish({})).toBe(false)
      })
    })

    describe('isValidJson', () => {
      test('validates correct JSON', () => {
        expect(isValidJson('{"key":"value"}')).toBe(true)
        expect(isValidJson('[]')).toBe(true)
        expect(isValidJson('"string"')).toBe(true)
        expect(isValidJson('42')).toBe(true)
        expect(isValidJson('true')).toBe(true)
        expect(isValidJson('null')).toBe(true)
      })

      test('rejects invalid JSON', () => {
        expect(isValidJson('invalid')).toBe(false)
        expect(isValidJson('{broken')).toBe(false)
        expect(isValidJson('[1,2,')).toBe(false)
        expect(isValidJson('')).toBe(false)
      })
    })
  })

  describe('Ensure Functions', () => {
    test('ensureString', () => {
      expect(ensureString('hello')).toBe('hello')
      expect(ensureString(42)).toBe('42')
      expect(ensureString(null)).toBe('')
      expect(ensureString(undefined, 'default')).toBe('default')
    })

    test('ensureNumber', () => {
      expect(ensureNumber(42)).toBe(42)
      expect(ensureNumber('42')).toBe(42)
      expect(ensureNumber(null)).toBe(0)
      expect(ensureNumber(undefined, 100)).toBe(100)
    })

    test('ensureBoolean', () => {
      expect(ensureBoolean(true)).toBe(true)
      expect(ensureBoolean(1)).toBe(true)
      expect(ensureBoolean(null)).toBe(false)
      expect(ensureBoolean(undefined, true)).toBe(true)
    })
  })

  describe('safeJsonParse', () => {
    test('parses valid JSON', () => {
      expect(safeJsonParse('{"key":"value"}', {})).toEqual({ key: 'value' })
      expect(safeJsonParse('[1,2,3]', [])).toEqual([1, 2, 3])
    })

    test('uses fallback for invalid JSON', () => {
      expect(safeJsonParse('invalid', 'fallback')).toBe('fallback')
      expect(safeJsonParse(null, 'default')).toBe('default')
    })

    test('validates with custom validator', () => {
      const isStringArray = (value: any): value is string[] => {
        return Array.isArray(value) && value.every((v) => typeof v === 'string')
      }

      expect(safeJsonParse('["a","b"]', [], isStringArray)).toEqual(['a', 'b'])
      expect(safeJsonParse('[1,2]', ['fallback'], isStringArray)).toEqual(['fallback'])
      expect(safeJsonParse('{}', ['default'], isStringArray)).toEqual(['default'])
    })
  })

  describe('Batch Operations', () => {
    describe('batchConvert', () => {
      test('converts array of rows', () => {
        const rows = [
          { id: 1, done: 1, name: 'Task 1' },
          { id: 2, done: 0, name: 'Task 2' },
          { id: 3, done: 1, name: 'Task 3' }
        ]

        const converter = (row: any) => ({
          id: row.id,
          done: toBoolean(row.done),
          name: row.name
        })

        const result = batchConvert(rows, converter)
        expect(result).toEqual([
          { id: 1, done: true, name: 'Task 1' },
          { id: 2, done: false, name: 'Task 2' },
          { id: 3, done: true, name: 'Task 3' }
        ])
      })
    })

    describe('rowsToRecord', () => {
      test('converts rows to record structure', () => {
        const rows = [
          { id: 1, name: 'Item 1', value: 100 },
          { id: 2, name: 'Item 2', value: 200 },
          { id: 3, name: 'Item 3', value: 300 }
        ]

        const result = rowsToRecord(
          rows,
          (row) => row.id,
          (row) => ({ name: row.name, value: row.value })
        )

        expect(result).toEqual({
          '1': { name: 'Item 1', value: 100 },
          '2': { name: 'Item 2', value: 200 },
          '3': { name: 'Item 3', value: 300 }
        })
      })

      test('handles string keys', () => {
        const rows = [
          { key: 'a', data: 'alpha' },
          { key: 'b', data: 'beta' }
        ]

        const result = rowsToRecord(
          rows,
          (row) => row.key,
          (row) => row.data
        )

        expect(result).toEqual({
          a: 'alpha',
          b: 'beta'
        })
      })
    })
  })

  describe('SqliteConverters namespace', () => {
    test('provides access to all converters', () => {
      expect(SqliteConverters.toBoolean).toBe(toBoolean)
      expect(SqliteConverters.fromBoolean).toBe(fromBoolean)
      expect(SqliteConverters.toNumber).toBe(toNumber)
      expect(SqliteConverters.fromNumber).toBe(fromNumber)
      expect(SqliteConverters.toString).toBe(toString)
      expect(SqliteConverters.fromString).toBe(fromString)
      expect(SqliteConverters.toJson).toBe(toJson)
      expect(SqliteConverters.fromJson).toBe(fromJson)
      expect(SqliteConverters.toArray).toBe(toArray)
      expect(SqliteConverters.fromArray).toBe(fromArray)
      expect(SqliteConverters.toObject).toBe(toObject)
      expect(SqliteConverters.fromObject).toBe(fromObject)
      expect(SqliteConverters.toTimestamp).toBe(toTimestamp)
      expect(SqliteConverters.fromTimestamp).toBe(fromTimestamp)
      expect(SqliteConverters.isNullish).toBe(isNullish)
      expect(SqliteConverters.isValidJson).toBe(isValidJson)
      expect(SqliteConverters.batchConvert).toBe(batchConvert)
      expect(SqliteConverters.rowsToRecord).toBe(rowsToRecord)
    })
  })
})
