import { useForkChat } from "@/hooks/api/use-chat-api";
import { useCallback } from "react";
import { useGetMessages } from "@/hooks/api/use-chat-api";
import { APIProviders, ChatModelSettings } from "shared";
import { useCreateChat } from "@/hooks/api/use-chat-api";
import { useChatTabField } from "@/zustand/zustand-utility-hooks";
import { useChatModelParams } from "./use-chat-model-params";
import { useAIChat } from "@/hooks/use-ai-chat";

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

/**
 * Simplified hook for AI chat interaction using Vercel AI SDK and React Query.
 * Assumes useAIChat is updated to handle sending only new messages via `append`
 * and triggers `refetchMessages` in its `onFinish` callback.
 */
export function useChatWithAI({
    chatId,
    provider,
    model,
    excludedMessageIds,
    clearUserInput, // Keep this to clear input from the parent component (ChatPage)
    systemMessage,
}: {
    chatId: string;
    provider: APIProviders;
    model: string;
    excludedMessageIds: string[];
    clearUserInput: () => void;
    systemMessage?: string;
}) {
    // Fetch canonical messages using React Query
    const {
        data: messagesData,
        refetch: refetchMessages,
        isFetching,
        isError: isMessagesError,
    } = useGetMessages(chatId);

    // Use the underlying AI chat hook for API interaction and stream handling
    const {
        // messages: aiMessages, // We no longer rely on the SDK's internal message state for display
        // handleSubmit, // We use append directly
        append,
        isLoading, // This reflects the Vercel SDK's loading state (during streaming)
        error: aiError,
        stop,
        // input, handleInputChange, setInput // Not needed if input is managed by Zustand
    } = useAIChat({
        // Pass necessary config to the underlying hook
        chatId,
        provider,
        model,
        excludedMessageIds,
        systemMessage,
        // Ensure useAIChat's internal onFinish calls refetchMessages()
        // TODO: Uncomment this once useAIChat is updated to accept onFinish
        /*
        onFinish: () => {
            console.log("[useChatWithAI -> useAIChat.onFinish] Streaming finished, refetching messages.");
            refetchMessages();
        }
        */
    });

    // Prepare the message sending function
    const handleSendMessage = useCallback(
        async ({ userInput, modelSettings }: { userInput: string; modelSettings: ChatModelSettings }) => {
            if (!userInput.trim() || !chatId) return;

            // Clear input immediately in the parent component's state
            clearUserInput();

            try {
                console.log('[useChatWithAI] Calling append with:', { chatId, provider, model, systemMessage, userInput: userInput.trim() });
                await append(
                    {
                        // Message content for Vercel SDK append structure
                        role: 'user',
                        content: userInput.trim(),
                    },
                    {
                        // Body data for the backend API call (/api/ai/chat)
                        body: {
                            chatId: chatId,
                            provider: provider,
                            options: { model, ...modelSettings }, // Pass model settings
                            excludedMessageIds: excludedMessageIds,
                            systemMessage: systemMessage,
                            userMessageContent: userInput.trim(), // Explicitly send content
                        },
                    }
                );
                console.log('[useChatWithAI] Append call finished.');
            } catch (err) {
                console.error('[useChatWithAI] Error calling append:', err);
                // Handle error appropriately, maybe show a toast notification
            }
        },
        [append, chatId, provider, model, excludedMessageIds, systemMessage, clearUserInput]
    );

    // Combine errors if necessary
    const error = aiError || (isMessagesError ? new Error("Failed to fetch messages") : null);

    return {
        messages: messagesData?.data || [], // Return messages directly from React Query
        isLoading, // Loading state during stream
        isFetching, // Fetching state from React Query
        error,
        refetchMessages,
        handleSendMessage, // Use this function to send messages
        stop, // Allow stopping the stream
    };
}

/**
 * Simplified hook to fetch chat messages using React Query.
 * No longer manages pending messages.
 */
export function useChatMessages(chatId: string) {
    const {
        data: messagesData,
        refetch: refetchMessages,
        isFetching,
        isError,
    } = useGetMessages(chatId);

    return {
        messages: messagesData?.data || [], // Directly return fetched data
        refetchMessages,
        isFetching,
        isError,
    };
}

interface UseForkChatArgs {
    chatId: string;
    excludedMessageIds: string[];
    // setPendingMessages is removed as pending state is gone
}

export function useForkChatHandler({
    chatId,
    excludedMessageIds,
}: UseForkChatArgs) {
    const forkChatMutation = useForkChat();

    const handleForkChat = useCallback(async () => {
        if (!chatId) return;
        try {
            await forkChatMutation.mutateAsync({
                chatId,
                excludedMessageIds,
            });
            // No need to clear pending messages anymore
        } catch (error) {
            console.error("[handleForkChat] Error:", error);
        }
    }, [chatId, excludedMessageIds, forkChatMutation]);

    return { handleForkChat };
}