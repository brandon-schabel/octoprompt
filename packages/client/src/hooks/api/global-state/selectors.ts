import { useAppSettings, useProjectTabsState, useActiveProjectTab as useActiveProjectTabDataHook } from "@/hooks/api/use-state-api";

import { useGlobalStore } from "@/stores/global-store";
import { ProjectTabsStateRecord, AppSettings, ProjectTabState } from "shared";

export function useSettings(): AppSettings {
    const [settings] = useAppSettings();
    return settings;
}

export function useActiveChatId(): string {
    const [activeChatId] = useActiveChatId();
    return activeChatId;
}



export function useAllProjectTabs(): ProjectTabsStateRecord {
    const { tabs } = useProjectTabsState();
    return tabs;
}

export function useActiveProjectTabSelector(): {
    id: string | null;
    tabData: ProjectTabState | null;
    selectedProjectId: string | null;
} {
    const [activeTabData] = useActiveProjectTabDataHook();
    const activeTabId = useGlobalStore((state) => state.projectActiveTabId);

    return {
        id: activeTabId,
        tabData: activeTabData,
        selectedProjectId: activeTabData?.selectedProjectId ?? null,
    };
}

export function useProjectTab(tabId: string | null): ProjectTabState | undefined {
    const tabData = useGlobalStore((state) => {
        if (!tabId || !state.projectTabs) return undefined;
        return state.projectTabs[tabId];
    });

    return tabData;
}

export function useActiveProjectTabDisplayName(): string | null {
    const { id, tabData } = useActiveProjectTabSelector();
    return tabData?.displayName ?? (id ? `Tab ${id.substring(0, 4)}...` : null);
}
