import { z, ZodError } from 'zod'
import { ProjectSchema, ProjectFileSchema, type ProjectFile, type Project } from '@promptliano/schemas'
import { unixTimestampSchema } from '@promptliano/schemas'
import { getDb } from './database-manager'
import { ApiError } from '@promptliano/shared'
import {
  toNumber,
  toString,
  toArray,
  fromArray,
  SqliteConverters
} from '@promptliano/shared/src/utils/sqlite-converters'

// --- Schemas for Storage ---
export const ProjectsStorageSchema = z.record(z.string(), ProjectSchema)
export type ProjectsStorage = z.infer<typeof ProjectsStorageSchema>

export const ProjectFilesStorageSchema = z.record(z.string(), ProjectFileSchema)
export type ProjectFilesStorage = z.infer<typeof ProjectFilesStorageSchema>

// --- Database Helper Functions ---

/**
 * Validates data against a schema and returns the validated data.
 */
async function validateData<T>(data: unknown, schema: z.ZodSchema<T>, context: string): Promise<T> {
  const validationResult = await schema.safeParseAsync(data)
  if (!validationResult.success) {
    console.error(`Zod validation failed for ${context}:`, validationResult.error.errors)
    throw new ApiError(400, `Validation failed for ${context}`, 'VALIDATION_ERROR')
  }
  return validationResult.data
}

// Note: Now using centralized SqliteConverters instead of local helper functions
// The toArray function from SqliteConverters provides consistent JSON array parsing

