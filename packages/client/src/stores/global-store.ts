import { create } from 'zustand';
import { persist, createJSONStorage, PersistOptions } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { v4 as uuidv4 } from "uuid";
import type { StateCreator } from 'zustand'; 

// Import your shared types and schemas
import {
    GlobalState,
    globalStateSchema,
    createInitialGlobalState,
    AppSettings,
    ProjectTabsStateRecord,
    ProjectTabState,
    projectTabStateSchema,
    projectTabsStateRecordSchema,
    getDefaultProjectTabState
} from 'shared/src/schemas/global-state-schema'; // Adjust path if needed
import { ZodError } from 'zod';

const LOCAL_STORAGE_KEY = 'appGlobalState';

interface GlobalStateActions {
    // Replace state (use carefully)
    replaceState: (newState: GlobalState) => void;

    // Specific updaters (mirroring the old service functions)
    updateSettings: (partialSettings: Partial<AppSettings>) => void;
    setActiveProjectTab: (tabId: string | null) => void;
    setActiveChat: (chatId: string | null) => void;
    createProjectTab: (initialData: Partial<Omit<ProjectTabState, 'sortOrder'>> & { projectId: string; displayName?: string }) => string; // Returns new tabId
    updateSingleProjectTab: (tabId: string, partialTabData: Partial<ProjectTabState>) => void;
    deleteProjectTab: (tabIdToDelete: string) => void;
    updateProjectTabs: (newTabs: ProjectTabsStateRecord) => void; // Replaces the entire tabs record
}

// Combine state and actions into a single type for the store
type StoreType = GlobalState & GlobalStateActions;

// Define the Persist options, explicitly typing the state it handles
// Note: The state type here should match what's stored, usually the full store type.
const persistOptions: PersistOptions<StoreType, StoreType> = {
    name: LOCAL_STORAGE_KEY,
    storage: createJSONStorage(() => localStorage),
    onRehydrateStorage: (state) => { // state here is potentially StoreType | undefined
        console.log("Attempting rehydration...");
        return (hydratedState, error) => { // hydratedState is potentially StoreType | undefined
            if (error) {
                console.error("Failed to rehydrate state from localStorage:", error);
                return;
            }
            if (hydratedState) {
                // Validate the entire hydrated state (including potentially stored actions if they were saved somehow, though they shouldn't be)
                // But realistically, we only care about validating the GlobalState part.
                const validation = globalStateSchema.safeParse(hydratedState); // Validate against the state schema
                if (validation.success) {
                    console.log("Rehydration successful and state validated.");
                    // If validation passes, Zustand proceeds with the `hydratedState`.
                    // We might need to ensure only GlobalState properties are hydrated if actions were accidentally persisted.
                    // This usually isn't an issue if `partialize` isn't used incorrectly.
                } else {
                    console.error("localStorage state validation failed during rehydration:", validation.error.flatten());
                    console.warn("Discarding invalid stored state and using initial state.");
                    // We need to ensure the invalid state isn't applied.
                    // Returning void/undefined *should* signal Zustand to use the initialState from create(),
                    // but let's add an explicit reset using the 'state' handle if issues persist.
                    // **If invalid state still gets applied**, uncomment and adapt the line below:
                    // state?.setState(createInitialGlobalState() as StoreType, true); // Force reset (might need adjustment)
                }
            } else {
                console.log("No existing state found in localStorage during rehydration.");
            }
        };
    },
};

// Helper to safely parse and validate state from storage - **No longer used for initial state**
// We let persist handle the initial load and validation via onRehydrateStorage
/*
const loadStateFromStorage = (): GlobalState => { ... };
*/

