import { z } from 'zod';
import {
    CoreMessage,
    LanguageModel,
    streamText,
    generateText,
    generateObject,
} from 'ai';
import {
    createOpenAI,
} from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOllama } from 'ollama-ai-provider';
import { createProviderKeyService } from "./model-providers/provider-key-service";
import { createChatService } from "./chat-service";
import { APIProviders, ProviderKey } from 'shared/src/schemas/provider-key.schemas';
import { AiChatStreamRequest } from 'shared/src/schemas/chat.schemas';
import { AiSdkOptions } from 'shared/src/schemas/gen-ai.schemas';
import { LOW_MODEL_CONFIG } from 'shared';

// --- Constants for Base URLs (Can be overridden by settings) ---
// Use the base URLs defined in the user's guide's .env section
const DEFAULT_OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'; // Ollama default
const DEFAULT_LMSTUDIO_BASE_URL = process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234/v1'; // LMStudio default OpenAI-compatible endpoint


let providerKeysCache: ProviderKey[] | null = null;

/**
 * Main entry point for processing a user message via streaming, handling database updates.
 * Returns a ReadableStream of Uint8Array conforming to the Vercel AI SDK protocol.
 */
export async function handleChatMessage({
    chatId,
    userMessage,
    options = {},
    systemMessage,
    tempId,
    debug = false
}: AiChatStreamRequest): Promise<ReturnType<typeof streamText>> { // Return type changed
    let finalAssistantMessageId: string | undefined;

    const finalOptions = { ...LOW_MODEL_CONFIG, ...options }
    const provider = finalOptions.provider as APIProviders

    const chatService = createChatService();

    // try {
    // 1. Get Model Instance
    // Pass model directly to options for getProviderModel
    const modelInstance = await getProviderLanguageModelInterface(finalOptions.provider as APIProviders, finalOptions);

    // 2. Prepare Messages
    let messagesToProcess: CoreMessage[] = [];

    if (systemMessage) {
        messagesToProcess.push({ role: 'system', content: systemMessage });
    }

    // Fetch message history
    const dbMessages = (await chatService.getChatMessages(chatId)).map(msg => ({
        role: msg.role as 'user' | 'assistant' | 'system', // Cast role
        content: msg.content
    }));
    messagesToProcess.push(...dbMessages);

    // Save User Message
    const savedUserMessage = await chatService.saveMessage({
        chatId,
        role: "user",
        content: userMessage,
        tempId: tempId ? `${tempId}-user` : undefined
    } as any); // Use proper type - Changed to any temporarily

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
    } as any); // Use proper type - Changed to any temporarily
    finalAssistantMessageId = initialAssistantMessage.id;

    // 4. Call streamText for text generation
    return streamText({
        model: modelInstance,
        messages: messagesToProcess,

        // Map options directly from the request
        temperature: finalOptions.temperature,
        maxTokens: finalOptions.maxTokens,
        topP: finalOptions.topP,
        frequencyPenalty: finalOptions.frequencyPenalty,
        presencePenalty: finalOptions.presencePenalty,
        topK: finalOptions.topK,
        // Pass through response_format if provided in options
        ...(finalOptions.response_format && {
            response_format: finalOptions.response_format
        }),

        // Handle completion and errors
        onFinish: async ({ text, usage, finishReason }) => {
            if (debug) {
                console.log(`[UnifiedProviderService] streamText finished for ${provider}/${modelInstance.modelId}. Reason: ${finishReason}. Usage: ${JSON.stringify(usage)}`);
            }

            const finalContent = text || '';

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
            // Optionally, update the placeholder message with an error here too
            if (finalAssistantMessageId) {
                chatService.updateMessageContent(finalAssistantMessageId, `Error: Streaming failed. ${error instanceof Error ? error.message : String(error)}`).catch(dbError => {
                    console.error(`[UnifiedProviderService] Failed to update message content with stream error in DB for ID ${finalAssistantMessageId}:`, dbError);
                });
            }
        },
    });


    // TODO:handle error on route
    // } catch (error: any) {
    //     console.error(`[UnifiedProviderService] Error processing message for ${provider}/${model}:`, error);

    //     // Update placeholder message with error if an ID exists
    //     if (finalAssistantMessageId) {
    //         try {
    //             await chatService.updateMessageContent(
    //                 finalAssistantMessageId,
    //                 `Error: Failed to get response from ${provider}. ${error instanceof Error ? error.message : String(error)}`
    //             );
    //         } catch (dbError) {
    //             console.error(`[UnifiedProviderService] Failed to update message content with error in DB for ID ${finalAssistantMessageId}:`, dbError);
    //         }
    //     }
    //     // Re-throw the error to be handled by the caller (e.g., the API route)
    //     // Return an empty stream or error stream might be better depending on client handling
    //     const errorStream = new ReadableStream({
    //         start(controller) {
    //             controller.error(error);
    //         }
    //     });
    //     return errorStream as unknown as StreamTextResult<any, any>
    //     // Or throw error; depending on how Hono/clients expect errors
    // }
}


