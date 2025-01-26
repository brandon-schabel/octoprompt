import { createContext, useContext, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useClientWebSocket } from "@bnk/react-websocket-manager";
import type { ClientWebSocketManager } from "@bnk/client-websocket-manager";

import { SERVER_WS_ENDPOINT } from "@/constants/server-constants";
import {
    type InboundMessage,
    type OutboundMessage,
    type GlobalState,
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
const ProjectTabStateContext = createContext<GlobalStateContextValue | null>(null);

export function useProjectTabContext(): GlobalStateContextValue {
    const ctx = useContext(ProjectTabStateContext);
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
        // Project tab messages
        // ------------------
        case "create_project_tab": {
            queryClient.setQueryData(["globalState", "projectTab", inbound.tabId], inbound.data);
            queryClient.setQueryData<GlobalState | undefined>(["globalState"], (prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    settings: {
                        ...prev.settings,
                        projectTabIdOrder: [...prev.settings.projectTabIdOrder, inbound.tabId],
                    },
                    projectActiveTabId: inbound.tabId,
                };
            });
            break;
        }

        case "update_project_tab":
        case "update_project_tab_partial": {
            queryClient.setQueryData(["globalState", "projectTab", inbound.tabId], (prev: any) => ({
                ...prev,
                ...(inbound.type === "update_project_tab" ? inbound.data : inbound.partial),
            }));
            break;
        }

        case "delete_project_tab": {
            queryClient.removeQueries({ queryKey: ["globalState", "projectTab", inbound.tabId] });
            queryClient.setQueryData<GlobalState | undefined>(["globalState"], (prev) => {
                if (!prev) return prev;
                const newState: GlobalState = { ...prev };
                // remove tabId from tab order
                newState.settings = {
                    ...newState.settings,
                    projectTabIdOrder: newState.settings.projectTabIdOrder.filter(
                        (id) => id !== inbound.tabId
                    ),
                };
                // if active was removed, pick another
                if (prev.projectActiveTabId === inbound.tabId) {
                    const remaining = Object.keys(prev.projectTabs).filter((id) => id !== inbound.tabId);
                    newState.projectActiveTabId = remaining.length > 0 ? remaining[0] : null;
                }
                return newState;
            });
            break;
        }

        case "set_active_project_tab": {
            queryClient.setQueryData<GlobalState | undefined>(["globalState"], (prev) =>
                prev ? { ...prev, projectActiveTabId: inbound.tabId } : prev
            );
            break;
        }

        case "create_project_tab_from_ticket": {
            queryClient.setQueryData(["globalState", "projectTab", inbound.tabId], {
                ticketId: inbound.ticketId,
                ...inbound.data,
            });
            queryClient.setQueryData<GlobalState | undefined>(["globalState"], (prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    settings: {
                        ...prev.settings,
                        projectTabIdOrder: [...prev.settings.projectTabIdOrder, inbound.tabId],
                    },
                    projectActiveTabId: inbound.tabId,
                };
            });
            break;
        }
        
        case "update_provider": {
            queryClient.setQueryData(["globalState", "projectTab", inbound.tabId], (prev: any) =>
                prev ? { ...prev, provider: inbound.provider } : prev
            );
            break;
        }

        case "update_link_settings": {
            queryClient.setQueryData(["globalState", "projectTab", inbound.tabId], (prev: any) =>
                prev ? { ...prev, linkSettings: inbound.settings } : prev
            );
            break;
        }
    }
}

// -------------------------------------------------------------------
// Step 3: Create the actual provider
// -------------------------------------------------------------------
export function ProjectTabStateProvider({ children }: { children: ReactNode }) {
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
                create_project_tab: (msg) => applyInboundToQueryClient(msg, queryClient),
                update_project_tab: (msg) => applyInboundToQueryClient(msg, queryClient),
                update_project_tab_partial: (msg) => applyInboundToQueryClient(msg, queryClient),
                delete_project_tab: (msg) => applyInboundToQueryClient(msg, queryClient),
                set_active_project_tab: (msg) => applyInboundToQueryClient(msg, queryClient),
            },
        },
    });

    // 2) Provide { manager, isOpen } to child components
    return (
        <ProjectTabStateContext.Provider value={{ manager, isOpen }
        }>
            {children}
        </ProjectTabStateContext.Provider>
    );
}