import { z } from 'zod'
import { CoreMessage, LanguageModel, streamText, generateText, generateObject } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createGroq } from '@ai-sdk/groq'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { createOllama } from 'ollama-ai-provider'
import { createProviderKeyService } from './model-providers/provider-key-service'
import { createChatService } from './chat-service'
import { APIProviders, ProviderKey } from '@octoprompt/schemas'
import { AiChatStreamRequest } from '@octoprompt/schemas'
import { AiSdkOptions } from '@octoprompt/schemas'
import { LOW_MODEL_CONFIG } from '@octoprompt/schemas'

import { ApiError } from '@octoprompt/shared'

const DEFAULT_OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
const DEFAULT_LMSTUDIO_BASE_URL = process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234/v1'

let providerKeysCache: ProviderKey[] | null = null

// Helper function to check if a model supports multimodal content (images, files)
function isMultimodalModel(provider: string, model?: string): boolean {
  const multimodalModels = {
    'openai': ['gpt-4-vision-preview', 'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
    'anthropic': ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307', 'claude-3-5-sonnet-20241022'],
    'google': ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro-vision', 'gemini-2.0-flash-exp'],
    'openrouter': ['openai/gpt-4o', 'openai/gpt-4o-mini', 'anthropic/claude-3-opus', 'anthropic/claude-3-sonnet', 'anthropic/claude-3-haiku', 'google/gemini-pro-vision']
  }

  if (!model) return false

  const providerModels = multimodalModels[provider as keyof typeof multimodalModels]
  return providerModels ? providerModels.some(m => model.includes(m)) : false
}

export async function handleChatMessage({
  chatId,
  userMessage,
  options = {},
  systemMessage,
  tempId,
  debug = false,
  currentMessageAttachments
}: AiChatStreamRequest): Promise<ReturnType<typeof streamText>> {
  let finalAssistantMessageId: number | undefined
  const finalOptions = { ...LOW_MODEL_CONFIG, ...options }
  const provider = finalOptions.provider as APIProviders
  const chatService = createChatService()
  const modelInstance = await getProviderLanguageModelInterface(finalOptions.provider as APIProviders, finalOptions)
  let messagesToProcess: CoreMessage[] = []

  if (systemMessage) {
    messagesToProcess.push({ role: 'system', content: systemMessage })
  }

  // Process existing messages, including their attachments
  const dbMessages = (await chatService.getChatMessages(chatId)).map((msg) => {
    const coreMessage: CoreMessage = {
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content
    }

    // Add attachments if they exist and the model supports multimodal content
    if (msg.attachments && msg.attachments.length > 0 && isMultimodalModel(finalOptions.provider, finalOptions.model)) {
      const content: any[] = [{ type: 'text', text: msg.content }]

      msg.attachments.forEach((attachment) => {
        if (attachment.mimeType.startsWith('image/')) {
          content.push({
            type: 'image',
            image: attachment.url
          })
        }
      })

      coreMessage.content = content
    }

    return coreMessage
  })
  messagesToProcess.push(...dbMessages)

  const savedUserMessage = await chatService.saveMessage({
    chatId,
    role: 'user',
    content: userMessage,
    tempId: tempId ? `${tempId}-user` : undefined,
    attachments: currentMessageAttachments
  } as any)

  // Add the current user message with attachments if supported
  const userCoreMessage: CoreMessage = {
    role: 'user',
    content: userMessage
  }

  // Add attachments to the current message if model supports multimodal content
  if (
    currentMessageAttachments &&
    currentMessageAttachments.length > 0 &&
    isMultimodalModel(finalOptions.provider, finalOptions.model)
  ) {
    const content: any[] = [{ type: 'text', text: userMessage }]

    currentMessageAttachments.forEach((attachment) => {
      if (attachment.mimeType.startsWith('image/')) {
        content.push({
          type: 'image',
          image: attachment.url
        })
      }
    })

    userCoreMessage.content = content
  } else if (currentMessageAttachments && currentMessageAttachments.length > 0) {
    // Log a warning if attachments were provided but model doesn't support them
    console.warn(`Model ${finalOptions.model} from provider ${finalOptions.provider} does not support multimodal content. Attachments will be ignored.`)
    if (debug) {
      console.debug('Skipped attachments:', currentMessageAttachments.map(a => a.fileName || a.id))
    }
  }

  messagesToProcess.push(userCoreMessage)

  await chatService.updateChatTimestamp(chatId)

  const initialAssistantMessage = await chatService.saveMessage({
    chatId,
    role: 'assistant',
    content: '...',
    tempId: tempId
  } as any)
  finalAssistantMessageId = initialAssistantMessage.id

  return streamText({
    model: modelInstance,
    messages: messagesToProcess,
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
        console.log(
          `[UnifiedProviderService] streamText finished for ${provider}/${modelInstance.modelId}. Reason: ${finishReason}. Usage: ${JSON.stringify(usage)}`
        )
      }

      const finalContent = text || ''

      // Update the placeholder Assistant Message with Final Content
      if (finalAssistantMessageId) {
        try {
          await chatService.updateMessageContent(chatId, finalAssistantMessageId, finalContent)
        } catch (dbError) {
          console.error(
            `[UnifiedProviderService] Failed to update final message content in DB for ID ${finalAssistantMessageId}:`,
            dbError
          )
        }
      }
    },
    onError: (error) => {
      console.error(`[UnifiedProviderService] Error during stream for ${provider}/${modelInstance.modelId}:`, error)
      // Optionally, update the placeholder message with an error here too
      if (finalAssistantMessageId) {
        chatService
          .updateMessageContent(
            chatId,
            finalAssistantMessageId,
            `Error: Streaming failed. ${error instanceof Error ? error.message : String(error)}`
          )
          .catch((dbError) => {
            console.error(
              `[UnifiedProviderService] Failed to update message content with stream error in DB for ID ${finalAssistantMessageId}:`,
              dbError
            )
          })
      }
    }
  })
}

