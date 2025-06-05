import { describe, it, expect } from 'bun:test'
import { parseTimestamp } from './parse-timestamp'

describe('parseTimestamp', () => {
  const date2023 = new Date('2023-10-26T10:00:00.000Z')
  const secondsTimestamp = date2023.getTime() / 1000 // 1698314400
  const millisTimestamp = date2023.getTime() // 1698314400000

  // --- Valid Inputs ---
  it('should parse a valid Unix timestamp (seconds)', () => {
    const result = parseTimestamp(secondsTimestamp)
    expect(result).toEqual(date2023)
  })

  it('should parse a valid Unix timestamp (milliseconds)', () => {
    const result = parseTimestamp(millisTimestamp)
    expect(result).toEqual(date2023)
  })

  it('should parse a valid ISO 8601 string with Z timezone', () => {
    const result = parseTimestamp('2023-10-26T10:00:00.000Z')
    expect(result).toEqual(date2023)
  })

  it('should parse a valid ISO 8601 string with offset', () => {
    const result = parseTimestamp('2023-10-26T12:00:00.000+02:00')
    expect(result?.toISOString()).toBe('2023-10-26T10:00:00.000Z') // Should adjust to UTC
  })

  it('should parse a valid ISO 8601 string without milliseconds', () => {
    const result = parseTimestamp('2023-10-26T10:00:00Z')
    expect(result).toEqual(date2023)
  })

  it('should parse a valid SQL-like timestamp string (YYYY-MM-DD HH:MM:SS)', () => {
    // Note: JS Date constructor might assume local timezone if Z or offset is missing.
    // Testing against the components avoids timezone ambiguity issues in tests.
    const result = parseTimestamp('2023-10-26 10:00:00')
    expect(result).not.toBeNull()
    if (result) {
      expect(result.getFullYear()).toBe(2023)
      expect(result.getMonth()).toBe(9) // Month is 0-indexed
      expect(result.getDate()).toBe(26)
      // Hours can vary depending on the test runner's timezone, so we are less strict here
      // expect(result.getUTCHours()).toBe(10); // This would fail if local timezone != UTC
    }
  })

  it('should parse a valid date string (YYYY-MM-DD)', () => {
    const result = parseTimestamp('2023-10-26')
    expect(result).not.toBeNull()
    if (result) {
      expect(result.getFullYear()).toBe(2023)
      expect(result.getMonth()).toBe(9) // 0-indexed
      expect(result.getDate()).toBe(26)
      expect(result.getUTCHours()).toBe(0)
    }
  })

  it('should parse timestamp for epoch (0 seconds)', () => {
    const result = parseTimestamp(0)
    expect(result).toEqual(new Date(0))
  })

  // --- Invalid Inputs ---
  it('should return null for null input', () => {
    expect(parseTimestamp(null)).toBeNull()
  })

  it('should return null for undefined input', () => {
    expect(parseTimestamp(undefined)).toBeNull()
  })

  it('should return null for an empty string', () => {
    expect(parseTimestamp('')).toBeNull()
  })

  it('should return null for a whitespace string', () => {
    expect(parseTimestamp('   ')).toBeNull()
  })

  it('should return null for an invalid date string', () => {
    expect(parseTimestamp('not a valid date')).toBeNull()
  })

  it('should return null for a completely invalid format', () => {
    expect(parseTimestamp('invalid-format')).toBeNull()
  })

  it('should return null for NaN number', () => {
    expect(parseTimestamp(NaN)).toBeNull()
  })

  it('should return null for boolean true', () => {
    expect(parseTimestamp(true as any)).toBeNull()
  })

  it('should return null for boolean false', () => {
    expect(parseTimestamp(false as any)).toBeNull()
  })

  it('should return null for an empty object', () => {
    expect(parseTimestamp({} as any)).toBeNull()
  })

  it('should return null for an object with properties', () => {
    expect(parseTimestamp({ date: '2023-01-01' } as any)).toBeNull()
  })
})
