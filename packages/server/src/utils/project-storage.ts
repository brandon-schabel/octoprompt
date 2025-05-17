// src/utils/project-storage.ts
import { z, ZodError, type ZodTypeAny } from 'zod'
import path from 'node:path'
import fs from 'node:fs/promises' // Using Node's fs promises
import { ProjectSchema, ProjectFileSchema, type ProjectFile } from 'shared/src/schemas/project.schemas'

// Define the base directory for storing project data
// Adjust this path as needed, e.g., use an environment variable
const DATA_DIR = path.resolve(process.cwd(), 'data', 'project_storage')

// --- Schemas for Storage ---
// Store projects as a map (Record) keyed by projectId
export const ProjectsStorageSchema = z.record(z.string(), ProjectSchema)
export type ProjectsStorage = z.infer<typeof ProjectsStorageSchema>

// Store files within a project as a map (Record) keyed by fileId
export const ProjectFilesStorageSchema = z.record(z.string(), ProjectFileSchema)
export type ProjectFilesStorage = z.infer<typeof ProjectFilesStorageSchema>

// --- Path Helpers ---

/** Gets the absolute path to the main projects index file. */
function getProjectsIndexPath(): string {
  return path.join(DATA_DIR, 'projects.json')
}

/** Gets the absolute path to a specific project's directory. */
function getProjectDataDir(projectId: string): string {
  return path.join(DATA_DIR, 'project_data', projectId)
}

/** Gets the absolute path to a specific project's files index file. */
function getProjectFilesPath(projectId: string): string {
  return path.join(getProjectDataDir(projectId), 'files.json')
}

// --- Core Read/Write Functions ---

/** Ensures the base data directory and project-specific directories exist. */
async function ensureDirExists(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true })
  } catch (error: any) {
    // Ignore EEXIST error (directory already exists), re-throw others
    if (error.code !== 'EEXIST') {
      console.error(`Error creating directory ${dirPath}:`, error)
      throw new Error(`Failed to ensure directory exists: ${dirPath}`)
    }
  }
}

/**
 * Reads and validates JSON data from a file.
 * @param filePath The absolute path to the JSON file.
 * @param schema The Zod schema to validate against.
 * @param defaultValue The value to return if the file doesn't exist.
 * @returns Validated data or the default value.
 */
async function readValidatedJson<T extends ZodTypeAny>(
  filePath: string,
  schema: T,
  defaultValue: z.infer<T>
): Promise<z.infer<T>> {
  try {
    await ensureDirExists(path.dirname(filePath)) // Ensure parent dir exists
    const fileContent = await fs.readFile(filePath, 'utf-8')
    const jsonData = JSON.parse(fileContent)
    const validationResult = await schema.safeParseAsync(jsonData) // Use async parse

    if (!validationResult.success) {
      console.error(`Zod validation failed reading ${filePath}:`, validationResult.error.errors)
      // Decide how to handle: throw, return default, or try to recover?
      // Returning default for robustness against corrupted files.
      console.warn(`Returning default value due to validation failure for ${filePath}.`)
      return defaultValue
      // Or: throw new ZodError(validationResult.error.errors);
    }
    return validationResult.data
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, return the default value
      // console.log(`File not found ${filePath}, returning default value.`);
      return defaultValue
    }
    console.error(`Error reading or parsing JSON from ${filePath}:`, error)
    // Throw for unexpected errors (parsing, permissions etc.)
    throw new Error(`Failed to read/parse JSON file at ${filePath}. Reason: ${error.message}`)
  }
}

/**
 * Validates data and writes it to a JSON file.
 * @param filePath The absolute path to the JSON file.
 * @param data The data to write.
 * @param schema The Zod schema to validate against.
 * @returns The validated data that was written.
 */
