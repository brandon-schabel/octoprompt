// client-websocket-context.tsx
import React, {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
    useCallback,
} from "react";
import { 
    ClientWebSocketManager, 
    type ClientWebSocketManagerConfig,
    type BaseServerMessage,
    type BaseClientMessage 
} from "./client-websocket-manager";

export interface WebSocketClientContextValue<
    TIncoming extends BaseServerMessage = BaseServerMessage,
    TOutgoing extends BaseClientMessage = BaseClientMessage
> {
    /**
     * The low-level manager controlling our WebSocket connection.
     */
    manager: ClientWebSocketManager<TIncoming, TOutgoing>;

    /**
     * Boolean indicating if the WebSocket is currently open.
     * (We can track more granular states if needed: connecting, error, etc.)
     */
    isOpen: boolean;

    /**
     * Send a typed message to the server.
     */
    sendMessage: (msg: TOutgoing) => void;

    /**
     * Disconnect the WebSocket.
     */
    disconnect: () => void;
}

const WebSocketClientContext = {
    // Using a function to create the context allows us to maintain type safety
    create: <
        TIncoming extends BaseServerMessage = BaseServerMessage,
        TOutgoing extends BaseClientMessage = BaseClientMessage
    >() => createContext<WebSocketClientContextValue<TIncoming, TOutgoing> | null>(null)
};

export function useWebSocketClient<
    TIncoming extends BaseServerMessage = BaseServerMessage,
    TOutgoing extends BaseClientMessage = BaseClientMessage
>(): WebSocketClientContextValue<TIncoming, TOutgoing> {
    const ctx = useContext(WebSocketClientContext.create<TIncoming, TOutgoing>());
    if (!ctx) {
        throw new Error("useWebSocketClient must be used within a <WebSocketClientProvider>.");
    }
    return ctx;
}

export interface WebSocketClientProviderProps<
    TIncoming extends BaseServerMessage = BaseServerMessage,
    TOutgoing extends BaseClientMessage = BaseClientMessage
> extends ClientWebSocketManagerConfig<TIncoming, TOutgoing> {
    children: React.ReactNode;
}

/**
 * This provider sets up a ClientWebSocketManager and passes it
 * (plus some convenience state and methods) to all descendants.
 */
export function WebSocketClientProvider<
    TIncoming extends BaseServerMessage = BaseServerMessage,
    TOutgoing extends BaseClientMessage = BaseClientMessage
>(props: WebSocketClientProviderProps<TIncoming, TOutgoing>) {
    const { children, ...managerConfig } = props;
    const [isOpen, setIsOpen] = useState(false);
    const Context = WebSocketClientContext.create<TIncoming, TOutgoing>();

    // Create the manager on mount. UseMemo ensures we only create once per config change.
    const manager = useMemo(() => {
        return new ClientWebSocketManager<TIncoming, TOutgoing>({
            ...managerConfig,
            onOpen: () => {
                setIsOpen(true);
                managerConfig.onOpen?.();
            },
            onClose: (event) => {
                setIsOpen(false);
                managerConfig.onClose?.(event);
            },
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [managerConfig.url, managerConfig.debug]);

    // Clean up by disconnecting on unmount.
    useEffect(() => {
        return () => {
            manager.disconnect();
        };
    }, [manager]);

    /**
     * Helper to send a typed message
     */
    const sendMessage = useCallback((msg: TOutgoing) => {
        manager.sendMessage(msg);
    }, [manager]);

    /**
     * Helper to manually disconnect
     */
    const disconnect = useCallback(() => {
        manager.disconnect();
    }, [manager]);

    const value: WebSocketClientContextValue<TIncoming, TOutgoing> = {
        manager,
        isOpen,
        sendMessage,
        disconnect,
    };

    return (
        <Context.Provider value={value}>
            {children}
        </Context.Provider>
    );
}