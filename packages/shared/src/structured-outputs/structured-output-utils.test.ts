/** packages/shared/src/structured-outputs/structured-output-utils.test.ts */
import { describe, it, expect } from 'bun:test'
import { z } from 'zod'
import { zodToStructuredJsonSchema } from './structured-output-utils'

describe('structured-output-utils', () => {
  it('converts a simple object schema', () => {
    const schema = z.object({
      title: z.string(),
      count: z.number().min(0),
      tags: z.array(z.string()).optional()
    })
    const jsonSchema = zodToStructuredJsonSchema(schema)

    // Basic shape checks
    expect(jsonSchema).toEqual({
      type: 'object',
      properties: {
        title: { type: 'string' },
        count: { type: 'number' },
        tags: {
          type: 'array',
          items: { type: 'string' }
        }
      },
      required: ['title', 'count'],
      additionalProperties: false
    })
  })

  it('marks optional fields as not required', () => {
    const schema = z.object({
      mandatory: z.string(),
      optionalField: z.string().optional()
    })
    const jsonSchema = zodToStructuredJsonSchema(schema)

    // Expect only "mandatory" in required
    expect(jsonSchema).toEqual({
      type: 'object',
      properties: {
        mandatory: { type: 'string' },
        optionalField: { type: 'string' }
      },
      required: ['mandatory'],
      additionalProperties: false
    })
  })

  it('handles enum correctly', () => {
    const enumSchema = z.enum(['red', 'green', 'blue'])
    const jsonSchema = zodToStructuredJsonSchema(enumSchema)

    expect(jsonSchema).toEqual({
      type: 'string',
      enum: ['red', 'green', 'blue']
    })
  })

  it('throws an error on unhandled union type', () => {
    // By default, we haven't implemented union in zodToOpenRouterJsonSchema
    // so it should throw an error:
    const unionSchema = z.union([z.string(), z.number()])
    expect(() => zodToStructuredJsonSchema(unionSchema)).toThrowError(
      /Unhandled or advanced Zod type: ZodUnion. Expand the function to handle unions, etc./i
    )
  })

  it('unboxes nested optional fields', () => {
    const nestedOptionalSchema = z.object({
      nested: z.optional(z.string())
    })
    const jsonSchema = zodToStructuredJsonSchema(nestedOptionalSchema)

    // The field "nested" is optional, so no 'required' array
    expect(jsonSchema).toEqual({
      type: 'object',
      properties: {
        nested: { type: 'string' }
      },
      additionalProperties: false
    })
  })

  it('converts an array of objects', () => {
    const arrayOfObjects = z.array(
      z.object({
        id: z.string(),
        active: z.boolean().optional()
      })
    )
    const jsonSchema = zodToStructuredJsonSchema(arrayOfObjects)

    expect(jsonSchema).toEqual({
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          active: { type: 'boolean' }
        },
        required: ['id'],
        additionalProperties: false
      }
    })
  })
})
