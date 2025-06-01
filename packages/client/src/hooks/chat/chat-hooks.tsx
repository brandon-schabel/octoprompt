import { useCallback } from 'react'
import { useGetMessages, useCreateChat, useForkChat } from '@/hooks/api/use-chat-api'
import { ForkChatRequestBody } from '@octoprompt/schemas'

export function useCreateChatHandler() {
  const createChatMutation = useCreateChat()

  const handleCreateChat = useCallback(
    async (chatTitle: string, currentChatId?: number) => {
      try {
        return await createChatMutation.mutateAsync({
          title: chatTitle,
          copyExisting: false,
          ...(currentChatId && { currentChatId: currentChatId })
        })
      } catch (error) {
        console.error('[handleCreateChat] Error:', error)
        return null
      }
    },
    [createChatMutation]
  )

  return { handleCreateChat }
}

export function useChatMessages(chatId: number) {
  const { data: messagesResponse, refetch: refetchMessages, isFetching, isError } = useGetMessages(chatId)

  return {
    messages: messagesResponse?.data || [],
    refetchMessages,
    isFetching,
    isError
  }
}

export function useForkChatHandler({ chatId }: { chatId: number }) {
  const forkChatMutation = useForkChat()

  const handleForkChat = useCallback(async () => {
    if (!chatId) return
    try {
      const inputBody: ForkChatRequestBody = {
        excludedMessageIds: []
      }
      await forkChatMutation.mutateAsync({
        chatId,
        excludeMessageIds: inputBody.excludedMessageIds
      })
    } catch (error) {
      console.error('[handleForkChat] Error:', error)
    }
  }, [chatId, forkChatMutation])

  return { handleForkChat }
}
