import { useCallback } from 'react'
import { useGetMessages, useCreateChat, useForkChat } from '@/hooks/api/use-chat-api'
import type { CreateChatInput } from '@/hooks/api/use-chat-api'
import { ForkChatRequestBody } from '@/generated/types.gen'

export function useCreateChatHandler() {
  const createChatMutation = useCreateChat()

  const handleCreateChat = useCallback(
    async (chatTitle: string, currentChatId?: string) => {
      try {
        const input: CreateChatInput = {
          title: chatTitle,
          copyExisting: false,
          ...(currentChatId && { currentChatId: currentChatId })
        }
        return await createChatMutation.mutateAsync(input)
      } catch (error) {
        console.error('[handleCreateChat] Error:', error)
        return null
      }
    },
    [createChatMutation]
  )

  return { handleCreateChat }
}

export function useChatMessages(chatId: string) {
  const { data: messagesResponse, refetch: refetchMessages, isFetching, isError } = useGetMessages(chatId)

  return {
    messages: messagesResponse?.data || [],
    refetchMessages,
    isFetching,
    isError
  }
}

export function useForkChatHandler({ chatId }: { chatId: string }) {
  const forkChatMutation = useForkChat()

  const handleForkChat = useCallback(async () => {
    if (!chatId) return
    try {
      const inputBody: ForkChatRequestBody = {
        excludedMessageIds: []
      }
      await forkChatMutation.mutateAsync({
        chatId,
        body: inputBody
      })
    } catch (error) {
      console.error('[handleForkChat] Error:', error)
    }
  }, [chatId, forkChatMutation])

  return { handleForkChat }
}
