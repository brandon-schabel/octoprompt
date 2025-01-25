import React, { createContext, useContext, useMemo, useState } from "react";
import {
    ClientWebSocketManagerConfig,
    ClientWebSocketManager,
} from "@bnk/client-websocket-manager";
import { useClientWebSocket } from "@bnk/react-websocket-manager";
import { InboundMessage, validateIncomingMessage } from "shared";
import { globalStateSchema, createInitialGlobalState, type GlobalState } from "shared";
import { SERVER_WS_ENDPOINT } from "@/constants/server-constants";

/**
 * For the outbound direction, if you want to parse or check messages
 * before sending them to the server, define something like this:
 */
function validateOutgoingMessage(raw: unknown): InboundMessage {
    // Potentially parse or sanitize. For example:
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return validateIncomingMessage(parsed); // or your own outbound schema
}

interface BaseContextValue {
    globalState: GlobalState;
    isOpen: boolean;
    wsClient: ClientWebSocketManager<InboundMessage, InboundMessage>;
}

const BaseGlobalStateContext = createContext<BaseContextValue | null>(null);

export function GlobalStateWebsocketProvider({ children }: { children: React.ReactNode }) {
    const [globalState, setGlobalState] = useState<GlobalState>(createInitialGlobalState());

    /**
     * Define how the client should handle inbound messages from server.
     * We can do minimal logic here, or just rely on event handlers in components.
     * Below is an example that updates local state if we get a "state_update" type.
     */
    const clientMessageHandlers: ClientWebSocketManagerConfig<
        InboundMessage,
        InboundMessage
    >["messageHandlers"] = useMemo(
        () => ({
            // Example: if the server broadcasts a "state_update", just store it in React state.
            state_update: (msg) => {
                const validated = globalStateSchema.parse(msg.data);
                setGlobalState(validated);
            },
            initial_state: (msg) => {
                const validated = globalStateSchema.parse(msg.data);
                setGlobalState(validated);
            },
            // ... you can define more handlers for other message types
            create_project_tab: (msg) => {
                // minimal example
                setGlobalState((prev) => {
                    const copy = structuredClone(prev);
                    copy.projectTabs[msg.tabId] = msg.data as any;
                    copy.settings.projectTabIdOrder.push(msg.tabId);
                    copy.projectActiveTabId = msg.tabId;
                    return globalStateSchema.parse(copy);
                });
            },
            // etc.
        }),
        []
    );

    const { isOpen, manager } = useClientWebSocket<InboundMessage, InboundMessage>({
        config: {
            url: SERVER_WS_ENDPOINT,
            messageHandlers: clientMessageHandlers,
            // If you want to parse inbound messages with Zod, do:
            validateIncomingMessage,
            // If you want to parse outbound messages, do:
            // validateOutgoingMessage,
            autoReconnect: true,
            reconnectIntervalMs: 500,
            maxReconnectAttempts: 500,
        },
    });

    // Provide the entire context to children
    const baseValue = useMemo(() => {
        if (!manager) throw new Error("Manager not initialized");
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

/**
 * Simple hook for consuming the global context
 */
export function useGlobalStateContext(): BaseContextValue {
    const ctx = useContext(BaseGlobalStateContext);
    if (!ctx) {
        throw new Error("useGlobalStateContext must be used within GlobalStateWebsocketProvider");
    }
    return ctx;
}