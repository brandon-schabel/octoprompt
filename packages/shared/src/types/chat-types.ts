/**
 * Common TypeScript interfaces for the chat app,
 * ensuring both client and server see the same shape.
 */

/**
 * The shape of application state that both server and client care about.
 */
export interface ChatAppState {
    messageLog: string[];
}

/**
 * A message the client sends to the server. In this simple chat, the client
 * sends just one type of message: "chat".
 */
export interface ChatClientMessage {
    type: "chat";
    payload: {
        text: string;
        sender: string;
    };
}

/**
 * Possible server->client messages:
 *
 * 1) `initial_state`: Sent when the client first connects, providing
 *    the entire chat log in `data`.
 * 2) `state_update`: Sent on subsequent updates, e.g. new messages appended
 *    to the log.
 */
export interface InitialStateServerMessage {
    type: "initial_state";
    data: ChatAppState;
}

export interface StateUpdateServerMessage {
    type: "state_update";
    data: ChatAppState;
}

/**
 * Combine server->client messages into one union type, so the client
 * can easily handle them in a typed manner.
 */
export type IncomingServerMessage =
    | InitialStateServerMessage
    | StateUpdateServerMessage;

/**
 * Combine client->server messages into one union type, so the server
 * can handle them all. Here we just have `ChatClientMessage`, but
 * you can add more subtypes if needed.
 */
export type OutgoingClientMessage = ChatClientMessage;