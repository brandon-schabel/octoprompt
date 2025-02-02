/* open-router-structured-plugin.test.ts */
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { OpenRouterStructuredPlugin } from "@bnk/ai";
import { createMockSSEStream } from "@bnk/ai";
import { z } from "zod";
import { OpenRouterProviderService } from "@/services/model-providers/providers/open-router-provider";
import { zodToStructuredJsonSchema } from "shared/index";
import { extractJsonObjects, fetchStructuredOutput, parseStructuredJson, stripTripleBackticks } from "./structured-output-fetcher";

/**
 * A simple object schema for testing.
 * We'll ask the LLM to produce { greeting: string; count: number }
 */
const MyTestSchema = z.object({
    greeting: z.string(),
    count: z.number(),
});
type MyTestSchemaType = z.infer<typeof MyTestSchema>;

describe("fetchStructuredOutput", () => {
    let originalProcessMessage: any;

    beforeEach(() => {
        originalProcessMessage = OpenRouterProviderService.prototype.processMessage;
    });

    afterEach(() => {
        OpenRouterProviderService.prototype.processMessage = originalProcessMessage;
    });

    it("should handle a well-formed JSON response with triple backticks (markdown style)", async () => {
        const wellFormedChunks = [
            "Hello user, I'm preparing JSON...\n",
            "```json\n",
            '{"greeting": "Hello, world!", "count": 42}',
            "\n```",
        ];

        const mockStream = createMockSSEStream(wellFormedChunks, {
            endWithDone: true,
            delayMs: 0,
        });
        OpenRouterProviderService.prototype.processMessage = mock(async () => mockStream);

        const result = await fetchStructuredOutput(new OpenRouterProviderService(), {
            userMessage: "Give me a greeting object",
            zodSchema: MyTestSchema,
        });

        expect(result).toEqual({
            greeting: "Hello, world!",
            count: 42,
        });
    });

    it("should handle partial SSE chunks that eventually form valid JSON (no triple backticks)", async () => {
        const partialJsonChunks = [
            '{"greet',
            'ing":"He',
            'llo"}',
        ];
        // The final chunk includes the required fields
        const finalJsonChunk = '{"greeting":"Hello again","count":99}';

        const mockStream = createMockSSEStream(
            [...partialJsonChunks, finalJsonChunk],
            { endWithDone: true, delayMs: 0 }
        );
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
        const brokenChunks = [
            "```json\n",
            '{"greeting": "Hello there",',
            // missing closing brace
        ];
        const mockStream = createMockSSEStream(brokenChunks, {
            endWithDone: true,
            delayMs: 0,
        });
        OpenRouterProviderService.prototype.processMessage = mock(async () => mockStream);

        await expect(
            fetchStructuredOutput(new OpenRouterProviderService(), {
                userMessage: "Broken JSON example",
                zodSchema: MyTestSchema,
            })
        ).rejects.toThrow("Model response did not contain valid JSON.");
    });

    it("should reject if the JSON does not match the Zod schema", async () => {
        // Missing "count" field
        const invalidJson = `{
      "greeting": "I'm missing count!"
    }`;
        const chunks = ["```json\n", invalidJson, "\n```"];
        const mockStream = createMockSSEStream(chunks, {
            endWithDone: true,
            delayMs: 0,
        });
        OpenRouterProviderService.prototype.processMessage = mock(async () => mockStream);

        await expect(
            fetchStructuredOutput(new OpenRouterProviderService(), {
                userMessage: "Schema mismatch test",
                zodSchema: MyTestSchema,
            })
        ).rejects.toThrow("Structured output did not match the expected schema.");
    });

    it("should handle extraneous comments or trailing commas by default strip function", async () => {
        const withComments = `
      \`\`\`json
      {
        // This is a comment
        "greeting": "Hello with trailing comma",
        "count": 123, 
      }
      \`\`\`
    `;

        const mockStream = createMockSSEStream([withComments], {
            endWithDone: true,
            delayMs: 0,
        });
        OpenRouterProviderService.prototype.processMessage = mock(async () => mockStream);

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
        const mockStream = createMockSSEStream(
            [`{"greeting": "Strict test", "count": 10}`],
            { endWithDone: true, delayMs: 0 }
        );
        const openRouterService = new OpenRouterProviderService();

        OpenRouterProviderService.prototype.processMessage = mock(async (args) => {
            const { options } = args;
            expect(options?.response_format?.type).toBe("json_schema");

            // Check that the built schema matches
            const builtSchema = zodToStructuredJsonSchema(MyTestSchema);
            expect(options?.response_format?.json_schema?.schema).toEqual(builtSchema);
            return mockStream;
        });

        const result = await fetchStructuredOutput(openRouterService, {
            userMessage: "Schema check test",
            zodSchema: MyTestSchema,
            schemaName: "MyStrictOutput",
        });

        expect(result).toEqual({ greeting: "Strict test", count: 10 });
    });

    // -------- NEW TESTS FOR ADDITIONAL COVERAGE --------

    it("should successfully parse when final parse fails but incremental parse succeeded", async () => {
        /**
         * We'll produce valid JSON in the middle of the stream,
         * but then some extra invalid text at the very end that breaks final parse.
         * Our code should still return the last valid parse (if your implementation
         * stores it, e.g., `lastValidParse`).
         */
        const goodJson = '{"greeting": "Mid-stream valid JSON", "count": 777}';
        const invalidTail = "some random text that breaks final parse";

        const mockStream = createMockSSEStream(
            [goodJson, invalidTail],
            { endWithDone: true, delayMs: 0 }
        );
        OpenRouterProviderService.prototype.processMessage = mock(async () => mockStream);

        // If your code uses `lastValidParse`, it should return the JSON from that parse
        const result = await fetchStructuredOutput(new OpenRouterProviderService(), {
            userMessage: "Partial valid then invalid tail",
            zodSchema: MyTestSchema,
        });

        expect(result).toEqual({
            greeting: "Mid-stream valid JSON",
            count: 777,
        });
    });

    it("should parse and validate nested JSON objects if the schema includes them", async () => {
        const nestedSchema = z.object({
            nested: z.object({
                greeting: z.string(),
                count: z.number(),
            }),
        });
        const nestedJson = `{
      "nested": {
        "greeting": "Nested hello",
        "count": 3
      }
    }`;

        const mockStream = createMockSSEStream([nestedJson], {
            endWithDone: true,
            delayMs: 0,
        });
        OpenRouterProviderService.prototype.processMessage = mock(async () => mockStream);

        const result = await fetchStructuredOutput(new OpenRouterProviderService(), {
            userMessage: "Nested JSON test",
            zodSchema: nestedSchema,
        });

        expect(result).toEqual({
            nested: {
                greeting: "Nested hello",
                count: 3,
            },
        });
    });

    it("should handle multiple JSON objects interleaved, returning the final valid parse", async () => {
        // Suppose the model starts with a small valid JSON,
        // then more data that forms a bigger valid JSON at the end.
        // Our code should end up returning the bigger final parse if it’s valid.
        const chunk1 = `{"greeting":"Preliminary","count":1}`;
        const chunk2 = `This is some text in between. `;
        const chunk3 = `{"greeting":"Final greeting","count":999}`;

        const mockStream = createMockSSEStream([chunk1, chunk2, chunk3], {
            endWithDone: true,
            delayMs: 0,
        });
        OpenRouterProviderService.prototype.processMessage = mock(async () => mockStream);

        const result = await fetchStructuredOutput(new OpenRouterProviderService(), {
            userMessage: "Multiple JSON objects test",
            zodSchema: MyTestSchema,
        });

        // We expect the final object
        expect(result).toEqual({
            greeting: "Final greeting",
            count: 999,
        });
    });

    it("should ignore garbage text before the JSON starts", async () => {
        const mockStream = createMockSSEStream(
            [
                "Some irrelevant lines\nthat are not JSON\n",
                '{"greeting":"Finally JSON","count":12}',
            ],
            { endWithDone: true, delayMs: 0 }
        );
        OpenRouterProviderService.prototype.processMessage = mock(async () => mockStream);

        const result = await fetchStructuredOutput(new OpenRouterProviderService(), {
            userMessage: "Ignore preamble lines",
            zodSchema: MyTestSchema,
        });

        expect(result).toEqual({
            greeting: "Finally JSON",
            count: 12,
        });
    });

    it("should ignore extraneous text after the JSON is complete", async () => {
        // The code might accumulate text, but JSON is already complete in the stream
        // Then more text appears
        const chunks = [
            '{"greeting":"Hello once more","count":2023}',
            "\nThis text is extraneous\n",
        ];

        const mockStream = createMockSSEStream(chunks, {
            endWithDone: true,
            delayMs: 0,
        });
        OpenRouterProviderService.prototype.processMessage = mock(async () => mockStream);

        const result = await fetchStructuredOutput(new OpenRouterProviderService(), {
            userMessage: "Extraneous trailing text",
            zodSchema: MyTestSchema,
        });

        expect(result).toEqual({
            greeting: "Hello once more",
            count: 2023,
        });
    });

    it("should handle an empty stream gracefully and throw parse error", async () => {
        const mockStream = createMockSSEStream([], { endWithDone: true, delayMs: 0 });
        OpenRouterProviderService.prototype.processMessage = mock(async () => mockStream);

        await expect(
            fetchStructuredOutput(new OpenRouterProviderService(), {
                userMessage: "Empty stream",
                zodSchema: MyTestSchema,
            })
        ).rejects.toThrow("Model response did not contain valid JSON.");
    });
});


