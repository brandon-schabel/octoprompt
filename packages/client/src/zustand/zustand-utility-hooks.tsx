import { useCallback, useState, useRef, useEffect, useMemo } from "react";
import { useGlobalStateContext } from "./global-state-provider";
import { useGlobalStateStore } from "./global-state-store";
import {
  useActiveProjectTab,
  useSettings,
} from "./selectors";
import {
  useUpdateProjectTab,
  useUpdateSettings,
} from "./updaters";

import type {
  GlobalState,
  ProjectTabState,
  Theme,
} from "shared";
import * as themes from "react-syntax-highlighter/dist/esm/styles/hljs"
import { useGetState, useUpdateState } from "@/hooks/api/use-state-api";
import { AppSettings, ReplaceStateBody } from "@/hooks/generated";

function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait = 300
): {
  (...args: Parameters<T>): void;
  cancel: () => void;
} {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      timeout = null;
      func(...args);
    }, wait);
  };

  debounced.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  return debounced;
}

export function useZustandGenericField<T extends object, K extends keyof T>(
  record: T | undefined,
  fieldKey: K,
  updateFn: (partial: Partial<T>) => void,
  options?: {
    enabled?: boolean;
    sendWsMessage?: (updatedValue: T[K]) => void;
  }
) {
  const { enabled = true, sendWsMessage } = options ?? {};

  // Basic "loading" heuristic: if `enabled` is false or record is undefined
  const isLoading = !enabled || !record;

  // The current field value from the record
  const data: T[K] | undefined = record ? record[fieldKey] : undefined;

  const mutate = useCallback(
    (valueOrFn: T[K] | ((prevVal: T[K]) => T[K])) => {
      if (!record) return;

      const oldVal = record[fieldKey];
      const newVal =
        typeof valueOrFn === "function"
          ? (valueOrFn as (prev: T[K]) => T[K])(oldVal)
          : valueOrFn;

      // Update Zustand locally
      updateFn({ [fieldKey]: newVal } as unknown as Partial<T>);

      // Optionally send a WebSocket message
      if (sendWsMessage) {
        sendWsMessage(newVal);
      }
    },
    [record, fieldKey, updateFn, sendWsMessage]
  );

  return {
    data,
    isLoading,
    mutate,
  };
}

export function useProjectTabField<T extends keyof ProjectTabState>(
  fieldKey: T,
  projectTabId?: string
) {
  const { manager } = useGlobalStateContext();
  const { id: activeTabId, tabData: activeTabData } = useActiveProjectTab();
  const updateTab = useUpdateProjectTab();

  // Decide which tab ID we're operating on
  const targetTabId = projectTabId ?? activeTabId ?? "";

  // If a specific ID was provided, read from that tab's data; else read active tab data
  const record = projectTabId
    ? useGlobalStateStore((s) => s.projectTabs[projectTabId])
    : activeTabData;

  // Local update function calls "updateProjectTab"
  const updateFn = useCallback(
    (partial: Partial<ProjectTabState>) => {
      updateTab(targetTabId, partial);
    },
    [targetTabId, updateTab]
  );

  // WebSocket callback for partial updates
  const sendWsMessage = useCallback(
    (updatedValue: ProjectTabState[T]) => {
      manager.sendMessage({
        type: "update_project_tab_partial",
        tabId: targetTabId,
        partial: { [fieldKey]: updatedValue },
      });
    },
    [manager, fieldKey, targetTabId]
  );

  return useZustandGenericField(
    record,
    fieldKey,
    updateFn,
    {
      enabled: Boolean(targetTabId),
      sendWsMessage,
    }
  );
}


export function useThemeSettings() {
  const { manager } = useGlobalStateContext();
  const settings = useSettings();
  const updateSettings = useUpdateSettings();

  // Current theme from global settings
  const currentTheme = settings.theme;

  // Mutate the theme
  const setTheme = useCallback(
    (newTheme: Theme) => {
      // Update locally
      updateSettings({ theme: newTheme });
      // Send optional specialized WS message
      manager.sendMessage({
        type: "update_theme",
        theme: newTheme,
      });
    },
    [manager, updateSettings]
  );

  const isDarkMode = currentTheme === "dark"

  const codeThemeDark = settings.codeThemeDark
  const codeThemeLight = settings.codeThemeLight

  // @ts-ignore
  const selectedTheme = isDarkMode ? themes[codeThemeDark] : themes[codeThemeLight]

  return {
    theme: currentTheme,
    setTheme,
    isDarkMode: currentTheme === "dark",
    selectedTheme,
  };
}

/**
 * A hook for maintaining synchronized state between local component state and 
 * global Zustand state with debouncing to prevent excessive re-renders.
 * 
 * @param globalValue The current value from global state
 * @param setGlobalValue Function to update the global state
 * @param debounceMs Optional debounce time in ms (default: 300ms)
 * @param isDisabled Optional flag to disable synchronization
 * @returns [localValue, setLocalValue, isPending]
 */
export function useSynchronizedState<T>(
  globalValue: T,
  setGlobalValue: (value: T) => void,
  debounceMs = 300,
  isDisabled = false
): [T, (value: T) => void, boolean] {
  // Local state that reflects the UI control state
  const [localValue, setLocalValue] = useState<T>(globalValue);

  // Track whether an update is pending to be sent to global state
  const [isPending, setIsPending] = useState(false);

  // Reference to the latest value to use in debounced functions
  const latestValueRef = useRef(localValue);

  // Keep the ref updated with the latest value
  useEffect(() => {
    latestValueRef.current = localValue;
  }, [localValue]);

  // Update local value when global value changes, but only if not pending
  // This prevents circular updates where our own change causes an update
  useEffect(() => {
    if (!isPending && !isEqual(globalValue, localValue)) {
      setLocalValue(globalValue);
    }
  }, [globalValue]);

  // Debounced function to update global state
  const debouncedSetGlobal = useMemo(() => {
    return debounce(() => {
      setIsPending(false);
      if (!isEqual(latestValueRef.current, globalValue)) {
        setGlobalValue(latestValueRef.current);
      }
    }, debounceMs);
  }, [setGlobalValue, globalValue, debounceMs]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      debouncedSetGlobal.cancel();
    };
  }, [debouncedSetGlobal]);

  // Function to set local state and trigger debounced global update
  const setLocalValueAndSync = useCallback((value: T) => {
    setLocalValue(value);
    if (!isDisabled) {
      setIsPending(true);
      debouncedSetGlobal();
    }
  }, [debouncedSetGlobal, isDisabled]);

  return [localValue, setLocalValueAndSync, isPending];
}

// Helper function to compare values
function isEqual(a: any, b: any): boolean {
  if (a === b) return true;

  // Handle primitive types
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return a === b;
  }

  // Handle arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, idx) => isEqual(val, b[idx]));
  }

  // Handle objects
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  return keysA.every(key =>
    Object.prototype.hasOwnProperty.call(b, key) &&
    isEqual(a[key], b[key])
  );
}