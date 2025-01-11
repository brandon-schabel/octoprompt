import type { BaseServerMessage, BaseClientMessage } from "./client-websocket-types";

export type { BaseServerMessage, BaseClientMessage };

/**
 * Configuration for our client-side manager.
 * You can give default types for TIncoming and TOutgoing if you like.
 */
export interface ClientWebSocketManagerConfig<
    TIncoming extends BaseServerMessage = BaseServerMessage,
    TOutgoing extends BaseClientMessage = BaseClientMessage
> {
    /**
     * The URL to which we connect. For example: "ws://localhost:3007"
     */
    url: string;

    /**
     * Optional debug mode for console logs.
     */
    debug?: boolean;

    /**
     * Called whenever the WebSocket successfully opens.
     */
    onOpen?: () => void;

    /**
     * Called whenever the WebSocket closes.
     */
    onClose?: (event: CloseEvent) => void;

    /**
     * Called when an error occurs.
     */
    onError?: (event: Event) => void;

    /**
     * A map of handlers keyed by `message.type`, so you can handle each incoming
     * message type in a well-typed, pluggable way.
     */
    messageHandlers?: {
        [K in TIncoming["type"]]?: (
            message: Extract<TIncoming, { type: K }>
        ) => void;
    };
}

/**
 * A generic client-side WebSocket Manager.
 */
export class ClientWebSocketManager<
    TIncoming extends BaseServerMessage = BaseServerMessage,
    TOutgoing extends BaseClientMessage = BaseClientMessage
> {
    private config: ClientWebSocketManagerConfig<TIncoming, TOutgoing>;
    private socket: WebSocket | null = null;

    constructor(config: ClientWebSocketManagerConfig<TIncoming, TOutgoing>) {
        this.config = config;
        this.connect();
    }

    /**
     * Create and open the WebSocket connection
     */
    private connect() {
        const { url, debug } = this.config;

        if (debug) {
            console.log(`[ClientWebSocketManager] Connecting to ${url} ...`);
        }

        this.socket = new WebSocket(url);

        this.socket.addEventListener("open", this.handleOpen);
        this.socket.addEventListener("close", this.handleClose);
        this.socket.addEventListener("error", this.handleError);
        this.socket.addEventListener("message", this.handleMessage);
    }

    /**
     * Close the WebSocket connection gracefully
     */
    public disconnect() {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            if (this.config.debug) {
                console.log("[ClientWebSocketManager] Closing connection");
            }
            this.socket.close();
        }
    }

    /**
     * Send a strongly-typed message to the server
     */
    public sendMessage(msg: TOutgoing) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            if (this.config.debug) {
                console.warn("[ClientWebSocketManager] Cannot send, socket not open:", msg);
            }
            return;
        }

        try {
            const str = JSON.stringify(msg);
            this.socket.send(str);
        } catch (error) {
            console.error("[ClientWebSocketManager] Error sending message:", error);
        }
    }

    /**
     * Called when WebSocket opens
     */
    private handleOpen = () => {
        if (this.config.debug) {
            console.log("[ClientWebSocketManager] Connection opened");
        }
        this.config.onOpen?.();
    };

    /**
     * Called when WebSocket closes
     */
    private handleClose = (event: CloseEvent) => {
        if (this.config.debug) {
            console.log("[ClientWebSocketManager] Connection closed:", event.reason);
        }
        this.config.onClose?.(event);
        // Optional: reconnection logic here
    };

    /**
     * Called on a WebSocket error
     */
    private handleError = (event: Event) => {
        if (this.config.debug) {
            console.error("[ClientWebSocketManager] Connection error:", event);
        }
        this.config.onError?.(event);
    };

    /**
     * Called when a message arrives from the server
     */
    private handleMessage = (event: MessageEvent) => {
        let incoming: TIncoming;
        try {
            incoming = JSON.parse(event.data) as TIncoming;
        } catch (err) {
            console.error("[ClientWebSocketManager] Failed to parse incoming message", err);
            return;
        }

        // @ts-ignore
        const handler = this.config.messageHandlers?.[incoming.type];
        if (handler) {
            handler(incoming);
        } else if (this.config.debug) {
            console.warn("[ClientWebSocketManager] No handler for message type:", incoming.type);
        }
    };
}