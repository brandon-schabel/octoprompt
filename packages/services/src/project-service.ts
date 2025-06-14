import { projectStorage, type ProjectFilesStorage, ProjectFilesStorageSchema } from '@octoprompt/storage'
import {
  type CreateProjectBody,
  type Project,
  type ProjectFile,
  ProjectFileSchema,
  ProjectSchema,
  type UpdateProjectBody
} from '@octoprompt/schemas'
import path from 'path'
import { z, ZodError } from 'zod'

// TODO: Replace with Mastra hooks when ready
import { syncProject } from './file-services/file-sync-service-unified'
import {
  ApiError,
  requireEntity,
  buildSearchQuery,
  applySearchQuery,
  withServiceContext,
  ErrorFactories,
  type SearchQueryOptions
} from '@octoprompt/shared'
import { promptsMap } from '@octoprompt/shared'
import { buildProjectSummary } from '@octoprompt/shared'
import { resolvePath } from './utils/path-utils'
import { bulkCreate, bulkUpdate, bulkDelete } from './utils/bulk-operations'

// Existing project CRUD functions remain the same...
export async function createProject(data: CreateProjectBody): Promise<Project> {
  return withServiceContext(
    () =>
      projectStorage.create({
        name: data.name,
        path: data.path,
        description: data.description || ''
      }),
    {
      entityName: 'project',
      action: 'create'
    }
  )
}

export async function getProjectById(projectId: number): Promise<Project> {
  return withServiceContext(
    async () => {
      const project = await projectStorage.getById(projectId)
      return requireEntity(project, 'Project', projectId)
    },
    {
      entityName: 'project',
      action: 'retrieve',
      identifier: projectId
    }
  )
}

export async function listProjects(searchOptions?: SearchQueryOptions): Promise<Project[]> {
  return withServiceContext(
    async () => {
      const projects = await projectStorage.list()

      // Apply search/filtering if provided
      if (searchOptions) {
        return applySearchQuery(projects, searchOptions)
      }

      // Default sorting by updated timestamp
      projects.sort((a, b) => b.updated - a.updated)
      return projects
    },
    {
      entityName: 'projects',
      action: 'list'
    }
  )
}

export async function updateProject(projectId: number, data: UpdateProjectBody): Promise<Project | null> {
  return withServiceContext(
    async () => {
      const updated = await projectStorage.update(projectId, {
        name: data.name,
        path: data.path,
        description: data.description
      })

      return requireEntity(updated, 'Project', projectId)
    },
    {
      entityName: 'project',
      action: 'update',
      identifier: projectId
    }
  )
}

export async function deleteProject(projectId: number): Promise<boolean> {
  return withServiceContext(
    async () => {
      const deleted = await projectStorage.delete(projectId)

      if (!deleted) {
        throw ErrorFactories.dependency('Project', 'files or chats')
      }

      return true
    },
    {
      entityName: 'project',
      action: 'delete',
      identifier: projectId
    }
  )
}

// Alias for getProjectById for backward compatibility
export async function getProject(projectId: number): Promise<Project | null> {
  try {
    return await getProjectById(projectId)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null
    }
    throw error
  }
}

// UPDATED: Only return latest versions by default
export async function getProjectFiles(
  projectId: number,
  includeAllVersions: boolean = false,
  searchOptions?: SearchQueryOptions
): Promise<ProjectFile[] | null> {
  return withServiceContext(
    async () => {
      await getProjectById(projectId)
      let files = await projectStorage.getProjectFiles(projectId)

      if (!includeAllVersions) {
        // Only return latest versions
        files = files.filter((file) => file.isLatest)
      }

      // Apply search/filtering if provided
      if (searchOptions) {
        return applySearchQuery(files, searchOptions, (file, field) => {
          // Custom field accessor for project files
          switch (field) {
            case 'name':
              return file.name
            case 'path':
              return file.path
            case 'extension':
              return file.extension
            case 'content':
              return file.content
            default:
              return (file as any)[field]
          }
        })
      }

      return files.sort((a, b) => a.path.localeCompare(b.path) || a.version - b.version)
    },
    {
      entityName: 'project files',
      action: 'retrieve',
      identifier: projectId
    }
  ).catch((error) => {
    if (error instanceof ApiError && error.status === 404) {
      return null
    }
    throw error
  })
}

