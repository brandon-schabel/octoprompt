import { z, ZodError, type ZodTypeAny } from 'zod'
import path from 'node:path'
import fs from 'node:fs/promises'
import { ProjectSchema, ProjectFileSchema, type ProjectFile } from '@octoprompt/schemas'

import { unixTimestampSchema } from '@octoprompt/schemas'

// Define the base directory for storing project data
const DATA_DIR = path.resolve(process.cwd(), 'data', 'project_storage')

// --- Schemas for Storage ---
export const ProjectsStorageSchema = z.record(z.string(), ProjectSchema)
export type ProjectsStorage = z.infer<typeof ProjectsStorageSchema>

export const ProjectFilesStorageSchema = z.record(z.string(), ProjectFileSchema)
export type ProjectFilesStorage = z.infer<typeof ProjectFilesStorageSchema>

// --- Path Helpers ---
function getProjectsIndexPath(): string {
  return path.join(DATA_DIR, 'projects.json')
}

function getProjectDataDir(projectId: number): string {
  return path.join(DATA_DIR, 'project_data', projectId.toString())
}

function getProjectFilesPath(projectId: number): string {
  return path.join(getProjectDataDir(projectId), 'files.json')
}

function getProjectAIFileChangesPath(projectId: number): string {
  return path.join(getProjectDataDir(projectId), 'ai-file-changes.json')
}

// --- Core Read/Write Functions ---
async function ensureDirExists(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true })
  } catch (error: any) {
    if (error.code !== 'EEXIST') {
      console.error(`Error creating directory ${dirPath}:`, error)
      throw new Error(`Failed to ensure directory exists: ${dirPath}`)
    }
  }
}

async function readValidatedJson<T extends ZodTypeAny>(
  filePath: string,
  schema: T,
  defaultValue: z.infer<T>
): Promise<z.infer<T>> {
  try {
    await ensureDirExists(path.dirname(filePath))
    const fileContent = await fs.readFile(filePath, 'utf-8')

    if (fileContent.trim() === '') {
      console.warn(`File is empty or contains only whitespace: ${filePath}. Returning default value.`)
      return defaultValue
    }

    let jsonData = JSON.parse(fileContent)

    if (schema instanceof z.ZodRecord && schema.keySchema instanceof z.ZodNumber) {
      const transformedData: Record<number, unknown> = {}
      for (const key in jsonData) {
        if (Object.prototype.hasOwnProperty.call(jsonData, key)) {
          const parseResult = unixTimestampSchema.safeParse(key)
          if (parseResult.success) {
            transformedData[parseResult.data] = jsonData[key]
          } else {
            console.warn(`Omitting non-numeric or invalid timestamp key "${key}" from object in ${filePath}`)
          }
        }
      }
      jsonData = transformedData
    }

    const validationResult = await schema.safeParseAsync(jsonData)
    if (!validationResult.success) {
      console.error(`Zod validation failed reading ${filePath}:`, validationResult.error.errors)
      console.warn(`Returning default value due to validation failure for ${filePath}.`)
      return defaultValue
    }
    return validationResult.data
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return defaultValue
    }
    if (error instanceof SyntaxError) {
      console.error(`JSON Parse error in ${filePath}:`, error.message)
      console.warn(`Returning default value due to JSON parsing error for ${filePath}.`)
      return defaultValue
    }
    console.error(`Error reading or parsing JSON from ${filePath}:`, error)
    throw new Error(`Failed to read/parse JSON file at ${filePath}. Reason: ${error.message}`)
  }
}

async function writeValidatedJson<T extends ZodTypeAny>(
  filePath: string,
  data: unknown,
  schema: T
): Promise<z.infer<T>> {
  try {
    const validationResult = await schema.safeParseAsync(data)
    if (!validationResult.success) {
      console.error(`Zod validation failed before writing to ${filePath}:`, validationResult.error.errors)
      throw new ZodError(validationResult.error.errors)
    }
    const validatedData = validationResult.data

    await ensureDirExists(path.dirname(filePath))
    const jsonString = JSON.stringify(validatedData, null, 2)
    await fs.writeFile(filePath, jsonString, 'utf-8')

    return validatedData
  } catch (error: any) {
    console.error(`Error writing JSON to ${filePath}:`, error)
    if (error instanceof ZodError) {
      throw error
    }
    throw new Error(`Failed to write JSON file at ${filePath}. Reason: ${error.message}`)
  }
}

export const projectStorage = {
  async readProjects(): Promise<ProjectsStorage> {
    return readValidatedJson(getProjectsIndexPath(), ProjectsStorageSchema, {})
  },

  async writeProjects(projects: ProjectsStorage): Promise<ProjectsStorage> {
    return writeValidatedJson(getProjectsIndexPath(), projects, ProjectsStorageSchema)
  },

  async readProjectFiles(projectId: number): Promise<ProjectFilesStorage> {
    return readValidatedJson(getProjectFilesPath(projectId), ProjectFilesStorageSchema, {})
  },

  async writeProjectFiles(projectId: number, files: ProjectFilesStorage): Promise<ProjectFilesStorage> {
    return writeValidatedJson(getProjectFilesPath(projectId), files, ProjectFilesStorageSchema)
  },



  async updateProjectFile(
    projectId: number,
    fileId: number,
    fileData: Partial<Omit<ProjectFile, 'id' | 'projectId' | 'created' | 'updated'>>
  ): Promise<ProjectFile> {
    const currentFiles = await this.readProjectFiles(projectId)
    const currentFile = currentFiles[fileId]
    if (!currentFile) {
      throw new Error(`File not found: ${fileId} in project ${projectId}`)
    }

    const updatedFileObject = {
      ...currentFile,
      ...fileData,
      updated: Date.now()
    }

    const validationResult = await ProjectFileSchema.safeParseAsync(updatedFileObject)
    if (!validationResult.success) {
      console.error(`Zod validation failed for file ${fileId} in project ${projectId}:`, validationResult.error.errors)
      throw new ZodError(validationResult.error.errors)
    }
    const validatedFileData = validationResult.data

    currentFiles[fileId] = validatedFileData
    await this.writeProjectFiles(projectId, currentFiles)
    return validatedFileData
  },

  async readProjectFile(projectId: number, fileId: number): Promise<ProjectFile | undefined> {
    const files = await this.readProjectFiles(projectId)
    return files[fileId]
  },

  async deleteProjectData(projectId: number): Promise<void> {
    const dirPath = getProjectDataDir(projectId)
    try {
      await fs.access(dirPath)
      await fs.rm(dirPath, { recursive: true, force: true })
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.warn(`Project data directory not found, nothing to delete: ${dirPath}`)
      } else {
        console.error(`Error deleting project data directory ${dirPath}:`, error)
        throw new Error(`Failed to delete project data directory: ${dirPath}. Reason: ${error.message}`)
      }
    }
  },

  async getProjectFileArray(projectId: number) {
    const filesMap = await this.readProjectFiles(projectId)
    const filesArray: ProjectFile[] = []
    for (const fileId in filesMap) {
      if (Object.prototype.hasOwnProperty.call(filesMap, fileId)) {
        const file = filesMap[fileId]
        if (file) {
          filesArray.push(file)
        }
      }

      return filesArray
    }
  },

  generateId: (): number => {
    try {
      return unixTimestampSchema.parse(Date.now())
    } catch (error) {
      console.error(`CRITICAL: Date.now() produced invalid timestamp for ID generation: ${error}`)
      throw new Error('Failed to generate a valid timestamp-based ID from the current time.')
    }
  }
}