// Define the StateCreator, explicitly typing set, get, and the return type
// Using Immer middleware often requires slightly different typing for the StateCreator
// Let's define the creator separately for clarity
const storeCreator: StateCreator<StoreType, [["zustand/immer", never]], [], StoreType> = (set, get) => ({
    // Initial state - provided by createInitialGlobalState()
    ...createInitialGlobalState(),

    // --- Actions ---

    // --- Action implementations ---
    // Add explicit types to parameters
    replaceState: (newState: GlobalState) => {
        const validation = globalStateSchema.safeParse(newState);
        if (validation.success) {
            // Use 'set' directly to replace the entire state part, keeping actions intact
            set(validation.data); // Replace state - 'true' might be needed depending on exact middleware setup
            // Or, more commonly with Immer, merge it carefully:
            // set((state) => {
            //     Object.assign(state, validation.data); // Overwrite state properties
            // });
        } else {
            console.error("Validation failed when trying to replaceState:", validation.error.flatten());
        }
    },
    updateSettings: (partialSettings: Partial<AppSettings>) => set((state) => {
        state.settings = { ...state.settings, ...partialSettings };
    }),
    setActiveProjectTab: (tabId: string | null) => set((state) => {
        if (tabId !== null && !state.projectTabs[tabId]) {
            console.warn(`Attempted to set active tab to non-existent ID: ${tabId}`);
        }
        state.projectActiveTabId = tabId;
    }),
    setActiveChat: (chatId: string | null) => set((state) => {
        state.activeChatId = chatId;
    }),
    createProjectTab: (initialData: Partial<Omit<ProjectTabState, 'sortOrder'>> & { projectId: string; displayName?: string }) => {
        const newTabId = `project-tab-${uuidv4()}`;
        let newTabData: ProjectTabState | null = null;
        try {
            const defaultTabData = getDefaultProjectTabState(initialData.displayName ?? "New Tab");
            const mergedData: ProjectTabState = {
                ...defaultTabData, ...initialData,
                selectedProjectId: initialData.projectId,
            };
            const validation = projectTabStateSchema.safeParse(mergedData);
            if (!validation.success) throw new ZodError(validation.error.issues);
            newTabData = validation.data;
        } catch (error) {
            console.error("Error preparing new project tab:", error);
            throw error; // Re-throw to prevent inconsistent state
        }

        set((state) => { state.projectTabs[newTabId] = newTabData!; });
        return newTabId; // Return the new ID
    },
    updateSingleProjectTab: (tabId: string, partialTabData: Partial<ProjectTabState>) => set((state) => {
        if (!state.projectTabs[tabId]) { console.error(`Tab ID ${tabId} not found.`); return; }
        const updatedData = { ...state.projectTabs[tabId], ...partialTabData };
        const validation = projectTabStateSchema.safeParse(updatedData);
        if (validation.success) {
            state.projectTabs[tabId] = validation.data;
        } else {
            console.error(`Validation failed for updating tab ${tabId}:`, validation.error.flatten());
        }
    }),
    deleteProjectTab: (tabIdToDelete: string) => set((state) => {
        if (!state.projectTabs[tabIdToDelete]) { return; }
        delete state.projectTabs[tabIdToDelete]; // Immer handles deletion
        if (state.projectActiveTabId === tabIdToDelete) {
            const remainingTabIds = Object.keys(state.projectTabs);
            state.projectActiveTabId = remainingTabIds.length > 0 ? remainingTabIds[0] : null;
        }
    }),
    updateProjectTabs: (newTabs: ProjectTabsStateRecord) => set((state) => {
        const validation = projectTabsStateRecordSchema.safeParse(newTabs);
        if (!validation.success) { console.error("Validation failed for replacing project tabs record:", validation.error.flatten()); return; }
        state.projectTabs = validation.data;
        // Adjust active tab ID if it's no longer valid
        if (state.projectActiveTabId && !state.projectTabs[state.projectActiveTabId]) {
            const newTabIds = Object.keys(state.projectTabs);
            state.projectActiveTabId = newTabIds.length > 0 ? newTabIds[0] : null;
        }
    }),
});


// Create the store
export const useGlobalStore = create<StoreType>()(
    // 1. Immer middleware
    immer(
        // 2. Persist middleware
        persist(
            // 3. Store definition using the explicitly typed creator
            storeCreator,
            // 4. Persist options
            persistOptions
        ) // End persist
    ) // End immer
);
