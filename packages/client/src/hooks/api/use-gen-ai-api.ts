import { useMutation, type UseMutationOptions, } from '@tanstack/react-query';
import { postApiGenAiStructured } from '@/generated/sdk.gen';
import type {
    PostApiGenAiStructuredError,

} from '@/generated/types.gen';
import {
    structuredDataSchemas
} from 'shared/src/schemas/gen-ai.schemas';
import { z } from 'zod';


export type StructuredSchemaGenericResponse<
    Key extends keyof typeof structuredDataSchemas,
    // Default Schema to the actual schema type looked up by Key
    Schema extends z.ZodTypeAny = typeof structuredDataSchemas[Key]['schema'] // Corrected default
> = {
    success: true;
    data: {
        output: z.infer<Schema>; // Infer output from the Schema generic
    };
};

type StructuredSchemaInput = {
    prompt: string
}

type MutationSuccessResponse<Key extends keyof typeof structuredDataSchemas> = {
    success: true;
    data: { output: z.infer<typeof structuredDataSchemas[Key]['schema']> };
};

// returns sturctured JSON, does not stream
export const useGenerateStructuredData = <
    // Key remains the same: identifies which schema config to use
    Key extends keyof typeof structuredDataSchemas
>(
    key: Key,
    // Optional: Allow passing react-query mutation options, now typed correctly
    // based on the specific success response type defined below.
    options?: Omit<UseMutationOptions<
        // TData: Use the specific MutationSuccessResponse defined inside the hook
        MutationSuccessResponse<Key>, // <--- Key change: Use the specific type
        // TError: Use the error type from your SDK
        PostApiGenAiStructuredError,
        // TVariables: The input type for the mutate function
        StructuredSchemaInput
    >, 'mutationFn'> // Omit mutationFn as we define it here
) => {
    // Get the specific Zod schema instance for the given key (runtime value)
    const specificSchema = structuredDataSchemas[key].schema;

    return useMutation<
        MutationSuccessResponse<Key>,
        PostApiGenAiStructuredError,
        StructuredSchemaInput
    >({
        ...options,
        mutationFn: async (requestBody: StructuredSchemaInput): Promise<MutationSuccessResponse<Key>> => {
            const sdkResponse: unknown = await postApiGenAiStructured({
                body: {
                    userInput: requestBody.prompt,
                    schemaKey: key,
                },
            });

            // --- Safely Extract Data to Parse ---
            let dataToParse: unknown;

            // Check for the specific structure observed in the log: { data: { data: { output: ... } } }
            if (
                sdkResponse && typeof sdkResponse === 'object' && 'data' in sdkResponse &&
                sdkResponse.data && typeof sdkResponse.data === 'object' && 'data' in sdkResponse.data && // Check for the *inner* 'data'
                sdkResponse.data.data && typeof sdkResponse.data.data === 'object' && 'output' in sdkResponse.data.data // Check for 'output' within the inner 'data'
            ) {
                // Access the output from the correct path
                dataToParse = (sdkResponse.data.data as { output: unknown }).output; // <<< CORRECT PATH
            }
            // You might keep the other checks as fallbacks if the structure *could* vary,
            // but based on the log, the primary check above is the most likely correct one.
            // Fallback Check 1: { data: { output: ... } }
            else if (
                sdkResponse && typeof sdkResponse === 'object' && 'data' in sdkResponse &&
                sdkResponse.data && typeof sdkResponse.data === 'object' && 'output' in sdkResponse.data
            ) {
                console.warn("API response structure has changed? Found output at sdkResponse.data.output"); // Optional warning
                dataToParse = (sdkResponse.data as { output: unknown }).output;
            }
            // Fallback Check 2: { output: ... }
            else if (
                sdkResponse && typeof sdkResponse === 'object' && 'output' in sdkResponse
            ) {
                console.warn("API response structure has changed? Found output directly at sdkResponse.output"); // Optional warning
                dataToParse = (sdkResponse as { output: unknown }).output;
            }
            // If none of the structures match
            else {
                console.error("Unexpected API response structure received:", JSON.stringify(sdkResponse));
                // Ensure the error message clearly indicates the path tried vs. what was received.
                throw new Error(`API response structure not recognized for schema key "${key}". Expected output at 'response.data.data.output' or similar, but failed.`);
            }

            // --- Parse the Extracted Data ---
            try {
                const parsedOutput = specificSchema.safeParse(dataToParse);

                if (!parsedOutput.success) {
                    console.error("Zod validation failed:", parsedOutput.error.errors);
                    console.error("Data that failed validation:", JSON.stringify(dataToParse));
                    throw new Error(`API response validation failed for schema key "${key}": ${parsedOutput.error.message}`);
                }

                return {
                    success: true,
                    data: {
                        output: parsedOutput.data,
                    },
                };
            } catch (error) {
                console.error(`Error processing structured data for key "${key}":`, error);
                throw error;
            }
        },
    });
    // The hook now returns UseMutationResult<MutationSuccessResponse, ...>
    // where MutationSuccessResponse is specific to the 'key' provided.
};


