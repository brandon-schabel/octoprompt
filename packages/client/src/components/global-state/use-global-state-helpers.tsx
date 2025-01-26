import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { v4 as uuidv4 } from "uuid";
import { buildTicketContent } from "@/components/tickets/utils/ticket-utils";
import type { TicketWithTasks } from "@/hooks/api/use-tickets-api";

import { useGlobalStateContext } from "@/components/global-state/global-state-websocket";

import {
    GlobalState,
    ProjectTabState,
    ChatTabState,
    linkSettingsSchema,
    LinkSettings,
} from "shared";
import { useGlobalState } from "./use-global-state";

/**
 * We define a small helper to handle partial updates.
 */
export type PartialOrFn<T> = Partial<T> | ((prev: T) => Partial<T>);

function getPartial<T>(prev: T, partialOrFn: PartialOrFn<T>): Partial<T> {
    return typeof partialOrFn === "function" ? partialOrFn(prev) : partialOrFn;
}

/**
 * Main hook for updating / reading global state via BNK + React Query.
 */
export function useGlobalStateHelpers() {
    // 1) Access BNK manager + isOpen from the new context
    const { manager, isOpen } = useGlobalStateContext();

    // We pull the entire globalState from the cache:
    const { data: state } = useGlobalState();

    // Helper to confirm if safe to proceed
    const canProceed = useCallback((): boolean => {
        if (!isOpen) {
            console.warn("WebSocket not open, cannot send message");
            return false;
        }
        if (!state) {
            console.warn("No global state loaded yet, cannot proceed");
            return false;
        }
        return true;
    }, [isOpen, state]);

    // Utility to send messages
    const sendWSMessage = useCallback(
        (msg: Parameters<typeof manager.sendMessage>[0]) => {
            if (canProceed()) {
                manager.sendMessage(msg);
            }
        },
        [manager, canProceed]
    );

    // --------------------------------------------------
    // Example functions for updating global state
    // --------------------------------------------------
    function updateGlobalStateKey<K extends keyof GlobalState>(
        key: K,
        partialOrFn: PartialOrFn<GlobalState[K]>
    ) {
        if (!canProceed() || !state) return;
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
        if (!canProceed() || !state) return;
        const finalPartial = getPartial(state.settings, partialOrFn);
        sendWSMessage({
            type: "update_settings_partial",
            partial: finalPartial,
        });
    }

    // --------------------------------------------------
    // Project Tab
    // --------------------------------------------------
    function createProjectTab({
        projectId,
        userPrompt = "",
        selectedFiles = [],
        displayName = "New Project Tab",
    }: {
        projectId: string;
        userPrompt?: string;
        selectedFiles?: string[];
        displayName?: string;
    }) {
        if (!canProceed() || !state) return;
        const newTabId = `project-tab-${uuidv4()}`;

        const newTabData: ProjectTabState = {
            selectedProjectId: projectId,
            editProjectId: null,
            promptDialogOpen: false,
            editPromptId: null,
            fileSearch: "",
            selectedFiles,
            selectedPrompts: [],
            userPrompt,
            searchByContent: false,
            displayName,
            contextLimit: 128000,
            resolveImports: false,
            preferredEditor: "cursor",
            suggestedFileIds: [],
            bookmarkedFileGroups: {},
            ticketSearch: "",
            ticketSort: "created_desc",
            ticketStatusFilter: "all",
            ticketId: null,
        };

        sendWSMessage({
            type: "create_project_tab",
            tabId: newTabId,
            data: newTabData,
        });
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
            type: "update_project_tab_partial",
            tabId,
            partial,
        });
    }

    function deleteProjectTab(tabId: string) {
        if (!canProceed() || !state) return;
        if (Object.keys(state.projectTabs).length <= 1) {
            console.warn("Cannot delete the last remaining project tab");
            return;
        }
        sendWSMessage({
            type: "delete_project_tab",
            tabId,
        });
    }

    function updateActiveProjectTab(partialOrFn: PartialOrFn<ProjectTabState>) {
        if (!canProceed() || !state?.projectActiveTabId) return;
        const currentTab = state.projectTabs[state.projectActiveTabId];
        const finalPartial = getPartial(currentTab, partialOrFn);
        sendWSMessage({
            type: "update_project_tab_partial",
            tabId: state.projectActiveTabId,
            partial: finalPartial,
        });
    }

    function updateProjectTabState(tabId: string, partialOrFn: PartialOrFn<ProjectTabState>) {
        if (!canProceed() || !state) return;
        const currentTab = state.projectTabs[tabId];
        if (!currentTab) return;

        const finalPartial = getPartial(currentTab, partialOrFn);
        sendWSMessage({
            type: "update_project_tab_partial",
            tabId,
            partial: finalPartial,
        });
    }

    function updateActiveProjectTabStateKey<K extends keyof ProjectTabState>(
        key: K,
        valueOrFn: ProjectTabState[K] | ((prevValue: ProjectTabState[K]) => ProjectTabState[K])
    ) {
        updateActiveProjectTab((prev) => {
            const newValue = typeof valueOrFn === "function" ? (valueOrFn as any)(prev[key]) : valueOrFn;
            return { [key]: newValue };
        });
    }

    function createProjectTabFromTicket(ticket: TicketWithTasks, customTabId?: string) {
        if (!canProceed() || !state?.projectActiveTabId) return;
        const tabId = customTabId ?? `ticket-tab-${uuidv4()}`;

        const currentTab = state.projectTabs[state.projectActiveTabId];
        if (!currentTab) return;

        const userPrompt = buildTicketContent(ticket);

        const newTabData: ProjectTabState = {
            ...currentTab,
            selectedProjectId: ticket.projectId,
            selectedFiles: JSON.parse(ticket.suggestedFileIds || "[]"),
            suggestedFileIds: JSON.parse(ticket.suggestedFileIds || "[]"),
            userPrompt,
            displayName: ticket.title || "Ticket Tab",
            editProjectId: null,
            promptDialogOpen: false,
            editPromptId: null,
            fileSearch: "",
            ticketSearch: "",
            ticketId: ticket.id,
        };

        sendWSMessage({
            type: "create_project_tab_from_ticket",
            tabId,
            ticketId: ticket.id,
            data: newTabData,
        });

        setActiveProjectTab(tabId);
    }

    // --------------------------------------------------
    // Chat Tab
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

        const messageData: ChatTabState = {
            ...sourceTabState,
            displayName: options?.title || `Chat ${Object.keys(state.chatTabs).length + 1}`,
            model: options?.model ?? sourceTabState.model,
            provider: (options?.provider ?? sourceTabState.provider) as ChatTabState["provider"],
            messages: [],
            input: "",
            excludedMessageIds: [],
            activeChatId: undefined,
            linkSettings: options?.cleanTab ? undefined : sourceTabState.linkSettings,
            linkedProjectTabId: options?.cleanTab ? null : sourceTabState.linkedProjectTabId,
        };

        sendWSMessage({
            type: "create_chat_tab",
            tabId: newTabId,
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
            type: "update_chat_tab_partial",
            tabId,
            partial,
        });
    }

    function deleteChatTab(tabId: string) {
        if (!canProceed() || !state) return;
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
        const currentTab = state.chatTabs[state.chatActiveTabId];
        const finalPartial = getPartial(currentTab, partialOrFn);
        sendWSMessage({
            type: "update_chat_tab_partial",
            tabId: state.chatActiveTabId,
            partial: finalPartial,
        });
    }

    function updateChatTabState(tabId: string, partialOrFn: PartialOrFn<ChatTabState>) {
        if (!canProceed() || !state) return;
        const currentTab = state.chatTabs[tabId];
        if (!currentTab) return;

        const finalPartial = getPartial(currentTab, partialOrFn);
        sendWSMessage({
            type: "update_chat_tab_partial",
            tabId,
            partial: finalPartial,
        });
    }

    // --------------------------------------------------
    // Linking
    // --------------------------------------------------
    function linkChatTabToProjectTab(
        chatTabId: string,
        projectTabId: string,
        settings?: Partial<LinkSettings>
    ) {
        if (!canProceed()) return;
        sendWSMessage({
            type: "update_chat_tab_partial",
            tabId: chatTabId,
            partial: {
                linkedProjectTabId: projectTabId,
                linkSettings: {
                    includeSelectedFiles: true,
                    includePrompts: true,
                    includeUserPrompt: true,
                    ...settings,
                } satisfies LinkSettings,
            },
        });
    }

    function unlinkChatTab(chatTabId: string) {
        if (!canProceed()) return;
        sendWSMessage({
            type: "update_chat_tab_partial",
            tabId: chatTabId,
            partial: {
                linkedProjectTabId: null,
                linkSettings: undefined,
            },
        });
    }

    function updateChatLinkSettings(chatTabId: string, partialSettings: Partial<LinkSettings>) {
        if (!canProceed() || !state) return;
        const existing = state.chatTabs[chatTabId]?.linkSettings ?? {};
        const merged = { ...existing, ...partialSettings };
        linkSettingsSchema.parse(merged);
        sendWSMessage({
            type: "update_chat_tab_partial",
            tabId: chatTabId,
            partial: {
                linkSettings: {
                    includePrompts: merged.includePrompts ?? true,
                    includeSelectedFiles: merged.includeSelectedFiles ?? true,
                    includeUserPrompt: merged.includeUserPrompt ?? true,
                },
            },
        });
    }

    // --------------------------------------------------
    // Misc
    // --------------------------------------------------
    function setProjectSummarizationEnabled(projectId: string, enabled: boolean) {
        updateSettings((prev) => {
            let list = prev.summarizationEnabledProjectIds ?? [];
            if (!enabled) {
                if (!list.includes(projectId)) {
                    list = [...list, projectId];
                }
            } else {
                list = list.filter((id) => id !== projectId);
            }
            return { summarizationEnabledProjectIds: list };
        });
    }

    function addFileGroup(groupName: string, fileIds: string[]) {
        updateActiveProjectTab((prevTab) => ({
            bookmarkedFileGroups: {
                ...prevTab.bookmarkedFileGroups,
                [groupName]: fileIds,
            },
        }));
    }

    // Convenient references to active tabs
    const activeProjectTabState = state?.projectActiveTabId
        ? state.projectTabs[state.projectActiveTabId]
        : undefined;

    const activeChatTabState = state?.chatActiveTabId
        ? state.chatTabs[state.chatActiveTabId]
        : undefined;

    // Return everything the rest of the app might need
    return {
        // Current global state from React Query
        state,
        isOpen,

        // Generic
        updateGlobalStateKey,
        updateSettings,

        // Project tab
        createProjectTab,
        setActiveProjectTab,
        updateProjectTab,
        deleteProjectTab,
        updateActiveProjectTab,
        updateProjectTabState,
        updateActiveProjectTabStateKey,
        createProjectTabFromTicket,
        activeProjectTabState,

        // Chat
        createChatTab,
        setActiveChatTab,
        updateChatTab,
        deleteChatTab,
        updateActiveChatTab,
        updateChatTabState,
        activeChatTabState,

        // Linking
        linkChatTabToProjectTab,
        unlinkChatTab,
        updateChatLinkSettings,

        // Misc
        setProjectSummarizationEnabled,
        addFileGroup,
    };
}