export const projectStorage = {
  async readProjects(): Promise<ProjectsStorage> {
    try {
      const db = getDb()
      const database = db.getDatabase()

      // Query projects directly from columns
      const query = database.prepare(`
        SELECT id, name, description, path, created_at, updated_at
        FROM projects
        ORDER BY created_at DESC
      `)

      const rows = query.all() as any[]

      // Convert rows to ProjectsStorage
      const projectsStorage: ProjectsStorage = {}
      for (const row of rows) {
        const project: Project = {
          id: row.id,
          name: row.name,
          description: row.description,
          path: row.path,
          created: toNumber(row.created_at, Date.now()),
          updated: toNumber(row.updated_at, Date.now())
        }

        // Validate each project before adding
        const validatedProject = await validateData(project, ProjectSchema, `project ${project.id}`)
        projectsStorage[String(validatedProject.id)] = validatedProject
      }

      return projectsStorage
    } catch (error: any) {
      console.error('Error reading projects from database:', error)
      throw new ApiError(500, 'Failed to read projects from database', 'DB_READ_ERROR', error)
    }
  },

  async writeProjects(projects: ProjectsStorage): Promise<ProjectsStorage> {
    try {
      const db = getDb()
      const database = db.getDatabase()

      // Validate all projects first
      const validatedProjects = await validateData(projects, ProjectsStorageSchema, 'projects')

      // Use transaction for atomic operation
      database.transaction(() => {
        // Clear existing projects
        database.exec(`DELETE FROM projects`)

        // Insert all projects
        const insertQuery = database.prepare(`
          INSERT INTO projects (id, name, description, path, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `)

        for (const [id, project] of Object.entries(validatedProjects)) {
          insertQuery.run(project.id, project.name, project.description, project.path, project.created, project.updated)
        }
      })()

      return validatedProjects
    } catch (error: any) {
      console.error('Error writing projects to database:', error)
      if (error instanceof ZodError) {
        throw error
      }
      throw new ApiError(500, 'Failed to write projects to database', 'DB_WRITE_ERROR', error)
    }
  },

  async readProjectFiles(projectId: number): Promise<ProjectFilesStorage> {
    try {
      const db = getDb()
      const database = db.getDatabase()

      // Query project files directly from columns
      const query = database.prepare(`
        SELECT 
          id, project_id, name, path, extension, size, content, 
          summary, summary_last_updated, meta, checksum,
          imports, exports, created_at, updated_at
        FROM project_files
        WHERE project_id = ?
        ORDER BY created_at DESC
      `)

      const rows = query.all(projectId) as any[]

      // Convert rows to ProjectFilesStorage
      const filesStorage: ProjectFilesStorage = {}
      for (const row of rows) {
        const file: ProjectFile = {
          id: row.id,
          projectId: row.project_id,
          name: row.name,
          path: row.path,
          extension: row.extension,
          size: row.size,
          content: row.content,
          summary: row.summary,
          summaryLastUpdated: row.summary_last_updated,
          meta: row.meta,
          checksum: row.checksum,
          imports: toArray(row.imports, [], 'file.imports'),
          exports: toArray(row.exports, [], 'file.exports'),
          created: toNumber(row.created_at, Date.now()),
          updated: toNumber(row.updated_at, Date.now())
        }

        // Validate each file before adding
        try {
          const validatedFile = await validateData(file, ProjectFileSchema, `file ${file.id}`)
          filesStorage[String(validatedFile.id)] = validatedFile
        } catch (error) {
          console.error(`Skipping invalid file ${file.id} in project ${projectId}:`, error)
          // Skip invalid files during migration period
          continue
        }
      }

      return filesStorage
    } catch (error: any) {
      console.error(`Error reading project files for project ${projectId}:`, error)
      throw new ApiError(500, 'Failed to read project files from database', 'DB_READ_ERROR', error)
    }
  },

  async writeProjectFiles(projectId: number, files: ProjectFilesStorage): Promise<ProjectFilesStorage> {
    try {
      const db = getDb()
      const database = db.getDatabase()

      // Validate all files first
      const validatedFiles = await validateData(files, ProjectFilesStorageSchema, `files for project ${projectId}`)

      // Use transaction for atomic operation
      database.transaction(() => {
        // Delete existing files for this project
        const deleteQuery = database.prepare(`
          DELETE FROM project_files
          WHERE project_id = ?
        `)
        deleteQuery.run(projectId)

        // Insert all new files
        const insertQuery = database.prepare(`
          INSERT INTO project_files (
            id, project_id, name, path, extension, size, content, 
            summary, summary_last_updated, meta, checksum,
            imports, exports, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)

        for (const [fileId, file] of Object.entries(validatedFiles)) {
          // Ensure projectId is consistent
          if (file.projectId !== projectId) {
            throw new ApiError(400, `File ${fileId} has mismatched projectId`, 'INVALID_PROJECT_ID')
          }

          insertQuery.run(
            file.id,
            file.projectId,
            file.name,
            file.path,
            file.extension,
            file.size,
            file.content,
            file.summary,
            file.summaryLastUpdated,
            file.meta,
            file.checksum,
            fromArray(file.imports),
            fromArray(file.exports),
            file.created,
            file.updated
          )
        }
      })()

      return validatedFiles
    } catch (error: any) {
      console.error(`Error writing project files for project ${projectId}:`, error)
      if (error instanceof ZodError || error instanceof ApiError) {
        throw error
      }
      throw new ApiError(500, 'Failed to write project files to database', 'DB_WRITE_ERROR', error)
    }
  },

  async updateProjectFile(
    projectId: number,
    fileId: number,
    fileData: Partial<Omit<ProjectFile, 'id' | 'projectId' | 'created' | 'updated'>>
  ): Promise<ProjectFile> {
    try {
      const db = getDb()
      const database = db.getDatabase()

      // Get the existing file
      const getQuery = database.prepare(`
        SELECT 
          id, project_id, name, path, extension, size, content, 
          summary, summary_last_updated, meta, checksum,
          imports, exports, created_at, updated_at
        FROM project_files
        WHERE id = ? AND project_id = ?
      `)

      const row = getQuery.get(fileId, projectId) as any

      if (!row) {
        throw new ApiError(404, `File not found: ${fileId} in project ${projectId}`, 'FILE_NOT_FOUND')
      }

      // Construct existing file object
      const existingFile: ProjectFile = {
        id: row.id,
        projectId: row.project_id,
        name: row.name,
        path: row.path,
        extension: row.extension,
        size: row.size,
        content: row.content,
        summary: row.summary,
        summaryLastUpdated: row.summary_last_updated,
        meta: row.meta,
        checksum: row.checksum,
        imports: toArray(row.imports, [], 'file.imports'),
        exports: toArray(row.exports, [], 'file.exports'),
        created: toNumber(row.created_at, Date.now()),
        updated: toNumber(row.updated_at, Date.now())
      }

      // Update the file
      const updatedFileObject = {
        ...existingFile,
        ...fileData,
        updated: Date.now()
      }

      // Validate the updated file
      const validatedFile = await validateData(updatedFileObject, ProjectFileSchema, `file ${fileId}`)

      // Update in database
      const updateQuery = database.prepare(`
        UPDATE project_files
        SET name = ?, path = ?, extension = ?, size = ?, content = ?, 
            summary = ?, summary_last_updated = ?, meta = ?, checksum = ?,
            imports = ?, exports = ?, updated_at = ?
        WHERE id = ? AND project_id = ?
      `)

      updateQuery.run(
        validatedFile.name,
        validatedFile.path,
        validatedFile.extension,
        validatedFile.size,
        validatedFile.content,
        validatedFile.summary,
        validatedFile.summaryLastUpdated,
        validatedFile.meta,
        validatedFile.checksum,
        fromArray(validatedFile.imports),
        fromArray(validatedFile.exports),
        validatedFile.updated,
        validatedFile.id,
        validatedFile.projectId
      )

      return validatedFile
    } catch (error: any) {
      if (error instanceof ZodError || error instanceof ApiError) {
        throw error
      }
      console.error(`Error updating file ${fileId} in project ${projectId}:`, error)
      throw new ApiError(500, 'Failed to update project file', 'DB_UPDATE_ERROR', error)
    }
  },

  async readProjectFile(projectId: number, fileId: number): Promise<ProjectFile | undefined> {
    try {
      const db = getDb()
      const database = db.getDatabase()

      const query = database.prepare(`
        SELECT 
          id, project_id, name, path, extension, size, content, 
          summary, summary_last_updated, meta, checksum,
          imports, exports, created_at, updated_at
        FROM project_files
        WHERE id = ? AND project_id = ?
      `)

      const row = query.get(fileId, projectId) as any

      if (!row) {
        return undefined
      }

      const file: ProjectFile = {
        id: row.id,
        projectId: row.project_id,
        name: row.name,
        path: row.path,
        extension: row.extension,
        size: row.size,
        content: row.content,
        summary: row.summary,
        summaryLastUpdated: row.summary_last_updated,
        meta: row.meta,
        checksum: row.checksum,
        imports: toArray(row.imports, [], 'file.imports'),
        exports: toArray(row.exports, [], 'file.exports'),
        created: toNumber(row.created_at, Date.now()),
        updated: toNumber(row.updated_at, Date.now())
      }

      // Validate before returning
      try {
        return await validateData(file, ProjectFileSchema, `file ${fileId}`)
      } catch (error) {
        console.error(`Invalid file data for ${fileId} in project ${projectId}:`, error)
        return undefined
      }
    } catch (error: any) {
      console.error(`Error reading file ${fileId} from project ${projectId}:`, error)
      throw new ApiError(500, 'Failed to read project file', 'DB_READ_ERROR', error)
    }
  },

  async deleteProjectData(projectId: number): Promise<void> {
    try {
      const db = getDb()
      const database = db.getDatabase()

      database.transaction(() => {
        // Delete all files for this project
        database.prepare(`DELETE FROM project_files WHERE project_id = ?`).run(projectId)

        // Delete the project itself
        database.prepare(`DELETE FROM projects WHERE id = ?`).run(projectId)
      })()
    } catch (error: any) {
      console.error(`Error deleting project data for project ${projectId}:`, error)
      throw new ApiError(500, 'Failed to delete project data', 'DB_DELETE_ERROR', error)
    }
  },

  async getProjectFileArray(projectId: number): Promise<ProjectFile[]> {
    try {
      const db = getDb()
      const database = db.getDatabase()

      const query = database.prepare(`
        SELECT 
          id, project_id, name, path, extension, size, content, 
          summary, summary_last_updated, meta, checksum,
          imports, exports, created_at, updated_at
        FROM project_files
        WHERE project_id = ?
        ORDER BY created_at DESC
      `)

      const rows = query.all(projectId) as any[]

      // Convert rows to ProjectFile array
      const files: ProjectFile[] = []
      for (const row of rows) {
        const file: ProjectFile = {
          id: row.id,
          projectId: row.project_id,
          name: row.name,
          path: row.path,
          extension: row.extension,
          size: row.size,
          content: row.content,
          summary: row.summary,
          summaryLastUpdated: row.summary_last_updated,
          meta: row.meta,
          checksum: row.checksum,
          imports: toArray(row.imports, [], 'file.imports'),
          exports: toArray(row.exports, [], 'file.exports'),
          created: toNumber(row.created_at, Date.now()),
          updated: toNumber(row.updated_at, Date.now())
        }

        // Validate before adding
        try {
          const validatedFile = await validateData(file, ProjectFileSchema, `file ${file.id}`)
          files.push(validatedFile)
        } catch (error) {
          console.error(`Skipping invalid file ${file.id} in project ${projectId}:`, error)
          // Skip invalid files during migration period
          continue
        }
      }

      return files
    } catch (error: any) {
      console.error(`Error getting project file array for project ${projectId}:`, error)
      throw new ApiError(500, 'Failed to get project files', 'DB_READ_ERROR', error)
    }
  },

  generateId: (): number => {
    try {
      const db = getDb()
      return db.generateUniqueId('projects')
    } catch (error) {
      console.error(`CRITICAL: Failed to generate unique ID: ${error}`)
      throw new ApiError(500, 'Failed to generate a valid unique ID', 'ID_GENERATION_ERROR')
    }
  },

  generateFileId: (): number => {
    try {
      const db = getDb()
      return db.generateUniqueId('project_files')
    } catch (error) {
      console.error(`CRITICAL: Failed to generate unique file ID: ${error}`)
      throw new ApiError(500, 'Failed to generate a valid unique file ID', 'ID_GENERATION_ERROR')
    }
  }
}
