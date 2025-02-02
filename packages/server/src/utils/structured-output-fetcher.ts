// packages/server/src/utils/structured-output-fetcher.ts
import { OpenRouterProviderService } from "@/services/model-providers/providers/open-router-provider";
import { z } from "zod";
import { zodToStructuredJsonSchema, toOpenRouterSchema } from "shared/src/structured-outputs/structured-output-utils";

/**
 * Strips triple backticks and also removes JS/JSON-style comments & trailing commas.
 * Returns the cleaned text.
 */
export function stripTripleBackticks(text: string): string {
    // First remove triple backticks if present
    const tripleBacktickRegex = /```(?:json)?([\s\S]*?)```/;
    const match = text.match(tripleBacktickRegex);
    const content = match ? match[1].trim() : text.trim();

    // Remove comments and trailing commas
    return content
        .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "")
        .replace(/,(\s*[}\]])/g, "$1");
}

/**
 * Extracts top-level (non-overlapping) JSON substrings from the text using a balanced-brackets approach.
 */
export function extractJsonObjects(text: string): string[] {
    const results: string[] = [];
    let i = 0;
    while (i < text.length) {
        const char = text[i];
        if (char === "{" || char === "[") {
            const start = i;
            const stack = [char];
            let inString = false;
            let escape = false;
            let found = false;
            let j = i + 1;
            for (; j < text.length; j++) {
                const c = text[j];
                if (inString) {
                    if (escape) {
                        escape = false;
                    } else if (c === "\\") {
                        escape = true;
                    } else if (c === '"') {
                        inString = false;
                    }
                } else {
                    if (c === '"') {
                        inString = true;
                    } else if (c === "{" || c === "[") {
                        stack.push(c);
                    } else if (c === "}" || c === "]") {
                        stack.pop();
                        if (stack.length === 0) {
                            const candidate = text.substring(start, j + 1);
                            try {
                                JSON.parse(candidate);
                                results.push(candidate);
                            } catch (e) {
                                // Ignore invalid JSON substrings.
                            }
                            found = true;
                            break;
                        }
                    }
                }
            }
            if (found) {
                i = j; // Skip over the entire JSON block to avoid nested extraction.
            }
        }
        i++;
    }
    return results;
}

/**
 * Attempts to parse the structured JSON from the raw output.
 * First, it tries to parse the cleaned text.
 * If that fails or doesn’t yield an object/array, it falls back to extracting
 * the last valid JSON substring from the raw output.
 */
export function parseStructuredJson(rawOutput: string): unknown {
    const cleaned = stripTripleBackticks(rawOutput);
    try {
        const parsed = JSON.parse(cleaned);
        if (typeof parsed === "object" && parsed !== null) {
            return parsed;
        }
    } catch (e) {
        // Fall through to extraction below.
    }
    const candidates = extractJsonObjects(rawOutput);
    for (let i = candidates.length - 1; i >= 0; i--) {
        try {
            const candidateParsed = JSON.parse(candidates[i]);
            if (typeof candidateParsed === "object" && candidateParsed !== null) {
                return candidateParsed;
            }
        } catch (e) {
            // Ignore parse errors.
        }
    }
    return null;
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
        model = "qwen/qwen-plus",
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
            chunk = chunk.replace("data: [DONE]", "").replace("[DONE]", "");
            rawOutput += chunk;
            break;
        }

        // Remove "data: " prefix from each line
        chunk = chunk.replace(/^data:\s?/gm, "");

        rawOutput += chunk;
    }

    // 4) Attempt final JSON parse using the enhanced logic.
    const data: unknown = parseStructuredJson(rawOutput);
    if (data === null) {
        console.error("[fetchStructuredOutput] Failed to extract valid JSON from raw output:");
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