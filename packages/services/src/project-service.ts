import {
  type CreateProjectBody,
  type Project,
  ProjectSchema,
  type UpdateProjectBody,
  type ProjectFile,
  ProjectFileSchema,
  type APIProviders,
  FileSuggestionsZodSchema,
  type ImportInfo,
  type ExportInfo
} from '@promptliano/schemas'
import {
  MAX_FILE_SIZE_FOR_SUMMARY,
  MAX_TOKENS_FOR_SUMMARY,
  CHARS_PER_TOKEN_ESTIMATE,
  MEDIUM_MODEL_CONFIG
} from '@promptliano/config'
import { LOW_MODEL_CONFIG, HIGH_MODEL_CONFIG } from '@promptliano/config'
import { ApiError, promptsMap, FILE_SUMMARIZATION_LIMITS, needsResummarization } from '@promptliano/shared'
import { projectStorage, ProjectFilesStorageSchema, type ProjectFilesStorage } from '@promptliano/storage'
import z, { ZodError } from 'zod'
import { syncProject } from './file-services/file-sync-service-unified'
import { generateStructuredData, generateSingleText } from './gen-ai-services'
import { getFullProjectSummary, invalidateProjectSummaryCache } from './utils/project-summary-service'
import { resolvePath } from './utils/path-utils'
import { fileRelevanceService } from './file-relevance-service'
import { CompactFileFormatter } from './utils/compact-file-formatter'
import path from 'node:path'
import { removeDeletedFileIdsFromTickets, listTicketsByProject, listTicketsWithTaskCount } from './ticket-service'
import { retryOperation } from './utils/retry-operation'
import { createLogger } from './utils/logger'
import { cleanupProjectMCPServers } from './mcp-service'
import { getCompactProjectSummary } from './utils/project-summary-service'
import { getActiveTab } from './active-tab-service'
import { listPromptsByProject } from './prompt-service'
import { getProjectStatistics } from './project-statistics-service'
import { getProjectGitStatus, getCurrentBranch } from './git-service'
import { fileSummarizationTracker, getSummarizationStats } from './file-summarization-tracker'

const logger = createLogger('ProjectService')

// Helper function to retry file system operations
async function retryFileOperation<T>(operation: () => Promise<T>): Promise<T> {
  return retryOperation(operation, {
    maxAttempts: 3,
    shouldRetry: (error) => {
      // Retry on common file system errors
      return (
        error.code === 'EBUSY' ||
        error.code === 'EAGAIN' ||
        error.code === 'EACCES' ||
        error.code === 'EMFILE' || // Too many open files
        error.code === 'ENFILE'
      ) // File table overflow
    }
  })
}

export async function createProject(data: CreateProjectBody): Promise<Project> {
  const now = Date.now()

  try {
    const projectId = projectStorage.generateId()

    const newProjectData: Project = {
      id: projectId,
      name: data.name,
      path: data.path,
      description: data.description || '',
      created: now,
      updated: now
    }

    const validatedProject = ProjectSchema.parse(newProjectData)

    const existingProjectsObject = await projectStorage.readProjects()
    const projectsMap = new Map<number, Project>(
      Object.entries(existingProjectsObject).map(([id, proj]) => [Number(id), proj as Project])
    )

    projectsMap.set(validatedProject.id, validatedProject)

    await retryFileOperation(() => projectStorage.writeProjects(Object.fromEntries(projectsMap)))
    await retryFileOperation(() => projectStorage.writeProjectFiles(validatedProject.id, {}))

    return validatedProject
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (error instanceof ZodError) {
      throw new ApiError(
        500,
        `Internal validation failed creating project: ${error.message}`,
        'PROJECT_VALIDATION_ERROR_INTERNAL',
        error.flatten().fieldErrors
      )
    }
    throw new ApiError(
      500,
      `Failed to create project ${data.name}. Reason: ${error instanceof Error ? error.message : String(error)}`,
      'PROJECT_CREATION_FAILED'
    )
  }
}

export async function getProjectById(projectId: number): Promise<Project> {
  try {
    const projects = await projectStorage.readProjects()
    const project = projects[projectId]
    if (!project) {
      throw new ApiError(404, `Project not found with ID ${projectId}.`, 'PROJECT_NOT_FOUND')
    }
    return project
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Error getting project ${projectId}: ${error instanceof Error ? error.message : String(error)}`,
      'PROJECT_GET_FAILED_STORAGE'
    )
  }
}

/**
 * Alias for getProjectById for backward compatibility
 */
export async function getProject(projectId: number): Promise<Project> {
  return getProjectById(projectId)
}

export async function listProjects(): Promise<Project[]> {
  try {
    const projects = await projectStorage.readProjects()
    const projectList = Object.values(projects)
    projectList.sort((a, b) => b.updated - a.updated)
    return projectList
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to list projects. Reason: ${error instanceof Error ? error.message : String(error)}`,
      'PROJECT_LIST_FAILED'
    )
  }
}

