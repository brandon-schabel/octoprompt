import { useGlobalStateStore } from "./global-state-store"
import { v4 as uuidv4 } from "uuid"
import { useActiveChatTab, useActiveProjectTab } from "@/zustand/selectors"
import { buildTicketContent } from "@/components/tickets/utils/ticket-utils"
import type { TicketWithTasks } from "@/hooks/api/use-tickets-api"
import type {
    ProjectTabState,
    ChatTabState,
    AppSettings,
    LinkSettings,
} from "shared"
import { linkSettingsSchema } from "shared"
import { useGlobalStateContext } from "./global-state-provider"
import { DEFAULT_MODEL_CONFIGS } from "shared"

const defaultModelConfigs = DEFAULT_MODEL_CONFIGS['default']

/**
 * Hook: update settings
 */
export function useUpdateSettings() {
    const setSettings = useGlobalStateStore((s) => s.setSettings)
    const settings = useGlobalStateStore((s) => s.settings)
    const { manager } = useGlobalStateContext()

    return (partialOrFn: PartialOrFn<AppSettings>) => {
        if (!settings) return
        const finalPartial = getPartial(settings, partialOrFn)
        setSettings(finalPartial)
        // Send WebSocket message
        manager.sendMessage({
            type: "update_settings_partial",
            partial: finalPartial,
        })
    }
}

/**
 * Helper for partial updates of state.
 */
export type PartialOrFn<T> = Partial<T> | ((prev: T) => Partial<T>)

function getPartial<T>(prev: T, partialOrFn: PartialOrFn<T>): Partial<T> {
    return typeof partialOrFn === "function" ? partialOrFn(prev) : partialOrFn
}

/**
 * Hook: update a specified project tab by partial or function
 */
export function useUpdateProjectTabState(projectTabId: string) {
    const updateTab = useUpdateProjectTab()
    const projectTab = useGlobalStateStore((s) => s.projectTabs[projectTabId])

    return (partialOrFn: PartialOrFn<ProjectTabState>) => {
        if (!projectTab) {
            console.warn(`Project tab ${projectTabId} not found`)
            return
        }
        const finalPartial = getPartial(projectTab, partialOrFn)
        updateTab(projectTabId, finalPartial)
    }
}

/**
 * Hook: update a single key on the active project tab
 */
export function useUpdateActiveProjectTabStateKey() {
    const updateActiveProjectTab = useUpdateActiveProjectTab()

    return <K extends keyof ProjectTabState>(
        key: K,
        valueOrFn: ProjectTabState[K] | ((prev: ProjectTabState[K]) => ProjectTabState[K])
    ) => {
        updateActiveProjectTab((prevState: ProjectTabState) => {
            const newValue = typeof valueOrFn === "function"
                ? (valueOrFn as (prev: ProjectTabState[K]) => ProjectTabState[K])(prevState[key])
                : valueOrFn
            return { [key]: newValue } as Partial<ProjectTabState>
        })
    }
}

/**
 * Hook: create a project tab from a ticket
 */
export function useCreateProjectTabFromTicket() {
    const { tabData: activeProjectTab } = useActiveProjectTab()
    const createProjectTab = useGlobalStateStore((s) => s.createProjectTab)
    const setActiveProjectTab = useSetActiveProjectTab()
    const updateProjectTab = useUpdateProjectTab()

    return (ticket: TicketWithTasks, customTabId?: string) => {
        if (!activeProjectTab) return

        const tabId = customTabId ?? `ticket-tab-${uuidv4()}`
        const userPrompt = buildTicketContent(ticket)
        const suggestedFileIds = JSON.parse(ticket.suggestedFileIds || "[]")

        const newTabData: ProjectTabState = {
            ...activeProjectTab,
            selectedProjectId: ticket.projectId,
            selectedFiles: suggestedFileIds,
            suggestedFileIds,
            userPrompt,
            displayName: ticket.title || "Ticket Tab",
            editProjectId: null,
            promptDialogOpen: false,
            editPromptId: null,
            fileSearch: "",
            ticketSearch: "",
            ticketId: ticket.id,
            sortOrder: 0,
        }

        createProjectTab({
            projectId: ticket.projectId,
            userPrompt,
            selectedFiles: suggestedFileIds,
            displayName: ticket.title || "Ticket Tab",
        })

        // After creating, update with full tab data
        updateProjectTab(tabId, newTabData)
        setActiveProjectTab(tabId)
    }
}

