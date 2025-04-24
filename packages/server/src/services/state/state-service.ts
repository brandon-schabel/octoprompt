import { z } from "zod";
import { GlobalState, globalStateSchema, createInitialGlobalState, ApiError, AppSettings, appSettingsSchema, ProjectTabsStateRecord, projectTabsStateRecordSchema, ProjectTabState, projectTabStateSchema, getDefaultProjectTabState } from "shared";
import { sleep } from "bun"; // Import sleep
import { v4 as uuidv4 } from "uuid"; // Import uuid for generating tab IDs

const STATE_FILE_PATH = "./data/app-state.json";
const stateFile = Bun.file(STATE_FILE_PATH);

// --- State Lock ---
let isWritingState = false;
const LOCK_TIMEOUT_MS = 5000; // Max time to wait for lock release (prevent indefinite hangs)
const LOCK_RETRY_DELAY_MS = 50; // Time to wait between lock checks

// 1. Add this diagnostic function to state-service.ts
export async function debugStateFile(): Promise<{
    exists: boolean;
    content?: string;
    parsedContent?: any;
    validationResult?: {
        success: boolean;
        error?: any;
        data?: any;
    };
    rawStructure?: string;
}> {
    try {
        // Check if file exists
        const stateFile = Bun.file(STATE_FILE_PATH);
        const exists = await stateFile.exists();

        if (!exists) {
            return { exists: false };
        }

        // Get raw content
        const content = await stateFile.text();

        // Try to parse it
        let parsedContent;
        try {
            parsedContent = JSON.parse(content);
        } catch (e) {
            return {
                exists: true,
                content,
                validationResult: {
                    success: false,
                    error: `JSON parse error: ${e instanceof Error ? e.message : 'Unknown error'}`
                }
            };
        }

        // Try both parsing approaches
        let directValidation = globalStateSchema.safeParse(parsedContent);
        let nestedValidation = parsedContent?.state ?
            globalStateSchema.safeParse(parsedContent.state) :
            null; // Initialize as null

        // --- Linter Fixes Applied Here ---
        let finalSuccess = false;
        let finalError: any = {};
        let finalData: any = undefined;
        let rawStructure = JSON.stringify(Object.keys(parsedContent));

        if (directValidation.success) {
            finalSuccess = true;
            finalData = directValidation.data;
        } else {
            finalError.direct = directValidation.error.flatten(); // Use flatten for better error details
            if (nestedValidation?.success) {
                finalSuccess = true;
                finalData = nestedValidation.data;
                // Optional: Log that nested validation was used
                console.log("[debugStateFile] Direct validation failed, but nested validation succeeded.");
            } else {
                finalError.nested = nestedValidation?.error?.flatten() ?? "No .state property found or nested validation failed.";
            }
        }
        // --- End Linter Fixes ---


        return {
            exists: true,
            content,
            parsedContent,
            rawStructure, // Use calculated rawStructure
            validationResult: {
                success: finalSuccess,
                error: !finalSuccess ? finalError : undefined, // Only show error if validation failed
                data: finalData,
            }
        };
    } catch (error) {
        return {
            exists: true, // Assuming error happened after existence check
            validationResult: {
                success: false,
                error: `Unexpected error in debugStateFile: ${error instanceof Error ? error.message : 'Unknown error'}`
            }
        };
    }
}

