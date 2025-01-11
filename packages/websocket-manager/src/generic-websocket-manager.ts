import type { ServerWebSocket } from "bun";
import type { BaseMessage, MessageHandler } from "./websocket-types";

/**
 * Hooks that can be provided to the WebSocketManager for executing
 * custom logic at various lifecycle events.
 */
export interface WebSocketManagerHooks<TState> {
    /**
     * Called whenever a new client connects.
     */
    onConnect?: (ws: ServerWebSocket<any>) => Promise<void>;

    /**
     * Called whenever a client disconnects.
     */
    onDisconnect?: (ws: ServerWebSocket<any>) => Promise<void>;

    /**
     * Called whenever the manager's state is updated.
     */
    onStateChange?: (oldState: TState, newState: TState) => Promise<void>;

    /**
     * Called when the server sends a "ping" message to a client.
     */
    onPing?: (ws: ServerWebSocket<any>) => Promise<void>;

    /**
     * Called when the server receives a "pong" message from a client.
     */
    onPong?: (ws: ServerWebSocket<any>) => Promise<void>;

    /**
     * Called if a client fails to respond to a ping message.
     */
    onPingTimeout?: (ws: ServerWebSocket<any>) => Promise<void>;
}

/**
 * Configuration object for the generic WebSocket manager.
 * 
 * @template TState The shape of your application's state
 * @template TMessage The union of all message types that may be handled
 */
export interface WebSocketManagerConfig<
    TState,
    TMessage extends BaseMessage
> {
    /**
     * A function to retrieve the current state from wherever it is stored
     * (database, in-memory, etc.).
     */
    getState: () => Promise<TState>;

    /**
     * A function to persist the updated state in your data store.
     */
    setState: (state: TState) => Promise<void>;

    /**
     * An array of message handlers. Each handler processes a specific message type.
     */
    messageHandlers: Array<MessageHandler<TState, TMessage>>;

    /**
     * Optional debug flag for logging.
     */
    debug?: boolean;

    /**
     * Optional hooks for lifecycle events.
     */
    hooks?: WebSocketManagerHooks<TState>;

    /**
     * Milliseconds to wait before sending a ping to each client.
     * If not provided, pinging is disabled.
     */
    heartbeatIntervalMs?: number;

    /**
     * Milliseconds to wait for a pong response before marking a client as timed out.
     */
    pingTimeoutMs?: number;

    /**
     * Optional validator for incoming messages.
     * Example usage with zod:
     *   validateMessage: (msg) => MyZodSchema.parse(msg)
     */
    validateMessage?: (rawMessage: unknown) => TMessage;
}

/**
 * A generic WebSocket manager that can handle a variety of states and messages.
 * 
 * @template TState - The shape of your application's state
 * @template TMessage - The union of all message types that may be handled
 */
export class WebSocketManager<
    TState,
    TMessage extends BaseMessage