async function loadUncensoredKeys(): Promise<ProviderKey[]> {
  const providerKeyService = createProviderKeyService()
  // Simple cache invalidation on update/delete could be added if keys change often
  if (providerKeysCache === null) {
    providerKeysCache = await providerKeyService.listKeysUncensored()
  }
  return providerKeysCache
}

async function getKey(provider: APIProviders, debug: boolean): Promise<string | undefined> {
  const keys = await loadUncensoredKeys()
  const keyEntry = keys.find((k) => k.provider === provider)
  if (!keyEntry && debug) {
    console.warn(
      `[UnifiedProviderService] API key for provider "${provider}" not found in DB. SDK might check environment variables.`
    )
  }
  return keyEntry?.key
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
  const modelId = finalOptions.model || LOW_MODEL_CONFIG.model || ''

  if (!modelId) {
    throw new ApiError(
      400,
      `Model ID must be specified for provider ${provider} either in options or defaults.`,
      'MODEL_ID_MISSING'
    )
  }

  if (debug) {
    console.log(`[UnifiedProviderService] Initializing model: Provider=${provider}, ModelID=${modelId}`)
  }

  switch (provider) {
    case 'openai': {
      const apiKey = await getKey('openai', debug)
      return createOpenAI({ apiKey })(modelId)
    }
    case 'anthropic': {
      const apiKey = await getKey('anthropic', debug)
      if (!apiKey && !process.env.ANTHROPIC_API_KEY)
        throw new ApiError(400, 'Anthropic API Key not found in DB or environment.', 'ANTHROPIC_KEY_MISSING')
      return createAnthropic({ apiKey })(modelId)
    }
    case 'google_gemini': {
      const apiKey = await getKey('google_gemini', debug)
      if (!apiKey && !process.env.GOOGLE_GENERATIVE_AI_API_KEY)
        throw new ApiError(400, 'Google Gemini API Key not found in DB or environment.', 'GOOGLE_KEY_MISSING')
      return createGoogleGenerativeAI({ apiKey })(modelId)
    }
    case 'groq': {
      const apiKey = await getKey('groq', debug)
      if (!apiKey && !process.env.GROQ_API_KEY)
        throw new ApiError(400, 'Groq API Key not found in DB or environment.', 'GROQ_KEY_MISSING')
      return createGroq({ apiKey })(modelId)
    }
    case 'openrouter': {
      const apiKey = await getKey('openrouter', debug)
      if (!apiKey && !process.env.OPENROUTER_API_KEY)
        throw new ApiError(400, 'OpenRouter API Key not found in DB or environment.', 'OPENROUTER_KEY_MISSING')
      return createOpenRouter({ apiKey })(modelId)
    }
    // --- OpenAI Compatible Providers ---
    case 'lmstudio': {
      const lmStudioUrl = DEFAULT_LMSTUDIO_BASE_URL
      if (!lmStudioUrl) throw new ApiError(500, 'LMStudio Base URL not configured.', 'LMSTUDIO_URL_MISSING')
      return createOpenAI({
        baseURL: lmStudioUrl,
        apiKey: 'lm-studio-ignored-key'
      })(modelId)
    }
    case 'xai': {
      const apiKey = await getKey('xai', debug)
      if (!apiKey) throw new ApiError(400, 'XAI API Key not found in DB.', 'XAI_KEY_MISSING')
      return createOpenAI({ baseURL: 'https://api.x.ai/v1', apiKey })(modelId)
    }
    case 'together': {
      const apiKey = await getKey('together', debug)
      if (!apiKey) throw new ApiError(400, 'Together API Key not found in DB.', 'TOGETHER_KEY_MISSING')
      return createOpenAI({ baseURL: 'https://api.together.xyz/v1', apiKey })(modelId)
    }
    // --- Local Providers ---
    case 'ollama': {
      const ollamaUrl = DEFAULT_OLLAMA_BASE_URL
      if (!ollamaUrl) throw new ApiError(500, 'Ollama Base URL not configured.', 'OLLAMA_URL_MISSING')
      return createOllama({ baseURL: ollamaUrl })(modelId)
    }
    default:
      console.error(`[UnifiedProviderService] Unsupported provider: ${provider}. Attempting fallback to OpenAI.`)
      // Fallback logic
      try {
        const fallbackApiKey = await getKey('openai', debug)
        const fallbackModel = LOW_MODEL_CONFIG.model ?? 'gpt-4o'
        return createOpenAI({ apiKey: fallbackApiKey })(fallbackModel)
      } catch (fallbackError: any) {
        throw new ApiError(
          500,
          `Unsupported provider: ${provider} and fallback to OpenAI also failed.`,
          'UNSUPPORTED_PROVIDER_AND_FALLBACK_FAILED',
          { originalProvider: provider, fallbackError: fallbackError.message }
        )
      }
  }
}

