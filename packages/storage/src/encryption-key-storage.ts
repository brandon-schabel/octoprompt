import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { ensureString } from '@promptliano/shared/src/utils/sqlite-converters'

// Generate encryption key directly to avoid circular dependency
function generateEncryptionKey(): string {
  const key = crypto.getRandomValues(new Uint8Array(32)) // 256 bits
  return Buffer.from(key).toString('base64')
}

// Get platform-appropriate data directory (same as database)
function getDataDirectory(): string {
  const platform = os.platform()
  const homeDir = os.homedir()

  switch (platform) {
    case 'darwin': // macOS
      return path.join(homeDir, 'Library', 'Application Support', 'Promptliano')
    case 'win32': // Windows
      return path.join(process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming'), 'Promptliano')
    case 'linux': // Linux
      return path.join(process.env.XDG_DATA_HOME || path.join(homeDir, '.local', 'share'), 'promptliano')
    default:
      // Fallback to home directory
      return path.join(homeDir, '.promptliano')
  }
}

export class EncryptionKeyStorage {
  private static instance: EncryptionKeyStorage | null = null
  private encryptionKey: string | null = null
  private readonly keyFileName = 'encryption.key'

  private constructor() {}

  static getInstance(): EncryptionKeyStorage {
    if (!EncryptionKeyStorage.instance) {
      EncryptionKeyStorage.instance = new EncryptionKeyStorage()
    }
    return EncryptionKeyStorage.instance
  }

  private getKeyPath(): string {
    const dataDir = getDataDirectory()
    return path.join(dataDir, this.keyFileName)
  }

  private ensureDataDirectory(): void {
    const dataDir = getDataDirectory()
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }
  }

  /**
   * Gets the encryption key, generating one if it doesn't exist
   */
  getKey(): string {
    // Return cached key if available
    if (this.encryptionKey) {
      return this.encryptionKey
    }

    // Check environment variable first (backward compatibility)
    const envKey = process.env.PROMPTLIANO_ENCRYPTION_KEY
    if (envKey) {
      this.encryptionKey = ensureString(envKey)
      return this.encryptionKey
    }

    // Check if key file exists
    const keyPath = this.getKeyPath()
    if (fs.existsSync(keyPath)) {
      try {
        this.encryptionKey = ensureString(fs.readFileSync(keyPath, 'utf-8').trim())
        return this.encryptionKey
      } catch (error) {
        console.error('Failed to read encryption key:', error)
        throw new Error('Failed to read encryption key from storage')
      }
    }

    // Generate new key
    console.log('Generating new encryption key...')
    const newKey = generateEncryptionKey()
    this.saveKey(newKey)
    this.encryptionKey = newKey
    return newKey
  }

  /**
   * Saves the encryption key to disk
   */
  private saveKey(key: string): void {
    try {
      this.ensureDataDirectory()
      const keyPath = this.getKeyPath()

      // Write key with restricted permissions
      fs.writeFileSync(keyPath, key, {
        encoding: 'utf-8',
        mode: 0o600 // Read/write for owner only
      })

      console.log('Encryption key saved to:', keyPath)
    } catch (error) {
      console.error('Failed to save encryption key:', error)
      throw new Error('Failed to save encryption key to storage')
    }
  }

  /**
   * Checks if an encryption key exists
   */
  hasKey(): boolean {
    return !!(process.env.PROMPTLIANO_ENCRYPTION_KEY || fs.existsSync(this.getKeyPath()))
  }

  /**
   * Clears the cached key (useful for testing)
   */
  clearCache(): void {
    this.encryptionKey = null
  }
}

// Export singleton instance
export const encryptionKeyStorage = EncryptionKeyStorage.getInstance()
