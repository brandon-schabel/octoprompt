/**
 * File Storage Plugin
 * JSON file-based persistence with atomic operations
 */

import { Effect, Option, pipe } from 'effect'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as crypto from 'crypto'
import type { StoragePlugin, CacheEntry, StorageError } from '../types'
import { StorageError as StorageErrorClass } from '../types'

interface FileStorageConfig {
  directory: string
  compress?: boolean
  encrypt?: boolean
  encryptionKey?: string
  fileExtension?: string
  maxFileSize?: number // Maximum file size in bytes
  useFlatStructure?: boolean // Use flat structure vs nested directories
}

interface FileMetadata {
  key: string
  filename: string
  created: number
  modified: number
  size: number
  compressed: boolean
  encrypted: boolean
}

export class FileStoragePlugin implements StoragePlugin {
  readonly name = 'file-storage'
  readonly version = '1.0.0'
  readonly capabilities = ['persistent', 'atomic-writes', 'compression', 'encryption']

  private config: FileStorageConfig
  private metadataFile: string
  private metadata: Map<string, FileMetadata> = new Map()

  constructor(config: FileStorageConfig) {
    this.config = {
      ...config,
      fileExtension: config.fileExtension || '.json',
      maxFileSize: config.maxFileSize || 10 * 1024 * 1024, // 10MB default
      useFlatStructure: config.useFlatStructure ?? true
    }

    this.metadataFile = path.join(this.config.directory, '.storage-metadata.json')
  }

  initialize(): Effect.Effect<void, StorageErrorClass> {
    return Effect.gen(
      function* (_) {
        // Create directory if it doesn't exist
        yield* _(
          Effect.tryPromise({
            try: () => fs.mkdir(this.config.directory, { recursive: true }),
            catch: (error) =>
              new StorageErrorClass({
                operation: 'write' as const,
                message: `Failed to create storage directory: ${error}`
              })
          })
        )

        // Load metadata if exists
        yield* _(this.loadMetadata())
      }.bind(this)
    )
  }

  cleanup(): Effect.Effect<void, never> {
    return Effect.sync(() => {
      // Save metadata before cleanup
      Effect.runSync(this.saveMetadata())
    })
  }

  get<T>(key: string): Effect.Effect<CacheEntry<T> | null, StorageErrorClass> {
    return Effect.gen(
      function* (_) {
        const filename = this.getFilename(key)
        const filepath = path.join(this.config.directory, filename)

        // Check if file exists
        const exists = yield* _(this.fileExists(filepath))
        if (!exists) {
          return null
        }

        // Read file
        const content = yield* _(
          Effect.tryPromise({
            try: () => fs.readFile(filepath, 'utf-8'),
            catch: (error) =>
              new StorageErrorClass({
                operation: 'read' as const,
                key,
                message: `Failed to read file: ${error}`
              })
          })
        )

        // Decrypt if needed
        const decrypted = this.config.encrypt ? this.decrypt(content) : content

        // Decompress if needed (would need zlib)
        const decompressed = this.config.compress
          ? yield* _(
              Effect.tryPromise({
                try: () => this.decompress(decrypted),
                catch: (error) =>
                  new StorageErrorClass({
                    operation: 'read' as const,
                    key,
                    message: `Failed to decompress: ${error}`
                  })
              })
            )
          : decrypted

        // Parse JSON
        const entry = yield* _(
          Effect.try({
            try: () => JSON.parse(decompressed) as CacheEntry<T>,
            catch: (error) =>
              new StorageErrorClass({
                operation: 'read' as const,
                key,
                message: `Failed to parse JSON: ${error}`
              })
          })
        )

        // Check if expired
        if (entry.ttl && entry.ttl > 0) {
          const age = Date.now() - entry.timestamp
          if (age > entry.ttl) {
            yield* _(this.delete(key))
            return null
          }
        }

        return entry
      }.bind(this)
    )
  }