export async function updateProject(projectId: number, data: UpdateProjectBody): Promise<Project | null> {
  try {
    const existingProject = await getProjectById(projectId)
    const projects = await projectStorage.readProjects()

    const updatedProjectData: Project = {
      ...existingProject,
      name: data.name ?? existingProject.name,
      path: data.path ?? existingProject.path,
      description: data.description ?? existingProject.description,
      updated: Date.now()
    }

    const validatedProject = ProjectSchema.parse(updatedProjectData)

    projects[projectId] = validatedProject
    await projectStorage.writeProjects(projects)

    return validatedProject
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (error instanceof ZodError) {
      throw new ApiError(
        500,
        `Internal validation failed updating project ${projectId}: ${error.message}`,
        'PROJECT_VALIDATION_ERROR_INTERNAL',
        error.flatten().fieldErrors
      )
    }
    throw new ApiError(
      500,
      `Failed to update project ${projectId}. Reason: ${error instanceof Error ? error.message : String(error)}`,
      'PROJECT_UPDATE_FAILED'
    )
  }
}

export async function deleteProject(projectId: number): Promise<boolean> {
  try {
    const projects = await projectStorage.readProjects()
    if (!projects[projectId]) {
      throw new ApiError(404, `Project not found with ID ${projectId} for deletion.`, 'PROJECT_NOT_FOUND')
    }

    delete projects[projectId]
    await projectStorage.writeProjects(projects)

    await projectStorage.deleteProjectData(projectId)

    // Clean up MCP servers for this project
    await cleanupProjectMCPServers(projectId)

    return true
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to delete project ${projectId}. Reason: ${error instanceof Error ? error.message : String(error)}`,
      'PROJECT_DELETE_FAILED'
    )
  }
}

export async function getProjectFiles(
  projectId: number,
  options?: { limit?: number; offset?: number }
): Promise<ProjectFile[] | null> {
  try {
    await getProjectById(projectId) // Throws 404 if project not found
    const files = await projectStorage.readProjectFiles(projectId)
    const allFiles = Object.values(files)
    // Apply pagination if specified
    if (options?.limit !== undefined || options?.offset !== undefined) {
      const offset = options.offset || 0
      const limit = options.limit || allFiles.length
      return allFiles.slice(offset, offset + limit)
    }
    return allFiles
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null // Maintain original behavior of returning null for not found project
    }
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to get files for project ${projectId}. Reason: ${error instanceof Error ? error.message : String(error)}`,
      'PROJECT_FILES_GET_FAILED'
    )
  }
}

export async function updateFileContent(
  projectId: number,
  fileId: number,
  content: string,
  options?: { updated?: Date }
): Promise<ProjectFile> {
  try {
    const files = await projectStorage.readProjectFiles(projectId)
    const existingFile = files[fileId]

    if (!existingFile) {
      throw new ApiError(
        404,
        `File not found with ID ${fileId} in project ${projectId} during content update.`,
        'FILE_NOT_FOUND'
      )
    }

    const newUpdatedAt = options?.updated?.getTime() ?? Date.now()

    const updatedFileData: ProjectFile = {
      ...existingFile,
      content: content,
      size: Buffer.byteLength(content, 'utf8'),
      updated: newUpdatedAt
      // checksum: calculateChecksum(content),
    }

    const validatedFile = ProjectFileSchema.parse(updatedFileData)

    files[fileId] = validatedFile
    await retryFileOperation(() => projectStorage.writeProjectFiles(projectId, files))

    // Invalidate cache when file content is updated
    invalidateProjectSummaryCache(projectId)

    return validatedFile
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (error instanceof ZodError) {
      throw new ApiError(
        500,
        `Internal validation failed for file content ${fileId}: ${error.message}`,
        'FILE_VALIDATION_ERROR_INTERNAL',
        error.flatten().fieldErrors
      )
    }
    throw new ApiError(
      500,
      `Failed to update file content for ${fileId}. Reason: ${error instanceof Error ? error.message : String(error)}`,
      'FILE_CONTENT_UPDATE_FAILED'
    )
  }
}

