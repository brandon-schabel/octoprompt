import React, {
    createContext,
    useMemo,
    useContext,
    type ReactNode,
    useState,
    SetStateAction,
    Dispatch,
} from "react";
import {
    useWebSocketClient,
    WebSocketClientProvider,
    type ClientWebSocketManagerConfig,
} from "@bnk/websocket-manager-react";
import {
    globalStateSchema,
    createInitialGlobalState
} from "shared";
import type {
    InboundMessage,
    GlobalState,
} from "shared";
import { SERVER_WS_ENDPOINT } from "@/constants/server-constants";


const createReactMessageHandlers = ({
    setGlobalState,
}: {
    setGlobalState: React.Dispatch<React.SetStateAction<GlobalState>>
}): ClientWebSocketManagerConfig<InboundMessage, InboundMessage>["messageHandlers"] => {
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
                copy.projectTabs[msg.tabId] = msg.data;
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
                delete copy.projectTabs[msg.tabId];
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
                copy.chatTabs[msg.tabId] = msg.data;
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
                delete copy.chatTabs[msg.tabId];
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


/**
 * We store these items in context so children can access them.
 */
interface BaseContextValue {
    globalState: GlobalState;
    wsReady: boolean;
    setWsReady: Dispatch<SetStateAction<boolean>>;
    /**
     * The entire BNK manager config for the WebSocket, so children (optional)
     * can see the URL, debug mode, or override messageHandlers if desired.
     */
    wsConfig: ClientWebSocketManagerConfig<InboundMessage, InboundMessage>;
}

/**
 * We’ll store the base global state in here so any child can call
 * `useContext(BaseGlobalStateContext)`.
 */
const BaseGlobalStateContext = createContext<BaseContextValue | null>(null);

export interface GlobalStateWebsocketProviderProps {
    children: ReactNode;
}

/**
 * This is the top-level provider that:
 *  1. Maintains `globalState` in a React `useState`.
 *  2. Sets up the BNK `WebSocketClientProvider` with the derived `wsConfig`.
 *  3. Provides a context value containing the globalState, plus `wsReady` flags.
 */
export function GlobalStateWebsocketProvider({
    children
}: GlobalStateWebsocketProviderProps) {
    // 1) Inbound state + WS readiness
    const [globalState, setGlobalState] = useState<GlobalState>(
        createInitialGlobalState()
    );
    const [wsReady, setWsReady] = useState(false);

    // 2) Generate handlers once, using React’s memo
    const messageHandlers = useMemo<
        ClientWebSocketManagerConfig<InboundMessage, InboundMessage>["messageHandlers"]
    >(() => createReactMessageHandlers({ setGlobalState }), [setGlobalState]);

    // 3) Create a BNK config object to pass to the WebSocketClientProvider
    const wsConfig = useMemo<ClientWebSocketManagerConfig<InboundMessage, InboundMessage>>(
        () => ({
            url: SERVER_WS_ENDPOINT,
            debug: false,
            messageHandlers,
            onOpen: () => {
                setWsReady(true);
                console.log("[Client] WebSocket opened!");
            },
            onClose: () => {
                setWsReady(false);
                console.log("[Client] WebSocket closed!");
            },
            onError: (err) => {
                console.error("[Client] WebSocket error:", err);
            }
        }),
        [messageHandlers]
    );

    // 4) We provide BNK’s WebSocket context, plus our own base context
    //    so that any descendant can call `useGlobalState()`.
    const baseValue: BaseContextValue = {
        globalState,
        wsReady,
        setWsReady,
        wsConfig
    };

    return (
        <WebSocketClientProvider<InboundMessage, InboundMessage> url={wsConfig.url} debug={wsConfig.debug} messageHandlers={wsConfig.messageHandlers} onOpen={wsConfig.onOpen} onClose={wsConfig.onClose} onError={wsConfig.onError}>
            <BaseGlobalStateContext.Provider value={baseValue}>
                {children}
            </BaseGlobalStateContext.Provider>
        </WebSocketClientProvider>
    );
}

/**
 * Convenience hook to access the global state, `wsReady`, etc.
 */
export function useGlobalStateContext() {
    const ctx = useContext(BaseGlobalStateContext);
    if (!ctx) {
        throw new Error(
            "useGlobalStateContext must be used within <GlobalStateConfigWebSocketProvider>."
        );
    }
    return ctx;
}

/**
 * If you only need to read `globalState` in a child component:
 */
export function useGlobalState() {
    return useGlobalStateContext().globalState;
}

/**
 * If you want to get at BNK’s WebSocket instance or call `sendMessage`, for example:
 */
export function useGlobalWebSocketClient() {
    return useWebSocketClient<InboundMessage, InboundMessage>();
}