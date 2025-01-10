import { describe, it, expect } from "bun:test";
import { GroqPlugin } from "./groq-plugin";
import type { SSEEngineParams } from "../streaming-types";
import { createMockSSEStream } from "../create-mock-sse-stream";

describe("GroqPlugin", () => {
    it("should parse SSE lines correctly and return partial text + [DONE]", async () => {
        // Mock fetch to return a mock SSE stream
        const fakeFetch = () =>
            Promise.resolve({
                ok: true,
                status: 200,
                body: createMockSSEStream(
                    [
                        JSON.stringify({ choices: [{ delta: { content: "Hello " } }] }),
                        JSON.stringify({ choices: [{ delta: { content: "world!" } }] })
                    ],
                    {
                        endWithDone: true,
                        delayMs: 0,
                    }
                ),
            } as Response);

        const originalFetch = globalThis.fetch;
        (globalThis.fetch as unknown) = fakeFetch;

        try {
            const plugin = new GroqPlugin("fakeKey", "https://api.groq.com");
            const params: SSEEngineParams = {
                userMessage: "Test user message",
                plugin,
                handlers: {},
            };

            // Prepare request
            const reader = await plugin.prepareRequest(params);

            // Read the SSE lines from the plugin's returned reader
            const decoder = new TextDecoder();
            let fullString = "";
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                fullString += decoder.decode(value);
            }

            // Test parseServerSentEvent logic
            const partial1 = plugin.parseServerSentEvent(
                `data: ${JSON.stringify({ choices: [{ delta: { content: "Hello " } }] })}`
            );
            const partial2 = plugin.parseServerSentEvent(
                `data: ${JSON.stringify({ choices: [{ delta: { content: "world!" } }] })}`
            );
            const doneSignal = plugin.parseServerSentEvent(`data: [DONE]`);

            expect(partial1).toBe("Hello ");
            expect(partial2).toBe("world!");
            expect(doneSignal).toBe("[DONE]");

            // Verify the raw SSE lines
            expect(fullString).toContain("data: {\"choices\":[{\"delta\":{\"content\":\"Hello ");
            expect(fullString).toContain("[DONE]");
        } finally {
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
            const plugin = new GroqPlugin("fakeKey", "https://api.groq.com");
            const params: SSEEngineParams = {
                userMessage: "Test user message",
                plugin,
                handlers: {},
            };

            await expect(plugin.prepareRequest(params)).rejects.toThrow(/Groq API error/);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it("should handle invalid JSON in SSE data", () => {
        const plugin = new GroqPlugin("fakeKey", "https://api.groq.com");
        const result = plugin.parseServerSentEvent("data: {invalid json}");
        expect(result).toBeNull();
    });

    it("should handle empty delta content in SSE data", () => {
        const plugin = new GroqPlugin("fakeKey", "https://api.groq.com");
        const result = plugin.parseServerSentEvent(
            `data: ${JSON.stringify({ choices: [{ delta: {} }] })}`
        );
        expect(result).toBeNull();
    });
}); 