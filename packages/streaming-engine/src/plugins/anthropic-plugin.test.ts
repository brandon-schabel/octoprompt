import { describe, it, expect } from "bun:test";
import { AnthropicPlugin } from "./anthropic-plugin";
import type { SSEEngineParams } from "../streaming-types";

// Suppose we have a shared test utility in ./test-utils.ts:
import { createMockSSEStream } from "../create-mock-sse-stream"; // adjust path as needed

describe("AnthropicPlugin", () => {
    it("should parse SSE lines correctly and return partial text + [DONE]", async () => {
        // 1) Spy on fetch to return a mock SSE stream using createMockSSEStream
        const fakeFetch = () =>
            Promise.resolve({
                ok: true,
                status: 200,
                body: createMockSSEStream(
                    [
                        // Each entry becomes `data: <entry>\n\n`
                        JSON.stringify({ type: "content_block_delta", delta: { text: "Hello " } }),
                        JSON.stringify({ type: "content_block_delta", delta: { text: "world!" } })
                    ],
                    {
                        endWithDone: true,
                        delayMs: 0, // emit instantly, or adjust for slower simulation
                    }
                ),
            } as Response);

        // 2) Replace global fetch with our fake
        const originalFetch = globalThis.fetch;
        (globalThis.fetch as unknown) = fakeFetch;

        try {
            const plugin = new AnthropicPlugin("fakeKey", "2023-06-01");
            const params: SSEEngineParams = {
                userMessage: "Test user message",
                plugin,
                handlers: {},
            };

            // 3) Prepare request
            const reader = await plugin.prepareRequest(params);

            // 4) Manually read the SSE lines from the plugin’s returned reader
            const decoder = new TextDecoder();
            let fullString = "";
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                fullString += decoder.decode(value);
            }

            // Validate parseServerSentEvent logic
            const partial1 = plugin.parseServerSentEvent(
                `data: ${JSON.stringify({ type: "content_block_delta", delta: { text: "Hello " } })}`
            );
            const partial2 = plugin.parseServerSentEvent(
                `data: ${JSON.stringify({ type: "content_block_delta", delta: { text: "world!" } })}`
            );
            const doneSignal = plugin.parseServerSentEvent(`data: [DONE]`);

            expect(partial1).toBe("Hello ");
            expect(partial2).toBe("world!");
            expect(doneSignal).toBe("[DONE]");

            // Optionally, verify the raw SSE lines we read
            expect(fullString).toContain("data: {\"type\":\"content_block_delta\"");
            expect(fullString).toContain("[DONE]");
        } finally {
            // Restore original fetch
            globalThis.fetch = originalFetch;
        }
    });

    it("should throw if the fetch fails", async () => {
        const fakeFetch = () =>
            Promise.resolve({
                ok: false,
                status: 500,
                body: null,
                text: () => Promise.resolve("Server error"),
                statusText: "Internal Server Error",
            } as Response);

        const originalFetch = globalThis.fetch;
        (globalThis.fetch as unknown) = fakeFetch;

        try {
            const plugin = new AnthropicPlugin("fakeKey", "2023-06-01");
            const params: SSEEngineParams = {
                userMessage: "Test user message",
                plugin,
                handlers: {},
            };

            await expect(plugin.prepareRequest(params)).rejects.toThrow(/Anthropic API error/);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });
});