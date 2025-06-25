/**
 * Example usage of migration utilities
 *
 * This file demonstrates how to use the migration system with StorageV2
 */

import { StorageV2, FileAdapter } from '../storage-v2'
import { z } from 'zod'
import {
  createMigration,
  createAddFieldMigration,
  createRenameFieldMigration,
  createTransformMigration,
  runMigrations,
  type Migration
} from './index'

// Define your schema versions
const userSchemaV1 = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string(),
  created: z.number(),
  updated: z.number()
})

const userSchemaV2 = z.object({
  id: z.number(),
  name: z.string(), // renamed from username
  email: z.string(),
  role: z.string(), // new field
  isActive: z.boolean(), // new field
  created: z.number(),
  updated: z.number()
})

// Define migrations
const migrations: Migration[] = [
  // Migration 1: Rename username to name
  createRenameFieldMigration(1, 'Rename username field to name', 'username', 'name'),

  // Migration 2: Add role field with default value
  createAddFieldMigration(2, 'Add role field with default user role', 'role', 'user'),

  // Migration 3: Add isActive field based on created date
  createTransformMigration(3, 'Add isActive field based on account age', (record) => ({
    ...record,
    isActive: Date.now() - record.created < 90 * 24 * 60 * 60 * 1000 // Active if created within 90 days
  })),

  // Migration 4: Custom migration for complex logic
  createMigration(4, 'Assign admin role to early users', async (adapter) => {
    const all = await adapter.readAll()
    const sortedUsers = Array.from(all.entries())
      .sort(([, a], [, b]) => a.created - b.created)
      .slice(0, 10) // First 10 users

    for (const [id, user] of sortedUsers) {
      await adapter.write(id, { ...user, role: 'admin' })
    }
  }),

  // Migration 5: Example with down migration for rollback
  createMigration(
    5,
    'Add premium field',
    async (adapter) => {
      const all = await adapter.readAll()
      for (const [id, user] of all) {
        await adapter.write(id, { ...user, premium: false })
      }
    },
    // Down migration to remove the field
    async (adapter) => {
      const all = await adapter.readAll()
      for (const [id, user] of all) {
        const { premium, ...rest } = user
        await adapter.write(id, rest)
      }
    }
  )
]

// Example: Setting up storage with migrations
export async function setupUserStorage() {
  // Create adapter
  const adapter = new FileAdapter<any>('users', 'data')

  // Run migrations before initializing storage
  await runMigrations({
    adapter,
    migrations,
    logger: (message) => console.log(`[Migration] ${message}`)
  })

  // Now create storage with the latest schema
  const storage = new StorageV2({
    adapter,
    schema: userSchemaV2,
    indexes: [
      { field: 'id', type: 'hash' },
      { field: 'email', type: 'hash' },
      { field: 'role', type: 'hash' },
      { field: 'created', type: 'btree' }
    ],
    cache: {
      maxSize: 100,
      ttl: 5 * 60 * 1000 // 5 minutes
    }
  })

  return storage
}

// Example: Running migrations programmatically
export async function migrateUserData() {
  const adapter = new FileAdapter<any>('users', 'data')

  try {
    await runMigrations({
      adapter,
      migrations,
      useTransaction: true, // Use transactions for safety
      logger: console.log
    })

    console.log('User data migration completed successfully')
  } catch (error) {
    console.error('Migration failed:', error)
    throw error
  }
}

// Example: Checking migration status
export async function checkMigrationStatus() {
  const { getMigrationStatus } = await import('./index')
  const adapter = new FileAdapter<any>('users', 'data')

  const status = await getMigrationStatus(adapter, migrations)

  console.log(`Total migrations: ${status.total}`)
  console.log(`Applied migrations: ${status.applied.length}`)
  console.log(`Pending migrations: ${status.pending.length}`)

  if (status.pending.length > 0) {
    console.log('\nPending migrations:')
    for (const migration of status.pending) {
      console.log(`  - ${migration.version}: ${migration.description}`)
    }
  }

  return status
}

// Example: Creating a migration script
if (import.meta.main) {
  // This runs when the file is executed directly
  console.log('Running user data migrations...')

  migrateUserData()
    .then(() => checkMigrationStatus())
    .then((status) => {
      console.log('\nMigration complete!')
      console.log(`Successfully applied ${status.applied.length} migrations`)
    })
    .catch((error) => {
      console.error('Migration failed:', error)
      process.exit(1)
    })
}
