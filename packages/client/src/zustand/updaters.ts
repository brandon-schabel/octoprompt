import { useGlobalStateStore } from "./global-state-store"
import { useActiveProjectTab } from "@/zustand/selectors" // Keep useActiveProjectTab if needed
import type {
    ProjectTabState,
    AppSettings,
} from "shared" // Adjusted imports
import { useGlobalStateContext } from "./global-state-provider"
import { buildTicketContent } from "@/components/tickets/utils/ticket-utils"
import { TicketWithTasks } from "@/hooks/api/use-tickets-api"
import { v4 as uuidv4 } from "uuid"
// --- Chat State Updaters ---
export function useSetActiveChat() {
    const setActiveChat = useGlobalStateStore((s) => s.setActiveChat)
    const { manager } = useGlobalStateContext()

    return (chatId: string) => {
        setActiveChat(chatId)
        manager.sendMessage({
            type: "set_active_chat",
            chatId,
        })
    }
}

export function useUpdateChatLinkSettings() {
    const updateChatLinkSettings = useGlobalStateStore((s) => s.updateChatLinkSettings)
    const { manager } = useGlobalStateContext()

    return (chatId: string, settings: any) => {
        updateChatLinkSettings(chatId, settings)
        manager.sendMessage({
            type: "update_chat_link_settings",
            chatId,
            settings,
        })
    }
}

export function useUnlinkProjectFromChat() {
    const unlinkProjectFromChat = useGlobalStateStore((s) => s.unlinkProjectFromChat)
    const { manager } = useGlobalStateContext()

    return (chatId: string) => {
        unlinkProjectFromChat(chatId)
        manager.sendMessage({
            type: "unlink_project_from_chat",
            chatId,
        })
    }
}

// --- Settings Updater ---
export function useUpdateSettings() {
    const setSettings = useGlobalStateStore((s) => s.setSettings)
    const settings = useGlobalStateStore((s) => s.settings)
    const { manager } = useGlobalStateContext()

    return (partialOrFn: PartialOrFn<AppSettings>) => {
        if (!settings) {
            console.warn("Settings not available for update yet.")
            return
        }
        const finalPartial = getPartial(settings, partialOrFn)
        setSettings(finalPartial)
        manager.sendMessage({
            type: "update_settings_partial",
            partial: finalPartial,
        })
    }
}

// Helper type and function (Keep)
export type PartialOrFn<T> = Partial<T> | ((prev: T) => Partial<T>)

function getPartial<T>(prev: T, partialOrFn: PartialOrFn<T>): Partial<T> {
    return typeof partialOrFn === "function" ? (partialOrFn as (prev: T) => Partial<T>)(prev) : partialOrFn // Type assertion added
}

// --- Project Tab Updaters (Keep if project tabs are used) ---

/**
 * Hook: update a specified project tab by partial or function
 */
export function useUpdateProjectTabState(projectTabId: string) {
    const updateTab = useUpdateProjectTab()
    const projectTab = useGlobalStateStore((s) => s.projectTabs?.[projectTabId]) // Added safe access

    return (partialOrFn: PartialOrFn<ProjectTabState>) => {
        if (!projectTab) {
            console.warn(`Project tab ${projectTabId} not found for update`)
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
        valueOrFn: ProjectTabState[K] | ((prevValue: ProjectTabState[K] | undefined) => ProjectTabState[K]) // Allow undefined prev value
    ) => {
        updateActiveProjectTab((prevState: ProjectTabState | undefined) => { // Allow undefined prev state
            if (!prevState) {
                console.warn("Cannot update key on non-existent active project tab");
                return {}; // Return empty partial if no previous state
            }
            const prevValue = prevState[key];
            const newValue = typeof valueOrFn === "function"
                ? (valueOrFn as (prevValue: ProjectTabState[K] | undefined) => ProjectTabState[K])(prevValue) // Pass potentially undefined prev value
                : valueOrFn
            return { [key]: newValue } as Partial<ProjectTabState> // Type assertion might be needed
        })
    }
}


/**
 * Hook: create a project tab from a ticket
 */
// Keep useCreateProjectTabFromTicket if needed, ensure it doesn't rely on removed chat state
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
   PROJECT TAB HOOKS (Keep if project tabs are used)
   -------------------------------------------------- */
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
        // Send WebSocket message - Ensure data matches ProjectTabState and doesn't include removed fields
        const initialTabData = useGlobalStateStore.getState().projectTabs?.[newTabId]; // Get initial state after creation
        if (initialTabData) {
            manager.sendMessage({
                type: "create_project_tab",
                tabId: newTabId,
                data: initialTabData, // Send the actual initial data
            })
        } else {
            console.error("Failed to get initial tab data after creation for WebSocket message");
        }
        return newTabId
    }
}

export function useSetActiveProjectTab() {
    const setActiveTab = useGlobalStateStore((s) => s.setActiveProjectTab)
    const { manager } = useGlobalStateContext()

    return (tabId: string) => {
        setActiveTab(tabId)
        manager.sendMessage({
            type: "set_active_project_tab",
            tabId,
        })
    }
}

export function useUpdateProjectTab() {
    const updateTab = useGlobalStateStore((s) => s.updateProjectTab)
    const { manager } = useGlobalStateContext()

    return (tabId: string, partial: Partial<ProjectTabState>) => {
        updateTab(tabId, partial)
        manager.sendMessage({
            type: "update_project_tab_partial",
            tabId,
            partial,
        })
    }
}

export function useDeleteProjectTab() {
    const deleteTab = useGlobalStateStore((s) => s.deleteProjectTab)
    const { manager } = useGlobalStateContext()

    return (tabId: string) => {
        deleteTab(tabId)
        manager.sendMessage({
            type: "delete_project_tab",
            tabId,
        })
    }
}

export function useUpdateActiveProjectTab() {
    const { id: activeProjectTabId } = useActiveProjectTab() // Removed tabData dependency here
    const updateTab = useUpdateProjectTab() // Use the specific update function

    return (partialOrFn: PartialOrFn<ProjectTabState>) => {
        if (!activeProjectTabId) {
            console.warn("No active project tab to update");
            return;
        }
        // Get the current state *inside* the updater function to ensure freshness
        const activeProjectTab = useGlobalStateStore.getState().projectTabs?.[activeProjectTabId];
        if (!activeProjectTab) {
            console.warn(`Active project tab (${activeProjectTabId}) data not found for update`);
            return;
        }
        const finalPartial = getPartial(activeProjectTab, partialOrFn)
        updateTab(activeProjectTabId, finalPartial) // updateTab already sends the WS message
    }
}