async function loadKeys(): Promise<ProviderKey[]> {
    const providerKeyService = createProviderKeyService();
    // Simple cache invalidation on update/delete could be added if keys change often
    if (providerKeysCache === null) {
        providerKeysCache = await providerKeyService.listKeys();
    }
    return providerKeysCache;
}



async function getKey(provider: APIProviders, debug: boolean): Promise<string | undefined> {
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
async function getProviderLanguageModelInterface(
    provider: APIProviders,
    options: AiSdkOptions = {},
    debug: boolean = false
): Promise<LanguageModel> {
    const finalOptions = { ...LOW_MODEL_CONFIG, ...options }
    const modelId = finalOptions.model || LOW_MODEL_CONFIG.model || '';

    if (!modelId) {
        throw new Error(`Model ID must be specified for provider ${provider} either in options or defaults.`);
    }

    if (debug) {
        console.log(`[UnifiedProviderService] Initializing model: Provider=${provider}, ModelID=${modelId}`);
    }

    switch (provider) {
        case "openai": {
            const apiKey = await getKey("openai", debug);
            // The openai() factory automatically checks process.env.OPENAI_API_KEY if apiKey is undefined
            return createOpenAI({ apiKey, })(modelId)
        }
        case "anthropic": {
            const apiKey = await getKey("anthropic", debug);
            // anthropic() factory checks process.env.ANTHROPIC_API_KEY if apiKey is undefined
            if (!apiKey && !process.env.ANTHROPIC_API_KEY) throw new Error("Anthropic API Key not found in DB or environment.");
            return createAnthropic({ apiKey })(modelId);
        }
        case "google_gemini": {
            const apiKey = await getKey("google_gemini", debug);
            // google() factory checks process.env.GOOGLE_GENERATIVE_AI_API_KEY if apiKey is undefined
            if (!apiKey && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) throw new Error("Google Gemini API Key not found in DB or environment.");
            return createGoogleGenerativeAI({ apiKey })(modelId);
        }
        case "groq": {
            const apiKey = await getKey("groq", debug);
            // groq() factory checks process.env.GROQ_API_KEY if apiKey is undefined
            if (!apiKey && !process.env.GROQ_API_KEY) throw new Error("Groq API Key not found in DB or environment.");
            return createGroq({ apiKey })(modelId);
        }
        case "openrouter": {
            const apiKey = await getKey("openrouter", debug);
            // createOpenRouter factory checks process.env.OPENROUTER_API_KEY if apiKey is undefined
            if (!apiKey && !process.env.OPENROUTER_API_KEY) throw new Error("OpenRouter API Key not found in DB or environment.");
            // Note: Pass config to createOpenRouter, then modelId to the result
            return createOpenRouter({ apiKey })(modelId);
        }
        // --- OpenAI Compatible Providers ---
        case "lmstudio": {
            const lmStudioUrl = DEFAULT_LMSTUDIO_BASE_URL;
            if (!lmStudioUrl) throw new Error("LMStudio Base URL not configured.");
            // Use the generic createOpenAI factory for compatible endpoints
            return createOpenAI({
                baseURL: lmStudioUrl,
                apiKey: 'lm-studio-ignored-key', // Often ignored by local servers, but required by SDK type
            })(modelId);
        }
        // Add cases for xai, together if they use OpenAI compatible endpoints
        case "xai": {
            const apiKey = await getKey("xai", debug);
            if (!apiKey) throw new Error("XAI API Key not found in DB.");
            // Confirm the exact baseURL for XAI
            return createOpenAI({ baseURL: "https://api.x.ai/v1", apiKey })(modelId);
        }
        case "together": {
            const apiKey = await getKey("together", debug);
            if (!apiKey) throw new Error("Together API Key not found in DB.");
            return createOpenAI({ baseURL: "https://api.together.xyz/v1", apiKey })(modelId);
        }
        // --- Local Providers ---
        case "ollama": {
            const ollamaUrl = DEFAULT_OLLAMA_BASE_URL;
            if (!ollamaUrl) throw new Error("Ollama Base URL not configured.");
            // Ensure ollama-ai-provider follows the Vercel SDK factory pattern
            // It might be `ollama({ baseURL: ollamaUrl })(modelId)` or similar
            // Check the specific package documentation for createOllama usage
            return createOllama({ baseURL: ollamaUrl })(modelId); // Adjust if needed based on package docs
        }
        default:
            console.error(`[UnifiedProviderService] Unsupported provider: ${provider}. Falling back to OpenAI.`);
            // Fallback logic (optional)
            const fallbackApiKey = await getKey("openai", debug);
            const fallbackModel = LOW_MODEL_CONFIG.model
            return createOpenAI({ apiKey: fallbackApiKey })(fallbackModel ?? 'gpt-4o');
        // OR: throw new Error(`Unsupported provider configured: ${provider}`);
    }
}



/**
 * Helper function for non-streaming text generation.
 */
export async function generateSingleText({
    prompt, // Simple prompt convenience
    messages, // Or full message history
    options = {},
    systemMessage,
    debug = false
}: {
    prompt: string;
    messages?: CoreMessage[];
    options?: AiSdkOptions;
    systemMessage?: string;
    debug?: boolean;
}): Promise<string> {
    const finalOptions = { ...LOW_MODEL_CONFIG, ...options }
    const provider = finalOptions.provider as APIProviders
    if (!prompt && (!messages || messages.length === 0)) {
        throw new Error("Either 'prompt' or 'messages' must be provided for generateSingleText.");
    }

    const modelInstance = await getProviderLanguageModelInterface(provider, finalOptions);

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
        // Map options - Use new names from AiSdkOptionsSchema
        temperature: finalOptions.temperature,
        maxTokens: finalOptions.maxTokens,
        topP: finalOptions.topP,
        frequencyPenalty: finalOptions.frequencyPenalty,
        presencePenalty: finalOptions.presencePenalty,
        topK: finalOptions.topK,
        // stop: options.stop,           
    });

    if (debug) {
        console.log(`[UnifiedProviderService] generateText finished for ${provider}/${modelInstance.modelId}. Reason: ${finishReason}. Usage: ${JSON.stringify(usage)}`);
    }

    return text;
}

