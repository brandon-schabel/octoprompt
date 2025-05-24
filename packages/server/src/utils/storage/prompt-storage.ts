import { z, ZodError, type ZodTypeAny } from 'zod'
import path from 'node:path'
import fs from 'node:fs/promises'
import { PromptSchema, PromptProjectSchema, type Prompt, type PromptProject } from 'shared/src/schemas/prompt.schemas'
import { normalizeToUnixMs } from '../parse-timestamp'

// Define the base directory for storing prompt data
const DATA_DIR = path.resolve(process.cwd(), 'data', 'prompt_storage')

// --- Schemas for Storage ---
// Store all prompts (metadata) as a map (Record) keyed by promptId
export const PromptsStorageSchema = z.record(z.string(), PromptSchema)
export type PromptsStorage = z.infer<typeof PromptsStorageSchema>

// Store all prompt-project associations
export const PromptProjectsStorageSchema = z.array(PromptProjectSchema)
export type PromptProjectsStorage = z.infer<typeof PromptProjectsStorageSchema>

// --- Path Helpers ---

/** Gets the absolute path to the main prompts index file. */
function getPromptsIndexPath(): string {
  return path.join(DATA_DIR, 'prompts.json')
}

/** Gets the absolute path to the prompt-projects associations file. */
function getPromptProjectsPath(): string {
  return path.join(DATA_DIR, 'prompt-projects.json')
}

// --- Core Read/Write Functions (Adapted from existing storage utilities) ---

/** Ensures the specified directory exists. */
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

/**
 * Reads and validates JSON data from a file.
 */
async function readValidatedJson<T extends ZodTypeAny>(
  filePath: string,
  schema: T,
  defaultValue: z.infer<T>
): Promise<z.infer<T>> {
  try {
    await ensureDirExists(path.dirname(filePath))
    const fileContent = await fs.readFile(filePath, 'utf-8')
    const jsonData = JSON.parse(fileContent)
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
    console.error(`Error reading or parsing JSON from ${filePath}:`, error)
    throw new Error(`Failed to read/parse JSON file at ${filePath}. Reason: ${error.message}`)
  }
}

/**
 * Validates data and writes it to a JSON file.
 */
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

// --- Specific Data Accessors ---

export const promptStorage = {
  /** Reads the main prompts metadata file. */
  async readPrompts(): Promise<PromptsStorage> {
    return readValidatedJson(getPromptsIndexPath(), PromptsStorageSchema, {})
  },

  /** Writes the main prompts metadata file. */
  async writePrompts(prompts: PromptsStorage): Promise<PromptsStorage> {
    return writeValidatedJson(getPromptsIndexPath(), prompts, PromptsStorageSchema)
  },

  /** Reads the prompt-projects associations file. */
  async readPromptProjects(): Promise<PromptProjectsStorage> {
    return readValidatedJson(getPromptProjectsPath(), PromptProjectsStorageSchema, [])
  },

  /** Writes the prompt-projects associations file. */
  async writePromptProjects(promptProjects: PromptProjectsStorage): Promise<PromptProjectsStorage> {
    return writeValidatedJson(getPromptProjectsPath(), promptProjects, PromptProjectsStorageSchema)
  },

  /** Generates a unique ID. */
  generateId: (): number => {
    return normalizeToUnixMs(new Date())
  }
}