import type { SSEEngineParams } from ".//streaming-types";

export interface ProviderPlugin {
    /**
     * Prepare the SSE request to the provider (fetch or client call).
     * Return a raw ReadableStream or the underlying reader for SSE.
     */
    prepareRequest(params: SSEEngineParams): Promise<ReadableStream<Uint8Array> | ReadableStreamDefaultReader<Uint8Array>>;

    /**
     * Given a line or chunk from the SSE, parse out the relevant text
     * to be appended to the user’s message. 
     * Return null or empty string if the line doesn't contain displayable text.
     * Return the special string `[DONE]` or something equivalent if this chunk signals the end.
     */
    parseServerSentEvent(line: string): string | null;
}