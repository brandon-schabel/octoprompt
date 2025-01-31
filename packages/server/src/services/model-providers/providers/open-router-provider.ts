import { ChatService } from "../chat/chat-service";
import { ProviderKeyService } from "./provider-key-service";

import {
    StreamParams,
    ProcessMessageParams,
} from "./unified-provider-types";
import { createSSEStream, OpenRouterPlugin, OpenRouterStructuredPlugin } from "@bnk/ai";



export class OpenRouterProviderService {
    private providerKeyService: ProviderKeyService;
    private chatService: ChatService;
    private openRouterKey: string | undefined;
    private debug: boolean = false;

    constructor() {
        this.providerKeyService = new ProviderKeyService();
        this.chatService = new ChatService();
    }

    /**
     * Loads the OpenRouter key once.
     */
    private async initKey(): Promise<void> {
        if (this.openRouterKey) {

            return;
        }


        const keys = await this.providerKeyService.listKeys();
        this.openRouterKey = keys.find(k => k.provider === "openrouter")?.key;

        if (!this.openRouterKey) {
            console.error('initKey', 'OpenRouter API key not found');
            throw new Error("OpenRouter API key not found");
        }

    }

    /**
     * Saves a user message and a placeholder assistant message,
     * then starts streaming the final assistant response.
     */
    public async processMessage({
        chatId,
        userMessage,
        provider, // ignored in this service, since it's specifically for OpenRouter
        options = {},
        tempId,
        systemMessage,
    }: ProcessMessageParams): Promise<ReadableStream<Uint8Array>> {
        let assistantMessageId: string | undefined;

        try {

            await this.initKey();


            await this.chatService.saveMessage({
                chatId,
                role: "user",
                content: userMessage,
            });
            await this.chatService.updateChatTimestamp(chatId);


            const initialAssistantMessage = await this.chatService.saveMessage({
                chatId,
                role: "assistant",
                content: "...",
                tempId,
            });
            assistantMessageId = initialAssistantMessage.id;


            return this.streamMessage({
                chatId,
                assistantMessageId,
                userMessage,
                options,
                tempId,
                systemMessage,
            });
        } catch (error) {
            console.error('processMessage', 'Error processing message', error);
            if (assistantMessageId) {
                await this.chatService.updateMessageContent(
                    assistantMessageId,
                    "Error: Failed to process message. Please try again."
                );
            }
            throw error;
        }
    }

    /**
     * Helper to parse a structured JSON snippet from streaming text.
     * Looks for JSON enclosed in triple backticks, or tries to parse the entire text.
     */
    private tryParseStructuredResponse(text: string): any {
        try {
            const tripleBacktickRegex = /```(?:json)?([\s\S]*?)```/;
            const matched = text.match(tripleBacktickRegex);
            const cleanedText = matched ? matched[1].trim() : text.trim();
            const result = JSON.parse(cleanedText);

            return result;
        } catch (error) {
            console.error('tryParseStructuredResponse', 'Failed to parse JSON response', error);
            return null;
        }
    }

    /**
     * Streams the final assistant message from OpenRouter (text or structured).
     */
    private async streamMessage({
        chatId,
        assistantMessageId,
        userMessage,
        systemMessage,
        options,
        tempId,
    }: {
        chatId: string;
        assistantMessageId: string;
        userMessage: string;
        systemMessage?: string;
        options?: StreamParams["options"];
        tempId?: string;
    }): Promise<ReadableStream<Uint8Array>> {
        const isStructured = options?.response_format?.type === "json_schema";
        const plugin = isStructured
            ? new OpenRouterStructuredPlugin(this.openRouterKey!)
            : new OpenRouterPlugin(this.openRouterKey!, systemMessage);

        let fullResponse = "";
        let structuredResponse: any = null;

        return createSSEStream({
            debug: true,
            userMessage,
            systemMessage,
            plugin,
            options: {
                ...options,
                referrer: 'http://octoprompt.com',
                title: 'OctoPrompt',
            },
            handlers: {
                onPartial: async (partial) => {
                    fullResponse += partial.content;


                    console.log('onPartial', 'fullResponse', fullResponse); 


                    if (isStructured) {
                        const parsed = this.tryParseStructuredResponse(fullResponse);
                        if (parsed) {
                            structuredResponse = parsed;
                            await this.chatService.updateMessageContent(
                                assistantMessageId,
                                JSON.stringify(parsed, null, 2)
                            );
                        }
                    } else {
                        await this.chatService.updateMessageContent(
                            assistantMessageId,
                            fullResponse
                        );
                    }
                },
                onDone: async (final) => {

                    console.log('onDone', 'final', final);


                    fullResponse = final.content;
                    if (isStructured) {
                        const parsed = this.tryParseStructuredResponse(fullResponse);
                        if (parsed) {
                            structuredResponse = parsed;
                            fullResponse = JSON.stringify(parsed, null, 2);
                        }
                    }
                    await this.chatService.updateMessageContent(
                        assistantMessageId,
                        fullResponse
                    );
                },
                onError: async (err, partialSoFar) => {
                    if (partialSoFar.content) {
                        fullResponse = partialSoFar.content;
                        await this.chatService.updateMessageContent(
                            assistantMessageId,
                            fullResponse
                        );
                    }
                },
            },
        });
    }
}