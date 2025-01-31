// packages/server/src/utils/structured-output-fetcher.ts
import { OpenRouterProviderService } from "@/services/model-providers/providers/open-router-provider";
import { z } from "zod";
import { zodToStructuredJsonSchema, toOpenRouterSchema } from "shared/src/structured-outputs/structured-output-utils";

/**
 * Strips triple backticks and also removes JS/JSON-style comments & trailing commas.
 * Also attempts to find the last valid JSON object in the stream.
 */
function stripTripleBackticks(text: string): string {
    // First remove triple backticks if present
    const tripleBacktickRegex = /```(?:json)?([\s\S]*?)```/;
    const match = text.match(tripleBacktickRegex);
    const content = match ? match[1].trim() : text.trim();

    // Remove comments and trailing commas
    const withoutComments = content
        .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "")
        .replace(/,(\s*[}\]])/g, "$1");

    // Split by newlines and find the last non-empty line that might be JSON
    const lines = withoutComments.split(/\n/).map(line => line.trim()).filter(Boolean);

    // Try to find the last complete JSON object
    for (let i = lines.length - 1; i >= 0; i--) {
        try {
            // Test if this line parses as valid JSON
            JSON.parse(lines[i]);
            return lines[i];
        } catch (e) {
            // If it's not valid JSON, continue to the next line
            continue;
        }
    }

    // If we couldn't find any valid JSON, return the cleaned content
    return withoutComments;
}

export interface StructuredOutputRequest<T> {
    userMessage: string;
    systemMessage?: string;
    zodSchema: z.ZodType<T>;
    schemaName?: string;
    model?: string;
    temperature?: number;
    chatId?: string;
    tempId?: string;
}

export async function fetchStructuredOutput<T>(
    openRouterService: OpenRouterProviderService,
    params: StructuredOutputRequest<T>
): Promise<T> {
    const {
        userMessage,
        systemMessage,
        zodSchema,
        schemaName = "StructuredResponse",
        model = "deepseek/deepseek-r1",
        temperature = 0.7,
        chatId = "structured-chat",
        tempId,
    } = params;

    // 1) Convert Zod schema -> JSON schema -> OpenRouter schema
    const jsonSchema = zodToStructuredJsonSchema(zodSchema);
    const openRouterSchema = toOpenRouterSchema(jsonSchema);

    // 2) Begin SSE request
    const stream = await openRouterService.processMessage({
        chatId,
        userMessage,
        provider: "openrouter",
        systemMessage,
        tempId,
        options: {
            model,
            temperature,
            response_format: {
                type: "json_schema",
                json_schema: {
                    name: schemaName,
                    strict: true,
                    schema: openRouterSchema,
                },
            },
        },
    });

    // 3) Accumulate SSE lines into `rawOutput`, removing SSE prefix
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let rawOutput = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        let chunk = decoder.decode(value);

        // If the model signals end: "data: [DONE]" or just "[DONE]"
        if (chunk.includes("[DONE]")) {
            // Remove that line and stop
            chunk = chunk.replace("data: [DONE]", "").replace("[DONE]", "");
            rawOutput += chunk;
            break;
        }

        // Remove "data: " prefix from each line
        // So "data: ```json" becomes "```json", etc.
        chunk = chunk.replace(/^data:\s?/gm, "");

        rawOutput += chunk;
    }

    // 4) Attempt final JSON parse
    let data: unknown;
    try {
        console.log({ rawOutput })
        data = JSON.parse(stripTripleBackticks(rawOutput));
    } catch (err) {
        console.error("[fetchStructuredOutput] JSON parse error:", err);
        console.error("Raw output:", rawOutput);
        throw new Error("Model response did not contain valid JSON.");
    }


    // 5) Validate with Zod
    const parsed = zodSchema.safeParse(data);
    if (!parsed.success) {
        console.error("[fetchStructuredOutput] Zod validation failed:", parsed.error);
        console.error("Raw JSON output:", JSON.stringify(data, null, 2));
        throw new Error("Structured output did not match the expected schema.");
    }

    return parsed.data;
}