  set<T>(key: string, value: T, ttl?: number): Effect.Effect<void, StorageErrorClass> {
    return Effect.gen(
      function* (_) {
        const filename = this.getFilename(key)
        const filepath = path.join(this.config.directory, filename)

        const entry: CacheEntry<T> = {
          value,
          timestamp: Date.now(),
          ttl,
          metadata: {
            key,
            filename
          }
        }

        // Serialize to JSON
        const json = yield* _(
          Effect.try({
            try: () => JSON.stringify(entry, null, 2),
            catch: (error) =>
              new StorageErrorClass({
                operation: 'write' as const,
                key,
                message: `Failed to serialize value: ${error}`
              })
          })
        )

        // Compress if needed
        const compressed = this.config.compress
          ? yield* _(
              Effect.tryPromise({
                try: () => this.compress(json),
                catch: (error) =>
                  new StorageErrorClass({
                    operation: 'write' as const,
                    key,
                    message: `Failed to compress: ${error}`
                  })
              })
            )
          : json

        // Encrypt if needed
        const encrypted = this.config.encrypt ? this.encrypt(compressed) : compressed

        // Check file size
        const size = Buffer.byteLength(encrypted)
        if (size > this.config.maxFileSize!) {
          return yield* _(
            Effect.fail(
              new StorageErrorClass({
                operation: 'write' as const,
                key,
                message: `File size ${size} exceeds maximum ${this.config.maxFileSize}`
              })
            )
          )
        }

        // Write atomically (write to temp file then rename)
        const tempFile = `${filepath}.tmp.${Date.now()}`

        yield* _(
          Effect.tryPromise({
            try: async () => {
              await fs.writeFile(tempFile, encrypted, 'utf-8')
              await fs.rename(tempFile, filepath)
            },
            catch: async (error) => {
              // Clean up temp file if exists
              try {
                await fs.unlink(tempFile)
              } catch {}

              return new StorageErrorClass({
                operation: 'write' as const,
                key,
                message: `Failed to write file: ${error}`
              })
            }
          })
        )

        // Update metadata
        this.metadata.set(key, {
          key,
          filename,
          created: entry.timestamp,
          modified: Date.now(),
          size,
          compressed: !!this.config.compress,
          encrypted: !!this.config.encrypt
        })

        yield* _(this.saveMetadata())
      }.bind(this)
    )
  }

  delete(key: string): Effect.Effect<void, StorageErrorClass> {
    return Effect.gen(
      function* (_) {
        const filename = this.getFilename(key)
        const filepath = path.join(this.config.directory, filename)

        yield* _(
          Effect.tryPromise({
            try: () => fs.unlink(filepath),
            catch: (error: any) => {
              // Ignore if file doesn't exist
              if (error.code === 'ENOENT') {
                return
              }
              return new StorageErrorClass({
                operation: 'delete' as const,
                key,
                message: `Failed to delete file: ${error}`
              })
            }
          })
        )

        // Update metadata
        this.metadata.delete(key)
        yield* _(this.saveMetadata())
      }.bind(this)
    )
  }

  clear(): Effect.Effect<void, StorageErrorClass> {
    return Effect.gen(
      function* (_) {
        // Get all files
        const files = yield* _(
          Effect.tryPromise({
            try: () => fs.readdir(this.config.directory),
            catch: (error) =>
              new StorageErrorClass({
                operation: 'clear' as const,
                message: `Failed to read directory: ${error}`
              })
          })
        )

        // Delete all storage files (keep metadata)
        for (const file of files) {
          if (file !== '.storage-metadata.json' && !file.endsWith('.tmp')) {
            const filepath = path.join(this.config.directory, file)
            yield* _(
              Effect.tryPromise({
                try: () => fs.unlink(filepath),
                catch: () => {} // Ignore errors
              })
            )
          }
        }

        // Clear metadata
        this.metadata.clear()
        yield* _(this.saveMetadata())
      }.bind(this)
    )
  }

  has(key: string): Effect.Effect<boolean, StorageErrorClass> {
    return Effect.gen(
      function* (_) {
        const filename = this.getFilename(key)
        const filepath = path.join(this.config.directory, filename)

        const exists = yield* _(this.fileExists(filepath))
        if (!exists) {
          return false
        }

        // Check if expired by reading the file
        const entry = yield* _(this.get(key))
        return entry !== null
      }.bind(this)
    )
  }

