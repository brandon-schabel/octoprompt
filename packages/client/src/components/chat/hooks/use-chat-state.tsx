/* packages/client/src/components/chat/hooks/use-chat-state.tsx */

import { useState } from 'react';
import {
    useCreateChat,
    useGetMessages,
    useSendMessage,
    useForkChat,
} from '@/hooks/api/use-chat-ai-api';
import { useChatModelControl } from './use-chat-model-control';
import { ChatMessage } from 'shared/schema';
import { APIProviders } from 'shared/index';
import { useQuery } from '@tanstack/react-query';
import { useChatTabField, useChatTabFieldUpdater } from '@/websocket-state/chat-tab-hooks';

type TempChatMessage = ChatMessage & { tempId?: string };

export function useChatControl() {
    // 1) Determine which chat tab is active
    const { data: chatActiveTabId } = useQuery({
        queryKey: ["globalState"],
        select: (gs: any) => gs?.chatActiveTabId ?? null,
    });

    // 2) Grab fields from that tab: input, excludedMessageIds, etc.
    const { data: input = "" } = useChatTabField(chatActiveTabId ?? "", "input");
    const { data: provider = "openai" } = useChatTabField(
        chatActiveTabId ?? "",
        "provider"
    );
    const { data: model = "gpt-4o" } = useChatTabField(
        chatActiveTabId ?? "",
        "model"
    );
    const { data: excludedMessageIds = [] } = useChatTabField(
        chatActiveTabId ?? "",
        "excludedMessageIds"
    );
    const { data: activeChatId } = useChatTabField(
        chatActiveTabId ?? "",
        "activeChatId"
    );

    // 3) Updaters for each field we want to mutate
    const { mutate: setInput } = useChatTabFieldUpdater(
        chatActiveTabId ?? "",
        "input"
    );

    // The user might also want to do partial merges on excludedMessageIds, but we omit for brevity

    // 4) Local pending queue
    const [pendingMessages, setPendingMessages] = useState<TempChatMessage[]>([]);

    // API hooks
    const createChatMutation = useCreateChat();
    const sendMessageMutation = useSendMessage();
    const forkChatMutation = useForkChat();

    // 5) Model control logic
    const modelControl = useChatModelControl(); // or just use the single fields above

    // 6) If there's a real chat ID:
    const chatId = activeChatId ?? "";
    const { data: messagesData, refetch: refetchMessages } = useGetMessages(chatId);

    const messages = mergeServerAndPendingMessages(
        messagesData?.data || [],
        pendingMessages
    );

    function mergeServerAndPendingMessages(
        serverMsgs: TempChatMessage[],
        pending: TempChatMessage[]
    ) {
        const filteredServer = serverMsgs.filter(msg => !msg.id.startsWith('temp-'));
        const pendingWithoutDupes = pending.filter(
            p => !filteredServer.some(s => s.tempId === p.tempId)
        );
        return [...filteredServer, ...pendingWithoutDupes];
    }

    /** ========== CREATE CHAT ========== */
    async function handleCreateChat(chatTitle: string) {
        try {
            const newChat = await createChatMutation.mutateAsync({ title: chatTitle });
            return newChat;
        } catch (error) {
            console.error('[handleCreateChat] Error:', error);
            return null;
        }
    }

    /** ========== SEND MESSAGE ========== */
    async function handleSendMessage() {
        const userInput = input.trim();
        if (!userInput || !chatActiveTabId) return;

        // Clear input in global state
        setInput("");

        // Make temp IDs
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

        try {
            const stream = await sendMessageMutation.mutateAsync({
                message: userInput,
                chatId,
                provider: provider as APIProviders,
                tempId: assistantTempId,
                options: { model },
                excludedMessageIds,
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
            const newChat = await forkChatMutation.mutateAsync({
                chatId,
                excludedMessageIds,
            });
            setPendingMessages([]);
        } catch (error) {
            console.error('[handleForkChat] Error:', error);
        }
    }

    /** ========== CLEAR EXCLUDED ========== */
    function clearExcludedMessages() {
        // If you want to set the excludedMessageIds to empty array here, do:
        //   useChatTabFieldUpdater(chatActiveTabId, 'excludedMessageIds')
        // For brevity, omitted.
    }

    return {
        chatId,
        modelControl,
        messages,
        pendingMessages,
        handleCreateChat,
        handleSendMessage,
        handleForkChat,
        clearExcludedMessages,
        refetchMessages,
    };
}