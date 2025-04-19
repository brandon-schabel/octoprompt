import { z } from 'zod';
import {
    CoreMessage,
    LanguageModel,
    streamText,
    generateText, // Added for non-streaming cases
    generateObject,
    streamObject, // Added for structured output
} from 'ai';
import {
    openai,
    createOpenAI, // Renamed from createOpenAI for clarity if needed, but usually just openai is fine
} from '@ai-sdk/openai';
import { anthropic, createAnthropic } from '@ai-sdk/anthropic';
import { google, createGoogleGenerativeAI } from '@ai-sdk/google';
import { groq, createGroq } from '@ai-sdk/groq';
import { createOpenRouter } from '@openrouter/ai-sdk-provider'; // Use the specific package
import { createOllama } from 'ollama-ai-provider'; // Assuming ollama-ai-provider exports this
import { createProviderKeyService } from "./provider-key-service";
import { APIProviders, DEFAULT_MODEL_CONFIGS } from "shared";
import { ProcessMessageParams, AISdkOptions } from "./unified-provider-types";
import { createChatService } from "../chat/chat-service";
import { websocketStateAdapter } from "@/utils/websocket/websocket-state-adapter";
import { ProviderKey } from 'shared/schema';
import { parseStructuredJson } from '@/utils/structured-output-fetcher';

// --- Constants for Base URLs (Can be overridden by settings) ---
// Use the base URLs defined in the user's guide's .env section
const DEFAULT_OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'; // Ollama default
const DEFAULT_LMSTUDIO_BASE_URL = process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234/v1'; // LMStudio default OpenAI-compatible endpoint