// NEW: Get project files without content for performance optimization
export async function getProjectFilesWithoutContent(
  projectId: number,
  includeAllVersions: boolean = false,
  searchOptions?: SearchQueryOptions
): Promise<Omit<ProjectFile, 'content'>[] | null> {
  return withServiceContext(
    async () => {
      await getProjectById(projectId)
      const files = await projectStorage.readProjectFiles(projectId)
      let fileList = Object.values(files)

      // Remove content from all files for performance
      const filesWithoutContent = fileList.map((file) => {
        const { content, ...fileWithoutContent } = file
        return fileWithoutContent
      })

      if (!includeAllVersions) {
        // Only return latest versions
        fileList = filesWithoutContent.filter((file) => file.isLatest)
      } else {
        fileList = filesWithoutContent
      }

      // Apply search/filtering if provided
      if (searchOptions) {
        return applySearchQuery(fileList, searchOptions, (file, field) => {
          switch (field) {
            case 'name':
              return file.name
            case 'path':
              return file.path
            case 'extension':
              return file.extension
            default:
              return (file as any)[field]
          }
        })
      }

      return fileList.sort((a, b) => a.path.localeCompare(b.path) || a.version - b.version)
    },
    {
      entityName: 'project files without content',
      action: 'retrieve',
      identifier: projectId
    }
  ).catch((error) => {
    if (error instanceof ApiError && error.status === 404) {
      return null
    }
    throw error
  })
}

// Update file content directly
export async function updateFileContent(
  projectId: number,
  fileId: number,
  content: string,
  options?: { updated?: Date }
): Promise<ProjectFile> {
  return withServiceContext(
    async () => {
      await getProjectById(projectId)

      // Update the file directly
      const fileStorage = projectStorage.getFileStorage(projectId)
      const updatedFile = await fileStorage.update(fileId, { content })

      const result = requireEntity(updatedFile, 'File', fileId)

      console.log(`Updated file ${fileId} in project ${projectId}`)
      return result
    },
    {
      entityName: 'file content',
      action: 'update',
      identifier: `${projectId}/${fileId}`
    }
  )
}

export async function createProjectFileRecord(
  projectId: number,
  filePath: string,
  initialContent: string = ''
): Promise<ProjectFile> {
  return withServiceContext(
    async () => {
      const project = await getProjectById(projectId)
      const absoluteProjectPath = resolvePath(project.path)
      const absoluteFilePath = resolvePath(
        filePath.startsWith('/') || filePath.startsWith('~') || path.isAbsolute(filePath)
          ? filePath
          : path.join(absoluteProjectPath, filePath)
      )
      const normalizedRelativePath = path.relative(absoluteProjectPath, absoluteFilePath)

      const fileName = path.basename(normalizedRelativePath)
      const fileExtension = path.extname(normalizedRelativePath)
      const size = Buffer.byteLength(initialContent, 'utf8')

      const newFile = await projectStorage.addFile(projectId, {
        name: fileName,
        path: normalizedRelativePath,
        extension: fileExtension,
        size: size,
        content: initialContent,
        summary: null,
        summaryLastUpdated: null,
        meta: '{}',
        checksum: null,
        // New versioning fields
        version: 1,
        prevId: null,
        nextId: null,
        isLatest: true,
        originalFileId: null, // This is the original file
        // Sync tracking fields
        lastSyncedAt: null,
        syncVersion: 0
      })

      return newFile
    },
    {
      entityName: 'project file record',
      action: 'create',
      identifier: projectId
    }
  )
}

export interface FileSyncData {
  path: string
  name: string
  extension: string
  content: string
  size: number
  checksum: string
}

