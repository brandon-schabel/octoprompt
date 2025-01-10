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

/**
 * The parameters used when streaming the assistant's message.
 * Notice we removed `chatService` because it now lives fully in the UnifiedProviderService.
 * We also removed `assistantMessageId` since `processMessage` will generate it and pass it in.
 */
export type StreamParams = {
    chatId: string;
    userMessage: string;
    options: ChatCompletionOptions;
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
    options?: ChatCompletionOptions;
    tempId?: string;
    systemMessage?: string;
};