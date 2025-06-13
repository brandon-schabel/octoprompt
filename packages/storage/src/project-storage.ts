import { z } from 'zod'
import * as path from 'node:path'
import { ProjectSchema, ProjectFileSchema, type Project, type ProjectFile } from '@octoprompt/schemas'
import { BaseStorage, type StorageOptions } from './core/base-storage'
import { IndexManager, type IndexConfig } from './core/index-manager'
import { unixTimestampSchema } from '@octoprompt/schemas'

// Storage schemas
export const ProjectsStorageSchema = z.record(z.string(), ProjectSchema)
export const ProjectFilesStorageSchema = z.record(z.string(), ProjectFileSchema)
export type ProjectsStorage = z.infer<typeof ProjectsStorageSchema>
export type ProjectFilesStorage = z.infer<typeof ProjectFilesStorageSchema>

/**
 * Enhanced project storage with file versioning, indexing, and project management
 */
export class ProjectStorage extends BaseStorage<Project, ProjectsStorage> {
  private indexManager: IndexManager
  private fileStorages: Map<number, ProjectFileStorage> = new Map()

  constructor(options: StorageOptions = {}) {
    const dataDir = path.join('data', 'projects')
    super(ProjectsStorageSchema, ProjectSchema, dataDir, options)
    
    this.indexManager = new IndexManager(this.basePath, this.dataDir)
    
    // Initialize indexes
    this.initializeIndexes()
  }

  protected getIndexPath(): string {
    return path.join(this.basePath, this.dataDir, 'projects.json')
  }

  protected getEntityPath(id: number): string | null {
    return path.join(this.basePath, this.dataDir, id.toString(), 'project.json')
  }

  protected async initializeIndexes(): Promise<void> {
    const indexes: IndexConfig[] = [
      {
        name: 'projects_by_name',
        type: 'inverted',
        fields: ['name']
      },
      {
        name: 'projects_by_path',
        type: 'hash',
        fields: ['path']
      },
      {
        name: 'projects_by_created',
        type: 'btree',
        fields: ['created']
      },
      {
        name: 'projects_by_updated',
        type: 'btree',
        fields: ['updated']
      }
    ]

    for (const indexConfig of indexes) {
      try {
        await this.indexManager.createIndex(indexConfig)
      } catch (error: any) {
        if (!error.message.includes('already exists')) {
          console.error(`Failed to create index ${indexConfig.name}:`, error)
        }
      }
    }
  }

  // Override create to handle indexes
  public async create(data: Omit<Project, 'id' | 'created' | 'updated'>): Promise<Project> {
    const project = await super.create(data)
    
    // Update indexes
    await this.updateProjectIndexes(project)
    
    // Initialize file storage for this project
    const fileStorage = this.getFileStorage(project.id)
    await fileStorage.initialize()
    
    return project
  }

  // Override update to maintain indexes
  public async update(id: number, data: Partial<Omit<Project, 'id' | 'created' | 'updated'>>): Promise<Project | null> {
    // Remove from indexes before update
    await this.removeProjectFromIndexes(id)

    const updated = await super.update(id, data)
    if (!updated) return null

    // Re-add to indexes
    await this.updateProjectIndexes(updated)

    return updated
  }

