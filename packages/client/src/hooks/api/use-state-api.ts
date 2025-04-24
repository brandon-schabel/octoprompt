import { useGlobalStore } from '@/stores/global-store'; // Adjust path
import { useCallback } from 'react'; // Import useCallback
import {
    AppSettings,
    ProjectTabState,
    ProjectTabsStateRecord,
    GlobalState,
} from 'shared/src/schemas/global-state-schema'; // Adjust path

// --- Hook to get the whole state (use sparingly) ---
export function useEntireGlobalState(): GlobalState {
    // Directly return the result of useGlobalStore if it represents the entire state
    // Or select the entire state object if useGlobalStore provides more (like actions)
    // Assuming useGlobalStore() returns the GlobalState object directly here.
    return useGlobalStore();
}

// --- Hooks for specific slices and actions ---

export function useAppSettings(): [AppSettings, (partialSettings: Partial<AppSettings>) => void] {
    const settings = useGlobalStore((state) => state.settings);
    const updateSettings = useGlobalStore((state) => state.updateSettings);
    return [settings, updateSettings];
}

// Refactored to use individual selectors for better performance and stability
export function useProjectTabsState(): {
    tabs: ProjectTabsStateRecord;
    activeTabId: string | null;
    setActiveTabId: (tabId: string | null) => void;
    createTab: (initialData: Partial<Omit<ProjectTabState, 'sortOrder'>> & { projectId: string; displayName?: string }) => string;
    updateTab: (tabId: string, partialData: Partial<ProjectTabState>) => void;
    deleteTab: (tabId: string) => void;
    replaceTabs: (newTabs: ProjectTabsStateRecord) => void; // If needed
} {
    const tabs = useGlobalStore((state) => state.projectTabs);
    const activeTabId = useGlobalStore((state) => state.projectActiveTabId);
    const setActiveTabId = useGlobalStore((state) => state.setActiveProjectTab);
    const createTab = useGlobalStore((state) => state.createProjectTab);
    const updateTab = useGlobalStore((state) => state.updateSingleProjectTab);
    const deleteTab = useGlobalStore((state) => state.deleteProjectTab);
    const replaceTabs = useGlobalStore((state) => state.updateProjectTabs);

    // Return the selected state and actions directly
    return {
        tabs,
        activeTabId,
        setActiveTabId,
        createTab,
        updateTab,
        deleteTab,
        replaceTabs,
    };
}

// Refactored for stability: Select data directly, memoize update function
export function useActiveProjectTab(): [ProjectTabState | null, (partialData: Partial<ProjectTabState>) => void, string | null] {
    const activeTabId = useGlobalStore((state) => state.projectActiveTabId);
    // Select the specific tab data based on the active ID
    const activeTabData = useGlobalStore((state) =>
        state.projectActiveTabId ? state.projectTabs[state.projectActiveTabId] ?? null : null
    );
    // Get the stable update action from the store
    const updateSingleTab = useGlobalStore((state) => state.updateSingleProjectTab);

    // Memoize the specific update function for the active tab
    const updateActiveTabData = useCallback((partialData: Partial<ProjectTabState>) => {
        if (activeTabId) {
            updateSingleTab(activeTabId, partialData);
        } else {
            console.warn("Cannot update active tab data, no tab is active.");
        }
    }, [activeTabId, updateSingleTab]); // Dependencies: activeTabId and the stable update action

    return [activeTabData, updateActiveTabData, activeTabId];
}

export function useActiveChatId(): [string | null, (chatId: string | null) => void] {
    const activeChatId = useGlobalStore((state) => state.activeChatId);
    const setActiveChatId = useGlobalStore((state) => state.setActiveChat);
    return [activeChatId, setActiveChatId];
}

// Hook for replacing the entire state (use with caution)
export function useReplaceGlobalState(): (newState: GlobalState) => void {
    return useGlobalStore((state) => state.replaceState);
}
