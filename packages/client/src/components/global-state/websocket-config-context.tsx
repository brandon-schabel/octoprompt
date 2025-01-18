import React, {
    createContext,
    useMemo,
    useState,
    useRef,
    useContext,
} from "react";
import { ClientWebSocketManager, ClientWebSocketManagerConfig } from "@bnk/client-websocket-manager"
import {
    globalStateSchema,
    createInitialGlobalState
} from "shared";
import type {
    InboundMessage,
    GlobalState,
} from "shared";
import { SERVER_WS_ENDPOINT } from "@/constants/server-constants";
import { useClientWebSocket } from "@bnk/react-websocket-manager";

export type GlobalWebSocketConfig = ClientWebSocketManagerConfig<InboundMessage, InboundMessage>
export type GlobalMessageHandlers = GlobalWebSocketConfig["messageHandlers"]


const createReactMessageHandlers = ({
    setGlobalState,
}: {
    setGlobalState: React.Dispatch<React.SetStateAction<GlobalState>>
}): GlobalMessageHandlers => {
    return ({
        /**
         * Outbound from server -> client, updates entire GlobalState
         */
        state_update: (msg) => {
            const validated = globalStateSchema.parse(msg.data);
            setGlobalState(validated);
        },
        /**
         * If your server emits an initial_state type
         * (for example, on first connection), handle it here.
         */
        initial_state: (msg) => {
            const validated = globalStateSchema.parse(msg.data);
            setGlobalState(validated);
        },

        /**
         * Project tab: create a new project tab locally
         */
        create_project_tab: (msg) => {
            setGlobalState((prev) => {
                const copy = { ...prev };
                // 1) Insert the new tab
                copy.projectTabs[msg.tabId] = msg.data;

                // 2) Append the new tab ID to settings.projectTabIdOrder
                copy.settings.projectTabIdOrder = [...copy.settings.projectTabIdOrder, msg.tabId];

                // 3) Set newly created tab as active
                copy.projectActiveTabId = msg.tabId;

                return globalStateSchema.parse(copy);
            });
        },


        /**
         * Project tab: fully update (overwrite) a project tab
         */
        update_project_tab: (msg) => {
            setGlobalState((prev) => {
                if (!prev.projectTabs[msg.tabId]) {
                    console.warn(
                        `Cannot update project tab: tab "${msg.tabId}" not found.`
                    );
                    return prev;
                }
                const copy = { ...prev };
                copy.projectTabs[msg.tabId] = {
                    ...copy.projectTabs[msg.tabId],
                    ...msg.data,
                };
                return globalStateSchema.parse(copy);
            });
        },

        /**
         * Project tab: partially update a project tab
         */
        update_project_tab_partial: (msg) => {
            setGlobalState((prev) => {
                if (!prev.projectTabs[msg.tabId]) {
                    console.warn(
                        `Cannot partial-update project tab: tab "${msg.tabId}" not found.`
                    );
                    return prev;
                }
                const copy = { ...prev };
                copy.projectTabs[msg.tabId] = {
                    ...copy.projectTabs[msg.tabId],
                    ...msg.partial,
                };
                return globalStateSchema.parse(copy);
            });
        },

        /**
         * Project tab: delete a project tab
         */
        delete_project_tab: (msg) => {
            setGlobalState((prev) => {
                if (!prev.projectTabs[msg.tabId]) {
                    console.warn(
                        `Cannot delete project tab: tab "${msg.tabId}" not found.`
                    );
                    return prev;
                }
                const copy = { ...prev };

                // 1) Remove the tab from settings.projectTabIdOrder
                copy.settings.projectTabIdOrder = copy.settings.projectTabIdOrder.filter(
                    (id: string) => id !== msg.tabId
                );

                // 2) Delete the actual tab
                delete copy.projectTabs[msg.tabId];

                // 3) If that was the active tab, set a new one if possible
                if (copy.projectActiveTabId === msg.tabId) {
                    const remainingTabs = Object.keys(copy.projectTabs);
                    copy.projectActiveTabId =
                        remainingTabs.length > 0 ? remainingTabs[0] : null;
                }

                return globalStateSchema.parse(copy);
            });
        },

        /**
         * Project tab: set which tab is active
         */
        set_active_project_tab: (msg) => {
            console.log("[Client] set_active_project_tab", msg);
            setGlobalState((prev) => {
                if (!prev.projectTabs[msg.tabId]) {
                    console.warn(
                        `Cannot set active project tab: tab "${msg.tabId}" not found.`
                    );
                    return prev;
                }
                const copy = { ...prev };
                copy.projectActiveTabId = msg.tabId;
                return globalStateSchema.parse(copy);
            });
        },

        /**
         * Chat tab: create a new chat tab locally
         */
        create_chat_tab: (msg) => {
            setGlobalState((prev) => {
                const copy = { ...prev };
                // 1) Insert the new chat tab
                copy.chatTabs[msg.tabId] = msg.data;

                // 2) Append it to settings.chatTabIdOrder
                copy.settings.chatTabIdOrder = [...copy.settings.chatTabIdOrder, msg.tabId];

                // 3) Set as the active chat tab
                copy.chatActiveTabId = msg.tabId;

                return globalStateSchema.parse(copy);
            });
        },

        /**
         * Chat tab: fully update (overwrite) a chat tab
         */
        update_chat_tab: (msg) => {
            setGlobalState((prev) => {
                if (!prev.chatTabs[msg.tabId]) {
                    console.warn(
                        `Cannot update chat tab: tab "${msg.tabId}" not found.`
                    );
                    return prev;
                }
                const copy = { ...prev };
                copy.chatTabs[msg.tabId] = {
                    ...copy.chatTabs[msg.tabId],
                    ...msg.data,
                };
                return globalStateSchema.parse(copy);
            });
        },

        /**
         * Chat tab: partially update a chat tab
         */
        update_chat_tab_partial: (msg) => {
            setGlobalState((prev) => {
                if (!prev.chatTabs[msg.tabId]) {
                    console.warn(
                        `Cannot partial-update chat tab: tab "${msg.tabId}" not found.`
                    );
                    return prev;
                }
                const copy = { ...prev };
                copy.chatTabs[msg.tabId] = {
                    ...copy.chatTabs[msg.tabId],
                    ...msg.partial,
                };
                return globalStateSchema.parse(copy);
            });
        },

        /**
         * Chat tab: delete a chat tab
         */

        delete_chat_tab: (msg) => {
            setGlobalState((prev) => {
                if (!prev.chatTabs[msg.tabId]) {
                    console.warn(
                        `Cannot delete chat tab: tab "${msg.tabId}" not found.`
                    );
                    return prev;
                }
                const copy = { ...prev };

                // 1) Remove from settings.chatTabIdOrder
                copy.settings.chatTabIdOrder = copy.settings.chatTabIdOrder.filter(
                    (id: string) => id !== msg.tabId
                );

                // 2) Delete the actual tab
                delete copy.chatTabs[msg.tabId];

                // 3) If that was the active tab, pick a new one
                if (copy.chatActiveTabId === msg.tabId) {
                    const remainingTabs = Object.keys(copy.chatTabs);
                    copy.chatActiveTabId =
                        remainingTabs.length > 0 ? remainingTabs[0] : null;
                }

                return globalStateSchema.parse(copy);
            });
        },

        /**
         * Chat tab: set which tab is active
         */
        set_active_chat_tab: (msg) => {
            setGlobalState((prev) => {
                if (!prev.chatTabs[msg.tabId]) {
                    console.warn(
                        `Cannot set active chat tab: tab "${msg.tabId}" not found.`
                    );
                    return prev;
                }
                const copy = { ...prev };
                copy.chatActiveTabId = msg.tabId;
                return globalStateSchema.parse(copy);
            });
        },

        /**
         * Generic message to update a top-level key in GlobalState.
         * For example: { key: "settings", partial: { theme: 'dark' } }
         */
        update_global_state_key: (msg) => {
            setGlobalState((prev) => {
                const copy = { ...prev };
                const key = msg.data.key;
                const partialValue = msg.data.partial;

                // If the existing value is an object, do a shallow merge.
                // Otherwise, just replace.
                const currentValue = copy[key];
                if (typeof currentValue === "object" && currentValue !== null) {
                    // @ts-expect-error: Type assertion is necessary here
                    copy[key] = { ...currentValue, ...partialValue } as any;
                } else {
                    // @ts-expect-error: Type assertion is necessary here
                    copy[key] = partialValue as any;
                }

                return globalStateSchema.parse(copy);
            });
        },
    })
}


interface BaseContextValue {
    globalState: GlobalState;
    isOpen: boolean;
    wsClient: ClientWebSocketManager<InboundMessage, InboundMessage>;
}

const BaseGlobalStateContext = createContext<BaseContextValue | null>(null);

export function GlobalStateWebsocketProvider({ children }: { children: React.ReactNode }) {
    const [globalState, setGlobalState] = useState<GlobalState>(createInitialGlobalState());
    const messageHandlers = useMemo(() => createReactMessageHandlers({ setGlobalState }), [setGlobalState]);
    const { isOpen, manager } = useClientWebSocket<InboundMessage, InboundMessage>({
        config: {
            url: SERVER_WS_ENDPOINT,
            messageHandlers,
            autoReconnect: true,
            reconnectIntervalMs: 500,
            maxReconnectAttempts: 500,
        },

    })

    const baseValue: BaseContextValue = useMemo(() => {
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

export function useGlobalStateContext() {
    const context = useContext(BaseGlobalStateContext);
    if (!context) {
        throw new Error("useGlobalStateContext must be used within a GlobalStateWebsocketProvider");
    }
    return context;
}