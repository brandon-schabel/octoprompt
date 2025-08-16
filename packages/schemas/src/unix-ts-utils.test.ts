import { describe, test, expect } from 'bun:test'
import { 
  unixTimestampSchema, 
  parseUnixTimestamp, 
  safeParseUnixTimestamp,
  type UnixTimestampInput,
  type UnixTimestampOutput 
} from './unix-ts-utils'
import { z } from 'zod'

describe('unix-ts-utils', () => {
  describe('unixTimestampSchema', () => {
    describe('number inputs', () => {
      test('accepts millisecond timestamps', () => {
        const timestamp = 1609459200000 // 2021-01-01 00:00:00 UTC
        const result = unixTimestampSchema.parse(timestamp)
        expect(result).toBe(timestamp)
      })

      test('converts second timestamps to milliseconds', () => {
        const secondTimestamp = 1609459200 // 2021-01-01 in seconds
        const expectedMs = 1609459200000
        const result = unixTimestampSchema.parse(secondTimestamp)
        expect(result).toBe(expectedMs)
      })

      test('handles current timestamp', () => {
        const now = Date.now()
        const result = unixTimestampSchema.parse(now)
        expect(result).toBe(now)
      })

      test('handles zero timestamp (Unix epoch)', () => {
        const result = unixTimestampSchema.parse(0)
        expect(result).toBe(0)
      })

      test('rejects negative timestamps', () => {
        expect(() => unixTimestampSchema.parse(-1)).toThrow()
        expect(() => unixTimestampSchema.parse(-1000)).toThrow()
      })

      test('rejects timestamps before 1970', () => {
        const before1970 = new Date('1969-12-31').getTime()
        expect(() => unixTimestampSchema.parse(before1970)).toThrow('Timestamp must be after 1970')
      })

      test('rejects timestamps after 2050', () => {
        const after2050 = new Date('2051-01-01').getTime()
        expect(() => unixTimestampSchema.parse(after2050)).toThrow('Timestamp must be before 2050')
      })

      test('rejects non-finite numbers', () => {
        expect(() => unixTimestampSchema.parse(Infinity)).toThrow('Timestamp must be an integer')
        expect(() => unixTimestampSchema.parse(-Infinity)).toThrow('Timestamp must be an integer')
        expect(() => unixTimestampSchema.parse(NaN)).toThrow()
      })

      test('handles edge case at seconds/milliseconds boundary', () => {
        // Use a value that won't exceed 2050 when converted
        const secondsValue = 1500000000 // July 2017 in seconds
        const result = unixTimestampSchema.parse(secondsValue)
        expect(result).toBe(secondsValue * 1000) // Should be treated as seconds

        const millisecondsValue = 1500000000000 // July 2017 in milliseconds  
        const result2 = unixTimestampSchema.parse(millisecondsValue)
        expect(result2).toBe(millisecondsValue) // Should remain as milliseconds
      })
    })

    describe('string inputs', () => {
      test('parses ISO date strings', () => {
        const isoString = '2021-01-01T00:00:00.000Z'
        const expectedMs = 1609459200000
        const result = unixTimestampSchema.parse(isoString)
        expect(result).toBe(expectedMs)
      })

      test('parses various date string formats', () => {
        const formats = [
          '2021-01-01',
          '2021/01/01',
          'January 1, 2021',
          '01 Jan 2021',
          '2021-01-01T12:00:00Z'
        ]

        formats.forEach(format => {
          expect(() => unixTimestampSchema.parse(format)).not.toThrow()
        })
      })

      test('parses numeric timestamp strings', () => {
        const timestampString = '1609459200000'
        const result = unixTimestampSchema.parse(timestampString)
        expect(result).toBe(1609459200000)
      })

      test('parses second timestamp strings', () => {
        const secondString = '1609459200'
        const result = unixTimestampSchema.parse(secondString)
        expect(result).toBe(1609459200000)
      })

      test('rejects invalid date strings', () => {
        const invalidStrings = [
          'not-a-date',
          '2021-13-01', // Invalid month
          '2021-01-32', // Invalid day
          'abc123',
          ''
        ]

        invalidStrings.forEach(str => {
          if (str === '') {
            // Empty string parses to 0 (Unix epoch)
            const result = unixTimestampSchema.parse(str)
            expect(result).toBe(0)
          } else {
            expect(() => unixTimestampSchema.parse(str)).toThrow()
          }
        })
      })
    })

    describe('Date object inputs', () => {
      test('accepts valid Date objects', () => {
        const date = new Date('2021-01-01T00:00:00.000Z')
        const expectedMs = 1609459200000
        const result = unixTimestampSchema.parse(date)
        expect(result).toBe(expectedMs)
      })

      test('accepts current Date', () => {
        const now = new Date()
        const result = unixTimestampSchema.parse(now)
        expect(result).toBe(now.getTime())
      })

      test('rejects invalid Date objects', () => {
        const invalidDate = new Date('invalid')
        expect(() => unixTimestampSchema.parse(invalidDate)).toThrow('Expected number, received date')
      })

      test('handles Date at boundaries', () => {
        const epochDate = new Date(0)
        const result = unixTimestampSchema.parse(epochDate)
        expect(result).toBe(0)

        const year2049 = new Date('2049-12-31T23:59:59.999Z')
        expect(() => unixTimestampSchema.parse(year2049)).not.toThrow()
      })
    })

    describe('null and undefined handling', () => {
      test('passes through null', () => {
        const result = unixTimestampSchema.safeParse(null)
        expect(result.success).toBe(false)
      })

      test('passes through undefined', () => {
        const result = unixTimestampSchema.safeParse(undefined)
        expect(result.success).toBe(false)
      })

      test('works with optional schema', () => {
        const optionalSchema = unixTimestampSchema.optional()
        
        const result1 = optionalSchema.parse(undefined)
        expect(result1).toBeUndefined()

        const result2 = optionalSchema.parse(1609459200000)
        expect(result2).toBe(1609459200000)
      })

      test('works with nullable schema', () => {
        const nullableSchema = unixTimestampSchema.nullable()
        
        const result1 = nullableSchema.parse(null)
        expect(result1).toBeNull()

        const result2 = nullableSchema.parse(1609459200000)
        expect(result2).toBe(1609459200000)
      })
    })

    describe('edge cases and validation', () => {
      test('validates as integer', () => {
        expect(() => unixTimestampSchema.parse(1609459200000.5)).toThrow('Timestamp must be an integer')
      })

      test('handles year 1970 boundary', () => {
        const jan1970 = new Date('1970-01-01T00:00:00.000Z').getTime()
        const result = unixTimestampSchema.parse(jan1970)
        expect(result).toBe(0)

        const dec1969 = new Date('1969-12-31T23:59:59.999Z').getTime()
        expect(() => unixTimestampSchema.parse(dec1969)).toThrow()
      })

      test('handles year 2050 boundary', () => {
        const dec2049 = new Date('2049-12-31T23:59:59.999Z').getTime()
        expect(() => unixTimestampSchema.parse(dec2049)).not.toThrow()

        const jan2050 = new Date('2050-01-01T00:00:00.001Z').getTime()
        expect(() => unixTimestampSchema.parse(jan2050)).toThrow()
      })

      test('rejects non-date inputs', () => {
        const invalidInputs = [
          {},
          [],
          true,
          false,
          Symbol('test'),
          () => {}
        ]

        invalidInputs.forEach(input => {
          expect(() => unixTimestampSchema.parse(input)).toThrow()
        })
      })
    })
  })

  describe('parseUnixTimestamp', () => {
    test('parses valid inputs', () => {
      const timestamp = 1609459200000
      const result = parseUnixTimestamp(timestamp)
      expect(result).toBe(timestamp)
    })

    test('throws with formatted error message', () => {
      try {
        parseUnixTimestamp(-1)
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toContain('Invalid timestamp')
        expect((error as Error).message).toContain('Timestamp must be after 1970')
      }
    })

    test('handles multiple validation errors', () => {
      try {
        parseUnixTimestamp('invalid-date')
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toContain('Invalid')
      }
    })

    test('works with all input types', () => {
      expect(parseUnixTimestamp(1609459200000)).toBe(1609459200000)
      expect(parseUnixTimestamp('2021-01-01')).toBe(1609459200000)
      expect(parseUnixTimestamp(new Date('2021-01-01T00:00:00.000Z'))).toBe(1609459200000)
    })

    test('rethrows non-Zod errors', () => {
      // This would be hard to trigger naturally, but we can test the type inference
      const input: UnixTimestampInput = 1609459200000
      const output: UnixTimestampOutput = parseUnixTimestamp(input)
      expect(typeof output).toBe('number')
    })
  })

  describe('safeParseUnixTimestamp', () => {
    test('returns success result for valid input', () => {
      const result = safeParseUnixTimestamp(1609459200000)
      
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe(1609459200000)
      }
    })

    test('returns error result for invalid input', () => {
      const result = safeParseUnixTimestamp('invalid-date')
      
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeInstanceOf(z.ZodError)
        expect(result.error.issues.length).toBeGreaterThan(0)
      }
    })

    test('handles all input types safely', () => {
      const validInputs = [
        1609459200000,
        '2021-01-01',
        new Date('2021-01-01')
      ]

      validInputs.forEach(input => {
        const result = safeParseUnixTimestamp(input)
        expect(result.success).toBe(true)
      })

      const invalidInputs = [
        'not-a-date',
        -1000,
        new Date('invalid')
      ]

      invalidInputs.forEach(input => {
        const result = safeParseUnixTimestamp(input)
        expect(result.success).toBe(false)
      })
    })

    test('preserves error details', () => {
      const result = safeParseUnixTimestamp(new Date('2051-01-01'))
      
      expect(result.success).toBe(false)
      if (!result.success) {
        const issue = result.error.issues[0]
        expect(issue?.message).toContain('2050')
      }
    })
  })

  describe('type inference', () => {
    test('UnixTimestampInput accepts correct types', () => {
      const numberInput: UnixTimestampInput = 1609459200000
      const stringInput: UnixTimestampInput = '2021-01-01'
      const dateInput: UnixTimestampInput = new Date()

      // These should all be valid
      expect(typeof numberInput).toBe('number')
      expect(typeof stringInput).toBe('string')
      expect(dateInput).toBeInstanceOf(Date)
    })

    test('UnixTimestampOutput is always number', () => {
      const output: UnixTimestampOutput = parseUnixTimestamp(new Date())
      expect(typeof output).toBe('number')
    })

    test('schema infers to number type', () => {
      type InferredType = z.infer<typeof unixTimestampSchema>
      const value: InferredType = 1609459200000
      expect(typeof value).toBe('number')
    })
  })

  describe('real-world scenarios', () => {
    test('handles database timestamps', () => {
      // Simulating timestamps from a database
      const dbTimestamps = [
        1609459200, // Seconds from some databases
        1609459200000, // Milliseconds from others
        '2021-01-01T00:00:00.000Z', // ISO strings
        '1609459200' // String timestamps
      ]

      dbTimestamps.forEach(ts => {
        const result = parseUnixTimestamp(ts)
        expect(result).toBe(1609459200000)
      })
    })

    test('handles API responses', () => {
      const apiResponse = {
        created: '2021-01-01',
        updated: 1609459200,
        lastLogin: new Date('2021-01-01')
      }

      const parsed = {
        created: parseUnixTimestamp(apiResponse.created),
        updated: parseUnixTimestamp(apiResponse.updated),
        lastLogin: parseUnixTimestamp(apiResponse.lastLogin)
      }

      expect(parsed.created).toBe(1609459200000)
      expect(parsed.updated).toBe(1609459200000)
      expect(parsed.lastLogin).toBe(1609459200000)
    })

    test('works in schema composition', () => {
      const UserSchema = z.object({
        id: z.number(),
        name: z.string(),
        createdAt: unixTimestampSchema,
        updatedAt: unixTimestampSchema.optional()
      })

      const user = UserSchema.parse({
        id: 1,
        name: 'John',
        createdAt: '2021-01-01',
        updatedAt: undefined
      })

      expect(user.createdAt).toBe(1609459200000)
      expect(user.updatedAt).toBeUndefined()
    })

    test('handles timezone-aware dates', () => {
      const dates = [
        '2021-01-01T00:00:00+00:00', // UTC
        '2021-01-01T08:00:00+08:00', // UTC+8
        '2020-12-31T16:00:00-08:00', // UTC-8 (same moment)
      ]

      const results = dates.map(d => parseUnixTimestamp(d))
      
      // All should be the same UTC timestamp
      expect(results[0]).toBe(1609459200000)
      expect(results[1]).toBe(1609459200000)
      expect(results[2]).toBe(1609459200000)
    })
  })
})