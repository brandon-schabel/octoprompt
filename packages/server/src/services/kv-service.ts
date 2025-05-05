import { z, ZodError } from 'zod';
import path from 'node:path';
import { ApiError } from 'shared';
import { KVKey, KvSchemas, KVValue } from 'shared/src/schemas/kv-store.schemas';
import { mergeDeep } from 'shared/src/utils/merge-deep';
import { jsonScribe } from '../utils/json-scribe';

const KV_STORE_FILE_PATH = ['data', 'kv-store.json'];
const KV_STORE_BASE_PATH = process.cwd();


// Using Record for simplicity, Map could also be used.
// Holds the entire KV state. Initialized empty, loaded by initKvStore.
// Using `unknown` because values have different types based on the key.
// Type safety is enforced by get/set helpers using KvSchemas.
let memoryStore: Record<string, unknown> = {};

// --- Internal Helper Functions ---

/**
 * Persists the current in-memory store to the JSON file.
 * This writes the *entire* state.
 */
async function syncStoreToFile(): Promise<void> {
    try {
        // No schema needed here, as individual values are validated on set/update.
        // We are writing the entire known valid state from memory.
        await jsonScribe.write({
            path: KV_STORE_FILE_PATH,
            basePath: KV_STORE_BASE_PATH,
            data: memoryStore,
        });
        console.log(`[KV] Synced state to ${path.resolve(KV_STORE_BASE_PATH, ...KV_STORE_FILE_PATH.map(String))}`);
    } catch (error) {
        console.error("[KV] Error syncing store to file:", error);
        // Depending on requirements, you might want to throw or handle this differently
        // For example, implement retry logic or mark the store as dirty.
        throw new ApiError(500, `Internal Error: Failed to save KV store state.`, 'KV_SYNC_FAILED');
    }
}

// --- Service Initialization ---

/**
 * Initializes the KV service by loading data from the JSON file into memory.
 * Must be called once during server startup.
 */
