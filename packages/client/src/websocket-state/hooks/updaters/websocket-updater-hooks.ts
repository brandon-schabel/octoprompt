import { useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { useGlobalStateContext } from "@/websocket-state/global-state-websocket-handler-context";
import { buildTicketContent } from "@/components/tickets/utils/ticket-utils";
import type { TicketWithTasks } from "@/hooks/api/use-tickets-api";
import {
    type ProjectTabState,
    type ChatTabState,
    type AppSettings,
    type LinkSettings,
    linkSettingsSchema,
} from "shared";
import { useActiveChatTab, useActiveProjectTab, useProjectTab, useSettings } from "../selectors/websocket-selector-hoooks";

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
 * Hook: update settings
 */
export function useUpdateSettings() {
    const { canProceed, sendWSMessage } = useSendWebSocketMessage();
    const settings = useSettings();

    return useCallback(
        (partialOrFn: PartialOrFn<AppSettings>) => {
            if (!canProceed() || !settings) return;
            const finalPartial = getPartial(settings, partialOrFn);
            sendWSMessage({
                type: "update_settings_partial",
                partial: finalPartial,
            });
        },
        [canProceed, settings, sendWSMessage]
    );
}

/* --------------------------------------------------
   PROJECT TAB HOOKS
   -------------------------------------------------- */

/**
 * Hook: create a project tab
 */
export function useCreateProjectTab() {
    const { canProceed, sendWSMessage } = useSendWebSocketMessage();

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
            if (!canProceed()) return;
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
        [canProceed, sendWSMessage]
    );
}

/**
 * Hook: set active project tab
 */
export function useSetActiveProjectTab() {
    const { canProceed, sendWSMessage } = useSendWebSocketMessage();

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
    const { canProceed, sendWSMessage } = useSendWebSocketMessage();

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
    const { canProceed, sendWSMessage } = useSendWebSocketMessage();
    const settings = useSettings();

    return useCallback(
        (tabId: string) => {
            if (!canProceed() || !settings) return;
            if (settings.projectTabIdOrder.length <= 1) {
                console.warn("Cannot delete the last remaining project tab");
                return;
            }
            sendWSMessage({
                type: "delete_project_tab",
                tabId,
            });
        },
        [canProceed, settings, sendWSMessage]
    );
}

/**
 * Hook: update the currently active project tab
 */
export function useUpdateActiveProjectTab() {
    const { canProceed, sendWSMessage } = useSendWebSocketMessage();
    const { id: activeProjectTabId, tabData: activeProjectTab } = useActiveProjectTab();

    return useCallback(
        (partialOrFn: PartialOrFn<ProjectTabState>) => {
            if (!canProceed() || !activeProjectTabId || !activeProjectTab) return;
            const finalPartial = getPartial(activeProjectTab, partialOrFn);
            sendWSMessage({
                type: "update_project_tab_partial",
                tabId: activeProjectTabId,
                partial: finalPartial,
            });
        },
        [canProceed, activeProjectTabId, activeProjectTab, sendWSMessage]
    );
}

/**
 * Hook: update a specified project tab by partial or function
 */