/* --------------------------------------------------
   PROJECT TAB HOOKS
   -------------------------------------------------- */

/**
 * Hook: create a project tab
 */
export function useCreateProjectTab() {
    const createProjectTab = useGlobalStateStore((s) => s.createProjectTab)
    const { manager } = useGlobalStateContext()

    return (opts: {
        projectId: string
        userPrompt?: string
        selectedFiles?: string[]
        displayName?: string
    }) => {
        const newTabId = createProjectTab(opts)
        // Send WebSocket message
        manager.sendMessage({
            type: "create_project_tab",
            tabId: newTabId,
            data: {
                selectedProjectId: opts.projectId,
                editProjectId: null,
                promptDialogOpen: false,
                editPromptId: null,
                fileSearch: "",
                selectedFiles: opts.selectedFiles || [],
                selectedPrompts: [],
                userPrompt: opts.userPrompt || "",
                searchByContent: false,
                displayName: opts.displayName || "New Project Tab",
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
            },
        })
        return newTabId
    }
}

/**
 * Hook: set active project tab
 */
export function useSetActiveProjectTab() {
    const setActiveTab = useGlobalStateStore((s) => s.setActiveProjectTab)
    const { manager } = useGlobalStateContext()

    return (tabId: string) => {
        setActiveTab(tabId)
        // Send WebSocket message
        manager.sendMessage({
            type: "set_active_project_tab",
            tabId,
        })
    }
}

/**
 * Hook: update project tab
 */
export function useUpdateProjectTab() {
    const updateTab = useGlobalStateStore((s) => s.updateProjectTab)
    const { manager } = useGlobalStateContext()

    return (tabId: string, partial: Partial<ProjectTabState>) => {
        updateTab(tabId, partial)
        // Send WebSocket message
        manager.sendMessage({
            type: "update_project_tab_partial",
            tabId,
            partial,
        })
    }
}

/**
 * Hook: delete project tab
 */
export function useDeleteProjectTab() {
    const deleteTab = useGlobalStateStore((s) => s.deleteProjectTab)
    const { manager } = useGlobalStateContext()

    return (tabId: string) => {
        deleteTab(tabId)
        // Send WebSocket message
        manager.sendMessage({
            type: "delete_project_tab",
            tabId,
        })
    }
}

/**
 * Hook: update the currently active project tab
 */
export function useUpdateActiveProjectTab() {
    const { id: activeProjectTabId, tabData: activeProjectTab } = useActiveProjectTab()
    const updateTab = useUpdateProjectTab()

    return (partialOrFn: PartialOrFn<ProjectTabState>) => {
        if (!activeProjectTabId || !activeProjectTab) return
        const finalPartial = getPartial(activeProjectTab, partialOrFn)
        updateTab(activeProjectTabId, finalPartial)
    }
}

/* --------------------------------------------------
   CHAT TAB HOOKS
   -------------------------------------------------- */

/**
 * Hook: create chat tab
 */
export function useCreateChatTab() {
    const createChatTab = useGlobalStateStore((s) => s.createChatTab)
    const { manager } = useGlobalStateContext()

    return (options?: { cleanTab?: boolean; model?: string; provider?: string; title?: string }) => {
        const newTabId = createChatTab(options)
        // Send WebSocket message
        manager.sendMessage({
            type: "create_chat_tab",
            tabId: newTabId,
            data: {
                provider: (options?.provider || defaultModelConfigs.provider) as ChatTabState["provider"],
                model: options?.model || defaultModelConfigs.model,
                input: "",
                messages: [],
                excludedMessageIds: [],
                displayName: options?.title || "New Chat",
                activeChatId: undefined,
                linkedProjectTabId: null,
                linkSettings: undefined,
                ollamaUrl: undefined,
                lmStudioUrl: undefined,
                temperature: defaultModelConfigs.temperature,
                max_tokens: 4000,
                top_p: 1,
                frequency_penalty: 0,
                presence_penalty: 0,
                stream: true,
                sortOrder: 0,
            },
        })
        return newTabId
    }
}

/**
 * Hook: set active chat tab
 */
