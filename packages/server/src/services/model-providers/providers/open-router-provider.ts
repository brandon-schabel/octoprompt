import { ChatService } from "../chat/chat-service";
import { ProviderKeyService } from "./provider-key-service";

import {
    StreamParams,
    ProcessMessageParams,
} from "./unified-provider-types";
import { createSSEStream, OpenRouterPlugin, OpenRouterStructuredPlugin } from "@bnk/ai"; // or your SSE streaming helper

const debug = {
    log: (context: string, message: string, data?: any) => {
        console.log(`[OpenRouterProviderService:${context}]`, message, data ? data : '');
    },
    error: (context: string, message: string, error?: any) => {
        console.error(`[OpenRouterProviderService:${context}]`, message, error ? error : '');
    }
};

export class OpenRouterProviderService {
    private providerKeyService: ProviderKeyService;
    private chatService: ChatService;
    private openRouterKey: string | undefined;

    constructor() {
        debug.log('constructor', 'Initializing OpenRouterProviderService');
        this.providerKeyService = new ProviderKeyService();
        this.chatService = new ChatService();
    }

    /**
     * Loads the OpenRouter key once.
     */
    private async initKey(): Promise<void> {
        if (this.openRouterKey) {
            debug.log('initKey', 'Key already initialized');
            return;
        }
        
        debug.log('initKey', 'Fetching OpenRouter API key');
        const keys = await this.providerKeyService.listKeys();
        this.openRouterKey = keys.find(k => k.provider === "openrouter")?.key;
        
        if (!this.openRouterKey) {
            debug.error('initKey', 'OpenRouter API key not found');
            throw new Error("OpenRouter API key not found");
        }
        debug.log('initKey', 'Successfully initialized OpenRouter API key');
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
            debug.log('processMessage', 'Starting message processing', { chatId, tempId });
            await this.initKey();

            debug.log('processMessage', 'Saving user message', { chatId });
            await this.chatService.saveMessage({
                chatId,
                role: "user",
                content: userMessage,
            });
            await this.chatService.updateChatTimestamp(chatId);

            debug.log('processMessage', 'Creating placeholder assistant message', { chatId });
            const initialAssistantMessage = await this.chatService.saveMessage({
                chatId,
                role: "assistant",
                content: "...",
                tempId,
            });
            assistantMessageId = initialAssistantMessage.id;
            debug.log('processMessage', 'Created assistant message', { assistantMessageId });

            return this.streamMessage({
                chatId,
                assistantMessageId,
                userMessage,
                options,
                tempId,
                systemMessage,
            });
        } catch (error) {
            debug.error('processMessage', 'Error processing message', error);
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
            debug.log('tryParseStructuredResponse', 'Successfully parsed JSON response');
            return result;
        } catch (error) {
            debug.error('tryParseStructuredResponse', 'Failed to parse JSON response', error);
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
        debug.log('streamMessage', 'Starting message stream', { 
            chatId, 
            assistantMessageId,
            isStructured: options?.response_format?.type === "json_schema"
        });

        const isStructured = options?.response_format?.type === "json_schema";
        const plugin = isStructured
            ? new OpenRouterStructuredPlugin(this.openRouterKey!)
            : new OpenRouterPlugin(this.openRouterKey!, systemMessage);

        let fullResponse = "";
        let structuredResponse: any = null;

        return createSSEStream({
            // debug: true,
            userMessage,
            systemMessage,
            plugin,
            options,
            handlers: {
                onSystemMessage: async (msg) => {
                    debug.log('streamMessage:onSystemMessage', msg.content);
                },
                onUserMessage: async (msg) => {
                    debug.log('streamMessage:onUserMessage', msg.content);
                },
                onPartial: async (partial) => {
                    fullResponse += partial.content;
                    debug.log('streamMessage:onPartial', 'Received partial response', {
                        length: partial.content.length,
                        totalLength: fullResponse.length
                    });

                    if (isStructured) {
                        const parsed = this.tryParseStructuredResponse(fullResponse);
                        if (parsed) {
                            debug.log('streamMessage:onPartial', 'Updated structured response');
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
                    debug.log('streamMessage:onDone', 'Stream completed', {
                        finalLength: final.content.length
                    });
                    
                    fullResponse = final.content;
                    if (isStructured) {
                        const parsed = this.tryParseStructuredResponse(fullResponse);
                        if (parsed) {
                            structuredResponse = parsed;
                            fullResponse = JSON.stringify(parsed, null, 2);
                            debug.log('streamMessage:onDone', 'Final structured response parsed');
                        }
                    }
                    await this.chatService.updateMessageContent(
                        assistantMessageId,
                        fullResponse
                    );
                    debug.log('streamMessage:onDone', 'Final response saved');
                },
                onError: async (err, partialSoFar) => {
                    debug.error('streamMessage:onError', 'Stream error occurred', err);
                    if (partialSoFar.content) {
                        fullResponse = partialSoFar.content;
                        debug.log('streamMessage:onError', 'Saving partial response before error');
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