export async function bulkCreateProjectFiles(projectId: number, filesToCreate: FileSyncData[]): Promise<ProjectFile[]> {
  if (filesToCreate.length === 0) return []
  await getProjectById(projectId)
  const now = Date.now()

  return withServiceContext(
    async () => {
      const existingFiles = await projectStorage.getProjectFiles(projectId)

      // Filter out duplicates
      const uniqueFilesToCreate = filesToCreate.filter((fileData) => {
        const existingByPath = existingFiles.find((f) => f.path === fileData.path && f.isLatest)
        if (existingByPath) {
          console.warn(
            `[ProjectService] Skipping duplicate path in bulk create: ${fileData.path} in project ${projectId}`
          )
          return false
        }
        return true
      })

      const result = await bulkCreate(uniqueFilesToCreate, (fileData) =>
        projectStorage.addFile(projectId, {
          name: fileData.name,
          path: fileData.path,
          extension: fileData.extension,
          size: fileData.size,
          content: fileData.content,
          summary: null,
          summaryLastUpdated: null,
          meta: '{}',
          checksum: fileData.checksum,
          // New versioning fields
          version: 1,
          prevId: null,
          nextId: null,
          isLatest: true,
          originalFileId: null,
          // Sync tracking fields
          lastSyncedAt: now, // Initial sync is now
          syncVersion: 1 // First sync version
        })
      )

      return result.succeeded
    },
    {
      entityName: 'project files',
      action: 'bulk create',
      identifier: projectId
    }
  )
}

// UPDATED: Bulk update now creates new versions for each file
export async function bulkUpdateProjectFiles(
  projectId: number,
  updates: { fileId: number; data: FileSyncData }[]
): Promise<ProjectFile[]> {
  if (updates.length === 0) return []
  await getProjectById(projectId)

  return withServiceContext(
    async () => {
      const fileStorage = projectStorage.getFileStorage(projectId)

      const result = await bulkUpdate(updates, (fileId, data) =>
        fileStorage.createVersion(fileId, data.content, {
          extension: data.extension,
          size: data.size,
          checksum: data.checksum
        })
      )

      return result.succeeded
    },
    {
      entityName: 'project files',
      action: 'bulk update',
      identifier: projectId
    }
  )
}

// NEW: Bulk update for sync operations without creating versions
// Special sync function that updates files WITHOUT creating versions
// This is used by file sync operations to keep the database in sync with the file system
// Versioning is only used for explicit user edits through the API, not for filesystem sync
export async function bulkUpdateProjectFilesForSync(
  projectId: number,
  updates: { fileId: number; data: FileSyncData }[]
): Promise<ProjectFile[]> {
  if (updates.length === 0) return []
  await getProjectById(projectId)

  return withServiceContext(
    async () => {
      const fileStorage = projectStorage.getFileStorage(projectId)

      const result = await bulkUpdate(
        updates,
        async (fileId, data) => {
          // Get current file to preserve sync version
          const currentFile = await fileStorage.getById(fileId)
          if (!currentFile) {
            console.warn(`[ProjectService] File ${fileId} not found during sync update`)
            return null
          }
          const currentSyncVersion = currentFile.syncVersion || 0

          // Direct update without versioning - sync operations should not create versions
          // as they represent the current state of the filesystem, not user edits
          return fileStorage.update(fileId, {
            content: data.content,
            extension: data.extension,
            size: data.size,
            checksum: data.checksum,
            lastSyncedAt: Date.now(),
            syncVersion: currentSyncVersion + 1
          })
        },
        {
          validateExists: (fileId) => fileStorage.getById(fileId).then((f) => f !== null)
        }
      )

      return result.succeeded.filter((f): f is ProjectFile => f !== null)
    },
    {
      entityName: 'project files',
      action: 'bulk sync update',
      identifier: projectId
    }
  )
}

