import { createContext, useContext, ReactNode } from "react";
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

// ---------------------------------------
// Step 1: Build a context for BNK manager
// ---------------------------------------
interface GlobalStateContextValue {
    /**
     * The BNK WebSocket manager for sending messages from anywhere in the app.
     */
    manager: ClientWebSocketManager<InboundMessage, OutboundMessage>;
    /**
     * True if the WebSocket is open.
     */
    isOpen: boolean;
}

/**
 * We create a React Context that will store { manager, isOpen }.
 */
const GlobalStateContext = createContext<GlobalStateContextValue | null>(null);

export function useGlobalStateContext(): GlobalStateContextValue {
    const ctx = useContext(GlobalStateContext);
    if (!ctx) {
        throw new Error("useGlobalStateContext must be used within GlobalStateProvider");
    }
    return ctx;
}

// -------------------------------------------------------------------
// Step 2: Inbound messages -> React Query updates
// -------------------------------------------------------------------
function applyInboundToQueryClient(
    inbound: InboundMessage,
    queryClient: ReturnType<typeof useQueryClient>
) {
    switch (inbound.type) {
        // ------------------
        // Full or partial state updates
        // ------------------
        case "state_update":
        case "initial_state": {
            // Split out each project tab into its own query
            if (inbound.data.projectTabs) {
                Object.entries(inbound.data.projectTabs).forEach(([tabId, tabData]) => {
                    queryClient.setQueryData(["globalState", "projectTab", tabId], tabData);
                });
            }

            // Split out each chat tab into its own query
            if (inbound.data.chatTabs) {
                Object.entries(inbound.data.chatTabs).forEach(([tabId, tabData]) => {
                    queryClient.setQueryData(["globalState", "chatTab", tabId], tabData);
                });
            }

            // Store settings in its own query
            queryClient.setQueryData(["globalState", "settings"], inbound.data.settings);

            // Store active tab IDs in their own queries
            queryClient.setQueryData(["globalState", "projectActiveTabId"], inbound.data.projectActiveTabId);
            queryClient.setQueryData(["globalState", "chatActiveTabId"], inbound.data.chatActiveTabId);

            break;
        }

        case "create_project_tab": {
            // Create the sub-query for the new tab
            queryClient.setQueryData(["globalState", "projectTab", inbound.tabId], inbound.data);

            // Update settings to include the new tab ID in order
            queryClient.setQueryData<AppSettings | undefined>(
                ["globalState", "settings"],
                (prev: AppSettings | undefined) => prev ? {
                    ...prev,
                    projectTabIdOrder: [...prev.projectTabIdOrder, inbound.tabId],
                } : prev
            );

            // Update active tab ID
            queryClient.setQueryData(["globalState", "projectActiveTabId"], inbound.tabId);
            break;
        }

        case "update_project_tab":
        case "update_project_tab_partial": {
            // Update the sub-query for the specific tab
            queryClient.setQueryData(
                ["globalState", "projectTab", inbound.tabId],
                (prev: ProjectTabState | undefined) => ({
                    ...prev,
                    ...(inbound.type === "update_project_tab" ? inbound.data : inbound.partial),
                })
            );
            break;
        }

        case "delete_project_tab": {
            // Remove the sub-query for the deleted tab
            queryClient.removeQueries({ queryKey: ["globalState", "projectTab", inbound.tabId] });

            // Update settings to remove the tab ID from order
            queryClient.setQueryData<AppSettings | undefined>(
                ["globalState", "settings"],
                (prev: AppSettings | undefined) => prev ? {
                    ...prev,
                    projectTabIdOrder: prev.projectTabIdOrder.filter((id: string) => id !== inbound.tabId),
                } : prev
            );

            // Update active tab ID if needed
            queryClient.setQueryData<string | null>(
                ["globalState", "projectActiveTabId"],
                (currentActiveId) => {
                    if (currentActiveId === inbound.tabId) {
                        // Get all remaining tab IDs
                        const remainingTabs = queryClient.getQueriesData<ProjectTabState>({
                            queryKey: ["globalState", "projectTab"],
                        });
                        return remainingTabs.length > 0 ? remainingTabs[0][0][2] as string : null;
                    }
                    return currentActiveId;
                }
            );
            break;
        }

        case "set_active_project_tab": {
            queryClient.setQueryData(["globalState", "projectActiveTabId"], inbound.tabId);
            break;
        }

        case "create_project_tab_from_ticket": {
            // Create the sub-query for the new tab
            queryClient.setQueryData(["globalState", "projectTab", inbound.tabId], {
                ticketId: inbound.ticketId,
                ...inbound.data,
            });

            // Update settings to include the new tab ID in order
            queryClient.setQueryData<AppSettings | undefined>(
                ["globalState", "settings"],
                (prev: AppSettings | undefined) => prev ? {
                    ...prev,
                    projectTabIdOrder: [...prev.projectTabIdOrder, inbound.tabId],
                } : prev
            );

            // Update active tab ID
            queryClient.setQueryData(["globalState", "projectActiveTabId"], inbound.tabId);
            break;
        }

        case "create_chat_tab": {
            // Create the sub-query for the new chat tab
            queryClient.setQueryData(["globalState", "chatTab", inbound.tabId], inbound.data);

            // Update settings to include the new tab ID in order
            queryClient.setQueryData<AppSettings | undefined>(
                ["globalState", "settings"],
                (prev: AppSettings | undefined) => prev ? {
                    ...prev,
                    chatTabIdOrder: [...prev.chatTabIdOrder, inbound.tabId],
                } : prev
            );

            // Update active tab ID
            queryClient.setQueryData(["globalState", "chatActiveTabId"], inbound.tabId);
            break;
        }

        case "update_chat_tab":
        case "update_chat_tab_partial": {
            // Update the sub-query for the specific chat tab
            queryClient.setQueryData(
                ["globalState", "chatTab", inbound.tabId],
                (prev: ChatTabState | undefined) => ({
                    ...prev,
                    ...(inbound.type === "update_chat_tab" ? inbound.data : inbound.partial),
                })
            );
            break;
        }

        case "delete_chat_tab": {
            // Remove the sub-query for the deleted chat tab
            queryClient.removeQueries({ queryKey: ["globalState", "chatTab", inbound.tabId] });

            // Update settings to remove the tab ID from order
            queryClient.setQueryData<AppSettings | undefined>(
                ["globalState", "settings"],
                (prev: AppSettings | undefined) => prev ? {
                    ...prev,
                    chatTabIdOrder: prev.chatTabIdOrder.filter((id: string) => id !== inbound.tabId),
                } : prev
            );

            // Update active tab ID if needed
            queryClient.setQueryData<string | null>(
                ["globalState", "chatActiveTabId"],
                (currentActiveId: string | null | undefined) => {
                    if (currentActiveId === inbound.tabId) {
                        // Get all remaining tab IDs
                        const remainingTabs = queryClient.getQueriesData<ChatTabState>({
                            queryKey: ["globalState", "chatTab"],
                        });
                        return remainingTabs.length > 0 ? remainingTabs[0][0][2] as string : null;
                    }
                    return currentActiveId ?? null;
                }
            );
            break;
        }

        case "set_active_chat_tab": {
            queryClient.setQueryData(["globalState", "chatActiveTabId"], inbound.tabId);
            break;
        }

        case "update_settings":
        case "update_settings_partial": {
            queryClient.setQueryData<AppSettings | undefined>(
                ["globalState", "settings"],
                (prev: AppSettings | undefined) => prev ? {
                    ...prev,
                    ...(inbound.type === "update_settings" ? inbound.data : inbound.partial),
                } : prev
            );
            break;
        }

        case "update_theme": {
            queryClient.setQueryData<AppSettings | undefined>(
                ["globalState", "settings"],
                (prev: AppSettings | undefined) => prev ? {
                    ...prev,
                    theme: inbound.theme,
                } : prev
            );
            break;
        }

        case "update_provider": {
            queryClient.setQueryData<ProjectTabState | undefined>(
                ["globalState", "projectTab", inbound.tabId],
                (prev: ProjectTabState | undefined) => prev ? {
                    ...prev,
                    provider: inbound.provider,
                } : prev
            );
            break;
        }

        case "update_link_settings": {
            queryClient.setQueryData<ProjectTabState | undefined>(
                ["globalState", "projectTab", inbound.tabId],
                (prev: ProjectTabState | undefined) => prev ? {
                    ...prev,
                    linkSettings: inbound.settings,
                } : prev
            );
            break;
        }

        case "update_global_state_key": {
            const key = inbound.data.key;
            const partialValue = inbound.data.partial;

            // Handle each key type appropriately
            switch (key) {
                case "settings":
                    queryClient.setQueryData<AppSettings | undefined>(
                        ["globalState", "settings"],
                        (prev: AppSettings | undefined) => prev ? { ...prev, ...partialValue } : prev
                    );
                    break;
                case "projectTabs":
                    Object.entries(partialValue as ProjectTabsStateRecord).forEach(([tabId, tabData]) => {
                        queryClient.setQueryData(
                            ["globalState", "projectTab", tabId],
                            (prev: ProjectTabState | undefined) => ({ ...prev, ...tabData })
                        );
                    });
                    break;
                case "chatTabs":
                    Object.entries(partialValue as ChatTabsStateRecord).forEach(([tabId, tabData]) => {
                        queryClient.setQueryData(
                            ["globalState", "chatTab", tabId],
                            (prev: ChatTabState | undefined) => ({ ...prev, ...tabData })
                        );
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

// -------------------------------------------------------------------
// Step 3: Create the actual provider
// -------------------------------------------------------------------
export function GlobalStateProvider({ children }: { children: ReactNode }) {
    const queryClient = useQueryClient();

    // 1) Use BNK's manager for WS connection
    const { isOpen, manager } = useClientWebSocket<InboundMessage, OutboundMessage>({
        config: {
            url: SERVER_WS_ENDPOINT,
            debug: true,
            validateIncomingMessage,
            autoReconnect: true,
            reconnectIntervalMs: 500,
            maxReconnectAttempts: 500,
            messageHandlers: {
                // For each known message type, we apply updates to queryClient
                state_update: (msg) => applyInboundToQueryClient(msg, queryClient),
                initial_state: (msg) => applyInboundToQueryClient(msg, queryClient),
                create_project_tab: (msg) => applyInboundToQueryClient(msg, queryClient),
                update_project_tab: (msg) => applyInboundToQueryClient(msg, queryClient),
                update_project_tab_partial: (msg) => applyInboundToQueryClient(msg, queryClient),
                delete_project_tab: (msg) => applyInboundToQueryClient(msg, queryClient),
                set_active_project_tab: (msg) => applyInboundToQueryClient(msg, queryClient),
                create_project_tab_from_ticket: (msg) => applyInboundToQueryClient(msg, queryClient),
                create_chat_tab: (msg) => applyInboundToQueryClient(msg, queryClient),
                update_chat_tab: (msg) => applyInboundToQueryClient(msg, queryClient),
                update_chat_tab_partial: (msg) => applyInboundToQueryClient(msg, queryClient),
                delete_chat_tab: (msg) => applyInboundToQueryClient(msg, queryClient),
                set_active_chat_tab: (msg) => applyInboundToQueryClient(msg, queryClient),
                update_settings: (msg) => applyInboundToQueryClient(msg, queryClient),
                update_settings_partial: (msg) => applyInboundToQueryClient(msg, queryClient),
                update_theme: (msg) => applyInboundToQueryClient(msg, queryClient),
                update_provider: (msg) => applyInboundToQueryClient(msg, queryClient),
                update_link_settings: (msg) => applyInboundToQueryClient(msg, queryClient),
                update_global_state_key: (msg) => applyInboundToQueryClient(msg, queryClient),
            },
        },
    });

    // 2) Provide { manager, isOpen } to child components
    return (
        <GlobalStateContext.Provider value={{ manager, isOpen }}>
            {children}
        </GlobalStateContext.Provider>
    );
}