// 2. Add this to fix the state file structure mismatch
async function _readStateFromFile(): Promise<GlobalState> {
    // console.log("[State Service - Read] Attempting to read state file:", STATE_FILE_PATH); // Reduce noise
    try {
        if (!(await stateFile.exists())) {
            console.warn(`[State Service - Read] State file not found at ${STATE_FILE_PATH}. Creating initial state.`);
            const initialState = createInitialGlobalState();
            // Attempt to write the initial state immediately
            try {
                // Use acquireLock/releaseLock even for initial write for consistency
                await _writeStateToFile(initialState, true);
                console.log("[State Service - Read] Successfully wrote initial state file.");
            } catch (writeError) {
                console.error("[State Service - Read] Failed to write initial state file:", writeError);
                // Still return initial state in memory, but log the write failure
            }
            return initialState;
        }

        const content = await stateFile.text();

        if (!content.trim()) { // Check for empty or whitespace-only content
            console.warn(`[State Service - Read] State file is empty or contains only whitespace. Returning initial state.`);
            return createInitialGlobalState();
        }

        let parsedState;
        try {
            parsedState = JSON.parse(content);
        } catch (parseError) {
            console.error("[State Service - Read] JSON parse error:", parseError);
            console.warn("[State Service - Read] Returning initial state due to parse failure.");
            return createInitialGlobalState();
        }


        // FIXED: Try both direct validation and nested .state validation
        let validationResult; // Use a single variable for the result

        validationResult = globalStateSchema.safeParse(parsedState);

        // If direct fails, try nested .state
        if (!validationResult.success && parsedState?.state) {
            console.log("[State Service - Read] Direct validation failed, attempting nested '.state' property validation...");
            validationResult = globalStateSchema.safeParse(parsedState.state);
        }

        // Check the final validation result
        if (!validationResult.success) {
            console.error("[State Service - Read] Final validation failed. Error details:", JSON.stringify(validationResult.error.flatten(), null, 2));
            console.warn("[State Service - Read] Returning initial state due to validation failure.");
            return createInitialGlobalState();
        }

        // Validation successful
        console.log("[State Service - Read] Successfully validated state from file. Project tabs found:",
            Object.keys(validationResult.data.projectTabs || {}).length);
        return validationResult.data;

    } catch (error: any) {
        console.error(`[State Service - Read] Unexpected error reading or processing state file ${STATE_FILE_PATH}:`, error);
        console.warn("[State Service - Read] Returning initial state due to unexpected error.");
        return createInitialGlobalState();
    }
}

// --- Lock Acquisition Helper ---
async function acquireLock(operationName: string): Promise<void> {
    const startTime = Date.now();
    while (isWritingState) {
        if (Date.now() - startTime > LOCK_TIMEOUT_MS) {
            console.error(`[State Service - Lock] Timeout waiting for lock during operation: ${operationName}`);
            throw new ApiError(503, 'State service is busy, please try again later.', 'STATE_LOCKED_TIMEOUT');
        }
        console.warn(`[State Service - Lock] Waiting for lock release for operation: ${operationName}...`);
        await sleep(LOCK_RETRY_DELAY_MS);
    }
    isWritingState = true;
    console.log(`[State Service - Lock] Lock acquired for operation: ${operationName}`);
}

function releaseLock(operationName: string): void {
    isWritingState = false;
    console.log(`[State Service - Lock] Lock released after operation: ${operationName}`);
}

// 3. Then modify _writeStateToFile to use the lock
async function _writeStateToFile(newState: GlobalState, isInitialWrite: boolean = false): Promise<GlobalState> {
    const writeType = isInitialWrite ? "initial" : "update";
    const operationName = `writeState (${writeType})`;

    await acquireLock(operationName); // Wait for and acquire the lock

    try {
        console.log(`[State Service - Write] Attempting ${writeType} write. Validating state before writing...`);
        const validation = globalStateSchema.safeParse(newState);
        if (!validation.success) {
            console.error(`[State Service - Write] Validation failed before ${writeType} write:`, JSON.stringify(validation.error.flatten(), null, 2));
            throw new z.ZodError(validation.error.issues);
        }
        const validatedData = validation.data;
        const expectedTabCount = Object.keys(validatedData.projectTabs || {}).length;
        console.log(`[State Service - Write] Validation successful for ${writeType} write. Expecting ${expectedTabCount} tabs.`);

        const stateString = JSON.stringify(validatedData, null, 2);
        await Bun.write(STATE_FILE_PATH, stateString);
        console.log(`[State Service - Write] Bun.write completed for ${STATE_FILE_PATH}.`);

        // Optional: Keep verification for extra safety, but locking is the main fix
        // await sleep(10);
        // console.log("[State Service - Write] Reading state back for verification...");
        // const readBackState = await _readStateFromFile(); // Reading *might* still be affected by caching if done too soon
        // const readBackTabCount = Object.keys(readBackState.projectTabs || {}).length;
        // if (readBackTabCount !== expectedTabCount) {
        //     console.error(`[State Service - Write] !!! VERIFICATION FAILED !!! ...`);
        // } else {
        //     console.log(`[State Service - Write] Verification successful.`);
        // }

        console.log(`[State Service - Write] Successfully wrote state (${writeType}). Final expected tabs count: ${expectedTabCount}`);
        return validatedData; // Return the data we intended to write

    } catch (error: any) {
        console.error(`[State Service - Write] Error during write operation ${operationName}:`, error);
        // Re-throw a standard error or ApiError if applicable
        if (error instanceof ApiError || error instanceof z.ZodError) throw error;
        throw new Error(`Failed during ${operationName}: ${error.message}`);
    } finally {
        releaseLock(operationName); // *** Ensure lock is always released ***
    }
}

