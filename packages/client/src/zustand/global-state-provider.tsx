import { createContext, useContext, ReactNode, useState, useRef, useEffect } from "react";
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

// Time between processing batches of messages (in ms)
const BATCH_PROCESS_INTERVAL = 50; 

export function GlobalStateProvider({ children }: { children: ReactNode }) {
    // This tracks if we've received the server's initial_state event
    const [hasReceivedInitialState, setHasReceivedInitialState] = useState(false);
    
    // Queue for batching messages
    const messageQueueRef = useRef<InboundMessage[]>([]);
    
    // Flag to track if we're currently processing a batch
    const isProcessingRef = useRef(false);
    
    // Throttled message processor
    const processBatchedMessages = () => {
        if (isProcessingRef.current || messageQueueRef.current.length === 0) return;
        
        isProcessingRef.current = true;
        
        // Process all messages in the queue
        const messagesToProcess = [...messageQueueRef.current];
        messageQueueRef.current = [];
        
        // Find the initial_state message if it exists (priority handling)
        const initialStateIndex = messagesToProcess.findIndex(msg => msg.type === 'initial_state');
        
        if (initialStateIndex >= 0) {
            // Process initial_state first and mark that we've received it
            const initialStateMsg = messagesToProcess[initialStateIndex];
            handleIncomingWebsocketMessage(initialStateMsg);
            setHasReceivedInitialState(true);
            
            // Process all other messages
            messagesToProcess
                .filter((_, index) => index !== initialStateIndex)
                .forEach(handleIncomingWebsocketMessage);
        } else {
            // Just process all messages in order
            messagesToProcess.forEach(handleIncomingWebsocketMessage);
        }
        
        isProcessingRef.current = false;
        
        // If more messages arrived during processing, schedule another batch
        if (messageQueueRef.current.length > 0) {
            setTimeout(processBatchedMessages, BATCH_PROCESS_INTERVAL);
        }
    };
    
    // Queue a message for batched processing
    const queueMessage = (msg: InboundMessage) => {
        // For critical messages like initial_state, process immediately
        if (msg.type === 'initial_state' && !hasReceivedInitialState) {
            handleIncomingWebsocketMessage(msg);
            setHasReceivedInitialState(true);
            return;
        }
        
        // Otherwise queue up the message
        messageQueueRef.current.push(msg);
        
        // If we're not already processing, schedule a batch process
        if (!isProcessingRef.current) {
            setTimeout(processBatchedMessages, BATCH_PROCESS_INTERVAL);
        }
    };
    
    // Set up the batch processor timer
    useEffect(() => {
        const intervalId = setInterval(() => {
            if (messageQueueRef.current.length > 0) {
                processBatchedMessages();
            }
        }, BATCH_PROCESS_INTERVAL);
        
        return () => clearInterval(intervalId);
    }, []);

    // BNK's manager
    const { isOpen, manager } = useSyncClient<InboundMessage, OutboundMessage>({
        config: {
            url: SERVER_WS_ENDPOINT,
            validateIncomingMessage,
            autoReconnect: true,
            reconnectIntervalMs: 500,
            maxReconnectAttempts: 500,
            messageHandlers: {
                // Use a single handler for all message types
                // to route them through our batching system
                initial_state: (msg) => queueMessage(msg),
                state_update: (msg) => queueMessage(msg),
                create_project_tab: (msg) => queueMessage(msg),
                update_project_tab: (msg) => queueMessage(msg),
                update_project_tab_partial: (msg) => queueMessage(msg),
                delete_project_tab: (msg) => queueMessage(msg),
                set_active_project_tab: (msg) => queueMessage(msg),
                create_project_tab_from_ticket: (msg) => queueMessage(msg),
                create_chat_tab: (msg) => queueMessage(msg),
                update_chat_tab: (msg) => queueMessage(msg),
                update_chat_tab_partial: (msg) => queueMessage(msg),
                delete_chat_tab: (msg) => queueMessage(msg),
                set_active_chat_tab: (msg) => queueMessage(msg),
                update_settings: (msg) => queueMessage(msg),
                update_settings_partial: (msg) => queueMessage(msg),
                update_theme: (msg) => queueMessage(msg),
                update_provider: (msg) => queueMessage(msg),
                update_link_settings: (msg) => queueMessage(msg),
                update_global_state_key: (msg) => queueMessage(msg),
            },
        },
    });

    return (
        <GlobalStateContext.Provider value={{ manager, isOpen, hasReceivedInitialState }}>
            {children}
        </GlobalStateContext.Provider>
    );
}