export function useUpdateProjectTabState(projectTabId: string) {
    const { canProceed, sendWSMessage } = useSendWebSocketMessage();
    const projectTab = useProjectTab(projectTabId);

    return useCallback(
        (partialOrFn: PartialOrFn<ProjectTabState>) => {
            if (!projectTab) {
                console.warn(`Project tab ${projectTabId} not found`);
                return;
            }
            if (!canProceed()) return;
            const finalPartial = getPartial(projectTab, partialOrFn);
            sendWSMessage({
                type: "update_project_tab_partial",
                tabId: projectTabId,
                partial: finalPartial,
            });
        },
        [canProceed, projectTabId, projectTab, sendWSMessage]
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
    const { canProceed, sendWSMessage } = useSendWebSocketMessage();
    const { tabData: activeProjectTab } = useActiveProjectTab();
    const setActiveProjectTab = useSetActiveProjectTab();

    return useCallback(
        (ticket: TicketWithTasks, customTabId?: string) => {
            if (!canProceed() || !activeProjectTab) return;
            const tabId = customTabId ?? `ticket-tab-${uuidv4()}`;

            const userPrompt = buildTicketContent(ticket);
            const suggestedFileIds = JSON.parse(ticket.suggestedFileIds || "[]");

            const newTabData: ProjectTabState = {
                ...activeProjectTab,
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
        [canProceed, activeProjectTab, sendWSMessage, setActiveProjectTab]
    );
}

/* --------------------------------------------------
   CHAT TAB HOOKS
   -------------------------------------------------- */

/**
 * Hook: create chat tab
 */
export function useCreateChatTab() {
    const { canProceed, sendWSMessage } = useSendWebSocketMessage();
    const setActiveChatTab = useSetActiveChatTab();
    const { tabData: activeChatTab } = useActiveChatTab();

    return useCallback(
        (options?: { cleanTab?: boolean; model?: string; provider?: string; title?: string }) => {
            if (!canProceed() || !activeChatTab) return;
            const newTabId = `chat-tab-${uuidv4()}`;

            const messageData: ChatTabState = {
                ...activeChatTab,
                displayName: options?.title || `Chat ${Date.now()}`,
                model: options?.model ?? activeChatTab.model,
                provider: (options?.provider ?? activeChatTab.provider) as ChatTabState["provider"],
                messages: [],
                input: "",
                excludedMessageIds: [],
                activeChatId: undefined,
                linkSettings: options?.cleanTab ? undefined : activeChatTab.linkSettings,
                linkedProjectTabId: options?.cleanTab ? null : activeChatTab.linkedProjectTabId,
            };

            sendWSMessage({
                type: "create_chat_tab",
                tabId: newTabId,
                data: messageData,
            });

            setActiveChatTab(newTabId);
        },
        [canProceed, activeChatTab, sendWSMessage, setActiveChatTab]
    );
}

/**
 * Hook: set active chat tab
 */
export function useSetActiveChatTab() {
    const { canProceed, sendWSMessage } = useSendWebSocketMessage();

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
    const { canProceed, sendWSMessage } = useSendWebSocketMessage();

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
    const { canProceed, sendWSMessage } = useSendWebSocketMessage();
    const settings = useSettings();

    return useCallback(
        (tabId: string) => {
            if (!canProceed() || !settings) return;
            if (settings.chatTabIdOrder.length <= 1) {
                console.warn("Cannot delete the last remaining chat tab");
                return;
            }
            sendWSMessage({
                type: "delete_chat_tab",
                tabId,
            });
        },
        [canProceed, settings, sendWSMessage]
    );
}

/**
 * Hook: update the currently active chat tab
 */
export function useUpdateActiveChatTab() {
    const { canProceed, sendWSMessage } = useSendWebSocketMessage();
    const { id: activeChatTabId, tabData: activeChatTab } = useActiveChatTab();

    return useCallback(
        (partialOrFn: PartialOrFn<ChatTabState>) => {
            if (!canProceed() || !activeChatTabId || !activeChatTab) return;
            const finalPartial = getPartial(activeChatTab, partialOrFn);
            sendWSMessage({
                type: "update_chat_tab_partial",
                tabId: activeChatTabId,
                partial: finalPartial,
            });
        },
        [canProceed, activeChatTabId, activeChatTab, sendWSMessage]
    );
}

/**
 * Hook: update a specified chat tab by partial or function
 */
export function useUpdateChatTabState() {
    const { canProceed, sendWSMessage } = useSendWebSocketMessage();

    return useCallback(
        (tabId: string, partialOrFn: PartialOrFn<ChatTabState>, currentTab: ChatTabState) => {
            if (!canProceed()) return;
            const finalPartial = getPartial(currentTab, partialOrFn);
            sendWSMessage({
                type: "update_chat_tab_partial",
                tabId,
                partial: finalPartial,
            });
        },
        [canProceed, sendWSMessage]
    );
}

/* --------------------------------------------------
   LINKING HOOKS
   -------------------------------------------------- */

/**
 * Hook: link chat tab to a project tab
 */
export function useLinkChatTabToProjectTab() {
    const { canProceed, sendWSMessage } = useSendWebSocketMessage();

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
    const { canProceed, sendWSMessage } = useSendWebSocketMessage();

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
    const { canProceed, sendWSMessage } = useSendWebSocketMessage();

    return useCallback(
        (chatTabId: string, partialSettings: Partial<LinkSettings>, currentSettings?: LinkSettings) => {
            if (!canProceed()) return;
            const existing = currentSettings ?? {};
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
        [canProceed, sendWSMessage]
    );
}

