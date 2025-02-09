import { structuredOutputSchemas, StructuredOutputType, InferStructuredOutput } from "shared/src/structured-outputs/structured-output-schema";
import { fetchStructuredOutput } from "@/utils/structured-output-fetcher";
import { OpenRouterProviderService } from "@/services/model-providers/providers/open-router-provider";
import { ApiError } from "shared";
import { zodToStructuredJsonSchema } from "shared/src/structured-outputs/structured-output-utils";
import { z } from "zod";
import { DEFAULT_MODEL_CONFIGS } from "shared";

interface GenerateStructuredOutputOptions<T extends StructuredOutputType> {
    outputType: T;
    userMessage: string;
    systemMessage?: string;
    model?: string;
    temperature?: number;
    chatId?: string;
    /**
     * When true, the service will automatically append
     * the JSON schema to the system prompt. This can
     * help some models produce valid JSON more consistently.
     */
    appendSchemaToPrompt?: boolean;
}

/**
 * Generate structured output using a specified schema "type." 
 * The final result is validated by Zod locally (and by OpenRouter's JSON Schema).
 */
export async function generateStructuredOutput<T extends StructuredOutputType>(
    params: GenerateStructuredOutputOptions<T>
): Promise<InferStructuredOutput<T>> {

    const cfg = DEFAULT_MODEL_CONFIGS['generate-structured-output'];

    const {
        outputType,
        userMessage,
        systemMessage,
        model = cfg.model,
        temperature = cfg.temperature,
        chatId = "structured-output-generic",
        appendSchemaToPrompt = false,
    } = params;

    const zodSchema = structuredOutputSchemas[outputType];

    let finalSystemMessage = systemMessage ?? "";
    if (appendSchemaToPrompt) {
        const schemaObj = zodToStructuredJsonSchema(zodSchema);
        const schemaAsJson = JSON.stringify(schemaObj, null, 2);

        finalSystemMessage += `

IMPORTANT: The output must strictly follow this JSON schema:
\`\`\`json
${schemaAsJson}
\`\`\`
Return **only** valid JSON matching the above schema.
`;
    }

    try {
        const providerService = new OpenRouterProviderService();

        const validatedResult = await fetchStructuredOutput(providerService, {
            userMessage,
            systemMessage: finalSystemMessage,
            zodSchema: zodSchema as z.ZodType<InferStructuredOutput<T>>,
            schemaName: outputType,
            model,
            temperature,
            chatId,
        });

        return validatedResult;
    } catch (error) {
        throw new ApiError(
            `Failed to generate structured output of type '${outputType}': ${String(error)}`,
            500,
            "STRUCTURED_OUTPUT_ERROR"
        );
    }
}