export async function bulkDeleteProjectFiles(
  projectId: number,
  fileIdsToDelete: number[]
): Promise<{ deletedCount: number }> {
  if (fileIdsToDelete.length === 0) {
    return { deletedCount: 0 }
  }
  await getProjectById(projectId)

  return withServiceContext(
    async () => {
      const fileStorage = projectStorage.getFileStorage(projectId)

      const result = await bulkDelete(
        fileIdsToDelete,
        async (fileId) => {
          try {
            return await fileStorage.delete(fileId)
          } catch (error: any) {
            // If it's a file system error (like ENOENT), consider it as already deleted
            if (error.code === 'ENOENT' || error.message?.includes('ENOENT')) {
              console.warn(`File ${fileId} already deleted or missing, continuing...`)
              return true
            }
            throw error
          }
        },
        {
          continueOnError: true,
          validateExists: async (fileId) => {
            const file = await fileStorage.getById(fileId)
            return file !== null
          }
        }
      )

      return { deletedCount: result.deletedCount }
    },
    {
      entityName: 'project files',
      action: 'bulk delete',
      identifier: projectId
    }
  )
}

export async function getProjectFilesByIds(
  projectId: number,
  fileIds: number[],
  includeAllVersions: boolean = false
): Promise<ProjectFile[]> {
  if (!fileIds || fileIds.length === 0) {
    return []
  }

  return withServiceContext(
    async () => {
      await getProjectById(projectId)
      const uniqueFileIds = [...new Set(fileIds)]
      const fileStorage = projectStorage.getFileStorage(projectId)
      const resultFiles: ProjectFile[] = []

      for (const id of uniqueFileIds) {
        const file = await fileStorage.getById(id)
        if (file) {
          // If not including all versions, only add files that are latest versions
          if (includeAllVersions || file.isLatest !== false) {
            resultFiles.push(file)
          } else {
            console.warn(
              `[getProjectFilesByIds] Skipping non-latest version file: ${file.path} (ID: ${id}, version: ${file.version}) in project ${projectId}`
            )
          }
        }
      }
      return resultFiles
    },
    {
      entityName: 'project files',
      action: 'fetch by IDs',
      identifier: projectId
    }
  )
}

export async function optimizeUserInput(projectId: number, userContext: string): Promise<string> {
  return withServiceContext(
    async () => {
      const projectSummary = await buildProjectSummary((await projectStorage.getProjectFileArray(projectId)) ?? [])

      const systemMessage = `
<SystemPrompt>
You are the Promptimizer, a specialized assistant that refines or rewrites user queries into
more effective prompts based on the project context. Given the user's context or goal, output ONLY the single optimized prompt.
No additional commentary, no extraneous text, no markdown formatting.
</SystemPrompt>

<ProjectSummary>
${projectSummary}
</ProjectSummary>

<Reasoning>
Follow the style guidelines and key requirements below:
${promptsMap.contemplativePrompt}
</Reasoning>
`

      const userMessage = userContext.trim()
      if (!userMessage) {
        return ''
      }

      // TODO: Replace with Mastra prompt optimization service when ready
      const optimizedPrompt = `Optimized: ${userMessage}`

      return optimizedPrompt.trim()
    },
    {
      entityName: 'user input',
      action: 'optimize',
      identifier: projectId
    }
  )
}

export async function suggestFiles(projectId: number, prompt: string, limit: number = 10): Promise<ProjectFile[]> {
  return withServiceContext(
    async () => {
      // Get project and validate it exists
      await getProjectById(projectId)

      // Get all project files
      const allFiles = await getProjectFiles(projectId)
      if (!allFiles || allFiles.length === 0) {
        return []
      }

      // Use search functionality to find relevant files
      const searchQuery = buildSearchQuery({
        search: prompt,
        searchFields: ['name', 'path', 'content'],
        limit: limit,
        sortBy: 'updated',
        sortOrder: 'desc'
      })

      const suggestedFiles = applySearchQuery(allFiles, searchQuery, (file, field) => {
        switch (field) {
          case 'name':
            return file.name
          case 'path':
            return file.path
          case 'content':
            return file.content
          case 'extension':
            return file.extension
          default:
            return (file as any)[field]
        }
      })

      return suggestedFiles
    },
    {
      entityName: 'file suggestions',
      action: 'generate',
      identifier: projectId
    }
  )
}
