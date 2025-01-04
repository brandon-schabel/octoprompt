import { UnifiedProviderService } from "../providers/unified-provider-service";
import { ProcessMessageParams } from "../providers/provider-types";
import { ChatService } from "./chat-service";

export class ProviderChatService {
    private chatService: ChatService;
    private universalProviderService: UnifiedProviderService;

    constructor() {
        this.chatService = new ChatService();
        this.universalProviderService = new UnifiedProviderService();
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
        systemMessage,
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
            return this.universalProviderService.streamMessage({
                chatId,
                assistantMessageId,
                userMessage,
                chatService: this.chatService,
                options,
                provider,
                systemMessage,
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
    get universalProvider() {
        return this.universalProviderService;
    }
}