/**
* Helper function for generating structured JSON objects.
*/
export async function generateStructuredData<T extends z.ZodType<any, z.ZodTypeDef, any>>({ // Accept ZodTypeAny
    prompt,
    schema,
    options = {},
    systemMessage,
    debug = false,
}: {
    prompt: string;
    schema: T;
    systemMessage?: string;
    debug?: boolean;
    options?: AiSdkOptions;
}): Promise<{ object: z.infer<T>; usage: { completionTokens: number; promptTokens: number; totalTokens: number; }; finishReason: string /* ...other potential fields */ }> { // Return structure from generateObject
    const finalOptions = { ...LOW_MODEL_CONFIG, ...options }
    const provider = finalOptions.provider as APIProviders

    const model = finalOptions.model

    if (!prompt) {
        throw new Error("'prompt' must be provided for generateStructuredData.");
    }
    // Pass model in options
    const modelInstance = await getProviderLanguageModelInterface(provider, { ...finalOptions, model: model });

    if (debug) {
        console.log(`[UnifiedProviderService] Generating structured data: Provider=${provider}, ModelID=${modelInstance.modelId}, Schema=${schema.description || 'Unnamed Schema'}`);
    }

    // Use generateObject
    const result = await generateObject({
        // output: 'array',// set to array to return array of objects
        model: modelInstance,
        schema: schema, // Pass the Zod schema directly
        // mode: 'json', // Ensure JSON mode is requested
        prompt: prompt,
        system: systemMessage,
        temperature: finalOptions.temperature,
        maxTokens: finalOptions.maxTokens,
        topP: finalOptions.topP,
        frequencyPenalty: finalOptions.frequencyPenalty,
        presencePenalty: finalOptions.presencePenalty,
        topK: finalOptions.topK,
        // topK might not be supported by generateObject directly
        // stop sequences might not be applicable/supported
    });

    if (debug) {
        console.log(`[UnifiedProviderService] generateObject finished. Reason: ${result.finishReason}. Usage: ${JSON.stringify(result.usage)}`);
    }


    return result; // Return the full result object which includes .object, .usage etc.
}



