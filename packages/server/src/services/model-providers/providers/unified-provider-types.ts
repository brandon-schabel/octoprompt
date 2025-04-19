
// packages/server/src/services/model-providers/providers/unified-provider-types.ts
import { APIProviders } from "shared";
import { CoreMessage } from 'ai'; // Import CoreMessage
import { z } from "zod";

// Options compatible with Vercel AI SDK's streamText, generateText, generateObject
// Note: 'max_tokens' becomes 'maxTokens', etc.
export type AISdkOptions = Partial<{
    model: string;
    temperature: number;
    maxTokens: number;
    topP: number;
    frequencyPenalty: number;
    presencePenalty: number;
    topK: number;

    // For OpenRouter structured outputs
    response_format?: {
        type: "json_schema",
        json_schema: {
            name: string,
            strict: boolean,
            schema: any
        }
    };

    // For AI SDK structured outputs
    structuredOutputMode?: 'auto' | 'tool' | 'json';
    schemaName?: string;
    schemaDescription?: string;
    outputStrategy?: 'object' | 'array' | 'enum' | 'no-schema';
}>;


/**
 * Parameters for the main processMessage function in the unified provider.
 */
export type ProcessMessageParams = {
    chatId: string;
    userMessage: string;
    provider?: APIProviders;
    options?: AISdkOptions;
    tempId?: string;
    systemMessage?: string;
    messages?: CoreMessage[];
    
    // For structured outputs
    schema?: z.ZodSchema<any>;
    enum?: string[]; // For enum output strategy
  };

// Optional: Define types for structured output generation if needed centrally
// export type GenerateObjectParams<T> = {
//   prompt: string;
//   schema: z.ZodSchema<T>;
//   provider: APIProviders;
//   options?: AISdkOptions;
//   systemMessage?: string;
//   messages?: CoreMessage[];
// };

// Remove unused types like StreamParams, JsonSchema, ResponseFormat if they are no longer needed
// Remove ChatCompletionOptions if AISdkOptions covers everything

/** Options used by certain completion endpoints */
export type ChatCompletionOptions = Partial<{
    model: string;
    temperature: number;
    max_tokens: number;
    top_p: number;
    frequency_penalty: number;
    presence_penalty: number;
    top_k: number; // used by Gemini / local LLM
    debug: boolean;
}>;

export type JsonSchema = {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
    additionalProperties?: boolean;
};

export type ResponseFormat = {
    type: "json_schema";
    json_schema: {
        name: string;
        strict: boolean;
        schema: JsonSchema;
    };
};

export type StreamOptions = {
    model?: string;
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
    top_k?: number;
    debug?: boolean;
    response_format?: ResponseFormat;
    referrer?: string;
    title?: string;
};

/**
 * The parameters used when streaming the assistant's message.
 * Notice we removed `chatService` because it now lives fully in the UnifiedProviderService.
 * We also removed `assistantMessageId` since `processMessage` will generate it and pass it in.
 */
export type StreamParams = {
    chatId: string;
    userMessage: string;
    options?: StreamOptions;
    tempId?: string;
};
