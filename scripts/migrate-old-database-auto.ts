#!/usr/bin/env bun
/**
 * Automatic migration script (no prompts) to transfer data from old JSON-based database to new column-based database
 * 
 * Usage: bun run scripts/migrate-old-database-auto.ts
 * 
 * This script migrates:
 * - projects
 * - project_files  
 * - prompts
 */

import { Database } from 'bun:sqlite'
import { z } from 'zod'
import path from 'node:path'
import fs from 'node:fs'

// Database paths
const OLD_DB_PATH = '/Users/brandon/Library/Application Support/Promptliano/promptliano-old.db'
const NEW_DB_PATH = '/Users/brandon/Library/Application Support/Promptliano/promptliano.db'

// Schemas for validation
const ProjectSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().optional().default(''),
  path: z.string(),
  created: z.number().optional(),
  updated: z.number().optional()
})

const PromptSchema = z.object({
  id: z.number(),
  name: z.string(),
  content: z.string(),
  projectId: z.number().optional().nullable(),
  created: z.number().optional(),
  updated: z.number().optional()
})

const ProjectFileSchema = z.object({
  id: z.union([z.string(), z.number()]),
  projectId: z.number(),
  name: z.string(),
  path: z.string(),
  extension: z.string().optional().default(''),
  size: z.number().optional().default(0),
  content: z.string().optional().nullable(),
  summary: z.string().optional().nullable(),
  summaryLastUpdated: z.number().optional().nullable(),
  meta: z.any().optional(),
  checksum: z.string().optional().nullable(),
  imports: z.array(z.any()).optional().default([]), // Allow any type, we'll convert to strings
  exports: z.array(z.any()).optional().default([]), // Allow any type, we'll convert to strings
  created: z.number().optional(),
  updated: z.number().optional()
})

// Helper to safely parse JSON
function safeJsonParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback
  try {
    return JSON.parse(json)
  } catch (error) {
    console.warn('Failed to parse JSON:', json, error)
    return fallback
  }
}

// Helper to convert imports/exports to string array
function convertToStringArray(arr: any[]): string[] {
  return arr.map(item => {
    if (typeof item === 'string') return item
    if (typeof item === 'object' && item !== null) {
      // If it's an object with a name or path property, use that
      return item.name || item.path || JSON.stringify(item)
    }
    return String(item)
  })
}

// Migration class
class DatabaseMigrator {
  private oldDb: Database
  private newDb: Database
  private stats = {
    projects: { total: 0, migrated: 0, failed: 0 },
    prompts: { total: 0, migrated: 0, failed: 0 },
    projectFiles: { total: 0, migrated: 0, failed: 0 }
  }

  constructor() {
    // Check if old database exists
    if (!fs.existsSync(OLD_DB_PATH)) {
      throw new Error(`Old database not found at: ${OLD_DB_PATH}`)
    }

    // Open databases
    console.log('Opening databases...')
    this.oldDb = new Database(OLD_DB_PATH, { readonly: true })
    this.newDb = new Database(NEW_DB_PATH)
    
    // Enable foreign keys in new database
    this.newDb.exec('PRAGMA foreign_keys = ON')
  }

  async migrate() {
    console.log('Starting migration...\n')

    try {
      // Wrap entire migration in a transaction for safety
      this.newDb.transaction(() => {
        // Migrate in order due to foreign key constraints
        this.migrateProjects()
        this.migratePrompts()
        this.migrateProjectFiles()
      })()

      console.log('\n=== Migration Summary ===')
      console.log(`Projects: ${this.stats.projects.migrated}/${this.stats.projects.total} migrated (${this.stats.projects.failed} failed)`)
      console.log(`Prompts: ${this.stats.prompts.migrated}/${this.stats.prompts.total} migrated (${this.stats.prompts.failed} failed)`)
      console.log(`Project Files: ${this.stats.projectFiles.migrated}/${this.stats.projectFiles.total} migrated (${this.stats.projectFiles.failed} failed)`)
      
      console.log('\nMigration completed successfully!')
    } catch (error) {
      console.error('Migration failed:', error)
      throw error
    } finally {
      this.close()
    }
  }

