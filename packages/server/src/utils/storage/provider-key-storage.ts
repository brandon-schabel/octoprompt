// packages/server/src/utils/storage/provider-key-storage.ts
import { z, ZodError, type ZodTypeAny } from 'zod'
import path from 'node:path'
import fs from 'node:fs/promises'
import { ProviderKeySchema, type ProviderKey } from 'shared/src/schemas/provider-key.schemas'
import { randomUUID } from 'crypto'
import { normalizeToUnixMs } from '../parse-timestamp'

// Define the base directory for storing provider key data
const DATA_DIR = path.resolve(process.cwd(), 'data', 'provider_key_storage')
const PROVIDER_KEYS_FILE_NAME = 'provider_keys.json'

// Schema for the entire storage file: a record of ProviderKeys keyed by their ID
export const ProviderKeysStorageSchema = z.record(z.string(), ProviderKeySchema)
export type ProviderKeysStorage = z.infer<typeof ProviderKeysStorageSchema>

// --- Path Helper ---
function getProviderKeysFilePath(): string {
  return path.join(DATA_DIR, PROVIDER_KEYS_FILE_NAME)
}

// --- Core Read/Write Functions (Common pattern from your other storage utils) ---

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
    await ensureDirExists(path.dirname(filePath)) // Ensure parent directory exists
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
      // File doesn't exist, return the default value
      return defaultValue
    }
    console.error(`Error reading or parsing JSON from ${filePath}:`, error)
    throw new Error(`Failed to read/parse JSON file at ${filePath}. Reason: ${error.message}`)
  }
}

async function writeValidatedJson<T extends ZodTypeAny>(
  filePath: string,
  data: unknown, // Accept unknown initially for validation
  schema: T
): Promise<z.infer<T>> {
  try {
    const validationResult = await schema.safeParseAsync(data)
    if (!validationResult.success) {
      console.error(`Zod validation failed before writing to ${filePath}:`, validationResult.error.errors)
      throw new ZodError(validationResult.error.errors)
    }
    const validatedData = validationResult.data

    await ensureDirExists(path.dirname(filePath)) // Ensure directory exists
    const jsonString = JSON.stringify(validatedData, null, 2) // Pretty print
    await fs.writeFile(filePath, jsonString, 'utf-8')

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

export const providerKeyStorage = {
  /** Reads the provider keys data file. */
  async readProviderKeys(): Promise<ProviderKeysStorage> {
    return readValidatedJson(getProviderKeysFilePath(), ProviderKeysStorageSchema, {})
  },

  /** Writes the provider keys data file. */
  async writeProviderKeys(keys: ProviderKeysStorage): Promise<ProviderKeysStorage> {
    return writeValidatedJson(getProviderKeysFilePath(), keys, ProviderKeysStorageSchema)
  },

  /** Generates a unique ID for provider keys. */
  generateId: (): number => {
    return normalizeToUnixMs(new Date())
  }
}