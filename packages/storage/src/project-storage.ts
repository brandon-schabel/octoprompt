import { z } from 'zod'
import * as path from 'node:path'
import { ProjectSchema, ProjectFileSchema, type Project, type ProjectFile } from '@octoprompt/schemas'
import { IndexedStorage, type IndexDefinition } from './core/indexed-storage'
import { type StorageOptions } from './core/base-storage'
import { commonSorters } from './core/storage-query-utils'
import { IndexBuilder } from './core/index-builder'
import { STORAGE_CONFIG } from './config'
import { unixTimestampSchema } from '@octoprompt/schemas'

// Storage schemas
export const ProjectsStorageSchema = z.record(z.string(), ProjectSchema)
export const ProjectFilesStorageSchema = z.record(z.string(), ProjectFileSchema)
export type ProjectsStorage = z.infer<typeof ProjectsStorageSchema>
export type ProjectFilesStorage = z.infer<typeof ProjectFilesStorageSchema>

/**
 * Enhanced project storage with file versioning, indexing, and project management
 */
export class ProjectStorage extends IndexedStorage<Project, ProjectsStorage> {
  private fileStorages: Map<number, ProjectFileStorage> = new Map()

  constructor(options: StorageOptions = {}) {
    const dataDir = path.join('data', 'projects')
    super(ProjectsStorageSchema, ProjectSchema, dataDir, options)
    
    // Define indexes using IndexBuilder
    this.indexDefinitions = new IndexBuilder()
      .setPrefix('projects')
      .addTextIndex('name')
      .addHashIndex('path')
      .addDateIndex('created')
      .addDateIndex('updated')
      .build()
    
    // Initialize indexes
    this.initializeIndexes()
  }

  protected getIndexPath(): string {
    return path.join(this.basePath, this.dataDir, 'projects.json')
  }

  protected getEntityPath(id: number): string | null {
    return path.join(this.basePath, this.dataDir, id.toString(), 'project.json')
  }


  // Override create to initialize file storage
  public async create(data: Omit<Project, 'id' | 'created' | 'updated'>): Promise<Project> {
    const project = await super.create(data)
    
    // Initialize file storage for this project
    const fileStorage = this.getFileStorage(project.id)
    await fileStorage.initialize()
    
    return project
  }

  // Override delete to clean up files
  public async delete(id: number): Promise<boolean> {
    const result = await super.delete(id)
    if (result) {
      // Clean up file storage
      const fileStorage = this.fileStorages.get(id)
      if (fileStorage) {
        await fileStorage.deleteAll()
        this.fileStorages.delete(id)
      }
    }
    return result
  }

  // --- Project Management ---

  /**
   * Search projects by name
   */
  public async search(query: string): Promise<Project[]> {
    return this.searchByIndex('projects_by_name', query, commonSorters.byUpdatedDesc)
  }

  /**
   * Get project by path
   */
  public async getByPath(projectPath: string): Promise<Project | null> {
    const projects = await this.queryByIndex('projects_by_path', projectPath)
    return projects[0] || null
  }

  // --- File Management ---

  /**
   * Get file storage for a project
   */
  public getFileStorage(projectId: number): ProjectFileStorage {
    if (!this.fileStorages.has(projectId)) {
      this.fileStorages.set(projectId, new ProjectFileStorage(projectId, this.basePath, this.dataDir, this.options))
    }
    return this.fileStorages.get(projectId)!
  }

  /**
   * Add file to project
   */
  public async addFile(projectId: number, fileData: Omit<ProjectFile, 'id' | 'projectId' | 'created' | 'updated'>): Promise<ProjectFile> {
    const fileStorage = this.getFileStorage(projectId)
    const file = await fileStorage.create({
      ...fileData,
      projectId
    })
    
    // Update project's updated timestamp
    await this.update(projectId, { updated: Date.now() })
    
    return file
  }

  /**
   * Get project files
   */
  public async getProjectFiles(projectId: number): Promise<ProjectFile[]> {
    const fileStorage = this.getFileStorage(projectId)
    return fileStorage.list()
  }

