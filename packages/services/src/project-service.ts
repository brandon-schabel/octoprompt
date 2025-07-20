import {
  type CreateProjectBody,
  type Project,
  ProjectSchema,
  type UpdateProjectBody,
  type ProjectFile,
  ProjectFileSchema,
  LOW_MODEL_CONFIG,
  type APIProviders,
  FileSuggestionsZodSchema,
  MAX_FILE_SIZE_FOR_SUMMARY,
  MAX_TOKENS_FOR_SUMMARY,
  CHARS_PER_TOKEN_ESTIMATE
} from '@octoprompt/schemas'
import { ApiError, promptsMap, FILE_SUMMARIZATION_LIMITS, needsResummarization } from '@octoprompt/shared'
import { projectStorage, ProjectFilesStorageSchema, type ProjectFilesStorage } from '@octoprompt/storage'
import z, { ZodError } from 'zod'
import { syncProject } from './file-services/file-sync-service-unified'
import { generateStructuredData, generateSingleText } from './gen-ai-services'
import { getFullProjectSummary } from './utils/get-full-project-summary'
import { resolvePath } from './utils/path-utils'
import path from 'node:path'

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

    await projectStorage.writeProjects(Object.fromEntries(projectsMap))
    await projectStorage.writeProjectFiles(validatedProject.id, {})

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
    const { cleanupProjectMCPServers } = await import('./mcp-service')
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

export async function getProjectFiles(projectId: number): Promise<ProjectFile[] | null> {
  try {
    await getProjectById(projectId) // Throws 404 if project not found
    const files = await projectStorage.readProjectFiles(projectId)
    return Object.values(files)
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
    await projectStorage.writeProjectFiles(projectId, files)

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

    console.log(`[ProjectService] Completed resummarizeAllFiles and saved updates for project ${projectId}`)
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
      await projectStorage.writeProjectFiles(projectId, validatedMap)
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
      created: now,
      updated: now
    }

    const validatedFile = ProjectFileSchema.parse(newFileData)

    const files = await projectStorage.readProjectFiles(projectId)
    files[fileId] = validatedFile

    // even though the keys are numbers, they are saved as string because that is default javascript behavior
    const validatedMap = ProjectFilesStorageSchema.parse(files)
    await projectStorage.writeProjectFiles(projectId, validatedMap)

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
    const { getDb } = await import('@octoprompt/storage')
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
        console.error(`[ProjectService] No file ID available for ${fileData.path}`)
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
        created: now,
        updated: now
      }

      try {
        const validatedFile = ProjectFileSchema.parse(newFileData)

        filesMap[validatedFile.id] = validatedFile
        createdFiles.push(validatedFile)
      } catch (validationError) {
        console.error(
          `[ProjectService] Validation failed for file ${fileData.path} during bulk create:`,
          validationError instanceof ZodError ? validationError.flatten().fieldErrors : validationError
        )
        continue
      }
    }

    if (createdFiles.length > 0) {
      const validatedMap = ProjectFilesStorageSchema.parse(filesMap)
      await projectStorage.writeProjectFiles(projectId, validatedMap)
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
        updated: now
      }

      try {
        const validatedFile = ProjectFileSchema.parse(updatedFileData)
        files[fileId] = validatedFile
        updatedFilesResult.push(validatedFile)
        changesMade = true
      } catch (validationError) {
        console.error(
          `[ProjectService] Validation failed for file ${fileId} (${existingFile.path}) during bulk update:`,
          validationError instanceof ZodError ? validationError.flatten().fieldErrors : validationError
        )
        continue
      }
    }

    if (changesMade) {
      const validatedMap = ProjectFilesStorageSchema.parse(files)
      await projectStorage.writeProjectFiles(projectId, validatedMap)
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
      await projectStorage.writeProjectFiles(projectId, validatedMap)
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
    console.log(
      `[SummarizeSingleFile] Skipping file ${file.path} (ID: ${file.id}) in project ${file.projectId}: ${summarizationCheck.reason}`
    )
    return null
  }
  
  console.log(
    `[SummarizeSingleFile] Processing file ${file.path} (ID: ${file.id}): ${summarizationCheck.reason}`
  )
  
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
  
  const systemPrompt = `
  ## You are a coding assistant specializing in concise code summaries.
  1. Provide a short overview of what the file does.
  2. Outline main exports (functions/classes).
  3. Respond with only the textual summary, minimal fluff, no suggestions or code blocks.
  ${wasTruncatedDuringSync ? '4. Note: This file was truncated for summarization, so the summary may be incomplete.' : ''}
  `

  const cfg = LOW_MODEL_CONFIG
  const provider = (cfg.provider as APIProviders) || 'openrouter'
  const modelId = cfg.model

  if (!modelId) {
    console.error(`[SummarizeSingleFile] Model not configured for summarize-file task for file ${file.path}.`)
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

    console.log(
      `[SummarizeSingleFile] Successfully summarized and updated file: ${file.path} in project ${file.projectId}`
    )
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
    console.error(`[SummarizeTruncatedFile] Model not configured for summarize-file task for file ${file.path}.`)
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

    console.log(
      `[SummarizeTruncatedFile] Successfully summarized truncated file: ${file.path} in project ${file.projectId}`
    )
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
): Promise<{ included: number; skipped: number; updatedFiles: ProjectFile[]; skippedReasons?: { [reason: string]: number } }> {
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
        console.log(`[BatchSummarize] Skipping file ${file.path} due to size (${file.size} bytes)`)
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
      console.error(
        `[BatchSummarize] Error processing file ${file.path} (ID: ${file.id}) in project ${projectId} for summarization: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof ApiError ? error.details : ''
      )
      errorCount++
    }
  }

  const totalProcessed = filesToProcess.length
  const finalSkippedCount = skippedByEmptyCount + skippedBySizeCount + errorCount

  console.log(
    `[BatchSummarize] File summarization batch complete for project ${projectId}. ` +
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
    console.error('[PromptimizerService] Failed to optimize prompt:', error)
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
export async function suggestFiles(projectId: number, prompt: string, limit: number = 10): Promise<ProjectFile[]> {
  try {
    await getProjectById(projectId) // Validate project exists

    const projectSummary = await getFullProjectSummary(projectId)
    const systemPrompt = `
<role>
You are a code assistant that recommends relevant files based on user input.
You have a list of file summaries and a user request.
</role>

<response_format>
    {"fileIds": [1234567890123, 1234567890124]}
</response_format>

<guidelines>
- Return file IDs as numbers (unix timestamps in milliseconds)
- For simple tasks: return max 5 files
- For complex tasks: return max ${Math.min(limit, 10)} files
- For very complex tasks: return max ${Math.min(limit, 20)} files
- Do not add comments in your response
- Strictly follow the JSON schema, do not add any additional properties or comments
- DO NOT RETURN THE FILE NAME UNDER ANY CIRCUMSTANCES, JUST THE FILE ID
</guidelines>
`

    const userPrompt = `
<project_summary>
${projectSummary}
</project_summary>

<user_query>
${prompt}
</user_query>
`

    const result = await generateStructuredData({
      prompt: userPrompt,
      schema: FileSuggestionsZodSchema,
      systemMessage: systemPrompt
    })

    // Fetch the actual file objects based on the recommended file IDs
    const fileIds = result.object.fileIds
    const allFiles = await getProjectFiles(projectId)
    const recommendedFiles = allFiles?.filter((file) => fileIds.includes(file.id)) || []

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

    const { getCompactProjectSummary } = await import('./utils/get-full-project-summary')
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
