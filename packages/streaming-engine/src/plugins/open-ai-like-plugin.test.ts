import { describe, it, expect } from "bun:test";
import { OpenAiLikePlugin } from "./open-ai-like-plugin";
import type { SSEEngineParams } from "../streaming-types";
import OpenAI from "openai";

describe("OpenAiLikePlugin", () => {
    it("should parse SSE lines correctly and handle streaming", async () => {
        // Mock OpenAI client with a fake streaming response
        const mockStream = {
            async *[Symbol.asyncIterator]() {
                yield { choices: [{ delta: { content: "Hello " } }] };
                yield { choices: [{ delta: { content: "world!" } }] };
            },
        };

        const mockOpenAI = {
            chat: {
                completions: {
                    create: async () => mockStream,
                },
            },
        } as unknown as OpenAI;

        const plugin = new OpenAiLikePlugin(mockOpenAI, "gpt-3.5-turbo");
        const params: SSEEngineParams = {
            userMessage: "Test message",
            plugin,
            handlers: {},
        };

        const readable = await plugin.prepareRequest(params);
        const reader = readable.getReader();

        const decoder = new TextDecoder();
        let fullString = "";
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            fullString += decoder.decode(value);
        }

        // Test parseServerSentEvent logic
        const partial1 = plugin.parseServerSentEvent('data: "Hello "');
        const partial2 = plugin.parseServerSentEvent('data: "world!"');
        const doneSignal = plugin.parseServerSentEvent("data: [DONE]");

        expect(partial1).toBe("Hello ");
        expect(partial2).toBe("world!");
        expect(doneSignal).toBe("[DONE]");

        // Verify the raw SSE output contains our streamed content
        expect(fullString).toContain('"Hello "');
        expect(fullString).toContain('"world!"');
        expect(fullString).toContain("[DONE]");
    });

    it("should handle streaming errors gracefully", async () => {
        const expectedError = new Error("Stream error");
        const mockStream = {
            async *[Symbol.asyncIterator]() {
                throw expectedError;
            },
        };

        const mockOpenAI = {
            chat: {
                completions: {
                    create: async () => mockStream,
                },
            },
        } as unknown as OpenAI;

        const plugin = new OpenAiLikePlugin(mockOpenAI, "gpt-3.5-turbo");
        const params: SSEEngineParams = {
            userMessage: "Test message",
            plugin,
            handlers: {},
        };

        const readable = await plugin.prepareRequest(params);
        const reader = readable.getReader();

        try {
            await reader.read();
            throw new Error("Expected stream to throw");
        } catch (error) {
            expect(error).toBe(expectedError);
        }
    });

    it("should handle non-string SSE data", () => {
        const plugin = new OpenAiLikePlugin({} as OpenAI, "gpt-3.5-turbo");
        const result = plugin.parseServerSentEvent("data: 123");
        expect(result).toBe("123"); // The payload should be converted to string
    });

    it("should handle invalid SSE format", () => {
        const plugin = new OpenAiLikePlugin({} as OpenAI, "gpt-3.5-turbo");
        const result = plugin.parseServerSentEvent("invalid line");
        expect(result).toBeNull();
    });

    it("should respect debug option", async () => {
        let debugCalled = false;
        const originalDebug = console.debug;
        console.debug = () => { debugCalled = true; };
        
        const mockStream = {
            async *[Symbol.asyncIterator]() {
                yield { choices: [{ delta: { content: "test" } }] };
            },
        };

        const mockOpenAI = {
            chat: {
                completions: {
                    create: async () => mockStream,
                },
            },
        } as unknown as OpenAI;

        const plugin = new OpenAiLikePlugin(mockOpenAI, "gpt-3.5-turbo");
        const params: SSEEngineParams = {
            userMessage: "Test message",
            plugin,
            handlers: {},
            options: { debug: true },
        };

        await plugin.prepareRequest(params);
        expect(debugCalled).toBe(true);
        console.debug = originalDebug;
    });
}); 