  keys(): Effect.Effect<readonly string[], StorageErrorClass> {
    return Effect.gen(
      function* (_) {
        // Load fresh metadata
        yield* _(this.loadMetadata())
        return Array.from(this.metadata.keys())
      }.bind(this)
    )
  }

  // Helper methods

  private getFilename(key: string): string {
    // Sanitize key for filesystem
    const sanitized = key.replace(/[^a-zA-Z0-9-_]/g, '_')

    if (this.config.useFlatStructure) {
      // Use hash prefix to avoid too many files in one directory
      const hash = crypto.createHash('md5').update(key).digest('hex')
      return `${hash.substring(0, 2)}_${sanitized}${this.config.fileExtension}`
    } else {
      // Use nested structure based on key
      const parts = sanitized.split('_')
      if (parts.length > 1) {
        return path.join(...parts.slice(0, -1), parts[parts.length - 1] + this.config.fileExtension)
      }
      return sanitized + this.config.fileExtension
    }
  }

  private fileExists(filepath: string): Effect.Effect<boolean, never> {
    return Effect.tryPromise({
      try: async () => {
        try {
          await fs.access(filepath)
          return true
        } catch {
          return false
        }
      },
      catch: () => false
    })
  }

  private loadMetadata(): Effect.Effect<void, StorageErrorClass> {
    return Effect.gen(
      function* (_) {
        const exists = yield* _(this.fileExists(this.metadataFile))
        if (!exists) {
          return
        }

        const content = yield* _(
          Effect.tryPromise({
            try: () => fs.readFile(this.metadataFile, 'utf-8'),
            catch: (error) =>
              new StorageErrorClass({
                operation: 'read' as const,
                message: `Failed to read metadata: ${error}`
              })
          })
        )

        const data = yield* _(
          Effect.try({
            try: () => JSON.parse(content) as Record<string, FileMetadata>,
            catch: () => ({}) as Record<string, FileMetadata>
          })
        )

        this.metadata = new Map(Object.entries(data))
      }.bind(this)
    )
  }

  private saveMetadata(): Effect.Effect<void, StorageErrorClass> {
    return Effect.tryPromise({
      try: () => {
        const data = Object.fromEntries(this.metadata.entries())
        return fs.writeFile(this.metadataFile, JSON.stringify(data, null, 2), 'utf-8')
      },
      catch: (error) =>
        new StorageErrorClass({
          operation: 'write' as const,
          message: `Failed to save metadata: ${error}`
        })
    })
  }

  private encrypt(data: string): string {
    if (!this.config.encryptionKey) {
      throw new Error('Encryption key not provided')
    }

    const algorithm = 'aes-256-gcm'
    const key = crypto.scryptSync(this.config.encryptionKey, 'salt', 32)
    const iv = crypto.randomBytes(16)

    const cipher = crypto.createCipheriv(algorithm, key, iv)
    let encrypted = cipher.update(data, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    const authTag = cipher.getAuthTag()

    return JSON.stringify({
      encrypted,
      authTag: authTag.toString('hex'),
      iv: iv.toString('hex')
    })
  }

  private decrypt(data: string): string {
    if (!this.config.encryptionKey) {
      throw new Error('Encryption key not provided')
    }

    const { encrypted, authTag, iv } = JSON.parse(data)

    const algorithm = 'aes-256-gcm'
    const key = crypto.scryptSync(this.config.encryptionKey, 'salt', 32)

    const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(iv, 'hex'))

    decipher.setAuthTag(Buffer.from(authTag, 'hex'))

    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  }

  private async compress(data: string): Promise<string> {
    // Would use zlib or similar for real compression
    // For now, just return the data
    return data
  }

  private async decompress(data: string): Promise<string> {
    // Would use zlib or similar for real decompression
    // For now, just return the data
    return data
  }
}

/**
 * Create a file storage plugin with configuration
 */
export function createFileStorage(config: FileStorageConfig): FileStoragePlugin {
  return new FileStoragePlugin(config)
}
