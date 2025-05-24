import { z } from '@hono/zod-openapi'


// Define the range boundaries
const MIN_YEAR = 1970;
const MAX_YEAR = 2050;
const MIN_TIMESTAMP = new Date(`${MIN_YEAR}-01-01T00:00:00.000Z`).getTime(); // 0
const MAX_TIMESTAMP = new Date(`${MAX_YEAR}-01-01T00:00:00.000Z`).getTime(); // 2524608000000

// Helper function to convert various input types to millisecond timestamp
function toMillisecondTimestamp(value: string | number | Date): number {
  if (value instanceof Date) {
    const timestamp = value.getTime();
    if (isNaN(timestamp)) {
      throw new Error('Invalid Date object');
    }
    return timestamp;
  }
  
  if (typeof value === 'string') {
    // Try to parse as a number first (for timestamp strings)
    const numericValue = Number(value);
    if (!isNaN(numericValue)) {
      return convertToMilliseconds(numericValue);
    }
    
    // Try to parse as a date string
    const dateValue = new Date(value);
    const timestamp = dateValue.getTime();
    if (isNaN(timestamp)) {
      throw new Error(`Invalid date string: ${value}`);
    }
    return timestamp;
  }
  
  if (typeof value === 'number') {
    if (!isFinite(value)) {
      throw new Error('Timestamp must be a finite number');
    }
    return convertToMilliseconds(value);
  }
  
  throw new Error('Input must be a string, number, or Date');
}

// Helper function to handle both second and millisecond timestamps
function convertToMilliseconds(timestamp: number): number {
  // If the timestamp is less than this threshold, assume it's in seconds
  // This threshold represents Jan 1, 2001 in seconds (978307200)
  // Any timestamp less than this is likely in seconds, not milliseconds
  const SECONDS_THRESHOLD = 1e10; // 10 billion (roughly Jan 1, 2001 in seconds)
  
  if (timestamp < SECONDS_THRESHOLD) {
    // Assume it's in seconds, convert to milliseconds
    return timestamp * 1000;
  }
  
  // Assume it's already in milliseconds
  return timestamp;
}

// Create the Zod schema
export const unixTimestampSchema = z.preprocess(
  (value) => {
    try {
      return toMillisecondTimestamp(value as string | number | Date);
    } catch (error) {
      // Zod will handle this as a validation error
      throw new Error(error instanceof Error ? error.message : 'Failed to parse timestamp');
    }
  },
  z.number()
    .int('Timestamp must be an integer')
    .min(MIN_TIMESTAMP, `Timestamp must be after ${MIN_YEAR}`)
    .max(MAX_TIMESTAMP, `Timestamp must be before ${MAX_YEAR}`)
);

// Type inference helpers
export type UnixTimestampInput = string | number | Date;
export type UnixTimestampOutput = z.infer<typeof unixTimestampSchema>; // number

// Convenience function for parsing with better error messages
export function parseUnixTimestamp(input: UnixTimestampInput): number {
  try {
    return unixTimestampSchema.parse(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(issue => issue.message).join(', ');
      throw new Error(`Invalid timestamp: ${issues}`);
    }
    throw error;
  }
}

// Safe parsing function that returns a result object
export function safeParseUnixTimestamp(input: UnixTimestampInput) {
  return unixTimestampSchema.safeParse(input);
}
