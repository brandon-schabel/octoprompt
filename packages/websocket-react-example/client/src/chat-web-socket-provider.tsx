import React, { useState } from "react";
import {
    WebSocketClientProvider,
    type ClientWebSocketManagerConfig,
} from "@bnk/websocket-manager-react";
import {
    IncomingServerMessage,
    OutgoingClientMessage,
} from "shared";

/**
 * We'll store our chat log in React state. The server will send us 
 * either an `initial_state` or `state_update` message, 
 * each containing { messageLog: string[] } data.
 */
export function ChatWebSocketProvider({ children }: { children: React.ReactNode }) {
    const [messageLog, setMessageLog] = useState<string[]>([]);

    /**
     * This type ensures we only allow known message types:
     * "initial_state" | "state_update"
     */
    const messageHandlers: ClientWebSocketManagerConfig<IncomingServerMessage, OutgoingClientMessage>["messageHandlers"] = {

        // On initial_state, the server provides the full ChatAppState
        initial_state: (msg) => {
            // msg is `Extract<IncomingServerMessage, { type: 'initial_state' }>`
            setMessageLog(msg.data.messageLog);
        },
        // On state_update, the server has appended new messages
        state_update: (msg) => {
            // msg is `Extract<IncomingServerMessage, { type: 'state_update' }>`
            setMessageLog(msg.data.messageLog);
        },
    };

    /**
     * For the client->server messages, we can define them below or inside other components.
     * Example: sending a new chat message of type = "chat".
     */

    // Our config object, passed to WebSocketClientProvider
    const wsConfig: ClientWebSocketManagerConfig<IncomingServerMessage, OutgoingClientMessage> = {
        url: "ws://localhost:3007/ws",
        debug: true,
        messageHandlers,
        onOpen: () => {
            console.log("[Client] WebSocket opened!");
        },
        onClose: () => {
            console.log("[Client] WebSocket closed");
        },
        onError: (err) => {
            console.error("[Client] WebSocket error:", err);
        },
    };

    return (
        <WebSocketClientProvider<IncomingServerMessage, OutgoingClientMessage> {...wsConfig}>
            <MessageLogContext.Provider value={{ messageLog, setMessageLog }}>
                {children}
            </MessageLogContext.Provider>
        </WebSocketClientProvider>
    );
}

/**
 * Expose messageLog via context so children can read/update it easily.
 */
interface IMessageLogContext {
    messageLog: string[];
    setMessageLog: React.Dispatch<React.SetStateAction<string[]>>;
}
export const MessageLogContext = React.createContext<IMessageLogContext>({
    messageLog: [],
    setMessageLog: () => { }
});