  // Override delete to maintain indexes and clean up files
  public async delete(id: number): Promise<boolean> {
    const result = await super.delete(id)
    if (result) {
      // Remove from indexes
      await this.removeProjectFromIndexes(id)
      
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
    const nameIds = await this.indexManager.searchText('projects_by_name', query)
    const projects: Project[] = []
    
    for (const id of nameIds) {
      const project = await this.getById(id)
      if (project) projects.push(project)
    }
    
    return projects.sort((a, b) => b.updated - a.updated)
  }

  /**
   * Get project by path
   */
  public async getByPath(projectPath: string): Promise<Project | null> {
    const ids = await this.indexManager.query('projects_by_path', projectPath)
    if (ids.length === 0) return null
    
    return this.getById(ids[0])
  }

  /**
   * Get recent projects
   */
  public async getRecent(limit: number = 10): Promise<Project[]> {
    const projects = await this.list()
    return projects
      .sort((a, b) => b.updated - a.updated)
      .slice(0, limit)
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

  // --- Legacy API Compatibility ---

  /**
   * Get all projects (legacy API)
   */
  public async getAllProjects(): Promise<Project[]> {
    return this.list()
  }

  // --- Legacy API wrapper methods for backward compatibility ---

  /**
   * Read projects (V1 storage API)
   */
  public async readProjects(): Promise<Record<string, Project>> {
    const projectsList = await this.list()
    const projectsObject: Record<string, Project> = {}
    
    for (const project of projectsList) {
      projectsObject[project.id.toString()] = project
    }
    
    return projectsObject
  }

  /**
   * Write projects (V1 storage API)
   */
  public async writeProjects(projects: Record<string, Project>): Promise<Record<string, Project>> {
    // Convert object to array
    const projectsArray = Object.values(projects)
    const projectsMap: Record<number, Project> = {}
    
    for (const project of projectsArray) {
      projectsMap[project.id] = project
    }
    
    await this.writeAll(projectsMap)
    
    // Ensure file storage is initialized for each project
    for (const project of projectsArray) {
      const fileStorage = this.getFileStorage(project.id)
      // Initialize with empty files if needed
      try {
        await fileStorage.readAll()
      } catch (error) {
        // If files don't exist, create empty storage
        await fileStorage.writeAll({})
      }
    }
    
    return projects
  }

  /**
   * Read project files (V1 storage API)
   */
  public async readProjectFiles(projectId: number): Promise<Record<string, ProjectFile>> {
    const fileStorage = this.getFileStorage(projectId)
    const files = await fileStorage.readAll()
    
    // Convert numeric keys to string keys for compatibility
    const filesObject: Record<string, ProjectFile> = {}
    for (const [id, file] of Object.entries(files)) {
      filesObject[id] = file
    }
    
    return filesObject
  }

  /**
   * Write project files (V1 storage API)
   */
  public async writeProjectFiles(projectId: number, files: Record<string, ProjectFile>): Promise<Record<string, ProjectFile>> {
    const fileStorage = this.getFileStorage(projectId)
    
    // Convert string keys to numeric keys
    const filesMap: Record<number, ProjectFile> = {}
    for (const [id, file] of Object.entries(files)) {
      filesMap[Number(id)] = file
    }
    
    await fileStorage.writeAll(filesMap)
    return files
  }

  /**
   * Update project file (V1 storage API)
   */
  public async updateProjectFile(
    projectId: number,
    fileId: number,
    fileData: Partial<Omit<ProjectFile, 'id' | 'projectId' | 'created' | 'updated'>>
  ): Promise<ProjectFile> {
    const fileStorage = this.getFileStorage(projectId)
    const updatedFile = await fileStorage.update(fileId, fileData)
    
    if (!updatedFile) {
      throw new Error(`File not found: ${fileId} in project ${projectId}`)
    }
    
    return updatedFile
  }

  /**
   * Create file version (V1 storage API)
   */
  public async createFileVersion(
    projectId: number,
    currentFileId: number,
    newContent: string,
    additionalData?: Partial<
      Omit<ProjectFile, 'id' | 'projectId' | 'created' | 'updated' | 'version' | 'prevId' | 'nextId' | 'isLatest'>
    >
  ): Promise<ProjectFile> {
    const fileStorage = this.getFileStorage(projectId)
    return fileStorage.createVersion(currentFileId, newContent, additionalData)
  }

  /**
   * Get file versions (V1 storage API)
   */
  public async getFileVersions(projectId: number, originalFileId: number): Promise<ProjectFile[]> {
    const fileStorage = this.getFileStorage(projectId)
    return fileStorage.getVersions(originalFileId)
  }

  /**
   * Get file version (V1 storage API)
   */
  public async getFileVersion(projectId: number, originalFileId: number, version: number): Promise<ProjectFile | null> {
    const fileStorage = this.getFileStorage(projectId)
    const versions = await fileStorage.getVersions(originalFileId)
    return versions.find(v => v.version === version) || null
  }

  /**
   * Get latest file version (V1 storage API)
   */
  public async getLatestFileVersion(projectId: number, originalFileId: number): Promise<ProjectFile | null> {
    const fileStorage = this.getFileStorage(projectId)
    return fileStorage.getLatestVersion(originalFileId)
  }

  /**
   * Revert to version (V1 storage API)
   */
  public async revertToVersion(projectId: number, currentFileId: number, targetVersion: number): Promise<ProjectFile> {
    const fileStorage = this.getFileStorage(projectId)
    const currentFile = await fileStorage.getById(currentFileId)
    
    if (!currentFile) {
      throw new Error(`File not found: ${currentFileId} in project ${projectId}`)
    }
    
    const originalFileId = currentFile.originalFileId || currentFile.id
    const targetVersionFile = await this.getFileVersion(projectId, originalFileId, targetVersion)
    
    if (!targetVersionFile) {
      throw new Error(`Version ${targetVersion} not found for file`)
    }
    
    // Create new version with content from target version
    return fileStorage.createVersion(currentFileId, targetVersionFile.content, {
      checksum: targetVersionFile.checksum,
      meta: targetVersionFile.meta
    })
  }

  /**
   * Read project file (V1 storage API)
   */
  public async readProjectFile(projectId: number, fileId: number): Promise<ProjectFile | undefined> {
    const fileStorage = this.getFileStorage(projectId)
    return fileStorage.getById(fileId) || undefined
  }

  /**
   * Delete project data (V1 storage API)
   */
  public async deleteProjectData(projectId: number): Promise<void> {
    // Delete all project files first
    const fileStorage = this.getFileStorage(projectId)
    await fileStorage.deleteAll()
  }

  /**
   * Get project file array (V1 storage API)
   */
  public async getProjectFileArray(projectId: number): Promise<ProjectFile[]> {
    const fileStorage = this.getFileStorage(projectId)
    return fileStorage.list()
  }

  /**
   * Generate ID (V1 storage API)
   */
  public generateId(): number {
    try {
      return unixTimestampSchema.parse(Date.now())
    } catch (error) {
      console.error(`CRITICAL: Date.now() produced invalid timestamp for ID generation: ${error}`)
      throw new Error('Failed to generate a valid timestamp-based ID from the current time.')
    }
  }

  // --- Index Management ---

  private async updateProjectIndexes(project: Project): Promise<void> {
    await this.indexManager.addToIndex('projects_by_name', project.id, project)
    await this.indexManager.addToIndex('projects_by_path', project.id, project)
    await this.indexManager.addToIndex('projects_by_created', project.id, project)
    await this.indexManager.addToIndex('projects_by_updated', project.id, project)
  }

  private async removeProjectFromIndexes(projectId: number): Promise<void> {
    const indexNames = [
      'projects_by_name',
      'projects_by_path',
      'projects_by_created',
      'projects_by_updated'
    ]
    
    for (const indexName of indexNames) {
      await this.indexManager.removeFromIndex(indexName, projectId)
    }
  }

  public async rebuildIndexes(): Promise<void> {
    const projects = await this.list()
    
    const indexNames = [
      'projects_by_name',
      'projects_by_path',
      'projects_by_created',
      'projects_by_updated'
    ]
    
    for (const indexName of indexNames) {
      await this.indexManager.rebuildIndex(indexName, projects)
    }
  }
}

/**
 * File storage for project files with versioning support
 */
export class ProjectFileStorage extends BaseStorage<ProjectFile, ProjectFilesStorage> {
  private indexManager: IndexManager
  private projectId: number

  constructor(projectId: number, basePath: string, dataDir: string, options: StorageOptions = {}) {
    const fileDataDir = path.join(dataDir, projectId.toString(), 'files')
    super(ProjectFilesStorageSchema, ProjectFileSchema, fileDataDir, { ...options, basePath })
    
    this.projectId = projectId
    this.indexManager = new IndexManager(basePath, fileDataDir)
    
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

  protected async initializeIndexes(): Promise<void> {
    const indexes: IndexConfig[] = [
      {
        name: `files_${this.projectId}_by_path`,
        type: 'hash',
        fields: ['path']
      },
      {
        name: `files_${this.projectId}_by_extension`,
        type: 'hash',
        fields: ['extension']
      },
      {
        name: `files_${this.projectId}_by_content`,
        type: 'inverted',
        fields: ['content']
      },
      {
        name: `files_${this.projectId}_by_lastSyncedAt`,
        type: 'btree',
        fields: ['lastSyncedAt'],
        sparse: true
      },
      {
        name: `files_${this.projectId}_by_isLatest`,
        type: 'hash',
        fields: ['isLatest']
      },
      {
        name: `files_${this.projectId}_by_originalFileId`,
        type: 'hash',
        fields: ['originalFileId'],
        sparse: true
      }
    ]

    for (const indexConfig of indexes) {
      try {
        await this.indexManager.createIndex(indexConfig)
      } catch (error: any) {
        if (!error.message.includes('already exists')) {
          console.error(`Failed to create index ${indexConfig.name}:`, error)
        }
      }
    }
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

  // Override create to handle indexes and versioning
  public async create(data: Omit<ProjectFile, 'id' | 'created' | 'updated'>): Promise<ProjectFile> {
    const file = await super.create({
      ...data,
      projectId: this.projectId,
      version: data.version || 1,
      isLatest: data.isLatest !== false
    })
    
    // Update indexes
    await this.updateFileIndexes(file)
    
    return file
  }

  /**
   * Search files by content or path
   */
  public async search(query: string): Promise<ProjectFile[]> {
    const contentIds = await this.indexManager.searchText(`files_${this.projectId}_by_content`, query)
    const files: ProjectFile[] = []
    
    for (const id of contentIds) {
      const file = await this.getById(id)
      if (file) files.push(file)
    }
    
    // Also search by path
    const allFiles = await this.list()
    const pathMatches = allFiles.filter(f => 
      f.path.toLowerCase().includes(query.toLowerCase()) &&
      !files.some(existing => existing.id === f.id)
    )
    
    files.push(...pathMatches)
    
    return files.sort((a, b) => b.updated - a.updated)
  }

  /**
   * Get files by extension
   */
  public async getByExtension(extension: string): Promise<ProjectFile[]> {
    const ids = await this.indexManager.query(`files_${this.projectId}_by_extension`, extension)
    const files: ProjectFile[] = []
    
    for (const id of ids) {
      const file = await this.getById(id)
      if (file) files.push(file)
    }
    
    return files.sort((a, b) => a.path.localeCompare(b.path))
  }

  /**
   * Get file by path
   */
  public async getByPath(filePath: string): Promise<ProjectFile | null> {
    const ids = await this.indexManager.query(`files_${this.projectId}_by_path`, filePath)
    if (ids.length === 0) return null
    
    return this.getById(ids[0])
  }

  /**
   * Create new version of a file
   */
  public async createVersion(
    currentFileId: number,
    newContent: string,
    additionalData?: Partial<Omit<ProjectFile, 'id' | 'projectId' | 'created' | 'updated' | 'version' | 'prevId' | 'nextId' | 'isLatest'>>
  ): Promise<ProjectFile> {
    const currentFile = await this.getById(currentFileId)
    if (!currentFile) {
      throw new Error(`File not found: ${currentFileId}`)
    }

    // If the current file is not the latest, find the latest version
    let latestFile = currentFile
    if (!currentFile.isLatest) {
      const originalId = currentFile.originalFileId || currentFile.id
      const latestVersion = await this.getLatestVersion(originalId)
      if (!latestVersion) {
        throw new Error(`Cannot find latest version for file: ${currentFileId}`)
      }
      latestFile = latestVersion
    }

    // Mark latest file as not latest
    await this.update(latestFile.id, { isLatest: false })

    // Create new version
    const originalFileId = currentFile.originalFileId || currentFile.id
    const newVersion = await this.create({
      ...currentFile,
      ...additionalData,
      content: newContent,
      version: latestFile.version + 1,
      prevId: latestFile.id,
      originalFileId,
      isLatest: true,
      checksum: this.calculateChecksum(newContent)
    })

    // Update latest file's nextId
    await this.update(latestFile.id, { nextId: newVersion.id })

    return newVersion
  }

  /**
   * Get all versions of a file
   */
  public async getVersions(originalFileId: number): Promise<ProjectFile[]> {
    const ids = await this.indexManager.query(`files_${this.projectId}_by_originalFileId`, originalFileId)
    const files: ProjectFile[] = []
    
    for (const id of ids) {
      const file = await this.getById(id)
      if (file) files.push(file)
    }
    
    // Also include the original file if it doesn't have originalFileId set
    const originalFile = await this.getById(originalFileId)
    if (originalFile && !originalFile.originalFileId) {
      files.push(originalFile)
    }
    
    return files.sort((a, b) => a.version - b.version)
  }

  /**
   * Get latest version of a file
   */
  public async getLatestVersion(originalFileId: number): Promise<ProjectFile | null> {
    const versions = await this.getVersions(originalFileId)
    return versions.find(v => v.isLatest) || null
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

  private async updateFileIndexes(file: ProjectFile): Promise<void> {
    await this.indexManager.addToIndex(`files_${this.projectId}_by_path`, file.id, file)
    await this.indexManager.addToIndex(`files_${this.projectId}_by_extension`, file.id, file)
    await this.indexManager.addToIndex(`files_${this.projectId}_by_content`, file.id, file)
    await this.indexManager.addToIndex(`files_${this.projectId}_by_isLatest`, file.id, file)
    
    if (file.lastSyncedAt) {
      await this.indexManager.addToIndex(`files_${this.projectId}_by_lastSyncedAt`, file.id, file)
    }
    
    if (file.originalFileId) {
      await this.indexManager.addToIndex(`files_${this.projectId}_by_originalFileId`, file.id, file)
    }
  }
}

// Create singleton instance
const projectStorageInstance = new ProjectStorage()

/**
 * Compatibility wrapper for the old projectStorage API
 * This maintains backward compatibility while leveraging the enhanced storage
 */
export const projectStorage = {
  // Project methods
  async readProjects(): Promise<Record<string, Project>> {
    return projectStorageInstance.readProjects()
  },

  async writeProjects(projects: Record<string, Project>): Promise<Record<string, Project>> {
    return projectStorageInstance.writeProjects(projects)
  },

  // File methods
  async readProjectFiles(projectId: number): Promise<Record<string, ProjectFile>> {
    return projectStorageInstance.readProjectFiles(projectId)
  },

  async writeProjectFiles(projectId: number, files: Record<string, ProjectFile>): Promise<Record<string, ProjectFile>> {
    return projectStorageInstance.writeProjectFiles(projectId, files)
  },

  async updateProjectFile(
    projectId: number,
    fileId: number,
    fileData: Partial<Omit<ProjectFile, 'id' | 'projectId' | 'created' | 'updated'>>
  ): Promise<ProjectFile> {
    return projectStorageInstance.updateProjectFile(projectId, fileId, fileData)
  },

  // Versioning methods
  async createFileVersion(
    projectId: number,
    currentFileId: number,
    newContent: string,
    additionalData?: Partial<
      Omit<ProjectFile, 'id' | 'projectId' | 'created' | 'updated' | 'version' | 'prevId' | 'nextId' | 'isLatest'>
    >
  ): Promise<ProjectFile> {
    return projectStorageInstance.createFileVersion(projectId, currentFileId, newContent, additionalData)
  },

  async getFileVersions(projectId: number, originalFileId: number): Promise<ProjectFile[]> {
    return projectStorageInstance.getFileVersions(projectId, originalFileId)
  },

  async getFileVersion(projectId: number, originalFileId: number, version: number): Promise<ProjectFile | null> {
    return projectStorageInstance.getFileVersion(projectId, originalFileId, version)
  },

  async getLatestFileVersion(projectId: number, originalFileId: number): Promise<ProjectFile | null> {
    return projectStorageInstance.getLatestFileVersion(projectId, originalFileId)
  },

  async revertToVersion(projectId: number, currentFileId: number, targetVersion: number): Promise<ProjectFile> {
    return projectStorageInstance.revertToVersion(projectId, currentFileId, targetVersion)
  },

  async readProjectFile(projectId: number, fileId: number): Promise<ProjectFile | undefined> {
    return projectStorageInstance.readProjectFile(projectId, fileId)
  },

  async deleteProjectData(projectId: number): Promise<void> {
    return projectStorageInstance.deleteProjectData(projectId)
  },

  async getProjectFileArray(projectId: number): Promise<ProjectFile[]> {
    return projectStorageInstance.getProjectFileArray(projectId)
  },

  // Legacy API methods
  async getAllProjects(): Promise<Project[]> {
    return projectStorageInstance.getAllProjects()
  },

  generateId(): number {
    return projectStorageInstance.generateId()
  }
}