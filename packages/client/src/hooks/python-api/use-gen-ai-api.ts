import { useMutation, type UseMutationOptions } from '@tanstack/react-query'
// import { postApiGenAiStructured } from '@/generated/sdk.gen' // Will use generated mutation hook instead
import { generateStructuredEndpointApiGenAiStructuredPostMutation } from '../../generated-python/@tanstack/react-query.gen' // Path to generated hook
import type {
    GenerateStructuredEndpointApiGenAiStructuredPostData, // For Options
    GenerateStructuredEndpointApiGenAiStructuredPostResponse, // For mutationFn result
    // PostApiGenAiStructuredError // Using the error type from types.gen if specific, or a more generic one.
    // POSTAPIgener
    // The react-query.gen.ts defines GenerateStructuredEndpointApiGenAiStructuredPostError
} from '../../generated-python/types.gen' // Path to generated types
import { Options } from '../../generated-python/sdk.gen' // Path to SDK options
import { structuredDataSchemas } from 'shared/src/schemas/gen-ai.schemas'
import { z } from 'zod'
import { PostApiGenAiStructuredError } from '@/generated/types.gen'

export type StructuredSchemaGenericResponse<
    Key extends keyof typeof structuredDataSchemas,
    Schema extends z.ZodTypeAny = (typeof structuredDataSchemas)[Key]['schema']
> = {
    success: true // This structure is for the hook's return, not necessarily the API's direct response
    data: {
        output: z.infer<Schema>
    }
}

type StructuredSchemaInput = { // This is the input to the hook's mutationFn
    prompt: string
}

// This is the type returned by the hook's mutationFn after processing
type MutationSuccessResponse<Key extends keyof typeof structuredDataSchemas> = {
    success: true
    data: { output: z.infer<(typeof structuredDataSchemas)[Key]['schema']> }
}

export const useGenerateStructuredData = <Key extends keyof typeof structuredDataSchemas>(
    key: Key,
    options?: Omit<
        UseMutationOptions<MutationSuccessResponse<Key>, PostApiGenAiStructuredError, StructuredSchemaInput>, // Error type should be GenerateStructuredEndpointApiGenAiStructuredPostError
        'mutationFn'
    >
) => {
    const specificSchema = structuredDataSchemas[key].schema
    const tanstackMutationOptions = generateStructuredEndpointApiGenAiStructuredPostMutation()

    return useMutation<MutationSuccessResponse<Key>, PostApiGenAiStructuredError, StructuredSchemaInput>({ // Use GenerateStructuredEndpointApiGenAiStructuredPostError
        ...options,
        mutationFn: async (requestBody: StructuredSchemaInput): Promise<MutationSuccessResponse<Key>> => {
            const opts: Options<GenerateStructuredEndpointApiGenAiStructuredPostData> = {
                body: {
                    user_input: requestBody.prompt,
                    schema_key: key
                }
            }
            // The mutationFn from tanstackMutationOptions returns GenerateStructuredEndpointApiGenAiStructuredPostResponse
            const apiResponse = await tanstackMutationOptions.mutationFn!(opts)

            // apiResponse is GenerateStructuredEndpointApiGenAiStructuredPostResponse
            // We need to know its structure to extract the 'output' for Zod parsing.
            // Assuming apiResponse is e.g., { success: boolean, data: { output: unknown } } or just { output: unknown }
            // The original code had complex parsing for a nested 'data.data.output'.
            // Let's assume GenerateStructuredEndpointApiGenAiStructuredPostResponse = { output: unknown } based on simplifying nature of Tanstack wrapper
            // OR if it's { data: { output: unknown } }, then apiResponse.data.output
            // For this example, let's assume apiResponse is the object containing 'output' directly or under a single 'data' field.
            // The provided log showed { data: { data: { output: ... } } } for the *raw SDK call's .data field*.
            // So, if tanstackMutationOptions.mutationFn returns that inner part, apiResponse might be { data: { output: ... } }
            // Let's assume apiResponse is the direct data returned, e.g. apiResponse = { output: "some json string" } or similar.
            // The client side defined MutationSuccessResponse expects a specific structure.
            // The backend for generateStructuredEndpointApiGenAiStructuredPost likely returns JSON that needs parsing.
            // Let's consult the type GenerateStructuredEndpointApiGenAiStructuredPostResponse.
            // If it's just `unknown` or `any`, the current parsing logic for `dataToParse` needs to be applied to `apiResponse`.
            // Given the previous parsing logic, let's assume `apiResponse` is an object and we need to find `output` in it.

            let dataToParse: unknown;

            // Adapt parsing based on the structure of 'apiResponse' (type GenerateStructuredEndpointApiGenAiStructuredPostResponse)
            // If apiResponse is { data: { output: ... } }
            if (apiResponse && typeof apiResponse === 'object' && 'data' in apiResponse && (apiResponse as any).data && typeof (apiResponse as any).data === 'object' && 'output' in (apiResponse as any).data) {
                dataToParse = (apiResponse as any).data.output;
            }
            // If apiResponse is { output: ... }
            else if (apiResponse && typeof apiResponse === 'object' && 'output' in apiResponse) {
                dataToParse = (apiResponse as any).output;
            } else {
                console.error('Unexpected API response structure from generateStructuredEndpointApiGenAiStructuredPostMutation:', JSON.stringify(apiResponse));
                throw new Error(`API response structure not recognized for schema key "${key}".`);
            }

            try {
                const parsedOutput = specificSchema.safeParse(dataToParse) // dataToParse might be a string that needs JSON.parse if schema expects object

                if (!parsedOutput.success) {
                    console.error('Zod validation failed:', parsedOutput.error.errors)
                    console.error('Data that failed validation:', JSON.stringify(dataToParse))
                    throw new Error(`API response validation failed for schema key "${key}": ${parsedOutput.error.message}`)
                }

                return { // Constructing the hook's specific success response structure
                    success: true,
                    data: {
                        output: parsedOutput.data
                    }
                }
            } catch (error) {
                console.error(`Error processing structured data for key "${key}":`, error)
                throw error // Rethrow to be caught by useMutation's onError
            }
        }
    })
}