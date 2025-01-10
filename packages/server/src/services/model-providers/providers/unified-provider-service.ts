import OpenAI from "openai";
import { ProviderKeyService } from "./provider-key-service";
import { APIProviders } from "shared";
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
} from "@bnk/ai";
import { ChatService } from "../chat/chat-service";
import {
    GEMINI_BASE_URL,
    LMSTUDIO_BASE_URL,
    OLLAMA_BASE_URL,
} from "@bnk/ai";
import { ModelFetcherService, type ProviderConfig } from "@bnk/ai";
import type { UnifiedModel } from "@bnk/ai";

export class UnifiedProviderService {
    private providerKeyService: ProviderKeyService;
    private chatService: ChatService;
    private providerConfig: ProviderConfig = {
        openaiKey: undefined,
        anthropicKey: undefined,
        googleGeminiKey: undefined,
        groqKey: undefined,
        togetherKey: undefined,
        xaiKey: undefined,
        openRouterKey: undefined,
    };
    private modelFetcherService: ModelFetcherService | null = null;

    constructor() {
        this.providerKeyService = new ProviderKeyService();
        this.chatService = new ChatService();
    }

    /**
     * Ensure modelFetcherService is created once and config is loaded.
     */
    private async initModelFetcherService(): Promise<void> {
        if (this.modelFetcherService) return;

        const keys = await this.providerKeyService.listKeys();
        this.providerConfig = {
            openaiKey: keys.find(k => k.provider === "openai")?.key,
            anthropicKey: keys.find(k => k.provider === "anthropic")?.key,
            googleGeminiKey: keys.find(k => k.provider === "google_gemini")?.key,
            groqKey: keys.find(k => k.provider === "groq")?.key,
            togetherKey: keys.find(k => k.provider === "together")?.key,
            xaiKey: keys.find(k => k.provider === "xai")?.key,
            openRouterKey: keys.find(k => k.provider === "openrouter")?.key,
        };
        this.modelFetcherService = new ModelFetcherService(this.providerConfig);
    }

    /**
     * Helper to get a provider key or throw if missing
     */
    private getKey(provider: keyof ProviderConfig): string {
        const key = this.providerConfig[provider];
        if (!key) throw new Error(`${provider} API key not found`);
        return key;
    }

    /**
     * Return plugin function mapped to each provider
     */
    private async getProviderPlugin(
        provider: APIProviders,
        options: StreamParams["options"]
    ) {
        await this.initModelFetcherService();

        const pluginMap: Record<APIProviders, () => Promise<any>> = {
            // @ts-ignore
            openai: async () => {
                const openaiClient = new OpenAI({
                    apiKey: this.getKey("openaiKey"),
                });
                // @ts-ignore
                return new OpenAiLikePlugin(openaiClient, "gpt-4o");
            },
            openrouter: async () => {
                const openRouterKey = this.getKey("openRouterKey");
                return new OpenRouterPlugin(openRouterKey ?? "", GEMINI_BASE_URL);
            },
            xai: async () => {
                const xaiClient = new OpenAI({
                    baseURL: "https://api.x.ai/v1",
                    apiKey: this.getKey("xaiKey"),
                });
                // @ts-ignore
                return new OpenAiLikePlugin(xaiClient, options?.model || "grok-beta");
            },
            google_gemini: async () => {
                const apiKey = this.getKey("googleGeminiKey");
                return new GeminiPlugin(apiKey, GEMINI_BASE_URL, options?.model || "models/gemini-1.5-pro");
            },
            lmstudio: async () => {
                const lmStudioClient = new OpenAI({
                    baseURL: LMSTUDIO_BASE_URL,
                    apiKey: "lm-studio",
                });
                // @ts-ignore
                return new OpenAiLikePlugin(lmStudioClient, options?.model || "llama3");
            },
            anthropic: async () => {
                const key = this.getKey("anthropicKey");
                return new AnthropicPlugin(key, "2023-06-01");
            },
            groq: async () => {
                const groqKey = this.getKey("groqKey");
                return new GroqPlugin(groqKey, GROQ_BASE_URL);
            },
            together: async () => {
                const tKey = this.getKey("togetherKey");
                return new TogetherPlugin(tKey, TOGETHER_BASE_URL);
            },
            ollama: async () => {
                return new OllamaPlugin(OLLAMA_BASE_URL);
            },
        };

        // Default to openai if the provider isn't found
        const pluginFunc = pluginMap[provider] || pluginMap["openai"];
        return pluginFunc();
    }

    /**
     * Process a message (moved from provider-chat-service):
     *  1) Save user message
     *  2) Create placeholder assistant message
     *  3) Invoke streaming
     */
    public async processMessage({
        chatId,
        userMessage,
        provider = "openai",
        options = {},
        tempId,
        systemMessage,
    }: ProcessMessageParams): Promise<ReadableStream<Uint8Array>> {
        let assistantMessageId: string | undefined;

        try {
            // 1) Save user message
            await this.chatService.saveMessage({
                chatId,
                role: "user",
                content: userMessage,
            });
            await this.chatService.updateChatTimestamp(chatId);

            // 2) Create a placeholder assistant message
            const initialAssistantMessage = await this.chatService.saveMessage({
                chatId,
                role: "assistant",
                // content: "You are a helpful assistant, helping a user within an app called OctoPrompt.",
                content: "...",
                tempId,
            });
            assistantMessageId = initialAssistantMessage.id;

            // 3) Now stream the final assistant response
            return this.streamMessage({
                chatId,
                assistantMessageId,
                userMessage,
                options,
                tempId,
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

    /**
     * Stream messages using SSE
     * (Simplified: we remove creation of user/assistant messages since that's done in processMessage.)
     */
    async streamMessage(
        streamConfig: StreamParams & {
            provider: APIProviders;
            systemMessage?: string;
            assistantMessageId: string; // We now require this to handle partial updates
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

        // 1) Pick the right plugin
        const plugin = await this.getProviderPlugin(provider, options);

        // 2) Accumulate partial text
        let fullResponse = "";

        // 3) Stream SSE
        return createSSEStream({
            userMessage,
            systemMessage,
            plugin,
            options,
            handlers: {
                onSystemMessage: async (msg) => {
                    console.log("[ProviderService] systemMessage:", msg.content);
                },
                onUserMessage: async (msg) => {
                    console.log("[ProviderService] user:", msg.content);
                },
                onPartial: async (partial) => {
                    fullResponse += partial.content;
                    // Update the placeholder assistant message as we stream
                    await this.chatService.updateMessageContent(
                        assistantMessageId,
                        fullResponse
                    );
                },
                onDone: async (final) => {
                    fullResponse = final.content;
                    // Update one last time with the final content
                    await this.chatService.updateMessageContent(
                        assistantMessageId,
                        fullResponse
                    );
                    console.log("[ProviderService] final assistant text:", fullResponse);
                },
                onError: async (err, partialSoFar) => {
                    console.error("[ProviderService] SSE error:", err);
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

    /**
     * A unified method to list models for a given provider
     */
    async listModels(provider: APIProviders): Promise<UnifiedModel[]> {
        await this.initModelFetcherService();
        return this.modelFetcherService!.listModels(provider);
    }
}