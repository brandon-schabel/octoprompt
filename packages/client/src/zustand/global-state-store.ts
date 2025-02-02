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
    APIProviders,
    AppSettings,
    ChatTabState,
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

type StoreState = SettingsSlice & ProjectTabsSlice & ChatTabsSlice & GlobalSlice
type StoreUpdater = (
    partial: StoreState | Partial<StoreState> | ((state: StoreState) => StoreState | Partial<StoreState>),
    replace?: boolean
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
                provider: undefined,
                linkSettings: undefined,
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
/** Type for store actions that manage chat tabs. */
interface ChatTabsSlice {
    chatTabs: Record<string, ChatTabState>
    chatActiveTabId: string | null

    createChatTab: (options?: {
        cleanTab?: boolean
        model?: string
        provider?: string
        title?: string
    }) => string

    deleteChatTab: (tabId: string) => void
    setActiveChatTab: (tabId: string) => void
    updateChatTab: (tabId: string, partial: Partial<ChatTabState>) => void
}

/**
 * Creates a Zustand slice for chat tabs.
 */
function createChatTabsSlice(
    set: StoreUpdater,
    get: () => StoreState
): ChatTabsSlice {
    return {
        chatTabs: createInitialGlobalState().chatTabs,
        chatActiveTabId: createInitialGlobalState().chatActiveTabId,

        createChatTab: (options) => {
            const newTabId = `chat-tab-${uuidv4()}`
            const state = get()
            const activeId = state.chatActiveTabId

            let sourceBase: ChatTabState | undefined
            if (activeId) {
                sourceBase = state.chatTabs[activeId]
            }

            const fallback: ChatTabState = {
                provider: defaultModelConfigs.provider as APIProviders,
                model: defaultModelConfigs.model,
                input: "",
                messages: [],
                excludedMessageIds: [],
                displayName: "New Chat Tab",
                activeChatId: undefined,
                linkedProjectTabId: null,
                linkSettings: undefined,
                ollamaUrl: undefined,
                lmStudioUrl: undefined,
                temperature: 0.7,
                max_tokens: 4000,
                top_p: 1,
                frequency_penalty: 0,
                presence_penalty: 0,
                stream: true,
                sortOrder: 0,
            }

            const sourceOrFallback = sourceBase ?? fallback

            const newTabData: ChatTabState = {
                ...sourceOrFallback,
                ...(options?.cleanTab
                    ? {
                        messages: [],
                        input: "",
                        excludedMessageIds: [],
                        linkSettings: undefined,
                        linkedProjectTabId: null,
                    }
                    : {}),
                displayName: options?.title
                    ? options.title
                    : `Chat ${Object.keys(state.chatTabs).length + 1}`,
                model: options?.model ?? sourceOrFallback.model,
                provider: (options?.provider ?? sourceOrFallback.provider) as ChatTabState["provider"],
            }

            set((state) => ({
                chatTabs: { ...state.chatTabs, [newTabId]: newTabData },
                chatActiveTabId: newTabId
            }))

            return newTabId
        },

        deleteChatTab: (tabId) => {
            set((state) => {
                const newTabs = { ...state.chatTabs }
                delete newTabs[tabId]
                const remainingTabs = Object.keys(newTabs)
                return {
                    chatTabs: newTabs,
                    chatActiveTabId: state.chatActiveTabId === tabId 
                        ? (remainingTabs.length > 0 ? remainingTabs[0] : null)
                        : state.chatActiveTabId
                }
            })
        },

        setActiveChatTab: (tabId) => {
            set((state) => ({ chatActiveTabId: tabId }))
        },

        updateChatTab: (tabId, partial) => {
            set((state) => {
                const current = state.chatTabs[tabId]
                if (!current) return {}
                return {
                    chatTabs: {
                        ...state.chatTabs,
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
                const merged = mergeDeep(
                    {
                        settings: state.settings,
                        projectTabs: state.projectTabs,
                        projectActiveTabId: state.projectActiveTabId,
                        chatTabs: state.chatTabs,
                        chatActiveTabId: state.chatActiveTabId,
                    },
                    incoming
                ) as GlobalState
                return merged
            })
        },

        mergePartialGlobalState: (incoming) => {
            set((state) => {
                const currentGlobal: GlobalState = {
                    settings: state.settings,
                    projectTabs: state.projectTabs,
                    projectActiveTabId: state.projectActiveTabId,
                    chatTabs: state.chatTabs,
                    chatActiveTabId: state.chatActiveTabId,
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
        ...createSettingsSlice(set as StoreUpdater, get),
        ...createProjectTabsSlice(set as StoreUpdater, get),
        ...createChatTabsSlice(set as StoreUpdater, get),
        ...createGlobalSlice(set as StoreUpdater, get),
    }))
)