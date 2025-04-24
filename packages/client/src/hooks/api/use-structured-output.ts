// packages/client/src/hooks/api/use-structured-output.ts
import { useMutation } from '@tanstack/react-query';
import { commonErrorHandler } from './common-mutation-error-handler';
import {
    // Generated Mutation Function
    postApiStructuredOutputsMutation
} from '../generated/@tanstack/react-query.gen';
import type {
    // Generated Data Types
    PostApiStructuredOutputsData,
    PostApiStructuredOutputsError,
    PostApiStructuredOutputsResponse
} from '../generated/types.gen';
import { Options } from '../generated/sdk.gen';

// Import from shared package
import {
    InferStructuredOutput,
    StructuredOutputType,
    structuredOutputSchemas
} from "shared/index";

// Request input type
interface StructuredOutputRequest<T extends StructuredOutputType> {
    outputType: T;
    userMessage: string;
    systemMessage?: string;
    model?: string;
    temperature?: number;
    chatId?: string;
}

/**
 * A generic hook for generating structured output based on a specific schema
 */
export function useGenerateStructuredOutput<T extends StructuredOutputType>(outputType: T) {
    const mutationOptions = postApiStructuredOutputsMutation();

    return useMutation<
        InferStructuredOutput<T>,
        PostApiStructuredOutputsError,
        Omit<StructuredOutputRequest<T>, "outputType">
    >({
        mutationFn: async (requestBody: Omit<StructuredOutputRequest<T>, "outputType">) => {
            // Merge the outputType with the provided request body
            const fullBody: PostApiStructuredOutputsData['body'] = {
                outputType,
                ...requestBody,
            };

            const opts: Options<PostApiStructuredOutputsData> = { body: fullBody };
            
            // Call the generated mutation function
            const result = await mutationOptions.mutationFn!(opts);
            
            // Validate with Zod schema for additional type safety
            const zodSchema = structuredOutputSchemas[outputType];
            return zodSchema.parse(result);
        },
        onError: (error: PostApiStructuredOutputsError) => commonErrorHandler(error as unknown as Error),
    });
}