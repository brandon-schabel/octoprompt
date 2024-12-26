import { useEffect, useState } from 'react'
import {
    useCreateChat, useGetMessages, useSendMessage, useForkChat
} from '@/hooks/api/use-chat-ai-api'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { useChatModelControl } from './use-chat-model-control'
import { Chat, ChatMessage } from 'shared/schema'


type TempChatMessage = ChatMessage & { tempId?: string }

export function useChatControl() {
    const [currentChat, setCurrentChat] = useLocalStorage<Chat | null>('current-chat', null)
    const [newMessage, setNewMessage] = useState('')
    const [pendingMessages, setPendingMessages] = useState<ChatMessage[]>([])
    const [excludedMessagesMap, setExcludedMessagesMap] = useLocalStorage<Record<string, string[]>>(
        'excluded-messages',
        {}
    )

    // API hooks
    const createChatMutation = useCreateChat()
    const sendMessageMutation = useSendMessage()
    const forkChatMutation = useForkChat()

    // Model control logic (OpenAI vs LLMStudio vs Ollama, etc.)
    const modelControl = useChatModelControl()

    // If we do have a currentChat, fetch its messages
    const { data: messagesData, refetch: refetchMessages } = useGetMessages(currentChat?.id ?? '')

    // Derived states
    const excludedMessageIds = new Set(
        currentChat ? excludedMessagesMap[currentChat.id] || [] : []
    )
    const messages = mergeServerAndPendingMessages(messagesData?.data || [], pendingMessages)

    // Example utility function for merging server messages w/ pending ones
    function mergeServerAndPendingMessages(
        serverMsgs: TempChatMessage[],
        pending: TempChatMessage[]
    ) {
        // 1) Filter out any messages from the server that have temp- IDs
        const filteredServerMsgs = serverMsgs.filter(
            (msg) => !msg.id.startsWith('temp-')
        );

        // 2) Remove pending messages that have matching tempIds in server messages
        const pendingWithoutDuplicates = pending.filter(pend => {
            return !filteredServerMsgs.some(serverMsg =>
                serverMsg.tempId && serverMsg.tempId === pend.tempId
            );
        });

        // 3) Combine them
        return [...filteredServerMsgs, ...pendingWithoutDuplicates];
    }

    // Create new chat with a default or user-specified title
    async function handleCreateChat(chatTitle: string) {
        try {
            const newChat = await createChatMutation.mutateAsync({ title: chatTitle })
            setCurrentChat(newChat)
            return newChat
        } catch (error) {
            console.error('Error creating chat:', error)
            return null
        }
    }

    // Send message logic
    async function handleSendMessage() {
        if (!newMessage.trim()) return

        // If there is no current chat, create one automatically
        let chat = currentChat
        if (!chat) {
            chat = await handleCreateChat(`New Chat ${Date.now()}`)
            if (!chat) return
        }

        const message = newMessage
        setNewMessage('')

        const userTempId = `temp-user-${Date.now()}`
        const assistantTempId = `temp-assistant-${Date.now()}`

        const userMessage: TempChatMessage = {
            id: userTempId,
            chatId: chat.id,
            role: 'user',
            content: message,
            createdAt: new Date(),
            tempId: userTempId
        }

        const assistantMessage: TempChatMessage = {
            id: assistantTempId,
            chatId: chat.id,
            role: 'assistant',
            content: '',
            createdAt: new Date(),
            tempId: assistantTempId
        }

        setPendingMessages([userMessage, assistantMessage])

        const selectedModel = modelControl.currentModel ?? 'gpt-4' // fallback model

        try {
            const stream = await sendMessageMutation.mutateAsync({
                message,
                chatId: chat.id,
                provider: modelControl.provider,
                tempId: assistantTempId,
                options: {

                    model: selectedModel,
                },
                excludedMessageIds: Array.from(excludedMessageIds)
            })

            const reader = stream.getReader()
            let assistantContent = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                const text = new TextDecoder().decode(value)

                if (text) {
                    assistantContent += text
                    setPendingMessages(prev =>
                        prev.map(m => m.id === assistantTempId
                            ? { ...m, content: assistantContent }
                            : m
                        )
                    )
                }
            }

            await refetchMessages()
            setPendingMessages([])
        } catch (error) {
            console.error('Streaming error:', error)
            setPendingMessages(prev =>
                prev.map(m => m.id === assistantTempId
                    ? { ...m, content: `Error: ${error instanceof Error ? error.message : 'Failed to get response from AI service.'}` }
                    : m
                )
            )
        }
    }


    // Fork chat logic
    async function handleForkChat() {
        if (!currentChat) return
        try {
            const newChat = await forkChatMutation.mutateAsync({
                chatId: currentChat.id,
                excludedMessageIds: Array.from(excludedMessageIds),
            })
            setCurrentChat(newChat)
            setPendingMessages([])
            setExcludedMessagesMap(prev => ({
                ...prev,
                [newChat.id]: []
            }))
        } catch (error) {
            console.error('Error forking chat:', error)
        }
    }

    // Clear excluded messages
    function clearExcludedMessages() {
        if (!currentChat) return
        setExcludedMessagesMap(prev => ({ ...prev, [currentChat.id]: [] }))
    }

    return {
        currentChat,
        setCurrentChat,
        newMessage,
        setNewMessage,
        messages,
        pendingMessages,
        setPendingMessages,
        excludedMessageIds,
        createChatMutation,
        sendMessageMutation,
        forkChatMutation,
        handleCreateChat,
        handleSendMessage,
        handleForkChat,
        clearExcludedMessages,
        modelControl,
        refetchMessages,
        excludedMessagesMap,
        setExcludedMessagesMap,
    }
}