// Helper function for non-streaming text generation.
export async function generateSingleText({
  prompt,
  messages,
  options = {},
  systemMessage,
  debug = false
}: {
  prompt: string
  messages?: CoreMessage[]
  options?: AiSdkOptions
  systemMessage?: string
  debug?: boolean
}): Promise<string> {
  const finalOptions = { ...LOW_MODEL_CONFIG, ...options }
  const provider = finalOptions.provider as APIProviders
  if (!prompt && (!messages || messages.length === 0)) {
    throw new ApiError(
      400,
      "Either 'prompt' or 'messages' must be provided for generateSingleText.",
      'MISSING_PROMPT_OR_MESSAGES'
    )
  }

  try {
    const modelInstance = await getProviderLanguageModelInterface(provider, finalOptions)

    let messagesToProcess: CoreMessage[] = []
    if (systemMessage) {
      messagesToProcess.push({ role: 'system', content: systemMessage })
    }
    if (messages) {
      messagesToProcess.push(...messages)
    }
    if (prompt) {
      messagesToProcess.push({ role: 'user', content: prompt })
    }

    const { text, usage, finishReason } = await generateText({
      model: modelInstance,
      messages: messagesToProcess,
      temperature: finalOptions.temperature,
      maxTokens: finalOptions.maxTokens,
      topP: finalOptions.topP,
      frequencyPenalty: finalOptions.frequencyPenalty,
      presencePenalty: finalOptions.presencePenalty,
      topK: finalOptions.topK
    })

    if (debug) {
      console.log(
        `[UnifiedProviderService] generateText finished for ${provider}/${modelInstance.modelId}. Reason: ${finishReason}. Usage: ${JSON.stringify(usage)}`
      )
    }

    return text
  } catch (error: any) {
    if (error instanceof ApiError) throw error
    // Catch errors from getProviderLanguageModelInterface or generateText
    console.error(`[UnifiedProviderService - generateSingleText] Error for ${provider}:`, error)
    throw new ApiError(
      500,
      `Failed to generate single text for provider ${provider}: ${error.message}`,
      'GENERATE_SINGLE_TEXT_FAILED',
      { originalError: error.message }
    )
  }
}

