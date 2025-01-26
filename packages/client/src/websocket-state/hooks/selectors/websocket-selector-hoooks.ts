/**
 * =============================================================================
 * HOW TO FIX THE “UI NOT REFRESHING” PROBLEM
 * =============================================================================
 *
 * **Root Cause**:
 * - React Query’s `queryClient.getQueryData(...)` is just an imperative “get” call;
 *   it does not automatically subscribe your component to state changes.
 * - The `useMemo` call that wraps `getQueryData` will only recompute if the
 *   `queryClient` object or `activeTabId` changes—**not** if the underlying data
 *   changes in the Query Cache.
 *
 * In other words, simply doing:
 *
 * ```ts
 * const data = useMemo(() => {
 *   return queryClient.getQueryData(["someKey"]) ?? null
 * }, [queryClient, someKey])
 * ```
 *
 * will not trigger a re-render if the Query Cache is updated from the server.
 *
 * **Proper Fix**:
 * - Replace those manual `queryClient.getQueryData(...)` calls with `useQuery(...)`
 *   so that React Query automatically re-renders when the cached data changes.
 * - Alternatively, you can store & update everything in the top-level `globalState`
 *   object and simply read from `useGlobalState()`, letting that single query handle
 *   all sub-state changes. But if you want each “tab” in its own sub-query for
 *   performance or organization reasons, you must subscribe to them with `useQuery`.
 *
 * Below is **one** possible revised approach for your selectors, using `useQuery`.
 *
 * =============================================================================
 * Example “global-websocket-selectors.ts” with `useQuery`
 * =============================================================================
 */

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo } from "react"
import {
    ProjectTabState,
    ChatTabState,
} from "shared"
import { useGlobalState } from "./use-global-state"

// ------------------------------------------------------------------
// 1) Return just the top-level `settings`
// ------------------------------------------------------------------
export function useSettings() {
    const { data: globalState } = useGlobalState()
    return globalState?.settings
}

// ------------------------------------------------------------------
// 2) Return the entire map/dictionary of project tabs
//    (from top-level globalState) or get from sub-queries
// ------------------------------------------------------------------
export function useAllProjectTabs(): Record<string, ProjectTabState> {
    const { data: globalState } = useGlobalState()
    return globalState?.projectTabs ?? {}
}

// ------------------------------------------------------------------
// 3) Return the *active* project tab ID + an auto-updating sub-query
// ------------------------------------------------------------------
export function useActiveProjectTab() {
    const { data: globalState } = useGlobalState()
    const activeTabId = globalState?.projectActiveTabId

    // Option A: read sub-tab from top-level globalState only
    // const tabData = activeTabId
    //   ? globalState?.projectTabs[activeTabId] ?? null
    //   : null

    // Option B: if you truly want each tab in its own sub-query, do this:
    const query = useQuery<ProjectTabState | null>({
        queryKey: ["globalState", "projectTab", activeTabId],
        enabled: Boolean(activeTabId),
        // Provide an initial read from top-level globalState
        initialData: () => {
            if (!activeTabId) return null
            return globalState?.projectTabs[activeTabId] ?? null
        },
    })

    return {
        id: activeTabId,
        tabData: query.data,
        rawQuery: query,
    }
}
// ------------------------------------------------------------------
// 4) Return a specific project tab by ID, re-rendering on updates
// ------------------------------------------------------------------
export function useProjectTab(tabId: string | null) {
    const { data: globalState } = useGlobalState()

    const { data: tabData } = useQuery<ProjectTabState | null>({
        queryKey: ["globalState", "projectTab", tabId],
        enabled: Boolean(tabId),
        initialData: () => {
            if (!tabId) return null
            return globalState?.projectTabs[tabId] ?? null
        },
    })

    return tabData
}

// ------------------------------------------------------------------
// 5) Return the entire map/dictionary of chat tabs
// ------------------------------------------------------------------
export function useAllChatTabs(): Record<string, ChatTabState> {
    const { data: globalState } = useGlobalState()
    return globalState?.chatTabs ?? {}
}

// ------------------------------------------------------------------
// 6) Return the active chat tab ID + sub-query for chat data
// ------------------------------------------------------------------
export function useActiveChatTab() {
    const { data: globalState } = useGlobalState()
    const activeChatTabId = globalState?.chatActiveTabId

    const { data: tabData } = useQuery<ChatTabState | null>({
        queryKey: ["globalState", "chatTab", activeChatTabId],
        enabled: Boolean(activeChatTabId),
        initialData: () => {
            if (!activeChatTabId) return null
            return globalState?.chatTabs[activeChatTabId] ?? null
        },
    })

    return {
        id: activeChatTabId,
        tabData,
    }
}

// ------------------------------------------------------------------
// 7) Return one specific chat tab by ID
// ------------------------------------------------------------------
export function useChatTabById(tabId: string | null) {
    const { data: globalState } = useGlobalState()

    const { data } = useQuery<ChatTabState | null>({
        queryKey: ["globalState", "chatTab", tabId],
        enabled: Boolean(tabId),
        initialData: () => {
            if (!tabId) return null
            return globalState?.chatTabs[tabId] ?? null
        },
    })

    return data
}

// ------------------------------------------------------------------
// 8) Example for reading theme from settings
// ------------------------------------------------------------------
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
 * =============================================================================
 * Explanation
 * =============================================================================
 *
 * 1. **Why “getQueryData()” Doesn’t Re-Render**  
 *    - TanStack Query’s `getQueryData` is a low-level getter. It doesn’t “subscribe”
 *      your component to changes. It just returns the current cache snapshot.
 *    - Using it inside `useMemo` means you only recompute if the memo’s dependencies
 *      change, which typically won’t happen when the query data changes.
 *
 * 2. **Using “useQuery” for Reactivity**  
 *    - Calling `useQuery(["globalState", "projectTab", tabId])` ensures your component
 *      is subscribed to that query’s data. When the server pushes updates that cause
 *      `queryClient.setQueryData(["globalState", "projectTab", tabId], ...)`, your
 *      component will automatically receive the new data and re-render.
 *
 * 3. **Which Approach to Pick?**  
 *    - If each tab is large or changes frequently, splitting them into sub-queries can
 *      be more performant than re-rendering the entire `globalState` on every small change.
 *    - If your state is small or you don’t mind re-rendering on any global change, you
 *      can just store everything in `globalState` and do a single `useGlobalState()`.
 *    - Either way, if you rely on React Query’s reactivity, **do not** use `getQueryData(...)`
 *      in the render path unless it’s wrapped by `useQuery()`.
 *
 * 4. **Result**  
 *    - After switching to `useQuery`, your file panels, prompt lists, model selectors, etc.
 *      should update immediately when sub-state changes. No manual refresh required.
 */