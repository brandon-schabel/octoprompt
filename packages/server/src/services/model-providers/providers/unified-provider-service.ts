import OpenAI from "openai";
import { createProviderKeyService } from "./provider-key-service";
import { APIProviders, DEFAULT_MODEL_CONFIGS } from "shared";
import { StreamParams, ProcessMessageParams } from "./unified-provider-types";
import {
    OllamaPlugin,
    AnthropicPlugin,
    GeminiPlugin,
    GroqPlugin,
    OpenAiLikePlugin,
    OpenRouterPlugin,
    TogetherPlugin,
    TOGETHER_BASE_URL,
    GROQ_BASE_URL,
    createSSEStream,
    type UnifiedModel,
    ModelFetcherService,
    type ProviderKeysConfig,
} from "@bnk/ai";
import { createChatService } from "../chat/chat-service";
import {
    GEMINI_BASE_URL,
    LMSTUDIO_BASE_URL,
    OLLAMA_BASE_URL,
} from "@bnk/ai";
import { websocketStateAdapter } from "@/utils/websocket/websocket-state-adapter";

export function createUnifiedProviderService(debugParam = false) {
    const debug = debugParam;

    // Internal references
    const providerKeyService = createProviderKeyService();
    const chatService = createChatService();

    let providerConfig: ProviderKeysConfig = {
        openaiKey: undefined,
        anthropicKey: undefined,
        googleGeminiKey: undefined,
        groqKey: undefined,
        togetherKey: undefined,
        xaiKey: undefined,
        openRouterKey: undefined,
    };

    let modelFetcherService: ModelFetcherService | null = null;

    async function initModelFetcherService(): Promise<void> {
        if (modelFetcherService) return;

        const keys = await providerKeyService.listKeys();


        providerConfig = {
            openaiKey: keys.find(k => k.provider === "openai")?.key,
            anthropicKey: keys.find(k => k.provider === "anthropic")?.key,
            googleGeminiKey: keys.find(k => k.provider === "google_gemini")?.key,
            groqKey: keys.find(k => k.provider === "groq")?.key,
            togetherKey: keys.find(k => k.provider === "together")?.key,
            xaiKey: keys.find(k => k.provider === "xai")?.key,
            openRouterKey: keys.find(k => k.provider === "openrouter")?.key,
        };


        modelFetcherService = new ModelFetcherService(providerConfig);
    }

    function getKey(provider: keyof ProviderKeysConfig): string {
        const key = providerConfig[provider];

        if (!key) {
            console.error(`${provider} API key not found`);
            return "";
        }
        return key;
    }

    async function getProviderPlugin(
        provider: APIProviders,
        options: StreamParams["options"]
    ) {
        await initModelFetcherService();

        const pluginMap: Record<APIProviders, () => Promise<any>> = {
            openai: async () => {
                const openaiClient = new OpenAI({
                    apiKey: getKey("openaiKey"),
                });
                return new OpenAiLikePlugin(openaiClient, DEFAULT_MODEL_CONFIGS.openai.model);
            },
            openrouter: async () => {
                const openRouterKey = getKey("openRouterKey");
                return new OpenRouterPlugin(openRouterKey ?? "");
            },
            xai: async () => {
                const xaiClient = new OpenAI({
                    baseURL: "https://api.x.ai/v1",
                    apiKey: getKey("xaiKey"),
                });
                return new OpenAiLikePlugin(xaiClient, DEFAULT_MODEL_CONFIGS.xai.model);
            },
            google_gemini: async () => {
                const apiKey = getKey("googleGeminiKey");
                return new GeminiPlugin(apiKey, GEMINI_BASE_URL, DEFAULT_MODEL_CONFIGS.google_gemini.model);
            },
            lmstudio: async () => {
                const state = await websocketStateAdapter.getState();
                const lmStudioUrl = state.settings.lmStudioGlobalUrl ?? LMSTUDIO_BASE_URL;
                const lmStudioClient = new OpenAI({
                    baseURL: lmStudioUrl,
                    apiKey: "lm-studio",
                });
                return new OpenAiLikePlugin(lmStudioClient, DEFAULT_MODEL_CONFIGS.lmstudio.model);
            },
            anthropic: async () => {
                const key = getKey("anthropicKey");
                return new AnthropicPlugin(key, "2023-06-01");
            },
            groq: async () => {
                const groqKey = getKey("groqKey");
                return new GroqPlugin(groqKey, GROQ_BASE_URL);
            },
            together: async () => {
                const tKey = getKey("togetherKey");
                return new TogetherPlugin(tKey, TOGETHER_BASE_URL);
            },
            ollama: async () => {
                const state = await websocketStateAdapter.getState();
                const ollamaUrl = state.settings.ollamaGlobalUrl ?? OLLAMA_BASE_URL;
                return new OllamaPlugin(ollamaUrl);
            },
        };

        const pluginFunc = pluginMap[provider] || pluginMap["openai"];
        return pluginFunc();
    }

    function tryParseStructuredResponse(text: string): any {
        try {
            const tripleBacktickRegex = /```(?:json)?([\s\S]*?)```/;
            const matched = text.match(tripleBacktickRegex);
            const cleanedText = matched ? matched[1].trim() : text.trim();
            return JSON.parse(cleanedText);
        } catch (error) {
            return null;
        }
    }

    async function streamMessage(
        streamConfig: StreamParams & {
            provider: APIProviders;
            systemMessage?: string;
            assistantMessageId: string;
        }
    ): Promise<ReadableStream<Uint8Array>> {
        const {
            chatId,
            assistantMessageId,
            userMessage,
            systemMessage,
            options,
            provider,
        } = streamConfig;

        console.log({ options, provider })

        const plugin = await getProviderPlugin(provider, options);

        let fullResponse = "";
        let structuredResponse: any = null;
        const isStructuredOutput = options?.response_format?.type === "json_schema";

        return createSSEStream({
            userMessage,
            systemMessage,
            plugin,
            options: {
                ...options,
                referrer: 'http://octoprompt.com',
                title: 'OctoPrompt',
            },
            handlers: {
                onSystemMessage: async (msg) => {
                    if (debug) {
                        console.log("[UnifiedProviderService] systemMessage:", msg.content);
                    }
                },
                onUserMessage: async (msg) => {
                    if (debug) {
                        console.log("[UnifiedProviderService] user:", msg.content);
                    }
                },
                onPartial: async (partial) => {
                    fullResponse += partial.content;
                    if (isStructuredOutput) {
                        const parsed = tryParseStructuredResponse(fullResponse);
                        if (parsed) {
                            structuredResponse = parsed;
                            await chatService.updateMessageContent(
                                assistantMessageId,
                                JSON.stringify(structuredResponse, null, 2)
                            );
                        }
                    } else {
                        await chatService.updateMessageContent(assistantMessageId, fullResponse);
                    }
                },
                onDone: async (final) => {
                    fullResponse = final.content;
                    if (isStructuredOutput) {
                        const parsed = tryParseStructuredResponse(fullResponse);
                        if (parsed) {
                            structuredResponse = parsed;
                            fullResponse = JSON.stringify(structuredResponse, null, 2);
                        }
                    }
                    await chatService.updateMessageContent(assistantMessageId, fullResponse);
                    console.log("[UnifiedProviderService] final assistant text:", fullResponse);
                },
                onError: async (err, partialSoFar) => {
                    console.error("[UnifiedProviderService] SSE error:", err);
                    if (partialSoFar.content) {
                        fullResponse = partialSoFar.content;
                        await chatService.updateMessageContent(assistantMessageId, fullResponse);
                    }
                },
            },
        });
    }

    /**
     * Main entry point for processing a user’s message:
     *  1) Save the user message
     *  2) Create a placeholder assistant message
     *  3) Start streaming the final assistant response
     */
    async function processMessage({
        chatId,
        userMessage,
        provider = "openai",
        options = {},
        tempId,
        systemMessage,
    }: ProcessMessageParams): Promise<ReadableStream<Uint8Array>> {
        let assistantMessageId: string | undefined;

        try {
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

            console.log({ options })

            if(provider === 'openai') {
                delete options.max_tokens
            }

            return streamMessage({
                chatId,
                assistantMessageId: assistantMessageId ?? "",
                userMessage,
                options,
                tempId,
                provider,
                systemMessage,
            });
        } catch (error) {
            console.error("Error in processMessage:", error);
            if (assistantMessageId) {
                await chatService.updateMessageContent(
                    assistantMessageId,
                    "Error: Failed to process message. Please try again."
                );
            }
            throw error;
        }
    }

    /**
     * List available models from the specified provider (or default).
     */
    async function listModels(provider: APIProviders): Promise<UnifiedModel[]> {
        await initModelFetcherService();
        const state = await websocketStateAdapter.getState();

        const ollamaBaseUrl = state.settings.ollamaGlobalUrl ?? OLLAMA_BASE_URL;
        const lmstudioBaseUrl = state.settings.lmStudioGlobalUrl ?? LMSTUDIO_BASE_URL;

        if (debug) {
            console.log("[UnifiedProviderService] ollamaBaseUrl:", ollamaBaseUrl);
            console.log("[UnifiedProviderService] lmstudioBaseUrl:", lmstudioBaseUrl);
        }

        return modelFetcherService!.listModels(provider, {
            ollamaBaseUrl,
            lmstudioBaseUrl,
        });
    }

    return {
        processMessage,
        listModels,
        streamMessage,
    };
}


export const unifiedProvider = createUnifiedProviderService();