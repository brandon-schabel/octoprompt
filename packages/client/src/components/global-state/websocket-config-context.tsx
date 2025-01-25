import React, { createContext, useContext, useMemo, useState } from "react";
import {
    ClientWebSocketManagerConfig,
    ClientWebSocketManager,
} from "@bnk/client-websocket-manager";
import { useClientWebSocket } from "@bnk/react-websocket-manager";

import {
    InboundMessage,
    validateIncomingMessage,
    globalStateSchema,
    createInitialGlobalState,
    type GlobalState,
} from "shared";

import { SERVER_WS_ENDPOINT } from "@/constants/server-constants";

interface BaseContextValue {
    globalState: GlobalState;
    isOpen: boolean;
    wsClient: ClientWebSocketManager<InboundMessage, InboundMessage>;
}

const BaseGlobalStateContext = createContext<BaseContextValue | null>(null);

export function GlobalStateWebsocketProvider({ children }: { children: React.ReactNode }) {
    const [globalState, setGlobalState] = useState<GlobalState>(createInitialGlobalState());

    const clientMessageHandlers: ClientWebSocketManagerConfig<InboundMessage, InboundMessage>["messageHandlers"] =
        useMemo(() => {
            return {
                // ------------------
                // Full or partial state updates
                // ------------------
                state_update: (msg) => {
                    const validated = globalStateSchema.parse(msg.data);
                    setGlobalState(validated);
                },
                initial_state: (msg) => {
                    const validated = globalStateSchema.parse(msg.data);
                    setGlobalState(validated);
                },

                // ------------------
                // Project tab messages
                // ------------------
                create_project_tab: (msg) => {
                    setGlobalState((prev) => {
                        const copy = structuredClone(prev);
                        copy.projectTabs[msg.tabId] = msg.data;
                        copy.settings.projectTabIdOrder.push(msg.tabId);
                        copy.projectActiveTabId = msg.tabId;
                        return globalStateSchema.parse(copy);
                    });
                },
                update_project_tab: (msg) => {
                    setGlobalState((prev) => {
                        if (!prev.projectTabs[msg.tabId]) {
                            console.warn(`Cannot update project tab: tab "${msg.tabId}" not found.`);
                            return prev;
                        }
                        const copy = structuredClone(prev);
                        copy.projectTabs[msg.tabId] = {
                            ...copy.projectTabs[msg.tabId],
                            ...msg.data,
                        };
                        return globalStateSchema.parse(copy);
                    });
                },
                update_project_tab_partial: (msg) => {
                    setGlobalState((prev) => {
                        if (!prev.projectTabs[msg.tabId]) {
                            console.warn(
                                `Cannot partial-update project tab: tab "${msg.tabId}" not found.`
                            );
                            return prev;
                        }
                        const copy = structuredClone(prev);
                        copy.projectTabs[msg.tabId] = {
                            ...copy.projectTabs[msg.tabId],
                            ...msg.partial,
                        };
                        return globalStateSchema.parse(copy);
                    });
                },
                delete_project_tab: (msg) => {
                    setGlobalState((prev) => {
                        if (!prev.projectTabs[msg.tabId]) {
                            console.warn(`Cannot delete project tab: tab "${msg.tabId}" not found.`);
                            return prev;
                        }
                        const copy = structuredClone(prev);
                        copy.settings.projectTabIdOrder = copy.settings.projectTabIdOrder.filter(
                            (id) => id !== msg.tabId
                        );
                        delete copy.projectTabs[msg.tabId];
                        if (copy.projectActiveTabId === msg.tabId) {
                            const remaining = Object.keys(copy.projectTabs);
                            copy.projectActiveTabId = remaining.length > 0 ? remaining[0] : null;
                        }
                        return globalStateSchema.parse(copy);
                    });
                },
                set_active_project_tab: (msg) => {
                    setGlobalState((prev) => {
                        if (!prev.projectTabs[msg.tabId]) {
                            console.warn(
                                `Cannot set active project tab: tab "${msg.tabId}" not found.`
                            );
                            return prev;
                        }
                        const copy = structuredClone(prev);
                        copy.projectActiveTabId = msg.tabId;
                        return globalStateSchema.parse(copy);
                    });
                },
                create_project_tab_from_ticket: (msg) => {
                    setGlobalState((prev) => {
                        const copy = structuredClone(prev);
                        // @ts-expect-error: TODO: fix this
                        copy.projectTabs[msg.tabId] = {
                            ticketId: msg.ticketId,
                            ...msg.data,
                        };
                        copy.settings.projectTabIdOrder.push(msg.tabId);
                        copy.projectActiveTabId = msg.tabId;
                        return globalStateSchema.parse(copy);
                    });
                },

                // ------------------
                // Chat tab messages
                // ------------------
                create_chat_tab: (msg) => {
                    setGlobalState((prev) => {
                        const copy = structuredClone(prev);
                        copy.chatTabs[msg.tabId] = msg.data;
                        copy.settings.chatTabIdOrder.push(msg.tabId);
                        copy.chatActiveTabId = msg.tabId;
                        return globalStateSchema.parse(copy);
                    });
                },
                update_chat_tab: (msg) => {
                    setGlobalState((prev) => {
                        if (!prev.chatTabs[msg.tabId]) {
                            console.warn(`Cannot update chat tab: tab "${msg.tabId}" not found.`);
                            return prev;
                        }
                        const copy = structuredClone(prev);
                        copy.chatTabs[msg.tabId] = {
                            ...copy.chatTabs[msg.tabId],
                            ...msg.data,
                        };
                        return globalStateSchema.parse(copy);
                    });
                },
                update_chat_tab_partial: (msg) => {
                    setGlobalState((prev) => {
                        if (!prev.chatTabs[msg.tabId]) {
                            console.warn(
                                `Cannot partial-update chat tab: tab "${msg.tabId}" not found.`
                            );
                            return prev;
                        }
                        const copy = structuredClone(prev);
                        copy.chatTabs[msg.tabId] = {
                            ...copy.chatTabs[msg.tabId],
                            ...msg.partial,
                        };
                        return globalStateSchema.parse(copy);
                    });
                },
                delete_chat_tab: (msg) => {
                    setGlobalState((prev) => {
                        if (!prev.chatTabs[msg.tabId]) {
                            console.warn(`Cannot delete chat tab: tab "${msg.tabId}" not found.`);
                            return prev;
                        }
                        const copy = structuredClone(prev);
                        copy.settings.chatTabIdOrder = copy.settings.chatTabIdOrder.filter(
                            (id) => id !== msg.tabId
                        );
                        delete copy.chatTabs[msg.tabId];
                        if (copy.chatActiveTabId === msg.tabId) {
                            const remaining = Object.keys(copy.chatTabs);
                            copy.chatActiveTabId = remaining.length > 0 ? remaining[0] : null;
                        }
                        return globalStateSchema.parse(copy);
                    });
                },
                set_active_chat_tab: (msg) => {
                    setGlobalState((prev) => {
                        if (!prev.chatTabs[msg.tabId]) {
                            console.warn(
                                `Cannot set active chat tab: tab "${msg.tabId}" not found.`
                            );
                            return prev;
                        }
                        const copy = structuredClone(prev);
                        copy.chatActiveTabId = msg.tabId;
                        return globalStateSchema.parse(copy);
                    });
                },

                // ------------------
                // Generic key update in global state
                // ------------------
                update_global_state_key: (msg) => {
                    setGlobalState((prev) => {
                        const copy = structuredClone(prev);
                        const key = msg.data.key as keyof GlobalState;
                        const partialValue = msg.data.partial;
                        const current = copy[key];
                        if (current && typeof current === "object") {
                            // @ts-expect-error: TODO: fix this
                            copy[key] = { ...current, ...partialValue };
                        } else {
                            // @ts-expect-error: TODO: fix this
                            copy[key] = partialValue;
                        }
                        return globalStateSchema.parse(copy);
                    });
                },

                // ------------------
                // Settings updates
                // ------------------
                update_settings: (msg) => {
                    setGlobalState((prev) => {
                        const copy = structuredClone(prev);
                        copy.settings = msg.data;
                        return globalStateSchema.parse(copy);
                    });
                },
                update_settings_partial: (msg) => {
                    setGlobalState((prev) => {
                        const copy = structuredClone(prev);
                        copy.settings = {
                            ...copy.settings,
                            ...msg.partial,
                        };
                        return globalStateSchema.parse(copy);
                    });
                },
                update_theme: (msg) => {
                    setGlobalState((prev) => {
                        const copy = structuredClone(prev);
                        copy.settings.theme = msg.theme;
                        return globalStateSchema.parse(copy);
                    });
                },

                // ------------------
                // Provider, link settings
                // ------------------
                update_provider: (msg) => {
                    setGlobalState((prev) => {
                        const copy = structuredClone(prev);
                        const tab = copy.projectTabs[msg.tabId];
                        if (!tab) {
                            console.warn(`Cannot update provider: tab "${msg.tabId}" not found.`);
                            return prev;
                        }
                        copy.projectTabs[msg.tabId] = {
                            ...tab,
                            provider: msg.provider,
                        };
                        return globalStateSchema.parse(copy);
                    });
                },
                update_link_settings: (msg) => {
                    setGlobalState((prev) => {
                        const copy = structuredClone(prev);
                        const tab = copy.projectTabs[msg.tabId];
                        if (!tab) {
                            console.warn(`Cannot update link settings: tab "${msg.tabId}" not found.`);
                            return prev;
                        }
                        copy.projectTabs[msg.tabId] = {
                            ...tab,
                            linkSettings: msg.settings,
                        };
                        return globalStateSchema.parse(copy);
                    });
                },
            };
        }, []);

    // Hook up BNK manager
    const { isOpen, manager } = useClientWebSocket<InboundMessage, InboundMessage>({
        config: {
            url: SERVER_WS_ENDPOINT,
            messageHandlers: clientMessageHandlers,
            validateIncomingMessage,
            autoReconnect: true,
            reconnectIntervalMs: 500,
            maxReconnectAttempts: 500,
        },
    });

    const baseValue = useMemo(() => {
        if (!manager) {
            throw new Error("Manager not initialized");
        }
        return {
            globalState,
            isOpen,
            wsClient: manager,
        };
    }, [globalState, isOpen, manager]);

    return (
        <BaseGlobalStateContext.Provider value={baseValue}>
            {children}
        </BaseGlobalStateContext.Provider>
    );
}

export function useGlobalStateContext(): BaseContextValue {
    const ctx = useContext(BaseGlobalStateContext);
    if (!ctx) {
        throw new Error("useGlobalStateContext must be used within GlobalStateWebsocketProvider");
    }
    return ctx;
}