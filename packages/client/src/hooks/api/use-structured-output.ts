import { InferStructuredOutput, structuredOutputSchemas } from "shared/index"
import { StructuredOutputType } from "shared/index"
import { commonErrorHandler } from "./common-mutation-error-handler"
import { useApi } from "../use-api"
import { useMutation } from "@tanstack/react-query"

/**
 * The shape of data we send to the route.
 */
interface StructuredOutputRequest<T extends StructuredOutputType> {
    outputType: T;
    userMessage: string;
    systemMessage?: string;
    model?: string;
    temperature?: number;
    chatId?: string;
}

/**
 * Server response shape. "data" holds the final structured object that
 * matches the schema for the requested outputType.
 */
interface StructuredOutputResponse<T extends StructuredOutputType> {
    success: boolean;
    data: InferStructuredOutput<T>;
}

/**
 * A generic hook that requests a particular structured output type
 * from the server, returning strongly typed data when ready.
 */
export function useGenerateStructuredOutput<T extends StructuredOutputType>(outputType: T) {
    const { api } = useApi();

    return useMutation<
        InferStructuredOutput<T>,
        Error,
        Omit<StructuredOutputRequest<T>, "outputType">
    >({
        mutationFn: async (requestBody) => {
            // Merge in "outputType" from the hook argument
            const fullBody: StructuredOutputRequest<T> = {
                outputType,
                ...requestBody,
            };

            const resp = await api.request("/api/structured-outputs", {
                method: "POST",
                body: fullBody,
            });

            if (!resp.ok) {
                throw new Error(`Server error: ${resp.status} ${resp.statusText}`);
            }

            const data: StructuredOutputResponse<T> = await resp.json();

            // Optionally parse it again with the Zod schema on the client if you want extra safety:
            const zodSchema = structuredOutputSchemas[outputType];
            const validated = zodSchema.parse(data.data);

            return validated; // typed as InferStructuredOutput<T>
        },
        onError: commonErrorHandler,
    });
}