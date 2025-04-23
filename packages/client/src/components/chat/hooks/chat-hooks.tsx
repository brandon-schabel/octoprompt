import { useCallback } from "react";
import { useGetMessages } from "@/hooks/api/use-chat-api";
import { APIProviders, ChatModelSettings } from "shared"; // Keep types
import { useCreateChat } from "@/hooks/api/use-chat-api"; // Keep if create API exists
import { useChatModelParams } from "./use-chat-model-params"; // Keep refactored hook
import { useAIChat } from "@/hooks/use-ai-chat";
import { useSettings } from "@/zustand/selectors"; // Import useSettings
import { useForkChat } from "@/hooks/api/use-chat-api"; // Assuming this API call exists





export function useCreateChatHandler() {
    const createChatMutation = useCreateChat(); // Assumes this API call doesn't depend on tabs

    const handleCreateChat = useCallback(
        async (chatTitle: string, currentChatId?: string) => {
            try {
                // Ensure payload doesn't contain tab-specific fields if API changes
                const newChat = await createChatMutation.mutateAsync({
                    title: chatTitle,
                    copyExisting: false, // Assuming this means copy chat data, not tab state
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
 * Simplified hook for AI chat interaction using global settings.
 */
export function useChatWithAI({
    chatId,
    // Removed provider, model - get from global settings
    excludedMessageIds, // Passed as prop from parent
    clearUserInput,     // Passed as prop from parent
    systemMessage,      // Passed as prop or get from global settings if applicable
}: {
    chatId: string;
    excludedMessageIds: string[];
    clearUserInput: () => void;
    systemMessage?: string; // Make optional or decide if global
}) {
    const settings = useSettings(); // Get global settings
    const { settings: modelParams } = useChatModelParams(); // Get derived model params

    // Fetch canonical messages using React Query (based on chatId)
    const {
        data: messagesData,
        refetch: refetchMessages,
        isFetching,
        isError: isMessagesError,
    } = useGetMessages(chatId); // This remains the source of truth for messages

    // Underlying AI chat hook
    const {
        append,
        isLoading, // SDK's loading state during streaming
        error: aiError,
        stop,
    } = useAIChat({ // Pass required config, now sourced globally
        chatId,
        provider: settings.provider as APIProviders, // Cast needed if type differs slightly
        model: settings.model,
        excludedMessageIds, // Pass through
        systemMessage, // Pass through or get from global if made global
        // onFinish: () => { // Keep if useAIChat supports this
        //     console.log("[useChatWithAI -> useAIChat.onFinish] Streaming finished, refetching messages.");
        //     refetchMessages();
        // }
    });

    // Message sending function
    const handleSendMessage = useCallback(
        async ({ userInput }: { userInput: string }) => { // Removed modelSettings from args
            if (!userInput.trim() || !chatId) return;

            clearUserInput(); // Clear parent's input state

            try {
                const currentModelSettings: ChatModelSettings = { // Construct settings for API
                    temperature: modelParams.temperature,
                    max_tokens: modelParams.max_tokens,
                    top_p: modelParams.top_p,
                    frequency_penalty: modelParams.frequency_penalty,
                    presence_penalty: modelParams.presence_penalty,
                    stream: modelParams.stream,
                };

                console.log('[useChatWithAI] Calling append with:', {
                    chatId,
                    provider: settings.provider,
                    model: settings.model,
                    systemMessage, // Include if used
                    userInput: userInput.trim(),
                    options: currentModelSettings, // Log effective settings
                    excludedMessageIds,
                });

                await append(
                    { // Vercel SDK message format
                        role: 'user',
                        content: userInput.trim(),
                    },
                    { // Backend API body (/api/ai/chat)
                        body: {
                            chatId: chatId,
                            provider: settings.provider,
                            // Pass combined options (model + params)
                            options: { model: settings.model, ...currentModelSettings },
                            excludedMessageIds: excludedMessageIds,
                            systemMessage: systemMessage, // Send if provided
                            userMessageContent: userInput.trim(), // Explicitly send content
                        },
                    }
                );
                console.log('[useChatWithAI] Append call finished.');
                // Consider calling refetchMessages() here if onFinish isn't reliable/implemented in useAIChat
                // refetchMessages();
            } catch (err) {
                console.error('[useChatWithAI] Error calling append:', err);
                // Handle error (e.g., toast notification)
            }
        },
        // Dependencies updated: use global settings and params
        [append, chatId, settings.provider, settings.model, modelParams, excludedMessageIds, systemMessage, clearUserInput, refetchMessages] // Added refetchMessages if called here
    );

    // Combine errors
    const error = aiError || (isMessagesError ? new Error("Failed to fetch messages") : null);

    return {
        messages: messagesData?.data || [], // Messages from React Query
        isLoading,     // SDK streaming state
        isFetching,    // React Query fetching state
        error,
        refetchMessages,
        handleSendMessage,
        stop,
    };
}

// Keep useChatMessages - It operates on chatId
export function useChatMessages(chatId: string) {
    const {
        data: messagesData,
        refetch: refetchMessages,
        isFetching,
        isError,
    } = useGetMessages(chatId);

    return {
        messages: messagesData?.data || [],
        refetchMessages,
        isFetching,
        isError,
    };
}


export function useForkChatHandler({ chatId }: { chatId: string }) { // Only needs chatId
    const forkChatMutation = useForkChat(); // Assuming this API hook exists

    const handleForkChat = useCallback(async () => {
        if (!chatId) return;
        try {
            // API call likely only needs the original chatId
            await forkChatMutation.mutateAsync({
                chatId,
                excludedMessageIds: [], // Don't send excluded IDs from old tab concept
            });
            // Forking might navigate user or update list, handled elsewhere
            console.log(`[handleForkChat] Fork initiated for chatId: ${chatId}`);
        } catch (error) {
            console.error("[handleForkChat] Error:", error);
        }
    }, [chatId, forkChatMutation]);

    return { handleForkChat };
}
