import { describe, it, expect } from "bun:test";
import { GeminiPlugin } from "./gemini-plugin";
import type { SSEEngineParams } from "../streaming-types";
import { createMockSSEStream } from "../create-mock-sse-stream";

describe("GeminiPlugin", () => {
    it("should parse SSE lines correctly and return content", async () => {
        const fakeFetch = () =>
            Promise.resolve({
                ok: true,
                status: 200,
                body: createMockSSEStream(
                    [
                        JSON.stringify({ candidates: [{ content: { parts: [{ text: "Hello " }] } }] }),
                        JSON.stringify({ candidates: [{ content: { parts: [{ text: "world!" }] } }] })
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
            const plugin = new GeminiPlugin("fakeKey", "http://localhost:3000", "modelId");
            const params: SSEEngineParams = {
                userMessage: "Test message",
                plugin,
                handlers: {},
            };

            const readable = await plugin.prepareRequest(params);
            const reader = readable.getReader()

            const decoder = new TextDecoder();
            let fullString = "";
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                fullString += decoder.decode(value);
            }

            // Test parseServerSentEvent logic
            const partial1 = plugin.parseServerSentEvent(
                `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: "Hello " }] } }] })}`
            );
            const partial2 = plugin.parseServerSentEvent(
                `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: "world!" }] } }] })}`
            );
            const doneSignal = plugin.parseServerSentEvent(`data: [DONE]`);

            expect(partial1).toBe("Hello ");
            expect(partial2).toBe("world!");
            expect(doneSignal).toBe("[DONE]");

            // Verify the raw SSE output
            expect(fullString).toContain("data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"Hello ");
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
                statusText: "Internal Server Error",
                text: () => Promise.resolve("Server error"),
            } as Response);

        const originalFetch = globalThis.fetch;
        (globalThis.fetch as unknown) = fakeFetch;

        try {
            const plugin = new GeminiPlugin("fakeKey", "http://localhost:3000", "modelId");
            const params: SSEEngineParams = {
                userMessage: "Test message",
                plugin,
                handlers: {},
            };

            await expect(plugin.prepareRequest(params)).rejects.toThrow(/Gemini API error/);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it("should handle invalid JSON in SSE data", () => {
        const plugin = new GeminiPlugin("fakeKey", "http://localhost:3000", "modelId");
        const result = plugin.parseServerSentEvent("data: {invalid json}");
        expect(result).toBeNull();
    });

    it("should handle empty content parts in SSE data", () => {
        const plugin = new GeminiPlugin("fakeKey", "http://localhost:3000", "modelId");
        const result = plugin.parseServerSentEvent(
            `data: ${JSON.stringify({ candidates: [{ content: { parts: [] } }] })}`
        );
        expect(result).toBeNull();
    });
}); 