export async function resummarizeAllFiles(projectId: number): Promise<void> {
  const project = await getProjectById(projectId)
  await syncProject(project)

  const allFiles = await getProjectFiles(projectId)
  if (!allFiles || allFiles.length === 0) {
    console.warn(`[ProjectService] No files found for project ${projectId} after sync during resummarize all.`)
    return
  }

  try {
    await summarizeFiles(
      projectId,
      allFiles.map((f) => f.id)
    )

    logger.info(`Completed resummarizeAllFiles and saved updates for project ${projectId}`)
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed during resummarization process for project ${projectId}. Reason: ${error instanceof Error ? error.message : String(error)}`,
      'RESUMMARIZE_ALL_FAILED'
    )
  }
}

export async function removeSummariesFromFiles(
  projectId: number,
  fileIds: number[]
): Promise<{ removedCount: number; message: string }> {
  if (fileIds.length === 0) {
    return { removedCount: 0, message: 'No file IDs provided' }
  }
  try {
    await getProjectById(projectId) // Check for project existence
    const files = await projectStorage.readProjectFiles(projectId)
    let removedCount = 0
    const now = Date.now()
    let changesMade = false

    for (const fileId of fileIds) {
      if (files[fileId]) {
        const file = files[fileId]
        if (file.summary !== null || file.summaryLastUpdated !== null) {
          const updatedFileData: ProjectFile = {
            ...file,
            summary: null,
            summaryLastUpdated: null,
            updated: now
          }
          files[fileId] = ProjectFileSchema.parse(updatedFileData)
          removedCount++
          changesMade = true
        }
      } else {
        console.warn(`[ProjectService] File ID ${fileId} not found in project ${projectId} for remove summary.`)
      }
    }

    if (changesMade) {
      const validatedMap = ProjectFilesStorageSchema.parse(files)
      await retryFileOperation(() => projectStorage.writeProjectFiles(projectId, validatedMap))
    }

    return {
      removedCount: removedCount,
      message: `Removed summaries from ${removedCount} files.`
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (error instanceof ZodError) {
      throw new ApiError(
        500,
        `Internal validation failed removing summaries for project ${projectId}: ${error.message}`,
        'PROJECT_VALIDATION_ERROR_INTERNAL',
        error.flatten().fieldErrors
      )
    }
    throw new ApiError(
      500,
      `Error removing summaries: ${error instanceof Error ? error.message : String(error)}`,
      'REMOVE_SUMMARIES_FAILED'
    )
  }
}

export async function createProjectFileRecord(
  projectId: number,
  filePath: string,
  initialContent: string = ''
): Promise<ProjectFile> {
  const project = await getProjectById(projectId)
  const absoluteProjectPath = resolvePath(project.path)
  const absoluteFilePath = resolvePath(
    filePath.startsWith('/') || filePath.startsWith('~') || path.isAbsolute(filePath)
      ? filePath
      : path.join(absoluteProjectPath, filePath)
  )
  const normalizedRelativePath = path.relative(absoluteProjectPath, absoluteFilePath)

  const now = Date.now()
  const fileName = path.basename(normalizedRelativePath)
  const fileExtension = path.extname(normalizedRelativePath)
  const size = Buffer.byteLength(initialContent, 'utf8')

  try {
    const fileId = projectStorage.generateFileId()

    const newFileData: ProjectFile = {
      id: fileId,
      projectId: projectId,
      name: fileName,
      path: normalizedRelativePath,
      extension: fileExtension,
      size: size,
      content: initialContent,
      summary: null,
      summaryLastUpdated: null,
      meta: '{}',
      checksum: null,
      imports: null,
      exports: null,
      created: now,
      updated: now
    }

    const validatedFile = ProjectFileSchema.parse(newFileData)

    const files = await projectStorage.readProjectFiles(projectId)
    files[fileId] = validatedFile

    // even though the keys are numbers, they are saved as string because that is default javascript behavior
    const validatedMap = ProjectFilesStorageSchema.parse(files)
    await retryFileOperation(() => projectStorage.writeProjectFiles(projectId, validatedMap))

    // Invalidate cache when a new file is created
    invalidateProjectSummaryCache(projectId)

    return validatedFile
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (error instanceof ZodError) {
      throw new ApiError(
        500,
        `Internal validation failed creating file record for ${filePath}: ${error.message}`,
        'FILE_VALIDATION_ERROR_INTERNAL',
        error.flatten().fieldErrors
      )
    }
    throw new ApiError(
      500,
      `Failed to create file record for ${filePath}. Reason: ${error instanceof Error ? error.message : String(error)}`,
      'PROJECT_FILE_CREATE_FAILED'
    )
  }
}

/** Represents the data needed to create or update a file record during sync. */
export interface FileSyncData {
  path: string
  name: string
  extension: string
  content: string
  size: number
  checksum: string
  imports?: ImportInfo[] | null
  exports?: ExportInfo[] | null
}

/** Creates multiple file records in the project's JSON file. */
export async function bulkCreateProjectFiles(projectId: number, filesToCreate: FileSyncData[]): Promise<ProjectFile[]> {
  if (filesToCreate.length === 0) return []
  await getProjectById(projectId)
  const createdFiles: ProjectFile[] = []
  const now = Date.now()
  let filesMap: ProjectFilesStorage

  try {
    filesMap = await projectStorage.readProjectFiles(projectId)

    // Generate bulk IDs to avoid conflicts
    const { getDb } = await import('@promptliano/storage')
    const db = getDb()
    const fileIds = db.generateBulkIds('project_files', filesToCreate.length)
    let idIndex = 0

    for (const fileData of filesToCreate) {
      const existingInMapByPath = Object.values(filesMap).find((f) => f.path === fileData.path)

      if (existingInMapByPath) {
        console.warn(
          `[ProjectService] Skipping duplicate path in bulk create: ${fileData.path} in project ${projectId}`
        )
        continue
      }

      const fileId = fileIds[idIndex++]
      if (!fileId) {
        logger.error(`No file ID available for ${fileData.path}`)
        continue
      }

      const newFileData: ProjectFile = {
        id: fileId,
        projectId: projectId,
        name: fileData.name,
        path: fileData.path,
        extension: fileData.extension,
        size: fileData.size,
        content: fileData.content,
        summary: null,
        summaryLastUpdated: null,
        meta: '{}',
        checksum: fileData.checksum,
        imports: fileData.imports || null,
        exports: fileData.exports || null,
        created: now,
        updated: now
      }

      try {
        const validatedFile = ProjectFileSchema.parse(newFileData)

        filesMap[validatedFile.id] = validatedFile
        createdFiles.push(validatedFile)
      } catch (validationError) {
        logger.error(
          `Validation failed for file ${fileData.path} during bulk create`,
          validationError instanceof ZodError ? validationError.flatten().fieldErrors : validationError
        )
        continue
      }
    }

    if (createdFiles.length > 0) {
      const validatedMap = ProjectFilesStorageSchema.parse(filesMap)
      await retryFileOperation(() => projectStorage.writeProjectFiles(projectId, validatedMap))
      // Invalidate cache when files are created
      invalidateProjectSummaryCache(projectId)
    }

    return createdFiles
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (error instanceof ZodError) {
      throw new ApiError(
        500,
        `Internal validation of project files map failed during bulk create for project ${projectId}: ${error.message}`,
        'PROJECT_FILES_MAP_VALIDATION_ERROR_INTERNAL',
        error.flatten().fieldErrors
      )
    }
    throw new ApiError(
      500,
      `Bulk file creation failed for project ${projectId}. Some files might be created. Reason: ${error instanceof Error ? error.message : String(error)}`,
      'PROJECT_BULK_CREATE_FAILED'
    )
  }
}

/** Updates multiple existing file records based on their IDs. */
export async function bulkUpdateProjectFiles(
  projectId: number,
  updates: { fileId: number; data: FileSyncData }[]
): Promise<ProjectFile[]> {
  if (updates.length === 0) return []
  await getProjectById(projectId)
  const updatedFilesResult: ProjectFile[] = []
  const now = Date.now()
  let files: ProjectFilesStorage
  let changesMade = false

  try {
    files = await projectStorage.readProjectFiles(projectId)

    for (const { fileId, data } of updates) {
      const existingFile = files[fileId]
      if (!existingFile) {
        console.warn(
          `[ProjectService] File ID ${fileId} not found during bulk update for project ${projectId}. Skipping.`
        )
        continue
      }

      const updatedFileData: ProjectFile = {
        ...existingFile,
        content: data.content,
        extension: data.extension,
        size: data.size,
        checksum: data.checksum,
        imports: data.imports !== undefined ? data.imports : existingFile.imports,
        exports: data.exports !== undefined ? data.exports : existingFile.exports,
        updated: now
      }

      try {
        const validatedFile = ProjectFileSchema.parse(updatedFileData)
        files[fileId] = validatedFile
        updatedFilesResult.push(validatedFile)
        changesMade = true
      } catch (validationError) {
        logger.error(
          `Validation failed for file ${fileId} (${existingFile.path}) during bulk update`,
          validationError instanceof ZodError ? validationError.flatten().fieldErrors : validationError
        )
        continue
      }
    }

    if (changesMade) {
      const validatedMap = ProjectFilesStorageSchema.parse(files)
      await retryFileOperation(() => projectStorage.writeProjectFiles(projectId, validatedMap))
      // Invalidate cache when files are updated
      invalidateProjectSummaryCache(projectId)
    }

    return updatedFilesResult
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (error instanceof ZodError) {
      throw new ApiError(
        500,
        `Internal validation of project files map failed during bulk update for project ${projectId}: ${error.message}`,
        'PROJECT_FILES_MAP_VALIDATION_ERROR_INTERNAL',
        error.flatten().fieldErrors
      )
    }
    throw new ApiError(
      500,
      `Bulk file update failed for project ${projectId}. Some files might be updated. Reason: ${error instanceof Error ? error.message : String(error)}`,
      'PROJECT_BULK_UPDATE_FAILED'
    )
  }
}

/** Deletes multiple files by their IDs for a specific project. */
export async function bulkDeleteProjectFiles(
  projectId: number,
  fileIdsToDelete: number[]
): Promise<{ deletedCount: number }> {
  if (fileIdsToDelete.length === 0) {
    return { deletedCount: 0 }
  }
  await getProjectById(projectId)
  let files: ProjectFilesStorage
  let deletedCount = 0
  let changesMade = false

  try {
    files = await projectStorage.readProjectFiles(projectId)

    for (const fileId of fileIdsToDelete) {
      if (files[fileId]) {
        delete files[fileId]
        deletedCount++
        changesMade = true
      } else {
        console.warn(`[ProjectService] File ID ${fileId} not found during bulk delete for project ${projectId}.`)
      }
    }

    if (changesMade) {
      const validatedMap = ProjectFilesStorageSchema.parse(files)
      await retryFileOperation(() => projectStorage.writeProjectFiles(projectId, validatedMap))

      // Invalidate cache when files are deleted
      invalidateProjectSummaryCache(projectId)

      // Clean up file references in tickets
      const ticketCleanupResult = await removeDeletedFileIdsFromTickets(projectId, fileIdsToDelete)
      if (ticketCleanupResult.updatedTickets > 0) {
        logger.info(
          `Cleaned up file references in ${ticketCleanupResult.updatedTickets} tickets for project ${projectId}`
        )
      }
    }

    return { deletedCount }
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (error instanceof ZodError) {
      throw new ApiError(
        500,
        `Internal validation of project files map failed during bulk delete for project ${projectId}: ${error.message}`,
        'PROJECT_FILES_MAP_VALIDATION_ERROR_INTERNAL',
        error.flatten().fieldErrors
      )
    }
    throw new ApiError(
      500,
      `Bulk file deletion failed for project ${projectId}. Reason: ${error instanceof Error ? error.message : String(error)}`,
      'PROJECT_BULK_DELETE_FAILED'
    )
  }
}

/** Retrieves specific files by ID for a project */
export async function getProjectFilesByIds(projectId: number, fileIds: number[]): Promise<ProjectFile[]> {
  if (!fileIds || fileIds.length === 0) {
    return []
  }
  await getProjectById(projectId)
  const uniqueFileIds = [...new Set(fileIds)]

  try {
    const filesMap = await projectStorage.readProjectFiles(projectId)
    const resultFiles: ProjectFile[] = []

    for (const id of uniqueFileIds) {
      if (filesMap[id]) {
        resultFiles.push(filesMap[id])
      }
    }
    return resultFiles
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to fetch files by IDs for project ${projectId}. Reason: ${error instanceof Error ? error.message : String(error)}`,
      'PROJECT_FILES_GET_BY_IDS_FAILED'
    )
  }
}

