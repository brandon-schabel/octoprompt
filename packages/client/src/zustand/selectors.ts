import { useGetState } from "@/hooks/api/use-state-api"
import { useGlobalStateStore } from "./global-state-store"
import type {
    ProjectTabState,
} from "shared"
import { AppSettings, GetApiStateData } from "@/hooks/generated"

export function useSettings(): AppSettings {
    const { data, isLoading, isError } = useGetState()

    return data?.data?.settings as AppSettings
}

export function useActiveChat(): string | null {
    return useGlobalStateStore((s) => s.activeChatId)
}

export function useChatLinkSettings(chatId: string | null): {
    includeSelectedFiles?: boolean
    includePrompts?: boolean
    includeUserPrompt?: boolean
    linkedProjectTabId?: string | null
} | undefined {
    return useGlobalStateStore((s) => chatId ? s.chatLinkSettings[chatId] : undefined)
}

export function useAllProjectTabs(): Record<string, ProjectTabState> {
    return useGlobalStateStore((s) => s.projectTabs)
}

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

export function useProjectTab(tabId: string | null): ProjectTabState | undefined {
    const projectTabs = useGlobalStateStore((s) => s.projectTabs)
    if (!tabId) return undefined
    return projectTabs[tabId]
}

