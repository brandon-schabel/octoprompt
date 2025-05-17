import { resolvePath } from '@/utils/path-utils'
import { projectStorage, type ProjectFilesStorage, ProjectFilesStorageSchema } from '@/utils/project-storage'
import {
  CreateProjectBody,
  Project,
  ProjectFile,
  ProjectFileSchema,
  ProjectSchema,
  UpdateProjectBody
} from 'shared/src/schemas/project.schemas'
import path from 'path'
import { z, ZodError } from 'zod'
import { LOW_MODEL_CONFIG } from 'shared'
import { APIProviders } from 'shared/src/schemas/provider-key.schemas'
import { generateStructuredData } from './gen-ai-services'
import { syncProject } from './file-services/file-sync-service-unified'
import { ApiError } from 'shared'

export async function createProject(data: CreateProjectBody): Promise<Project> {
  const projectId = projectStorage.generateId('proj')
  const now = new Date().toISOString()

  const newProjectData: Project = {
    id: projectId,
    name: data.name,
    path: data.path,
    description: data.description || '',
    createdAt: now,
    updatedAt: now
  }

  try {
    const validatedProject = ProjectSchema.parse(newProjectData)

    const projects = await projectStorage.readProjects()
    if (projects[projectId]) {
      throw new ApiError(409, `Project ID conflict for ${projectId}`, 'PROJECT_ID_CONFLICT')
    }
    projects[projectId] = validatedProject
    await projectStorage.writeProjects(projects)
    await projectStorage.writeProjectFiles(projectId, {})

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

export async function getProjectById(projectId: string): Promise<Project | null> {
  try {
    const projects = await projectStorage.readProjects()
    return projects[projectId] || null
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Error getting project ${projectId}: ${error instanceof Error ? error.message : String(error)}`,
      'PROJECT_GET_FAILED_STORAGE'
    )
  }
}

export async function listProjects(): Promise<Project[]> {
  try {
    const projects = await projectStorage.readProjects()
    const projectList = Object.values(projects)
    projectList.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
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

export async function updateProject(projectId: string, data: UpdateProjectBody): Promise<Project | null> {
  try {
    const projects = await projectStorage.readProjects()
    const existingProject = projects[projectId]

    if (!existingProject) {
      return null
    }

    const updatedProjectData: Project = {
      ...existingProject,
      name: data.name ?? existingProject.name,
      path: data.path ?? existingProject.path,
      description: data.description ?? existingProject.description,
      updatedAt: new Date().toISOString()
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

export async function deleteProject(projectId: string): Promise<boolean> {
  try {
    const projects = await projectStorage.readProjects()
    if (!projects[projectId]) {
      throw new ApiError(404, `Project not found with ID ${projectId} for deletion.`, 'PROJECT_NOT_FOUND')
    }

    delete projects[projectId]
    await projectStorage.writeProjects(projects)

    await projectStorage.deleteProjectData(projectId)

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

export async function getProjectFiles(projectId: string): Promise<ProjectFile[] | null> {
  try {
    const projectExists = await getProjectById(projectId)
    if (!projectExists) {
      console.warn(`[ProjectService] Attempted to get files for non-existent project: ${projectId}`)
      return null
    }

    const files = await projectStorage.readProjectFiles(projectId)
    return Object.values(files)
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to get files for project ${projectId}. Reason: ${error instanceof Error ? error.message : String(error)}`,
      'PROJECT_FILES_GET_FAILED'
    )
  }
}

export async function updateFileContent(
  projectId: string,
  fileId: string,
  content: string,
  options?: { updatedAt?: Date }
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

    const newUpdatedAt = options?.updatedAt?.toISOString() ?? new Date().toISOString()

    const updatedFileData: ProjectFile = {
      ...existingFile,
      content: content,
      size: Buffer.byteLength(content, 'utf8'),
      updatedAt: newUpdatedAt
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

export async function resummarizeAllFiles(projectId: string): Promise<void> {
  const project = await getProjectById(projectId)
  if (!project) {
    throw new ApiError(404, `Project not found with ID ${projectId} for resummarize all.`, 'PROJECT_NOT_FOUND')
  }

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

    const updatedFilesMap = allFiles.reduce((acc, file) => {
      acc[file.id] = file
      return acc
    }, {} as ProjectFilesStorage)

    const validatedMap = ProjectFilesStorageSchema.parse(updatedFilesMap)

    await projectStorage.writeProjectFiles(projectId, validatedMap)
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
  projectId: string,
  fileIds: string[]
): Promise<{ removedCount: number; message: string }> {
  if (fileIds.length === 0) {
    return { removedCount: 0, message: 'No file IDs provided' }
  }
  try {
    const project = await getProjectById(projectId)
    if (!project) {
      throw new ApiError(404, `Project not found with ID ${projectId} for removing summaries.`, 'PROJECT_NOT_FOUND')
    }
    const files = await projectStorage.readProjectFiles(projectId)
    let removedCount = 0
    const now = new Date().toISOString()
    let changesMade = false

    for (const fileId of fileIds) {
      if (files[fileId]) {
        const file = files[fileId]
        if (file.summary !== null || file.summaryLastUpdatedAt !== null) {
          const updatedFileData: ProjectFile = {
            ...file,
            summary: null,
            summaryLastUpdatedAt: null,
            updatedAt: now
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
  projectId: string,
  filePath: string,
  initialContent: string = ''
): Promise<ProjectFile> {
  const project = await getProjectById(projectId)
  if (!project) {
    throw new ApiError(404, `Project not found with ID ${projectId}`, 'PROJECT_NOT_FOUND')
  }

  const absoluteProjectPath = resolvePath(project.path)
  const absoluteFilePath = resolvePath(
    filePath.startsWith('/') || filePath.startsWith('~') || path.isAbsolute(filePath)
      ? filePath
      : path.join(absoluteProjectPath, filePath)
  )
  const normalizedRelativePath = path.relative(absoluteProjectPath, absoluteFilePath)

  const fileId = projectStorage.generateId('file')
  const now = new Date().toISOString()
  const fileName = path.basename(normalizedRelativePath)
  const fileExtension = path.extname(normalizedRelativePath)
  const size = Buffer.byteLength(initialContent, 'utf8')

  const newFileData: ProjectFile = {
    id: fileId,
    projectId: projectId,
    name: fileName,
    path: normalizedRelativePath,
    extension: fileExtension,
    size: size,
    content: initialContent,
    summary: null,
    summaryLastUpdatedAt: null,
    meta: '{}',
    checksum: null,
    createdAt: now,
    updatedAt: now
  }

  try {
    const validatedFile = ProjectFileSchema.parse(newFileData)

    const files = await projectStorage.readProjectFiles(projectId)
    if (files[fileId]) {
      throw new ApiError(409, `File ID conflict for ${fileId} in project ${projectId}`, 'FILE_ID_CONFLICT')
    }
    files[fileId] = validatedFile

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
export async function bulkCreateProjectFiles(projectId: string, filesToCreate: FileSyncData[]): Promise<ProjectFile[]> {
  if (filesToCreate.length === 0) return []
  const project = await getProjectById(projectId)
  if (!project) {
    throw new ApiError(404, `Project not found with ID ${projectId} for bulk file creation.`, 'PROJECT_NOT_FOUND')
  }

  const createdFiles: ProjectFile[] = []
  const now = new Date().toISOString()
  let filesMap: ProjectFilesStorage

  try {
    filesMap = await projectStorage.readProjectFiles(projectId)

    for (const fileData of filesToCreate) {
      const fileId = projectStorage.generateId('file')

      const existingInMap = Object.values(filesMap).find((f) => f.path === fileData.path)
      if (existingInMap) {
        console.warn(
          `[ProjectService] Skipping duplicate path in bulk create: ${fileData.path} in project ${projectId}`
        )
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
        summaryLastUpdatedAt: null,
        meta: '{}',
        checksum: fileData.checksum,
        createdAt: now,
        updatedAt: now
      }

      try {
        const validatedFile = ProjectFileSchema.parse(newFileData)
        if (filesMap[fileId]) {
          console.error(`[ProjectService] File ID conflict during bulk create: ${fileId}. Skipping.`)
          continue
        }
        filesMap[fileId] = validatedFile
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
  projectId: string,
  updates: { fileId: string; data: FileSyncData }[]
): Promise<ProjectFile[]> {
  if (updates.length === 0) return []
  const project = await getProjectById(projectId)
  if (!project) {
    throw new ApiError(404, `Project not found with ID ${projectId} for bulk file update.`, 'PROJECT_NOT_FOUND')
  }

  const updatedFilesResult: ProjectFile[] = []
  const now = new Date().toISOString()
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
        updatedAt: now
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
  projectId: string,
  fileIdsToDelete: string[]
): Promise<{ deletedCount: number }> {
  if (fileIdsToDelete.length === 0) {
    return { deletedCount: 0 }
  }
  const project = await getProjectById(projectId)
  if (!project) {
    throw new ApiError(404, `Project not found with ID ${projectId} for bulk file deletion.`, 'PROJECT_NOT_FOUND')
  }

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
export async function getProjectFilesByIds(projectId: string, fileIds: string[]): Promise<ProjectFile[]> {
  if (!fileIds || fileIds.length === 0) {
    return []
  }
  const project = await getProjectById(projectId)
  if (!project) {
    throw new ApiError(404, `Project not found with ID ${projectId} when fetching files by IDs.`, 'PROJECT_NOT_FOUND')
  }

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
export async function summarizeSingleFile(file: ProjectFile): Promise<ProjectFile | null> {
  const fileContent = file.content || ''

  if (!fileContent.trim()) {
    console.warn(
      `[SummarizeSingleFile] File ${file.path} (ID: ${file.id}) in project ${file.projectId} is empty, skipping summarization.`
    )
    return null
  }

  const systemPrompt = `
  ## You are a coding assistant specializing in concise code summaries.
  1. Provide a short overview of what the file does.
  2. Outline main exports (functions/classes).
  3. Respond with only the textual summary, minimal fluff, no suggestions or code blocks.
  `

  const cfg = LOW_MODEL_CONFIG
  const provider = (cfg.provider as APIProviders) || 'openai'
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
      summary: trimmedSummary
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

/** Summarize multiple files, respecting summarization rules. Processes files sequentially to avoid storage write conflicts. */
export async function summarizeFiles(
  projectId: string,
  fileIdsToSummarize: string[]
): Promise<{ included: number; skipped: number; updatedFiles: ProjectFile[] }> {
  const allProjectFiles = await getProjectFiles(projectId)

  if (!allProjectFiles) {
    console.warn(`[BatchSummarize] No files found for project ${projectId}.`)
    return { included: 0, skipped: 0, updatedFiles: [] }
  }

  const filesToProcess = allProjectFiles.filter((f) => fileIdsToSummarize.includes(f.id))

  const updatedFilesResult: ProjectFile[] = []
  let summarizedCount = 0
  let skippedByEmptyCount = 0
  let errorCount = 0

  for (const file of filesToProcess) {
    try {
      const summarizedFile = await summarizeSingleFile(file)
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
  const finalSkippedCount = skippedByEmptyCount + errorCount

  console.log(
    `[BatchSummarize] File summarization batch complete for project ${projectId}. ` +
      `Total to process: ${totalProcessed}, ` +
      `Successfully summarized: ${summarizedCount}, ` +
      `Skipped (empty): ${skippedByEmptyCount}, ` +
      `Skipped (errors): ${errorCount}, ` +
      `Total not summarized: ${finalSkippedCount}`
  )

  return {
    included: summarizedCount,
    skipped: finalSkippedCount,
    updatedFiles: updatedFilesResult
  }
}
