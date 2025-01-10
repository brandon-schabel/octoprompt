import { describe, it, expect } from "bun:test";
import { OllamaPlugin } from "./ollama-plugin";
import type { SSEEngineParams } from "../streaming-types";
import { createMockSSEStream } from "../create-mock-sse-stream";

describe("OllamaPlugin", () => {
    it("should parse SSE lines correctly and return content", async () => {
        const fakeFetch = () =>
            Promise.resolve({
                ok: true,
                status: 200,
                body: createMockSSEStream(
                    [
                        JSON.stringify({ message: { content: "Hello " } }),
                        JSON.stringify({ message: { content: "world!" } })
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
            const plugin = new OllamaPlugin("http://localhost:11434");
            const params: SSEEngineParams = {
                userMessage: "Test message",
                plugin,
                handlers: {},
            };

            const reader = await plugin.prepareRequest(params);

            const decoder = new TextDecoder();
            let fullString = "";
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                fullString += decoder.decode(value);
            }

            // Test parseServerSentEvent logic
            const partial1 = plugin.parseServerSentEvent(
                JSON.stringify({ message: { content: "Hello " } })
            );
            const partial2 = plugin.parseServerSentEvent(
                JSON.stringify({ message: { content: "world!" } })
            );

            expect(partial1).toBe("Hello ");
            expect(partial2).toBe("world!");

            // Verify the raw SSE output
            expect(fullString).toContain("data: {\"message\":{\"content\":\"Hello ");
            expect(fullString).toContain("world!");
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
            } as Response);

        const originalFetch = globalThis.fetch;
        (globalThis.fetch as unknown) = fakeFetch;

        try {
            const plugin = new OllamaPlugin("http://localhost:11434");
            const params: SSEEngineParams = {
                userMessage: "Test message",
                plugin,
                handlers: {},
            };

            await expect(plugin.prepareRequest(params)).rejects.toThrow(/Ollama API error/);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it("should handle invalid JSON in SSE data", () => {
        const plugin = new OllamaPlugin("http://localhost:11434");
        const result = plugin.parseServerSentEvent("{invalid json}");
        expect(result).toBeNull();
    });

    it("should handle empty message content", () => {
        const plugin = new OllamaPlugin("http://localhost:11434");
        const result = plugin.parseServerSentEvent(
            JSON.stringify({ message: { } })
        );
        expect(result).toBeNull();
    });
}); 