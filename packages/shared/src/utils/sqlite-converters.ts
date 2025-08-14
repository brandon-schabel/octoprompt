/**
 * Centralized SQLite Type Converters
 *
 * This utility provides consistent type conversion between SQLite storage types
 * and TypeScript types. SQLite has a limited type system (NULL, INTEGER, REAL, TEXT, BLOB)
 * which requires careful conversion to TypeScript types.
 *
 * Key conversions:
 * - Booleans are stored as INTEGER (0/1)
 * - Arrays/Objects are stored as TEXT (JSON strings)
 * - Timestamps are stored as INTEGER (Unix milliseconds)
 * - Null/undefined handling with sensible defaults
 */

/**
 * Convert SQLite INTEGER (0/1) to TypeScript boolean
 * @param value - SQLite value (can be 0, 1, '0', '1', true, false, null, undefined)
 * @param fallback - Default value if conversion fails (default: false)
 * @returns Boolean value
 */
export function toBoolean(value: any, fallback = false): boolean {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const lower = value.toLowerCase()
    if (lower === 'true' || lower === '1') return true
    if (lower === 'false' || lower === '0') return false
  }
  return fallback
}

/**
 * Convert TypeScript boolean to SQLite INTEGER (0/1)
 * @param value - Boolean value
 * @returns 0 or 1 for SQLite storage
 */
export function fromBoolean(value: boolean | null | undefined): number {
  return value ? 1 : 0
}

/**
 * Convert SQLite value to TypeScript number
 * @param value - SQLite value (can be number, string, null, undefined)
 * @param fallback - Default value if conversion fails (default: 0)
 * @returns Number value
 */
export function toNumber(value: any, fallback = 0): number {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'number') {
    return isNaN(value) ? fallback : value
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    return isNaN(parsed) ? fallback : parsed
  }
  return fallback
}

/**
 * Convert value to SQLite-safe number
 * @param value - Number value
 * @returns Number or null for SQLite storage
 */
export function fromNumber(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  return isNaN(value) ? null : value
}

/**
 * Convert SQLite TEXT to TypeScript string
 * @param value - SQLite value
 * @param fallback - Default value if conversion fails (default: '')
 * @returns String value
 */
export function toString(value: any, fallback = ''): string {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return fallback
}

/**
 * Convert value to SQLite TEXT
 * @param value - String value
 * @returns String or null for SQLite storage
 */
export function fromString(value: string | null | undefined): string | null {
  return value ?? null
}

/**
 * Safely parse JSON string to object/array
 * @param json - JSON string from SQLite TEXT column
 * @param fallback - Default value if parsing fails
 * @param context - Optional context for error logging
 * @returns Parsed value or fallback
 */
export function toJson<T>(json: string | null | undefined, fallback: T, context?: string): T {
  if (!json) return fallback

  try {
    return JSON.parse(json) as T
  } catch (error) {
    if (context) {
      console.warn(`Failed to parse JSON for ${context}: ${json}`, error)
    }
    return fallback
  }
}

/**
 * Convert object/array to JSON string for SQLite TEXT storage
 * @param value - Object or array to stringify
 * @param fallback - Default value if stringification fails (default: null)
 * @returns JSON string or fallback
 */
export function fromJson(value: any, fallback: string | null = null): string | null {
  if (value === null || value === undefined) return fallback

  try {
    return JSON.stringify(value)
  } catch (error) {
    console.warn('Failed to stringify value to JSON:', error)
    return fallback
  }
}

/**
 * Convert SQLite TEXT to TypeScript array
 * @param json - JSON string from SQLite TEXT column
 * @param fallback - Default array if parsing fails (default: [])
 * @param context - Optional context for error logging
 * @returns Array value
 */
export function toArray<T = any>(json: string | null | undefined, fallback: T[] = [], context?: string): T[] {
  const result = toJson(json, fallback, context)
  return Array.isArray(result) ? result : fallback
}

/**
 * Convert array to JSON string for SQLite TEXT storage
 * @param value - Array to stringify
 * @returns JSON string with fallback to '[]'
 */
export function fromArray(value: any[] | null | undefined): string {
  if (!value || !Array.isArray(value)) return '[]'
  return fromJson(value, '[]') ?? '[]'
}

/**
 * Convert SQLite TEXT to TypeScript object
 * @param json - JSON string from SQLite TEXT column
 * @param fallback - Default object if parsing fails (default: {})
 * @param context - Optional context for error logging
 * @returns Object value
 */
export function toObject<T extends Record<string, any> = Record<string, any>>(
  json: string | null | undefined,
  fallback: T = {} as T,
  context?: string
): T {
  const result = toJson(json, fallback, context)
  return typeof result === 'object' && !Array.isArray(result) && result !== null ? result : fallback
}

/**
 * Convert object to JSON string for SQLite TEXT storage
 * @param value - Object to stringify
 * @returns JSON string with fallback to '{}'
 */
