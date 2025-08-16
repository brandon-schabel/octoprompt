import { z } from 'zod'
import { ProjectSchema, ProjectFileSchema, type ProjectFile, type Project } from '@promptliano/schemas'
import { BaseStorage } from './base-storage'
import { 
  createEntityConverter,
  createStandardMappings,
  getInsertColumnsFromMappings,
  getInsertValuesFromEntity
} from './utils/storage-helpers'
import { replaceEntities } from './utils/transaction-helpers'
import { ApiError } from '@promptliano/shared'
import { fromArray, SqliteConverters } from '@promptliano/shared/src/utils/sqlite-converters'

// --- Schemas for Storage ---
export const ProjectsStorageSchema = z.record(z.string(), ProjectSchema)
export type ProjectsStorage = z.infer<typeof ProjectsStorageSchema>

export const ProjectFilesStorageSchema = z.record(z.string(), ProjectFileSchema)
export type ProjectFilesStorage = z.infer<typeof ProjectFilesStorageSchema>

/**
 * Project storage implementation using BaseStorage
 */
class ProjectStorage extends BaseStorage<Project, ProjectsStorage> {
  protected readonly tableName = 'projects'
  protected readonly entitySchema = ProjectSchema as any
  protected readonly storageSchema = ProjectsStorageSchema as any

  private readonly fieldMappings = {
    id: { dbColumn: 'id', converter: (v: any) => SqliteConverters.toNumber(v) },
    name: { dbColumn: 'name', converter: (v: any) => SqliteConverters.toString(v) },
    description: { dbColumn: 'description', converter: (v: any) => SqliteConverters.toString(v), defaultValue: '' },
    path: { dbColumn: 'path', converter: (v: any) => SqliteConverters.toString(v) },
    created: { dbColumn: 'created_at', converter: (v: any) => SqliteConverters.toTimestamp(v) },
    updated: { dbColumn: 'updated_at', converter: (v: any) => SqliteConverters.toTimestamp(v) }
  } as const

  private readonly converter = createEntityConverter(
    this.entitySchema,
    this.fieldMappings
  )

  protected rowToEntity(row: any): Project {
    return this.converter(row) as Project
  }

  protected getSelectColumns(): string[] {
    return ['id', 'name', 'description', 'path', 'created_at', 'updated_at']
  }

  protected getInsertColumns(): string[] {
    // Exclude project_id since projects don't belong to other projects
    return getInsertColumnsFromMappings(this.fieldMappings, ['project_id'])
  }

  protected getInsertValues(entity: Project): any[] {
    return getInsertValuesFromEntity(entity, this.fieldMappings)
  }

  // Convenience methods maintaining backward compatibility
  async readProjects(): Promise<ProjectsStorage> {
    return this.readAll()
  }

  async writeProjects(projects: ProjectsStorage): Promise<ProjectsStorage> {
    return this.writeAll(projects)
  }

  async deleteProjectData(projectId: number): Promise<void> {
    const db = this.getDb()
    const database = db.getDatabase()

    database.transaction(() => {
      // Delete all files for this project
      database.prepare(`DELETE FROM project_files WHERE project_id = ?`).run(projectId)
      // Delete the project itself
      database.prepare(`DELETE FROM projects WHERE id = ?`).run(projectId)
    })()
  }
}

/**
 * ProjectFile storage implementation using BaseStorage
 */
class ProjectFileStorage extends BaseStorage<ProjectFile, ProjectFilesStorage> {
  protected readonly tableName = 'project_files'
  protected readonly entitySchema = ProjectFileSchema as any
  protected readonly storageSchema = ProjectFilesStorageSchema as any

  private readonly fieldMappings = createStandardMappings<ProjectFile>({
    projectId: { dbColumn: 'project_id', converter: (v) => SqliteConverters.toNumber(v) },
    path: 'path',
    extension: 'extension',
    size: { dbColumn: 'size', converter: (v) => SqliteConverters.toNumber(v) },
    content: 'content',
    summary: 'summary',
    summaryLastUpdated: { dbColumn: 'summary_last_updated', converter: (v) => SqliteConverters.toNumber(v) },
    meta: 'meta',
    checksum: 'checksum',
    imports: { dbColumn: 'imports', converter: (v) => v ? SqliteConverters.toArray(v) : undefined },
    exports: { dbColumn: 'exports', converter: (v) => v ? SqliteConverters.toArray(v) : undefined }
  })

  private readonly converter = createEntityConverter(
    this.entitySchema,
    this.fieldMappings
  )

  protected rowToEntity(row: any): ProjectFile {
    return this.converter(row) as ProjectFile
  }