  /**
   * Search files in project
   */
  public async searchFiles(projectId: number, query: string): Promise<ProjectFile[]> {
    const fileStorage = this.getFileStorage(projectId)
    return fileStorage.search(query)
  }

}

/**
 * File storage for project files
 */
export class ProjectFileStorage extends IndexedStorage<ProjectFile, ProjectFilesStorage> {
  private projectId: number

  constructor(projectId: number, basePath: string, dataDir: string, options: StorageOptions = {}) {
    const fileDataDir = path.join(dataDir, projectId.toString(), 'files')
    super(ProjectFilesStorageSchema, ProjectFileSchema, fileDataDir, { ...options, basePath })
    
    this.projectId = projectId
    
    // Define indexes using IndexBuilder with dynamic prefix
    this.indexDefinitions = new IndexBuilder()
      .setPrefix(`files_${this.projectId}`)
      .addHashIndex('path')
      .addHashIndex('extension')
      .addTextIndex('content')
      .addSparseIndex('lastSyncedAt', 'btree')
      .build()
    
    // Initialize indexes
    this.initializeIndexes()
  }

  protected getIndexPath(): string {
    return path.join(this.basePath, this.dataDir, 'files.json')
  }

  protected getEntityPath(id: number): string | null {
    // Files don't have separate entity paths
    return null
  }


  public async initialize(): Promise<void> {
    // Ensure the directory structure exists
    try {
      await this.readAll()
    } catch (error) {
      // If files don't exist, create empty storage
      await this.writeAll({})
    }
  }

  // Override create to ensure projectId
  public async create(data: Omit<ProjectFile, 'id' | 'created' | 'updated'>): Promise<ProjectFile> {
    return super.create({
      ...data,
      projectId: this.projectId
    })
  }

  /**
   * Search files by content or path
   */
  public async search(query: string): Promise<ProjectFile[]> {
    const contentMatches = await this.searchByIndex(`files_${this.projectId}_by_content`, query)
    const files = [...contentMatches]
    
    // Also search by path
    const allFiles = await this.list()
    const pathMatches = allFiles.filter(f => 
      f.path.toLowerCase().includes(query.toLowerCase()) &&
      !files.some(existing => existing.id === f.id)
    )
    
    files.push(...pathMatches)
    
    return files.sort(commonSorters.byUpdatedDesc)
  }

  /**
   * Get files by extension
   */
  public async getByExtension(extension: string): Promise<ProjectFile[]> {
    return this.queryByIndex(`files_${this.projectId}_by_extension`, extension, commonSorters.byPath)
  }

  /**
   * Get file by path
   */
  public async getByPath(filePath: string): Promise<ProjectFile | null> {
    const files = await this.queryByIndex(`files_${this.projectId}_by_path`, filePath)
    return files[0] || null
  }

  // Override update to handle content and checksum
  public async update(id: number, data: Partial<Omit<ProjectFile, 'id' | 'projectId' | 'created' | 'updated'>>): Promise<ProjectFile | null> {
    // Calculate checksum if content is being updated
    let updateData = { ...data }
    if (data.content !== undefined) {
      updateData.checksum = this.calculateChecksum(data.content)
      updateData.size = Buffer.byteLength(data.content, 'utf8')
    }
    
    return super.update(id, updateData)
  }

  private calculateChecksum(content: string): string {
    // Simple hash function for demonstration
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString(16)
  }

  // Add version creation method
  public async createVersion(
    currentId: number,
    newContent: string,
    metadata?: { extension?: string; size?: number; checksum?: string }
  ): Promise<ProjectFile> {
    const current = await this.getById(currentId)
    if (!current) {
      throw new Error(`File ${currentId} not found for versioning`)
    }

    // Mark current as not latest
    await this.update(currentId, { isLatest: false })

    // Create new version
    const newVersion = await this.create({
      ...current,
      content: newContent,
      version: current.version + 1,
      prevId: currentId,
      isLatest: true,
      originalFileId: current.originalFileId || current.id,
      ...metadata
    })

    // Update current to point to new version
    await this.update(currentId, { nextId: newVersion.id })

    return newVersion
  }
}

// Export singleton instance directly for V2 API access
export const projectStorage = new ProjectStorage(STORAGE_CONFIG)