import { useMutation } from '@tanstack/react-query';
import { commonErrorHandler } from './common-mutation-error-handler';
import {
    postApiStructuredOutputsMutation
} from '../generated/@tanstack/react-query.gen';
import type {
    PostApiStructuredOutputsData,
    PostApiStructuredOutputsError,
    PostApiStructuredOutputsResponse
} from '../generated/types.gen';
import { Options } from '../generated/sdk.gen';

import {
    InferStructuredOutput,
    StructuredOutputType,
    structuredOutputSchemas
} from "shared/index";

interface StructuredOutputRequest<T extends StructuredOutputType> {
    outputType: T;
    userMessage: string;
    systemMessage?: string;
    model?: string;
    temperature?: number;
    chatId?: string;
}

export function useGenerateStructuredOutput<T extends StructuredOutputType>(outputType: T) {
    const mutationOptions = postApiStructuredOutputsMutation();

    return useMutation<
        InferStructuredOutput<T>,
        PostApiStructuredOutputsError,
        Omit<StructuredOutputRequest<T>, "outputType">
    >({
        mutationFn: async (requestBody: Omit<StructuredOutputRequest<T>, "outputType">) => {
            const fullBody: PostApiStructuredOutputsData['body'] = {
                outputType,
                ...requestBody,
            };

            const opts: Options<PostApiStructuredOutputsData> = { body: fullBody };

            const result = await mutationOptions.mutationFn!(opts);

            const zodSchema = structuredOutputSchemas[outputType];
            return zodSchema.parse(result);
        },
        onError: (error: PostApiStructuredOutputsError) => commonErrorHandler(error as unknown as Error),
    });
}