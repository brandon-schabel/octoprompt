import { z } from 'zod'
import { type CoreMessage, type LanguageModel, streamText, generateText, generateObject } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createGroq } from '@ai-sdk/groq'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { createOllama } from 'ollama-ai-provider'
import { createChatService, createProviderKeyService } from '@promptliano/services'
import type { APIProviders, ProviderKey } from '@promptliano/schemas'
import type { AiChatStreamRequest } from '@promptliano/schemas'
import type { AiSdkOptions } from '@promptliano/schemas'
import { LOW_MODEL_CONFIG, getProvidersConfig } from '@promptliano/config'
import { structuredDataSchemas } from '@promptliano/schemas'

import { ApiError } from '@promptliano/shared'
import { mapProviderErrorToApiError } from './error-mappers'
import { retryOperation } from './utils/bulk-operations'

const providersConfig = getProvidersConfig()

let providerKeysCache: ProviderKey[] | null = null

export async function handleChatMessage({
  chatId,
  userMessage,
  options = {},
  systemMessage,
  tempId,
  debug = false,
  enableChatAutoNaming = false
}: AiChatStreamRequest & { enableChatAutoNaming?: boolean }): Promise<ReturnType<typeof streamText>> {
  let finalAssistantMessageId: number | undefined
  const finalOptions = { ...LOW_MODEL_CONFIG, ...options }
  const provider = finalOptions.provider as APIProviders
  const chatService = createChatService()
  const modelInstance = await getProviderLanguageModelInterface(finalOptions.provider as APIProviders, finalOptions)
  let messagesToProcess: CoreMessage[] = []

  if (systemMessage) {
    messagesToProcess.push({ role: 'system', content: systemMessage })
  }

  const dbMessages = (await chatService.getChatMessages(chatId)).map((msg) => ({
    role: msg.role as 'user' | 'assistant' | 'system',
    content: msg.content
  }))

  // Check if this is the first user message for auto-naming
  const isFirstUserMessage = dbMessages.filter((msg) => msg.role === 'user').length === 0

  messagesToProcess.push(...dbMessages)

  const savedUserMessage = await chatService.saveMessage({
    chatId,
    role: 'user',
    content: userMessage,
    tempId: tempId ? `${tempId}-user` : undefined
  } as any)

  messagesToProcess.push({ role: 'user', content: userMessage })

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

      // Auto-name the chat if this is the first user message and auto-naming is enabled
      if (isFirstUserMessage && enableChatAutoNaming) {
        try {
          // Get current chat to check if it has a default name
          const allChats = await chatService.getAllChats()
          const currentChat = allChats.find((chat) => chat.id === chatId)

          if (currentChat && (currentChat.title.startsWith('New Chat') || currentChat.title.startsWith('Chat '))) {
            // Generate a name based on the user's message
            const generatedName = await generateChatName(userMessage)
            await chatService.updateChat(chatId, generatedName)

            if (debug) {
              console.log(`[UnifiedProviderService] Auto-named chat ${chatId}: "${generatedName}"`)
            }
          }
        } catch (namingError) {
          console.error(`[UnifiedProviderService] Failed to auto-name chat ${chatId}:`, namingError)
          // Don't throw - auto-naming failure shouldn't break the chat
        }
      }
    },
    onError: (error) => {
      console.error(`[UnifiedProviderService] Error during stream for ${provider}/${modelInstance.modelId}:`, error)

      // Map the error to get better details
      const mappedError = mapProviderErrorToApiError(error, provider, 'streamChat')

      // Update the placeholder message with a user-friendly error message
      if (finalAssistantMessageId) {
        const errorMessage =
          mappedError.code === 'CONTEXT_LENGTH_EXCEEDED'
            ? 'Error: Message too long. Please reduce the length and try again.'
            : mappedError.code === 'RATE_LIMIT_EXCEEDED'
              ? 'Error: Rate limit exceeded. Please wait a moment and try again.'
              : mappedError.code === 'PROVIDER_UNAVAILABLE'
                ? 'Error: Service temporarily unavailable. Please try again.'
                : `Error: ${mappedError.message}`

        chatService.updateMessageContent(chatId, finalAssistantMessageId, errorMessage).catch((dbError) => {
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
      const lmStudioUrl = providersConfig.lmstudio.baseURL
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
      const ollamaUrl = providersConfig.ollama.baseURL
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

    // Wrap the AI call in retry logic
    const result = await retryOperation(
      async () => {
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
      },
      {
        maxAttempts: 3,
        shouldRetry: (error: any) => {
          // Map the error to check if it's retryable
          const mappedError = mapProviderErrorToApiError(error, provider, 'generateSingleText')
          return (
            mappedError.code === 'RATE_LIMIT_EXCEEDED' ||
            mappedError.code === 'PROVIDER_UNAVAILABLE' ||
            mappedError.status >= 500
          )
        }
      }
    )

    return result
  } catch (error: any) {
    if (error instanceof ApiError) throw error
    // Catch errors from getProviderLanguageModelInterface or generateText
    console.error(`[UnifiedProviderService - generateSingleText] Error for ${provider}:`, error)
    throw mapProviderErrorToApiError(error, provider, 'generateSingleText')
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
    // Wrap the AI call in retry logic
    const result = await retryOperation(
      async () => {
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
      },
      {
        maxAttempts: 3,
        shouldRetry: (error: any) => {
          // Map the error to check if it's retryable
          const mappedError = mapProviderErrorToApiError(error, provider, 'generateStructuredData')
          return (
            mappedError.code === 'RATE_LIMIT_EXCEEDED' ||
            mappedError.code === 'PROVIDER_UNAVAILABLE' ||
            mappedError.status >= 500
          )
        }
      }
    )

    return result
  } catch (error: any) {
    if (error instanceof ApiError) throw error
    console.error(`[UnifiedProviderService - generateStructuredData] Error for ${provider}:`, error)
    throw mapProviderErrorToApiError(error, provider, 'generateStructuredData')
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
    throw mapProviderErrorToApiError(error, provider, 'genTextStream')
  }
}

export async function generateChatName(chatContent: string): Promise<string> {
  try {
    const chatNamingConfig = structuredDataSchemas.chatNaming
    const result = await generateStructuredData({
      prompt: chatContent,
      schema: chatNamingConfig.schema,
      systemMessage: chatNamingConfig.systemPrompt,
      options: chatNamingConfig.modelSettings
    })

    return result.object.chatName
  } catch (error) {
    console.error('[generateChatName] Error generating chat name:', error)
    // Return a default name if generation fails
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    return `Chat ${timestamp}`
  }
}

export async function generateTabName(
  projectName: string,
  selectedFiles: string[] = [],
  context?: string
): Promise<string> {
  try {
    const tabNamingConfig = structuredDataSchemas.tabNaming

    // Prepare the prompt with the provided information
    const selectedFilesStr =
      selectedFiles.length > 0
        ? selectedFiles.slice(0, 5).join(', ') + (selectedFiles.length > 5 ? '...' : '')
        : 'No specific files selected'

    const promptData = `Project Name: ${projectName}, Selected Files: ${selectedFilesStr}, Context: ${context || 'General project work'}`

    const result = await generateStructuredData({
      prompt: promptData,
      schema: tabNamingConfig.schema,
      systemMessage: tabNamingConfig.systemPrompt,
      options: tabNamingConfig.modelSettings
    })

    return result.object.tabName
  } catch (error) {
    console.error('[generateTabName] Error generating tab name:', error)
    // Return a default name if generation fails
    return `${projectName} Tab`
  }
}
