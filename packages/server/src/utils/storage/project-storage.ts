// src/utils/project-storage.ts
import { z, ZodError, type ZodTypeAny } from 'zod'
import path from 'node:path'
import fs from 'node:fs/promises' // Using Node's fs promises
import { ProjectSchema, ProjectFileSchema, type ProjectFile } from 'shared/src/schemas/project.schemas'
import { AIFileChangesStorageSchema, type AIFileChangesStorage, type AIFileChangeRecord, AIFileChangeRecordSchema } from 'shared/src/schemas/ai-file-change.schemas'
import { normalizeToUnixMs } from '../parse-timestamp'

// Define the base directory for storing project data
// Adjust this path as needed, e.g., use an environment variable
const DATA_DIR = path.resolve(process.cwd(), 'data', 'project_storage')

// --- Schemas for Storage ---
// Store projects as a map (Record) keyed by projectId
export const ProjectsStorageSchema = z.record(z.number(), ProjectSchema)
export type ProjectsStorage = z.infer<typeof ProjectsStorageSchema>

// even though the keys are numbers, they are saved as string because that is default javascript behavior
export const ProjectFilesStorageSchema = z.record(z.string(), ProjectFileSchema)
export type ProjectFilesStorage = z.infer<typeof ProjectFilesStorageSchema>

// --- Path Helpers ---

/** Gets the absolute path to the main projects index file. */
function getProjectsIndexPath(): string {
  return path.join(DATA_DIR, 'projects.json')
}

/** Gets the absolute path to a specific project's directory. */
function getProjectDataDir(projectId: number): string {
  return path.join(DATA_DIR, 'project_data', projectId.toString())
}

/** Gets the absolute path to a specific project's files index file. */
function getProjectFilesPath(projectId: number): string {
  return path.join(getProjectDataDir(projectId), 'files.json')
}

/** Gets the absolute path to a specific project's AI file changes index file. */
function getProjectAIFileChangesPath(projectId: number): string {
  return path.join(getProjectDataDir(projectId), 'ai-file-changes.json')
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

    // Handle cases where fileContent might be empty or only whitespace
    if (fileContent.trim() === '') {
      console.warn(`File is empty or contains only whitespace: ${filePath}. Returning default value.`);
      return defaultValue;
    }

    let jsonData = JSON.parse(fileContent) // This can throw SyntaxError

    console.log('jsonData', jsonData)

    // If the schema is a ZodRecord with numeric keys, transform string keys to numbers
    if (schema instanceof z.ZodRecord && schema.keySchema instanceof z.ZodNumber) {
      const transformedData: Record<number, unknown> = {};
      for (const key in jsonData) {
        if (Object.prototype.hasOwnProperty.call(jsonData, key)) {
          const numKey = Number(key);
          if (!isNaN(numKey)) {
            transformedData[numKey] = jsonData[key];
          } else {
            // If the key is not a valid number for a schema expecting numeric keys,
            // log a warning and omit this key-value pair from the transformed data.
            // This ensures that 'transformedData' only contains numeric keys,
            // allowing Zod validation for z.record(z.number(), ...) to pass if values are correct.
            console.warn(`Omitting non-numeric key "${key}" from object in ${filePath} as schema expects numeric keys.`);
          }
        }
      }
      jsonData = transformedData;
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
    // Specifically catch JSON parsing errors
    if (error instanceof SyntaxError) {
      console.error(`JSON Parse error in ${filePath}:`, error.message);
      console.warn(`Returning default value due to JSON parsing error for ${filePath}.`);
      return defaultValue;
    }
    console.error(`Error reading or parsing JSON from ${filePath}:`, error)
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
  async readProjectFiles(projectId: number): Promise<ProjectFilesStorage> {
    return readValidatedJson(getProjectFilesPath(projectId), ProjectFilesStorageSchema, {})
  },

  /** Writes a specific project's file data. */
  async writeProjectFiles(projectId: number, files: ProjectFilesStorage): Promise<ProjectFilesStorage> {
    return writeValidatedJson(getProjectFilesPath(projectId), files, ProjectFilesStorageSchema)
  },

  /** Reads a specific project's AI file changes data. */
  async readAIFileChanges(projectId: number): Promise<AIFileChangesStorage> {
    return readValidatedJson(getProjectAIFileChangesPath(projectId), AIFileChangesStorageSchema, {})
  },

  /** Writes a specific project's AI file changes data. */
  async writeAIFileChanges(projectId: number, changes: AIFileChangesStorage): Promise<AIFileChangesStorage> {
    return writeValidatedJson(getProjectAIFileChangesPath(projectId), changes, AIFileChangesStorageSchema)
  },

  /**
   * Adds or updates a specific AI file change record within a project.
   * @param projectId The ID of the project.
   * @param changeData The AI file change data to add or update.
   * @returns The validated and saved AIFileChangeRecord data.
   */
  async saveAIFileChange(projectId: number, changeData: AIFileChangeRecord): Promise<AIFileChangeRecord> {
    const validationResult = await AIFileChangeRecordSchema.safeParseAsync(changeData);
    if (!validationResult.success) {
      console.error(`Zod validation failed for AI file change in project ${projectId}:`, validationResult.error.errors);
      throw new ZodError(validationResult.error.errors);
    }
    const validatedChangeData = validationResult.data;

    const currentChanges = await this.readAIFileChanges(projectId);
    currentChanges[validatedChangeData.id] = validatedChangeData;

    await this.writeAIFileChanges(projectId, currentChanges);
    return validatedChangeData;
  },

  /**
   * Retrieves a specific AI file change record by its ID from a project.
   * @param projectId The ID of the project.
   * @param aiFileChangeId The ID of the AI file change record.
   * @returns The AIFileChangeRecord or undefined if not found.
   */
  async getAIFileChangeById(projectId: number, aiFileChangeId: number): Promise<AIFileChangeRecord | undefined> {
    const changes = await this.readAIFileChanges(projectId);
    return changes[aiFileChangeId];
  },

  /**
   * Updates a specific file within a project.
   * Reads the project's files, merges the new data, sets the `updated` timestamp,
   * validates the complete object, and writes the entire file map back.
   * @param projectId The ID of the project containing the file.
   * @param fileId The ID of the file to update.
   * @param fileData A partial object of file properties to update. Fields like id, projectId, created, and updated are ignored.
   * @returns The validated and saved ProjectFile data.
   * @throws ZodError if validation fails.
   * @throws Error if the file is not found or if reading/writing fails.
   */
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
      updated: Date.now() // Always set a new update timestamp in milliseconds
    }

    // ProjectFileSchema is expected to be updated to match Python's schema
    // with `created` and `updated` as number fields.
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

  /** Deletes a project's data directory. */
  async deleteProjectData(projectId: number): Promise<void> {
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
  generateId: (): number => {
    return normalizeToUnixMs(new Date())
  }
}