// --- Public API ---

export async function getCurrentState(): Promise<GlobalState> {
    // Keep existing lock logic if necessary for read-modify-write safety elsewhere,
    // but basic read might not need a lock unless writes are very frequent/long.
    return await _readStateFromFile();
}

/**
 * @deprecated Use specific update functions like updateSettings, updateProjectTabs, etc. instead.
 */
export async function updateStateByKey<K extends keyof GlobalState>(
    key: K,
    value: GlobalState[K]
): Promise<GlobalState> {
    console.warn(`[State Service - API] Deprecated updateStateByKey called for key: ${key}. Use specific update functions.`);
    // Read happens *before* the lock is acquired for writing
    const currentState = await getCurrentState();
    const newState: GlobalState = {
        ...currentState,
        [key]: value,
    };
    // Write operation acquires the lock
    return await _writeStateToFile(newState);
}

export async function replaceState(newState: unknown): Promise<GlobalState> {
    console.log("[State Service - API] replaceState called");
    // Validation happens before lock
    const validation = globalStateSchema.safeParse(newState);
    if (!validation.success) {
        console.error("[State Service - API] Validation failed for replacing state (input object):", JSON.stringify(validation.error.flatten(), null, 2));
        throw new z.ZodError(validation.error.issues);
    }
    console.log("[State Service - API] replaceState: Input validation successful. Preparing to write.");
    // Write operation acquires the lock
    return await _writeStateToFile(validation.data);
}

// --- NEW Specific Update Functions ---

/**
 * Updates the application settings. Merges the provided partial settings with the current settings.
 */
export async function updateSettings(partialSettings: Partial<AppSettings>): Promise<GlobalState> {
    console.log("[State Service - API] updateSettings called");
    const currentState = await getCurrentState();
    // Validate the partial input against a partial schema for early failure detection (optional but good)
    const partialValidation = appSettingsSchema.partial().safeParse(partialSettings);
    if (!partialValidation.success) {
         console.error("[State Service - API] updateSettings: Invalid partial settings provided:", JSON.stringify(partialValidation.error.flatten(), null, 2));
         throw new z.ZodError(partialValidation.error.issues);
    }

    const newSettings = { ...currentState.settings, ...partialValidation.data }; // Merge validated partial data
    const newState = { ...currentState, settings: newSettings };
    console.log("[State Service - API] updateSettings: Merged settings, preparing to write.");
    return await _writeStateToFile(newState);
}


/**
 * Sets the active project tab ID.
 */
export async function setActiveProjectTab(tabId: string | null): Promise<GlobalState> {
    console.log(`[State Service - API] setActiveProjectTab called with ID: ${tabId}`);
    const currentState = await getCurrentState();
    // Basic validation: If tabId is not null, does it exist in projectTabs?
    if (tabId !== null && !currentState.projectTabs[tabId]) {
        console.warn(`[State Service - API] setActiveProjectTab: Attempted to set active tab to non-existent ID: ${tabId}. Setting anyway.`);
        // Depending on requirements, you might throw an error here:
        // throw new ApiError(404, `Project tab with ID ${tabId} not found.`, "NOT_FOUND");
    }
    const newState = { ...currentState, projectActiveTabId: tabId };
    console.log("[State Service - API] setActiveProjectTab: Updated active tab ID, preparing to write.");
    return await _writeStateToFile(newState);
}

/**
 * Sets the active chat ID.
 */
