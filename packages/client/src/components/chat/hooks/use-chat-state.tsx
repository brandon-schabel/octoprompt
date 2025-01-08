import { useEffect, useState } from 'react';
import {
    useCreateChat,
    useGetMessages,
    useSendMessage,
    useForkChat,
} from '@/hooks/api/use-chat-ai-api';
import { useGlobalStateContext } from '@/components/global-state-context';
import { useChatModelControl } from './use-chat-model-control';
import { ChatMessage } from 'shared/schema';
import { APIProviders } from 'shared/index';

type TempChatMessage = ChatMessage & { tempId?: string };

export function useChatControl() {
    const {
        activeChatTabState,
        updateActiveChatTab,
        wsReady,
        state
    } = useGlobalStateContext();

    // If you'd like to keep a local "pending" queue that hasn't yet been
    // committed to the global state, you can do so here:
    const [pendingMessages, setPendingMessages] = useState<TempChatMessage[]>([]);

    // API hooks
    const createChatMutation = useCreateChat();
    const sendMessageMutation = useSendMessage();
    const forkChatMutation = useForkChat();

    // Model control logic
    const modelControl = useChatModelControl();

    // If there's an actual DB-based chat ID in the active tab, you can fetch messages from the server:
    const chatId = activeChatTabState?.activeChatId ?? '';
    const { data: messagesData, refetch: refetchMessages } = useGetMessages(chatId);

    // Merged final messages = from DB + pending
    const messages = mergeServerAndPendingMessages(
        messagesData?.data || [],
        pendingMessages
    );

    // Helper to combine server messages with pending local messages
    function mergeServerAndPendingMessages(
        serverMsgs: TempChatMessage[],
        pending: TempChatMessage[]
    ) {
        const filteredServerMsgs = serverMsgs.filter(msg => !msg.id.startsWith('temp-'));
        const pendingWithoutDuplicates = pending.filter(pend =>
            !filteredServerMsgs.some(serverMsg => serverMsg.tempId === pend.tempId)
        );
        return [...filteredServerMsgs, ...pendingWithoutDuplicates];
    }

    /** ========== CREATE CHAT ========== */
    async function handleCreateChat(chatTitle: string) {
        try {
            const newChat = await createChatMutation.mutateAsync({ title: chatTitle });
            // You might store the new chat ID somewhere in the global state here
            return newChat;
        } catch (error) {
            console.error('[handleCreateChat] Error:', error);
            return null;
        }
    }

    /** ========== SEND MESSAGE ========== */
    async function handleSendMessage() {
        if (!activeChatTabState) return;
        const userInput = activeChatTabState.input.trim();
        if (!userInput) return;

        // Clear the input field in global state
        updateActiveChatTab({ input: '' });

        // Generate IDs
        const userTempId = `temp-user-${Date.now()}`;
        const assistantTempId = `temp-assistant-${Date.now()}`;

        const userMessage: TempChatMessage = {
            id: userTempId,
            chatId,
            role: 'user',
            content: userInput,
            createdAt: new Date(),
            tempId: userTempId,
        };

        const assistantMessage: TempChatMessage = {
            id: assistantTempId,
            chatId,
            role: 'assistant',
            content: '',
            createdAt: new Date(),
            tempId: assistantTempId,
        };

        setPendingMessages(prev => [...prev, userMessage, assistantMessage]);

        const selectedProvider = activeChatTabState.provider;
        const selectedModel = activeChatTabState.model || 'gpt-4o'; // fallback
        const excludedIds = activeChatTabState.excludedMessageIds ?? [];

        try {
            const stream = await sendMessageMutation.mutateAsync({
                message: userInput,
                chatId,                 // If you have a real chat ID
                provider: selectedProvider as APIProviders,
                tempId: assistantTempId,
                options: { model: selectedModel },
                excludedMessageIds: excludedIds,
            });

            const reader = stream.getReader();
            let assistantContent = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const text = new TextDecoder().decode(value);
                if (text) {
                    assistantContent += text;
                    setPendingMessages(prev =>
                        prev.map(m => m.id === assistantTempId
                            ? { ...m, content: assistantContent }
                            : m
                        )
                    );
                }
            }

            // Once the response is done, refetch the server messages
            await refetchMessages();
            setPendingMessages([]);
        } catch (error) {
            console.error('[handleSendMessage] Streaming error:', error);
            setPendingMessages(prev =>
                prev.map(m =>
                    m.id === assistantTempId
                        ? {
                            ...m,
                            content: `Error: ${error instanceof Error ? error.message : 'Failed to get response.'
                                }`
                        }
                        : m
                )
            );
        }
    }

    /** ========== FORK CHAT ========== */
    async function handleForkChat() {
        if (!chatId) return;
        try {
            const excludedIds = activeChatTabState?.excludedMessageIds ?? [];
            const newChat = await forkChatMutation.mutateAsync({
                chatId,
                excludedMessageIds: excludedIds
            });
            // Possibly store newChat in global state
            setPendingMessages([]);
        } catch (error) {
            console.error('[handleForkChat] Error:', error);
        }
    }

    /** ========== CLEAR EXCLUDED ========== */
    function clearExcludedMessages() {
        updateActiveChatTab({ excludedMessageIds: [] });
    }

    return {
        wsReady,
        chatId,
        modelControl,
        messages,
        pendingMessages,
        handleCreateChat,
        handleSendMessage,
        handleForkChat,
        clearExcludedMessages,
        refetchMessages,

        // If you want direct access to active chat tab:
        activeChatTabState,
        updateActiveChatTab,
    };
}