/** Summarizes a single file if it meets conditions and updates the project's file storage. */
export async function summarizeSingleFile(file: ProjectFile, force: boolean = false): Promise<ProjectFile | null> {
  // Check if file needs summarization based on timestamp
  const summarizationCheck = needsResummarization(file.summaryLastUpdated, force)

  if (!summarizationCheck.needsSummarization) {
    logger.debug(
      `Skipping file ${file.path} (ID: ${file.id}) in project ${file.projectId}: ${summarizationCheck.reason}`
    )
    return null
  }

  logger.debug(`Processing file ${file.path} (ID: ${file.id}): ${summarizationCheck.reason}`)

  const fileContent = file.content || ''

  if (!fileContent.trim()) {
    console.warn(
      `[SummarizeSingleFile] File ${file.path} (ID: ${file.id}) in project ${file.projectId} is empty, skipping summarization.`
    )
    return null
  }

  // Check if file size exceeds limit
  if (file.size > MAX_FILE_SIZE_FOR_SUMMARY) {
    console.warn(
      `[SummarizeSingleFile] File ${file.path} (ID: ${file.id}) in project ${file.projectId} is too large (${file.size} bytes), skipping summarization.`
    )
    return null
  }

  // Estimate token count and check if content is too long
  const estimatedTokens = Math.ceil(fileContent.length / CHARS_PER_TOKEN_ESTIMATE)
  if (estimatedTokens > MAX_TOKENS_FOR_SUMMARY) {
    console.warn(
      `[SummarizeSingleFile] File ${file.path} (ID: ${file.id}) content is too long (estimated ${estimatedTokens} tokens), truncating for summarization.`
    )
    // Truncate content to fit within token limit
    const maxChars = MAX_TOKENS_FOR_SUMMARY * CHARS_PER_TOKEN_ESTIMATE
    const truncatedContent = fileContent.substring(0, maxChars) + '\n\n[... content truncated for summarization ...]'
    return summarizeTruncatedFile(file, truncatedContent)
  }

  // Check if content was already truncated during file sync
  const wasTruncatedDuringSync = fileContent.includes(FILE_SUMMARIZATION_LIMITS.TRUNCATION_SUFFIX)

  const importsContext = file.imports?.length
    ? `The file imports from: ${[...new Set(file.imports.map((i) => i.source))].join(', ')}`
    : ''

  const exportsContext = file.exports?.length
    ? `The file exports: ${file.exports
      .map((e) => {
        if (e.type === 'default') return 'default export'
        if (e.type === 'all') return `all from ${e.source}`
        return e.specifiers?.map((s) => s.exported).join(', ') || 'named exports'
      })
      .join(', ')}`
    : ''

  const systemPrompt = `
  ## You are a coding assistant specializing in concise code summaries.
  1. Provide a short overview of what the file does.
  2. Outline main exports (functions/classes).
  3. Respond with only the textual summary, minimal fluff, no suggestions or code blocks.
  ${importsContext ? `4. ${importsContext}` : ''}
  ${exportsContext ? `5. ${exportsContext}` : ''}
  ${wasTruncatedDuringSync ? '6. Note: This file was truncated for summarization, so the summary may be incomplete.' : ''}
  `

  const cfg = LOW_MODEL_CONFIG
  const provider = (cfg.provider as APIProviders) || 'openrouter'
  const modelId = cfg.model

  if (!modelId) {
    logger.error(`Model not configured for summarize-file task for file ${file.path}.`)
    throw new ApiError(
      500,
      `AI Model not configured for summarize-file task (file ${file.path}).`,
      'AI_MODEL_NOT_CONFIGURED',
      { projectId: file.projectId, fileId: file.id }
    )
  }

  try {
    const result = await generateStructuredData({
      prompt: fileContent,
      options: cfg,
      schema: z.object({
        summary: z.string()
      }),
      systemMessage: systemPrompt
    })

    const summary = result.object.summary
    const trimmedSummary = summary.trim()

    const updatedFile = await projectStorage.updateProjectFile(file.projectId, file.id, {
      summary: trimmedSummary,
      summaryLastUpdated: Date.now()
    })

    logger.info(`Successfully summarized and updated file: ${file.path} in project ${file.projectId}`)
    return updatedFile
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to summarize file ${file.path} in project ${file.projectId}. Reason: ${error instanceof Error ? error.message : String(error)}`,
      'FILE_SUMMARIZE_FAILED',
      { originalError: error, projectId: file.projectId, fileId: file.id }
    )
  }
}

/** Helper function to summarize files with truncated content */
async function summarizeTruncatedFile(file: ProjectFile, truncatedContent: string): Promise<ProjectFile | null> {
  const systemPrompt = `
  ## You are a coding assistant specializing in concise code summaries.
  1. Provide a short overview of what the file does.
  2. Outline main exports (functions/classes).
  3. Note that this file has been truncated for summarization due to its large size.
  4. Respond with only the textual summary, minimal fluff, no suggestions or code blocks.
  `

  const cfg = LOW_MODEL_CONFIG
  const provider = (cfg.provider as APIProviders) || 'openrouter'
  const modelId = cfg.model

  if (!modelId) {
    logger.error(`Model not configured for summarize-file task for file ${file.path}.`)
    throw new ApiError(
      500,
      `AI Model not configured for summarize-file task (file ${file.path}).`,
      'AI_MODEL_NOT_CONFIGURED',
      { projectId: file.projectId, fileId: file.id }
    )
  }

  try {
    const result = await generateStructuredData({
      prompt: truncatedContent,
      options: cfg,
      schema: z.object({
        summary: z.string()
      }),
      systemMessage: systemPrompt
    })

    const summary = result.object.summary
    const trimmedSummary = summary.trim() + ' [Note: File was truncated for summarization due to size]'

    const updatedFile = await projectStorage.updateProjectFile(file.projectId, file.id, {
      summary: trimmedSummary,
      summaryLastUpdated: Date.now()
    })

    logger.info(`Successfully summarized truncated file: ${file.path} in project ${file.projectId}`)
    return updatedFile
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to summarize truncated file ${file.path} in project ${file.projectId}. Reason: ${error instanceof Error ? error.message : String(error)}`,
      'FILE_SUMMARIZE_FAILED',
      { originalError: error, projectId: file.projectId, fileId: file.id }
    )
  }
}