export function fromObject(value: Record<string, any> | null | undefined): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '{}'
  return fromJson(value, '{}') ?? '{}'
}

/**
 * Convert SQLite INTEGER timestamp to Unix milliseconds
 * @param value - Timestamp value (can be seconds or milliseconds)
 * @param fallback - Default value if conversion fails (default: Date.now())
 * @returns Unix timestamp in milliseconds
 */
export function toTimestamp(value: any, fallback?: number): number {
  const defaultFallback = fallback ?? Date.now()

  if (value === null || value === undefined) return defaultFallback

  const num = toNumber(value, 0)
  if (num === 0) return defaultFallback

  // Check if it's likely in seconds vs milliseconds
  // JavaScript timestamps are in milliseconds since 1970-01-01
  // If the number is less than 10 billion, it's likely seconds
  // This covers dates up to ~2286 in seconds
  // Current time in ms is ~1.7 trillion (1,700,000,000,000)
  // Current time in seconds is ~1.7 billion (1,700,000,000)
  if (num < 10000000000) {
    return num * 1000
  }

  return num
}

/**
 * Convert Unix milliseconds to SQLite INTEGER
 * @param value - Timestamp in milliseconds
 * @returns Timestamp for SQLite storage
 */
export function fromTimestamp(value: number | Date | null | undefined): number | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  return null
}

/**
 * Type guard to check if value is nullish (null or undefined)
 * @param value - Value to check
 * @returns True if value is null or undefined
 */
export function isNullish(value: any): value is null | undefined {
  return value === null || value === undefined
}

/**
 * Type guard to check if string is valid JSON
 * @param str - String to check
 * @returns True if string is valid JSON
 */
export function isValidJson(str: string): boolean {
  try {
    JSON.parse(str)
    return true
  } catch {
    return false
  }
}

/**
 * Ensure a value is a string with a fallback
 * @param value - Value to convert
 * @param fallback - Default value (default: '')
 * @returns String value
 */
export function ensureString(value: any, fallback = ''): string {
  return toString(value, fallback)
}

/**
 * Ensure a value is a number with a fallback
 * @param value - Value to convert
 * @param fallback - Default value (default: 0)
 * @returns Number value
 */
export function ensureNumber(value: any, fallback = 0): number {
  return toNumber(value, fallback)
}

/**
 * Ensure a value is a boolean with a fallback
 * @param value - Value to convert
 * @param fallback - Default value (default: false)
 * @returns Boolean value
 */
export function ensureBoolean(value: any, fallback = false): boolean {
  return toBoolean(value, fallback)
}

/**
 * Safely parse JSON with type validation
 * @param json - JSON string to parse
 * @param validator - Optional validation function
 * @param fallback - Default value if parsing/validation fails
 * @returns Parsed and validated value or fallback
 */
export function safeJsonParse<T>(
  json: string | null | undefined,
  fallback: T,
  validator?: (value: any) => value is T
): T {
  if (!json) return fallback

  try {
    const parsed = JSON.parse(json)
    if (validator && !validator(parsed)) {
      return fallback
    }
    return parsed as T
  } catch {
    return fallback
  }
}

/**
 * Batch convert database rows using a converter function
 * @param rows - Array of database rows
 * @param converter - Function to convert each row
 * @returns Array of converted values
 */
export function batchConvert<TRow, TResult>(rows: TRow[], converter: (row: TRow) => TResult): TResult[] {
  return rows.map(converter)
}

/**
 * Convert database row to record/map structure
 * @param rows - Array of database rows
 * @param keyExtractor - Function to extract key from row
 * @param valueConverter - Function to convert row to value
 * @returns Record structure
 */
export function rowsToRecord<TRow, TValue>(
  rows: TRow[],
  keyExtractor: (row: TRow) => string | number,
  valueConverter: (row: TRow) => TValue
): Record<string, TValue> {
  const record: Record<string, TValue> = {}

  for (const row of rows) {
    const key = String(keyExtractor(row))
    record[key] = valueConverter(row)
  }

  return record
}

// Export a namespace with all converters for easy access
export const SqliteConverters = {
  // Boolean converters
  toBoolean,
  fromBoolean,
  ensureBoolean,

  // Number converters
  toNumber,
  fromNumber,
  ensureNumber,

  // String converters
  toString,
  fromString,
  ensureString,

  // JSON converters
  toJson,
  fromJson,
  safeJsonParse,

  // Array converters
  toArray,
  fromArray,

  // Object converters
  toObject,
  fromObject,

  // Timestamp converters
  toTimestamp,
  fromTimestamp,

  // Type guards
  isNullish,
  isValidJson,

  // Batch operations
  batchConvert,
  rowsToRecord
}

// Type definitions for SQLite column types
export type SqliteBoolean = 0 | 1
export type SqliteNumber = number | null
export type SqliteString = string | null
export type SqliteJson = string | null
export type SqliteTimestamp = number | null
