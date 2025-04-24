import { useGetState } from "@/hooks/api/use-state-api"
import { ChatLinkSettingsMap, ProjectTabsStateRecord } from "@/hooks/generated"
import type {
    ProjectTabState,
    AppSettings,
} from "shared"

export function useSettings(): AppSettings {
    const { data } = useGetState()
    return data?.data?.settings as AppSettings
}

export function useActiveChat(): string | null {
    const { data } = useGetState()
    return data?.data?.activeChatId ?? null
}

type ChatLinkSetting = ChatLinkSettingsMap[string];

export function useChatLinkSettings(chatId: string | null): ChatLinkSetting | undefined {
    const { data } = useGetState()
    const allSettings = data?.data?.chatLinkSettings
    if (!chatId || !allSettings) {
        return undefined
    }
    return allSettings[chatId]
}

export function useAllProjectTabs(): ProjectTabsStateRecord {
    const { data } = useGetState()
    return data?.data?.projectTabs as ProjectTabsStateRecord
}

export function useActiveProjectTab(): {
    id: string | null
    tabData: ProjectTabState | undefined
    selectedProjectId: string | null
} {
    const { data } = useGetState()
    const activeTabId = data?.data?.projectActiveTabId ?? null
    const projectTabs = data?.data?.projectTabs ?? {}
    const tabData = activeTabId ? projectTabs[activeTabId] : undefined

    return {
        id: activeTabId,
        tabData: tabData as ProjectTabState,
        selectedProjectId: tabData?.selectedProjectId ?? null
    }
}

export function useProjectTab(tabId: string | null): ProjectTabState | undefined {
    const { data } = useGetState()
    const projectTabs = data?.data?.projectTabs ?? {}
    if (!tabId) return undefined
    return projectTabs[tabId] as ProjectTabState | undefined
}
