/* open-router-structured-plugin.test.ts */
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { OpenRouterStructuredPlugin } from "@bnk/ai";
import { createMockSSEStream } from "@bnk/ai";
import type {
    SSEEngineParams,
    SSEEngineHandlers,
} from "@bnk/ai";
import { z } from "zod";
import { OpenRouterProviderService } from "@/services/model-providers/providers/open-router-provider";
import { zodToStructuredJsonSchema } from "shared/index";
import { fetchStructuredOutput } from "./structured-output-fetcher";


/**
 * A simple object schema for testing. 
 * We'll ask the LLM to produce { greeting: string; count: number } 
 */
const MyTestSchema = z.object({
    greeting: z.string(),
    count: z.number(),
});

type MyTestSchemaType = z.infer<typeof MyTestSchema>;

/**
 * We will mock the provider’s `processMessage` method to return
 * a controlled SSE stream. This way, we can feed partial JSON strings,
 * triple backticks, or invalid data as we like.
 */
describe("fetchStructuredOutput", () => {
    // We’ll store references to the original method so we can restore it after tests
    let originalProcessMessage: any;

    beforeEach(() => {
        originalProcessMessage = OpenRouterProviderService.prototype.processMessage;
    });

    afterEach(() => {
        OpenRouterProviderService.prototype.processMessage = originalProcessMessage;
    });

    it("should handle a well-formed JSON response with triple backticks (markdown style)", async () => {
        // The final SSE chunk includes the triple backticks around JSON
        const wellFormedChunks = [
            "Hello user, I'm preparing JSON...\n",
            "```json\n",
            '{"greeting": "Hello, world!", "count": 42}',
            "\n```",
        ];

        // Create an SSE mock that finishes with these chunks, and ends with [DONE]
        const mockStream = createMockSSEStream([...wellFormedChunks], { endWithDone: true, delayMs: 0 });

        // Mock processMessage to return our SSE stream
        OpenRouterProviderService.prototype.processMessage = mock(async () => mockStream);

        // Execute fetchStructuredOutput
        const result = await fetchStructuredOutput(new OpenRouterProviderService(), {
            userMessage: "Give me a greeting object",
            zodSchema: MyTestSchema,
        });

        // Validate that the parse & Zod check passed
        expect(result).toEqual({
            greeting: "Hello, world!",
            count: 42,
        });
    });

    it("should handle partial SSE chunks that eventually form valid JSON (no triple backticks)", async () => {
        // For example, we can break the JSON into multiple chunks that come in partial SSE lines
        const partialJsonChunks = [
            '{"greet',
            'ing":"He',
            'llo"}',
        ];

        // That final JSON is missing the "count" property, so let's add it
        // We'll simulate the model eventually returning everything in multiple lines
        const finalJsonChunk = '{"greeting":"Hello again","count":99}';

        const mockStream = createMockSSEStream([...partialJsonChunks, finalJsonChunk], {
            endWithDone: true,
            delayMs: 0,
        });

        // Mock the SSE call
        OpenRouterProviderService.prototype.processMessage = mock(async () => mockStream);

        const result = await fetchStructuredOutput(new OpenRouterProviderService(), {
            userMessage: "Split JSON example",
            zodSchema: MyTestSchema,
        });

        expect(result).toEqual({
            greeting: "Hello again",
            count: 99,
        });
    });

    it("should throw if the JSON is incomplete/broken by the time streaming ends", async () => {
        // SSE chunks that never produce valid JSON
        const brokenChunks = [
            "```json\n",
            '{"greeting": "Hello there",',
            // no closing curly bracket or other fields
        ];

        // The SSE finishes
        const mockStream = createMockSSEStream(brokenChunks, { endWithDone: true, delayMs: 0 });

        OpenRouterProviderService.prototype.processMessage = mock(async () => mockStream);

        // Expect an error from fetchStructuredOutput because JSON parse fails
        await expect(
            fetchStructuredOutput(new OpenRouterProviderService(), {
                userMessage: "Broken JSON example",
                zodSchema: MyTestSchema,
            })
        ).rejects.toThrow("Model response did not contain valid JSON.");
    });

    it("should reject if the JSON does not match the Zod schema", async () => {
        // Provide an object missing the 'count' field
        const invalidJson = `{
      "greeting": "I'm missing count!"
    }`;

        // SSE stream with triple backticks around it
        const chunks = [
            "```json\n",
            invalidJson,
            "\n```",
        ];

        const mockStream = createMockSSEStream(chunks, { endWithDone: true, delayMs: 0 });
        OpenRouterProviderService.prototype.processMessage = mock(async () => mockStream);

        // Because `count` is required, the Zod parse fails
        await expect(
            fetchStructuredOutput(new OpenRouterProviderService(), {
                userMessage: "Schema mismatch test",
                zodSchema: MyTestSchema,
            })
        ).rejects.toThrow("Structured output did not match the expected schema.");
    });

    it("should handle extraneous comments or trailing commas by default strip function", async () => {
        // The LLM might produce comments, trailing commas, etc.
        const withComments = `
    \`\`\`json
    {
      // This is a comment
      "greeting": "Hello with trailing comma",
      "count": 123, 
    }
    \`\`\`
    `;

        const mockStream = createMockSSEStream([withComments], { endWithDone: true, delayMs: 0 });
        OpenRouterProviderService.prototype.processMessage = mock(async () => mockStream);

        // The strip logic should remove the comment and trailing comma. 
        // Then we parse & validate with Zod.
        const result = await fetchStructuredOutput(new OpenRouterProviderService(), {
            userMessage: "LLM output with comments",
            zodSchema: MyTestSchema,
        });

        expect(result).toEqual({
            greeting: "Hello with trailing comma",
            count: 123,
        });
    });

    it("should reflect 'strict' JSON schema usage in the request if desired", async () => {
        // We only test that the correct request format is built – 
        // but let's confirm we can convert Zod to JSON schema and feed it in.
        const mockStream = createMockSSEStream(
            [`{"greeting": "Strict test", "count": 10}`],
            { endWithDone: true, delayMs: 0 }
        );
        const openRouterService = new OpenRouterProviderService();

        // Spy on the method to confirm request is built with the correct schema
        OpenRouterProviderService.prototype.processMessage = mock(async (args) => {
            const { options } = args;
            expect(options?.response_format?.type).toBe("json_schema");

            // Check the dynamic JSON schema matches our Zod
            const builtSchema = zodToStructuredJsonSchema(MyTestSchema);
            expect(options?.response_format?.json_schema?.schema).toEqual(builtSchema);
            return mockStream;
        });

        const result = await fetchStructuredOutput(openRouterService, {
            userMessage: "Schema check test",
            zodSchema: MyTestSchema,
            schemaName: "MyStrictOutput",
        });

        // The final parse result
        expect(result).toEqual({ greeting: "Strict test", count: 10 });
    });
});