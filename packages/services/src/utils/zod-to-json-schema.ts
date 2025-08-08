import { z } from 'zod'

/**
 * Convert a Zod schema to JSON Schema format for use with LM Studio and other OpenAI-compatible APIs
 * that support structured outputs via response_format.json_schema
 */
export function zodToJsonSchema(schema: z.ZodType<any>): any {
  return convertZodType(schema._def)
}

function convertZodType(def: any): any {
  const typeName = def.typeName

  switch (typeName) {
    case 'ZodString':
      return {
        type: 'string',
        ...(def.description && { description: def.description }),
        ...(def.minLength && { minLength: def.minLength }),
        ...(def.maxLength && { maxLength: def.maxLength })
      }

    case 'ZodNumber':
      return {
        type: 'number',
        ...(def.description && { description: def.description }),
        ...(def.minimum !== undefined && { minimum: def.minimum }),
        ...(def.maximum !== undefined && { maximum: def.maximum })
      }

    case 'ZodBoolean':
      return {
        type: 'boolean',
        ...(def.description && { description: def.description })
      }

    case 'ZodArray':
      return {
        type: 'array',
        items: convertZodType(def.type._def),
        ...(def.description && { description: def.description }),
        ...(def.minLength && { minItems: def.minLength }),
        ...(def.maxLength && { maxItems: def.maxLength })
      }

    case 'ZodObject':
      const shape = def.shape()
      const properties: any = {}
      const required: string[] = []

      for (const key in shape) {
        const fieldDef = shape[key]._def
        properties[key] = convertZodType(fieldDef)

        // Check if field is required (not optional)
        if (fieldDef.typeName !== 'ZodOptional') {
          required.push(key)
        }
      }

      return {
        type: 'object',
        properties,
        ...(required.length > 0 && { required }),
        ...(def.description && { description: def.description })
      }

    case 'ZodOptional':
      return convertZodType(def.innerType._def)

    case 'ZodNullable':
      const innerSchema = convertZodType(def.innerType._def)
      return {
        oneOf: [innerSchema, { type: 'null' }]
      }

    case 'ZodUnion':
      return {
        oneOf: def.options.map((option: any) => convertZodType(option._def))
      }

    case 'ZodEnum':
      return {
        type: 'string',
        enum: def.values,
        ...(def.description && { description: def.description })
      }

    case 'ZodLiteral':
      const value = def.value
      const literalType = typeof value === 'string' ? 'string' : typeof value === 'number' ? 'number' : 'boolean'
      return {
        type: literalType,
        const: value
      }

    case 'ZodDefault':
      const defaultSchema = convertZodType(def.innerType._def)
      return {
        ...defaultSchema,
        default: def.defaultValue()
      }

    case 'ZodRecord':
      return {
        type: 'object',
        additionalProperties: convertZodType(def.valueType._def),
        ...(def.description && { description: def.description })
      }

    case 'ZodTuple':
      return {
        type: 'array',
        items: def.items.map((item: any) => convertZodType(item._def)),
        minItems: def.items.length,
        maxItems: def.items.length
      }

    case 'ZodAny':
      return {}

    case 'ZodUnknown':
      return {}

    case 'ZodNull':
      return { type: 'null' }

    case 'ZodVoid':
      return { type: 'null' }

    case 'ZodNever':
      return { not: {} }

    default:
      console.warn(`Unsupported Zod type: ${typeName}, using generic object`)
      return { type: 'object' }
  }
}

/**
 * Helper to get descriptions from Zod schema if using .describe()
 */
export function extractZodDescription(schema: z.ZodType<any>): string | undefined {
  const def = schema._def
  return def.description
}
