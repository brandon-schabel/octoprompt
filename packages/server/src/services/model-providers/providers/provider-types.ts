import { APIProviders } from "shared";
import { ChatService } from "../chat/chat-service";

export type StreamParams = {
    chatId: string;
    assistantMessageId: string;
    userMessage: string;
    chatService: ChatService;
    options: ChatCompletionOptions;
    tempId?: string;
};

/** Options used by certain completion endpoints */
export type ChatCompletionOptions = Partial<{
    model: string;
    temperature: number;
    max_tokens: number;
    top_p: number;
    frequency_penalty: number;
    presence_penalty: number;
    top_k: number; // used by Gemini / local LLM
}>;


export type ProcessMessageParams = Omit<StreamParams, "chatService" | "assistantMessageId"> & {
    provider?: APIProviders;
};