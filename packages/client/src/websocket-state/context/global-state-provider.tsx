import { createContext, useContext, ReactNode, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useClientWebSocket } from "@bnk/react-websocket-manager";
import type { ClientWebSocketManager } from "@bnk/client-websocket-manager";

import { SERVER_WS_ENDPOINT } from "@/constants/server-constants";
import {
    type InboundMessage,
    type OutboundMessage,
    type AppSettings,
    type ProjectTabState,
    type ChatTabState,
    type ProjectTabsStateRecord,
    type ChatTabsStateRecord,
    validateIncomingMessage,
} from "shared";

/**
 * The BNK WebSocket manager context interface
 */
interface GlobalStateContextValue {
    manager: ClientWebSocketManager<InboundMessage, OutboundMessage>;
    isOpen: boolean;
    hasReceivedInitialState: boolean;
}

const GlobalStateContext = createContext<GlobalStateContextValue | null>(null);

export function useGlobalStateContext(): GlobalStateContextValue {
    const ctx = useContext(GlobalStateContext);
    if (!ctx) {
        throw new Error("useGlobalStateContext must be used within GlobalStateProvider");
    }
    return ctx;
}

/**
 * Apply inbound WebSocket messages to our local React Query cache
 */
function applyInboundToQueryClient(
    inbound: InboundMessage,
    queryClient: ReturnType<typeof useQueryClient>,
    setInitialized: (v: boolean) => void
) {
    switch (inbound.type) {
        // The server sends either a full or partial global state
        case "state_update":
        case "initial_state": {
            if (inbound.data.projectTabs) {
                Object.entries(inbound.data.projectTabs).forEach(([tabId, tabData]) => {
                    queryClient.setQueryData(["globalState", "projectTab", tabId], tabData);
                });
            }
            if (inbound.data.chatTabs) {
                Object.entries(inbound.data.chatTabs).forEach(([tabId, tabData]) => {
                    queryClient.setQueryData(["globalState", "chatTab", tabId], tabData);
                });
            }

            // Also update app settings, active tab IDs, etc.
            if (inbound.data.settings) {
                queryClient.setQueryData(["globalState", "settings"], inbound.data.settings);
            }
            if (typeof inbound.data.projectActiveTabId !== "undefined") {
                queryClient.setQueryData(["globalState", "projectActiveTabId"], inbound.data.projectActiveTabId);
            }
            if (typeof inbound.data.chatActiveTabId !== "undefined") {
                queryClient.setQueryData(["globalState", "chatActiveTabId"], inbound.data.chatActiveTabId);
            }

            // Mark as initialized when we receive initial state
            if (inbound.type === "initial_state") {
                setInitialized(true);
            }
            break;
        }

        // CREATE a new project tab
        case "create_project_tab": {
            // Put this tab in our local query data
            queryClient.setQueryData(["globalState", "projectTab", inbound.tabId], inbound.data);
            // Optionally set it active
            queryClient.setQueryData(["globalState", "projectActiveTabId"], inbound.tabId);
            break;
        }

        // UPDATE a project tab (full or partial)
        case "update_project_tab":
        case "update_project_tab_partial": {
            queryClient.setQueryData(
                ["globalState", "projectTab", inbound.tabId],
                (prev: ProjectTabState | undefined) => ({
                    ...prev,
                    ...(inbound.type === "update_project_tab" ? inbound.data : inbound.partial),
                })
            );
            break;
        }

        // DELETE a project tab
        case "delete_project_tab": {
            // Remove its query data
            queryClient.removeQueries({ queryKey: ["globalState", "projectTab", inbound.tabId] });
            // If it was active, pick some fallback:
            queryClient.setQueryData<string | null>(
                ["globalState", "projectActiveTabId"],
                (currentActiveId) => (currentActiveId === inbound.tabId ? null : currentActiveId)
            );
            break;
        }

        // Switch active project tab
        case "set_active_project_tab": {
            queryClient.setQueryData(["globalState", "projectActiveTabId"], inbound.tabId);
            break;
        }

        // Create tab from a ticket (same as create but with extra data)
        case "create_project_tab_from_ticket": {
            queryClient.setQueryData(["globalState", "projectTab", inbound.tabId], {
                ticketId: inbound.ticketId,
                ...inbound.data,
            });
            // Optionally set it active
            queryClient.setQueryData(["globalState", "projectActiveTabId"], inbound.tabId);
            break;
        }

        // CREATE a new chat tab
        case "create_chat_tab": {
            queryClient.setQueryData(["globalState", "chatTab", inbound.tabId], inbound.data);
            // Optionally set it active
            queryClient.setQueryData(["globalState", "chatActiveTabId"], inbound.tabId);
            break;
        }

        // UPDATE a chat tab (full or partial)
        case "update_chat_tab":
        case "update_chat_tab_partial": {
            queryClient.setQueryData(
                ["globalState", "chatTab", inbound.tabId],
                (prev: ChatTabState | undefined) => ({
                    ...prev,
                    ...(inbound.type === "update_chat_tab" ? inbound.data : inbound.partial),
                })
            );
            break;
        }

        // DELETE a chat tab
        case "delete_chat_tab": {
            queryClient.removeQueries({ queryKey: ["globalState", "chatTab", inbound.tabId] });
            queryClient.setQueryData<string | null>(
                ["globalState", "chatActiveTabId"],
                (currentActiveId) => (currentActiveId === inbound.tabId ? null : currentActiveId)
            );
            break;
        }

        // Switch active chat tab
        case "set_active_chat_tab": {
            queryClient.setQueryData(["globalState", "chatActiveTabId"], inbound.tabId);
            break;
        }

        // Update settings
        case "update_settings":
        case "update_settings_partial": {
            queryClient.setQueryData<AppSettings | undefined>(
                ["globalState", "settings"],
                (prev) => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        ...(inbound.type === "update_settings" ? inbound.data : inbound.partial),
                    } as AppSettings;
                }
            );
            break;
        }

        // Direct theme update
        case "update_theme": {
            queryClient.setQueryData<AppSettings | undefined>(
                ["globalState", "settings"],
                (prev) => (prev ? { ...prev, theme: inbound.theme } : prev)
            );
            break;
        }

        // Change provider on a project tab
        case "update_provider": {
            queryClient.setQueryData<ProjectTabState | undefined>(
                ["globalState", "projectTab", inbound.tabId],
                (prev) => (prev ? { ...prev, provider: inbound.provider } : prev)
            );
            break;
        }

        // Link settings changed
        case "update_link_settings": {
            queryClient.setQueryData<ProjectTabState | undefined>(
                ["globalState", "projectTab", inbound.tabId],
                (prev) => (prev ? { ...prev, linkSettings: inbound.settings } : prev)
            );
            break;
        }

        // Partial update of a specific globalState key
        case "update_global_state_key": {
            const key = inbound.data.key;
            const partialValue = inbound.data.partial;
            switch (key) {
                case "settings":
                    queryClient.setQueryData<AppSettings | undefined>(
                        ["globalState", "settings"],
                        (prev) => (prev ? { ...prev, ...partialValue } : prev)
                    );
                    break;
                case "projectTabs":
                    Object.entries(partialValue as ProjectTabsStateRecord).forEach(([tabId, tabData]) => {
                        queryClient.setQueryData(["globalState", "projectTab", tabId], (old: ProjectTabState | undefined) => ({
                            ...old,
                            ...tabData,
                        }));
                    });
                    break;
                case "chatTabs":
                    Object.entries(partialValue as ChatTabsStateRecord).forEach(([tabId, tabData]) => {
                        queryClient.setQueryData(["globalState", "chatTab", tabId], (old: ChatTabState | undefined) => ({
                            ...old,
                            ...tabData,
                        }));
                    });
                    break;
                case "projectActiveTabId":
                    queryClient.setQueryData(["globalState", "projectActiveTabId"], partialValue);
                    break;
                case "chatActiveTabId":
                    queryClient.setQueryData(["globalState", "chatActiveTabId"], partialValue);
                    break;
            }
            break;
        }
    }
}

