import { structuredOutputSchemas, StructuredOutputType, InferStructuredOutput } from "shared/src/structured-outputs/structured-output-schema";
import { fetchStructuredOutput } from "@/utils/structured-output-fetcher";
import { OpenRouterProviderService } from "@/services/model-providers/providers/open-router-provider";
import { ApiError } from "shared";
import { zodToStructuredJsonSchema } from "shared/src/structured-outputs/structured-output-utils";
import { z } from "zod";
import { DEFAULT_MODEL_CONFIGS } from "shared";

/**
 * Options for generating structured outputs.
 */
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

export const structuredOutputsService = {
    /**
     * Generate structured output using a specified schema "type". 
     * The final result is validated by Zod locally (and by OpenRouter's JSON Schema).
     *
     * @param params {GenerateStructuredOutputOptions} - The structured generation parameters
     * @returns {Promise<InferStructuredOutput<T>>} - The validated, typed result
     */
    async generate<T extends StructuredOutputType>(
        params: GenerateStructuredOutputOptions<T>
    ): Promise<InferStructuredOutput<T>> {

        const cfg = DEFAULT_MODEL_CONFIGS['generate-structured-output']

        const {
            outputType,
            userMessage,
            systemMessage,
            model = cfg.model,
            temperature = cfg.temperature,
            chatId = "structured-output-generic",
            appendSchemaToPrompt = false,
        } = params;

        // 1) Lookup the correct Zod schema from your map
        const zodSchema = structuredOutputSchemas[outputType];

        // 2) Optionally embed the schema text in the system prompt
        //    for improved compliance. (Not required, but can be helpful.)
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

            // 3) Invoke fetchStructuredOutput, which automatically:
            //    - Converts zodSchema => JSON schema
            //    - Streams and parses the model's JSON response
            //    - Validates the final data with Zod
            const validatedResult = await fetchStructuredOutput(providerService, {
                userMessage,
                systemMessage: finalSystemMessage,
                zodSchema: zodSchema as z.ZodType<InferStructuredOutput<T>>,
                schemaName: outputType,
                model,
                temperature,
                chatId,
            });

            return validatedResult; // typed as InferStructuredOutput<T>
        } catch (error) {
            throw new ApiError(
                `Failed to generate structured output of type '${outputType}': ${String(error)}`,
                500,
                "STRUCTURED_OUTPUT_ERROR"
            );
        }
    },
};