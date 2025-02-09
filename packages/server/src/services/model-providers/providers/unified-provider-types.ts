import { APIProviders } from "shared";

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

/**
 * The parameters for "processMessage". This was originally in ProviderChatService
 * but is now used directly in UnifiedProviderService.
 */
export type ProcessMessageParams = {
    chatId: string;
    userMessage: string;
    provider?: APIProviders;
    options?: StreamOptions;
    tempId?: string;
    systemMessage?: string;
};