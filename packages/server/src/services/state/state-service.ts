/* ===== [NEW] packages/server/src/state/state-service.ts ===== */
import { z } from "zod";
import { GlobalState, globalStateSchema, createInitialGlobalState } from "shared";

const STATE_FILE_PATH = "./data/websocket-state.json";
const stateFile = Bun.file(STATE_FILE_PATH);

// Helper to safely read and parse the state file
async function _readStateFromFile(): Promise<GlobalState> {
    try {
        if (!(await stateFile.exists())) {
            console.warn(`[State Service] State file not found at ${STATE_FILE_PATH}. Creating initial state.`);
            const initialState = createInitialGlobalState();
            // Attempt to write the initial state immediately
            await _writeStateToFile(initialState);
            return initialState;
        }
        

        const content = await stateFile.text();
        console.log("[State Service] State file content:", content);
        if (!content) {
            console.warn(`[State Service] State file is empty. Returning initial state.`);
            return createInitialGlobalState();
        }

        const parsedState = JSON.parse(content);
        
        const validation = globalStateSchema.safeParse(parsedState.state);

        if (!validation.success) {
            console.error("[State Service] :", validation.error.flatten());
            console.warn("[State Service] Returning initial state due to validation failure.");
            return createInitialGlobalState(); // Return default state if validation fails
        }
        return validation.data;
    } catch (error: any) {
        console.error(`[State Service] Error reading or parsing state file ${STATE_FILE_PATH}:`, error);
        console.warn("[State Service] Returning initial state due to read/parse error.");
        return createInitialGlobalState(); // Return default state on error
    }
}

// Helper to validate and write state to file
async function _writeStateToFile(newState: GlobalState): Promise<GlobalState> {
    const validation = globalStateSchema.safeParse(newState);
    if (!validation.success) {
        console.error("[State Service] Validation failed before writing state:", validation.error.flatten());
        // Throw a ZodError or a custom error to be caught by the route handler
        throw new z.ZodError(validation.error.issues);
    }
    try {
        await Bun.write(STATE_FILE_PATH, JSON.stringify(validation.data, null, 2));
        return validation.data;
    } catch (error: any) {
        console.error(`[State Service] Error writing state file ${STATE_FILE_PATH}:`, error);
        throw new Error(`Failed to write state to file: ${error.message}`);
    }
}

// --- Public API ---

export async function getCurrentState(): Promise<GlobalState> {
    return await _readStateFromFile();
}

export async function updateStateByKey<K extends keyof GlobalState>(
    key: K,
    value: GlobalState[K]
): Promise<GlobalState> {
    const currentState = await getCurrentState();
    const newState: GlobalState = {
        ...currentState,
        [key]: value,
    };
    // Validation happens within _writeStateToFile
    return await _writeStateToFile(newState);
}

export async function replaceState(newState: unknown): Promise<GlobalState> {
    // Validate the input structure first before attempting to write
    const validation = globalStateSchema.safeParse(newState);
    if (!validation.success) {
        console.error("[State Service] Validation failed for replacing state:", validation.error.flatten());
        throw new z.ZodError(validation.error.issues);
    }
    // Use the validated data
    return await _writeStateToFile(validation.data);
}