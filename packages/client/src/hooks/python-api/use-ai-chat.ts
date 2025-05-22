import { useCallback, useEffect } from 'react'
import { useChat, Message } from '@ai-sdk/react'
// Ensure AiChatStreamRequest and AiSdkOptions are correctly defined or imported from generated-python/types.gen
// Assuming AiChatStreamRequest matches PostAiChatSdkEndpointApiChatsApiAiChatPostData['body']
// and AiSdkOptions matches the options within that body.
import type { PostAiChatSdkEndpointApiChatsApiAiChatPostData } from '../../generated-python/types.gen'
import { useGetMessages } from './use-chat-api' // This will be updated in use-chat-api.ts
import { APIProviders } from 'shared/src/schemas/provider-key.schemas'
import { nanoid } from 'nanoid'
import { SERVER_HTTP_ENDPOINT } from '@/constants/server-constants'

// Assuming AiSdkOptions is part of PostAiChatSdkEndpointApiChatsApiAiChatPostData['body']['options']
type AiSdkOptions = NonNullable<PostAiChatSdkEndpointApiChatsApiAiChatPostData['body']['options']>
// Assuming AiChatStreamRequest is equivalent to PostAiChatSdkEndpointApiChatsApiAiChatPostData['body']
type AiChatStreamRequest = PostAiChatSdkEndpointApiChatsApiAiChatPostData['body']

interface UseAIChatProps {
    chatId: string
    provider: APIProviders | string // This provider might be part of AiSdkOptions
    model: string // This model might be part of AiSdkOptions
    systemMessage?: string
}

export function useAIChat({ chatId, provider, model, systemMessage }: UseAIChatProps) {
    const {
        messages,
        input,
        handleInputChange,
        isLoading,
        error,
        setMessages,
        append,
        reload,
        stop,
        setInput
    } = useChat({
        api: `${SERVER_HTTP_ENDPOINT}/ai/chat`, // Remains a URL for @ai-sdk/react
        id: chatId,
        initialMessages: [],
        onError: (err) => {
            console.error('[useAIChat] API Error:', err)
        }
    })

    const {
        data: initialMessagesData,
        refetch: refetchMessages,
        isFetching: isFetchingInitialMessages,
        isError: isErrorFetchingInitial
    } = useGetMessages(chatId)

    useEffect(() => {
        if (initialMessagesData?.data && messages.length === 0 && !isFetchingInitialMessages) {
            const formattedMessages: Message[] = initialMessagesData.data.map((msg) => ({
                id: msg.id,
                role: msg.role as 'user' | 'assistant' | 'system',
                content: msg.content,
                createdAt: msg.createdAt ? new Date(msg.createdAt) : new Date()
            }))
            setMessages(formattedMessages)
        }
    }, [initialMessagesData, setMessages, messages.length, isFetchingInitialMessages])

    const sendMessage = useCallback(
        async (messageContent: string, modelSettings?: AiSdkOptions) => {
            if (!messageContent.trim()) return
            const userMessageId = nanoid()

            const messageForSdkState: Message = {
                id: userMessageId,
                role: 'user',
                content: messageContent.trim(),
                createdAt: new Date()
            }

            // The modelSettings parameter might directly be AiSdkOptions or need mapping.
            // The hook's props `provider` and `model` might be defaults if not in modelSettings.
            let sdkApiOptions: AiSdkOptions = {
                provider, // from hook props
                model,    // from hook props
                ...modelSettings // override with specific settings if provided
            };

            const requestBody: AiChatStreamRequest = {
                chatId: chatId,
                userMessage: messageContent.trim(),
                tempId: userMessageId,
                ...(systemMessage && { systemMessage: systemMessage }),
                options: sdkApiOptions,
            }

            setInput('')
            await append(messageForSdkState, { body: requestBody })
        },
        [append, chatId, provider, model, systemMessage, setInput]
    )

    const handleFormSubmit = useCallback(
        (e: React.FormEvent<HTMLFormElement>) => {
            e.preventDefault()
            // Pass provider and model from hook props as part of default modelSettings.
            // If UI has more specific model settings, they would be passed to sendMessage.
            const currentModelSettings: AiSdkOptions = { provider, model };
            sendMessage(input, currentModelSettings)
        },
        [sendMessage, input, provider, model]
    )

    return {
        messages,
        input,
        handleInputChange,
        handleSubmit: handleFormSubmit,
        isLoading,
        error,
        setInput,
        reload,
        stop,
        sendMessage,
        isFetchingInitialMessages,
        isErrorFetchingInitial,
        refetchMessages
    }
}