/**
 * Generates streaming text output for a given prompt or message history
 * without saving to the database. Ideal for one-off streaming use cases.
 *
 * Returns a ReadableStream conforming to the Vercel AI SDK protocol.
 */
export async function genTextStream({
    prompt,         // Optional: Simple user prompt
    messages,       // Optional: Full message history
    options = {},   // AI SDK options (including model)
    systemMessage,  // Optional: System message
    debug = false
}: {
    prompt?: string; // Allow only prompt
    messages?: CoreMessage[]; // Allow only messages
    options?: AiSdkOptions; // Use the correct type
    systemMessage?: string;
    debug?: boolean;
}): Promise<ReturnType<typeof streamText>> { // Return type is the stream
    const finalOptions = { ...LOW_MODEL_CONFIG, ...options }
    const provider = finalOptions.provider as APIProviders

    // 1. Input Validation
    if (!prompt && (!messages || messages.length === 0)) {
        throw new Error("Either 'prompt' or 'messages' must be provided for genTextStream.");
    }

    try {
        // 2. Get Model Instance
        // Pass model directly from options if provided
        const modelInstance = await getProviderLanguageModelInterface(provider, finalOptions, debug);

        // 3. Prepare Messages
        let messagesToProcess: CoreMessage[] = [];
        if (systemMessage) {
            messagesToProcess.push({ role: 'system', content: systemMessage });
        }
        if (messages) {
            messagesToProcess.push(...messages);
        }
        // Add the prompt as the last user message if provided
        if (prompt) {
            // Ensure it doesn't duplicate the last message if messages were also provided
            const lastMessage = messagesToProcess[messagesToProcess.length - 1];
            if (!lastMessage || !(lastMessage.role === 'user' && lastMessage.content === prompt)) {
                messagesToProcess.push({ role: 'user', content: prompt });
            }
        }

        // Ensure there's something to process
        if (messagesToProcess.length === 0) {
            throw new Error("No valid input content (prompt or messages) resulted in messages to process.");
        }


        if (debug) {
            console.log(`[UnifiedProviderService - genTextStream] Starting stream for ${provider}/${modelInstance.modelId}. Messages:`, messagesToProcess);
        }

        // 4. Call streamText for text generation
        // No database interactions needed here
        return streamText({
            model: modelInstance,
            messages: messagesToProcess,

            // Map options directly from the request
            temperature: options.temperature,
            maxTokens: options.maxTokens,
            topP: options.topP,
            frequencyPenalty: options.frequencyPenalty,
            presencePenalty: options.presencePenalty,
            topK: options.topK,
            // Pass through response_format if provided in options
            ...(options.response_format && {
                response_format: options.response_format
            }),

            // Minimal handlers for logging or potential side-effects *not* involving the DB
            onFinish: ({ text, usage, finishReason }) => {
                if (debug) {
                    console.log(`[UnifiedProviderService - genTextStream] streamText finished for ${provider}/${modelInstance.modelId}. Reason: ${finishReason}. Usage: ${JSON.stringify(usage)}.`);
                    // console.log(`[UnifiedProviderService - genTextStream] Final Text: ${text}`); // Be cautious logging full text in production
                }
                // No DB updates needed
            },
            onError: (error) => {
                console.error(`[UnifiedProviderService - genTextStream] Error during stream for ${provider}/${modelInstance.modelId}:`, error);
                // No DB updates needed
                // The error will propagate through the stream to the client
            },
        });

    } catch (error: any) {
        console.error(`[UnifiedProviderService - genTextStream] Error setting up stream for ${provider}:`, error);
        // How to handle errors before the stream starts?
        // Option 1: Re-throw the error to be handled by the caller
        // throw error;

        // Option 2: Return a stream that immediately errors out
        const errorStream = new ReadableStream({
            start(controller) {
                controller.error(error);
            }
        });
        // Cast needed because the direct return type doesn't match perfectly
        // without the generic constraints of StreamTextResult, but it works functionally.
        return errorStream as unknown as ReturnType<typeof streamText>;
    }
}
