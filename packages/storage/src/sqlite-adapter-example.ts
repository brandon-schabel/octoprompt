import { SQLiteAdapter } from './sqlite-adapter'
import { SQLiteDbManagerAdapter } from './sqlite-db-manager-adapter'
import { StorageV2 } from './storage-v2'
import { z } from 'zod'

// Example: Using SQLiteAdapter with StorageV2

// 1. Define your schema
const UserSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  name: z.string(),
  role: z.enum(['admin', 'user', 'guest']),
  preferences: z
    .object({
      theme: z.enum(['light', 'dark']),
      notifications: z.boolean()
    })
    .optional(),
  created: z.number(),
  updated: z.number()
})

type User = z.infer<typeof UserSchema>

// 2. Create SQLite adapter
const adapter = new SQLiteAdapter<User>({
  tableName: 'users',
  dbPath: 'data/app.db' // Or use existing db instance
})

// 3. Create StorageV2 instance with SQLite adapter
const userStorage = new StorageV2<User>({
  adapter,
  schema: UserSchema,
  indexes: [
    { field: 'email', type: 'hash' }, // Fast email lookups
    { field: 'role', type: 'hash' }, // Filter by role
    { field: 'created', type: 'btree' } // Range queries by date
  ],
  cache: {
    maxSize: 100,
    ttl: 300000 // 5 minutes
  }
})

// 4. Usage examples
async function examples() {
  // Create a new user
  const newUser = await userStorage.create({
    email: 'john@example.com',
    name: 'John Doe',
    role: 'user',
    preferences: {
      theme: 'dark',
      notifications: true
    }
  })
  console.log('Created user:', newUser)

  // Find user by email (using hash index)
  const usersByEmail = await userStorage.findBy('email', 'john@example.com')
  console.log('Found by email:', usersByEmail)

  // Find all admin users
  const admins = await userStorage.findBy('role', 'admin')
  console.log('Admin users:', admins)

  // Find users created in the last 24 hours
  const yesterday = Date.now() - 24 * 60 * 60 * 1000
  const recentUsers = await userStorage.findByRange('created', yesterday, Date.now())
  console.log('Recent users:', recentUsers)

  // Update user
  const updated = await userStorage.update(newUser.id, {
    name: 'John Smith',
    preferences: {
      theme: 'light',
      notifications: false
    }
  })
  console.log('Updated user:', updated)

  // Batch operations with SQLite adapter directly
  const batchUsers = [
    { id: 100, data: { ...newUser, id: 100, email: 'user1@example.com' } },
    { id: 101, data: { ...newUser, id: 101, email: 'user2@example.com' } },
    { id: 102, data: { ...newUser, id: 102, email: 'user3@example.com' } }
  ]
  await adapter.writeBatch(batchUsers)
  console.log('Batch write completed')

  // Get statistics
  const stats = await adapter.getStats()
  console.log('Storage stats:', stats)

  // Clean up
  adapter.close()
}

// Example with DatabaseManager adapter (uses existing database structure)
async function dbManagerExample() {
  // This adapter integrates with the existing DatabaseManager
  const adapter = new SQLiteDbManagerAdapter<User>('users')

  const userStorage = new StorageV2<User>({
    adapter,
    schema: UserSchema,
    indexes: [
      { field: 'email', type: 'hash' },
      { field: 'role', type: 'hash' }
    ],
    cache: {
      maxSize: 50,
      ttl: 60000 // 1 minute
    }
  })

  // Usage is the same as with SQLiteAdapter
  const user = await userStorage.create({
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'admin'
  })

  console.log('Created user with DbManager adapter:', user)

  // Can also use DatabaseManager-specific features
  const adminUsers = await adapter.findByJsonField('$.role', 'admin')
  console.log('Admin users via JSON query:', adminUsers)
}

// Run examples
if (import.meta.main) {
  console.log('=== SQLiteAdapter Example ===')
  await examples().catch(console.error)

  console.log('\n=== SQLiteDbManagerAdapter Example ===')
  await dbManagerExample().catch(console.error)
}