describe("stripTripleBackticks", () => {
    describe("stripTripleBackticks", () => {
        it("should remove triple backticks and extract the inner content", () => {
            const input = "```json\n{\"key\": \"value\"}\n```";
            const result = stripTripleBackticks(input);
            expect(result).toBe('{"key": "value"}');
        });

        it("should return trimmed text if no triple backticks exist", () => {
            const input = "   {\"key\": \"value\"}   ";
            const result = stripTripleBackticks(input);
            expect(result).toBe('{"key": "value"}');
        });

        it("should remove comments and trailing commas", () => {
            const input = "```json\n{\n  // This is a comment\n  \"greeting\": \"Hello\",\n  \"count\": 42,\n}\n```";
            const result = stripTripleBackticks(input);
            expect(JSON.parse(result)).toEqual({ greeting: "Hello", count: 42 });
        });
    });

    describe("extractJsonObjects", () => {
        it("should extract a single JSON object from text", () => {
            const input = "Some random text {\"key\":\"value\"} some more text";
            const results = extractJsonObjects(input);
            expect(results.length).toBe(1);
            expect(JSON.parse(results[0])).toEqual({ key: "value" });
        });

        it("should extract multiple non-overlapping JSON objects from text", () => {
            const input = "Start {\"a\":1} middle {\"b\":2} end";
            const results = extractJsonObjects(input);
            expect(results.length).toBe(2);
            expect(JSON.parse(results[0])).toEqual({ a: 1 });
            expect(JSON.parse(results[1])).toEqual({ b: 2 });
        });

        it("should extract nested JSON objects correctly", () => {
            const input = "Text {\"outer\": {\"inner\": \"value\"}} end";
            const results = extractJsonObjects(input);
            expect(results.length).toBe(1);
            expect(JSON.parse(results[0])).toEqual({ outer: { inner: "value" } });
        });

        it("should handle JSON objects with braces inside strings", () => {
            const input = 'Prefix {"key": "value with } brace"} Suffix';
            const results = extractJsonObjects(input);
            expect(results.length).toBe(1);
            expect(JSON.parse(results[0])).toEqual({ key: "value with } brace" });
        });

        it("should return an empty array if no valid JSON is found", () => {
            const input = "No JSON here!";
            const results = extractJsonObjects(input);
            expect(results.length).toBe(0);
        });
    });

    describe("parseStructuredJson", () => {
        it("should parse valid JSON from cleaned text with triple backticks", () => {
            const input = "```json\n{\"key\":\"value\"}\n```";
            const result = parseStructuredJson(input);
            expect(result).toEqual({ key: "value" });
        });

        it("should parse valid JSON from text with extraneous data", () => {
            const input = "Garbage before {\"a\":1} garbage after";
            const result = parseStructuredJson(input);
            expect(result).toEqual({ a: 1 });
        });

        it("should return the last valid JSON object when multiple are present", () => {
            const input = "First JSON: {\"a\":1} then second JSON: {\"b\":2}";
            const result = parseStructuredJson(input);
            expect(result).toEqual({ b: 2 });
        });

        it("should return null if no valid JSON is present", () => {
            const input = "This is not JSON at all.";
            const result = parseStructuredJson(input);
            expect(result).toBeNull();
        });

        it("should return null if the cleaned JSON is not an object (e.g. a string)", () => {
            const input = '```json\n"Just a string"\n```';
            const result = parseStructuredJson(input);
            expect(result).toBeNull();
        });
    });
});
    