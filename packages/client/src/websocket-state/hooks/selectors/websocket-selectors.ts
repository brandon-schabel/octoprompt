import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import {
    type ProjectTabState,
    type ChatTabState,
    type AppSettings,
} from "shared";

/**
 * Access the entire app settings
 */
export function useSettings() {
    const { data: settings } = useQuery<AppSettings>({
        queryKey: ["globalState", "settings"],
    });
    return settings;
}

/**
 * Return all project tabs as an object keyed by tabId
 */
export function useAllProjectTabs(): Record<string, ProjectTabState> {
    const queryClient = useQueryClient();
    return useMemo(() => {
        // Grab all queries that match ["globalState", "projectTab", someTabId]
        const allKeys = queryClient
            .getQueryCache()
            .findAll()
            .filter(
                (q) =>
                    Array.isArray(q.queryKey) &&
                    q.queryKey.length === 3 &&
                    q.queryKey[0] === "globalState" &&
                    q.queryKey[1] === "projectTab"
            );

        const result: Record<string, ProjectTabState> = {};
        for (const key of allKeys) {
            const tabId = key.queryKey[2] as string;
            const tabData = queryClient.getQueryData<ProjectTabState>([
                "globalState",
                "projectTab",
                tabId,
            ]);
            if (tabData) {
                result[tabId] = tabData;
            }
        }
        return result;
    }, [queryClient]);
}

/**
 * Return the currently active project tab’s ID + data
 */
export function useActiveProjectTab() {
    const { data: activeTabId } = useQuery<string | null>({
        queryKey: ["globalState", "projectActiveTabId"],
    });

    const query = useQuery<ProjectTabState | null>({
        queryKey: ["globalState", "projectTab", activeTabId],
        enabled: Boolean(activeTabId),
    });

    return {
        id: activeTabId,
        tabData: query.data,
        rawQuery: query,
        selectedProjectId: query.data?.selectedProjectId ?? "",
    };
}

/**
 * For a specific tab ID, return that ProjectTabState
 */
export function useProjectTab(tabId: string | null) {
    const { data: tabData } = useQuery<ProjectTabState | null>({
        queryKey: ["globalState", "projectTab", tabId],
        enabled: Boolean(tabId),
    });
    return tabData;
}

/**
 * Return all chat tabs
 */
export function useAllChatTabs(): Record<string, ChatTabState> {
    const queryClient = useQueryClient();
    return useMemo(() => {
        const allKeys = queryClient
            .getQueryCache()
            .findAll()
            .filter(
                (q) =>
                    Array.isArray(q.queryKey) &&
                    q.queryKey.length === 3 &&
                    q.queryKey[0] === "globalState" &&
                    q.queryKey[1] === "chatTab"
            );

        const result: Record<string, ChatTabState> = {};
        for (const key of allKeys) {
            const tabId = key.queryKey[2] as string;
            const tabData = queryClient.getQueryData<ChatTabState>([
                "globalState",
                "chatTab",
                tabId,
            ]);
            if (tabData) {
                result[tabId] = tabData;
            }
        }
        return result;
    }, [queryClient]);
}

/**
 * Return the currently active chat tab ID + data
 */
export function useActiveChatTab() {
    const { data: activeChatTabId } = useQuery<string | null>({
        queryKey: ["globalState", "chatActiveTabId"],
    });

    const { data: tabData } = useQuery<ChatTabState | null>({
        queryKey: ["globalState", "chatTab", activeChatTabId],
        enabled: Boolean(activeChatTabId),
    });

    return {
        id: activeChatTabId,
        tabData,
    };
}

/**
 * For a specific chat tab ID, return that ChatTabState
 */
export function useChatTabById(tabId: string | null) {
    const { data } = useQuery<ChatTabState | null>({
        queryKey: ["globalState", "chatTab", tabId],
        enabled: Boolean(tabId),
    });
    return data;
}