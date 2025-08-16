import { Buffer } from 'buffer'

// Environment detection
const isServerEnvironment = typeof process !== 'undefined' && process.env && (
  process.env.NODE_ENV === 'test' || 
  typeof window === 'undefined'
)

// Conditional storage import for server/test environments
let encryptionKeyStorage: { getKey: () => string }

if (isServerEnvironment) {
  try {
    // Dynamic import to avoid bundling issues in client
    const { encryptionKeyStorage: storage } = require('@promptliano/storage')
    encryptionKeyStorage = storage
  } catch (error) {
    // Fallback for test environment
    encryptionKeyStorage = {
      getKey: () => {
        const testKey = process.env.PROMPTLIANO_ENCRYPTION_KEY
        if (!testKey) {
          throw new Error('PROMPTLIANO_ENCRYPTION_KEY environment variable required for server/test')
        }
        return testKey
      }
    }
  }
} else {
  // Client environment - throw clear error
  encryptionKeyStorage = {
    getKey: () => {
      throw new Error('Encryption operations not available in client environment')
    }
  }
}

const KEY_LENGTH = 32 // 256 bits
const IV_LENGTH = 16 // 128 bits
const TAG_LENGTH = 16 // 128 bits
const SALT_LENGTH = 32 // 256 bits

export interface EncryptedData {
  encrypted: string
  iv: string
  tag: string
  salt: string
}

/**
 * Generates a new encryption key
 */
export function generateEncryptionKey(): string {
  const key = crypto.getRandomValues(new Uint8Array(KEY_LENGTH))
  return Buffer.from(key).toString('base64')
}

/**
 * Derives an encryption key from a password using PBKDF2
 */
async function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    KEY_LENGTH * 8
  )

  return Buffer.from(derivedBits)
}

/**
 * Encrypts a string value
 */
export async function encryptKey(plaintext: string): Promise<EncryptedData> {
  const envKey = encryptionKeyStorage.getKey()

  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  const encoder = new TextEncoder()
  const data = encoder.encode(plaintext)

  // Derive key from password and salt
  const derivedKey = await deriveKey(envKey, Buffer.from(salt))

  // Use Web Crypto API for encryption
  const cryptoKey = await crypto.subtle.importKey('raw', derivedKey, { name: 'AES-GCM' }, false, ['encrypt'])

  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv
    },
    cryptoKey,
    data
  )

  // Extract tag from the end of encrypted data
  const encryptedArray = new Uint8Array(encrypted)
  const ciphertext = encryptedArray.slice(0, -TAG_LENGTH)
  const tag = encryptedArray.slice(-TAG_LENGTH)

  return {
    encrypted: Buffer.from(ciphertext).toString('base64'),
    iv: Buffer.from(iv).toString('base64'),
    tag: Buffer.from(tag).toString('base64'),
    salt: Buffer.from(salt).toString('base64')
  }
}

/**
 * Decrypts an encrypted string value
 */
export async function decryptKey(encryptedData: EncryptedData): Promise<string> {
  const envKey = encryptionKeyStorage.getKey()

  const iv = Buffer.from(encryptedData.iv, 'base64')
  const tag = Buffer.from(encryptedData.tag, 'base64')
  const salt = Buffer.from(encryptedData.salt, 'base64')
  const ciphertext = Buffer.from(encryptedData.encrypted, 'base64')

  // Derive key from password and salt
  const derivedKey = await deriveKey(envKey, salt)

  // Combine ciphertext and tag for Web Crypto API
  const combined = new Uint8Array(ciphertext.length + tag.length)
  combined.set(ciphertext)
  combined.set(tag, ciphertext.length)

  const cryptoKey = await crypto.subtle.importKey('raw', derivedKey, { name: 'AES-GCM' }, false, ['decrypt'])

  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv
    },
    cryptoKey,
    combined
  )

  const decoder = new TextDecoder()
  return decoder.decode(decrypted)
}

/**
 * Checks if a value appears to be encrypted
 */
export function isEncrypted(value: any): value is EncryptedData {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.encrypted === 'string' &&
    typeof value.iv === 'string' &&
    typeof value.tag === 'string' &&
    typeof value.salt === 'string'
  )
}
