import type { ServerWebSocket } from "bun";

/**
 * Base interface for all WebSocket messages.
 * Each message must have a `type` field.
 */
export interface BaseMessage {
    type: string;
}

/**
 * A generic message handler interface that can handle
 * messages of a certain `type`.
 */
export interface MessageHandler<TState, TMessage extends BaseMessage> {
    /**
     * The message type that this handler is responsible for processing.
     */
    type: TMessage["type"];

    /**
     * Handle the incoming message.
     * @param ws - The connected WebSocket
     * @param message - The received message
     * @param getState - A function to retrieve current state
     * @param setState - A function to persist updated state
     * 
     * This returns a Promise<void> so you can handle async
     * operations (e.g., DB writes, external calls).
     */
    handle: (
        ws: ServerWebSocket<any>,
        message: TMessage,
        getState: () => Promise<TState>,
        setState: (updated: TState) => Promise<void>
    ) => Promise<void>;
}