export function useSetActiveChatTab() {
    const setActiveChatTab = useGlobalStateStore((s) => s.setActiveChatTab)
    const { manager } = useGlobalStateContext()

    return (tabId: string) => {
        setActiveChatTab(tabId)
        // Send WebSocket message
        manager.sendMessage({
            type: "set_active_chat_tab",
            tabId,
        })
    }
}

/**
 * Hook: update chat tab
 */
export function useUpdateChatTab() {
    const updateChatTab = useGlobalStateStore((s) => s.updateChatTab)
    const { manager } = useGlobalStateContext()

    return (tabId: string, partial: Partial<ChatTabState>) => {
        updateChatTab(tabId, partial)
        // Send WebSocket message
        manager.sendMessage({
            type: "update_chat_tab_partial",
            tabId,
            partial,
        })
    }
}

/**
 * Hook: delete chat tab
 */
export function useDeleteChatTab() {
    const deleteChatTab = useGlobalStateStore((s) => s.deleteChatTab)
    const { manager } = useGlobalStateContext()

    return (tabId: string) => {
        deleteChatTab(tabId)
        // Send WebSocket message
        manager.sendMessage({
            type: "delete_chat_tab",
            tabId,
        })
    }
}

/**
 * Hook: update the currently active chat tab
 */
export function useUpdateActiveChatTab() {
    const { id: activeChatTabId, tabData: activeChatTab } = useActiveChatTab()
    const { manager } = useGlobalStateContext()
    const updateChatTab = useUpdateChatTab()

    return (partialOrFn: PartialOrFn<ChatTabState>) => {
        if (!activeChatTabId || !activeChatTab) {
            console.error("[useUpdateActiveChatTab] No active chat tab to update!", { activeChatTabId, activeChatTab });
            return;
        }
        const finalPartial = getPartial(activeChatTab, partialOrFn)
        console.log("[useUpdateActiveChatTab] Updating chat tab:", { activeChatTabId, finalPartial });
        updateChatTab(activeChatTabId, finalPartial)
        // Send WebSocket message
        manager.sendMessage({
            type: "update_chat_tab_partial",
            tabId: activeChatTabId,
            partial: finalPartial,
        })
    }
}

/* --------------------------------------------------
   LINKING HOOKS
   -------------------------------------------------- */

export function useLinkChatTabToProjectTab() {
    const updateChatTab = useUpdateChatTab()
    const { manager } = useGlobalStateContext()

    return (chatTabId: string, projectTabId: string, settings?: Partial<LinkSettings>) => {
        const linkSettings = {
            includeSelectedFiles: true,
            includePrompts: true,
            includeUserPrompt: true,
            ...settings,
        }
        updateChatTab(chatTabId, {
            linkedProjectTabId: projectTabId,
            linkSettings,
        })
        // Send WebSocket message
        manager.sendMessage({
            type: "update_chat_tab_partial",
            tabId: chatTabId,
            partial: {
                linkedProjectTabId: projectTabId,
                linkSettings,
            },
        })
    }
}

export function useUnlinkChatTab() {
    const updateChatTab = useUpdateChatTab()
    const { manager } = useGlobalStateContext()

    return (chatTabId: string) => {
        updateChatTab(chatTabId, {
            linkedProjectTabId: null,
            linkSettings: undefined,
        })
        // Send WebSocket message
        manager.sendMessage({
            type: "update_chat_tab_partial",
            tabId: chatTabId,
            partial: {
                linkedProjectTabId: null,
                linkSettings: undefined,
            },
        })
    }
}

export function useUpdateChatLinkSettings() {
    const updateChatTab = useUpdateChatTab()
    const { manager } = useGlobalStateContext()

    return (chatTabId: string, partialSettings: Partial<LinkSettings>, currentSettings?: LinkSettings) => {
        const merged = { ...(currentSettings ?? {}), ...partialSettings }
        linkSettingsSchema.parse(merged) // validate
        const linkSettings = {
            includePrompts: merged.includePrompts ?? true,
            includeSelectedFiles: merged.includeSelectedFiles ?? true,
            includeUserPrompt: merged.includeUserPrompt ?? true,
        }
        updateChatTab(chatTabId, { linkSettings })
        // Send WebSocket message
        manager.sendMessage({
            type: "update_chat_tab_partial",
            tabId: chatTabId,
            partial: { linkSettings },
        })
    }
}