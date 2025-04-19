// packages/server/src/services/structured-output-service.ts
import { structuredOutputSchemas, StructuredOutputType, InferStructuredOutput } from "shared/src/structured-outputs/structured-output-schema";
import { ApiError } from "shared";
// No longer need zodToStructuredJsonSchema or fetchStructuredOutput utils here
import { z } from "zod";
import { DEFAULT_MODEL_CONFIGS, APIProviders } from "shared";
// Import the refactored unified provider
import { unifiedProvider } from "./model-providers/providers/unified-provider-service";


interface GenerateStructuredOutputOptions<T extends StructuredOutputType> {
    outputType: T;
    userMessage: string; // Use userMessage instead of prompt for consistency
    systemMessage?: string;
    provider?: APIProviders; // Allow specifying provider
    model?: string;
    temperature?: number;
    chatId?: string; // Keep if needed for logging/context, but not directly used by generateObject
    // appendSchemaToPrompt is no longer needed, generateObject handles schema instruction
}

/**
 * Generate structured output using a specified schema "type."
 * Uses Vercel AI SDK's generateObject for validation and generation.
 */
export async function generateStructuredOutput<T extends StructuredOutputType>(
    params: GenerateStructuredOutputOptions<T>
): Promise<InferStructuredOutput<T>> {

    const cfg = DEFAULT_MODEL_CONFIGS['generate-structured-output']; // e.g., { provider: 'openai', model: 'gpt-4o', temperature: 0.1 }

    const {
        outputType,
        userMessage,
        systemMessage, // Pass this to the helper
        provider = cfg.provider as APIProviders || 'openai', // Default provider
        model = cfg.model,
        temperature = cfg.temperature,
        // chatId is not directly used by generateStructuredData, but might be useful contextually
    } = params;

    if (!model) {
        throw new ApiError(`Model not configured for generate-structured-output task.`, 500, "CONFIG_ERROR");
    }

    const zodSchema = structuredOutputSchemas[outputType];
    if (!zodSchema) {
        throw new ApiError(`Unknown structured output type: '${outputType}'`, 400, "SCHEMA_NOT_FOUND");
    }

    // Optional: Enhance system prompt if needed, but rely on generateObject primarily
    let finalSystemMessage = systemMessage ?? `Generate a JSON object based on the user's request, strictly conforming to the required schema. Output ONLY the JSON.`;

    try {
        // Use the generateStructuredData helper from the unified provider
        const validatedResult = await unifiedProvider.generateStructuredData({
            provider: provider,
            prompt: userMessage, // Pass user message as prompt
            schema: zodSchema as z.ZodType<InferStructuredOutput<T>>,
            systemMessage: finalSystemMessage, // Pass system message
            options: {
                model: model,
                temperature: temperature,
                // Add other options like maxTokens if needed
            },
        });

        return validatedResult;

    } catch (error: any) {
        // Catch errors from generateStructuredData (includes model errors, validation errors)
        console.error(`[StructuredOutputService] Error generating '${outputType}':`, error);
        throw new ApiError(
            `Failed to generate structured output of type '${outputType}': ${error.message || String(error)}`,
            error instanceof ApiError ? error.status : 500, // Preserve status code if already ApiError
            error instanceof ApiError ? error.code : "STRUCTURED_OUTPUT_ERROR"
        );
    }
}