export async function setActiveChat(chatId: string | null): Promise<GlobalState> {
    console.log(`[State Service - API] setActiveChat called with ID: ${chatId}`);
    const currentState = await getCurrentState();
    // Basic validation (optional): If chatId is not null, check associated chat data if needed.
    // For now, just update the ID.
    const newState = { ...currentState, activeChatId: chatId };
    console.log("[State Service - API] setActiveChat: Updated active chat ID, preparing to write.");
    return await _writeStateToFile(newState);
}

/**
 * Creates a new project tab with default values merged with provided initial data.
 * Returns the ID of the newly created tab.
 */
export async function createProjectTab(initialData: Partial<ProjectTabState> & { projectId: string; displayName?: string }): Promise<{ newState: GlobalState, newTabId: string }> {
    console.log("[State Service - API] createProjectTab called with initial data:", initialData);
    const currentState = await getCurrentState();
    const newTabId = `project-tab-${uuidv4()}`;

    // Create default state and merge initial data carefully
    const defaultTabData = getDefaultProjectTabState(initialData.displayName ?? "New Tab"); // Use helper for defaults
    const newTabData: ProjectTabState = {
        ...defaultTabData,
        ...initialData, // Apply provided data (projectId is required by type)
        selectedProjectId: initialData.projectId // Ensure selectedProjectId matches required projectId
        // Sort order could be managed here if needed (e.g., append to end)
    };

     // Validate the newly constructed tab data
     const tabValidation = projectTabStateSchema.safeParse(newTabData);
     if (!tabValidation.success) {
          console.error("[State Service - API] createProjectTab: Validation failed for new tab data:", JSON.stringify(tabValidation.error.flatten(), null, 2));
          throw new z.ZodError(tabValidation.error.issues);
     }

    const newTabs = { ...currentState.projectTabs, [newTabId]: tabValidation.data };
    const newState = { ...currentState, projectTabs: newTabs };

    console.log(`[State Service - API] createProjectTab: Created tab ${newTabId}, preparing to write.`);
    const finalState = await _writeStateToFile(newState);
    return { newState: finalState, newTabId };
}


/**
 * Updates a specific project tab by merging partial data.
 */
export async function updateSingleProjectTab(tabId: string, partialTabData: Partial<ProjectTabState>): Promise<GlobalState> {
    console.log(`[State Service - API] updateSingleProjectTab called for tab ID: ${tabId}`);
    const currentState = await getCurrentState();

    if (!currentState.projectTabs[tabId]) {
        console.error(`[State Service - API] updateSingleProjectTab: Tab ID ${tabId} not found.`);
        throw new ApiError(404, `Project tab with ID ${tabId} not found.`, "NOT_FOUND");
    }

    // Validate partial input against partial schema
    const partialValidation = projectTabStateSchema.partial().safeParse(partialTabData);
     if (!partialValidation.success) {
         console.error("[State Service - API] updateSingleProjectTab: Invalid partial tab data provided:", JSON.stringify(partialValidation.error.flatten(), null, 2));
         throw new z.ZodError(partialValidation.error.issues);
     }

    const updatedTabData = { ...currentState.projectTabs[tabId], ...partialValidation.data };

    // Validate the merged tab data
    const tabValidation = projectTabStateSchema.safeParse(updatedTabData);
     if (!tabValidation.success) {
         console.error(`[State Service - API] updateSingleProjectTab: Validation failed for merged tab data (ID: ${tabId}):`, JSON.stringify(tabValidation.error.flatten(), null, 2));
         throw new z.ZodError(tabValidation.error.issues);
     }

    const newTabs = { ...currentState.projectTabs, [tabId]: tabValidation.data };
    const newState = { ...currentState, projectTabs: newTabs };

    console.log(`[State Service - API] updateSingleProjectTab: Updated tab ${tabId}, preparing to write.`);
    return await _writeStateToFile(newState);
}

/**
 * Deletes a specific project tab. If the deleted tab was active, selects the first remaining tab or null.
 */
