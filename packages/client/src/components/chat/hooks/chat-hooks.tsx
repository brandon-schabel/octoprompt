import { useCallback } from "react";
// Update imports to use the refactored hooks
import {
    useGetMessages,
    useCreateChat,
    useForkChat,
    // useForkChatFromMessage // Import if you use it
} from "@/hooks/api/use-chat-api";
import { APIProviders, ChatModelSettings } from "shared";
import { useChatModelParams } from "./use-chat-model-params";
import { useAIChat } from "@/hooks/use-ai-chat";
import { useSettings } from "@/zustand/selectors";
// Import the input type if needed for clarity/casting
import type { CreateChatInput, } from "@/hooks/api/use-chat-api";
import { ForkChatRequestBody } from "@/hooks/generated/types.gen";


export function useCreateChatHandler() {
    // Use the refactored hook
    const createChatMutation = useCreateChat();

    const handleCreateChat = useCallback(
        async (chatTitle: string, currentChatId?: string) => {
            try {
                // Construct the input object matching CreateChatInput
                const input: CreateChatInput = {
                    title: chatTitle,
                    // Assuming copyExisting=false means don't copy messages/settings
                    copyExisting: false, // Adjust based on actual API meaning
                    // Pass currentChatId only if the API uses it (e.g., for copying)
                    // Check CreateChatRequestBody in types.gen.ts
                    ...(currentChatId && { currentChatId: currentChatId }), // Conditionally add if API supports it for copying
                };
                // Call mutateAsync with the input object
                const newChat = await createChatMutation.mutateAsync(input);
                // The return type of mutateAsync depends on the generic definition,
                // often unknown or the success response type. Assume success gives ChatResponse.
                // If you need the created chat data, ensure useCreateChat returns it or handle cache updates.
                // For now, assume it invalidates and the list updates, returning null or a success indicator.
                // Let's adjust based on the hook returning `unknown` for now.
                // We might need to update query data manually if immediate access to the new chat object is needed.
                // queryClient.setQueryData(...) or rely on list refetch.
                console.log("[handleCreateChat] Create mutation triggered for:", chatTitle);
                // Returning null as the hook invalidates, doesn't directly return the new chat object in this setup
                return null; // Adjust if the hook/API returns the created object directly
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
 * NOTE: This hook primarily interacts with useAIChat (Vercel SDK wrapper)
 * and useGetMessages (our API). The refactoring mainly affects useGetMessages usage.
 */
export function useChatWithAI({
    chatId,
    excludedMessageIds,
    clearUserInput,
    systemMessage,
}: {
    chatId: string;
    excludedMessageIds: string[];
    clearUserInput: () => void;
    systemMessage?: string;
}) {
    const settings = useSettings();
    const { settings: modelParams } = useChatModelParams();

    // Fetch canonical messages using the refactored React Query hook
    const {
        data: messagesResponse, // The hook returns the full response object { success: true, data: [...] }
        refetch: refetchMessages,
        isFetching,
        isError: isMessagesError,
    } = useGetMessages(chatId); // Use the refactored hook

    // Underlying AI chat hook (Vercel SDK wrapper - likely unchanged by this refactor)
    const {
        append,
        isLoading,
        error: aiError,
        stop,
    } = useAIChat({
        chatId,
        provider: settings.provider as APIProviders,
        model: settings.model,
        excludedMessageIds,
        systemMessage,
        // onFinish might still be useful if useAIChat supports it for refetching
        // onFinish: () => {
        //     console.log("[useChatWithAI -> useAIChat.onFinish] Streaming finished, refetching messages.");
        //     refetchMessages();
        // }
    });

    // Message sending function (interacts with useAIChat, not directly with our POST /message API)
    const handleSendMessage = useCallback(
        async ({ userInput }: { userInput: string }) => {
            if (!userInput.trim() || !chatId) return;

            clearUserInput();

            try {
                const currentModelSettings: ChatModelSettings = {
                    temperature: modelParams.temperature,
                    max_tokens: modelParams.max_tokens,
                    top_p: modelParams.top_p,
                    frequency_penalty: modelParams.frequency_penalty,
                    presence_penalty: modelParams.presence_penalty,
                    stream: modelParams.stream,
                };

                // This call goes to the Vercel useChat hook via our useAIChat wrapper
                await append(
                    { role: 'user', content: userInput.trim() },
                    {
                        body: {
                            chatId: chatId,
                            provider: settings.provider,
                            options: { model: settings.model, ...currentModelSettings },
                            excludedMessageIds: excludedMessageIds,
                            systemMessage: systemMessage,
                            // userMessageContent: userInput.trim(), // Check if useAIChat/backend needs this explicitly
                        },
                    }
                );
                console.log('[useChatWithAI] Append call finished.');
                // If onFinish isn't reliable/available, refetch messages after append completes.
                // Consider potential race conditions if streaming takes time.
                // Maybe delay the refetch slightly or rely on optimistic updates within useAIChat.
                refetchMessages();
            } catch (err) {
                console.error('[useChatWithAI] Error calling append:', err);
            }
        },
        [append, chatId, settings.provider, settings.model, modelParams, excludedMessageIds, systemMessage, clearUserInput, refetchMessages]
    );

    const error = aiError || (isMessagesError ? new Error("Failed to fetch messages") : null);

    return {
        // Extract the actual messages array from the response object
        messages: messagesResponse?.data || [],
        isLoading,
        isFetching,
        error,
        refetchMessages,
        handleSendMessage,
        stop,
    };
}

// Use the refactored hook for fetching messages
export function useChatMessages(chatId: string) {
    const {
        data: messagesResponse, // Hook returns the full response object
        refetch: refetchMessages,
        isFetching,
        isError,
    } = useGetMessages(chatId); // Use the refactored hook

    return {
        // Extract the actual messages array
        messages: messagesResponse?.data || [],
        refetchMessages,
        isFetching,
        isError,
    };
}


export function useForkChatHandler({ chatId }: { chatId: string }) {
    // Use the refactored hook
    const forkChatMutation = useForkChat();

    const handleForkChat = useCallback(async () => {
        if (!chatId) return;
        try {
            // Construct the input for the refactored hook
            // It expects { chatId: string; body: ForkChatRequestBody }
            const inputBody: ForkChatRequestBody = {
                // Pass empty array if that's the default for a full fork
                // Or allow passing specific IDs if needed by the UI
                excludedMessageIds: [],
            };
            await forkChatMutation.mutateAsync({
                chatId,
                body: inputBody,
            });
            console.log(`[handleForkChat] Fork initiated for chatId: ${chatId}`);
        } catch (error) {
            console.error("[handleForkChat] Error:", error);
        }
    }, [chatId, forkChatMutation]);

    return { handleForkChat };
}

// Example if you were using useForkChatFromMessage
/*
export function useForkChatFromMessageHandler({ chatId, messageId }: { chatId: string; messageId: string; }) {
    const forkMutation = useForkChatFromMessage(); // Use refactored hook

    const handleFork = useCallback(async () => {
        if (!chatId || !messageId) return;
        try {
            const inputBody: ForkChatFromMessageRequestBody = {
                excludedMessageIds: [], // Or pass specific IDs if needed
            };
            await forkMutation.mutateAsync({
                chatId,
                messageId,
                body: inputBody,
            });
            console.log(`[handleForkFromMessage] Fork initiated for chatId: ${chatId} from message ${messageId}`);
        } catch (error) {
            console.error("[handleForkFromMessage] Error:", error);
        }
    }, [chatId, messageId, forkMutation]);

    return { handleFork };
}
*/