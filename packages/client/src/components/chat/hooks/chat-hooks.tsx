import { useForkChat } from "@/hooks/api/use-chat-ai-api";
import { useCallback } from "react";
import { useState } from "react";
import { useGetMessages } from "@/hooks/api/use-chat-ai-api";
import { ChatMessage } from "shared/schema";
export type TempChatMessage = ChatMessage & { tempId?: string };
import { useSendMessage } from "@/hooks/api/use-chat-ai-api";
import { APIProviders } from "shared";
import { useCreateChat } from "@/hooks/api/use-chat-ai-api";
import { useChatTabFieldUpdater } from "@/websocket-state/chat-tab-hooks";

export function useClearExcludedMessages(tabId: string) {
  const { mutate: setExcludedMessageIds } = useChatTabFieldUpdater(
    tabId,
    "excludedMessageIds"
  );

  const clearExcludedMessages = useCallback(() => {
    setExcludedMessageIds([]);
  }, [setExcludedMessageIds]);

  return { clearExcludedMessages };
}
export function useCreateChatHandler() {
    const createChatMutation = useCreateChat();

    const handleCreateChat = useCallback(
        async (chatTitle: string, currentChatId?: string) => {
            try {
                const newChat = await createChatMutation.mutateAsync({
                    title: chatTitle,
                    copyExisting: false,
                    currentChatId,
                });
                return newChat;
            } catch (error) {
                console.error("[handleCreateChat] Error:", error);
                return null;
            }
        },
        [createChatMutation]
    );

    return { handleCreateChat };
}

interface UseSendMessageArgs {
    chatId: string;
    userInput: string;                // The user’s typed input
    provider: APIProviders;
    model: string;
    excludedMessageIds: string[];     // For partial context
    clearUserInput: () => void;       // A function to reset input in global state
    pendingMessages: TempChatMessage[];
    setPendingMessages: React.Dispatch<React.SetStateAction<TempChatMessage[]>>;
    refetchMessages: () => Promise<any>;
}

export function useSendMessageHook(args: UseSendMessageArgs) {
    const {
        chatId,
        userInput,
        provider,
        model,
        excludedMessageIds,
        clearUserInput,
        pendingMessages,
        setPendingMessages,
        refetchMessages,
    } = args;

    const sendMessageMutation = useSendMessage();

    const handleSendMessage = useCallback(async () => {
        if (!userInput.trim()) {
            console.log("[handleSendMessage] Aborting - no input");
            return;
        }

        // Clear input from global state
        clearUserInput();

        // Create local pending user + assistant messages
        const userTempId = `temp-user-${Date.now()}`;
        const assistantTempId = `temp-assistant-${Date.now()}`;

        const userMessage: TempChatMessage = {
            id: userTempId,
            role: "user",
            content: userInput.trim(),
            chatId,
            createdAt: new Date(),
            tempId: userTempId,
        };

        const assistantMessage: TempChatMessage = {
            id: assistantTempId,
            role: "assistant",
            content: "",
            chatId,
            createdAt: new Date(),
            tempId: assistantTempId,
        };

        // Push them to local pending
        setPendingMessages((prev) => [...prev, userMessage, assistantMessage]);

        try {
            const stream = await sendMessageMutation.mutateAsync({
                message: userInput.trim(),
                chatId,
                provider,
                tempId: assistantTempId,
                options: { model },
                excludedMessageIds,
            });

            // Stream the response and update assistant message content
            const reader = stream.getReader();
            let assistantContent = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const text = new TextDecoder().decode(value);
                if (text) {
                    assistantContent += text;
                    setPendingMessages((prev) =>
                        prev.map((m) =>
                            m.id === assistantTempId
                                ? { ...m, content: assistantContent }
                                : m
                        )
                    );
                }
            }

            // Once streaming finishes, re-fetch from server + clear local pending
            await refetchMessages();
            setPendingMessages([]);
        } catch (error) {
            console.error("[handleSendMessage] Streaming error:", error);
            setPendingMessages((prev) =>
                prev.map((m) =>
                    m.id === assistantTempId
                        ? {
                            ...m,
                            content:
                                error instanceof Error
                                    ? `Error: ${error.message}`
                                    : "Error: Failed to get response.",
                        }
                        : m
                )
            );
        }
    }, [
        userInput,
        chatId,
        provider,
        model,
        excludedMessageIds,
        clearUserInput,
        setPendingMessages,
        sendMessageMutation,
        refetchMessages,
    ]);

    return { handleSendMessage };
}

export function useChatMessages(chatId: string) {
    const [pendingMessages, setPendingMessages] = useState<TempChatMessage[]>([]);

    const {
        data: messagesData,
        refetch: refetchMessages,
        isFetching,
        isError,
    } = useGetMessages(chatId);

    // Merge server and pending
    const messages = mergeServerAndPendingMessages(
        messagesData?.data || [],
        pendingMessages
    );

    function mergeServerAndPendingMessages(
        serverMsgs: TempChatMessage[],
        pending: TempChatMessage[]
    ): TempChatMessage[] {
        // Filter out any “temp-*” IDs from the server
        const filteredServer = serverMsgs.filter(
            (msg) => !msg.id.startsWith("temp-")
        );
        // Exclude duplicates from local pending
        const pendingWithoutDupes = pending.filter(
            (p) => !filteredServer.some((s) => s.tempId === p.tempId)
        );
        return [...filteredServer, ...pendingWithoutDupes];
    }

    return {
        messages,
        pendingMessages,
        setPendingMessages,
        refetchMessages,
        isFetching,
        isError,
    };
}

interface UseForkChatArgs {
    chatId: string;
    excludedMessageIds: string[];
    setPendingMessages?: React.Dispatch<React.SetStateAction<any>>;
}

export function useForkChatHandler({
    chatId,
    excludedMessageIds,
    setPendingMessages,
}: UseForkChatArgs) {
    const forkChatMutation = useForkChat();

    const handleForkChat = useCallback(async () => {
        if (!chatId) return;
        try {
            await forkChatMutation.mutateAsync({
                chatId,
                excludedMessageIds,
            });
            // Optionally reset pending messages if desired
            if (setPendingMessages) {
                setPendingMessages([]);
            }
        } catch (error) {
            console.error("[handleForkChat] Error:", error);
        }
    }, [chatId, excludedMessageIds, forkChatMutation, setPendingMessages]);

    return { handleForkChat };
}