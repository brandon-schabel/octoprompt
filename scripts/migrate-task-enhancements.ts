#!/usr/bin/env bun
import { DatabaseManager } from '@promptliano/storage'

async function migrateTaskEnhancements() {
  console.log('Starting task enhancement migration...')

  const dbManager = DatabaseManager.getInstance()
  const db = dbManager.getDatabase()

  try {
    // Begin transaction
    db.exec('BEGIN TRANSACTION')

    // Add indexes for new task fields
    const newIndexes = [
      {
        name: 'idx_ticket_tasks_description',
        sql: `CREATE INDEX IF NOT EXISTS idx_ticket_tasks_description ON ticket_tasks (JSON_EXTRACT(data, '$.description'))`
      },
      {
        name: 'idx_ticket_tasks_estimatedHours',
        sql: `CREATE INDEX IF NOT EXISTS idx_ticket_tasks_estimatedHours ON ticket_tasks (JSON_EXTRACT(data, '$.estimatedHours'))`
      },
      {
        name: 'idx_ticket_tasks_tags',
        sql: `CREATE INDEX IF NOT EXISTS idx_ticket_tasks_tags ON ticket_tasks (JSON_EXTRACT(data, '$.tags'))`
      }
    ]
    for (const index of newIndexes) {
      console.log(`Creating index: ${index.name}`)
      db.exec(index.sql)
    }
    // Update existing tasks to have default values for new fields
    const updateSql = `
      UPDATE ticket_tasks 
      SET data = JSON_PATCH(data, 
        JSON_OBJECT(
          'description', COALESCE(JSON_EXTRACT(data, '$.description'), ''),
          'suggestedFileIds', COALESCE(JSON_EXTRACT(data, '$.suggestedFileIds'), JSON('[]')),
          'estimatedHours', JSON_EXTRACT(data, '$.estimatedHours'),
          'dependencies', COALESCE(JSON_EXTRACT(data, '$.dependencies'), JSON('[]')),
          'tags', COALESCE(JSON_EXTRACT(data, '$.tags'), JSON('[]'))
        )
      )
      WHERE JSON_EXTRACT(data, '$.description') IS NULL
         OR JSON_EXTRACT(data, '$.suggestedFileIds') IS NULL
         OR JSON_EXTRACT(data, '$.dependencies') IS NULL
         OR JSON_EXTRACT(data, '$.tags') IS NULL
    `

    console.log('Updating existing tasks with default values...')
    const result = db.prepare(updateSql).run()
    console.log(`Updated ${result.changes} tasks`)

    // Commit transaction
    db.exec('COMMIT')

    console.log('Migration completed successfully!')

    // Verify the migration
    const taskCount = db.prepare('SELECT COUNT(*) as count FROM ticket_tasks').get() as { count: number }
    console.log(`Total tasks in database: ${taskCount.count}`)

    // Check a sample task
    const sampleTask = db.prepare('SELECT * FROM ticket_tasks LIMIT 1').get() as any
    if (sampleTask) {
      const taskData = JSON.parse(sampleTask.data)
      console.log('Sample task structure:', {
        hasDescription: 'description' in taskData,
        hasSuggestedFileIds: 'suggestedFileIds' in taskData,
        hasEstimatedHours: 'estimatedHours' in taskData,
        hasDependencies: 'dependencies' in taskData,
        hasTags: 'tags' in taskData
      })
    }
  } catch (error) {
    console.error('Migration failed:', error)
    db.exec('ROLLBACK')
    process.exit(1)
  }
}

// Run migration
migrateTaskEnhancements()
