import { useGlobalStateStore } from "./global-state-store"
import type {
    ProjectTabState,
    AppSettings,
} from "shared"

/**
 * Access the entire app settings
 */
export function useSettings(): AppSettings {
    return useGlobalStateStore((s) => s.settings)
}

/**
 * Return the currently active chat ID
 */
export function useActiveChat(): string | null {
    return useGlobalStateStore((s) => s.activeChatId)
}

/**
 * Return chat link settings for a specific chat ID
 */
export function useChatLinkSettings(chatId: string | null): {
    includeSelectedFiles?: boolean
    includePrompts?: boolean
    includeUserPrompt?: boolean
    linkedProjectTabId?: string | null
} | undefined {
    return useGlobalStateStore((s) => chatId ? s.chatLinkSettings[chatId] : undefined)
}

/**
 * Return all project tabs as an object keyed by tabId
 */
export function useAllProjectTabs(): Record<string, ProjectTabState> {
    return useGlobalStateStore((s) => s.projectTabs)
}

/**
 * Return the currently active project tab's ID + data
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

