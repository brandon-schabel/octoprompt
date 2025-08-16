import { z, ZodError, ZodSchema } from 'zod'
import { ApiError } from '@promptliano/shared'
import { SqliteConverters } from '@promptliano/shared/src/utils/sqlite-converters'

/**
 * Field mapping configuration for entity conversion
 */
export interface FieldMapping {
  dbColumn: string
  converter?: (value: any) => any
  defaultValue?: any
}

/**
 * Create a generic row-to-entity converter
 * Maps database columns to entity properties with type conversion
 */
export function createEntityConverter<T>(
  schema: ZodSchema<T>,
  fieldMappings: Record<keyof T, string | FieldMapping>
): (row: any) => T {
  return (row: any): T => {
    const entity: any = {}

    for (const [entityKey, mapping] of Object.entries(fieldMappings) as Array<[keyof T, string | FieldMapping]>) {
      if (typeof mapping === 'string') {
        // Simple column mapping
        entity[entityKey] = row[mapping]
      } else {
        // Advanced mapping with converter
        const value = row[mapping.dbColumn]
        
        if (mapping.converter) {
          entity[entityKey] = mapping.converter(value)
        } else if (value === null || value === undefined) {
          entity[entityKey] = mapping.defaultValue !== undefined ? mapping.defaultValue : value
        } else {
          entity[entityKey] = value
        }
      }
    }

    // Validate and return
    const result = schema.safeParse(entity)
    if (!result.success) {
      console.error('Entity conversion failed:', result.error.errors)
      throw new ApiError(500, 'Entity conversion failed', 'CONVERSION_ERROR')
    }

    return result.data
  }
}

/**
 * Create standard field mappings for common entity patterns
 */
export function createStandardMappings<T extends Record<string, any>>(
  customMappings: Partial<Record<keyof T, string | FieldMapping>> = {}
): Record<keyof T, string | FieldMapping> {
  const standardMappings: Record<string, FieldMapping> = {
    id: { dbColumn: 'id', converter: (v) => SqliteConverters.toNumber(v) },
    projectId: { dbColumn: 'project_id', converter: (v) => SqliteConverters.toNumber(v) },
    created: { dbColumn: 'created_at', converter: (v) => SqliteConverters.toTimestamp(v) },
    updated: { dbColumn: 'updated_at', converter: (v) => SqliteConverters.toTimestamp(v) },
    createdAt: { dbColumn: 'created_at', converter: (v) => SqliteConverters.toTimestamp(v) },
    updatedAt: { dbColumn: 'updated_at', converter: (v) => SqliteConverters.toTimestamp(v) },
    name: { dbColumn: 'name', converter: (v) => SqliteConverters.toString(v) },
    title: { dbColumn: 'title', converter: (v) => SqliteConverters.toString(v) },
    description: { dbColumn: 'description', converter: (v) => SqliteConverters.toString(v), defaultValue: '' },
    content: { dbColumn: 'content', converter: (v) => SqliteConverters.toString(v) },
    status: { dbColumn: 'status', converter: (v) => v },
    priority: { dbColumn: 'priority', converter: (v) => v },
    done: { dbColumn: 'done', converter: (v) => SqliteConverters.toBoolean(v) }
  }

  return { ...standardMappings, ...customMappings } as Record<keyof T, string | FieldMapping>
}

/**
 * Standard field converters for common patterns
 */
export const FieldConverters = {
  toBoolean: (value: any) => SqliteConverters.toBoolean(value),
  toNumber: (value: any) => SqliteConverters.toNumber(value),
  toString: (value: any) => SqliteConverters.toString(value),
  toArray: (value: any) => SqliteConverters.toArray(value),
  toObject: (value: any) => SqliteConverters.toObject(value),
  toTimestamp: (value: any) => SqliteConverters.toTimestamp(value),
  toJson: <T>(value: any, fallback: T) => SqliteConverters.toJson(value, fallback),
  toEnum: <T extends string>(value: any, validValues: T[], fallback: T) => {
    const str = SqliteConverters.toString(value, fallback)
    return validValues.includes(str as T) ? (str as T) : fallback
  }
}

/**
 * Create INSERT column definitions from field mappings
 */