export async function deleteProjectTab(tabIdToDelete: string): Promise<GlobalState> {
    console.log(`[State Service - API] deleteProjectTab called for tab ID: ${tabIdToDelete}`);
    const currentState = await getCurrentState();

    if (!currentState.projectTabs[tabIdToDelete]) {
        console.warn(`[State Service - API] deleteProjectTab: Tab ID ${tabIdToDelete} not found. No changes made.`);
        return currentState; // Or throw 404 if preferred
        // throw new ApiError(404, `Project tab with ID ${tabIdToDelete} not found.`, "NOT_FOUND");
    }

    const { [tabIdToDelete]: _, ...remainingTabs } = currentState.projectTabs;
    let newActiveTabId = currentState.projectActiveTabId;

    // If the deleted tab was the active one, find a new active tab
    if (currentState.projectActiveTabId === tabIdToDelete) {
        const remainingTabIds = Object.keys(remainingTabs);
        newActiveTabId = remainingTabIds.length > 0 ? remainingTabIds[0] : null; // Select first remaining or null
        console.log(`[State Service - API] deleteProjectTab: Deleted active tab ${tabIdToDelete}. New active tab: ${newActiveTabId}`);
    }

    const newState = {
        ...currentState,
        projectTabs: remainingTabs,
        projectActiveTabId: newActiveTabId,
    };

    console.log(`[State Service - API] deleteProjectTab: Deleted tab ${tabIdToDelete}, preparing to write.`);
    return await _writeStateToFile(newState);
}

/**
 * Merges/Upserts the provided project tabs record into the current state.
 * Existing tabs not included in the input `newTabs` record will be preserved.
 * If a tab ID exists in both current state and `newTabs`, it will be updated with the data from `newTabs`.
 * If a tab ID exists only in `newTabs`, it will be added.
 */
export async function updateProjectTabs(newTabs: ProjectTabsStateRecord): Promise<GlobalState> {
    console.log("[State Service - API] updateProjectTabs (merge/upsert) called");
    const currentState = await getCurrentState();

    // Validate the entire input record structure first
    const inputValidation = projectTabsStateRecordSchema.safeParse(newTabs);
    if (!inputValidation.success) {
        console.error("[State Service - API] updateProjectTabs: Invalid structure for incoming project tabs record:", JSON.stringify(inputValidation.error.flatten(), null, 2));
        throw new z.ZodError(inputValidation.error.issues);
    }
    const validatedInputTabs = inputValidation.data;

    // Merge: Start with current tabs, then update/add from validated input
    const mergedTabs: ProjectTabsStateRecord = { ...currentState.projectTabs };
    let validationErrors: z.ZodIssue[] = [];

    for (const tabId in validatedInputTabs) {
        // Validate each individual tab within the input before merging
        const singleTabValidation = projectTabStateSchema.safeParse(validatedInputTabs[tabId]);
        if (singleTabValidation.success) {
            mergedTabs[tabId] = singleTabValidation.data; // Add or overwrite with validated data
        } else {
            console.warn(`[State Service - API] updateProjectTabs: Skipping invalid tab data for ID ${tabId}:`, JSON.stringify(singleTabValidation.error.flatten(), null, 2));
            validationErrors = validationErrors.concat(singleTabValidation.error.issues);
            // Optionally: Add path information to errors if needed
        }
    }

    // If any individual tab validation failed, throw a consolidated error
    if (validationErrors.length > 0) {
        console.error("[State Service - API] updateProjectTabs: Validation failed for one or more individual tabs within the provided record.");
        throw new z.ZodError(validationErrors);
    }

    // Validate active tab ID against the final merged tabs
    let currentActiveId = currentState.projectActiveTabId;
    if (currentActiveId && !mergedTabs[currentActiveId]) {
        console.warn(`[State Service - API] updateProjectTabs: Current active tab ID ${currentActiveId} is no longer valid after merge/upsert. Resetting active tab.`);
        const mergedTabIds = Object.keys(mergedTabs);
        currentActiveId = mergedTabIds.length > 0 ? mergedTabIds[0] : null;
    }


    const newState = {
        ...currentState,
        projectTabs: mergedTabs, // Use the merged tabs
        projectActiveTabId: currentActiveId // Use potentially adjusted active ID
    };
    console.log("[State Service - API] updateProjectTabs: Merged project tabs, preparing to write.");
    return await _writeStateToFile(newState);
}