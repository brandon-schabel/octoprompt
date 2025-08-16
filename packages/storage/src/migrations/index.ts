import { z } from 'zod'
import fs from 'node:fs/promises'
import path from 'node:path'
import { ApiError } from '@promptliano/shared'
import type { StorageAdapter } from '../storage-v2'

// --- Types ---

/**
 * Base migration interface
 */
export interface Migration {
  /** Unique version number for ordering migrations */
  version: number
  /** Human-readable description of the migration */
  description: string
  /** Execute the migration - can be SQL string or function */
  up: string | MigrationFunction
  /** Optional rollback migration */
  down?: string | MigrationFunction
}

/**
 * Function-based migration with access to adapter
 */
export type MigrationFunction = (adapter: StorageAdapter<any>) => Promise<void>

/**
 * Migration history entry stored in migrations table
 */
export interface MigrationHistoryEntry {
  version: number
  description: string
  appliedAt: number
  executionTime: number
  checksum: string
}

/**
 * Configuration for migration runner
 */
export interface MigrationConfig {
  /** Storage adapter to run migrations against */
  adapter: StorageAdapter<any>
  /** Array of migrations to run */
  migrations: Migration[]
  /** Optional logger function */
  logger?: (message: string) => void
  /** Whether to run migrations in a transaction (if supported) */
  useTransaction?: boolean
}

// --- Schemas ---

const migrationHistorySchema = z.object({
  version: z.number(),
  description: z.string(),
  appliedAt: z.number(),
  executionTime: z.number(),
  checksum: z.string()
})

// --- Migration Runner ---

/**
 * Runs database migrations in order
 */
export class MigrationRunner {
  private logger: (message: string) => void
  private historyAdapter: StorageAdapter<MigrationHistoryEntry>

  constructor(private config: MigrationConfig) {
    this.logger = config.logger || console.log
    // Create a separate adapter for migration history
    this.historyAdapter = this.createHistoryAdapter(config.adapter)
  }

  /**
   * Run all pending migrations
   */
  async run(): Promise<void> {
    this.logger('Starting migration runner...')

    // Get applied migrations
    const appliedMigrations = await this.getAppliedMigrations()
    const appliedVersions = new Set(appliedMigrations.map((m) => m.version))

    // Sort migrations by version
    const sortedMigrations = [...this.config.migrations].sort((a, b) => a.version - b.version)

    // Find pending migrations
    const pendingMigrations = sortedMigrations.filter((m) => !appliedVersions.has(m.version))

    if (pendingMigrations.length === 0) {
      this.logger('No pending migrations')
      return
    }

    this.logger(`Found ${pendingMigrations.length} pending migrations`)

    // Run each migration
    for (const migration of pendingMigrations) {
      await this.runMigration(migration)
    }

    this.logger('All migrations completed successfully')
  }

  /**
   * Run a single migration
   */
  private async runMigration(migration: Migration): Promise<void> {
    const startTime = Date.now()
    this.logger(`Running migration ${migration.version}: ${migration.description}`)

    try {
      if (this.config.useTransaction) {
        await this.runInTransaction(async () => {
          await this.executeMigration(migration)
        })
      } else {
        await this.executeMigration(migration)
      }

      const executionTime = Date.now() - startTime

      // Record migration in history
      const historyEntry: MigrationHistoryEntry = {
        version: migration.version,
        description: migration.description,
        appliedAt: Date.now(),
        executionTime,
        checksum: this.calculateChecksum(migration)
      }

      await this.historyAdapter.write(migration.version, historyEntry)
      this.logger(`Migration ${migration.version} completed in ${executionTime}ms`)
    } catch (error) {
      this.logger(`Migration ${migration.version} failed: ${error}`)
      throw new Error(`Migration ${migration.version} failed: ${error}`)
    }
  }

  /**
   * Execute the migration up function
   */
  private async executeMigration(migration: Migration): Promise<void> {
    if (typeof migration.up === 'function') {
      await migration.up(this.config.adapter)
    } else {
      // For SQL string migrations, would need SQL adapter
      throw new ApiError(501, 'SQL string migrations not supported with current adapter', 'UNSUPPORTED_MIGRATION')
    }
  }

  /**
   * Get list of applied migrations
   */
  private async getAppliedMigrations(): Promise<MigrationHistoryEntry[]> {
    try {
      const allHistory = await this.historyAdapter.readAll()
      return Array.from(allHistory.values())
    } catch (error) {
      // If history doesn't exist yet, return empty array
      return []
    }
  }

  /**
   * Calculate checksum for migration to detect changes
   */
  private calculateChecksum(migration: Migration): string {
    const content = JSON.stringify({
      version: migration.version,
      description: migration.description,
      up: migration.up.toString(),
      down: migration.down?.toString()
    })

    // Simple hash function for checksum
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16)
  }

  /**
   * Create adapter for migration history
   */
  private createHistoryAdapter(baseAdapter: StorageAdapter<any>): StorageAdapter<MigrationHistoryEntry> {
    // Create a namespaced adapter for migration history
    return {
      async read(id: string | number): Promise<MigrationHistoryEntry | null> {
        const data = await baseAdapter.read(`_migration_${id}`)
        return data ? migrationHistorySchema.parse(data) : null
      },
      async readAll(): Promise<Map<string | number, MigrationHistoryEntry>> {
        const all = await baseAdapter.readAll()
        const migrations = new Map<string | number, MigrationHistoryEntry>()

        for (const [key, value] of all) {
          if (String(key).startsWith('_migration_')) {
            const version = Number(String(key).replace('_migration_', ''))
            if (!isNaN(version)) {
              try {
                migrations.set(version, migrationHistorySchema.parse(value))
              } catch {
                // Skip invalid entries
              }
            }
          }
        }

        return migrations
      },
      async write(id: string | number, data: MigrationHistoryEntry): Promise<void> {
        await baseAdapter.write(`_migration_${id}`, data)
      },
      async delete(id: string | number): Promise<boolean> {
        return baseAdapter.delete(`_migration_${id}`)
      },
      async exists(id: string | number): Promise<boolean> {
        return baseAdapter.exists(`_migration_${id}`)
      },
      async clear(): Promise<void> {
        const all = await this.readAll()
        for (const key of all.keys()) {
          await this.delete(key)
        }
      }
    }
  }

  /**
   * Run function in transaction if supported
   */
  private async runInTransaction(fn: () => Promise<void>): Promise<void> {
    // Basic transaction simulation - in real implementation would use adapter's transaction support
    const backup = await this.config.adapter.readAll()

    try {
      await fn()
    } catch (error) {
      // Rollback by restoring backup
      await this.config.adapter.clear()
      for (const [id, data] of backup) {
        await this.config.adapter.write(id, data)
      }
      throw error
    }
  }
}

