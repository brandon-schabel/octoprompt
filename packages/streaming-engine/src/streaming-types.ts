import type { ProviderPlugin } from "./provider-plugin";

/**
 * Standard message roles: system, user, assistant.
 * You can add more roles if needed.
 */
export type SSEMessage = {
    role: "system" | "user" | "assistant";
    content: string;
    // You can attach more data/metadata in here if desired
};

/**
 * Handlers/callbacks to handle different phases of streaming.
 * All are optional—implement only what you need.
 */
export interface SSEEngineHandlers {
    /**
     * Called once before streaming begins if you pass in a system message
     */
    onSystemMessage?: (message: SSEMessage) => void;

    /**
     * If you want to log the user message that triggered this, do it here
     */
    onUserMessage?: (message: SSEMessage) => void;

    /**
     * Called every time we parse a non-empty chunk of SSE text. Typically partial assistant text.
     */
    onPartial?: (partial: SSEMessage) => void;

    /**
     * Called when the SSE stream signals completion (i.e. [DONE]) or we exhaust the stream.
     * `fullContent` is the entire assistant response aggregated so far.
     */
    onDone?: (fullContent: SSEMessage) => void;

    /**
     * Called if an error happens during SSE read. `partialSoFar` is
     * the text we accumulated until the error occurred (if any).
     */
    onError?: (error: unknown, partialSoFar: SSEMessage) => void;
}

/**
 * The minimal set of input parameters the streaming engine needs.
 * Notice there's no ChatService or database references here.
 */
export interface SSEEngineParams {
    /** The user's text prompt */
    userMessage: string;
    /** An optional system message or instructions */
    systemMessage?: string;

    /** Provider plugin that knows how to prepare & parse the SSE stream */
    plugin: ProviderPlugin;

    /** Any other settings your plugin might need (model, temperature, etc.) */
    options?: Record<string, any>;

    /**
     * Handlers to drive updates back to the caller.  
     * These can do e.g. database updates, broadcast events, etc.
     */
    handlers: SSEEngineHandlers;
}