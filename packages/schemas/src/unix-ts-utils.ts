import { z } from '@hono/zod-openapi'

// Define the range boundaries
const MIN_YEAR = 1970
const MAX_YEAR = 2050
const MIN_TIMESTAMP = new Date(`${MIN_YEAR}-01-01T00:00:00.000Z`).getTime() // 0
const MAX_TIMESTAMP = new Date(`${MAX_YEAR}-01-01T00:00:00.000Z`).getTime() // 2524608000000

// Helper function to convert various input types to millisecond timestamp
function toMillisecondTimestamp(value: string | number | Date): number {
  if (value instanceof Date) {
    const timestamp = value.getTime()
    if (isNaN(timestamp)) {
      throw new Error('Invalid Date object')
    }
    return timestamp
  }

  if (typeof value === 'string') {
    // Try to parse as a number first (for timestamp strings)
    const numericValue = Number(value)
    if (!isNaN(numericValue)) {
      return convertToMilliseconds(numericValue)
    }

    // Try to parse as a date string
    const dateValue = new Date(value)
    const timestamp = dateValue.getTime()
    if (isNaN(timestamp)) {
      throw new Error(`Invalid date string: ${value}`)
    }
    return timestamp
  }

  if (typeof value === 'number') {
    if (!isFinite(value)) {
      throw new Error('Timestamp must be a finite number')
    }
    return convertToMilliseconds(value)
  }

  throw new Error('Input must be a string, number, or Date')
}

// Helper function to handle both second and millisecond timestamps
function convertToMilliseconds(timestamp: number): number {
  // If the timestamp is less than this threshold, assume it's in seconds
  // This threshold represents Jan 1, 2001 in seconds (978307200)
  // Any timestamp less than this is likely in seconds, not milliseconds
  const SECONDS_THRESHOLD = 1e10 // 10 billion (roughly Jan 1, 2001 in seconds)

  if (timestamp < SECONDS_THRESHOLD) {
    // Assume it's in seconds, convert to milliseconds
    return timestamp * 1000
  }

  // Assume it's already in milliseconds
  return timestamp
}

// Create the Zod schema
export const unixTimestampSchema = z.preprocess(
  (rawValue) => {
    // rawValue is 'unknown' here
    // If rawValue is null or undefined, pass it through.
    // Zod's subsequent validations (.number(), .optional(), etc.) will handle it.
    // This is crucial for zod-to-openapi when inspecting optional fields.
    if (rawValue === null || rawValue === undefined) {
      return rawValue
    }

    // Now we expect rawValue to be string, number, or Date
    try {
      // The cast is now safer because we've handled null/undefined
      return toMillisecondTimestamp(rawValue as string | number | Date)
    } catch (error) {
      // Re-throw the original error. Zod will catch it and create a ZodError.
      if (error instanceof Error) {
        throw error
      }
      // Fallback if the caught error is not an Error instance
      throw new Error('Failed to parse timestamp during preprocess')
    }
  },
  z
    .number()
    .int('Timestamp must be an integer')
    .min(MIN_TIMESTAMP, `Timestamp must be after ${MIN_YEAR}`)
    .max(MAX_TIMESTAMP, `Timestamp must be before ${MAX_YEAR}`)
    .openapi({
      type: 'integer',
      format: 'int64', // Unix timestamp in milliseconds
      description: `Unix timestamp in milliseconds, between ${MIN_YEAR} and ${MAX_YEAR}. Input can be string, number, or Date.`,
      example: Date.now()
    })
)

// Type inference helpers
export type UnixTimestampInput = string | number | Date
export type UnixTimestampOutput = z.infer<typeof unixTimestampSchema> // number

// Convenience function for parsing with better error messages
export function parseUnixTimestamp(input: UnixTimestampInput): number {
  try {
    return unixTimestampSchema.parse(input)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((issue) => issue.message).join(', ')
      throw new Error(`Invalid timestamp: ${issues}`)
    }
    throw error
  }
}

// Safe parsing function that returns a result object
export function safeParseUnixTimestamp(input: UnixTimestampInput) {
  return unixTimestampSchema.safeParse(input)
}
