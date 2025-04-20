// packages/client/src/global-state-store/global-state-store.ts

import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { DEFAULT_MODEL_CONFIGS, mergeDeep } from "shared"
import { v4 as uuidv4 } from "uuid"

// ---------------------------------------------------
// Import your shared Zod schemas and types
// ---------------------------------------------------
import {
    createInitialGlobalState,
} from "shared"

import type {
    AppSettings,
    GlobalState,
    ProjectTabState,
} from "shared"


const defaultModelConfigs = DEFAULT_MODEL_CONFIGS['default']    

// ---------------------------------------------------
// Define slices
// ---------------------------------------------------

/** Type for store actions that update global settings. */
interface SettingsSlice {
    settings: AppSettings
    setSettings: (partial: Partial<AppSettings>) => void
}

type StoreState = SettingsSlice & ProjectTabsSlice & GlobalSlice
type StoreUpdater = (
    partial: StoreState | Partial<StoreState> | ((state: StoreState) => StoreState | Partial<StoreState>),
    replace?: false | undefined
) => void

/**
 * Creates a Zustand slice to manage all "settings" state
 */
function createSettingsSlice(
    set: StoreUpdater,
    get: () => StoreState
): SettingsSlice {
    return {
        settings: createInitialGlobalState().settings,
        setSettings: (partial) => 
            set((state) => ({ settings: { ...state.settings, ...partial } })),
    }
}

// ---------------------------------------------------
/** Type for store actions that manage project tabs. */
interface ProjectTabsSlice {
    projectTabs: Record<string, ProjectTabState>
    projectActiveTabId: string | null

    createProjectTab: (options: {
        projectId: string
        userPrompt?: string
        selectedFiles?: string[]
        displayName?: string
    }) => string

    deleteProjectTab: (tabId: string) => void
    setActiveProjectTab: (tabId: string) => void
    updateProjectTab: (tabId: string, partial: Partial<ProjectTabState>) => void
}

/**
 * Creates a Zustand slice for project tabs.
 */
function createProjectTabsSlice(
    set: StoreUpdater,
    get: () => StoreState
): ProjectTabsSlice {
    return {
        projectTabs: createInitialGlobalState().projectTabs,
        projectActiveTabId: createInitialGlobalState().projectActiveTabId,

        createProjectTab: ({
            projectId,
            userPrompt = "",
            selectedFiles = [],
            displayName = "New Project Tab",
        }) => {
            const newTabId = `project-tab-${uuidv4()}`
            const newTabData: ProjectTabState = {
                selectedProjectId: projectId,
                editProjectId: null,
                promptDialogOpen: false,
                editPromptId: null,
                fileSearch: "",
                selectedFiles,
                selectedPrompts: [],
                userPrompt,
                searchByContent: false,
                displayName,
                contextLimit: 128000,
                resolveImports: false,
                preferredEditor: "cursor",
                suggestedFileIds: [],
                bookmarkedFileGroups: {},
                ticketSearch: "",
                ticketSort: "created_desc",
                ticketStatusFilter: "all",
                ticketId: null,
                sortOrder: 0,
            }
            set((state) => ({
                projectTabs: { ...state.projectTabs, [newTabId]: newTabData },
                projectActiveTabId: newTabId
            }))
            return newTabId
        },

        deleteProjectTab: (tabId) => {
            set((state) => {
                const newTabs = { ...state.projectTabs }
                delete newTabs[tabId]
                const remainingTabs = Object.keys(newTabs)
                return {
                    projectTabs: newTabs,
                    projectActiveTabId: state.projectActiveTabId === tabId 
                        ? (remainingTabs.length > 0 ? remainingTabs[0] : null)
                        : state.projectActiveTabId
                }
            })
        },

        setActiveProjectTab: (tabId) => {
            set((state) => ({ projectActiveTabId: tabId }))
        },

        updateProjectTab: (tabId, partial) => {
            set((state) => {
                const current = state.projectTabs[tabId]
                if (!current) return {}
                return {
                    projectTabs: {
                        ...state.projectTabs,
                        [tabId]: { ...current, ...partial }
                    }
                }
            })
        },
    }
}

// ---------------------------------------------------
/** Type for "global" store keys not covered by slices above. */
interface GlobalSlice {
    // Example: a full copy of the global state to do merges, if you prefer
    mergeFullGlobalState: (incoming: GlobalState) => void
    mergePartialGlobalState: (incoming: Partial<GlobalState>) => void
}

/**
 * Creates a slice for handling any large-scale merges or top-level fields
 */
function createGlobalSlice(
    set: StoreUpdater,
    get: () => StoreState
): GlobalSlice {
    return {
        mergeFullGlobalState: (incoming) => {
            set((state) => {
                const currentState: GlobalState = {
                    settings: state.settings,
                    projectTabs: state.projectTabs,
                    projectActiveTabId: state.projectActiveTabId,
                }
                const merged = mergeDeep(currentState, incoming) as GlobalState
                return merged
            })
        },

        mergePartialGlobalState: (incoming) => {
            set((state) => {
                const currentGlobal: GlobalState = {
                    settings: state.settings,
                    projectTabs: state.projectTabs,
                    projectActiveTabId: state.projectActiveTabId,
                }
                return mergeDeep(currentGlobal, incoming) as GlobalState
            })
        },
    }
}

// ---------------------------------------------------
// Combine all slices into one store
// ---------------------------------------------------
export const useGlobalStateStore = create<StoreState>()(
    devtools((set, get) => ({
        ...createSettingsSlice(set, get),
        ...createProjectTabsSlice(set, get),
        ...createGlobalSlice(set, get),
    }))
)