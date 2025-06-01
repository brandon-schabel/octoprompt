import { z } from 'zod'

export type JsonSchema = {
  type: 'object'
  properties: Record<string, any>
  required?: string[]
  additionalProperties?: boolean | JSONSchema
}

/**
 * This is the core JSONSchema type that OpenRouter expects:
 *   - If `type: "object"`, it must have `properties` (and optionally `required` and `additionalProperties`).
 *   - If `type: "array"`, it must have `items`.
 *   - If `type: "string" | "number" | "boolean"`, you can optionally specify `description` or `enum` (for strings).
 */
export type JSONSchema = JSONSchemaObject | JSONSchemaArray | JSONSchemaString | JSONSchemaNumber | JSONSchemaBoolean

interface JSONSchemaObject {
  type: 'object'
  description?: string
  properties: Record<string, JSONSchema>
  required?: string[]
  additionalProperties?: boolean | JSONSchema
}

interface JSONSchemaArray {
  type: 'array'
  description?: string
  items: JSONSchema
}

interface JSONSchemaString {
  type: 'string'
  description?: string
  enum?: string[]
}

interface JSONSchemaNumber {
  type: 'number'
  description?: string
}

interface JSONSchemaBoolean {
  type: 'boolean'
  description?: string
}

/**
 * Recursively convert a Zod schema into an OpenRouter-compatible JSON schema.
 */
export function zodToStructuredJsonSchema<T extends z.ZodTypeAny>(zodSchema: T): JSONSchema {
  const def = zodSchema._def
  switch (def.typeName) {
    case z.ZodFirstPartyTypeKind.ZodOptional: {
      const unwrapped = def.innerType
      return zodToStructuredJsonSchema(unwrapped)
    }
    // Handle .nullable(), .default(), etc. similarly if needed.

    case z.ZodFirstPartyTypeKind.ZodObject: {
      const shape = def.shape()
      const properties: Record<string, JSONSchema> = {}
      const required: string[] = []

      for (const key in shape) {
        const childSchema = shape[key]
        properties[key] = zodToStructuredJsonSchema(childSchema)

        if (!isOptionalSchema(childSchema)) {
          required.push(key)
        }
      }

      return {
        type: 'object',
        properties,
        additionalProperties: false,
        ...(required.length > 0 ? { required } : {})
      } as JSONSchemaObject
    }
    case z.ZodFirstPartyTypeKind.ZodString:
      return { type: 'string' } as JSONSchemaString

    case z.ZodFirstPartyTypeKind.ZodNumber:
      return { type: 'number' } as JSONSchemaNumber

    case z.ZodFirstPartyTypeKind.ZodBoolean:
      return { type: 'boolean' } as JSONSchemaBoolean

    case z.ZodFirstPartyTypeKind.ZodArray: {
      const arrayDef = def as z.ZodArrayDef
      return {
        type: 'array',
        items: zodToStructuredJsonSchema(arrayDef.type)
      } as JSONSchemaArray
    }

    case z.ZodFirstPartyTypeKind.ZodRecord: {
      const valueSchema = def.valueType
      // If the record's value is z.any(), force additionalProperties to be false
      if (valueSchema._def.typeName === z.ZodFirstPartyTypeKind.ZodAny) {
        return {
          type: 'object',
          properties: {},
          additionalProperties: false
        } as JSONSchemaObject
      }
      return {
        type: 'object',
        properties: {},
        additionalProperties: zodToStructuredJsonSchema(valueSchema)
      } as JSONSchemaObject
    }

    case z.ZodFirstPartyTypeKind.ZodAny: {
      // z.any() means no validation constraints – translate to an empty schema.
      return {} as JSONSchema
    }

    case z.ZodFirstPartyTypeKind.ZodEnum: {
      const enumValues = def.values
      return { type: 'string', enum: enumValues } as JSONSchemaString
    }

    default:
      throw new Error(`Unhandled or advanced Zod type: ${def.typeName}. Expand the function to handle unions, etc.`)
  }
}

function isOptionalSchema(schema: z.ZodTypeAny): boolean {
  const typeName = schema._def.typeName
  return (
    typeName === z.ZodFirstPartyTypeKind.ZodOptional ||
    typeName === z.ZodFirstPartyTypeKind.ZodNullable ||
    typeName === z.ZodFirstPartyTypeKind.ZodDefault
  )
}

/**
 * Converts our rich JSONSchema type to OpenRouter's simpler JsonSchema format.
 * OpenRouter only supports object schemas with properties.
 */
export function toOpenRouterSchema(schema: JSONSchema): JsonSchema {
  if (schema.type !== 'object') {
    throw new Error('OpenRouter only supports object schemas at the top level')
  }

  return {
    type: 'object',
    properties: schema.properties,
    ...(schema.required ? { required: schema.required } : {}),
    ...(schema.additionalProperties !== undefined ? { additionalProperties: schema.additionalProperties } : {})
  }
}
