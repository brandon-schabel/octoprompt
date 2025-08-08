#!/usr/bin/env bun
/**
 * Script to verify the migration was successful
 * 
 * Usage: bun run scripts/verify-migration.ts
 */

import { Database } from 'bun:sqlite'
import fs from 'node:fs'

const OLD_DB_PATH = '/Users/brandon/Library/Application Support/Promptliano/promptliano-old.db'
const NEW_DB_PATH = '/Users/brandon/Library/Application Support/Promptliano/promptliano.db'

function verifyMigration() {
  console.log('=== Migration Verification Tool ===\n')

  // Check if databases exist
  if (!fs.existsSync(OLD_DB_PATH)) {
    console.log('❌ Old database not found at:', OLD_DB_PATH)
    return
  }
  if (!fs.existsSync(NEW_DB_PATH)) {
    console.log('❌ New database not found at:', NEW_DB_PATH)
    return
  }

  const oldDb = new Database(OLD_DB_PATH, { readonly: true })
  const newDb = new Database(NEW_DB_PATH, { readonly: true })

  try {
    // Check projects
    console.log('📁 Projects:')
    const oldProjectCount = oldDb.prepare('SELECT COUNT(*) as count FROM projects').get() as { count: number }
    const newProjectCount = newDb.prepare('SELECT COUNT(*) as count FROM projects').get() as { count: number }
    console.log(`  Old database: ${oldProjectCount.count} projects`)
    console.log(`  New database: ${newProjectCount.count} projects`)
    
    // Show some project details
    const newProjects = newDb.prepare('SELECT id, name, path FROM projects LIMIT 5').all() as any[]
    if (newProjects.length > 0) {
      console.log('  Sample projects:')
      newProjects.forEach(p => console.log(`    - ${p.name} (${p.path})`))
    }

    // Check prompts
    console.log('\n💡 Prompts:')
    const oldPromptCount = oldDb.prepare('SELECT COUNT(*) as count FROM prompts').get() as { count: number }
    const newPromptCount = newDb.prepare('SELECT COUNT(*) as count FROM prompts').get() as { count: number }
    console.log(`  Old database: ${oldPromptCount.count} prompts`)
    console.log(`  New database: ${newPromptCount.count} prompts`)

    // Show some prompt details
    const newPrompts = newDb.prepare('SELECT id, name FROM prompts LIMIT 5').all() as any[]
    if (newPrompts.length > 0) {
      console.log('  Sample prompts:')
      newPrompts.forEach(p => console.log(`    - ${p.name}`))
    }

    // Check project files
    console.log('\n📄 Project Files:')
    const oldFileCount = oldDb.prepare('SELECT COUNT(*) as count FROM project_files').get() as { count: number }
    const newFileCount = newDb.prepare('SELECT COUNT(*) as count FROM project_files').get() as { count: number }
    console.log(`  Old database: ${oldFileCount.count} files`)
    console.log(`  New database: ${newFileCount.count} files`)

    // Show file distribution by project
    const filesByProject = newDb.prepare(`
      SELECT p.name as project_name, COUNT(f.id) as file_count 
      FROM projects p 
      LEFT JOIN project_files f ON p.id = f.project_id 
      GROUP BY p.id 
      ORDER BY file_count DESC 
      LIMIT 5
    `).all() as any[]
    
    if (filesByProject.length > 0) {
      console.log('  Files per project:')
      filesByProject.forEach(p => console.log(`    - ${p.project_name}: ${p.file_count} files`))
    }

    // Check data integrity
    console.log('\n🔍 Data Integrity:')
    
    // Check for orphaned prompts
    const orphanedPrompts = newDb.prepare(`
      SELECT COUNT(*) as count 
      FROM prompts 
      WHERE project_id IS NOT NULL 
      AND project_id NOT IN (SELECT id FROM projects)
    `).get() as { count: number }
    console.log(`  Orphaned prompts: ${orphanedPrompts.count}`)

    // Check for orphaned files
    const orphanedFiles = newDb.prepare(`
      SELECT COUNT(*) as count 
      FROM project_files 
      WHERE project_id NOT IN (SELECT id FROM projects)
    `).get() as { count: number }
    console.log(`  Orphaned files: ${orphanedFiles.count}`)

    console.log('\n✅ Verification complete!')
    
  } catch (error) {
    console.error('Error during verification:', error)
  } finally {
    oldDb.close()
    newDb.close()
  }
}

// Run verification
verifyMigration()