import { useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { useGlobalStateContext } from "@/components/global-state/global-state-websocket-handler-context";
import { useGlobalState } from "./use-global-state";
import { buildTicketContent } from "@/components/tickets/utils/ticket-utils";
import type { TicketWithTasks } from "@/hooks/api/use-tickets-api";
import {
    GlobalState,
    ProjectTabState,
    ChatTabState,
    linkSettingsSchema,
    LinkSettings,
} from "shared";
import { useActiveChatTab, useActiveProjectTab } from "./websocket-selector-hoooks";

/**
 * Helper for partial updates of state.
 */
export type PartialOrFn<T> = Partial<T> | ((prev: T) => Partial<T>);

function getPartial<T>(prev: T, partialOrFn: PartialOrFn<T>): Partial<T> {
    return typeof partialOrFn === "function" ? partialOrFn(prev) : partialOrFn;
}




export function useSendWebSocketMessage() {
    const { manager, isOpen } = useGlobalStateContext();
    const canProceed = useCallback((): boolean => {
        if (!isOpen) {
            console.warn("WebSocket not open, cannot send message");
            return false;
        }
        return true;
    }, [isOpen]);

    const sendWSMessage = useCallback(
        (msg: Parameters<typeof manager.sendMessage>[0]) => {
            if (canProceed()) {
                manager.sendMessage(msg);
            }
        },
        [manager, canProceed]
    );

    return {
        manager,
        isOpen,
        canProceed,
        sendWSMessage,
    };
}

/**
 * This hook provides the underlying references (WebSocket manager, global state, etc.)
 * needed by the smaller custom hooks.
 */
export function useGlobalStateCore() {
    const { manager, isOpen } = useSendWebSocketMessage();
    const { data: state } = useGlobalState();

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

    const sendWSMessage = useCallback(
        (msg: Parameters<typeof manager.sendMessage>[0]) => {
            if (canProceed()) {
                manager.sendMessage(msg);
            }
        },
        [manager, canProceed]
    );

    return {
        manager,
        state,
        isOpen,
        canProceed,
        sendWSMessage,
    };
}

/**
 * Hook: update global state key
 */
export function useUpdateGlobalStateKey() {
    const { state, canProceed, sendWSMessage } = useGlobalStateCore();

    return useCallback(
        <K extends keyof GlobalState>(key: K, partialOrFn: PartialOrFn<GlobalState[K]>) => {
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
        },
        [canProceed, state, sendWSMessage]
    );
}

/**
 * Hook: update settings
 */
export function useUpdateSettings() {
    const { state, canProceed, sendWSMessage } = useGlobalStateCore();

    return useCallback(
        (partialOrFn: PartialOrFn<GlobalState["settings"]>) => {
            if (!canProceed() || !state) return;
            const finalPartial = getPartial(state.settings, partialOrFn);
            sendWSMessage({
                type: "update_settings_partial",
                partial: finalPartial,
            });
        },
        [canProceed, state, sendWSMessage]
    );
}

/* --------------------------------------------------
   PROJECT TAB HOOKS
   -------------------------------------------------- */

/**
 * Hook: create a project tab
 */
export function useCreateProjectTab() {
    const { state, canProceed, sendWSMessage } = useGlobalStateCore();

    return useCallback(
        ({
            projectId,
            userPrompt = "",
            selectedFiles = [],
            displayName = "New Project Tab",
        }: {
            projectId: string;
            userPrompt?: string;
            selectedFiles?: string[];
            displayName?: string;
        }) => {
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
        },
        [canProceed, state, sendWSMessage]
    );
}

/**
 * Hook: set active project tab
 */
export function useSetActiveProjectTab() {
    const { canProceed, sendWSMessage } = useGlobalStateCore();

    return useCallback(
        (tabId: string) => {
            if (!canProceed()) return;
            sendWSMessage({
                type: "set_active_project_tab",
                tabId,
            });
        },
        [canProceed, sendWSMessage]
    );
}

/**
 * Hook: update project tab
 */
export function useUpdateProjectTab() {
    const { canProceed, sendWSMessage } = useGlobalStateCore();

    return useCallback(
        (tabId: string, partial: Partial<ProjectTabState>) => {
            if (!canProceed()) return;
            sendWSMessage({
                type: "update_project_tab_partial",
                tabId,
                partial,
            });
        },
        [canProceed, sendWSMessage]
    );
}

/**
 * Hook: delete project tab
 */
export function useDeleteProjectTab() {
    const { state, canProceed, sendWSMessage } = useGlobalStateCore();

    return useCallback(
        (tabId: string) => {
            if (!canProceed() || !state) return;
            if (Object.keys(state.projectTabs).length <= 1) {
                console.warn("Cannot delete the last remaining project tab");
                return;
            }
            sendWSMessage({
                type: "delete_project_tab",
                tabId,
            });
        },
        [canProceed, state, sendWSMessage]
    );
}

/**
 * Hook: update the currently active project tab
 */
export function useUpdateActiveProjectTab() {
    const { state, canProceed, sendWSMessage } = useGlobalStateCore();
    const { id: activeProjectTabId } = useActiveProjectTab()

    return useCallback(
        (partialOrFn: PartialOrFn<ProjectTabState>) => {
            if (!canProceed() || !activeProjectTabId) return;
            const currentTab = state.projectTabs[activeProjectTabId];
            const finalPartial = getPartial(currentTab, partialOrFn);
            sendWSMessage({
                type: "update_project_tab_partial",
                tabId: activeProjectTabId,
                partial: finalPartial,
            });
        },
        [canProceed, state, sendWSMessage]
    );
}

/**
 * Hook: update a specified project tab by partial or function
 */
export function useUpdateProjectTabState() {
    const { state, canProceed, sendWSMessage } = useGlobalStateCore();

    return useCallback(
        (tabId: string, partialOrFn: PartialOrFn<ProjectTabState>) => {
            if (!canProceed() || !state) return;
            const currentTab = state.projectTabs[tabId];
            if (!currentTab) return;
            const finalPartial = getPartial(currentTab, partialOrFn);
            sendWSMessage({
                type: "update_project_tab_partial",
                tabId,
                partial: finalPartial,
            });
        },
        [canProceed, state, sendWSMessage]
    );
}

/**
 * Hook: update a single key on the active project tab
 */
export function useUpdateActiveProjectTabStateKey() {
    const updateActiveProjectTab = useUpdateActiveProjectTab();

    return useCallback(
        <K extends keyof ProjectTabState>(
            key: K,
            valueOrFn: ProjectTabState[K] | ((prevValue: ProjectTabState[K]) => ProjectTabState[K])
        ) => {
            updateActiveProjectTab((prev) => {
                const newValue =
                    typeof valueOrFn === "function" ? (valueOrFn as any)(prev[key]) : valueOrFn;
                return { [key]: newValue };
            });
        },
        [updateActiveProjectTab]
    );
}

/**
 * Hook: create a project tab from a ticket
 */
export function useCreateProjectTabFromTicket() {
    const { state, canProceed, sendWSMessage } = useGlobalStateCore();
    const setActiveProjectTab = useSetActiveProjectTab();

    return useCallback(
        (ticket: TicketWithTasks, customTabId?: string) => {
            if (!canProceed() || !state?.projectActiveTabId) return;
            const tabId = customTabId ?? `ticket-tab-${uuidv4()}`;

            const currentTab = state.projectTabs[state.projectActiveTabId];
            if (!currentTab) return;

            const userPrompt = buildTicketContent(ticket);
            const suggestedFileIds = JSON.parse(ticket.suggestedFileIds || "[]");

            const newTabData: ProjectTabState = {
                ...currentTab,
                selectedProjectId: ticket.projectId,
                selectedFiles: suggestedFileIds,
                suggestedFileIds,
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
        },
        [canProceed, state, sendWSMessage, setActiveProjectTab]
    );
}

/* --------------------------------------------------
   CHAT TAB HOOKS
   -------------------------------------------------- */

/**
 * Hook: create chat tab
 */
export function useCreateChatTab() {
    const { state, canProceed, sendWSMessage } = useGlobalStateCore();
    const setActiveChatTab = useSetActiveChatTab();
    const { id: activeChatTabId } = useActiveChatTab()


    return useCallback(
        (options?: { cleanTab?: boolean; model?: string; provider?: string; title?: string }) => {
            if (!canProceed() || !activeChatTabId) return;
            const newTabId = `chat-tab-${uuidv4()}`;
            const sourceTabId = activeChatTabId;
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
        },
        [canProceed, state, sendWSMessage, setActiveChatTab]
    );
}

/**
 * Hook: set active chat tab
 */
export function useSetActiveChatTab() {
    const { canProceed, sendWSMessage } = useGlobalStateCore();

    return useCallback(
        (tabId: string) => {
            if (!canProceed()) return;
            sendWSMessage({
                type: "set_active_chat_tab",
                tabId,
            });
        },
        [canProceed, sendWSMessage]
    );
}

/**
 * Hook: update chat tab
 */
export function useUpdateChatTab() {
    const { canProceed, sendWSMessage } = useGlobalStateCore();

    return useCallback(
        (tabId: string, partial: Partial<ChatTabState>) => {
            if (!canProceed()) return;
            sendWSMessage({
                type: "update_chat_tab_partial",
                tabId,
                partial,
            });
        },
        [canProceed, sendWSMessage]
    );
}

/**
 * Hook: delete chat tab
 */
export function useDeleteChatTab() {
    const { state, canProceed, sendWSMessage } = useGlobalStateCore();

    return useCallback(
        (tabId: string) => {
            if (!canProceed() || !state) return;
            if (Object.keys(state.chatTabs).length <= 1) {
                console.warn("Cannot delete the last remaining chat tab");
                return;
            }
            sendWSMessage({
                type: "delete_chat_tab",
                tabId,
            });
        },
        [canProceed, state, sendWSMessage]
    );
}

/**
 * Hook: update the currently active chat tab
 */
export function useUpdateActiveChatTab() {
    const { state, canProceed, sendWSMessage } = useGlobalStateCore();
    const { id: activeChatTabId } = useActiveChatTab()

    return useCallback(
        (partialOrFn: PartialOrFn<ChatTabState>) => {
            if (!canProceed() || !activeChatTabId) return;
            const currentTab = state.chatTabs[activeChatTabId];
            const finalPartial = getPartial(currentTab, partialOrFn);
            sendWSMessage({
                type: "update_chat_tab_partial",
                tabId: activeChatTabId,
                partial: finalPartial,
            });
        },
        [canProceed, state, sendWSMessage]
    );
}

/**
 * Hook: update a specified chat tab by partial or function
 */
export function useUpdateChatTabState() {
    const { state, canProceed, sendWSMessage } = useGlobalStateCore();

    return useCallback(
        (tabId: string, partialOrFn: PartialOrFn<ChatTabState>) => {
            if (!canProceed() || !state) return;
            const currentTab = state.chatTabs[tabId];
            if (!currentTab) return;
            const finalPartial = getPartial(currentTab, partialOrFn);
            sendWSMessage({
                type: "update_chat_tab_partial",
                tabId,
                partial: finalPartial,
            });
        },
        [canProceed, state, sendWSMessage]
    );
}

/* --------------------------------------------------
   LINKING HOOKS
   -------------------------------------------------- */

/**
 * Hook: link chat tab to a project tab
 */
export function useLinkChatTabToProjectTab() {
    const { canProceed, sendWSMessage } = useGlobalStateCore();

    return useCallback(
        (chatTabId: string, projectTabId: string, settings?: Partial<LinkSettings>) => {
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
        },
        [canProceed, sendWSMessage]
    );
}

/**
 * Hook: unlink chat tab
 */
export function useUnlinkChatTab() {
    const { canProceed, sendWSMessage } = useGlobalStateCore();

    return useCallback(
        (chatTabId: string) => {
            if (!canProceed()) return;
            sendWSMessage({
                type: "update_chat_tab_partial",
                tabId: chatTabId,
                partial: {
                    linkedProjectTabId: null,
                    linkSettings: undefined,
                },
            });
        },
        [canProceed, sendWSMessage]
    );
}

/**
 * Hook: update chat link settings
 */
export function useUpdateChatLinkSettings() {
    const { state, canProceed, sendWSMessage } = useGlobalStateCore();

    return useCallback(
        (chatTabId: string, partialSettings: Partial<LinkSettings>) => {
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
        },
        [canProceed, state, sendWSMessage]
    );
}

