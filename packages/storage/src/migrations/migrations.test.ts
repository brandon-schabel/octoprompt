import { describe, test, expect, beforeEach } from 'bun:test'
import { MemoryAdapter } from '../storage-v2'
import {
  createMigration,
  runMigrations,
  createAddFieldMigration,
  createRenameFieldMigration,
  createTransformMigration,
  createFilterMigration,
  getMigrationStatus,
  validateMigrations,
  type Migration,
} from './index'

describe('Migration Utilities', () => {
  let adapter: MemoryAdapter<any>

  beforeEach(() => {
    adapter = new MemoryAdapter()
  })

  describe('createMigration', () => {
    test('creates a migration with function', () => {
      const migration = createMigration(
        1,
        'Add user field',
        async (adapter) => {
          const all = await adapter.readAll()
          for (const [id, record] of all) {
            await adapter.write(id, { ...record, user: 'default' })
          }
        }
      )

      expect(migration.version).toBe(1)
      expect(migration.description).toBe('Add user field')
      expect(typeof migration.up).toBe('function')
    })

    test('creates a migration with down function', () => {
      const migration = createMigration(
        1,
        'Add field',
        async () => {},
        async () => {}
      )

      expect(migration.down).toBeDefined()
    })
  })

  describe('runMigrations', () => {
    test('runs migrations in order', async () => {
      // Add test data
      await adapter.write(1, { name: 'Test 1' })
      await adapter.write(2, { name: 'Test 2' })

      const migrations: Migration[] = [
        createAddFieldMigration(1, 'Add status field', 'status', 'active'),
        createAddFieldMigration(2, 'Add created field', 'created', Date.now()),
      ]

      await runMigrations({
        adapter,
        migrations,
      })

      const item1 = await adapter.read(1)
      const item2 = await adapter.read(2)

      expect(item1).toHaveProperty('status', 'active')
      expect(item1).toHaveProperty('created')
      expect(item2).toHaveProperty('status', 'active')
      expect(item2).toHaveProperty('created')
    })

    test('tracks applied migrations', async () => {
      const migrations: Migration[] = [
        createMigration(1, 'First migration', async () => {}),
        createMigration(2, 'Second migration', async () => {}),
      ]

      await runMigrations({ adapter, migrations })

      // Check migration history
      const history1 = await adapter.read('_migration_1')
      const history2 = await adapter.read('_migration_2')

      expect(history1).toMatchObject({
        version: 1,
        description: 'First migration',
      })
      expect(history2).toMatchObject({
        version: 2,
        description: 'Second migration',
      })
    })

    test('skips already applied migrations', async () => {
      let runCount = 0
      const migration = createMigration(1, 'Count runs', async () => {
        runCount++
      })

      await runMigrations({ adapter, migrations: [migration] })
      expect(runCount).toBe(1)

      await runMigrations({ adapter, migrations: [migration] })
      expect(runCount).toBe(1) // Should not run again
    })

    test('logs migration progress', async () => {
      const logs: string[] = []
      const logger = (message: string) => logs.push(message)

      const migrations: Migration[] = [
        createMigration(1, 'Test migration', async () => {}),
      ]

      await runMigrations({ adapter, migrations, logger })

      expect(logs).toContain('Starting migration runner...')
      expect(logs).toContain('Found 1 pending migrations')
      expect(logs).toContain('Running migration 1: Test migration')
      expect(logs).toContain('All migrations completed successfully')
    })
  })

  describe('createAddFieldMigration', () => {
    test('adds field to all records', async () => {
      await adapter.write(1, { name: 'User 1' })
      await adapter.write(2, { name: 'User 2' })

      const migration = createAddFieldMigration(1, 'Add role field', 'role', 'user')

      await runMigrations({ adapter, migrations: [migration] })

      const user1 = await adapter.read(1)
      const user2 = await adapter.read(2)

      expect(user1).toEqual({ name: 'User 1', role: 'user' })
      expect(user2).toEqual({ name: 'User 2', role: 'user' })
    })

    test('does not overwrite existing fields', async () => {
      await adapter.write(1, { name: 'User 1', role: 'admin' })
      await adapter.write(2, { name: 'User 2' })

      const migration = createAddFieldMigration(1, 'Add role field', 'role', 'user')

      await runMigrations({ adapter, migrations: [migration] })

      const user1 = await adapter.read(1)
      const user2 = await adapter.read(2)

      expect(user1.role).toBe('admin') // Should keep existing value
      expect(user2.role).toBe('user')
    })
  })

  describe('createRenameFieldMigration', () => {
    test('renames field in all records', async () => {
      await adapter.write(1, { username: 'user1', email: 'user1@test.com' })
      await adapter.write(2, { username: 'user2', email: 'user2@test.com' })

      const migration = createRenameFieldMigration(1, 'Rename username to name', 'username', 'name')

      await runMigrations({ adapter, migrations: [migration] })

      const user1 = await adapter.read(1)
      const user2 = await adapter.read(2)

      expect(user1).toEqual({ name: 'user1', email: 'user1@test.com' })
      expect(user2).toEqual({ name: 'user2', email: 'user2@test.com' })
      expect(user1).not.toHaveProperty('username')
      expect(user2).not.toHaveProperty('username')
    })
  })

  describe('createTransformMigration', () => {
    test('transforms data in all records', async () => {
      await adapter.write(1, { name: 'john doe', age: 25 })
      await adapter.write(2, { name: 'jane smith', age: 30 })

      const migration = createTransformMigration(
        1,
        'Capitalize names',
        (record) => ({
          ...record,
          name: record.name.split(' ').map((word: string) => 
            word.charAt(0).toUpperCase() + word.slice(1)
          ).join(' ')
        })
      )

      await runMigrations({ adapter, migrations: [migration] })

      const user1 = await adapter.read(1)
      const user2 = await adapter.read(2)

      expect(user1.name).toBe('John Doe')
      expect(user2.name).toBe('Jane Smith')
    })
  })

  describe('createFilterMigration', () => {
    test('filters out records based on predicate', async () => {
      await adapter.write(1, { name: 'Active User', status: 'active' })
      await adapter.write(2, { name: 'Deleted User', status: 'deleted' })
      await adapter.write(3, { name: 'Another Active', status: 'active' })

      const migration = createFilterMigration(
        1,
        'Remove deleted users',
        (record) => record.status !== 'deleted'
      )

      await runMigrations({ adapter, migrations: [migration] })

      const all = await adapter.readAll()
      // Should have 2 regular records + 1 migration history + 1 deleted records backup
      const regularRecords = Array.from(all.entries()).filter(([key]) => 
        !String(key).startsWith('_migration_') && !String(key).startsWith('_deleted_by_migration_')
      )
      expect(regularRecords.length).toBe(2)
      expect(await adapter.exists(2)).toBe(false)
    })

    test('stores deleted records for rollback', async () => {
      await adapter.write(1, { name: 'Keep', keep: true })
      await adapter.write(2, { name: 'Delete', keep: false })

      const migration = createFilterMigration(
        1,
        'Filter records',
        (record) => record.keep
      )

      await runMigrations({ adapter, migrations: [migration] })

      // Check that deleted records are stored
      const deletedRecords = await adapter.read('_deleted_by_migration_1')
      expect(deletedRecords).toBeDefined()
      expect(deletedRecords).toHaveLength(1)
      expect(deletedRecords[0]).toEqual([2, { name: 'Delete', keep: false }])
    })
  })

  describe('getMigrationStatus', () => {
    test('returns migration status', async () => {
      const migrations: Migration[] = [
        createMigration(1, 'First', async () => {}),
        createMigration(2, 'Second', async () => {}),
        createMigration(3, 'Third', async () => {}),
      ]

      // Run only first two migrations
      await runMigrations({ adapter, migrations: migrations.slice(0, 2) })

      const status = await getMigrationStatus(adapter, migrations)

      expect(status.total).toBe(3)
      expect(status.applied).toHaveLength(2)
      expect(status.pending).toHaveLength(1)
      expect(status.pending[0].version).toBe(3)
    })
  })

  describe('validateMigrations', () => {
    test('validates unique versions', () => {
      const migrations: Migration[] = [
        createMigration(1, 'First', async () => {}),
        createMigration(1, 'Duplicate', async () => {}),
      ]

      expect(() => validateMigrations(migrations)).toThrow('Duplicate migration version: 1')
    })

    test('validates version numbers', () => {
      const migrations: Migration[] = [
        createMigration(0, 'Invalid', async () => {}),
      ]

      expect(() => validateMigrations(migrations)).toThrow('Invalid migration version: 0')
    })

    test('validates descriptions', () => {
      const migrations: Migration[] = [
        createMigration(1, '', async () => {}),
      ]

      expect(() => validateMigrations(migrations)).toThrow('Migration 1 missing description')
    })

    test('passes valid migrations', () => {
      const migrations: Migration[] = [
        createMigration(1, 'First', async () => {}),
        createMigration(2, 'Second', async () => {}),
        createMigration(3, 'Third', async () => {}),
      ]

      expect(() => validateMigrations(migrations)).not.toThrow()
    })
  })

  describe('Migration with transactions', () => {
    test('rolls back on error', async () => {
      await adapter.write(1, { value: 'original' })

      const migrations: Migration[] = [
        createMigration(1, 'Failing migration', async (adapter) => {
          await adapter.write(1, { value: 'modified' })
          throw new Error('Migration failed')
        }),
      ]

      await expect(
        runMigrations({ adapter, migrations, useTransaction: true })
      ).rejects.toThrow('Migration 1 failed: Error: Migration failed')

      // Check that data was rolled back
      const item = await adapter.read(1)
      expect(item.value).toBe('original')
    })
  })
})