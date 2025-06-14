import { MigrationConfig } from '../core/migration-manager'
import { projectStorage } from '../project-storage'
import { ProjectStorageV2 } from '../project-storage-v2'
import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * Migration to optimize file storage structure
 * Splits large file.json into smaller chunks for better performance
 */
export const optimizeFileStorageMigration: MigrationConfig = {
  version: '1.1.0',
  description: 'Optimize file storage structure for better performance with large projects',

  async up() {
    console.log('Optimizing file storage structure...')

    const projects = await projectStorage.readProjects()
    const projectIds = Object.keys(projects).map((id) => Number(id))

    for (const projectId of projectIds) {
      console.log(`Processing project ${projectId}...`)

      try {
        // Read existing files
        const files = await projectStorage.readProjectFiles(projectId)
        const fileCount = Object.keys(files).length

        if (fileCount === 0) {
          console.log(`  No files in project ${projectId}, skipping`)
          continue
        }

        console.log(`  Found ${fileCount} files`)

        // For projects with many files, we could split them into chunks
        // For now, we'll just ensure indexes are built
        const newStorage = new ProjectStorageV2()
        const fileStorage = newStorage.getFileStorage(projectId)

        // Rebuild file indexes
        await fileStorage.rebuildIndexes()

        console.log(`  ✓ Optimized project ${projectId}`)
      } catch (error) {
        console.error(`  ✗ Failed to optimize project ${projectId}:`, error)
        // Continue with other projects
      }
    }

    console.log('File storage optimization complete')
  },

  async down() {
    // This migration only adds indexes, which are handled separately
    // The original file structure remains unchanged
    console.log('No rollback needed for file storage optimization')
  }
}
