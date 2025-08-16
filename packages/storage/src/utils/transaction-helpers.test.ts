import { describe, test, expect, beforeEach, afterAll } from 'bun:test'
import { Database } from 'bun:sqlite'
import { 
  withTransaction,
  replaceEntities,
  batchInsert,
  batchUpdate,
  batchDelete,
  multiTransaction
} from './transaction-helpers'

describe('transaction-helpers', () => {
  let db: Database

  beforeEach(() => {
    // Create in-memory database for testing
    db = new Database(':memory:')
    
    // Create test table
    db.exec(`
      CREATE TABLE test_entities (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        value INTEGER DEFAULT 0,
        active INTEGER DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)
  })

  afterAll(() => {
    if (db) {
      db.close()
    }
  })

  describe('withTransaction', () => {
    test('executes operations in a transaction', () => {
      const result = withTransaction(db, (database) => {
        const insert = database.prepare('INSERT INTO test_entities (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
        insert.run(1, 'Test 1', Date.now(), Date.now())
        insert.run(2, 'Test 2', Date.now(), Date.now())
        return 'success'
      })

      expect(result).toBe('success')
      
      const count = db.prepare('SELECT COUNT(*) as count FROM test_entities').get() as any
      expect(count.count).toBe(2)
    })

    test('rolls back on error', () => {
      // Insert initial data
      db.prepare('INSERT INTO test_entities (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(1, 'Initial', Date.now(), Date.now())

      try {
        withTransaction(db, (database) => {
          const insert = database.prepare('INSERT INTO test_entities (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
          insert.run(2, 'Should rollback', Date.now(), Date.now())
          
          // This should cause an error (duplicate primary key)
          insert.run(1, 'Duplicate', Date.now(), Date.now())
        })
      } catch (error) {
        // Expected error
      }

      // Check that transaction was rolled back
      const count = db.prepare('SELECT COUNT(*) as count FROM test_entities').get() as any
      expect(count.count).toBe(1) // Only initial record should exist
      
      const record = db.prepare('SELECT name FROM test_entities WHERE id = 2').get() as any
      expect(record).toBeUndefined() // Second insert should have been rolled back
    })

    test('returns value from transaction', () => {
      const result = withTransaction(db, (database) => {
        const insert = database.prepare('INSERT INTO test_entities (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
        insert.run(1, 'Test', Date.now(), Date.now())
        
        const query = database.prepare('SELECT name FROM test_entities WHERE id = ?')
        const row = query.get(1) as any
        return row.name
      })

      expect(result).toBe('Test')
    })
  })

  describe('replaceEntities', () => {
    test('replaces all entities matching condition', () => {
      const now = Date.now()
      
      // Insert initial data
      db.prepare('INSERT INTO test_entities (id, name, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(1, 'Old 1', 10, now, now)
      db.prepare('INSERT INTO test_entities (id, name, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(2, 'Old 2', 20, now, now)
      db.prepare('INSERT INTO test_entities (id, name, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(3, 'Keep', 30, now, now)

      const newEntities = [
        { id: 4, name: 'New 1', value: 40, active: 1, created_at: now, updated_at: now },
        { id: 5, name: 'New 2', value: 50, active: 1, created_at: now, updated_at: now }
      ]

      replaceEntities(
        db,
        'test_entities',
        newEntities,
        ['id', 'name', 'value', 'active', 'created_at', 'updated_at'],
        'value < ?',
        [30]
      )

      const all = db.prepare('SELECT * FROM test_entities ORDER BY id').all() as any[]
      expect(all.length).toBe(3)
      expect(all[0].id).toBe(3) // Keep record
      expect(all[1].id).toBe(4) // New 1
      expect(all[2].id).toBe(5) // New 2
    })

    test('handles empty replacement', () => {
      const now = Date.now()
      
      // Insert initial data
      db.prepare('INSERT INTO test_entities (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(1, 'Delete me', now, now)

      replaceEntities(
        db,
        'test_entities',
        [],
        ['id', 'name', 'created_at', 'updated_at'],
        'id = ?',
        [1]
      )

      const count = db.prepare('SELECT COUNT(*) as count FROM test_entities').get() as any
      expect(count.count).toBe(0)
    })

    test('replaces all when no condition', () => {
      const now = Date.now()
      
      // Insert initial data
      db.prepare('INSERT INTO test_entities (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(1, 'Old', now, now)

      const newEntities = [
        { id: 2, name: 'New', value: 0, active: 1, created_at: now, updated_at: now }
      ]

      replaceEntities(
        db,
        'test_entities',
        newEntities,
        ['id', 'name', 'value', 'active', 'created_at', 'updated_at']
      )

      const all = db.prepare('SELECT * FROM test_entities').all() as any[]
      expect(all.length).toBe(1)
      expect(all[0].id).toBe(2)
      expect(all[0].name).toBe('New')
    })
  })

  describe('batchInsert', () => {
    test('inserts multiple entities', () => {
      const now = Date.now()
      const entities = [
        { id: 1, name: 'Entity 1', value: 10, active: 1, created_at: now, updated_at: now },
        { id: 2, name: 'Entity 2', value: 20, active: 0, created_at: now, updated_at: now },
        { id: 3, name: 'Entity 3', value: 30, active: 1, created_at: now, updated_at: now }
      ]

      const count = batchInsert(
        db,
        'test_entities',
        entities,
        ['id', 'name', 'value', 'active', 'created_at', 'updated_at']
      )

      expect(count).toBe(3)

      const all = db.prepare('SELECT * FROM test_entities ORDER BY id').all() as any[]
      expect(all.length).toBe(3)
      expect(all[0].name).toBe('Entity 1')
      expect(all[1].value).toBe(20)
      expect(all[2].active).toBe(1)
    })

    test('handles empty array', () => {
      const count = batchInsert(db, 'test_entities', [], ['id', 'name'])
      expect(count).toBe(0)

      const all = db.prepare('SELECT * FROM test_entities').all()
      expect(all.length).toBe(0)
    })

    test('handles batch size option', () => {
      const now = Date.now()
      const entities = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        name: `Entity ${i + 1}`,
        value: i * 10,
        active: 1,
        created_at: now,
        updated_at: now
      }))

      const count = batchInsert(
        db,
        'test_entities',
        entities,
        ['id', 'name', 'value', 'active', 'created_at', 'updated_at'],
        { batchSize: 25 }
      )

      expect(count).toBe(100)

      const result = db.prepare('SELECT COUNT(*) as count FROM test_entities').get() as any
      expect(result.count).toBe(100)
    })
  })

  describe('batchUpdate', () => {
    test('updates multiple entities', () => {
      const now = Date.now()
      
      // Insert initial data
      db.prepare('INSERT INTO test_entities (id, name, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(1, 'Old 1', 10, now, now)
      db.prepare('INSERT INTO test_entities (id, name, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(2, 'Old 2', 20, now, now)
      db.prepare('INSERT INTO test_entities (id, name, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(3, 'Old 3', 30, now, now)

      const updates = [
        { id: 1, name: 'Updated 1', value: 100 },
        { id: 2, name: 'Updated 2', value: 200 },
        { id: 3, name: 'Updated 3', value: 300 }
      ]

      const count = batchUpdate(
        db,
        'test_entities',
        updates,
        ['name', 'value'],
        'id'
      )

      expect(count).toBe(3)

      const all = db.prepare('SELECT * FROM test_entities ORDER BY id').all() as any[]
      expect(all[0].name).toBe('Updated 1')
      expect(all[0].value).toBe(100)
      expect(all[1].name).toBe('Updated 2')
      expect(all[1].value).toBe(200)
      expect(all[2].name).toBe('Updated 3')
      expect(all[2].value).toBe(300)
    })

    test('updates with custom key field', () => {
      const now = Date.now()
      
      // Insert initial data
      db.prepare('INSERT INTO test_entities (id, name, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(1, 'Entity A', 10, now, now)
      db.prepare('INSERT INTO test_entities (id, name, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(2, 'Entity B', 20, now, now)

      const updates = [
        { name: 'Entity A', value: 111 },
        { name: 'Entity B', value: 222 }
      ]

      const count = batchUpdate(
        db,
        'test_entities',
        updates,
        ['value'],
        'name'
      )

      expect(count).toBe(2)

      const entityA = db.prepare('SELECT * FROM test_entities WHERE name = ?').get('Entity A') as any
      expect(entityA.value).toBe(111)

      const entityB = db.prepare('SELECT * FROM test_entities WHERE name = ?').get('Entity B') as any
      expect(entityB.value).toBe(222)
    })
  })

  describe('batchDelete', () => {
    test('deletes multiple entities by id', () => {
      const now = Date.now()
      
      // Insert initial data
      db.prepare('INSERT INTO test_entities (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(1, 'Delete 1', now, now)
      db.prepare('INSERT INTO test_entities (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(2, 'Keep', now, now)
      db.prepare('INSERT INTO test_entities (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(3, 'Delete 2', now, now)
      db.prepare('INSERT INTO test_entities (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(4, 'Delete 3', now, now)

      const count = batchDelete(db, 'test_entities', [1, 3, 4])

      expect(count).toBe(3)

      const remaining = db.prepare('SELECT * FROM test_entities').all() as any[]
      expect(remaining.length).toBe(1)
      expect(remaining[0].id).toBe(2)
      expect(remaining[0].name).toBe('Keep')
    })

    test('handles empty array', () => {
      const now = Date.now()
      db.prepare('INSERT INTO test_entities (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(1, 'Keep', now, now)

      const count = batchDelete(db, 'test_entities', [])

      expect(count).toBe(0)

      const all = db.prepare('SELECT * FROM test_entities').all()
      expect(all.length).toBe(1)
    })

    test('deletes with custom key field', () => {
      const now = Date.now()
      
      // Insert initial data
      db.prepare('INSERT INTO test_entities (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(1, 'Alpha', now, now)
      db.prepare('INSERT INTO test_entities (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(2, 'Beta', now, now)
      db.prepare('INSERT INTO test_entities (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(3, 'Gamma', now, now)

      const count = batchDelete(db, 'test_entities', ['Alpha', 'Gamma'], 'name')

      expect(count).toBe(2)

      const remaining = db.prepare('SELECT * FROM test_entities').all() as any[]
      expect(remaining.length).toBe(1)
      expect(remaining[0].name).toBe('Beta')
    })
  })

  describe('executeInTransaction', () => {
    test('executes multiple operations atomically', () => {
      const now = Date.now()

      const operations = [
        (database: Database) => {
          database.prepare('INSERT INTO test_entities (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(1, 'Op 1', now, now)
        },
        (database: Database) => {
          database.prepare('INSERT INTO test_entities (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(2, 'Op 2', now, now)
        },
        (database: Database) => {
          database.prepare('UPDATE test_entities SET value = ? WHERE id = ?').run(100, 1)
        }
      ]

      multiTransaction(db, operations)

      const all = db.prepare('SELECT * FROM test_entities ORDER BY id').all() as any[]
      expect(all.length).toBe(2)
      expect(all[0].value).toBe(100)
      expect(all[1].name).toBe('Op 2')
    })

    test('rolls back all operations on error', () => {
      const now = Date.now()
      
      // Insert initial data
      db.prepare('INSERT INTO test_entities (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(1, 'Initial', now, now)

      const operations = [
        (database: Database) => {
          database.prepare('INSERT INTO test_entities (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(2, 'Should rollback', now, now)
        },
        (database: Database) => {
          // This will fail - duplicate primary key
          database.prepare('INSERT INTO test_entities (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(1, 'Duplicate', now, now)
        }
      ]

      try {
        multiTransaction(db, operations)
      } catch (error) {
        // Expected error
      }

      const all = db.prepare('SELECT * FROM test_entities').all() as any[]
      expect(all.length).toBe(1) // Only initial record
      expect(all[0].name).toBe('Initial')
    })
  })
})