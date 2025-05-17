// tests/test-utils.ts

/**
 * Returns a random string of given length using built-in
 * Math.random() calls. Avoids external libraries.
 */
export function randomString(length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  while (result.length < length) {
    const rand = Math.floor(Math.random() * chars.length)
    result += chars.charAt(rand)
  }
  return result
}

/**
 * Returns a random integer in [min, max].
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
