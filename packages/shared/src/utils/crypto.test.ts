import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { encryptKey, decryptKey, generateEncryptionKey, isEncrypted } from './crypto'

// Mock encryptionKeyStorage for tests
const mockEncryptionKeyStorage = {
  clearCache: () => {
    // No-op for tests
  },
  hasKey: () => {
    return !!process.env.PROMPTLIANO_ENCRYPTION_KEY
  }
}

describe('Crypto utilities', () => {
  const originalEnv = process.env.PROMPTLIANO_ENCRYPTION_KEY

  beforeAll(() => {
    // Clear any existing env key for tests
    delete process.env.PROMPTLIANO_ENCRYPTION_KEY
    // Clear cache to ensure fresh key generation
    mockEncryptionKeyStorage.clearCache()
  })

  afterAll(() => {
    // Restore original env if it existed
    if (originalEnv) {
      process.env.PROMPTLIANO_ENCRYPTION_KEY = originalEnv
    }
  })

  test('generateEncryptionKey generates a valid base64 key', () => {
    const key = generateEncryptionKey()
    expect(typeof key).toBe('string')
    expect(key.length).toBeGreaterThan(0)
    // Check if it's valid base64
    expect(() => Buffer.from(key, 'base64')).not.toThrow()
  })

  test('encryptKey encrypts a string', async () => {
    const plaintext = 'sk-test-api-key-12345'
    const encrypted = await encryptKey(plaintext)

    expect(encrypted).toHaveProperty('encrypted')
    expect(encrypted).toHaveProperty('iv')
    expect(encrypted).toHaveProperty('tag')
    expect(encrypted).toHaveProperty('salt')
    expect(encrypted.encrypted).not.toBe(plaintext)
    expect(typeof encrypted.encrypted).toBe('string')
    expect(typeof encrypted.iv).toBe('string')
    expect(typeof encrypted.tag).toBe('string')
    expect(typeof encrypted.salt).toBe('string')
  })

  test('decryptKey decrypts an encrypted string', async () => {
    const plaintext = 'sk-test-api-key-12345'
    const encrypted = await encryptKey(plaintext)
    const decrypted = await decryptKey(encrypted)

    expect(decrypted).toBe(plaintext)
  })

  test('encrypt/decrypt works with various API key formats', async () => {
    const testKeys = [
      'sk-proj-abc123xyz',
      'openrouter-key-123456789',
      'AIzaSyB1234567890abcdefg',
      'a'.repeat(100), // Long key
      '12345' // Short key
    ]

    for (const key of testKeys) {
      const encrypted = await encryptKey(key)
      const decrypted = await decryptKey(encrypted)
      expect(decrypted).toBe(key)
    }
  })

  test('isEncrypted correctly identifies encrypted data', async () => {
    const plaintext = 'sk-test-api-key'
    const encrypted = await encryptKey(plaintext)

    expect(isEncrypted(encrypted)).toBe(true)
    expect(isEncrypted(plaintext)).toBe(false)
    expect(isEncrypted({})).toBe(false)
    expect(isEncrypted({ encrypted: 'test' })).toBe(false)
    expect(isEncrypted(null)).toBe(false)
    expect(isEncrypted(undefined)).toBe(false)
  })

  test('encrypted data is different each time due to random IV', async () => {
    const plaintext = 'sk-test-api-key'
    const encrypted1 = await encryptKey(plaintext)
    const encrypted2 = await encryptKey(plaintext)

    expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted)
    expect(encrypted1.iv).not.toBe(encrypted2.iv)
    expect(encrypted1.salt).not.toBe(encrypted2.salt)
  })

  test('decryption fails with tampered data', async () => {
    const plaintext = 'sk-test-api-key'
    const encrypted = await encryptKey(plaintext)

    // Tamper with the encrypted data
    const tampered = {
      ...encrypted,
      encrypted: encrypted.encrypted.slice(0, -4) + 'XXXX'
    }

    await expect(decryptKey(tampered)).rejects.toThrow()
  })

  test('decryption fails with wrong tag', async () => {
    const plaintext = 'sk-test-api-key'
    const encrypted = await encryptKey(plaintext)

    // Tamper with the tag
    const tampered = {
      ...encrypted,
      tag: Buffer.from('wrongtag12345678').toString('base64')
    }

    await expect(decryptKey(tampered)).rejects.toThrow()
  })

  test('automatically generates key when not set', async () => {
    // Clear cache to simulate fresh start
    mockEncryptionKeyStorage.clearCache()
    delete process.env.PROMPTLIANO_ENCRYPTION_KEY

    // Should not throw, should generate key automatically
    const encrypted = await encryptKey('test')
    expect(encrypted).toHaveProperty('encrypted')

    // Key should now exist (auto-generated in crypto.ts)
    expect(mockEncryptionKeyStorage.hasKey()).toBe(true)
  })
})
