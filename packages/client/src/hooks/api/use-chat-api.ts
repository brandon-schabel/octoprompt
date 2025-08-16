import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CreateChatBody, UpdateChatBody, Chat, ChatMessage, AiChatStreamRequest } from '@promptliano/schemas'
import { useApiClient } from './use-api-client'
import { toast } from 'sonner'

// Query Keys
const CHAT_KEYS = {
  all: ['chats'] as const,
  list: () => [...CHAT_KEYS.all, 'list'] as const,
  detail: (chatId: number) => [...CHAT_KEYS.all, 'detail', chatId] as const,
  messages: (chatId: number) => [...CHAT_KEYS.all, 'messages', chatId] as const
}

// --- Query Hooks ---
export function useGetChats() {
  const client = useApiClient()

  return useQuery({
    queryKey: CHAT_KEYS.list(),
    enabled: !!client,
    queryFn: () => (client ? client.chats.listChats() : Promise.reject(new Error('Client not connected'))),
    staleTime: 5 * 60 * 1000 // 5 minutes
  })
}

export function useGetChat(chatId: number) {
  const client = useApiClient()

  return useQuery({
    queryKey: CHAT_KEYS.detail(chatId),
    queryFn: () => (client ? client.chats.getChat(chatId) : Promise.reject(new Error('Client not connected'))),
    enabled: !!client && !!chatId,
    staleTime: 5 * 60 * 1000
  })
}

export function useGetMessages(chatId: number) {
  const client = useApiClient()

  return useQuery({
    queryKey: CHAT_KEYS.messages(chatId),
    queryFn: () => (client ? client.chats.getMessages(chatId) : Promise.reject(new Error('Client not connected'))),
    enabled: !!client && !!chatId,
    staleTime: 30 * 1000 // 30 seconds for messages
  })
}

// --- Mutation Hooks ---
export function useCreateChat() {
  const client = useApiClient()
  const { invalidateAllChats } = useInvalidateChats()

  return useMutation({
    mutationFn: (data: CreateChatBody) => {
      if (!client) throw new Error('API client not initialized')
      return client.chats.createChat(data)
    },
    onSuccess: () => {
      invalidateAllChats()
      toast.success('Chat created successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create chat')
    }
  })
}

export function useUpdateChat() {
  const client = useApiClient()
  const { invalidateAllChats, setChatDetail } = useInvalidateChats()

  return useMutation({
    mutationFn: ({ chatId, data }: { chatId: number; data: UpdateChatBody }) => {
      if (!client) throw new Error('API client not initialized')
      return client.chats.updateChat(chatId, data)
    },
    onSuccess: ({ data: updatedChat }) => {
      invalidateAllChats()
      setChatDetail(updatedChat)
      toast.success('Chat updated successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update chat')
    }
  })
}

export function useDeleteChat() {
  const client = useApiClient()
  const { invalidateAllChats, removeChat } = useInvalidateChats()

  return useMutation({
    mutationFn: (chatId: number) => {
      if (!client) throw new Error('API client not initialized')
      return client.chats.deleteChat(chatId)
    },
    onSuccess: (_, chatId) => {
      invalidateAllChats()
      removeChat(chatId)
      toast.success('Chat deleted successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete chat')
    }
  })
}

export function useForkChat() {
  const client = useApiClient()
  const { invalidateAllChats } = useInvalidateChats()

  return useMutation({
    mutationFn: ({ chatId, excludeMessageIds }: { chatId: number; excludeMessageIds?: number[] }) => {
      if (!client) throw new Error('API client not initialized')
      return client.chats.forkChat(chatId, { excludedMessageIds: excludeMessageIds || [] })
    },
    onSuccess: () => {
      invalidateAllChats()
      toast.success('Chat forked successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to fork chat')
    }
  })
}

export function useForkChatFromMessage() {
  const client = useApiClient()
  const { invalidateAllChats } = useInvalidateChats()

  return useMutation({
    mutationFn: ({
      chatId,
      messageId,
      excludedMessageIds
    }: {
      chatId: number
      messageId: number
      excludedMessageIds?: number[]
    }) => {
      if (!client) throw new Error('API client not initialized')
      return client.chats.forkChatFromMessage(chatId, messageId, {
        excludedMessageIds: excludedMessageIds || []
      })
    },
    onSuccess: () => {
      invalidateAllChats()
      toast.success('Chat forked from message successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to fork chat from message')
    }
  })
}

export function useDeleteMessage() {
  const client = useApiClient()
  const { invalidateChatMessages } = useInvalidateChats()

  return useMutation({
    mutationFn: ({ chatId, messageId }: { chatId: number; messageId: number }) => {
      if (!client) throw new Error('API client not initialized')
      return client.chats.deleteMessage(chatId, messageId)
    },
    onSuccess: (_, { chatId }) => {
      invalidateChatMessages(chatId)
      toast.success('Message deleted successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete message')
    }
  })
}

export function useStreamChat() {
  const client = useApiClient()

  return useMutation({
    mutationFn: (data: AiChatStreamRequest) => {
      if (!client) throw new Error('API client not initialized')
      return client.chats.streamChat(data)
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to start chat stream')
    }
  })
}

// --- Enhanced AI Chat Hook ---
export function useAIChatV2({
  chatId,
  provider,
  model,
  systemMessage
}: {
  chatId: number
  provider: string
  model: string
  systemMessage?: string
}) {
  const { data: messages, refetch: refetchMessages } = useGetMessages(chatId)
  const streamChat = useStreamChat()

  const sendMessage = async (userMessage: string, options?: any) => {
    try {
      const stream = await streamChat.mutateAsync({
        chatId,
        userMessage,
        systemMessage,
        options: {
          provider,
          model,
          ...options
        }
      })

      // Return the stream for the UI to handle
      return stream
    } catch (error) {
      throw error
    }
  }

  return {
    messages: messages || [],
    sendMessage,
    isLoading: streamChat.isPending,
    error: streamChat.error,
    refetchMessages
  }
}

// --- Invalidation Utilities ---
export function useInvalidateChats() {
  const queryClient = useQueryClient()

  return {
    // Invalidate all chat-related queries
    invalidateAllChats: () => {
      queryClient.invalidateQueries({ queryKey: CHAT_KEYS.all })
    },

    // Invalidate chat list
    invalidateChatList: () => {
      queryClient.invalidateQueries({ queryKey: CHAT_KEYS.list() })
    },

    // Invalidate specific chat detail
    invalidateChat: (chatId: number) => {
      queryClient.invalidateQueries({ queryKey: CHAT_KEYS.detail(chatId) })
    },

    // Invalidate messages for a chat
    invalidateChatMessages: (chatId: number) => {
      queryClient.invalidateQueries({ queryKey: CHAT_KEYS.messages(chatId) })
    },

    // Remove chat from cache completely
    removeChat: (chatId: number) => {
      queryClient.removeQueries({ queryKey: CHAT_KEYS.detail(chatId) })
      queryClient.removeQueries({ queryKey: CHAT_KEYS.messages(chatId) })
    },

    // Set specific chat detail in the cache
    setChatDetail: (chat: Chat) => {
      queryClient.setQueryData(CHAT_KEYS.detail(chat.id), chat)
    },

    // Set messages for a chat
    setChatMessages: (chatId: number, messages: ChatMessage[]) => {
      queryClient.setQueryData(CHAT_KEYS.messages(chatId), messages)
    }
  }
}

// Export query keys for external use
export { CHAT_KEYS }