  protected getSelectColumns(): string[] {
    return [
      'id', 'project_id', 'name', 'path', 'extension', 'size', 'content',
      'summary', 'summary_last_updated', 'meta', 'checksum',
      'imports', 'exports', 'created_at', 'updated_at'
    ]
  }

  protected getInsertColumns(): string[] {
    return [
      'id', 'project_id', 'name', 'path', 'extension', 'size', 'content',
      'summary', 'summary_last_updated', 'meta', 'checksum',
      'imports', 'exports', 'created_at', 'updated_at'
    ]
  }

  protected getInsertValues(entity: ProjectFile): any[] {
    return [
      entity.id,
      entity.projectId,
      entity.name,
      entity.path,
      entity.extension,
      entity.size,
      entity.content,
      entity.summary,
      entity.summaryLastUpdated,
      entity.meta,
      entity.checksum,
      fromArray(entity.imports),
      fromArray(entity.exports),
      entity.created,
      entity.updated
    ]
  }

  // Convenience methods maintaining backward compatibility
  async readProjectFiles(projectId: number): Promise<ProjectFilesStorage> {
    return this.readAll('project_id = ?', [projectId])
  }

  async writeProjectFiles(projectId: number, files: ProjectFilesStorage): Promise<ProjectFilesStorage> {
    // Validate that all files belong to the correct project
    for (const [fileId, file] of Object.entries(files)) {
      if (file.projectId !== projectId) {
        throw new ApiError(400, `File ${fileId} has mismatched projectId`, 'INVALID_PROJECT_ID')
      }
    }

    return this.writeAll(files, 'project_id = ?', [projectId])
  }

  async readProjectFile(projectId: number, fileId: number): Promise<ProjectFile | undefined> {
    try {
      const db = this.getDb()
      const database = db.getDatabase()

      const query = database.prepare(`
        SELECT ${this.getSelectColumns().join(', ')}
        FROM ${this.tableName}
        WHERE id = ? AND project_id = ?
      `)

      const row = query.get(fileId, projectId) as any

      if (!row) {
        return undefined
      }

      const file = this.rowToEntity(row)
      return await this.validateData(file, this.entitySchema, `file ${fileId}`)
    } catch (error: any) {
      console.error(`Error reading file ${fileId} from project ${projectId}:`, error)
      throw new ApiError(500, 'Failed to read project file', 'DB_READ_ERROR', error)
    }
  }

  async updateProjectFile(
    projectId: number,
    fileId: number,
    fileData: Partial<Omit<ProjectFile, 'id' | 'projectId' | 'created' | 'updated'>>
  ): Promise<ProjectFile> {
    const existing = await this.readProjectFile(projectId, fileId)
    if (!existing) {
      throw new ApiError(404, `File not found: ${fileId} in project ${projectId}`, 'FILE_NOT_FOUND')
    }

    return this.update(fileId, fileData)
  }

  async getProjectFileArray(projectId: number): Promise<ProjectFile[]> {
    const files = await this.readProjectFiles(projectId)
    return Object.values(files)
  }

  generateFileId(): number {
    return this.getDb().generateUniqueId('project_files')
  }
}

// Create singleton instances
const projectStorageInstance = new ProjectStorage()
const projectFileStorageInstance = new ProjectFileStorage()

// Export the combined storage object for backward compatibility
export const projectStorage = {
  // Project methods
  readProjects: () => projectStorageInstance.readProjects(),
  writeProjects: (projects: ProjectsStorage) => projectStorageInstance.writeProjects(projects),
  deleteProjectData: (projectId: number) => projectStorageInstance.deleteProjectData(projectId),
  generateId: () => projectStorageInstance.generateId(),

  // ProjectFile methods
  readProjectFiles: (projectId: number) => projectFileStorageInstance.readProjectFiles(projectId),
  writeProjectFiles: (projectId: number, files: ProjectFilesStorage) => 
    projectFileStorageInstance.writeProjectFiles(projectId, files),
  readProjectFile: (projectId: number, fileId: number) => 
    projectFileStorageInstance.readProjectFile(projectId, fileId),
  updateProjectFile: (projectId: number, fileId: number, fileData: Partial<Omit<ProjectFile, 'id' | 'projectId' | 'created' | 'updated'>>) =>
    projectFileStorageInstance.updateProjectFile(projectId, fileId, fileData),
  getProjectFileArray: (projectId: number) => projectFileStorageInstance.getProjectFileArray(projectId),
  generateFileId: () => projectFileStorageInstance.generateFileId()
}