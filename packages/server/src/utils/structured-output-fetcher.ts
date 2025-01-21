// packages/server/src/services/model-providers/structured-output-fetcher.ts

import { OpenRouterProviderService } from "@/services/model-providers/providers/open-router-provider"
import { z, ZodTypeAny } from "zod"

/**
 * Defines the input parameters for requesting structured output.
 * @template T Parsed type after Zod validation
 */
export interface StructuredOutputRequest<T> {
    /**
     * The text prompt or user message you want to send to the LLM.
     */
    userMessage: string
    /**
     * An optional system instruction or higher-level directive to control the model.
     */
    systemMessage?: string

    /**
     * A Zod schema representing the final shape you expect from the LLM.
     * The returned data is validated against this schema.
     */
    zodSchema: z.ZodType<T>

    /**
     * A JSON Schema object matching the same structure as `zodSchema`.
     * This is passed to OpenRouter for server-side validation of the LLM output.
     */
    jsonSchema: {
        type: "object" | "array" | "string" | "number" | "boolean"
        [key: string]: any
    }

    /**
     * Name for the structured output block, used in OpenRouter’s `response_format.json_schema`.
     */
    schemaName?: string

    /**
     * Optional model name. Defaults to something like "openai/gpt-3.5-turbo" or any other model ID recognized by OpenRouter.
     */
    model?: string

    /**
     * Temperature value for the LLM (0.0 - 1.0). 0.0 = deterministic, 1.0 = more creative.
     */
    temperature?: number

    /**
     * An optional chatId if you want to store conversation threads in your DB.
     */
    chatId?: string

    /**
     * If you want to associate the streaming partial text with a temporary message ID.
     */
    tempId?: string
}

/**
 * A standalone function to get a structured JSON response validated by OpenRouter AND your local Zod schema.
 */
export async function fetchStructuredOutput<T>(
    openRouterService: OpenRouterProviderService,
    params: StructuredOutputRequest<T>
): Promise<T> {
    const {
        userMessage,
        systemMessage,
        zodSchema,
        jsonSchema,
        schemaName = "StructuredResponse",
        model = "deepseek/deepseek-r1",
        temperature = 0.7,
        chatId = "structured-chat",
        tempId
    } = params

    // 1) Invoke the streaming request on OpenRouter with "json_schema" response format
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
                    strict: true, // force the LLM to only return valid JSON
                    // @ts-ignore
                    schema: jsonSchema
                }
            }
        }
    })

    // 2) Read the entire stream into a single string
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let rawOutput = ""

    while (true) {
        const { done, value } = await reader.read()
        if (done) {
            break
        }
        rawOutput += decoder.decode(value)
    }

    // 3) Attempt to parse the final text as JSON
    let json: unknown
    try {
        json = JSON.parse(stripTripleBackticks(rawOutput))
    } catch (err) {
        console.error("[fetchStructuredOutput] Failed to parse JSON from model:", err)
        console.error("Raw model output was:", rawOutput)
        throw new Error("Model response did not contain valid JSON.")
    }

    // 4) Validate the parsed JSON with your Zod schema for type safety
    const parsed = zodSchema.safeParse(json)
    if (!parsed.success) {
        console.error("[fetchStructuredOutput] Zod validation failed:", parsed.error)
        console.error("Raw JSON output was:", JSON.stringify(json, null, 2))
        throw new Error("Structured output did not match the expected schema.")
    }

    // 5) Return fully validated result
    return parsed.data
}

/**
 * Utility function that strips triple backticks (e.g., ```json ... ```).
 * If there's no backtick wrapping, returns the original string.
 */
function stripTripleBackticks(text: string): string {
    const tripleBacktickRegex = /```(?:json)?([\s\S]*?)```/
    const match = text.match(tripleBacktickRegex)
    if (match) {
        return match[1].trim()
    }
    return text.trim()
}