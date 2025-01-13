import { useCallback } from "react";
import { useGlobalStateContext } from "./websocket-config-context";
import {
    GlobalState,
    ProjectTabState,
    ChatTabState,
    LinkSettings,
    linkSettingsSchema,
} from "shared";
import { v4 as uuidv4 } from "uuid";

export type PartialOrFn<T> = Partial<T> | ((prev: T) => Partial<T>);

function getPartial<T>(prev: T, partialOrFn: PartialOrFn<T>): Partial<T> {
    return typeof partialOrFn === "function" ? partialOrFn(prev) : partialOrFn;
}

export function useGlobalStateHelpers() {
    // 1) Access current state + WebSocket
    const { globalState, isOpen, wsClient } = useGlobalStateContext();

    // For convenience, alias your main state:
    const state = globalState;

    /**
     * Utility to check if we *can* send a message
     */
    const canProceed = useCallback((): boolean => {
        if (!isOpen) {
            console.warn("WebSocket not open, cannot send message");
            return false;
        }
        if (!state) {
            console.warn("No state loaded yet, cannot proceed");
            return false;
        }
        return true;
    }, [isOpen, state]);

    /**
     * Helper to send typed messages over the BNK socket
     */
    const sendWSMessage = useCallback((msg: Parameters<typeof wsClient.sendMessage>[0]) => {
        if (canProceed()) {
            wsClient.sendMessage(msg);
        }
    }, [canProceed, wsClient.sendMessage]);

    // --------------------------------------------------
    // 1) Generic Updaters
    // --------------------------------------------------

    function updateGlobalStateKey<K extends keyof GlobalState>(
        key: K,
        partialOrFn: PartialOrFn<GlobalState[K]>
    ) {
        if (!canProceed()) return;
        const currentValue = state[key];
        if (currentValue === undefined) return;
        const finalPartial = getPartial(currentValue, partialOrFn);
        sendWSMessage({
            type: "update_global_state_key",
            data: {
                key,
                partial: finalPartial,
            },
        });
    }

    function updateSettings(partialOrFn: PartialOrFn<GlobalState["settings"]>) {
        updateGlobalStateKey("settings", partialOrFn);
    }

    // --------------------------------------------------
    // 2) Project Tabs
    // --------------------------------------------------

    function createProjectTab() {
        if (!canProceed() || !state?.projectActiveTabId) return;
        const newTabId = `project-tab-${uuidv4()}`;
        const sourceTabId = state.projectActiveTabId;
        const sourceTabState = state.projectTabs[sourceTabId];

        sendWSMessage({
            type: "create_project_tab",
            tabId: newTabId,
            data: {
                ...sourceTabState,
                displayName: `Project Tab ${Object.keys(state.projectTabs).length + 1}`,
            },
        });

        setActiveProjectTab(newTabId);
    }

    function setActiveProjectTab(tabId: string) {
        if (!canProceed()) return;
        sendWSMessage({
            type: "set_active_project_tab",
            tabId,
        });
    }

    function updateProjectTab(tabId: string, partial: Partial<ProjectTabState>) {
        if (!canProceed()) return;
        sendWSMessage({
            type: "update_project_tab",
            tabId,
            // @ts-ignore TODO: Fix this - although it works for now
            data: partial,
        });
    }

    function deleteProjectTab(tabId: string) {
        if (!canProceed() || !state) return;

        // e.g. Don’t delete if it’s the last tab
        if (Object.keys(state.projectTabs).length <= 1) {
            console.warn("Cannot delete the last remaining project tab");
            return;
        }

        sendWSMessage({
            type: "delete_project_tab",
            tabId,
        });
    }

    /**
     * Partially update the currently active project tab
     */
    function updateActiveProjectTab(partialOrFn: PartialOrFn<ProjectTabState>) {
        if (!canProceed() || !state?.projectActiveTabId) return;
        const { projectActiveTabId, projectTabs } = state;
        const currentTab = projectTabs[projectActiveTabId];
        const finalPartial = getPartial(currentTab, partialOrFn);

        sendWSMessage({
            type: "update_project_tab_partial",
            tabId: projectActiveTabId,
            partial: finalPartial,
        });
    }

    /**
     * Update any project tab (by ID) using partial or function
     */
    function updateProjectTabState(tabId: string, partialOrFn: PartialOrFn<ProjectTabState>) {
        if (!canProceed()) return;
        const currentTab = state.projectTabs[tabId];
        if (!currentTab) return;

        const finalPartial = getPartial(currentTab, partialOrFn);
        sendWSMessage({
            type: "update_project_tab_partial",
            tabId,
            partial: finalPartial,
        });
    }

    /**
     * Update a single key in the *active* project tab
     */
    function updateActiveProjectTabStateKey<K extends keyof ProjectTabState>(
        key: K,
        valueOrFn: ProjectTabState[K] | ((prevValue: ProjectTabState[K]) => ProjectTabState[K])
    ) {
        updateActiveProjectTab((prev) => {
            const newValue = typeof valueOrFn === "function" ? (valueOrFn as any)(prev[key]) : valueOrFn;
            return { [key]: newValue };
        });
    }

    // --------------------------------------------------
    // 3) Chat Tabs
    // --------------------------------------------------

    function createChatTab(options?: {
        cleanTab?: boolean;
        model?: string;
        provider?: string;
        title?: string;
    }) {
        if (!canProceed() || !state?.chatActiveTabId) return;
        const newTabId = `chat-tab-${uuidv4()}`;
        const sourceTabId = state.chatActiveTabId;
        const sourceTabState = state.chatTabs[sourceTabId];

        let messageData = {
            ...sourceTabState,
            displayName: options?.title || `Chat ${Object.keys(state.chatTabs).length + 1}`,
            model: options?.model ?? sourceTabState.model,
            provider: options?.provider ?? sourceTabState.provider,
        };

        if (options?.cleanTab) {
            messageData = {
                ...messageData,
                messages: [],
                activeChatId: undefined,
                excludedMessageIds: [],
                linkSettings: {
                    includePrompts: false,
                    includeSelectedFiles: false,
                    includeUserPrompt: false,
                },
                linkedProjectTabId: null,
            };
        } else {
            // If you want to keep old messages or not, adjust logic here
            messageData = {
                ...messageData,
                messages: [],
            };
        }

        sendWSMessage({
            type: "create_chat_tab",
            tabId: newTabId,
            // @ts-ignore TODO: Fix this - although it works for now 
            data: messageData,
        });

        setActiveChatTab(newTabId);
    }

    function setActiveChatTab(tabId: string) {
        if (!canProceed()) return;
        sendWSMessage({
            type: "set_active_chat_tab",
            tabId,
        });
    }

    function updateChatTab(tabId: string, partial: Partial<ChatTabState>) {
        if (!canProceed()) return;
        sendWSMessage({
            type: "update_chat_tab",
            tabId,
            data: partial,
        });
    }

    function deleteChatTab(tabId: string) {
        if (!canProceed() || !state) return;

        // e.g. Don’t delete if it’s the last chat tab
        if (Object.keys(state.chatTabs).length <= 1) {
            console.warn("Cannot delete the last remaining chat tab");
            return;
        }

        sendWSMessage({
            type: "delete_chat_tab",
            tabId,
        });
    }

    function updateActiveChatTab(partialOrFn: PartialOrFn<ChatTabState>) {
        if (!canProceed() || !state?.chatActiveTabId) return;
        const { chatActiveTabId, chatTabs } = state;
        const currentTab = chatTabs[chatActiveTabId];
        const finalPartial = getPartial(currentTab, partialOrFn);

        sendWSMessage({
            type: "update_chat_tab",
            tabId: chatActiveTabId,
            data: finalPartial,
        });
    }

    function updateChatTabState(tabId: string, partialOrFn: PartialOrFn<ChatTabState>) {
        if (!canProceed()) return;
        const currentTab = state.chatTabs[tabId];
        if (!currentTab) return;

        const finalPartial = getPartial(currentTab, partialOrFn);
        sendWSMessage({
            type: "update_chat_tab",
            tabId,
            data: finalPartial,
        });
    }

    // --------------------------------------------------
    // 4) Linking Helpers
    // --------------------------------------------------

    function linkChatTabToProjectTab(
        chatTabId: string,
        projectTabId: string,
        settings?: Partial<LinkSettings>
    ) {
        if (!canProceed()) return;
        const partial = {
            linkedProjectTabId: projectTabId,
            linkSettings: {
                includeSelectedFiles: settings?.includeSelectedFiles ?? true,
                includePrompts: settings?.includePrompts ?? true,
                includeUserPrompt: settings?.includeUserPrompt ?? true,
            },
        };
        sendWSMessage({
            type: "update_chat_tab",
            tabId: chatTabId,
            data: partial,
        });
    }

    function unlinkChatTab(chatTabId: string) {
        if (!canProceed()) return;
        sendWSMessage({
            type: "update_chat_tab",
            tabId: chatTabId,
            data: {
                linkedProjectTabId: null,
                linkSettings: undefined,
            },
        });
    }

    function updateChatLinkSettings(chatTabId: string, partialSettings: Partial<LinkSettings>) {
        if (!canProceed()) return;
        // Optionally validate:
        const existing = state.chatTabs[chatTabId]?.linkSettings ?? {};
        const merged = { ...existing, ...partialSettings };
        linkSettingsSchema.parse(merged); // Validate with Zod
        sendWSMessage({
            type: "update_chat_tab",
            tabId: chatTabId,
            // @ts-ignore TODO: Fix this - although it works for now
            data: { linkSettings: merged },
        });
    }

    // --------------------------------------------------
    // 5) Expose any “active tab” references
    // --------------------------------------------------
    const activeProjectTabState = state.projectActiveTabId
        ? state.projectTabs[state.projectActiveTabId]
        : undefined;

    const activeChatTabState = state.chatActiveTabId
        ? state.chatTabs[state.chatActiveTabId]
        : undefined;

    // --------------------------------------------------
    // Return an object that mimics your old “UseGlobalStateReturn”
    // --------------------------------------------------
    return {
        // The entire state
        state,
        isOpen,

        /** Generic Updaters */
        updateGlobalStateKey,
        updateSettings,

        /** Project tabs */
        createProjectTab,
        setActiveProjectTab,
        updateProjectTab,
        deleteProjectTab,
        updateActiveProjectTab,
        updateProjectTabState,
        updateActiveProjectTabStateKey,

        /** Chat tabs */
        createChatTab,
        setActiveChatTab,
        updateChatTab,
        deleteChatTab,
        updateActiveChatTab,
        updateChatTabState,

        /** Current tab states */
        activeProjectTabState,
        activeChatTabState,

        /** Linking Helpers */
        linkChatTabToProjectTab,
        unlinkChatTab,
        updateChatLinkSettings,
    };
}