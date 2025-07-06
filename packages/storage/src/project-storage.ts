import { z, ZodError } from 'zod'
import { ProjectSchema, ProjectFileSchema, type ProjectFile, type Project } from '@promptliano/schemas'
import { unixTimestampSchema } from '@promptliano/schemas'
import { getDb } from './database-manager'
import { ApiError } from '@promptliano/shared'

// --- Schemas for Storage ---
export const ProjectsStorageSchema = z.record(z.string(), ProjectSchema)
export type ProjectsStorage = z.infer<typeof ProjectsStorageSchema>

export const ProjectFilesStorageSchema = z.record(z.string(), ProjectFileSchema)
export type ProjectFilesStorage = z.infer<typeof ProjectFilesStorageSchema>

export const projectStorage = {
  async readProjects(): Promise<ProjectsStorage> {
    try {
      const db = getDb()
      const projectsMap = await db.getAll<Project>('projects')

      // Convert Map to object format for backward compatibility
      const projectsObj: ProjectsStorage = {}
      for (const [id, project] of projectsMap) {
        // Validate each project before adding
        const validationResult = await ProjectSchema.safeParseAsync(project)
        if (validationResult.success) {
          projectsObj[id] = validationResult.data
        } else {
          console.error(`Skipping invalid project ${id}:`, validationResult.error.errors)
        }
      }

      return projectsObj
    } catch (error: any) {
      console.error('Error reading projects from database:', error)
      throw new ApiError(500, 'Failed to read projects from database', 'DB_READ_ERROR', error)
    }
  },

  async writeProjects(projects: ProjectsStorage): Promise<ProjectsStorage> {
    try {
      const db = getDb()

      // Clear and validate all projects first
      const validatedProjects: ProjectsStorage = {}
      for (const [id, project] of Object.entries(projects)) {
        const validationResult = ProjectSchema.safeParse(project)
        if (!validationResult.success) {
          console.error(`Validation failed for project ${id}:`, validationResult.error.errors)
          throw new ZodError(validationResult.error.errors)
        }
        validatedProjects[id] = validationResult.data
      }

      // Use transaction for atomic operation
      await db.clear('projects')
      for (const [id, project] of Object.entries(validatedProjects)) {
        await db.create('projects', id, project)
      }

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
      // Find all files for this project using JSON field indexing
      const files = await db.findByJsonField<ProjectFile>('project_files', '$.projectId', projectId)

      // Convert array to object format for backward compatibility
      const filesObj: ProjectFilesStorage = {}
      for (const file of files) {
        // Validate each file before adding
        const validationResult = await ProjectFileSchema.safeParseAsync(file)
        if (validationResult.success) {
          filesObj[file.id] = validationResult.data
        } else {
          console.error(`Skipping invalid file ${file.id}:`, validationResult.error.errors)
        }
      }

      return filesObj
    } catch (error: any) {
      console.error(`Error reading project files for project ${projectId}:`, error)
      throw new ApiError(500, 'Failed to read project files from database', 'DB_READ_ERROR', error)
    }
  },

  async writeProjectFiles(projectId: number, files: ProjectFilesStorage): Promise<ProjectFilesStorage> {
    try {
      const db = getDb()

      // Validate all files first
      const validatedFiles: ProjectFilesStorage = {}
      for (const [fileId, file] of Object.entries(files)) {
        const validationResult = ProjectFileSchema.safeParse(file)
        if (!validationResult.success) {
          console.error(`Validation failed for file ${fileId}:`, validationResult.error.errors)
          throw new ZodError(validationResult.error.errors)
        }

        // Ensure projectId is consistent
        if (validationResult.data.projectId !== projectId) {
          throw new ApiError(400, `File ${fileId} has mismatched projectId`, 'INVALID_PROJECT_ID')
        }

        validatedFiles[fileId] = validationResult.data
      }

      // Get existing files and delete them
      const existingFiles = await db.findByJsonField<ProjectFile>('project_files', '$.projectId', projectId)
      for (const file of existingFiles) {
        await db.delete('project_files', file.id.toString())
      }

      // Write all new files
      for (const [fileId, file] of Object.entries(validatedFiles)) {
        await db.create('project_files', fileId, file)
      }

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

      // Get the existing file
      const existingFile = await db.get<ProjectFile>('project_files', fileId.toString())
      if (!existingFile) {
        throw new ApiError(404, `File not found: ${fileId} in project ${projectId}`, 'FILE_NOT_FOUND')
      }

      // Verify the file belongs to the correct project
      if (existingFile.projectId !== projectId) {
        throw new ApiError(403, `File ${fileId} does not belong to project ${projectId}`, 'INVALID_PROJECT_ID')
      }

      // Update the file
      const updatedFileObject = {
        ...existingFile,
        ...fileData,
        updated: Date.now()
      }

      // Validate the updated file
      const validationResult = await ProjectFileSchema.safeParseAsync(updatedFileObject)
      if (!validationResult.success) {
        console.error(`Validation failed for file ${fileId} in project ${projectId}:`, validationResult.error.errors)
        throw new ZodError(validationResult.error.errors)
      }

      // Update in database
      const updateSuccess = await db.update('project_files', fileId.toString(), validationResult.data)
      if (!updateSuccess) {
        throw new ApiError(500, `Failed to update file ${fileId}`, 'DB_UPDATE_ERROR')
      }

      return validationResult.data
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
      const file = await db.get<ProjectFile>('project_files', fileId.toString())

      if (file && file.projectId === projectId) {
        // Validate before returning
        const validationResult = await ProjectFileSchema.safeParseAsync(file)
        if (validationResult.success) {
          return validationResult.data
        } else {
          console.error(`Invalid file data for ${fileId}:`, validationResult.error.errors)
          return undefined
        }
      }

      return undefined
    } catch (error: any) {
      console.error(`Error reading file ${fileId} from project ${projectId}:`, error)
      throw new ApiError(500, 'Failed to read project file', 'DB_READ_ERROR', error)
    }
  },

  async deleteProjectData(projectId: number): Promise<void> {
    try {
      const db = getDb()

      // Delete all files for this project
      const files = await db.findByJsonField<ProjectFile>('project_files', '$.projectId', projectId)
      for (const file of files) {
        await db.delete('project_files', file.id.toString())
      }

      // Delete the project itself
      await db.delete('projects', projectId.toString())
    } catch (error: any) {
      console.error(`Error deleting project data for project ${projectId}:`, error)
      throw new ApiError(500, 'Failed to delete project data', 'DB_DELETE_ERROR', error)
    }
  },

  async getProjectFileArray(projectId: number): Promise<ProjectFile[]> {
    try {
      const db = getDb()
      // Use the optimized JSON field query
      const files = await db.findByJsonField<ProjectFile>('project_files', '$.projectId', projectId)

      // Validate all files before returning
      const validFiles: ProjectFile[] = []
      for (const file of files) {
        const validationResult = await ProjectFileSchema.safeParseAsync(file)
        if (validationResult.success) {
          validFiles.push(validationResult.data)
        } else {
          console.error(`Skipping invalid file ${file.id}:`, validationResult.error.errors)
        }
      }

      // Sort by created date (newest first) to match original behavior
      return validFiles.sort((a, b) => b.created - a.created)
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