  private migrateProjects() {
    console.log('Migrating projects...')

    // Get all projects from old database
    const oldProjects = this.oldDb.prepare(`
      SELECT id, data, created_at, updated_at 
      FROM projects 
      ORDER BY created_at
    `).all() as Array<{ id: string; data: string; created_at: number; updated_at: number }>

    this.stats.projects.total = oldProjects.length

    // Prepare insert statement for new database
    const insertStmt = this.newDb.prepare(`
      INSERT OR REPLACE INTO projects (id, name, description, path, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    // Migrate each project
    for (const oldProject of oldProjects) {
      try {
        const data = safeJsonParse(oldProject.data, {})
        const validated = ProjectSchema.parse(data)

        insertStmt.run(
          validated.id,
          validated.name,
          validated.description,
          validated.path,
          validated.created || oldProject.created_at,
          validated.updated || oldProject.updated_at
        )

        this.stats.projects.migrated++
        console.log(`  ✓ Migrated project: ${validated.name} (${validated.path})`)
      } catch (error) {
        this.stats.projects.failed++
        console.error(`  ✗ Failed to migrate project ${oldProject.id}:`, error)
      }
    }
  }

  private migratePrompts() {
    console.log('\nMigrating prompts...')

    // Get all prompts from old database
    const oldPrompts = this.oldDb.prepare(`
      SELECT id, data, created_at, updated_at 
      FROM prompts 
      ORDER BY created_at
    `).all() as Array<{ id: string; data: string; created_at: number; updated_at: number }>

    this.stats.prompts.total = oldPrompts.length

    // Get list of valid project IDs
    const validProjectIds = new Set(
      this.newDb.prepare('SELECT id FROM projects').all().map((p: any) => p.id)
    )

    // Prepare insert statement for new database
    const insertStmt = this.newDb.prepare(`
      INSERT OR REPLACE INTO prompts (id, name, content, project_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    // Migrate each prompt
    for (const oldPrompt of oldPrompts) {
      try {
        const data = safeJsonParse(oldPrompt.data, {})
        const validated = PromptSchema.parse(data)

        // Only set project_id if it's valid
        const projectId = validated.projectId && validProjectIds.has(validated.projectId) 
          ? validated.projectId 
          : null

        insertStmt.run(
          validated.id,
          validated.name,
          validated.content,
          projectId,
          validated.created || oldPrompt.created_at,
          validated.updated || oldPrompt.updated_at
        )

        this.stats.prompts.migrated++
        console.log(`  ✓ Migrated prompt: ${validated.name}`)
      } catch (error) {
        this.stats.prompts.failed++
        console.error(`  ✗ Failed to migrate prompt ${oldPrompt.id}:`, error)
      }
    }
  }

  private migrateProjectFiles() {
    console.log('\nMigrating project files...')

    // Get all project files from old database
    const oldFiles = this.oldDb.prepare(`
      SELECT id, data, created_at, updated_at 
      FROM project_files 
      ORDER BY created_at
    `).all() as Array<{ id: string; data: string; created_at: number; updated_at: number }>

    this.stats.projectFiles.total = oldFiles.length

    // Get list of valid project IDs
    const validProjectIds = new Set(
      this.newDb.prepare('SELECT id FROM projects').all().map((p: any) => p.id)
    )

    // Prepare insert statement for new database
    const insertStmt = this.newDb.prepare(`
      INSERT OR REPLACE INTO project_files (
        id, project_id, name, path, extension, size, content, summary,
        summary_last_updated, meta, checksum, imports, exports,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    // Migrate each file
    let fileId = Date.now() // Start with current timestamp for new IDs
    
    for (const oldFile of oldFiles) {
      try {
        const data = safeJsonParse(oldFile.data, {})
        const validated = ProjectFileSchema.parse(data)

        // Skip if project doesn't exist
        if (!validProjectIds.has(validated.projectId)) {
          console.log(`  ⚠ Skipping file ${validated.path} - project ${validated.projectId} not found`)
          this.stats.projectFiles.failed++
          continue
        }

        // Convert string ID to number if needed
        const id = typeof validated.id === 'string' ? fileId++ : validated.id

        // Extract extension from path if not provided
        const extension = validated.extension || path.extname(validated.path).slice(1)

        // Convert imports/exports to string arrays
        const imports = convertToStringArray(validated.imports)
        const exports = convertToStringArray(validated.exports)

        insertStmt.run(
          id,
          validated.projectId,
          validated.name,
          validated.path,
          extension,
          validated.size,
          validated.content || null,
          validated.summary || null,
          validated.summaryLastUpdated || null,
          validated.meta ? JSON.stringify(validated.meta) : null,
          validated.checksum || null,
          JSON.stringify(imports),
          JSON.stringify(exports),
          validated.created || oldFile.created_at,
          validated.updated || oldFile.updated_at
        )

        this.stats.projectFiles.migrated++
        
        // Only log every 100 files to reduce output
        if (this.stats.projectFiles.migrated % 100 === 0) {
          console.log(`  ... migrated ${this.stats.projectFiles.migrated} files`)
        }
      } catch (error) {
        this.stats.projectFiles.failed++
        console.error(`  ✗ Failed to migrate file ${oldFile.id}:`, error)
      }
    }
  }

  private close() {
    this.oldDb.close()
    this.newDb.close()
  }
}

// Main execution
async function main() {
  console.log('=== Promptliano Database Migration Tool ===')
  console.log(`Old database: ${OLD_DB_PATH}`)
  console.log(`New database: ${NEW_DB_PATH}`)
  console.log('')

  try {
    const migrator = new DatabaseMigrator()
    await migrator.migrate()
    
    console.log('\n✅ Migration completed! You can now use your data in the new Promptliano version.')
  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    console.error('\nPlease ensure:')
    console.error('1. The old database exists at:', OLD_DB_PATH)
    console.error('2. The new database exists at:', NEW_DB_PATH)
    console.error('3. The new database has the proper schema (run migrations first)')
    process.exit(1)
  }
}

// Run the migration
main().catch(console.error)