// --- Migration Utilities ---

/**
 * Create a new migration
 */
export function createMigration(
  version: number,
  description: string,
  up: string | MigrationFunction,
  down?: string | MigrationFunction
): Migration {
  return {
    version,
    description,
    up,
    down
  }
}

/**
 * Run migrations on a storage adapter
 */
export async function runMigrations(config: MigrationConfig): Promise<void> {
  const runner = new MigrationRunner(config)
  await runner.run()
}

/**
 * Create a migration that adds a field to all records
 */
export function createAddFieldMigration(
  version: number,
  description: string,
  field: string,
  defaultValue: any
): Migration {
  return createMigration(
    version,
    description,
    async (adapter) => {
      const all = await adapter.readAll()
      for (const [id, record] of all) {
        if (!(field in record)) {
          await adapter.write(id, { ...record, [field]: defaultValue })
        }
      }
    },
    async (adapter) => {
      const all = await adapter.readAll()
      for (const [id, record] of all) {
        const { [field]: _, ...rest } = record
        await adapter.write(id, rest)
      }
    }
  )
}

/**
 * Create a migration that renames a field
 */
export function createRenameFieldMigration(
  version: number,
  description: string,
  oldField: string,
  newField: string
): Migration {
  return createMigration(
    version,
    description,
    async (adapter) => {
      const all = await adapter.readAll()
      for (const [id, record] of all) {
        if (oldField in record && !(newField in record)) {
          const { [oldField]: value, ...rest } = record
          await adapter.write(id, { ...rest, [newField]: value })
        }
      }
    },
    async (adapter) => {
      const all = await adapter.readAll()
      for (const [id, record] of all) {
        if (newField in record && !(oldField in record)) {
          const { [newField]: value, ...rest } = record
          await adapter.write(id, { ...rest, [oldField]: value })
        }
      }
    }
  )
}

/**
 * Create a migration that transforms data
 */
export function createTransformMigration(
  version: number,
  description: string,
  transform: (record: any) => any,
  reverseTransform?: (record: any) => any
): Migration {
  return createMigration(
    version,
    description,
    async (adapter) => {
      const all = await adapter.readAll()
      for (const [id, record] of all) {
        const transformed = transform(record)
        await adapter.write(id, transformed)
      }
    },
    reverseTransform
      ? async (adapter) => {
          const all = await adapter.readAll()
          for (const [id, record] of all) {
            const reversed = reverseTransform(record)
            await adapter.write(id, reversed)
          }
        }
      : undefined
  )
}

/**
 * Create a migration that filters records
 */
export function createFilterMigration(
  version: number,
  description: string,
  predicate: (record: any) => boolean
): Migration {
  return createMigration(
    version,
    description,
    async (adapter) => {
      const all = await adapter.readAll()
      const deletedRecords: Array<[string | number, any]> = []

      for (const [id, record] of all) {
        if (!predicate(record)) {
          deletedRecords.push([id, record])
          await adapter.delete(id)
        }
      }

      // Store deleted records for potential rollback
      await adapter.write('_deleted_by_migration_' + version, deletedRecords)
    },
    async (adapter) => {
      const deletedRecords = (await adapter.read('_deleted_by_migration_' + version)) as Array<[string | number, any]>
      if (deletedRecords) {
        for (const [id, record] of deletedRecords) {
          await adapter.write(id, record)
        }
        await adapter.delete('_deleted_by_migration_' + version)
      }
    }
  )
}

/**
 * Get migration status for an adapter
 */
export async function getMigrationStatus(
  adapter: StorageAdapter<any>,
  migrations: Migration[]
): Promise<{
  applied: MigrationHistoryEntry[]
  pending: Migration[]
  total: number
}> {
  const runner = new MigrationRunner({ adapter, migrations })
  const applied = await (runner as any).getAppliedMigrations()
  const appliedVersions = new Set(applied.map((m: MigrationHistoryEntry) => m.version))
  const pending = migrations.filter((m) => !appliedVersions.has(m.version))

  return {
    applied,
    pending,
    total: migrations.length
  }
}

/**
 * Validate migrations for conflicts
 */
export function validateMigrations(migrations: Migration[]): void {
  const versions = new Set<number>()

  for (const migration of migrations) {
    if (versions.has(migration.version)) {
      throw new Error(`Duplicate migration version: ${migration.version}`)
    }
    versions.add(migration.version)

    if (migration.version < 1) {
      throw new Error(`Invalid migration version: ${migration.version}`)
    }

    if (!migration.description) {
      throw new Error(`Migration ${migration.version} missing description`)
    }
  }
}
