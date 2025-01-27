import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo } from "react"
import {
    type ProjectTabState,
    type ChatTabState,
    type AppSettings,
} from "shared"

export function useSettings() {
    const { data: settings } = useQuery<AppSettings>({
        queryKey: ["globalState", "settings"],
    })
    return settings
}

export function useAllProjectTabs(): Record<string, ProjectTabState> {
    const settings = useSettings()
    const queryClient = useQueryClient()

    return useMemo(() => {
        if (!settings?.projectTabIdOrder) return {}

        const result: Record<string, ProjectTabState> = {}
        for (const tabId of settings.projectTabIdOrder) {
            const tabData = queryClient.getQueryData<ProjectTabState>([
                "globalState",
                "projectTab",
                tabId,
            ])
            if (tabData) {
                result[tabId] = tabData
            }
        }
        return result
    }, [settings?.projectTabIdOrder, queryClient])
}

export function useActiveProjectTab() {
    const { data: activeTabId } = useQuery<string | null>({
        queryKey: ["globalState", "projectActiveTabId"],
    })

    const query = useQuery<ProjectTabState | null>({
        queryKey: ["globalState", "projectTab", activeTabId],
        enabled: Boolean(activeTabId),
    })

    return {
        id: activeTabId,
        tabData: query.data,
        rawQuery: query,
    }
}

export function useProjectTab(tabId: string | null) {
    const { data: tabData } = useQuery<ProjectTabState | null>({
        queryKey: ["globalState", "projectTab", tabId],
        enabled: Boolean(tabId),
    })

    return tabData
}

export function useAllChatTabs(): Record<string, ChatTabState> {
    const settings = useSettings()
    const queryClient = useQueryClient()

    return useMemo(() => {
        if (!settings?.chatTabIdOrder) return {}

        const result: Record<string, ChatTabState> = {}
        for (const tabId of settings.chatTabIdOrder) {
            const tabData = queryClient.getQueryData<ChatTabState>([
                "globalState",
                "chatTab",
                tabId,
            ])
            if (tabData) {
                result[tabId] = tabData
            }
        }
        return result
    }, [settings?.chatTabIdOrder, queryClient])
}

export function useActiveChatTab() {
    const { data: activeChatTabId } = useQuery<string | null>({
        queryKey: ["globalState", "chatActiveTabId"],
    })

    const { data: tabData } = useQuery<ChatTabState | null>({
        queryKey: ["globalState", "chatTab", activeChatTabId],
        enabled: Boolean(activeChatTabId),
    })

    return {
        id: activeChatTabId,
        tabData,
    }
}

export function useChatTabById(tabId: string | null) {
    const { data } = useQuery<ChatTabState | null>({
        queryKey: ["globalState", "chatTab", tabId],
        enabled: Boolean(tabId),
    })

    return data
}

