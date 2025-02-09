// packages/server/src/tests/promptimizer-service.test.ts

import { describe, test, expect, beforeEach, mock, spyOn } from "bun:test";
import { optimizePrompt } from "@/services/promptimizer-service";
import { openRouterProvider } from "@/services/model-providers/providers/open-router-provider";

describe("Promptimizer Service", () => {
    let processMessageMock: ReturnType<typeof mock>;

    beforeEach(() => {
        // Reset the mock before each test
        processMessageMock = mock(async () => {
            // Return a readable stream that yields some text
            const text = "Optimized prompt example";
            const encoder = new TextEncoder();
            const bytes = encoder.encode(text);

            return new Response(new ReadableStream({
                start(controller) {
                    controller.enqueue(bytes);
                    controller.close();
                }
            }));
        });

        // Spy on the actual openRouterProvider
        spyOn(openRouterProvider, "processMessage").mockImplementation(processMessageMock);
    });

    test("optimizePrompt returns empty string if userContext is empty", async () => {
        const result = await optimizePrompt("");
        expect(result).toBe("");
        expect(processMessageMock.mock.calls.length).toBe(0);
    });

    test("optimizePrompt calls openRouterProvider.processMessage with correct args", async () => {
        const userContext = "Make this prompt better";
        await optimizePrompt(userContext);
        expect(processMessageMock.mock.calls.length).toBe(1);

        const callArgs = processMessageMock.mock.calls[0].args[0];
        expect(callArgs?.userMessage).toBe(userContext);
        expect(callArgs?.provider).toBe("openrouter");
    });

    test("optimizePrompt returns the final text from SSE stream (trimmed)", async () => {
        const userContext = "Refine me, please!";
        const result = await optimizePrompt(userContext);
        expect(result).toBe("Optimized prompt example");
    });

    test("if an error is thrown, logs it and returns the original user message", async () => {
        processMessageMock.mockImplementationOnce(async () => {
            throw new Error("Network failure");
        });
        const consoleSpy = mock(() => { });
        const originalError = console.error;
        console.error = consoleSpy;

        const userContext = "Error test prompt";
        const result = await optimizePrompt(userContext);
        expect(result).toBe(userContext);

        // Ensure error was logged
        expect(consoleSpy.mock.calls.length).toBeGreaterThan(0);

        console.error = originalError;
    });
});