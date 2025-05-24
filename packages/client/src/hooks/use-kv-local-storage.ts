import { useLocalStorage } from '@/hooks/utility-hooks/use-local-storage';
import { KVKey, KVValue, KVDefaultValues } from 'shared/src/schemas/kv-store.schemas';
import {
  AppSettings,
  ProjectTabsStateRecord,
  ProjectTabState,
  ProjectTabStatePartial,
  Theme,
} from 'shared/index';
import { useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';

export function useGetKvValue<K extends KVKey>(key: K) {
  return useLocalStorage<KVValue<K>>(key, KVDefaultValues[key]);
}

export function useSetKvValue<K extends KVKey>(key: K) {
  const [value, setValue] = useLocalStorage<KVValue<K>>(key, KVDefaultValues[key]);

  const mutate = useCallback(
    (valueOrFn: KVValue<K> | ((prev: KVValue<K>) => KVValue<K>)) => {
      setValue(valueOrFn);
    },
    [setValue]
  );

  return {
    data: value,
    mutate,
    isLoading: false, // Local storage operations are synchronous
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null,
  };
}

export function useDeleteKvValue() {
  const mutate = useCallback(({ key }: { key: KVKey }) => {
    try {
      localStorage.removeItem(key);
      // Dispatch storage event for cross-tab sync
      window.dispatchEvent(
        new StorageEvent('storage', {
          key,
          newValue: null,
        })
      );
      return { success: true, key };
    } catch (error) {
      console.error(`Error deleting local storage key "${key}":`, error);
      return { success: false, key };
    }
  }, []);

  return {
    mutate,
    isLoading: false,
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null,
  };
}

export const updateProjectTabs = () => {
  const { mutate: setProjectTabs } = useSetKvValue('projectTabs');

  return (projectTabs: ProjectTabsStateRecord) => {
    setProjectTabs(projectTabs);
  };
};

export const useUpdateProjectTabById = () => {
  const [projectTabs] = useGetProjectTabs();
  const { mutate: setProjectTabs, ...rest } = useSetKvValue('projectTabs');

  if (!projectTabs) {
    throw new Error('Project tabs not found');
  }

  const updateProjectTabById = (tabId: number, partialData: Partial<ProjectTabState>) => {
    const tabData = projectTabs[tabId];
    setProjectTabs({
      ...projectTabs,
      [tabId]: {
        ...tabData,
        ...partialData,
      },
    });
  };

  return {
    ...rest,
    projectTabs,
    updateProjectTabById,
  };
};

export const useGetProjectTabs = () => {
  return useGetKvValue('projectTabs');
};

export const useGetProjectTab = (tabId: number) => {
  const [projectTabs, ...rest] = useGetProjectTabs();

  const projectTab = useMemo(() => {
    return projectTabs?.[tabId];
  }, [projectTabs, tabId]);

  return { ...rest, projectTab };
};

export const useGetAppSettings = () => {
  return useGetKvValue('appSettings');
};

export const useAppSettingsKvApi = () => {
  const [appSettings] = useGetAppSettings();
  const { mutate: setAppSettings } = useSetKvValue('appSettings');

  return [appSettings, setAppSettings];
};

export const useInvalidateKv = (key: KVKey) => {
  // No-op for local storage, as updates are synchronous
  return () => { };
};

export const useGetProjectTabById = (tabIdInput: number): [ProjectTabState | undefined, (partialData: Partial<ProjectTabState>) => void] => {
  const [projectTabs, setProjectTabs] = useGetProjectTabs();

  const projectTab = useMemo(() => {
    return projectTabs?.[tabIdInput];
  }, [projectTabs, tabIdInput]);

  const setProjectTab = (partialData: Partial<ProjectTabState>) => {
    setProjectTabs({
      ...projectTabs,
      [tabIdInput]: {
        ...projectTabs[tabIdInput],
        ...partialData,
      },
    });
  };

  return [projectTab, setProjectTab];
};

export const useDeleteProjectTabById = () => {
  const [projectTabs] = useGetProjectTabs();
  const { mutate: setProjectTabs, isPending: isDeleting } = useSetKvValue('projectTabs');

  const deleteTab = (tabIdToDelete: number) => {
    if (!projectTabs) {
      console.error('Cannot delete tab: project tabs data not available.');
      return;
    }

    // Create a new object without the deleted tab
    const { [tabIdToDelete]: _, ...remainingTabs } = projectTabs;

    // Update the KV store with the remaining tabs
    setProjectTabs(remainingTabs);
  };

  return { deleteTab, isDeleting }; // Return the delete function and loading state
};

export const useSetActiveProjectTabId = () => {
  const { mutate: setActiveProjectTabId, ...rest } = useSetKvValue('activeProjectTabId');

  const setActiveProjectTab = (tabId: number) => {
    setActiveProjectTabId(tabId);
  };

  return {
    ...rest,
    setActiveProjectTabId: setActiveProjectTabId,
  };
};

export const useGetActiveProjectTabId = () => {
  return useGetKvValue('activeProjectTabId');
};

export const useCreateProjectTab = () => {
  const { mutate: updateProjectTabs, ...rest } = useSetKvValue('projectTabs');
  const [projectTabs] = useGetProjectTabs();
  const [activeProjectTabId] = useGetActiveProjectTabId();
  const currentSelectedProjectId = useProjectTabById(activeProjectTabId ?? -1)?.selectedProjectId;

  const createProjectTab = (payload: ProjectTabStatePartial) => {
    const newTabId = uuidv4();
    // @ts-ignore
    const projectTab: ProjectTabState = {
      // id: newTabId,
      // ...currentProjectTabData,
      ...payload,
      selectedProjectId: currentSelectedProjectId ?? null,
      editProjectId: null,
      promptDialogOpen: false,
      editPromptId: null,
      fileSearch: '',
      selectedFiles: [],
      selectedPrompts: [],
      userPrompt: '',
      sortOrder: 0,
      displayName: `Tab ${Date.now()}`,
      searchByContent: false,
      ticketId: null,
      contextLimit: 64000,
    };

    updateProjectTabs({
      ...projectTabs,
      [newTabId]: projectTab,
    });

    return newTabId;
  };
  return { ...rest, createProjectTab };
};

export const useProjectTabById = (tabId: number) => {
  const [projectTabs] = useGetProjectTabs();

  return useMemo(() => {
    return projectTabs?.[tabId];
  }, [projectTabs, tabId]);
};

export function useProjectTabField<K extends keyof ProjectTabState>(
  fieldKey: K,
  projectTabId?: number // Optional specific tab ID
) {
  const [activeProjectTabId] = useGetActiveProjectTabId();
  const targetTabId = projectTabId ?? activeProjectTabId;

  const [projectTabs] = useGetProjectTabs();

  const tabData = targetTabId ? projectTabs?.[targetTabId] : undefined;
  const data = tabData ? tabData[fieldKey] : undefined;

  const isLoading = false || !tabData;

  const { updateProjectTabById: updateTab } = useUpdateProjectTabById(); // Assumes this uses useUpdateStatePartial internally

  const mutate = useCallback(
    (valueOrFn: ProjectTabState[K] | ((prevVal: ProjectTabState[K] | null | undefined) => ProjectTabState[K])) => {
      if (!targetTabId) {
        console.warn('Cannot mutate project tab field: No target tab ID.');
        return;
      }
      if (!tabData) {
        // This case should ideally be handled by disabling the control calling mutate
        // but we add a check just in case.
        console.warn(`Cannot mutate project tab field: Target tab data (${targetTabId}) not found.`);
        return;
      }

      const oldVal = tabData[fieldKey];
      const newVal =
        typeof valueOrFn === 'function'
          ? // @ts-ignore
          (valueOrFn as (prev: ProjectTabState[K] | null | undefined) => ProjectTabState[K])(oldVal)
          : valueOrFn;

      // Call the refactored updateTab hook, which handles the API call
      // It expects the tabId and a *partial* update object for that specific tab
      updateTab(targetTabId, { [fieldKey]: newVal } as Partial<ProjectTabState>);

      // No direct KV update or WebSocket message needed here
    },
    [targetTabId, tabData, fieldKey, updateTab] // Include tabData in deps to get latest oldVal
  );

  return {
    data,
    isLoading,
    mutate,
  };
}

export const useSelectSetting = <K extends keyof AppSettings>(key: K) => {
  const [settings] = useAppSettings();
  return settings?.[key] as AppSettings[K];
}

export function useAppSettings(): [AppSettings, (partialSettings: PartialOrFn<AppSettings>) => void] {
  const [appSettings, setAppSettings] = useAppSettingsKvApi();

  return [appSettings as AppSettings, setAppSettings as (partialSettings: PartialOrFn<AppSettings>) => void];
}

export function useActiveProjectTab(): [
  ProjectTabState | undefined,
  (partialData: Partial<ProjectTabState>) => void,
  number | null
] {
  const [activeProjectTabId] = useGetActiveProjectTabId();
  const { projectTab: activeProjectTabData } = useGetProjectTab(activeProjectTabId ?? -1);
  const { updateProjectTabById } = useUpdateProjectTabById();

  const updateActiveProjectTab = (partialData: Partial<ProjectTabState>) => {
    if (activeProjectTabId) {
      updateProjectTabById(activeProjectTabId, partialData);
    }
  };

  return [activeProjectTabData, updateActiveProjectTab, activeProjectTabId as number | null];
}

export function useActiveChatId(): [number | null, (chatId: number | null) => void] {
  const [activeChatId] = useGetKvValue('activeChatId');
  const { mutate: setActiveChatIdKvFn } = useSetKvValue('activeChatId');

  const setActiveChatId = (chatId: number | null) => {
    if (!chatId) {
      console.error('Cannot set active chat id to null');
    }
    setActiveChatIdKvFn(chatId ?? -1);
  };
  return [activeChatId ?? null, setActiveChatId];
}

export type PartialOrFn<T> = Partial<T> | ((prev: T) => Partial<T>);

function getPartial<T>(prev: T, partialOrFn: PartialOrFn<T>): Partial<T> {
  return typeof partialOrFn === 'function' ? (partialOrFn as (prev: T) => Partial<T>)(prev) : partialOrFn;
}

export function useDeleteProjectTab() {
  // Get state and actions needed from the hook
  const [tabs] = useGetProjectTabs();
  const [activeProjectTabId] = useGetActiveProjectTabId();
  const { deleteTab } = useDeleteProjectTabById();
  const { setActiveProjectTabId } = useSetActiveProjectTabId();

  return (tabIdToDelete: number) => {
    if (!tabIdToDelete) {
      console.warn('Cannot delete tab without a tabId.');
      return;
    }

    // Determine potential next active tab *before* deleting
    let nextActiveTabId: number | null = null;
    if (activeProjectTabId === tabIdToDelete) {
      const remainingTabIds = Object.keys(tabs ?? {}).filter((id) => parseInt(id) !== tabIdToDelete);
      // Simple logic: activate the first remaining tab. Could be more sophisticated.
      nextActiveTabId = parseInt(remainingTabIds[0] ?? '') ?? null;
    }

    // Call the delete action from the store
    deleteTab(tabIdToDelete);

    // Activate the next tab *after* successful deletion
    if (activeProjectTabId === tabIdToDelete) {
      setActiveProjectTabId(nextActiveTabId ?? -1); // Call the activation action
    }
  };
}

// --- Convenience Updaters ---

/**
 * Convenience hook to update the state of a *specific* project tab
 * identified by its ID. Accepts a partial update or a function.
 */
export function useUpdateProjectTabState(projectTabId: number) {
  const [tabs] = useGetProjectTabs();
  const { updateProjectTabById } = useUpdateProjectTabById();
  const projectTab = tabs?.[projectTabId]; // Get current state directly

  return (partialOrFn: PartialOrFn<ProjectTabState>) => {
    if (!projectTabId) {
      console.warn('Cannot update tab state without a projectTabId.');
      return;
    }

    if (!projectTab) {
      console.warn(`Project tab ${projectTabId} data not found in state. Update might fail or do nothing.`);
      // Depending on desired behavior, you might return or attempt the update.
      // updateTab might handle non-existent IDs gracefully.
    }

    const finalPartial = getPartial(projectTab ?? ({} as ProjectTabState), partialOrFn); // Use helper

    if (Object.keys(finalPartial).length === 0) {
      return;
    }

    updateProjectTabById(projectTabId, finalPartial); // Call the core KV action
  };
}

/**
 * Convenience hook to update the state of the *currently active* project tab.
 * Accepts a partial update or a function.
 */
export function useUpdateActiveProjectTab() {
  // Use the specific hook for active tab data and updater
  const [activeTabData, updateActiveTabData] = useActiveProjectTab();

  return (partialOrFn: PartialOrFn<ProjectTabState>) => {
    if (!activeTabData) {
      console.warn('No active project tab to update');
      return;
    }
    // Use the helper function to resolve the partial
    const finalPartial = getPartial(activeTabData, partialOrFn);

    if (Object.keys(finalPartial).length === 0) {
      console.log(`Skipping update for active tab: partial is empty.`);
      return;
    }

    // Call the updater function returned by useActiveProjectTabData
    updateActiveTabData(finalPartial);
  };
}