// Helper function for generating structured JSON objects.
export async function generateStructuredData<T extends z.ZodType<any, z.ZodTypeDef, any>>({
  // Accept ZodTypeAny
  prompt,
  schema,
  options = {},
  systemMessage,
  debug = false
}: {
  prompt: string
  schema: T
  systemMessage?: string
  debug?: boolean
  options?: AiSdkOptions
}): Promise<{
  object: z.infer<T>
  usage: { completionTokens: number; promptTokens: number; totalTokens: number }
  finishReason: string /* ...other potential fields */
}> {
  // Return structure from generateObject
  const finalOptions = { ...LOW_MODEL_CONFIG, ...options }
  const provider = finalOptions.provider as APIProviders

  const model = finalOptions.model

  if (!prompt) {
    throw new ApiError(400, "'prompt' must be provided for generateStructuredData.", 'MISSING_PROMPT_FOR_STRUCTURED')
  }
  const modelInstance = await getProviderLanguageModelInterface(provider, { ...finalOptions, model: model })

  if (debug) {
    console.log(
      `[UnifiedProviderService] Generating structured data: Provider=${provider}, ModelID=${modelInstance.modelId}, Schema=${schema.description || 'Unnamed Schema'}`
    )
  }

  try {
    const result = await generateObject({
      model: modelInstance,
      schema: schema,
      prompt: prompt,
      system: systemMessage,
      temperature: finalOptions.temperature,
      maxTokens: finalOptions.maxTokens,
      topP: finalOptions.topP,
      frequencyPenalty: finalOptions.frequencyPenalty,
      presencePenalty: finalOptions.presencePenalty,
      topK: finalOptions.topK
    })

    if (debug) {
      console.log(
        `[UnifiedProviderService] generateObject finished. Reason: ${result.finishReason}. Usage: ${JSON.stringify(result.usage)}`
      )
    }

    return result
  } catch (error: any) {
    console.error('[UnifiedProviderService - generateStructuredData] failing with the following data:', {
      prompt,
      schema,
      systemMessage,
      finalOptions,
      provider
    })
    if (error instanceof ApiError) throw error
    console.error(`[UnifiedProviderService - generateStructuredData] Error for ${provider}:`, error)
    throw new ApiError(
      500,
      `Failed to generate structured data for provider ${provider}: ${error.message}`,
      'GENERATE_STRUCTURED_DATA_FAILED',
      { originalError: error.message }
    )
  }
}

export async function genTextStream({
  prompt,
  messages,
  options = {},
  systemMessage,
  debug = false
}: {
  prompt?: string
  messages?: CoreMessage[]
  options?: AiSdkOptions
  systemMessage?: string
  debug?: boolean
}): Promise<ReturnType<typeof streamText>> {
  const finalOptions = { ...LOW_MODEL_CONFIG, ...options }
  const provider = finalOptions.provider as APIProviders

  if (!prompt && (!messages || messages.length === 0)) {
    throw new ApiError(
      400,
      "Either 'prompt' or 'messages' must be provided for genTextStream.",
      'MISSING_PROMPT_OR_MESSAGES_STREAM'
    )
  }

  try {
    const modelInstance = await getProviderLanguageModelInterface(provider, finalOptions, debug)

    let messagesToProcess: CoreMessage[] = []
    if (systemMessage) {
      messagesToProcess.push({ role: 'system', content: systemMessage })
    }
    if (messages) {
      messagesToProcess.push(...messages)
    }
    if (prompt) {
      const lastMessage = messagesToProcess[messagesToProcess.length - 1]
      if (!lastMessage || !(lastMessage.role === 'user' && lastMessage.content === prompt)) {
        messagesToProcess.push({ role: 'user', content: prompt })
      }
    }

    if (messagesToProcess.length === 0) {
      throw new Error('No valid input content (prompt or messages) resulted in messages to process.')
    }

    if (debug) {
      console.log(
        `[UnifiedProviderService - genTextStream] Starting stream for ${provider}/${modelInstance.modelId}. Messages:`,
        messagesToProcess
      )
    }

    return streamText({
      model: modelInstance,
      messages: messagesToProcess,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      topP: options.topP,
      frequencyPenalty: options.frequencyPenalty,
      presencePenalty: options.presencePenalty,
      topK: options.topK,
      ...(options.response_format && {
        response_format: options.response_format
      }),

      onFinish: ({ text, usage, finishReason }) => {
        if (debug) {
          console.log(
            `[UnifiedProviderService - genTextStream] streamText finished for ${provider}/${modelInstance.modelId}. Reason: ${finishReason}. Usage: ${JSON.stringify(usage)}.`
          )
        }
      },
      onError: (error) => {
        console.error(
          `[UnifiedProviderService - genTextStream] Error during stream for ${provider}/${modelInstance.modelId}:`,
          error
        )
      }
    })
  } catch (error: any) {
    if (error instanceof ApiError) throw error
    console.error(`[UnifiedProviderService - genTextStream] Error setting up stream for ${provider}:`, error)
    throw new ApiError(500, `Error setting up stream for ${provider}: ${error.message}`, 'STREAM_SETUP_FAILED', {
      originalError: error.message
    })
  }
}
