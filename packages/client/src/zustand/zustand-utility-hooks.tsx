import { useCallback } from "react";
import { useGlobalStateContext } from "./global-state-provider";
import { useGlobalStateStore } from "./global-state-store";
import {
    useActiveProjectTab,
    useActiveChatTab,
    useSettings,
} from "./selectors";
import {
    useUpdateProjectTab,
    useUpdateChatTab,
    useUpdateSettings,
} from "./updaters";

import type {
    ProjectTabState,
    AppSettings,
    Theme,
    ChatTabState,
} from "shared";


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

    /**
     * mutate: sets the field to a new value (or uses a function callback).
     *         Also invokes `sendWsMessage` if provided.
     */
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

    // Decide which tab ID we’re operating on
    const targetTabId = projectTabId ?? activeTabId ?? "";

    // If a specific ID was provided, read from that tab’s data; else read active tab data
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

export function useSettingsField<K extends keyof AppSettings>(fieldKey: K) {
    const { manager } = useGlobalStateContext();
    const settings = useSettings();
    const updateSettings = useUpdateSettings();

    // We'll wrap the store's action
    const updateFn = useCallback(
        (partial: Partial<AppSettings>) => {
            updateSettings(partial);
        },
        [updateSettings]
    );

    // WebSocket partial updates
    const sendWsMessage = useCallback(
        (updatedValue: AppSettings[K]) => {
            manager.sendMessage({
                type: "update_settings_partial",
                partial: { [fieldKey]: updatedValue },
            });
        },
        [manager, fieldKey]
    );

    return useZustandGenericField(
        settings,
        fieldKey,
        updateFn,
        {
            enabled: true,
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

    return {
        theme: currentTheme,
        setTheme,
    };
}

export function useChatTabField<K extends keyof ChatTabState>(
    fieldKey: K,
    chatTabId?: string
) {
    const { manager } = useGlobalStateContext();
    const { id: activeChatTabId, tabData: activeChatTab } = useActiveChatTab();
    const updateChatTab = useUpdateChatTab();

    // Decide which chat tab ID we're operating on
    const targetTabId = chatTabId ?? activeChatTabId ?? "";

    // If a specific ID was provided, read from that tab’s data; else read active chat tab data
    const record = chatTabId
        ? useGlobalStateStore((s) => s.chatTabs[chatTabId])
        : activeChatTab;

    // Local update function calls "updateChatTab"
    const updateFn = useCallback(
        (partial: Partial<ChatTabState>) => {
            updateChatTab(targetTabId, partial);
        },
        [targetTabId, updateChatTab]
    );

    // WebSocket callback for partial updates
    const sendWsMessage = useCallback(
        (updatedValue: ChatTabState[K]) => {
            manager.sendMessage({
                type: "update_chat_tab_partial",
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