async function writeValidatedJson<T extends ZodTypeAny>(
  filePath: string,
  data: unknown, // Accept unknown initially for validation
  schema: T
): Promise<z.infer<T>> {
  try {
    // 1. Validate data first
    const validationResult = await schema.safeParseAsync(data)
    if (!validationResult.success) {
      console.error(`Zod validation failed before writing to ${filePath}:`, validationResult.error.errors)
      throw new ZodError(validationResult.error.errors)
    }
    const validatedData = validationResult.data

    // 2. Ensure directory exists
    await ensureDirExists(path.dirname(filePath))

    // 3. Stringify and write
    const jsonString = JSON.stringify(validatedData, null, 2) // Pretty print
    await fs.writeFile(filePath, jsonString, 'utf-8')

    // console.log(`Successfully validated and wrote JSON to: ${filePath}`);
    return validatedData
  } catch (error: any) {
    console.error(`Error writing JSON to ${filePath}:`, error)
    if (error instanceof ZodError) {
      throw error // Re-throw Zod errors
    }
    throw new Error(`Failed to write JSON file at ${filePath}. Reason: ${error.message}`)
  }
}

// --- Specific Data Accessors ---

export const projectStorage = {
  /** Reads the main projects data file. */
  async readProjects(): Promise<ProjectsStorage> {
    return readValidatedJson(getProjectsIndexPath(), ProjectsStorageSchema, {})
  },

  /** Writes the main projects data file. */
  async writeProjects(projects: ProjectsStorage): Promise<ProjectsStorage> {
    return writeValidatedJson(getProjectsIndexPath(), projects, ProjectsStorageSchema)
  },

  /** Reads a specific project's file data. */
  async readProjectFiles(projectId: string): Promise<ProjectFilesStorage> {
    return readValidatedJson(getProjectFilesPath(projectId), ProjectFilesStorageSchema, {})
  },

  /** Writes a specific project's file data. */
  async writeProjectFiles(projectId: string, files: ProjectFilesStorage): Promise<ProjectFilesStorage> {
    return writeValidatedJson(getProjectFilesPath(projectId), files, ProjectFilesStorageSchema)
  },

  /**
   * Updates a specific file within a project.
   * Reads the project's files, validates the new data, updates the entry, and writes back.
   * @param projectId The ID of the project containing the file.
   * @param fileId The ID of the file to update.
   * @param fileData The new data for the file (will be validated).
   * @returns The validated and saved ProjectFile data.
   * @throws ZodError if validation fails.
   * @throws Error if reading/writing fails.
   */
  async updateProjectFile(
    projectId: string,
    fileId: string,
    fileData: Partial<Omit<ProjectFile, 'updatedAt' | 'createdAt'>>
  ): Promise<ProjectFile> {
    //  get current file data
    const currentFile = await this.readProjectFile(projectId, fileId)
    if (!currentFile) {
      throw new Error(`File not found: ${fileId} in project ${projectId}`)
    }
    // 1. Validate the incoming data first
    const validationResult = await ProjectFileSchema.safeParseAsync({
      ...currentFile,
      ...fileData,
      updatedAt: new Date().toISOString()
    })
    if (!validationResult.success) {
      console.error(`Zod validation failed for file ${fileId} in project ${projectId}:`, validationResult.error.errors)
      throw new ZodError(validationResult.error.errors)
    }
    const validatedFileData = validationResult.data

    // 2. Read the existing files for the project
    const currentFiles = await this.readProjectFiles(projectId)

    // 3. Update the specific file entry
    currentFiles[fileId] = validatedFileData

    // 4. Write the updated file storage back
    // Note: writeProjectFiles already handles validation of the *entire* storage object
    await this.writeProjectFiles(projectId, currentFiles)

    // 5. Return the validated data that was just saved
    return validatedFileData
  },

  async readProjectFile(projectId: string, fileId: string): Promise<ProjectFile | undefined> {
    const files = await this.readProjectFiles(projectId)
    return files[fileId]
  },

  /** Deletes a project's data directory. */
  async deleteProjectData(projectId: string): Promise<void> {
    const dirPath = getProjectDataDir(projectId)
    try {
      // Check if directory exists before attempting removal
      await fs.access(dirPath) // Throws if doesn't exist
      await fs.rm(dirPath, { recursive: true, force: true }) // Remove dir and contents
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.warn(`Project data directory not found, nothing to delete: ${dirPath}`)
        // Not an error condition if we're just ensuring it's gone
      } else {
        console.error(`Error deleting project data directory ${dirPath}:`, error)
        throw new Error(`Failed to delete project data directory: ${dirPath}. Reason: ${error.message}`)
      }
    }
  },

  /** Generates a simple unique ID (replace with more robust method if needed) */
  generateId: (prefix: string): string => {
    // Basic example, consider UUIDs for production
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`
  }
}