/** Summarize multiple files, respecting summarization rules. Processes files sequentially to avoid storage write conflicts. */
export async function summarizeFiles(
  projectId: number,
  fileIdsToSummarize: number[],
  force: boolean = false
): Promise<{
  included: number
  skipped: number
  updatedFiles: ProjectFile[]
  skippedReasons?: { [reason: string]: number }
}> {
  const allProjectFiles = await getProjectFiles(projectId)

  if (!allProjectFiles) {
    console.warn(`[BatchSummarize] No files found for project ${projectId}.`)
    return { included: 0, skipped: 0, updatedFiles: [] }
  }

  const filesToProcess = allProjectFiles.filter((f) => fileIdsToSummarize.includes(f.id))

  const updatedFilesResult: ProjectFile[] = []
  let summarizedCount = 0
  let skippedByEmptyCount = 0
  let skippedBySizeCount = 0
  let errorCount = 0

  for (const file of filesToProcess) {
    try {
      // Check size before attempting summarization
      if (file.size > MAX_FILE_SIZE_FOR_SUMMARY) {
        skippedBySizeCount++
        logger.debug(`Skipping file ${file.path} due to size (${file.size} bytes)`)
        continue
      }

      const summarizedFile = await summarizeSingleFile(file, force)
      if (summarizedFile) {
        updatedFilesResult.push(summarizedFile)
        summarizedCount++
      } else {
        skippedByEmptyCount++
      }
    } catch (error) {
      logger.error(
        `Error processing file ${file.path} (ID: ${file.id}) in project ${projectId} for summarization`,
        error
      )
      errorCount++
    }
  }

  const totalProcessed = filesToProcess.length
  const finalSkippedCount = skippedByEmptyCount + skippedBySizeCount + errorCount

  logger.info(
    `File summarization batch complete for project ${projectId}. ` +
    `Total to process: ${totalProcessed}, ` +
    `Successfully summarized: ${summarizedCount}, ` +
    `Skipped (empty): ${skippedByEmptyCount}, ` +
    `Skipped (too large): ${skippedBySizeCount}, ` +
    `Skipped (errors): ${errorCount}, ` +
    `Total not summarized: ${finalSkippedCount}`
  )

  return {
    included: summarizedCount,
    skipped: finalSkippedCount,
    updatedFiles: updatedFilesResult,
    skippedReasons: {
      empty: skippedByEmptyCount,
      tooLarge: skippedBySizeCount,
      errors: errorCount
    }
  }
}

