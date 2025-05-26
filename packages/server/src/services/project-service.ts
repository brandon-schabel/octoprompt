import { resolvePath } from '@/utils/path-utils'
import { projectStorage, type ProjectFilesStorage, ProjectFilesStorageSchema } from '@/utils/storage/project-storage'
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
import { generateSingleText, generateStructuredData } from './gen-ai-services'
import { syncProject } from './file-services/file-sync-service-unified'
import { ApiError } from 'shared'
import { promptsMap } from '../utils/prompts-map'
import { getFullProjectSummary } from '@/utils/get-full-project-summary'

export async function createProject(data: CreateProjectBody): Promise<Project> {
  let projectId = projectStorage.generateId()
  const initialProjectId = projectId; // Store initial ID for logging
  let incrementCount = 0; // Counter for increments
  const now = Date.now()

  const newProjectData: Project = {
    id: projectId,
    name: data.name,
    path: data.path,
    description: data.description || '',
    created: now,
    updated: now
  }

  try {
    const existingProjectsObject = await projectStorage.readProjects()
    const projectsMap = new Map<number, Project>(
      Object.entries(existingProjectsObject).map(([id, proj]) => [Number(id), proj as Project])
    );

    while (projectsMap.has(projectId)) {
      // console.warn(`Project ID conflict for ${projectId}. Incrementing.`); // Original warning can be kept or removed
      projectId++;
      incrementCount++;
    }

    if (incrementCount > 0) {
      newProjectData.id = projectId; // Update the ID in the data object if it was changed
      console.log(`Project ID ${initialProjectId} was taken. Found available ID ${projectId} after ${incrementCount} increment(s).`);
    }

    const validatedProject = ProjectSchema.parse(newProjectData)

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

  let fileId = projectStorage.generateId()
  const initialFileId = fileId; // Store initial ID for logging
  let incrementCount = 0; // Counter for increments
  const now = Date.now()
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
    summaryLastUpdated: null,
    meta: '{}',
    checksum: null,
    created: now,
    updated: now
  }

  try {
    const validatedFile = ProjectFileSchema.parse(newFileData)


    const files = await projectStorage.readProjectFiles(projectId)
    // Handle potential file ID conflicts by incrementing
    while (files[newFileData.id]) {
      // console.warn(`File ID conflict for ${newFileData.id} in project ${projectId}. Incrementing.`);
      newFileData.id++;
      incrementCount++;
    }
    // Update fileId if it was changed due to conflict resolution
    fileId = newFileData.id;

    if (incrementCount > 0) {
      console.log(`File ID ${initialFileId} in project ${projectId} was taken. Found available ID ${fileId} after ${incrementCount} increment(s).`);
    }

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

    for (const fileData of filesToCreate) {
      let fileId = projectStorage.generateId()
      const initialFileId = fileId;
      let incrementCount = 0;

      const existingInMapByPath = Object.values(filesMap).find((f) => f.path === fileData.path)

      if (existingInMapByPath) {
        console.warn(
          `[ProjectService] Skipping duplicate path in bulk create: ${fileData.path} in project ${projectId}`
        )
        continue
      }

      // Handle potential file ID conflicts by incrementing for this specific file
      while (filesMap[fileId]) {
        fileId++;
        incrementCount++;
      }
      if (incrementCount > 0) {
        console.log(`[ProjectService] Bulk create: File ID ${initialFileId} for path ${fileData.path} in project ${projectId} was taken. Found available ID ${fileId} after ${incrementCount} increment(s).`);
      }

      const newFileData: ProjectFile = {
        id: fileId, // Use the conflict-resolved fileId
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

/** Summarize multiple files, respecting summarization rules. Processes files sequentially to avoid storage write conflicts. */
export async function summarizeFiles(
  projectId: number,
  fileIdsToSummarize: number[]
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