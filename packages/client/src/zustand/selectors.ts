import { useGlobalStateStore } from "./global-state-store"
import type {
    ProjectTabState,
    ChatTabState,
    AppSettings,
} from "shared"

/**
 * Access the entire app settings
 */
export function useSettings(): AppSettings {
    return useGlobalStateStore((s) => s.settings)
}

/**
 * Return all project tabs as an object keyed by tabId
 */
export function useAllProjectTabs(): Record<string, ProjectTabState> {
    return useGlobalStateStore((s) => s.projectTabs)
}

/**
 * Return the currently active project tab’s ID + data
 */
export function useActiveProjectTab(): {
    id: string | null
    tabData: ProjectTabState | undefined
    selectedProjectId: string | null
} {
    const activeTabId = useGlobalStateStore((s) => s.projectActiveTabId)
    const projectTabs = useGlobalStateStore((s) => s.projectTabs)
    const tabData = activeTabId ? projectTabs[activeTabId] : undefined

    return {
        id: activeTabId,
        tabData,
        selectedProjectId: tabData?.selectedProjectId ?? ""
    }
}

/**
 * For a specific tab ID, return that ProjectTabState (or undefined if missing).
 */
export function useProjectTab(tabId: string | null): ProjectTabState | undefined {
    const projectTabs = useGlobalStateStore((s) => s.projectTabs)
    if (!tabId) return undefined
    return projectTabs[tabId]
}

/**
 * Return all chat tabs
 */
export function useAllChatTabs(): Record<string, ChatTabState> {
    return useGlobalStateStore((s) => s.chatTabs)
}

/**
 * Return the currently active chat tab ID + data
 */
export function useActiveChatTab(): {
    id: string | null
    tabData: ChatTabState | undefined
} {
    const activeChatTabId = useGlobalStateStore((s) => s.chatActiveTabId)
    const chatTabs = useGlobalStateStore((s) => s.chatTabs)
    const tabData = activeChatTabId ? chatTabs[activeChatTabId] : undefined
    return {
        id: activeChatTabId,
        tabData,
    }
}

/**
 * For a specific chat tab ID, return that ChatTabState
 */
export function useChatTabById(tabId: string | null): ChatTabState | undefined {
    const chatTabs = useGlobalStateStore((s) => s.chatTabs)
    if (!tabId) return undefined
    return chatTabs[tabId]
}