/**
 * Takes the user's original context/intent/prompt and uses a model
 * to generate a refined (optimized) version of that prompt.
 * This function does not interact with prompt storage for CRUD and remains unchanged.
 */
export async function optimizeUserInput(projectId: number, userContext: string): Promise<string> {
  const projectSummary = await getFullProjectSummary(projectId)

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

  try {
    const optimizedPrompt = await generateSingleText({
      systemMessage: systemMessage,
      prompt: userMessage
    })

    return optimizedPrompt.trim()
  } catch (error: any) {
    logger.error('Failed to optimize prompt', error)
    if (error instanceof ApiError) {
      throw error
    }
    throw new ApiError(
      500,
      `Failed to optimize prompt: ${error.message || 'AI provider error'}`,
      'PROMPT_OPTIMIZE_ERROR',
      { originalError: error }
    )
  }
}

/**
 * Suggests relevant files based on user input and project context using AI
 */
export async function suggestFiles(
  projectId: number,
  prompt: string,
  limit: number = 10,
  options: {
    strategy?: 'fast' | 'balanced' | 'thorough'
    includeScores?: boolean
  } = {}
): Promise<ProjectFile[]> {
  try {
    await getProjectById(projectId) // Validate project exists

    // Step 1: Pre-filter files using relevance scoring
    const relevanceScores = await fileRelevanceService.scoreFilesForText(prompt, projectId)

    // Determine how many files to analyze based on strategy
    const strategy = options.strategy || 'balanced'
    const maxPreFilterFiles = strategy === 'fast' ? 30 : strategy === 'balanced' ? 50 : 100
    const topScores = relevanceScores.slice(0, maxPreFilterFiles)

    // If fast mode or very few files, return top scored files directly
    if (strategy === 'fast' || topScores.length <= limit) {
      const fileIds = topScores.slice(0, limit).map((score) => score.fileId)
      const allFiles = await getProjectFiles(projectId)
      return allFiles?.filter((file) => fileIds.includes(file.id)) || []
    }

    // Step 2: Get candidate files for AI refinement
    const candidateFileIds = topScores.map((score) => score.fileId)
    const allFiles = await getProjectFiles(projectId)
    const candidateFiles = allFiles?.filter((file) => candidateFileIds.includes(file.id)) || []

    // Step 3: Use AI to refine selection from pre-filtered set
    const compactSummary = CompactFileFormatter.toAIPrompt(candidateFiles, 'compact')

    const systemPrompt = `You are a code assistant that selects the most relevant files from a pre-filtered list.
Given a user query and a list of potentially relevant files, select the ${limit} most relevant files.

Return only file IDs as numbers in order of relevance.`

    const userPrompt = `User Query: ${prompt}

Pre-filtered files (${candidateFiles.length} files):
${compactSummary}

Select the ${limit} most relevant file IDs from the above list.`

    const result = await generateStructuredData({
      prompt: userPrompt,
      schema: FileSuggestionsZodSchema,
      systemMessage: systemPrompt,
      options: strategy === 'thorough' ? HIGH_MODEL_CONFIG : MEDIUM_MODEL_CONFIG
    })

    // Fetch the actual file objects based on the AI-refined file IDs
    const refinedFileIds = result.object.fileIds.slice(0, limit)
    const recommendedFiles = allFiles?.filter((file) => refinedFileIds.includes(file.id)) || []

    // Log performance metrics
    const oldFormatSize = allFiles.length * 500 // Estimate old XML format size
    const newFormatSize = compactSummary.length
    const tokensSaved = Math.round((oldFormatSize - newFormatSize) / 4)
    logger.debug(
      `Strategy: ${strategy}, Files analyzed: ${candidateFiles.length}/${allFiles.length}, Tokens saved: ~${tokensSaved.toLocaleString()}`
    )

    return recommendedFiles
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to suggest files for project ${projectId}: ${error instanceof Error ? error.message : String(error)}`,
      'AI_SUGGESTION_ERROR'
    )
  }
}

/**
 * Get a compact, AI-generated summary of the project's architecture and core structure
 * This is useful for providing context to AI assistants without overwhelming them with details
 */
export async function getProjectCompactSummary(projectId: number): Promise<string> {
  try {
    await getProjectById(projectId) // Validate project exists

    return await getCompactProjectSummary(projectId)
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to get compact project summary for project ${projectId}: ${error instanceof Error ? error.message : String(error)}`,
      'PROJECT_COMPACT_SUMMARY_FAILED'
    )
  }
}

