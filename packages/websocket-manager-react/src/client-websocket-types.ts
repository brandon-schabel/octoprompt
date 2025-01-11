// client-websocket-types.ts
export interface BaseClientMessage {
    type: string;
    // Optionally, you can define other common fields here
}

export interface BaseServerMessage {
    type: string;
    // The server may send some data payload
    data?: unknown;
}

/**
 * Example: We might have a specific client->server message
 * that increments something on the server.
 */
export interface IncrementClientMessage extends BaseClientMessage {
    type: "increment";
    amount: number;
}

/**
 * Example: The server might respond with state updates.
 */
export interface StateUpdateServerMessage extends BaseServerMessage {
    type: "state_update";
    data: {
        counter: number;
    };
}

/**
 * Combine your client->server messages into a union type.
 */
export type OutgoingClientMessage =
    | IncrementClientMessage
    // Add others here as needed
    ;

/**
 * Combine your server->client messages into a union type.
 */
export type IncomingServerMessage =
    | StateUpdateServerMessage
    // Add others here as needed
    ;