import { useCallback, useEffect, useRef, useState } from 'react'
import { useChat, Message } from '@ai-sdk/react'
import type { AiChatStreamRequest } from '@promptliano/schemas'
import type { AiSdkOptions } from '@promptliano/schemas'
import { useGetMessages } from '@/hooks/api/use-chat-api'
import { APIProviders } from '@promptliano/schemas'
import { nanoid } from 'nanoid'
import { SERVER_HTTP_ENDPOINT } from '@/constants/server-constants'
import { toast } from 'sonner'
import { parseAIError, extractProviderName } from '@/components/errors'
import { useAppSettings } from '@/hooks/use-kv-local-storage'

interface UseAIChatProps {
  chatId: number
  provider: APIProviders | string
  model: string
  systemMessage?: string
  enableChatAutoNaming?: boolean
}

export function useAIChat({ chatId, provider, model, systemMessage, enableChatAutoNaming = false }: UseAIChatProps) {
  // Track if initial messages have been loaded to prevent infinite loops
  const initialMessagesLoadedRef = useRef(false)

  // Track parsed error for UI display
  const [parsedError, setParsedError] = useState<ReturnType<typeof parseAIError> | null>(null)

  // Get app settings for provider URLs
  const [appSettings] = useAppSettings()

  // Initialize Vercel AI SDK's useChat hook
  const {
    messages,
    input,
    handleInputChange,
    // Note: We won't use the default handleSubmit directly if we have custom logic
    // handleSubmit: defaultHandleSubmit,
    isLoading,
    error,
    setMessages,
    append,
    reload,
    stop,
    setInput
  } = useChat({
    api: `${SERVER_HTTP_ENDPOINT}/api/ai/chat`,
    id: chatId.toString(), // Primarily for SDK internal state management
    initialMessages: [], // Load messages via useEffect
    onError: (err) => {
      console.error('[useAIChat] API Error:', err)

      // Parse the error
      const providerName = extractProviderName(err) || provider
      const parsed = parseAIError(err, providerName)
      setParsedError(parsed)

      // Show toast notification with appropriate styling
      if (parsed.type === 'MISSING_API_KEY') {
        toast.error('API Key Missing', {
          description: parsed.message,
          action: {
            label: 'Settings',
            onClick: () => (window.location.href = '/settings')
          }
        })
      } else if (parsed.type === 'RATE_LIMIT') {
        toast.warning('Rate Limit Exceeded', {
          description: parsed.message
        })
      } else if (parsed.type === 'CONTEXT_LENGTH_EXCEEDED') {
        toast.error('Message Too Long', {
          description: parsed.message
        })
      } else {
        toast.error(`${parsed.provider || 'AI'} Error`, {
          description: parsed.message
        })
      }
    }
  })

  // Fetch existing messages from the server (seems correct)
  const {
    data: initialMessagesData,
    refetch: refetchMessages,
    isFetching: isFetchingInitialMessages,
    isError: isErrorFetchingInitial
  } = useGetMessages(chatId)

  // Effect to load initial messages into useChat state with proper loop prevention
  useEffect(() => {
    // Only load initial messages once per chat
    if (
      initialMessagesData?.data &&
      !initialMessagesLoadedRef.current &&
      !isFetchingInitialMessages &&
      !isLoading // Don't set messages while streaming
    ) {
      const formattedMessages: Message[] = initialMessagesData.data.map((msg) => ({
        id: msg.id.toString(),
        // Ensure role mapping handles potential future roles if schema changes
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
        created: msg.created ? new Date(msg.created) : new Date() // Handle potential date parsing issues
      }))
      setMessages(formattedMessages)
      initialMessagesLoadedRef.current = true
    }
  }, [initialMessagesData, setMessages, isFetchingInitialMessages, isLoading])

  // Reset the loaded flag when chatId changes
  useEffect(() => {
    initialMessagesLoadedRef.current = false
  }, [chatId])

  // Enhanced `sendMessage` function using `append`
  const sendMessage = useCallback(
    async (messageContent: string, modelSettings?: AiSdkOptions) => {
      if (!messageContent.trim()) return

      // Clear any previous errors when sending a new message
      setParsedError(null)

      // unix timestamp in milliseconds
      const userMessageId = Date.now()

      // 1. Prepare the message object for the useChat hook's state
      const messageForSdkState: Message = {
        id: userMessageId.toString(),
        role: 'user',
        content: messageContent.trim(),
        createdAt: new Date()
      }

      // 2. Map frontend ChatModelSettings (snake_case) to backend AiSdkOptions (camelCase)
      let sdkOptions: AiSdkOptions | undefined = undefined
      if (modelSettings) {
        sdkOptions = {
          // Only include fields if they have a value
          ...(modelSettings.temperature !== undefined && { temperature: modelSettings.temperature }),
          ...(modelSettings.maxTokens !== undefined && { maxTokens: modelSettings.maxTokens }),
          ...(modelSettings.topP !== undefined && { topP: modelSettings.topP }),
          ...(modelSettings.frequencyPenalty !== undefined && { frequencyPenalty: modelSettings.frequencyPenalty }),
          ...(modelSettings.presencePenalty !== undefined && { presencePenalty: modelSettings.presencePenalty }),
          ...(modelSettings.provider !== undefined && { provider: modelSettings.provider }),
          ...(modelSettings.model !== undefined && { model: modelSettings.model })
          // Add mappings for top_k etc. if needed
        }
      }

      // Add provider URLs based on the current provider
      if (provider === 'ollama' && appSettings.ollamaGlobalUrl) {
        sdkOptions = { ...sdkOptions, ollamaUrl: appSettings.ollamaGlobalUrl }
      } else if (provider === 'lmstudio' && appSettings.lmStudioGlobalUrl) {
        sdkOptions = { ...sdkOptions, lmstudioUrl: appSettings.lmStudioGlobalUrl }
      }

      // 3. Construct the request body EXACTLY matching AiChatStreamRequestSchema
      //    Use the imported type for compile-time checks!
      const requestBody: AiChatStreamRequest = {
        chatId: chatId, // REQUIRED: Get from hook props
        userMessage: messageContent.trim(), // REQUIRED: The actual user message
        // Optional fields:
        tempId: userMessageId, // Optional: Useful for correlating requests/responses
        ...(systemMessage && { systemMessage: systemMessage }), // Include systemMessage from props if provided
        // options: sdkOptions,
        ...(sdkOptions ? { options: sdkOptions } : {}),
        enableChatAutoNaming: enableChatAutoNaming
      }

      setInput('') // Clear input field immediately

      // 4. Call append:
      //    - First argument: The message object to add optimistically to the UI state.
      //    - Second argument: Options object containing the `body` to send to the API.
      await append(messageForSdkState, { body: requestBody })
    },
    // Dependencies: Ensure all values used inside useCallback are listed
    [
      append,
      chatId,
      provider,
      model,
      systemMessage,
      setInput,
      setParsedError,
      enableChatAutoNaming,
      appSettings.ollamaGlobalUrl,
      appSettings.lmStudioGlobalUrl
    ]
  )

  // Create a form handler that uses our enhanced `sendMessage`
  const handleFormSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      // TODO: Get currentModelSettings from your UI state if applicable
      const currentModelSettings: AiSdkOptions | undefined = undefined // Replace with actual settings if you have them
      sendMessage(input, currentModelSettings)
    },
    [sendMessage, input]
  )

  // Clear error function
  const clearError = useCallback(() => {
    setParsedError(null)
  }, [])

  // Return values needed by the UI
  return {
    messages,
    input,
    handleInputChange,
    handleSubmit: handleFormSubmit, // Use the custom submit handler
    isLoading,
    error,
    parsedError, // Expose parsed error for UI display
    clearError, // Function to clear the error
    setInput,
    reload, // Useful for retrying the last exchange
    stop, // Useful for stopping the stream
    // append, // Usually not needed directly by the UI if using sendMessage
    // setMessages, // Usually only needed for initial load or manual manipulation
    sendMessage, // Expose the custom sending function
    isFetchingInitialMessages,
    isErrorFetchingInitial,
    refetchMessages // Allow UI to trigger a refetch of history
  }
}