export function getInsertColumnsFromMappings<T>(
  mappings: Record<keyof T, string | FieldMapping>,
  excludeColumns: string[] = []
): string[] {
  const columns: string[] = []
  
  for (const mapping of Object.values(mappings)) {
    const column = typeof mapping === 'string' ? mapping : (mapping as FieldMapping).dbColumn
    if (!excludeColumns.includes(column)) {
      columns.push(column)
    }
  }
  
  return columns
}

/**
 * Create INSERT values from entity using field mappings
 */
export function getInsertValuesFromEntity<T extends Record<string, any>>(
  entity: T,
  mappings: Record<keyof T, string | FieldMapping>,
  excludeFields: Array<keyof T> = []
): any[] {
  const values: any[] = []
  
  for (const [field, mapping] of Object.entries(mappings) as Array<[keyof T, string | FieldMapping]>) {
    if (excludeFields.includes(field)) continue
    
    const value = entity[field]
    
    if (typeof mapping === 'string') {
      values.push(value)
    } else {
      const fieldMapping = mapping as FieldMapping
      
      if (value === null || value === undefined) {
        values.push(fieldMapping.defaultValue !== undefined ? fieldMapping.defaultValue : null)
      } else if (Array.isArray(value)) {
        values.push(SqliteConverters.fromArray(value))
      } else if (typeof value === 'object') {
        values.push(SqliteConverters.fromObject(value))
      } else if (typeof value === 'boolean') {
        values.push(SqliteConverters.fromBoolean(value))
      } else {
        values.push(value)
      }
    }
  }
  
  return values
}

/**
 * Build UPDATE SET clause from partial entity
 */
export function buildUpdateSetClause<T>(
  updates: Partial<T>,
  mappings: Record<keyof T, string | FieldMapping>,
  excludeFields: Array<keyof T> = ['id' as keyof T]
): { setClause: string; values: any[] } {
  const setClauses: string[] = []
  const values: any[] = []
  
  for (const [field, value] of Object.entries(updates) as Array<[keyof T, any]>) {
    if (excludeFields.includes(field) || value === undefined) continue
    
    const mapping = mappings[field]
    if (!mapping) continue
    
    const column = typeof mapping === 'string' ? mapping : mapping.dbColumn
    setClauses.push(`${column} = ?`)
    
    if (value === null) {
      values.push(null)
    } else if (Array.isArray(value)) {
      values.push(SqliteConverters.fromArray(value))
    } else if (typeof value === 'object') {
      values.push(SqliteConverters.fromObject(value))
    } else if (typeof value === 'boolean') {
      values.push(SqliteConverters.fromBoolean(value))
    } else {
      values.push(value)
    }
  }
  
  // Always update the updated timestamp
  if (!updates.hasOwnProperty('updated') && !updates.hasOwnProperty('updatedAt')) {
    setClauses.push('updated_at = ?')
    values.push(Date.now())
  }
  
  return {
    setClause: setClauses.join(', '),
    values
  }
}

/**
 * Validate data against a schema with detailed error reporting
 */
export async function validateData<T>(
  data: unknown,
  schema: ZodSchema<T>,
  context: string
): Promise<T> {
  const validationResult = await schema.safeParseAsync(data)
  
  if (!validationResult.success) {
    const errors = validationResult.error.errors.map(err => ({
      path: err.path.join('.'),
      message: err.message
    }))
    
    console.error(`Validation failed for ${context}:`, errors)
    throw new ApiError(
      400,
      `Validation failed for ${context}`,
      'VALIDATION_ERROR',
      { errors }
    )
  }
  
  return validationResult.data
}

/**
 * Batch validate multiple entities
 */
export async function batchValidate<T>(
  items: unknown[],
  schema: ZodSchema<T>,
  context: string
): Promise<T[]> {
  const validated: T[] = []
  const errors: Array<{ index: number; errors: any }> = []
  
  for (let i = 0; i < items.length; i++) {
    try {
      const result = await validateData(items[i], schema, `${context}[${i}]`)
      validated.push(result)
    } catch (error: any) {
      if (error.code === 'VALIDATION_ERROR') {
        errors.push({ index: i, errors: error.details?.errors })
      } else {
        throw error
      }
    }
  }
  
  if (errors.length > 0) {
    throw new ApiError(
      400,
      `Batch validation failed for ${context}`,
      'BATCH_VALIDATION_ERROR',
      { errors }
    )
  }
  
  return validated
}