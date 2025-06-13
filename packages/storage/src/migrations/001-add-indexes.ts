import { MigrationConfig } from '../core/migration-manager'
import { ProjectStorageV2 } from '../project-storage-v2'
import { projectStorage } from '../project-storage'

/**
 * Migration to add indexes to existing project data
 */
export const addIndexesMigration: MigrationConfig = {
  version: '1.0.0',
  description: 'Add indexes to project storage for improved query performance',
  
  async up() {
    console.log('Creating indexes for existing projects...')
    
    // Initialize new storage with indexes
    const newStorage = new ProjectStorageV2()
    
    // Read existing projects using old storage
    const projects = await projectStorage.readProjects()
    const projectList = Object.values(projects)
    
    console.log(`Found ${projectList.length} projects to index`)
    
    // Rebuild indexes with existing data
    await newStorage.rebuildIndexes()
    
    console.log('Indexes created successfully')
  },
  
  async down() {
    // Indexes are stored separately, so we can just remove the index directory
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    
    const indexPath = path.resolve(process.cwd(), 'data', 'project_storage', 'indexes')
    
    try {
      await fs.rm(indexPath, { recursive: true, force: true })
      console.log('Indexes removed')
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error
      }
    }
  }
}