export async function getProjectFileTree(projectId: number): Promise<string> {
  try {
    await getProjectById(projectId)

    const files = await getProjectFiles(projectId)
    if (!files || files.length === 0) {
      return 'No files found in project'
    }

    const { buildFileTree } = await import('@promptliano/shared')
    const tree = buildFileTree(files)

    const lines: string[] = []

    const renderTree = (node: any, name: string, prefix: string = '', isLast: boolean = true) => {
      const connector = isLast ? '└── ' : '├── '
      const fileInfo = node.file ? ` (id: ${node.file.id})` : ''

      if (name !== '') {
        lines.push(prefix + connector + name + fileInfo)
      }

      const extension = isLast ? '    ' : '│   '
      const newPrefix = name === '' ? '' : prefix + extension

      if (node.children) {
        const entries = Object.entries(node.children)
        entries.forEach(([childName, childNode], index) => {
          const isLastChild = index === entries.length - 1
          renderTree(childNode, childName, newPrefix, isLastChild)
        })
      }
    }

    const rootEntries = Object.entries(tree)
    rootEntries.forEach(([name, node], index) => {
      const isLastRoot = index === rootEntries.length - 1
      renderTree(node, name, '', isLastRoot)
    })

    return lines.join('\n')
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to get project file tree for project ${projectId}: ${error instanceof Error ? error.message : String(error)}`,
      'PROJECT_FILE_TREE_FAILED'
    )
  }
}

/**
 * Get a comprehensive overview of the project including active tab, prompts, tickets, and structure
 * This is the recommended first tool for AI agents to call
 */
export async function getProjectOverview(projectId: number): Promise<string> {
  try {
    // Validate project exists and get basic info
    const project = await getProjectById(projectId)

    // Import necessary functions
    // Get all data in parallel for performance
    const [activeTab, prompts, ticketsWithTaskCount, statistics, gitStatus, gitBranch, fileTree, unsummarizedFiles] =
      await Promise.all([
        getActiveTab(projectId).catch(() => null),
        listPromptsByProject(projectId).catch(() => []),
        listTicketsWithTaskCount(projectId).catch(() => []),
        getProjectStatistics(projectId).catch(() => null),
        getProjectGitStatus(projectId).catch(() => null),
        getCurrentBranch(projectId).catch(() => 'unknown'),
        getProjectFileTree(projectId).catch(() => 'Unable to load file tree'),
        fileSummarizationTracker.getUnsummarizedFilesWithImportance(projectId, 20).catch(() => [])
      ])

    // Build the overview sections
    const lines: string[] = []

    // Project header
    lines.push('=== PROJECT OVERVIEW ===')
    lines.push(`Project: ${project.name} (ID: ${project.id})`)
    lines.push(`Path: ${project.path}`)
    lines.push(`Branch: ${gitBranch} | Last Updated: ${new Date(project.updated).toLocaleString()}`)
    lines.push('')

    // Active tab section
    lines.push('=== ACTIVE TAB ===')
    if (activeTab?.data.tabMetadata) {
      const tabMeta = activeTab.data.tabMetadata
      lines.push(`Tab ${activeTab.data.activeTabId}: ${tabMeta.displayName || 'Untitled'}`)

      // Selected files
      if (tabMeta.selectedFiles && tabMeta.selectedFiles.length > 0) {
        lines.push(`Selected Files: ${tabMeta.selectedFiles.length} (showing top 5)`)
        const files = await getProjectFiles(projectId)
        const selectedFiles = files?.filter((f) => tabMeta.selectedFiles.includes(f.id)) || []
        selectedFiles.slice(0, 5).forEach((file) => {
          const size = file.size ? `${(file.size / 1024).toFixed(1)}KB` : 'unknown'
          lines.push(`  - ${file.path} (${size})`)
        })
        if (tabMeta.selectedFiles.length > 5) {
          lines.push(`  ... and ${tabMeta.selectedFiles.length - 5} more`)
        }
      } else {
        lines.push('Selected Files: None')
      }

      // User prompt
      if (tabMeta.userPrompt) {
        lines.push(
          `User Prompt: "${tabMeta.userPrompt.substring(0, 100)}${tabMeta.userPrompt.length > 100 ? '...' : ''}"`
        )
      }
    } else {
      lines.push('No active tab')
    }
    lines.push('')

    // Prompts section
    lines.push(`=== PROMPTS (${prompts.length} total) ===`)
    if (prompts.length > 0) {
      prompts.slice(0, 10).forEach((prompt) => {
        lines.push(`- ${prompt.name}`)
      })
      if (prompts.length > 10) {
        lines.push(`... and ${prompts.length - 10} more`)
      }
    } else {
      lines.push('No prompts associated with this project')
    }
    lines.push('')

    // Tickets section
    let openTickets = []
    try {
      openTickets = ticketsWithTaskCount.filter((t) => t && t.status && t.status !== 'closed')
    } catch (error) {
      console.error('Error filtering tickets:', error)
      openTickets = []
    }
    lines.push(`=== RECENT TICKETS (${openTickets.length} open) ===`)
    if (openTickets.length > 0) {
      openTickets.slice(0, 5).forEach((ticket) => {
        if (!ticket) return
        const priority = ticket.priority ? `[${ticket.priority.toUpperCase()}]` : ''
        const updated = new Date(ticket.updated).toLocaleString()
        lines.push(`#${ticket.id}: ${ticket.title} ${priority} - ${ticket.taskCount || 0} tasks (Updated: ${updated})`)
      })
      if (openTickets.length > 5) {
        lines.push(`... and ${openTickets.length - 5} more open tickets`)
      }
    } else {
      lines.push('No open tickets')
    }
    lines.push('')

    // Files needing summarization section
    lines.push('=== FILES NEEDING SUMMARIZATION ===')
    if (unsummarizedFiles && unsummarizedFiles.length > 0) {
      // Get total count of unsummarized files (not just top 20)
      const stats = await fileSummarizationTracker.getSummarizationStats(projectId).catch(() => null)
      const totalUnsummarized = stats?.unsummarizedFiles || unsummarizedFiles.length

      lines.push(`Total unsummarized files: ${totalUnsummarized}`)
      lines.push(`Showing top ${unsummarizedFiles.length} by importance:`)
      lines.push('')

      unsummarizedFiles.forEach(({ file, score }) => {
        lines.push(`  [Score: ${score.toFixed(1)}] ${file.path}`)
      })

      lines.push('')
      lines.push('To summarize these files, use the file_summarization_manager tool:')
      lines.push('```')
      lines.push('mcp__Promptliano__file_summarization_manager(')
      lines.push('  action: "summarize_batch",')
      lines.push(`  projectId: ${projectId},`)
      lines.push('  data: {')
      lines.push('    strategy: "balanced",')
      lines.push('    maxGroupSize: 10,')
      lines.push('    includeStaleFiles: true')
      lines.push('  }')
      lines.push(')')
      lines.push('```')
    } else {
      lines.push('All files have been summarized!')
    }
    lines.push('')

    // Project structure (limited depth)
    lines.push('=== PROJECT STRUCTURE ===')
    const treeLines = fileTree.split('\n')
    const maxTreeLines = 30
    if (treeLines.length <= maxTreeLines) {
      lines.push(fileTree)
    } else {
      lines.push(...treeLines.slice(0, maxTreeLines))
      lines.push(`... and ${treeLines.length - maxTreeLines} more lines`)
    }
    lines.push('')

    // Quick stats
    if (statistics) {
      lines.push('=== QUICK STATS ===')
      lines.push(
        `Files: ${statistics.fileStats.totalFiles} total (${(statistics.fileStats.totalSize / 1024 / 1024).toFixed(1)}MB)`
      )
      lines.push(`- Source: ${statistics.fileStats.filesByCategory.source} files`)
      lines.push(`- Tests: ${statistics.fileStats.filesByCategory.tests} files`)
      lines.push(`- Docs: ${statistics.fileStats.filesByCategory.docs} files`)

      // Top file types
      const topTypes = Object.entries(statistics.fileStats.filesByType)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
      if (topTypes.length > 0) {
        const typeStr = topTypes.map(([ext, count]) => `${ext} (${count})`).join(', ')
        lines.push(`Top Types: ${typeStr}`)
      }
    }

    return lines.join('\n')
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to get project overview for project ${projectId}: ${error instanceof Error ? error.message : String(error)}`,
      'PROJECT_OVERVIEW_FAILED'
    )
  }
}
