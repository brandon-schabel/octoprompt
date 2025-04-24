import { useCallback, useState, useRef, useEffect, useMemo } from "react";
// Remove manager import if no longer needed anywhere else in this file
// Remove direct Zustand store import
// import { useGlobalStateStore } from "./global-state-store";
import {
  useSettings, // Stays, reads from API state now
} from "./selectors";
import {
  // useUpdateProjectTab is needed, assumes it's the refactored API version
  useUpdateProjectTab,
  useUpdateSettings, // Stays, updates API state now
} from "./updaters";

import type {
  // GlobalState, // Keep if needed for type casting API responses
} from "shared";
import * as themes from "react-syntax-highlighter/dist/esm/styles/hljs"
// Import the necessary API hooks and types
import type{ ProjectTabState, Theme } from "../../generated";
import { useActiveProjectTab, useProjectTabsState } from "../use-state-api";


// --- Debounce and isEqual Utilities (Keep as they are useful) ---
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

function isEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return a === b;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, idx) => isEqual(val, b[idx]));
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(key =>
    Object.prototype.hasOwnProperty.call(b, key) &&
    isEqual(a[key], b[key])
  );
}




// --- [REFACTORED] useProjectTabField ---
export function useProjectTabField<K extends keyof ProjectTabState>(
  fieldKey: K,
  projectTabId?: string // Optional specific tab ID
) {
  // 1. Determine target Tab ID
  const [activeTabIdFromState, , activeTabId] = useActiveProjectTab(); // Reads active ID from API state
  const targetTabId = projectTabId ?? activeTabId;


  const projectTabsState = useProjectTabsState()


  // 2. Read Data from API State
  const projectTabs = projectTabsState.tabs
  const tabData = targetTabId ? projectTabs?.[targetTabId] : undefined;
  const data = tabData ? tabData[fieldKey] : undefined;

  // 3. Determine Loading State
  // Considered loading if API state is loading OR the target tab/field isn't found yet
  const isLoading = false || !tabData;

  // 4. Get the API-driven update function for project tabs
  const updateTab = useUpdateProjectTab(); // Assumes this uses useUpdateStatePartial internally

  // 5. Define the mutate function
  const mutate = useCallback(
    (valueOrFn: ProjectTabState[K] | ((prevVal: ProjectTabState[K] | null | undefined) => ProjectTabState[K])) => {
      if (!targetTabId) {
        console.warn("Cannot mutate project tab field: No target tab ID.");
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
        typeof valueOrFn === "function"
          // @ts-ignore
          ? (valueOrFn as (prev: ProjectTabState[K] | null | undefined) => ProjectTabState[K])(oldVal)
          : valueOrFn;

      // Call the refactored updateTab hook, which handles the API call
      // It expects the tabId and a *partial* update object for that specific tab
      updateTab(targetTabId, { [fieldKey]: newVal } as Partial<ProjectTabState>);

      // No direct Zustand update or WebSocket message needed here
    },
    [targetTabId, tabData, fieldKey, updateTab] // Include tabData in deps to get latest oldVal
  );

  return {
    data,
    isLoading,
    mutate,
  };
}


// --- [REFACTORED] useThemeSettings ---
export function useThemeSettings() {
  // Remove manager/context dependency
  // const { manager } = useGlobalStateContext();
  const settings = useSettings(); // Reads from API state
  const updateSettings = useUpdateSettings(); // Updates API state

  const currentTheme = settings?.theme ?? "light"; // Provide default if settings are loading

  // Mutate the theme using the API-driven update function
  const setTheme = useCallback(
    (newTheme: Theme) => {
      // Update global state via API
      updateSettings({ theme: newTheme });

      // Remove WebSocket message
      // manager.sendMessage({
      //   type: "update_theme",
      //   theme: newTheme,
      // });
    },
    [updateSettings] // Removed manager dependency
  );

  const isDarkMode = currentTheme === "dark";

  // Use defaults if settings are loading
  const codeThemeDark = settings?.codeThemeDark ?? "atomOneDark";
  const codeThemeLight = settings?.codeThemeLight ?? "atomOneLight";

  // @ts-ignore - Type checking for dynamic theme lookup can be tricky
  const selectedSyntaxTheme = useMemo(() => {
    const themeName = isDarkMode ? codeThemeDark : codeThemeLight;
    // @ts-ignore
    return themes[themeName] ?? themes.atomOneLight; // Fallback theme
  }, [isDarkMode, codeThemeDark, codeThemeLight]);


  return {
    theme: currentTheme,
    setTheme,
    isDarkMode: isDarkMode,
    // Rename selectedTheme to avoid conflict with the theme variable itself
    selectedSyntaxTheme: selectedSyntaxTheme,
  };
}


// --- useSynchronizedState (Keep as is) ---
export function useSynchronizedState<T>(
  globalValue: T,
  setGlobalValue: (value: T) => void,
  debounceMs = 300,
  isDisabled = false
): [T, (value: T) => void, boolean] {
  const [localValue, setLocalValue] = useState<T>(globalValue);
  const [isPending, setIsPending] = useState(false);
  const latestValueRef = useRef(localValue);

  useEffect(() => {
    latestValueRef.current = localValue;
  }, [localValue]);

  useEffect(() => {
    // Added check for isDisabled: Don't sync global->local if disabled
    if (!isPending && !isDisabled && !isEqual(globalValue, localValue)) {
      setLocalValue(globalValue);
    }
    // Only run when globalValue changes or isDisabled status changes
  }, [globalValue, isDisabled]); // Removed localValue from deps

  const debouncedSetGlobal = useMemo(() => {
    return debounce(() => {
      setIsPending(false);
      // Check equality *before* calling setGlobalValue
      // This uses the value from the ref at the time debounce fires
      if (!isEqual(latestValueRef.current, globalValue)) {
        setGlobalValue(latestValueRef.current);
      }
    }, debounceMs);
    // globalValue dependency ensures debounce is recreated if globalValue changes
    // while pending, potentially cancelling stale updates if desired (though debounce logic handles this)
  }, [setGlobalValue, globalValue, debounceMs]);

  useEffect(() => {
    return () => {
      debouncedSetGlobal.cancel();
    };
  }, [debouncedSetGlobal]);

  const setLocalValueAndSync = useCallback((value: T) => {
    setLocalValue(value);
    if (!isDisabled) {
      setIsPending(true);
      debouncedSetGlobal();
    }
  }, [debouncedSetGlobal, isDisabled]);

  // Ensure initial state reflects global value correctly
  useEffect(() => {
    setLocalValue(globalValue);
  }, []); // Run only on mount

  return [localValue, setLocalValueAndSync, isPending];
}