export function GlobalStateProvider({ children }: { children: ReactNode }) {
    const queryClient = useQueryClient();
    const [hasReceivedInitialState, setHasReceivedInitialState] = useState(false);

    // BNK's manager for the WS connection
    const { isOpen, manager } = useClientWebSocket<InboundMessage, OutboundMessage>({
        config: {
            url: SERVER_WS_ENDPOINT,
            debug: true,
            validateIncomingMessage,
            autoReconnect: true,
            reconnectIntervalMs: 500,
            maxReconnectAttempts: 500,
            messageHandlers: {
                // For each inbound type, apply to the query client
                state_update: (msg) => applyInboundToQueryClient(msg, queryClient, setHasReceivedInitialState),
                initial_state: (msg) => applyInboundToQueryClient(msg, queryClient, setHasReceivedInitialState),
                create_project_tab: (msg) => applyInboundToQueryClient(msg, queryClient, setHasReceivedInitialState),
                update_project_tab: (msg) => applyInboundToQueryClient(msg, queryClient, setHasReceivedInitialState),
                update_project_tab_partial: (msg) => applyInboundToQueryClient(msg, queryClient, setHasReceivedInitialState),
                delete_project_tab: (msg) => applyInboundToQueryClient(msg, queryClient, setHasReceivedInitialState),
                set_active_project_tab: (msg) => applyInboundToQueryClient(msg, queryClient, setHasReceivedInitialState),
                create_project_tab_from_ticket: (msg) => applyInboundToQueryClient(msg, queryClient, setHasReceivedInitialState),
                create_chat_tab: (msg) => applyInboundToQueryClient(msg, queryClient, setHasReceivedInitialState),
                update_chat_tab: (msg) => applyInboundToQueryClient(msg, queryClient, setHasReceivedInitialState),
                update_chat_tab_partial: (msg) => applyInboundToQueryClient(msg, queryClient, setHasReceivedInitialState),
                delete_chat_tab: (msg) => applyInboundToQueryClient(msg, queryClient, setHasReceivedInitialState),
                set_active_chat_tab: (msg) => applyInboundToQueryClient(msg, queryClient, setHasReceivedInitialState),
                update_settings: (msg) => applyInboundToQueryClient(msg, queryClient, setHasReceivedInitialState),
                update_settings_partial: (msg) => applyInboundToQueryClient(msg, queryClient, setHasReceivedInitialState),
                update_theme: (msg) => applyInboundToQueryClient(msg, queryClient, setHasReceivedInitialState),
                update_provider: (msg) => applyInboundToQueryClient(msg, queryClient, setHasReceivedInitialState),
                update_link_settings: (msg) => applyInboundToQueryClient(msg, queryClient, setHasReceivedInitialState),
                update_global_state_key: (msg) => applyInboundToQueryClient(msg, queryClient, setHasReceivedInitialState),
            },
        },
    });

    return (
        <GlobalStateContext.Provider value={{ manager, isOpen, hasReceivedInitialState }}>
            {children}
        </GlobalStateContext.Provider>
    );
}