export async function initKvStore(): Promise<void> {
    try {
        const loadedData = await jsonScribe.read<Record<string, unknown>>({
            path: KV_STORE_FILE_PATH,
            basePath: KV_STORE_BASE_PATH,
        });

        if (loadedData) {
            // Basic validation: ensure it's an object
            if (typeof loadedData === 'object' && loadedData !== null && !Array.isArray(loadedData)) {
                memoryStore = loadedData;
                console.log(`[KV] KeyValueStore initialized. Loaded ${Object.keys(memoryStore).length} keys from file.`);
            } else {
                console.warn(`[KV] Invalid data format found in ${path.resolve(KV_STORE_BASE_PATH, ...KV_STORE_FILE_PATH.map(String))}. Initializing with empty store.`);
                memoryStore = {};
                // Optionally, attempt to write the empty store back to fix the file
                // await syncStoreToFile();
            }
        } else {
            console.log(`[KV] No existing store file found. Initializing with empty store.`);
            memoryStore = {};
            // Optionally create the file with an empty object on first init
            // await syncStoreToFile();
        }
    } catch (error) {
        console.error("[KV] Error initializing KeyValueStore:", error);
        // Decide how to handle initialization errors (e.g., throw, exit, default state)
        memoryStore = {}; // Default to empty store on error
        throw new Error(`Failed to initialize KV store: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// --- Core KV Operations ---

/**
 * Gets typed and validated data from the store.
 * Reads from the in-memory cache and validates the result.
 */
export async function getKvValue<K extends KVKey>(
    key: K
): Promise<KVValue<K> | undefined> {
    const value = memoryStore[key];

    if (value === undefined) {
        return undefined;
    }

    try {
        // Validate the value retrieved from memory against the schema
        const schema = KvSchemas[key];
        // Use safeParse to handle potential validation errors gracefully
        const validationResult = await schema.safeParseAsync(value);

        if (!validationResult.success) {
            console.error(`[KV] Zod validation failed for key "${key}" on get:`, validationResult.error.errors);
            // Decide how to handle invalid data found in the store (e.g., return undefined, throw, log)
            // Returning undefined might be safest to prevent propagation of invalid data.
            return undefined;
        }
        return validationResult.data as KVValue<K>;
    } catch (error) { // Catch potential errors during Zod parsing itself
        console.error(`[KV] Error during Zod parsing for key "${key}" on get:`, error);
        return undefined; // Return undefined on parsing errors
    }
}

/**
 * Sets typed data in the store. Validates the data, updates the in-memory
 * cache, and persists the entire store to disk.
 */
export async function setKvValue<K extends KVKey>(
    key: K,
    newValue: KVValue<K>
): Promise<void> {
    let validatedValue: KVValue<K>;
    try {
        // 1. Validate newValue with the correct schema before storing
        const schema = KvSchemas[key];
        // Use parseAsync for potential async refinements/transforms in Zod schemas


        validatedValue = await schema.parseAsync(newValue);
    } catch (error) {
        console.error(`[KV] Zod validation failed for key "${key}" on set:`, error);
        if (error instanceof ZodError) {
            // Re-throw Zod errors or convert to ApiError for controller handling
            throw new ApiError(400, `Invalid data provided for key "${key}": ${error.errors.map(e => e.message).join(', ')}`, 'VALIDATION_ERROR', { issues: error.errors });
        }
        throw new ApiError(500, `Internal Error: Validation failed unexpectedly for key "${key}".`, 'INTERNAL_VALIDATION_ERROR');
    }

    // 2. Update the in-memory cache
    memoryStore[key] = validatedValue;
    console.log(`[KV] Updated key "${key}" in memory =>`, validatedValue);


    // 3. Persist the entire store to disk
    await syncStoreToFile();
}

/**
 * Deep merges a partial object into an existing object value in the store.
 * Throws if the key doesn't exist or the existing value isn't an object.
 */
export async function updateKVStore<K extends KVKey>(
    key: K,
    newValue: Partial<KVValue<K>>
): Promise<KVValue<K>> {
    // Use getKvValue to ensure we're working with validated data if it exists
    // Note: This performs an unnecessary validation read if the data is already valid in memory,
    // but ensures we don't merge into potentially invalid data.
    // Alternatively, read directly from memoryStore and validate *after* merge.
    // Let's read directly from memory first for efficiency, then validate post-merge.

    const currentValue = memoryStore[key];

    if (currentValue === undefined) {
        throw new ApiError(404, `Cannot update: Key "${key}" not found.`, 'KV_KEY_NOT_FOUND');
    }

    // Perform deep merge
    // We cast currentValue because we've checked it's an object,
    // but TS doesn't narrow it down from `unknown` sufficiently without complex type guards.
    let updatedValue: KVValue<K>;
    if (typeof currentValue === 'object') {
        updatedValue = mergeDeep(currentValue as Record<string, any>, newValue);
    } else {
        updatedValue = newValue as KVValue<K>;
    }

    // Set the merged value (this will handle validation and persistence)
    // Cast is necessary here because mergeDeep returns a broad type.
    // setKvValue will validate against the specific KvSchemas[key].
    await setKvValue(key, updatedValue as KVValue<K>);

    // Return the validated, updated value (setKvValue ensures validation)
    // Re-read from memoryStore as setKvValue might transform data via Zod schema
    return memoryStore[key] as KVValue<K>;
}

/**
 * Deletes a key from the store and persists the change.
 */
export async function deleteKvKey(key: KVKey): Promise<void> {
    if (memoryStore.hasOwnProperty(key)) {
        delete memoryStore[key];
        console.log(`[KV] Deleted key "${key}" from memory`);
        await syncStoreToFile();
    } else {
        console.log(`[KV] Attempted to delete non-existent key "${key}"`);
        // Optionally throw an error if deleting a non-existent key is an issue
        // throw new ApiError(404, `Cannot delete: Key "${key}" not found.`, 'KV_KEY_NOT_FOUND');
    }
}

/**
 * Creates a backup of the current KV store file.
 */
export async function backupKvStore(): Promise<void> {
    const sourcePath = path.resolve(KV_STORE_BASE_PATH, ...KV_STORE_FILE_PATH.map(String));
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(KV_STORE_BASE_PATH, 'data', 'backups'); // Example backup directory
    const backupFilename = `kv-store-backup-${timestamp}.json`;
    const backupPath = path.join(backupDir, backupFilename);

    try {
        const sourceFile = Bun.file(sourcePath);
        if (!(await sourceFile.exists())) {
            console.warn(`[KV] Backup skipped: Source file not found at ${sourcePath}`);
            return;
        }

        // Ensure backup directory exists (Bun.write handles directory creation)
        await Bun.write(backupPath, sourceFile); // Efficiently copies the file content

        console.log(`[KV] Backup created successfully at ${backupPath}`);
    } catch (error) {
        console.error(`[KV] Error creating backup:`, error);
        throw new ApiError(500, `Internal Error: Failed to create KV store backup. Reason: ${error instanceof Error ? error.message : String(error)}`, 'KV_BACKUP_FAILED');
    }
}

