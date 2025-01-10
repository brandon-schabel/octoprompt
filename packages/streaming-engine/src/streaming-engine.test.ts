import { describe, it, expect } from "bun:test";
import { createSSEStream } from "./streaming-engine";
import type { SSEEngineParams, SSEEngineHandlers } from "./streaming-types";
import type { ProviderPlugin } from "./provider-plugin";

/**
 * A mock plugin that simulates a streaming response with SSE data.
 * We'll create a fake SSE sequence that sends two partial chunks and then a [DONE] line.
 */
class MockPlugin implements ProviderPlugin {
    async prepareRequest(): Promise<ReadableStream<Uint8Array>> {
        // Create an artificial SSE stream that sends two chunks and a [DONE] signal
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const encoder = new TextEncoder();

        // Simulate SSE lines
        //  - data: "Hello"
        //  - data: " world!"
        //  - data: [DONE]
        (async () => {
            await writer.write(encoder.encode("data: \"Hello\"\n\n"));
            await writer.write(encoder.encode("data: \" world!\"\n\n"));
            await writer.write(encoder.encode("data: [DONE]\n\n"));
            writer.close();
        })();

        return readable;
    }

    parseServerSentEvent(line: string): string | null {
        if (!line.startsWith("data: ")) return null;
        const payload = line.slice("data: ".length).trim();

        if (payload === "[DONE]") {
            return "[DONE]";
        }

        // Convert from JSON string -> actual string
        try {
            return JSON.parse(payload);
        } catch {
            return payload;
        }
    }
}

describe("createSSEStream", () => {
    it("should call onPartial and onDone handlers correctly", async () => {
        let partialCalls: string[] = [];
        let doneCall: string | null = null;

        const handlers: SSEEngineHandlers = {
            onPartial: (msg) => {
                partialCalls.push(msg.content);
            },
            onDone: (msg) => {
                doneCall = msg.content;
            },
        };

        const params: SSEEngineParams = {
            userMessage: "Test message",
            plugin: new MockPlugin(),
            handlers,
        };

        // Run the SSE stream
        const stream = await createSSEStream(params);

        // We need to consume the stream to trigger the reading loop
        const reader = stream.getReader();
        // Read until done
        let s: ReadableStreamDefaultReadResult<Uint8Array>;
        do {
            s = await reader.read();
        } while (!s.done);

        expect(partialCalls).toEqual(["Hello", " world!"]);
        // The final (done) call should be the concatenation of partial responses
        expect(doneCall).toBe("Hello world!");
    });

    it("should call onUserMessage and onSystemMessage if provided", async () => {
        let systemHandlerCalled = false;
        let userHandlerCalled = false;

        const handlers: SSEEngineHandlers = {
            onSystemMessage: () => {
                systemHandlerCalled = true;
            },
            onUserMessage: () => {
                userHandlerCalled = true;
            },
        };

        const params: SSEEngineParams = {
            userMessage: "Test user message",
            systemMessage: "Test system message",
            plugin: new MockPlugin(),
            handlers,
        };

        const stream = await createSSEStream(params);
        const reader = stream.getReader();
        await reader.cancel(); // We don't need to fully read for this test

        expect(systemHandlerCalled).toBe(true);
        expect(userHandlerCalled).toBe(true);
    });

    it("should call onError if the plugin fails immediately", async () => {
        class ErrorPlugin implements ProviderPlugin {
            async prepareRequest() {
                throw new Error("Simulated stream error");
            }
            parseServerSentEvent() { return null; }
        }

        let onErrorCalled = false;
        let partialSoFar = "";
        const handlers: SSEEngineHandlers = {
            onError: (err, partial) => {
                onErrorCalled = true;
                partialSoFar = partial.content;
            },
        };

        const params: SSEEngineParams = {
            userMessage: "Test user message",
            plugin: new ErrorPlugin(),
            handlers,
        };

        // createSSEStream now catches immediate plugin errors
        const stream = await createSSEStream(params);
        const reader = stream.getReader();
        await reader.read(); // shouldn't throw because we returned an empty stream

        expect(onErrorCalled).toBe(true);
        expect(partialSoFar).toBe("");
    });
});