export function createUnifiedProviderService(debugParam = false) {
    const debug = debugParam;
    const providerKeyService = createProviderKeyService();
    const chatService = createChatService();

    let providerKeysCache: ProviderKey[] | null = null;

    async function loadKeys(): Promise<ProviderKey[]> {
        // Simple cache invalidation on update/delete could be added if keys change often
        if (providerKeysCache === null) {
            providerKeysCache = await providerKeyService.listKeys();
        }
        return providerKeysCache;
    }

    async function getKey(provider: APIProviders): Promise<string | undefined> {
        const keys = await loadKeys();
        const keyEntry = keys.find(k => k.provider === provider);
        if (!keyEntry && debug) {
            console.warn(`[UnifiedProviderService] API key for provider "${provider}" not found in DB. SDK might check environment variables.`);
        }
        return keyEntry?.key;
    }

    /**
     * Gets an initialized Vercel AI SDK LanguageModel instance for the given provider and options.
     * Handles API key fetching and local provider configurations.
     */
    async function getProviderModel(
        provider: APIProviders,
        options: AISdkOptions = {}
    ): Promise<LanguageModel> {
        const state = await websocketStateAdapter.getState(); // Needed for local URLs
        const modelId = options.model || DEFAULT_MODEL_CONFIGS[provider]?.model || '';

        if (!modelId) {
            throw new Error(`Model ID must be specified for provider ${provider} either in options or defaults.`);
        }

        if (debug) {
            console.log(`[UnifiedProviderService] Initializing model: Provider=${provider}, ModelID=${modelId}`);
        }

        switch (provider) {
            case "openai": {
                const apiKey = await getKey("openai");
                // The openai() factory automatically checks process.env.OPENAI_API_KEY if apiKey is undefined
                return createOpenAI({ apiKey, })(modelId)
            }
            case "anthropic": {
                const apiKey = await getKey("anthropic");
                // anthropic() factory checks process.env.ANTHROPIC_API_KEY if apiKey is undefined
                if (!apiKey && !process.env.ANTHROPIC_API_KEY) throw new Error("Anthropic API Key not found in DB or environment.");
                return createAnthropic({ apiKey })(modelId);
            }
            case "google_gemini": {
                const apiKey = await getKey("google_gemini");
                // google() factory checks process.env.GOOGLE_GENERATIVE_AI_API_KEY if apiKey is undefined
                if (!apiKey && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) throw new Error("Google Gemini API Key not found in DB or environment.");
                return createGoogleGenerativeAI({ apiKey })(modelId);
            }
            case "groq": {
                const apiKey = await getKey("groq");
                // groq() factory checks process.env.GROQ_API_KEY if apiKey is undefined
                if (!apiKey && !process.env.GROQ_API_KEY) throw new Error("Groq API Key not found in DB or environment.");
                return createGroq({ apiKey })(modelId);
            }
            case "openrouter": {
                const apiKey = await getKey("openrouter");
                // createOpenRouter factory checks process.env.OPENROUTER_API_KEY if apiKey is undefined
                if (!apiKey && !process.env.OPENROUTER_API_KEY) throw new Error("OpenRouter API Key not found in DB or environment.");
                // Note: Pass config to createOpenRouter, then modelId to the result
                return createOpenRouter({ apiKey })(modelId);
            }
            // --- OpenAI Compatible Providers ---
            case "lmstudio": {
                const lmStudioUrl = state.settings.lmStudioGlobalUrl || DEFAULT_LMSTUDIO_BASE_URL;
                if (!lmStudioUrl) throw new Error("LMStudio Base URL not configured.");
                // Use the generic createOpenAI factory for compatible endpoints
                return createOpenAI({
                    baseURL: lmStudioUrl,
                    apiKey: 'lm-studio-ignored-key', // Often ignored by local servers, but required by SDK type
                })(modelId);
            }
            // Add cases for xai, together if they use OpenAI compatible endpoints
            case "xai": {
                const apiKey = await getKey("xai");
                if (!apiKey) throw new Error("XAI API Key not found in DB.");
                // Confirm the exact baseURL for XAI
                return createOpenAI({ baseURL: "https://api.x.ai/v1", apiKey })(modelId);
            }
            case "together": {
                const apiKey = await getKey("together");
                if (!apiKey) throw new Error("Together API Key not found in DB.");
                return createOpenAI({ baseURL: "https://api.together.xyz/v1", apiKey })(modelId);
            }
            // --- Local Providers ---
            case "ollama": {
                const ollamaUrl = state.settings.ollamaGlobalUrl || DEFAULT_OLLAMA_BASE_URL;
                if (!ollamaUrl) throw new Error("Ollama Base URL not configured.");
                // Ensure ollama-ai-provider follows the Vercel SDK factory pattern
                // It might be `ollama({ baseURL: ollamaUrl })(modelId)` or similar
                // Check the specific package documentation for createOllama usage
                return createOllama({ baseURL: ollamaUrl })(modelId); // Adjust if needed based on package docs
            }
            default:
                console.error(`[UnifiedProviderService] Unsupported provider: ${provider}. Falling back to OpenAI.`);
                // Fallback logic (optional)
                const fallbackApiKey = await getKey("openai");
                const fallbackModel = DEFAULT_MODEL_CONFIGS.openai?.model || 'gpt-3.5-turbo'; // Provide a default model
                return createOpenAI({ apiKey: fallbackApiKey })(fallbackModel);
            // OR: throw new Error(`Unsupported provider configured: ${provider}`);
        }
    }

    /**
     * Main entry point for processing a user message via streaming.
     * Returns a ReadableStream of Uint8Array conforming to the Vercel AI SDK protocol.
     */
    async function processMessage({
        chatId,
        userMessage,
        provider = "openai",
        options = {},
        tempId,
        systemMessage,
        messages: historyMessages,
        schema, // New: Schema for structured outputs
        enum: enumValues, // New: Enum values for enum output strategy
    }: ProcessMessageParams): Promise<ReadableStream<Uint8Array>> {
        let finalAssistantMessageId: string | undefined;

        try {
            // 1. Get Model Instance
            const modelInstance = await getProviderModel(provider, options);

            // 2. Prepare Messages
            let messagesToProcess: CoreMessage[] = [];

            if (systemMessage) {
                messagesToProcess.push({ role: 'system', content: systemMessage });
            }

            // Fetch or use provided history
            const dbMessages = historyMessages ?? (await chatService.getChatMessages(chatId)).map(msg => ({
                role: msg.role as 'user' | 'assistant' | 'system',
                content: msg.content
            }));
            messagesToProcess.push(...dbMessages);

            // Save User Message
            const savedUserMessage = await chatService.saveMessage({
                chatId,
                role: "user",
                content: userMessage,
                tempId: tempId ? `${tempId}-user` : undefined
            } as any);

            // Add the new user message for the AI call
            messagesToProcess.push({ role: 'user', content: userMessage });

            // 3. Update Chat Timestamp
            await chatService.updateChatTimestamp(chatId);

            // Create placeholder for Assistant Message
            const initialAssistantMessage = await chatService.saveMessage({
                chatId,
                role: "assistant",
                content: "...", // Placeholder
                tempId: tempId,
            } as any);
            finalAssistantMessageId = initialAssistantMessage.id;

            // 4. Call the appropriate AI SDK function based on whether schema is provided
            let result: ReadableStream<Uint8Array>;

            if (schema) {
                // Using AI SDK's streamObject for structured output
                let streamResult;

                // Handle different output strategies with explicit types
                if (options.outputStrategy === 'array') {
                    streamResult = await streamObject({
                        model: modelInstance,
                        messages: messagesToProcess,
                        schema: schema,
                        output: 'array',

                        // Map options
                        temperature: options.temperature,
                        maxTokens: options.maxTokens,
                        topP: options.topP,
                        frequencyPenalty: options.frequencyPenalty,
                        presencePenalty: options.presencePenalty,
                        topK: options.topK,

                        // Structured output specific options
                        mode: options.structuredOutputMode,
                        schemaName: options.schemaName,
                        schemaDescription: options.schemaDescription,

                        // Handle completion and errors
                        onFinish: async ({ object, usage }) => {
                            if (debug) {
                                console.log(`[UnifiedProviderService] streamObject finished for ${provider}/${modelInstance.modelId}. Usage: ${JSON.stringify(usage)}`);
                            }

                            // Convert the object to a JSON string to store in the message
                            const jsonString = JSON.stringify(object, null, 2);

                            // Update the placeholder Assistant Message
                            if (finalAssistantMessageId) {
                                try {
                                    await chatService.updateMessageContent(finalAssistantMessageId, jsonString);
                                } catch (dbError) {
                                    console.error(`[UnifiedProviderService] Failed to update final message content in DB for ID ${finalAssistantMessageId}:`, dbError);
                                }
                            }
                        },
                        onError: (error) => {
                            console.error(`[UnifiedProviderService] Error during stream for ${provider}/${modelInstance.modelId}:`, error);
                        },
                    });

                    result = streamResult.elementStream as unknown as ReadableStream<Uint8Array>;
                } else if (options.outputStrategy === 'enum' && enumValues) {
                    // Handle enum output strategy
                    const enumResult = await generateObject({
                        model: modelInstance,
                        messages: messagesToProcess,
                        output: 'enum',
                        enum: enumValues,

                        // Other options
                        temperature: options.temperature,
                        maxTokens: options.maxTokens,
                        topP: options.topP,
                    });

                    // Since generateObject is not streaming, create a stream with the result
                    const encoder = new TextEncoder();
                    const readableStream = new ReadableStream({
                        start(controller) {
                            controller.enqueue(encoder.encode(JSON.stringify(enumResult.object)));
                            controller.close();
                        }
                    });

                    // Update the message with the enum result
                    if (finalAssistantMessageId) {
                        try {
                            await chatService.updateMessageContent(
                                finalAssistantMessageId,
                                JSON.stringify(enumResult.object)
                            );
                        } catch (dbError) {
                            console.error(`[UnifiedProviderService] Failed to update enum result in DB:`, dbError);
                        }
                    }

                    result = readableStream;
                } else {
                    // Default to object output strategy
                    streamResult = await streamObject({
                        model: modelInstance,
                        messages: messagesToProcess,
                        schema: schema,
                        output: 'object',

                        // Map options
                        temperature: options.temperature,
                        maxTokens: options.maxTokens,
                        topP: options.topP,
                        frequencyPenalty: options.frequencyPenalty,
                        presencePenalty: options.presencePenalty,
                        topK: options.topK,

                        // Structured output specific options
                        mode: options.structuredOutputMode,
                        schemaName: options.schemaName,
                        schemaDescription: options.schemaDescription,

                        // Handle completion and errors
                        onFinish: async ({ object, usage }) => {
                            if (debug) {
                                console.log(`[UnifiedProviderService] streamObject finished for ${provider}/${modelInstance.modelId}. Usage: ${JSON.stringify(usage)}`);
                            }

                            // Convert the object to a JSON string to store in the message
                            const jsonString = JSON.stringify(object, null, 2);

                            // Update the placeholder Assistant Message
                            if (finalAssistantMessageId) {
                                try {
                                    await chatService.updateMessageContent(finalAssistantMessageId, jsonString);
                                } catch (dbError) {
                                    console.error(`[UnifiedProviderService] Failed to update final message content in DB for ID ${finalAssistantMessageId}:`, dbError);
                                }
                            }
                        },
                        onError: (error) => {
                            console.error(`[UnifiedProviderService] Error during stream for ${provider}/${modelInstance.modelId}:`, error);
                        },
                    });

                    result = streamResult.partialObjectStream as unknown as ReadableStream<Uint8Array>;
                }
            } else {
                // Using regular text output or OpenRouter's response_format for structured output
                const streamResult = await streamText({
                    model: modelInstance,
                    messages: messagesToProcess,

                    // Map options
                    temperature: options.temperature,
                    maxTokens: options.maxTokens,
                    topP: options.topP,
                    frequencyPenalty: options.frequencyPenalty,
                    presencePenalty: options.presencePenalty,
                    topK: options.topK,

                    // Pass through response_format if provided
                    ...(options.response_format && {
                        response_format: options.response_format
                    }),

                    // Handle completion and errors
                    onFinish: async ({ text, usage, finishReason }) => {
                        if (debug) {
                            console.log(`[UnifiedProviderService] streamText finished for ${provider}/${modelInstance.modelId}. Reason: ${finishReason}. Usage: ${JSON.stringify(usage)}`);
                        }

                        let finalContent = text || '';

                        // If response_format is set to JSON, try to parse and format the JSON
                        if (options.response_format?.type === "json_schema") {
                            try {
                                // Use parseStructuredJson to extract JSON from the response
                                const parsedJson = parseStructuredJson(finalContent);
                                if (parsedJson) {
                                    finalContent = JSON.stringify(parsedJson, null, 2);
                                }
                            } catch (e) {
                                console.error('[UnifiedProviderService] Error parsing JSON from response:', e);
                            }
                        }

                        // Update the placeholder Assistant Message with Final Content
                        if (finalAssistantMessageId) {
                            try {
                                await chatService.updateMessageContent(finalAssistantMessageId, finalContent);
                            } catch (dbError) {
                                console.error(`[UnifiedProviderService] Failed to update final message content in DB for ID ${finalAssistantMessageId}:`, dbError);
                            }
                        }
                    },
                    onError: (error) => {
                        console.error(`[UnifiedProviderService] Error during stream for ${provider}/${modelInstance.modelId}:`, error);
                    },
                });

                result = streamResult.textStream as unknown as ReadableStream<Uint8Array>;
            }

            // 5. Return the stream
            return result;

        } catch (error: any) {
            console.error(`[UnifiedProviderService] Error processing message for ${provider}:`, error);

            // Update placeholder message with error if an ID exists
            if (finalAssistantMessageId) {
                try {
                    await chatService.updateMessageContent(
                        finalAssistantMessageId,
                        `Error: Failed to get response from ${provider}. ${error.message || 'Unknown error'}`
                    );
                } catch (dbError) {
                    console.error(`[UnifiedProviderService] Failed to update message content with error in DB for ID ${finalAssistantMessageId}:`, dbError);
                }
            }

            throw error;
        }
    }

    /**
     * Helper function for non-streaming text generation.
     */
    async function generateSingleText({
        prompt, // Simple prompt convenience
        messages, // Or full message history
        provider = "openai",
        options = {},
        systemMessage,
    }: {
        prompt?: string;
        messages?: CoreMessage[];
        provider?: APIProviders;
        options?: AISdkOptions;
        systemMessage?: string;
    }): Promise<string> {
        if (!prompt && (!messages || messages.length === 0)) {
            throw new Error("Either 'prompt' or 'messages' must be provided for generateSingleText.");
        }

        const modelInstance = await getProviderModel(provider, options);

        let messagesToProcess: CoreMessage[] = [];
        if (systemMessage) {
            messagesToProcess.push({ role: 'system', content: systemMessage });
        }
        if (messages) {
            messagesToProcess.push(...messages);
        }
        if (prompt) {
            // If using prompt, ensure it's the last message and typically from 'user'
            // If history (`messages`) is also provided, decide how to combine them.
            // Simplest: assume `prompt` is the primary input if provided.
            messagesToProcess.push({ role: 'user', content: prompt });
        }


        const { text, usage, finishReason } = await generateText({
            model: modelInstance,
            messages: messagesToProcess,
            temperature: options.temperature,
            maxTokens: options.maxTokens,
            topP: options.topP,
            frequencyPenalty: options.frequencyPenalty,
            presencePenalty: options.presencePenalty,
            topK: options.topK,
        });

        if (debug) {
            console.log(`[UnifiedProviderService] generateText finished for ${provider}/${modelInstance.modelId}. Reason: ${finishReason}. Usage: ${JSON.stringify(usage)}`);
        }

        return text;
    }

    /**
     * Helper function for generating structured JSON objects.
     */
    async function generateStructuredData<T>({
        prompt, // Simple prompt convenience
        messages, // Or full message history
        schema,
        provider = "openai", // Choose a provider good at JSON generation
        options = {},
        systemMessage,
    }: {
        prompt?: string;
        messages?: CoreMessage[];
        schema: z.ZodSchema<T>;
        provider?: APIProviders;
        options?: AISdkOptions;
        systemMessage?: string;
    }): Promise<T> {
        if (!prompt && (!messages || messages.length === 0)) {
            throw new Error("Either 'prompt' or 'messages' must be provided for generateStructuredData.");
        }

        const modelInstance = await getProviderModel(provider, options);

        let messagesToProcess: CoreMessage[] = [];
        if (systemMessage) {
            // Add instructions about expecting JSON output if needed, though generateObject handles much of this.
            messagesToProcess.push({ role: 'system', content: systemMessage ?? "Generate a JSON object based on the user request." });
        }
        if (messages) {
            messagesToProcess.push(...messages);
        }
        if (prompt) {
            messagesToProcess.push({ role: 'user', content: prompt });
        }

        // Add a final instruction for JSON specifically if systemMessage wasn't provided
        if (!systemMessage) {
            if (messagesToProcess.find(m => m.role === 'system')) {
                // Append to existing system message if possible, or add instructions elsewhere.
                // For simplicity, let's rely on generateObject's internal prompting.
            } else {
                messagesToProcess.unshift({ role: 'system', content: "You MUST output valid JSON conforming to the provided schema." });
            }
        }


        const { object, usage, finishReason } = await generateObject({
            model: modelInstance,
            schema: schema,
            messages: messagesToProcess,
            // Prompt can also be used directly if message history isn't complex
            // prompt: prompt,
            temperature: options.temperature,
            // Add other compatible options like maxTokens, topP etc. if needed
            mode: 'json' // Explicitly request JSON mode
        });

        if (debug) {
            console.log(`[UnifiedProviderService] generateObject finished for ${provider}/${modelInstance.modelId}. Reason: ${finishReason}. Usage: ${JSON.stringify(usage)}`);
        }

        return object;
    }


    return {
        processMessage, // For streaming chat
        generateSingleText, // For non-streaming text
        generateStructuredData, // For structured JSON output
        getProviderModel, // Expose if needed by other services directly
        // listModels - Still complex to implement reliably across providers with Vercel SDK
    };
}

// Export a singleton instance
export const unifiedProvider = createUnifiedProviderService(process.env.NODE_ENV !== 'production'); // Enable debug based on env