import { describe, test, expect } from 'bun:test'
import { z } from 'zod'
import { getSchemaDefaults } from './zod-utils'

describe('getSchemaDefaults', () => {
  describe('happy path', () => {
    test('extracts default values from schema', () => {
      const schema = z.object({
        name: z.string().default('John'),
        age: z.number().default(30),
        active: z.boolean().default(true)
      })

      const defaults = getSchemaDefaults(schema)

      expect(defaults).toEqual({
        name: 'John',
        age: 30,
        active: true
      })
    })

    test('handles mixed fields with and without defaults', () => {
      const schema = z.object({
        id: z.string(),
        name: z.string().default('Unknown'),
        count: z.number(),
        enabled: z.boolean().default(false)
      })

      const defaults = getSchemaDefaults(schema)

      expect(defaults).toEqual({
        id: undefined,
        name: 'Unknown',
        count: undefined,
        enabled: false
      })
    })

    test('extracts complex default values', () => {
      const schema = z.object({
        array: z.array(z.string()).default(['item1', 'item2']),
        object: z.object({ key: z.string() }).default({ key: 'value' }),
        date: z.date().default(new Date('2024-01-01')),
        nullable: z.string().nullable().default(null)
      })

      const defaults = getSchemaDefaults(schema)

      expect(defaults.array).toEqual(['item1', 'item2'])
      expect(defaults.object).toEqual({ key: 'value' })
      expect(defaults.date).toEqual(new Date('2024-01-01'))
      expect(defaults.nullable).toBe(null)
    })

    test('handles function defaults', () => {
      const dynamicDefault = () => `generated-${Date.now()}`
      const schema = z.object({
        id: z.string().default(dynamicDefault),
        timestamp: z.number().default(() => Date.now())
      })

      const defaults = getSchemaDefaults(schema)

      expect(typeof defaults.id).toBe('string')
      expect(defaults.id).toContain('generated-')
      expect(typeof defaults.timestamp).toBe('number')
      expect(defaults.timestamp).toBeGreaterThan(0)
    })

    test('works with optional fields', () => {
      const schema = z.object({
        required: z.string(),
        optional: z.string().optional(),
        optionalWithDefault: z.string().optional().default('default value')
      })

      const defaults = getSchemaDefaults(schema)

      expect(defaults).toEqual({
        required: undefined,
        optional: undefined,
        optionalWithDefault: 'default value'
      })
    })
  })

  describe('edge cases', () => {
    test('handles empty schema', () => {
      const schema = z.object({})

      const defaults = getSchemaDefaults(schema)

      expect(defaults).toEqual({})
    })

    test('handles nested schemas without defaults', () => {
      const schema = z.object({
        user: z.object({
          name: z.string(),
          email: z.string()
        })
      })

      const defaults = getSchemaDefaults(schema)

      expect(defaults).toEqual({
        user: undefined
      })
    })

    test('handles nested schemas with defaults', () => {
      const schema = z.object({
        user: z.object({
          name: z.string().default('Guest'),
          email: z.string()
        }).default({ name: 'Admin', email: 'admin@example.com' })
      })

      const defaults = getSchemaDefaults(schema)

      expect(defaults.user).toEqual({ name: 'Admin', email: 'admin@example.com' })
    })

    test('handles union types with defaults', () => {
      const schema = z.object({
        value: z.union([z.string(), z.number()]).default('default')
      })

      const defaults = getSchemaDefaults(schema)

      expect(defaults.value).toBe('default')
    })

    test('handles enum with default', () => {
      const schema = z.object({
        status: z.enum(['active', 'inactive', 'pending']).default('active')
      })

      const defaults = getSchemaDefaults(schema)

      expect(defaults.status).toBe('active')
    })

    test('handles literal with default', () => {
      const schema = z.object({
        type: z.literal('user').default('user')
      })

      const defaults = getSchemaDefaults(schema)

      expect(defaults.type).toBe('user')
    })

    test('handles transform with default', () => {
      const schema = z.object({
        uppercase: z.string()
          .transform(str => str.toUpperCase())
          .default('hello')
      })

      const defaults = getSchemaDefaults(schema)

      expect(defaults.uppercase).toBe('hello') // Default is pre-transform
    })

    test('handles refine with default', () => {
      const schema = z.object({
        even: z.number()
          .refine(n => n % 2 === 0)
          .default(4)
      })

      const defaults = getSchemaDefaults(schema)

      expect(defaults.even).toBe(4)
    })

    test('handles recursive schemas', () => {
      type Category = {
        name: string
        children?: Category[]
      }

      const categorySchema: z.ZodType<Category> = z.object({
        name: z.string().default('Unnamed'),
        children: z.lazy(() => z.array(categorySchema).optional())
      })

      const schema = z.object({
        root: categorySchema
      })

      const defaults = getSchemaDefaults(schema)

      // Should not throw and should handle the recursive nature
      // The root won't have a default unless explicitly set
      expect(defaults.root).toBeUndefined()
    })

    test('handles all primitive default types', () => {
      const schema = z.object({
        string: z.string().default('text'),
        number: z.number().default(42),
        boolean: z.boolean().default(true),
        bigint: z.bigint().default(BigInt(100)),
        symbol: z.symbol().default(Symbol.for('test')),
        undefined: z.undefined().default(undefined),
        null: z.null().default(null)
      })

      const defaults = getSchemaDefaults(schema)

      expect(defaults.string).toBe('text')
      expect(defaults.number).toBe(42)
      expect(defaults.boolean).toBe(true)
      expect(defaults.bigint).toBe(BigInt(100))
      expect(defaults.symbol).toBe(Symbol.for('test'))
      expect(defaults.undefined).toBe(undefined)
      expect(defaults.null).toBe(null)
    })
  })

  describe('practical use cases', () => {
    test('form schema with defaults', () => {
      const formSchema = z.object({
        username: z.string().min(3).default(''),
        email: z.string().email().default(''),
        age: z.number().min(18).optional(),
        newsletter: z.boolean().default(false),
        country: z.string().default('US'),
        preferences: z.object({
          theme: z.enum(['light', 'dark']).default('light'),
          notifications: z.boolean().default(true)
        }).default({
          theme: 'light',
          notifications: true
        })
      })

      const defaults = getSchemaDefaults(formSchema)

      expect(defaults).toEqual({
        username: '',
        email: '',
        age: undefined,
        newsletter: false,
        country: 'US',
        preferences: {
          theme: 'light',
          notifications: true
        }
      })
    })

    test('API response schema with defaults', () => {
      const responseSchema = z.object({
        data: z.array(z.unknown()).default([]),
        pagination: z.object({
          page: z.number().default(1),
          limit: z.number().default(10),
          total: z.number().default(0)
        }).default({
          page: 1,
          limit: 10,
          total: 0
        }),
        error: z.string().nullable().default(null)
      })

      const defaults = getSchemaDefaults(responseSchema)

      expect(defaults).toEqual({
        data: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0
        },
        error: null
      })
    })

    test('configuration schema with environment-based defaults', () => {
      const isDev = process.env.NODE_ENV === 'development'
      
      const configSchema = z.object({
        apiUrl: z.string().default(isDev ? 'http://localhost:3000' : 'https://api.example.com'),
        debug: z.boolean().default(isDev),
        retryAttempts: z.number().default(3),
        timeout: z.number().default(isDev ? 30000 : 10000)
      })

      const defaults = getSchemaDefaults(configSchema)

      expect(defaults.retryAttempts).toBe(3)
      expect(typeof defaults.apiUrl).toBe('string')
      expect(typeof defaults.debug).toBe('boolean')
      expect(typeof defaults.timeout).toBe('number')
    })
  })

  describe('type safety', () => {
    test('preserves type information', () => {
      const schema = z.object({
        str: z.string().default('test'),
        num: z.number().default(10),
        bool: z.boolean().default(false)
      })

      const defaults = getSchemaDefaults(schema)

      // TypeScript would catch these at compile time
      // These are runtime checks to ensure correct types
      expect(typeof defaults.str).toBe('string')
      expect(typeof defaults.num).toBe('number')
      expect(typeof defaults.bool).toBe('boolean')
    })

    test('handles discriminated unions', () => {
      const schema = z.object({
        result: z.discriminatedUnion('status', [
          z.object({ status: z.literal('success'), data: z.string() }),
          z.object({ status: z.literal('error'), error: z.string() })
        ]).default({ status: 'success', data: 'OK' })
      })

      const defaults = getSchemaDefaults(schema)

      expect(defaults.result).toEqual({ status: 'success', data: 'OK' })
    })
  })
})