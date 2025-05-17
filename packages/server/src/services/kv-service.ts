import { z, ZodError } from 'zod'
import path from 'node:path'
import { ApiError } from 'shared'
import { KVKey, KvSchemas, KVValue } from 'shared/src/schemas/kv-store.schemas'
import { mergeDeep } from 'shared/src/utils/merge-deep'
import { jsonScribe } from '../utils/json-scribe'

const KV_STORE_FILE_PATH = ['data', 'kv-store.json']
const KV_STORE_BASE_PATH = process.cwd()

/** Using Record for simplicity, Map could also be used. */
let memoryStore: Record<string, unknown> = {}

/** Persists the current in-memory store to the JSON file. */
async function syncStoreToFile(): Promise<void> {
  try {
    await jsonScribe.write({
      path: KV_STORE_FILE_PATH,
      basePath: KV_STORE_BASE_PATH,
      data: memoryStore
    })
    console.log(`[KV] Synced state to ${path.resolve(KV_STORE_BASE_PATH, ...KV_STORE_FILE_PATH.map(String))}`)
  } catch (error) {
    console.error('[KV] Error syncing store to file:', error)
    throw new ApiError(500, `Internal Error: Failed to save KV store state.`, 'KV_SYNC_FAILED')
  }
}

/**  Initializes the KV service by loading data from the JSON file into memory. */
export async function initKvStore(): Promise<void> {
  try {
    const loadedData = await jsonScribe.read<Record<string, unknown>>({
      path: KV_STORE_FILE_PATH,
      basePath: KV_STORE_BASE_PATH
    })

    if (loadedData) {
      if (typeof loadedData === 'object' && loadedData !== null && !Array.isArray(loadedData)) {
        memoryStore = loadedData
        console.log(`[KV] KeyValueStore initialized. Loaded ${Object.keys(memoryStore).length} keys from file.`)
      } else {
        console.warn(
          `[KV] Invalid data format found in ${path.resolve(KV_STORE_BASE_PATH, ...KV_STORE_FILE_PATH.map(String))}. Initializing with empty store.`
        )
        memoryStore = {}
      }
    } else {
      console.log(`[KV] No existing store file found. Initializing with empty store.`)
      memoryStore = {}
    }
  } catch (error) {
    console.error('[KV] Error initializing KeyValueStore:', error)
    memoryStore = {}
    throw new ApiError(
      500,
      `Failed to initialize KV store: ${error instanceof Error ? error.message : String(error)}`,
      'KV_INIT_FAILED'
    )
  }
}

/** Gets typed and validated data from the store. Reads from the in-memory cache and validates the result. */
export async function getKvValue<K extends KVKey>(key: K): Promise<KVValue<K>> {
  const value = memoryStore[key]

  if (value === undefined) {
    throw new ApiError(404, `Key "${key}" not found in KV store.`, 'KV_KEY_NOT_FOUND')
  }

  try {
    const schema = KvSchemas[key]
    const validationResult = await schema.safeParseAsync(value)

    if (!validationResult.success) {
      console.error(
        `[KV] Zod validation failed for key "${key}" on get (data in store is corrupt):`,
        validationResult.error.errors
      )
      // Data in the store is corrupt and doesn't match its schema
      throw new ApiError(500, `Corrupt data found in KV store for key "${key}".`, 'KV_VALUE_CORRUPT_IN_STORE', {
        issues: validationResult.error.errors
      })
    }
    return validationResult.data as KVValue<K>
  } catch (error) {
    console.error(`[KV] Error during Zod parsing for key "${key}" on get:`, error)
    throw new ApiError(
      500,
      `Internal error parsing data for key "${key}" from KV store.`,
      'KV_VALUE_PARSE_ERROR_IN_STORE',
      { originalError: error }
    )
  }
}

/** Sets typed data in the store. Validates the data, updates the in-memory */
export async function setKvValue<K extends KVKey>(key: K, newValue: KVValue<K>): Promise<void> {
  let validatedValue: KVValue<K>
  try {
    const schema = KvSchemas[key]

    validatedValue = await schema.parseAsync(newValue)
  } catch (error) {
    console.error(`[KV] Zod validation failed for key "${key}" on set:`, error)
    if (error instanceof ZodError) {
      // Re-throw Zod errors or convert to ApiError for controller handling
      throw new ApiError(
        400,
        `Invalid data provided for key "${key}": ${error.errors.map((e) => e.message).join(', ')}`,
        'VALIDATION_ERROR',
        { issues: error.errors }
      )
    }
    throw new ApiError(
      500,
      `Internal Error: Validation failed unexpectedly for key "${key}".`,
      'INTERNAL_VALIDATION_ERROR'
    )
  }

  memoryStore[key] = validatedValue
  console.log(`[KV] Updated key "${key}" in memory =>`, validatedValue)
  await syncStoreToFile()
}

/** Deep merges a partial object into an existing object value in the store. */
export async function updateKVStore<K extends KVKey>(key: K, newValue: Partial<KVValue<K>>): Promise<KVValue<K>> {
  const currentValue = await getKvValue(key)

  // Perform deep merge
  let updatedValue: KVValue<K>
  if (typeof currentValue === 'object' && currentValue !== null && typeof newValue === 'object' && newValue !== null) {
    updatedValue = mergeDeep(currentValue as Record<string, any>, newValue)
  } else {
    // If either current or new value is not an object, treat newValue as a complete replacement.
    updatedValue = newValue as KVValue<K>
  }

  // Set the merged value (this will handle validation and persistence)
  await setKvValue(key, updatedValue)

  // Return the validated, updated value. Read from memoryStore as setKvValue updates it.
  const finalValue = memoryStore[key]
  if (finalValue === undefined) {
    throw new ApiError(
      500,
      `Internal Error: Value for key "${key}" disappeared after update.`,
      'KV_UPDATE_INTERNAL_ERROR'
    )
  }
  return finalValue as KVValue<K>
}

/** Deletes a key from the store and persists the change. */
export async function deleteKvKey(key: KVKey): Promise<void> {
  if (memoryStore.hasOwnProperty(key)) {
    delete memoryStore[key]
    console.log(`[KV] Deleted key "${key}" from memory`)
    await syncStoreToFile() // syncStoreToFile can throw ApiError
  } else {
    console.log(`[KV] Attempted to delete non-existent key "${key}"`)
    // Throw an error if deleting a non-existent key is an issue
    throw new ApiError(404, `Cannot delete: Key "${key}" not found.`, 'KV_KEY_NOT_FOUND')
  }
}

/** Creates a backup of the current KV store file. */
export async function backupKvStore(): Promise<void> {
  const sourcePath = path.resolve(KV_STORE_BASE_PATH, ...KV_STORE_FILE_PATH.map(String))
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDir = path.join(KV_STORE_BASE_PATH, 'data', 'backups')
  const backupFilename = `kv-store-backup-${timestamp}.json`
  const backupPath = path.join(backupDir, backupFilename)

  try {
    const sourceFile = Bun.file(sourcePath)
    if (!(await sourceFile.exists())) {
      console.warn(`[KV] Backup skipped: Source file not found at ${sourcePath}`)
      return
    }

    await Bun.write(backupPath, sourceFile)

    console.log(`[KV] Backup created successfully at ${backupPath}`)
  } catch (error) {
    console.error(`[KV] Error creating backup:`, error)
    throw new ApiError(
      500,
      `Internal Error: Failed to create KV store backup. Reason: ${error instanceof Error ? error.message : String(error)}`,
      'KV_BACKUP_FAILED'
    )
  }
}
