import { Database } from 'bun:sqlite'
import { DatabaseManager } from './packages/storage/src/database-manager'

const db = DatabaseManager.getInstance().getDatabase()

// Check indexes
const indexes = db
  .prepare("SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'queue_items'")
  .all()
console.log('Indexes on queue_items:')
indexes.forEach((idx: any) => {
  console.log(`  ${idx.name}: ${idx.sql}`)
})

// Create test data
const testQueueId = 999
try {
  // Create test queue
  db.prepare(
    'INSERT INTO task_queues (id, project_id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(testQueueId, 1754713756748, 'Priority Test Queue', 'active', Date.now(), Date.now())

  // Insert items with different priorities
  const priorities = [10, 1, 5, 3, 8]
  priorities.forEach((priority, i) => {
    db.prepare(
      `
      INSERT INTO queue_items (queue_id, task_id, status, priority, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `
    ).run(testQueueId, 100000 + i, 'queued', priority, Date.now() + i, Date.now() + i)
  })

  // Query items back
  const items = db
    .prepare(
      `
    SELECT id, priority, created_at
    FROM queue_items
    WHERE queue_id = ? AND status = 'queued'
    ORDER BY position ASC, priority ASC, created_at ASC
  `
    )
    .all(testQueueId)

  console.log('\nItems in priority order:')
  items.forEach((item: any) => {
    console.log(`  ID: ${item.id}, Priority: ${item.priority}`)
  })

  // Clean up
  db.prepare('DELETE FROM queue_items WHERE queue_id = ?').run(testQueueId)
  db.prepare('DELETE FROM task_queues WHERE id = ?').run(testQueueId)
} catch (error) {
  console.error('Error:', error)
  // Clean up on error
  try {
    db.prepare('DELETE FROM queue_items WHERE queue_id = ?').run(testQueueId)
    db.prepare('DELETE FROM task_queues WHERE id = ?').run(testQueueId)
  } catch {}
}
