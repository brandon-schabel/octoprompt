// File: packages/client/src/components/chat/hooks/chat-hooks.tsx
import { useForkChat } from "@/hooks/api/use-chat-api";
import { useCallback, useState } from "react";
import { useGetMessages } from "@/hooks/api/use-chat-api";
import { ChatMessage } from "shared/schema";
import { useSendMessage } from "@/hooks/api/use-chat-api";
import { APIProviders, ChatModelSettings } from "shared";
import { useCreateChat } from "@/hooks/api/use-chat-api";
import { useChatTabField } from "@/zustand/zustand-utility-hooks";
import { useChatModelParams } from "./use-chat-model-params";
import { useAIChat } from "@/hooks/use-ai-chat";

export type TempChatMessage = ChatMessage & { tempId?: string };

export function useClearExcludedMessages(tabId: string) {
    const { mutate: setExcludedMessageIds } = useChatTabField(
        "excludedMessageIds",
        tabId
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
    provider: APIProviders;
    model: string;
    excludedMessageIds: string[];     // For partial context
    clearUserInput: () => void;       // A function to reset input in global state
    pendingMessages: TempChatMessage[];
    setPendingMessages: React.Dispatch<React.SetStateAction<TempChatMessage[]>>;
    refetchMessages: () => Promise<any>;
}

/**
 * Legacy hook to handle sending chat messages, with streaming updates.
 * Consider using the new useChatWithAI hook for enhanced streaming capabilities.
 */
export function useSendChatMessage(args: UseSendMessageArgs) {
    const {
        chatId,
        provider,
        model,
        excludedMessageIds,
        clearUserInput,
        setPendingMessages,
        refetchMessages,
    } = args;

    const sendMessageMutation = useSendMessage();

    const handleSendMessage = useCallback(async ({
        userInput,
        modelSettings,
    }: {
        userInput: string;
        modelSettings: ChatModelSettings
    }) => {
        const {
            temperature,
            max_tokens,
            top_p,
            frequency_penalty,
            presence_penalty,
            stream,
        } = modelSettings;

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
            // Pass the new settings into `options`
            const streamResponse = await sendMessageMutation.mutateAsync({
                message: userInput.trim(),
                chatId,
                provider,
                tempId: assistantTempId,
                options: {
                    model,
                    stream,
                    temperature,
                    max_tokens,
                    top_p,
                    frequency_penalty,
                    presence_penalty,
                },
                excludedMessageIds,
            });

            // Stream the response and update assistant message content
            const reader = streamResponse.getReader();
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

/**
 * New hook that combines the AI SDK's useChat with your existing chat logic
 */
export function useChatWithAI({
    chatId,
    provider,
    model,
    excludedMessageIds,
    clearUserInput,
    systemMessage,
}: {
    chatId: string;
    provider: APIProviders;
    model: string;
    excludedMessageIds: string[];
    clearUserInput: () => void;
    systemMessage?: string;
}) {
    // Use the enhanced AI chat hook
    const {
        messages,
        handleSubmit,
        isLoading,
        error,
        pendingMessages,
        setPendingMessages,
        refetchMessages,
        isFetching,
        setInput,
    } = useAIChat({
        chatId,
        provider,
        model,
        excludedMessageIds,
        systemMessage,
    });

    // Wrap the handleSubmit to also clear user input in parent component
    const handleSendMessage = useCallback(
        ({ userInput, modelSettings }: { userInput: string; modelSettings: ChatModelSettings }) => {
            if (!userInput.trim()) return;

            handleSubmit({ userInput, modelSettings });
            clearUserInput();
        },
        [handleSubmit, clearUserInput]
    );

    return {
        messages,
        isLoading,
        error,
        pendingMessages,
        setPendingMessages,
        refetchMessages,
        isFetching,
        handleSendMessage,
    };
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
        // Filter out any "temp-*" IDs from the server
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