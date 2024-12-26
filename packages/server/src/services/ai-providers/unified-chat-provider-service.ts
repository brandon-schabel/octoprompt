import { ChatService } from "./chat-service";
import { UnifiedProviderService } from "./unified-provider-service";
import type { ReadableStream } from "stream/web";

/** Which API provider to use */
export type APIProviders = "openai" | "openrouter" | "lmstudio" | "ollama" | "xai" | "gemini";

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


export type StreamParams = {
    chatId: string;
    assistantMessageId: string;
    userMessage: string;
    chatService: ChatService;
    options: ChatCompletionOptions;
    tempId?: string;
};

export type ProcessMessageParams = Omit<StreamParams, "chatService" | "assistantMessageId"> & {
    provider?: APIProviders;
};

export class UnifiedChatProviderService {
    private chatService: ChatService;
    private providerService: UnifiedProviderService;

    constructor() {
        this.chatService = new ChatService();
        this.providerService = new UnifiedProviderService();
    }

    /**
     * Process a message:
     * 1. Save user message (via ChatService)
     * 2. Create placeholder assistant message (via ChatService)
     * 3. Use the relevant provider streaming method (via ProviderService)
     */
    async processMessage({
        chatId,
        userMessage,
        provider = "openai",
        options = {},
        tempId,
    }: ProcessMessageParams): Promise<ReadableStream<Uint8Array>> {
        let assistantMessageId: string | undefined;
        try {
            // Save user message
            await this.chatService.saveMessage({
                chatId,
                role: "user",
                content: userMessage,
            });
            await this.chatService.updateChatTimestamp(chatId);

            // Create a placeholder assistant message
            const initialAssistantMessage = await this.chatService.saveMessage({
                chatId,
                role: "assistant",
                content: "You are a helpful assistant, helping a user within an app called OctoPrompt.",
                tempId,
            });
            assistantMessageId = initialAssistantMessage.id;

            // Use the unified streamMessage method
            return this.providerService.streamMessage({
                chatId,
                assistantMessageId,
                userMessage,
                chatService: this.chatService,
                options,
                provider,
            });
        } catch (error) {
            console.error("Error in processMessage:", error);
            if (assistantMessageId) {
                await this.chatService.updateMessageContent(
                    assistantMessageId,
                    "Error: Failed to process message. Please try again."
                );
            }
            throw error;
        }
    }

    /** Expose chatService methods if needed */
    get chat() {
        return this.chatService;
    }

    /** Expose providerService methods if needed */
    get provider() {
        return this.providerService;
    }
}