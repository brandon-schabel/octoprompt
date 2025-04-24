import { createContext, useContext, ReactNode, useState, useRef, useEffect } from "react";
import { useSyncClient } from "@bnk/sync-react";
import type { SyncClientManager } from "@bnk/sync-client";
import { SERVER_WS_ENDPOINT } from "@/constants/server-constants";
import { validateIncomingMessage, InboundMessage, OutboundMessage } from "shared";

import { handleIncomingWebsocketMessage } from "./websocket-subscription";

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

// Time between processing batches of messages (in ms)
const BATCH_PROCESS_INTERVAL = 50; // Keep or adjust as needed

export function GlobalStateProvider({ children }: { children: ReactNode }) {
    const [hasReceivedInitialState, setHasReceivedInitialState] = useState(false);
    const messageQueueRef = useRef<InboundMessage[]>([]);
    const isProcessingRef = useRef(false);

    // processBatchedMessages - Updated to reflect potential changes in handleIncomingWebsocketMessage
    const processBatchedMessages = () => {
        if (isProcessingRef.current || messageQueueRef.current.length === 0) return;

        isProcessingRef.current = true;
        const messagesToProcess = [...messageQueueRef.current];
        messageQueueRef.current = [];

        const initialStateIndex = messagesToProcess.findIndex(msg => msg.type === 'initial_state');

        if (initialStateIndex >= 0) {
            const initialStateMsg = messagesToProcess[initialStateIndex];
            try {
                handleIncomingWebsocketMessage(initialStateMsg); // Process initial state first
                setHasReceivedInitialState(true);
                // Process others after initial state
                messagesToProcess
                    .filter((_, index) => index !== initialStateIndex)
                    .forEach(msg => {
                        try { handleIncomingWebsocketMessage(msg); }
                        catch (error) { console.error("Error processing batched message:", msg, error); }
                    });
            } catch (error) {
                console.error("Error processing initial state message:", initialStateMsg, error);
                // Decide how to handle initial state failure (e.g., retry, show error)
            }
        } else {
            // Process all messages if no initial state found in this batch
            messagesToProcess.forEach(msg => {
                try { handleIncomingWebsocketMessage(msg); }
                catch (error) { console.error("Error processing batched message:", msg, error); }
            });
        }

        isProcessingRef.current = false;

        if (messageQueueRef.current.length > 0) {
            setTimeout(processBatchedMessages, BATCH_PROCESS_INTERVAL);
        }
    };

    // queueMessage - Updated to handle potential errors from immediate processing
    const queueMessage = (msg: InboundMessage) => {
        // Immediate processing only for initial_state if not yet received
        if (msg.type === 'initial_state' && !hasReceivedInitialState) {
            try {
                handleIncomingWebsocketMessage(msg);
                setHasReceivedInitialState(true);
            } catch (error) {
                console.error("Error immediately processing initial state message:", msg, error);
                // Queue it anyway or handle differently? Queueing might be safer.
                messageQueueRef.current.push(msg);
                if (!isProcessingRef.current) {
                    setTimeout(processBatchedMessages, BATCH_PROCESS_INTERVAL);
                }
            }
            return;
        }

        messageQueueRef.current.push(msg);
        if (!isProcessingRef.current) {
            setTimeout(processBatchedMessages, BATCH_PROCESS_INTERVAL);
        }
    };


    useEffect(() => {
        const intervalId = setInterval(() => {
            if (messageQueueRef.current.length > 0 && !isProcessingRef.current) { // Ensure not already processing
                processBatchedMessages();
            }
        }, BATCH_PROCESS_INTERVAL);
        return () => clearInterval(intervalId);
    }, []);

    const { isOpen, manager } = useSyncClient<InboundMessage, OutboundMessage>({
        config: {
            url: SERVER_WS_ENDPOINT,
            validateIncomingMessage,
            autoReconnect: true,
            reconnectIntervalMs: 500,
            maxReconnectAttempts: 500,
            messageHandlers: {
                initial_state: (msg) => queueMessage(msg),
                state_update: (msg) => queueMessage(msg),
                create_project_tab: (msg) => queueMessage(msg),
                update_project_tab: (msg) => queueMessage(msg),
                update_project_tab_partial: (msg) => queueMessage(msg),
                delete_project_tab: (msg) => queueMessage(msg),
                set_active_project_tab: (msg) => queueMessage(msg),
                create_project_tab_from_ticket: (msg) => queueMessage(msg),
                update_global_state_key: (msg) => queueMessage(msg),
                update_settings: (msg) => queueMessage(msg),
                update_settings_partial: (msg) => queueMessage(msg),
                update_theme: (msg) => queueMessage(msg),
            },
        },
    });

    return (
        <GlobalStateContext.Provider value={{ manager, isOpen, hasReceivedInitialState }}>
            {children}
        </GlobalStateContext.Provider>
    );
}