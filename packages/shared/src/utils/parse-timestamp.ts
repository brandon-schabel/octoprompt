/**
 * Safely parses a timestamp value from various common formats into a Date object.
 * Handles numbers (Unix timestamp in seconds or milliseconds),
 * ISO 8601 strings, and common SQL timestamp formats.
 * @param tsValue - The timestamp value to parse (number, string, null, or undefined).
 * @returns A Date object if parsing is successful, otherwise null.
 */
export const parseTimestamp = (tsValue: unknown): Date | null => {
  if (tsValue === null || tsValue === undefined) {
    return null
  }

  if (typeof tsValue === 'number') {
    if (isNaN(tsValue)) return null
    // Using a threshold to distinguish seconds from milliseconds
    const NUMERIC_TIMESTAMP_MS_THRESHOLD = 100000000000 // 10^11
    const date = new Date(tsValue > NUMERIC_TIMESTAMP_MS_THRESHOLD ? tsValue : tsValue * 1000)
    return !isNaN(date.getTime()) ? date : null
  }

  if (typeof tsValue === 'string') {
    const trimmedValue = tsValue.trim()
    if (!trimmedValue) return null

    // Attempt parsing common formats. Date constructor handles ISO 8601 well.
    const date = new Date(trimmedValue)

    // Verify the parsed date is valid
    if (!isNaN(date.getTime()) && date.toString() !== 'Invalid Date') {
      return date
    }
  }

  return null
}

/**
 * Safely parses a timestamp value and converts it to a Unix timestamp in milliseconds.
 * @param tsValue - The timestamp value to parse (number, string, Date, null, or undefined).
 * @returns A number representing milliseconds since epoch, otherwise null.
 */
export const normalizeToUnixMs = (tsValue: unknown): number => {
  const date = parseTimestamp(tsValue)
  return date?.getTime() ?? new Date().getTime()
}
