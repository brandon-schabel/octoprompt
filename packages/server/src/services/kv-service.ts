import { KeyValueStore, FileAdapter, type ValueValidator } from '@bnk/kv-store';

import { KVKey, KvSchemas, KVValue } from 'shared';

/**
 * 1) Create FileAdapter for on-disk JSON persistence.
 *    E.g., 'data/kv-store.json' (choose any path).
 */
const fileAdapter = new FileAdapter({ filePath: 'data/kv-store.json' });

/**
 * 2) Instantiate the KeyValueStore with versioning and a sync interval.
 *    The store is typed "loosely" for general usage — we apply
 *    strict typing in the convenience functions below.
 */
export const kvStore = new KeyValueStore({
    adapter: fileAdapter,
    enableVersioning: true,
    syncIntervalMs: 10_000, // auto-sync every 10s
    hooks: {
        onUpdate(key, newValue) {
            console.log(`[KV] Updated key "${key}" =>`, newValue);
        },
        onDelete(key) {
            console.log(`[KV] Deleted key "${key}"`);
        },
        onBackup(timestamp, version) {
            console.log(`[KV] Backup created at ${timestamp}, version=${version}`);
        },
    },
});

/**
 * 3) You must call store.init() once during server startup to load existing data from file.
 */
export async function initKvStore() {
    await kvStore.init();
    console.log(`[KV] KeyValueStore initialized. Current version: ${kvStore.getVersion()}`);
}

/**
 * 4) A helper to get typed data from the store. We look up the correct Zod schema and parse.
 */
export async function getKvValue<K extends KVKey>(
    key: K
): Promise<KVValue<K> | undefined> {
    // Optionally supply a validator to store.get():
    const zodValidator: ValueValidator<KVValue<K>> = (val) => {
        // We parse with the relevant schema; this will throw if invalid
        return KvSchemas[key].parse(val);
    };

    // get() returns unknown | undefined, so parse if present
    const value = kvStore.get<KVValue<K>>(key, { validator: zodValidator });
    return value;
}

/**
 * 5) A helper to set typed data in the store. We'll parse with Zod to ensure correctness.
 *    This will also be validated on the server side before saving.
 */
export async function setKvValue<K extends KVKey>(
    key: K,
    newValue: KVValue<K>
): Promise<void> {
    // Validate newValue with the correct schema
    const validated = KvSchemas[key].parse(newValue);

    // Store it
    kvStore.set<KVValue<K>>(key, validated);

    // Force immediate sync to disk (optional, you could rely on auto syncInterval)
    await kvStore.sync();
}

/**
 * 6) A helper to delete a key
 */
export async function deleteKvKey(key: KVKey): Promise<void> {
    kvStore.delete(key);
    await kvStore.sync();
}

/**
 * 7) Extra convenience: backup the entire store on demand
 */
export async function backupKvStore(): Promise<void> {
    await kvStore.createBackup();
}