> {
    private connections: Set<ServerWebSocket<any>>;
    private config: WebSocketManagerConfig<TState, TMessage>;

    /**
     * Middleware array. Each middleware processes a TMessage
     * and returns a (possibly transformed) TMessage.
     */
    private middlewares: Array<(message: TMessage) => Promise<TMessage>> = [];

    /**
     * Keeps track of timestamps (in ms) of the last pong received from each client.
     * Used for heartbeat/ping checks.
     */
    private lastPongTimes: Map<ServerWebSocket<any>, number>;

    private heartbeatTimer: NodeJS.Timer | undefined;

    constructor(config: WebSocketManagerConfig<TState, TMessage>) {
        this.config = config;
        this.connections = new Set();
        this.lastPongTimes = new Map();

        if (this.config.debug) {
            console.log("[WebSocketManager] Initialized with debug = true");
        }

        // If heartbeatIntervalMs is set, start the interval.
        if (this.config.heartbeatIntervalMs && this.config.heartbeatIntervalMs > 0) {
            this.startHeartbeat();
        }
    }

    /**
     * Register a new middleware function that processes incoming messages.
     */
    public async use(middleware: (message: TMessage) => Promise<TMessage>): Promise<void> {
        this.middlewares.push(middleware);
    }

    /**
     * Starts the heartbeat/ping cycle if not already started.
     */
    private startHeartbeat(): void {
        // Clear any existing timer.
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
        }

        this.heartbeatTimer = setInterval(() => {
            for (const ws of this.connections) {
                // If a client is still open, attempt to ping it.
                if (ws.readyState === WebSocket.OPEN) {
                    this.sendPing(ws);
                }
            }
        }, this.config.heartbeatIntervalMs);
    }

    /**
     * Sends a ping message to a specific client.
     */
    private async sendPing(ws: ServerWebSocket<any>): Promise<void> {
        try {
            const pingMessage = JSON.stringify({ type: "ping" });
            ws.send(pingMessage);
            if (this.config.hooks?.onPing) {
                await this.config.hooks.onPing(ws);
            }

            // If we have a pingTimeoutMs configured, we track the time.
            if (this.config.pingTimeoutMs && this.config.pingTimeoutMs > 0) {
                const timeout = setTimeout(async () => {
                    const lastPong = this.lastPongTimes.get(ws) || 0;
                    const now = Date.now();
                    // If we haven't received a pong in time, close or mark inactive.
                    if (now - lastPong > this.config.pingTimeoutMs!) {
                        if (this.config.debug) {
                            console.warn("[WebSocketManager] Ping timeout for connection. Closing...");
                        }
                        if (this.config.hooks?.onPingTimeout) {
                            await this.config.hooks.onPingTimeout(ws);
                        }
                        ws.close();
                    }
                }, this.config.pingTimeoutMs);

                // Clear the timer if we receive a pong, so store it if needed.
                // We'll do that in handlePong method.
            }
        } catch (error) {
            if (this.config.debug) {
                console.error("[WebSocketManager] Failed to send ping:", error);
            }
        }
    }

    /**
     * Stops the heartbeat/ping cycle.
     */
    public stopHeartbeat(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = undefined;
        }
    }

    /**
     * Handle a new connection.
     */
    public async handleOpen(ws: ServerWebSocket<any>): Promise<void> {
        this.connections.add(ws);
        this.lastPongTimes.set(ws, Date.now());

        if (this.config.debug) {
            console.log("[WebSocketManager] New connection opened.");
        }

        // Call onConnect hook if provided
        if (this.config.hooks?.onConnect) {
            await this.config.hooks.onConnect(ws);
        }

        // Optional: Send the current state to the new client
        try {
            const currentState = await this.config.getState();
            const message = {
                type: "initial_state",
                data: currentState
            };
            ws.send(JSON.stringify(message));
        } catch (error) {
            console.error("[WebSocketManager] Error fetching initial state:", error);
            ws.close();
        }
    }

    /**
     * Handle a closed connection.
     */
    public async handleClose(ws: ServerWebSocket<any>): Promise<void> {
        this.connections.delete(ws);
        this.lastPongTimes.delete(ws);

        if (this.config.debug) {
            console.log("[WebSocketManager] Connection closed.");
        }

        // Call onDisconnect hook if provided
        if (this.config.hooks?.onDisconnect) {
            await this.config.hooks.onDisconnect(ws);
        }
    }

    /**
     * Handle any raw incoming messages from clients.
     */
    public async handleMessage(ws: ServerWebSocket<any>, rawMessage: string): Promise<void> {
        if (this.config.debug) {
            console.log("[WebSocketManager] Received raw message:", rawMessage);
        }

        // Special case for "pong": we track that we've received a pong for heartbeat
        if (rawMessage === "pong") {
            if (this.config.debug) {
                console.log("[WebSocketManager] Received pong");
            }
            this.lastPongTimes.set(ws, Date.now());
            if (this.config.hooks?.onPong) {
                await this.config.hooks.onPong(ws);
            }
            return;
        }

        let parsed: TMessage;
        try {
            // If a validator is provided, use it. Otherwise fallback to JSON.parse
            parsed = this.config.validateMessage
                ? this.config.validateMessage(JSON.parse(rawMessage))
                : (JSON.parse(rawMessage) as TMessage);
        } catch (error) {
            console.error("[WebSocketManager] Failed to parse or validate message:", error);
            return;
        }

        // Pass the parsed message through all registered middlewares
        for (const mw of this.middlewares) {
            try {
                parsed = await mw(parsed);
            } catch (middlewareError) {
                console.error("[WebSocketManager] Middleware error:", middlewareError);
                return;
            }
        }

        // Find a handler that matches the parsed type
        const handler = this.config.messageHandlers.find((h) => h.type === parsed.type);
        if (!handler) {
            if (this.config.debug) {
                console.warn("[WebSocketManager] No handler found for message type:", parsed.type);
            }
            return;
        }

        // Run the handler
        try {
            // We read the old state for the onStateChange hook, in case the handler changes state.
            const oldState = await this.config.getState();

            await handler.handle(
                ws,
                parsed,
                this.config.getState,
                async (updated: TState) => {
                    // Before we actually set the state, check if it's changed from oldState.
                    await this.config.setState(updated);
                    // If changed, call onStateChange if provided.
                    if (this.config.hooks?.onStateChange && JSON.stringify(oldState) !== JSON.stringify(updated)) {
                        await this.config.hooks.onStateChange(oldState, updated);
                    }
                }
            );
        } catch (error) {
            console.error("[WebSocketManager] Error in handler:", error);
        }
    }

    /**
     * Broadcast helper to send the entire updated state to all clients.
     */
    public async broadcastState(): Promise<void> {
        try {
            const updatedState = await this.config.getState();
            const message = {
                type: "state_update",
                data: updatedState
            };
            const serialized = JSON.stringify(message);

            let successCount = 0;
            let failCount = 0;

            for (const conn of this.connections) {
                try {
                    conn.send(serialized);
                    successCount++;
                } catch (error) {
                    failCount++;
                    if (this.config.debug) {
                        console.error("[WebSocketManager] Failed to send state update:", error);
                    }
                }
            }

            if (this.config.debug) {
                console.log("[WebSocketManager] Broadcast complete:", {
                    totalConnections: this.connections.size,
                    successCount,
                    failCount
                });
            }
        } catch (error) {
            console.error("[WebSocketManager] Broadcast error:", error);
        }
    }
}