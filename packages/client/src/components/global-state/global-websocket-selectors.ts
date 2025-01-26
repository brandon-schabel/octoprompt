/* ============================================================================
 * use-global-selectors.ts
 *
 * Provides specialized "getter" hooks that read sub-state directly from
 * TanStack Query, allowing you to avoid always using the full `useGlobalState`.
 * ============================================================================
 */
import { useQueryClient } from "@tanstack/react-query"
import { useMemo } from "react"
import {
    ProjectTabState,
    ChatTabState
} from "shared"
import { useGlobalState } from "./use-global-state"
import { AppSettings } from "shared/src/global-state/global-state-schema"

/**
 * 1) Return just the `settings` object (theme, chatTabIdOrder, etc.)
 */
export function useSettings(): AppSettings | undefined {
    const { data: globalState } = useGlobalState()
    return globalState?.settings
}

/**
 * 2) Return the entire map/dictionary of project tabs. 
 *    Each tab is also stored individually at queryKey = ["globalState", "projectTab", <tabId>].
 *    This hook aggregates them from the top-level globalState for convenience.
 */
export function useAllProjectTabs(): Record<string, ProjectTabState> {
    const { data: globalState } = useGlobalState()
    return globalState?.projectTabs ?? {}
}

/**
 * 3) Return the "active" (currently selected) project tab, if any.
 *    We read the active ID from the top-level `globalState`,
 *    then read the details from the query cache for that tab.
 */
export function useActiveProjectTab() {
    const queryClient = useQueryClient()
    const { data: globalState } = useGlobalState()

    // The ID of whichever project tab is “active”:
    const activeTabId = globalState?.projectActiveTabId

    // If no active tab, just return empty
    const tabData = useMemo(() => {
        if (!activeTabId) return null
        // Each tab is stored at ["globalState", "projectTab", <tabId>]
        return queryClient.getQueryData<ProjectTabState>([
            "globalState",
            "projectTab",
            activeTabId
        ]) ?? null
    }, [queryClient, activeTabId])

    return {
        id: activeTabId,
        tabData
    }
}

/**
 * 4) Return a specific project tab by ID, if you know which you want.
 *    This reads the sub-key directly from the query cache.
 */
export function useProjectTab(tabId: string | null) {
    const queryClient = useQueryClient()

    // Safely look up the sub-key. If tabId is null or empty, return null
    const tabData = useMemo(() => {
        if (!tabId) return null
        return queryClient.getQueryData<ProjectTabState>([
            "globalState",
            "projectTab",
            tabId
        ]) ?? null
    }, [queryClient, tabId])

    return tabData
}

/**
 * 5) Return the entire map/dictionary of chat tabs.
 */
export function useAllChatTabs(): Record<string, ChatTabState> {
    const { data: globalState } = useGlobalState()
    return globalState?.chatTabs ?? {}
}

/**
 * 6) Return whichever chat tab is currently "active."
 */
export function useActiveChatTab() {
    const queryClient = useQueryClient()
    const { data: globalState } = useGlobalState()

    const activeChatTabId = globalState?.chatActiveTabId
    const tabData = useMemo(() => {
        if (!activeChatTabId) return null
        return queryClient.getQueryData<ChatTabState>([
            "globalState",
            "chatTab",
            activeChatTabId
        ]) ?? null
    }, [queryClient, activeChatTabId])

    return {
        id: activeChatTabId,
        tabData
    }
}

/**
 * 7) Return one specific chat tab by ID.
 */
export function useChatTabById(tabId: string | null) {
    const queryClient = useQueryClient()
    const chatTab = useMemo(() => {
        if (!tabId) return null
        return queryClient.getQueryData<ChatTabState>([
            "globalState",
            "chatTab",
            tabId
        ]) ?? null
    }, [queryClient, tabId])
    return chatTab
}

/**
 * 8) If you need other sub-state items (like `state.settings.theme`, 
 *    or `state.linkSettings`, etc.), just replicate the above pattern. 
 *    For example:
 */
export function useTheme() {
    const settings = useSettings()
    return settings?.theme ?? "light"
}


export function useProjectTabs(): Record<string, ProjectTabState> {
    const { data: globalState } = useGlobalState()
    const queryClient = useQueryClient()

    return useMemo(() => {
        if (!globalState?.projectTabs) return {}

        const result: Record<string, ProjectTabState> = {}
        for (const tabId of Object.keys(globalState.projectTabs)) {
            // Attempt to read sub‐query for that tab
            const subData = queryClient.getQueryData<ProjectTabState>([
                "globalState",
                "projectTab",
                tabId,
            ])
            // Fall back to top‐level if the subData doesn’t exist
            result[tabId] = subData ?? globalState.projectTabs[tabId]
        }
        return result
    }, [globalState, queryClient])
}

/**
 *  UseChatTabs: returns a dictionary of all chat tabs,
 *  pulling each from its sub‐query if available.
 */
export function useChatTabs(): Record<string, ChatTabState> {
    const { data: globalState } = useGlobalState()
    const queryClient = useQueryClient()

    return useMemo(() => {
        if (!globalState?.chatTabs) return {}

        const result: Record<string, ChatTabState> = {}
        for (const tabId of Object.keys(globalState.chatTabs)) {
            // Attempt to read sub‐query for that chat tab
            const subData = queryClient.getQueryData<ChatTabState>([
                "globalState",
                "chatTab",
                tabId,
            ])
            // Fall back to top‐level if the subData doesn’t exist
            result[tabId] = subData ?? globalState.chatTabs[tabId]
        }
        return result
    }, [globalState, queryClient])
}