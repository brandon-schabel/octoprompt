import { createChatService } from "../chat/chat-service";
import { createProviderKeyService } from "./provider-key-service";
import { StreamParams, ProcessMessageParams } from "./unified-provider-types";
import { createSSEStream, OpenRouterPlugin, OpenRouterStructuredPlugin } from "@bnk/ai";

export function createOpenRouterProviderService(debugParam = false) {
    const debug = debugParam;
    const providerKeyService = createProviderKeyService();
    const chatService = createChatService();

    let openRouterKey: string | undefined;

    async function initKey(): Promise<void> {
        if (openRouterKey) {
            return;
        }

        const keys = await providerKeyService.listKeys();
        openRouterKey = keys.find(k => k.provider === "openrouter")?.key;

        if (!openRouterKey) {
            console.error('[OpenRouterProviderService] initKey:', 'OpenRouter API key not found');
            throw new Error("OpenRouter API key not found");
        }
    }

    function tryParseStructuredResponse(text: string): any {
        try {
            const tripleBacktickRegex = /```(?:json)?([\s\S]*?)```/;
            const matched = text.match(tripleBacktickRegex);
            const cleanedText = matched ? matched[1].trim() : text.trim();
            return JSON.parse(cleanedText);
        } catch (error) {
            if (debug) {
                console.error('[OpenRouterProviderService] tryParseStructuredResponse:', 'Failed to parse JSON', error);
            }
            return null;
        }
    }

    async function streamMessage({
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
            ? new OpenRouterStructuredPlugin(openRouterKey!)
            : new OpenRouterPlugin(openRouterKey!, systemMessage);

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

                    if (debug) {
                        console.log('[OpenRouterProviderService] onPartial:', 'fullResponse:', fullResponse);
                    }

                    if (isStructured) {
                        const parsed = tryParseStructuredResponse(fullResponse);
                        if (parsed) {
                            structuredResponse = parsed;
                            await chatService.updateMessageContent(
                                assistantMessageId,
                                JSON.stringify(parsed, null, 2)
                            );
                        }
                    } else {
                        await chatService.updateMessageContent(assistantMessageId, fullResponse);
                    }
                },
                onDone: async (final) => {
                    if (debug) {
                        console.log('[OpenRouterProviderService] onDone:', 'final:', final);
                    }

                    fullResponse = final.content;
                    if (isStructured) {
                        const parsed = tryParseStructuredResponse(fullResponse);
                        if (parsed) {
                            structuredResponse = parsed;
                            fullResponse = JSON.stringify(parsed, null, 2);
                        }
                    }
                    await chatService.updateMessageContent(assistantMessageId, fullResponse);
                },
                onError: async (err, partialSoFar) => {
                    if (partialSoFar.content) {
                        fullResponse = partialSoFar.content;
                        await chatService.updateMessageContent(assistantMessageId, fullResponse);
                    }
                },
            },
        });
    }

    /**
     * Process a message through OpenRouter:
     *  1) Save the user’s message
     *  2) Create a placeholder assistant message
     *  3) Stream the final assistant response
     */
    async function processMessage({
        chatId,
        userMessage,
        provider, // unused directly here since this is specifically for OpenRouter
        options = {},
        tempId,
        systemMessage,
    }: ProcessMessageParams): Promise<ReadableStream<Uint8Array>> {
        let assistantMessageId: string | undefined;

        try {
            await initKey();

            await chatService.saveMessage({
                chatId,
                role: "user",
                content: userMessage,
            });
            await chatService.updateChatTimestamp(chatId);

            const initialAssistantMessage = await chatService.saveMessage({
                chatId,
                role: "assistant",
                content: "...",
                tempId,
            });

            assistantMessageId = initialAssistantMessage.id;

            return streamMessage({
                chatId,
                assistantMessageId: assistantMessageId ?? "",
                userMessage,
                options,
                tempId,
                systemMessage,
            });
        } catch (error) {
            console.error('[OpenRouterProviderService] processMessage:', 'Error processing message:', error);
            if (assistantMessageId) {
                await chatService.updateMessageContent(
                    assistantMessageId,
                    "Error: Failed to process message. Please try again."
                );
            }
            throw error;
        }
    }

    return {
        processMessage,
    };
}


export const openRouterProvider = createOpenRouterProviderService();