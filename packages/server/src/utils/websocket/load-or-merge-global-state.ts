import { globalStateSchema, createInitialGlobalState, type GlobalState } from "shared";
import { mergeDeep } from "./merge-deep"; // We'll create a simple merge function below

/**
 * Attempts to load the file at `filePath` (JSON),
 * parse it with `globalStateSchema`, and then merges
 * any missing fields from the default state.
 * Returns a valid GlobalState in all cases.
 */
export async function loadOrMergeGlobalState(filePath: string): Promise<GlobalState> {
    try {
        const file = Bun.file(filePath);
        const exists = await file.exists();
        
        // If file doesn't exist, return initial state
        if (!exists) {
            console.log(`[loadOrMergeGlobalState] State file "${filePath}" not found. Creating new state.`);
            return createInitialGlobalState();
        }

        const fileContents = await file.text();
        
        // If file is empty, return initial state
        if (!fileContents.trim()) {
            console.log(`[loadOrMergeGlobalState] State file "${filePath}" is empty. Creating new state.`);
            return createInitialGlobalState();
        }

        const raw = JSON.parse(fileContents);
        console.log(`[loadOrMergeGlobalState] Successfully parsed JSON from "${filePath}"`);
        
        // Handle the case where the file has { state: {}, version: 0 } format
        if (raw.state !== undefined && raw.version !== undefined) {
            console.warn("[loadOrMergeGlobalState] Found legacy state format, creating new state.");
            return createInitialGlobalState();
        }
        
        // 1) Validate the loaded object with Zod
        const parsed = globalStateSchema.safeParse(raw);
        if (!parsed.success) {
            console.warn("[loadOrMergeGlobalState] State file validation failed:", parsed.error.issues);
            console.warn("[loadOrMergeGlobalState] Falling back to defaults.");
            return createInitialGlobalState();
        }

        console.log("[loadOrMergeGlobalState] Successfully validated state schema");

        // 2) Merge the loaded object with defaults so we never lose new fields
        const defaults = createInitialGlobalState();
        const merged = mergeDeep(defaults, parsed.data);
        console.log("[loadOrMergeGlobalState] Successfully merged with defaults");
        
        return merged;
    } catch (error) {
        console.warn(`[loadOrMergeGlobalState] Failed to load valid state from "${filePath}". Using defaults. Error:`, error);
        return createInitialGlobalState();
    }
}