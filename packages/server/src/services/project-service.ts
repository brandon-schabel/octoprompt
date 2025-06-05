import { resolvePath } from '@/utils/path-utils'
import { projectStorage, type ProjectFilesStorage, ProjectFilesStorageSchema } from '@octoprompt/storage'
import {
  CreateProjectBody,
  Project,
  ProjectFile,
  ProjectFileSchema,
  ProjectSchema,
  UpdateProjectBody,
  FileVersion
} from '@octoprompt/schemas'
import path from 'path'
import { z, ZodError } from 'zod'

import { generateSingleText, generateStructuredData } from './gen-ai-services'
import { syncProject } from './file-services/file-sync-service-unified'
import { ApiError } from '@octoprompt/shared'
import { promptsMap } from '../utils/prompts-map'
import { getFullProjectSummary } from '@/utils/get-full-project-summary'
import { summarizeFiles } from './agents/summarize-files-agent'

// Existing project CRUD functions remain the same...
export async function createProject(data: CreateProjectBody): Promise<Project> {
  let projectId = projectStorage.generateId()
  const initialProjectId = projectId
  let incrementCount = 0
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
    )

    while (projectsMap.has(projectId)) {
      projectId++
      incrementCount++
    }

    if (incrementCount > 0) {
      newProjectData.id = projectId
      console.log(
        `Project ID ${initialProjectId} was taken. Found available ID ${projectId} after ${incrementCount} increment(s).`
      )
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

// UPDATED: Only return latest versions by default
export async function getProjectFiles(
  projectId: number,
  includeAllVersions: boolean = false
): Promise<ProjectFile[] | null> {
  try {
    await getProjectById(projectId)
    const files = await projectStorage.readProjectFiles(projectId)
    const fileList = Object.values(files)

    if (includeAllVersions) {
      return fileList.sort((a, b) => a.path.localeCompare(b.path) || a.version - b.version)
    } else {
      // Only return latest versions
      return fileList.filter((file) => file.isLatest).sort((a, b) => a.path.localeCompare(b.path))
    }
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null
    }
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to get files for project ${projectId}. Reason: ${error instanceof Error ? error.message : String(error)}`,
      'PROJECT_FILES_GET_FAILED'
    )
  }
}

// UPDATED: Create new version instead of updating existing file
export async function updateFileContent(
  projectId: number,
  fileId: number,
  content: string,
  options?: { updated?: Date }
): Promise<ProjectFile> {
  try {
    await getProjectById(projectId)

    // Create a new version instead of updating the existing file
    const newVersion = await projectStorage.createFileVersion(projectId, fileId, content)

    console.log(`Created new version ${newVersion.version} for file ${fileId} in project ${projectId}`)
    return newVersion
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

// NEW: Get all versions of a file
export async function getFileVersions(projectId: number, originalFileId: number): Promise<FileVersion[]> {
  try {
    await getProjectById(projectId)
    const versions = await projectStorage.getFileVersions(projectId, originalFileId)

    return versions.map((file) => ({
      fileId: file.id,
      version: file.version,
      created: file.created,
      updated: file.updated,
      isLatest: file.isLatest
    }))
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to get file versions for ${originalFileId}. Reason: ${error instanceof Error ? error.message : String(error)}`,
      'FILE_VERSIONS_GET_FAILED'
    )
  }
}

// NEW: Get specific version of a file
export async function getFileVersion(
  projectId: number,
  originalFileId: number,
  version?: number
): Promise<ProjectFile | null> {
  try {
    await getProjectById(projectId)

    if (version) {
      return await projectStorage.getFileVersion(projectId, originalFileId, version)
    } else {
      return await projectStorage.getLatestFileVersion(projectId, originalFileId)
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to get file version. Reason: ${error instanceof Error ? error.message : String(error)}`,
      'FILE_VERSION_GET_FAILED'
    )
  }
}

// NEW: Revert file to a specific version
export async function revertFileToVersion(
  projectId: number,
  fileId: number,
  targetVersion: number
): Promise<ProjectFile> {
  try {
    await getProjectById(projectId)

    const revertedFile = await projectStorage.revertToVersion(projectId, fileId, targetVersion)
    console.log(`Reverted file ${fileId} to version ${targetVersion}, created new version ${revertedFile.version}`)

    return revertedFile
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Failed to revert file to version ${targetVersion}. Reason: ${error instanceof Error ? error.message : String(error)}`,
      'FILE_REVERT_FAILED'
    )
  }
}

export async function resummarizeAllFiles(projectId: number): Promise<void> {
  const project = await getProjectById(projectId)
  await syncProject(project)

  const allFiles = await getProjectFiles(projectId, false) // Only latest versions
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
    await getProjectById(projectId)
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
  const initialFileId = fileId
  let incrementCount = 0
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
    updated: now,
    // New versioning fields
    version: 1,
    prevId: null,
    nextId: null,
    isLatest: true,
    originalFileId: null // This is the original file
  }

  try {
    const validatedFile = ProjectFileSchema.parse(newFileData)
    const files = await projectStorage.readProjectFiles(projectId)

    while (files[newFileData.id]) {
      newFileData.id++
      incrementCount++
    }
    fileId = newFileData.id

    if (incrementCount > 0) {
      console.log(
        `File ID ${initialFileId} in project ${projectId} was taken. Found available ID ${fileId} after ${incrementCount} increment(s).`
      )
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
  const createdFiles: ProjectFile[] = []
  const now = Date.now()
  let filesMap: ProjectFilesStorage

  try {
    filesMap = await projectStorage.readProjectFiles(projectId)

    for (const fileData of filesToCreate) {
      let fileId = projectStorage.generateId()
      const initialFileId = fileId
      let incrementCount = 0

      const existingInMapByPath = Object.values(filesMap).find((f) => f.path === fileData.path && f.isLatest)

      if (existingInMapByPath) {
        console.warn(
          `[ProjectService] Skipping duplicate path in bulk create: ${fileData.path} in project ${projectId}`
        )
        continue
      }

      while (filesMap[fileId]) {
        fileId++
        incrementCount++
      }
      if (incrementCount > 0) {
        console.log(
          `[ProjectService] Bulk create: File ID ${initialFileId} for path ${fileData.path} in project ${projectId} was taken. Found available ID ${fileId} after ${incrementCount} increment(s).`
        )
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
        updated: now,
        // New versioning fields
        version: 1,
        prevId: null,
        nextId: null,
        isLatest: true,
        originalFileId: null
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

// UPDATED: Bulk update now creates new versions for each file
export async function bulkUpdateProjectFiles(
  projectId: number,
  updates: { fileId: number; data: FileSyncData }[]
): Promise<ProjectFile[]> {
  if (updates.length === 0) return []
  await getProjectById(projectId)
  const updatedFilesResult: ProjectFile[] = []

  try {
    for (const { fileId, data } of updates) {
      try {
        // Create new version instead of updating existing file
        const newVersion = await projectStorage.createFileVersion(projectId, fileId, data.content, {
          extension: data.extension,
          size: data.size,
          checksum: data.checksum
        })
        updatedFilesResult.push(newVersion)
      } catch (error) {
        console.error(
          `[ProjectService] Failed to create new version for file ${fileId} during bulk update:`,
          error instanceof Error ? error.message : String(error)
        )
        continue
      }
    }

    return updatedFilesResult
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      500,
      `Bulk file update failed for project ${projectId}. Some files might be updated. Reason: ${error instanceof Error ? error.message : String(error)}`,
      'PROJECT_BULK_UPDATE_FAILED'
    )
  }
}

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
