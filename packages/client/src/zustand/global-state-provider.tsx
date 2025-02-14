import { createContext, useContext, ReactNode, useState } from "react";
import { useSyncClient } from "@bnk/sync-react";
import type { SyncClientManager } from "@bnk/sync-client";
import { SERVER_WS_ENDPOINT } from "@/constants/server-constants";
import { validateIncomingMessage, InboundMessage, OutboundMessage } from "shared";

import { handleIncomingWebsocketMessage } from "./websocket-subscription"; 

/**
 * Minimal context so components can know:
 *  - isOpen: are we connected to the WebSocket?
 *  - hasReceivedInitialState: have we received the initial_state message?
 */
interface GlobalStateContextValue {
    manager: SyncClientManager<InboundMessage, OutboundMessage>;
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

export function GlobalStateProvider({ children }: { children: ReactNode }) {
    // This tracks if we’ve received the server’s initial_state event
    const [hasReceivedInitialState, setHasReceivedInitialState] = useState(false);

    // BNK’s manager
    const { isOpen, manager } = useSyncClient<InboundMessage, OutboundMessage>({
        config: {
            url: SERVER_WS_ENDPOINT,
            validateIncomingMessage,
            autoReconnect: true,
            reconnectIntervalMs: 500,
            maxReconnectAttempts: 500,
            messageHandlers: {
                // For each inbound message type:
                state_update: (msg) => handleMsg(msg),
                initial_state: (msg) => {
                    handleMsg(msg);
                    setHasReceivedInitialState(true);
                },
                // optionally list them out explicitly or use a fallback handler
                create_project_tab: (msg) => handleMsg(msg),
                update_project_tab: (msg) => handleMsg(msg),
                update_project_tab_partial: (msg) => handleMsg(msg),
                delete_project_tab: (msg) => handleMsg(msg),
                set_active_project_tab: (msg) => handleMsg(msg),
                create_project_tab_from_ticket: (msg) => handleMsg(msg),
                create_chat_tab: (msg) => handleMsg(msg),
                update_chat_tab: (msg) => handleMsg(msg),
                update_chat_tab_partial: (msg) => handleMsg(msg),
                delete_chat_tab: (msg) => handleMsg(msg),
                set_active_chat_tab: (msg) => handleMsg(msg),
                update_settings: (msg) => handleMsg(msg),
                update_settings_partial: (msg) => handleMsg(msg),
                update_theme: (msg) => handleMsg(msg),
                update_provider: (msg) => handleMsg(msg),
                update_link_settings: (msg) => handleMsg(msg),
                update_global_state_key: (msg) => handleMsg(msg),
            },
        },
    });

    // Helper that calls the Zustand subscription function
    const handleMsg = (msg: InboundMessage) => {
        handleIncomingWebsocketMessage(msg);
    };

    return (
        <GlobalStateContext.Provider value={{ manager, isOpen, hasReceivedInitialState }}>
            {children}
        </GlobalStateContext.Provider>
    );
}