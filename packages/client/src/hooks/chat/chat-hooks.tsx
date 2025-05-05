import { useCallback } from "react";
import {
    useGetMessages,
    useCreateChat,
    useForkChat,
} from "@/hooks/api/use-chat-api";
import type { CreateChatInput, } from "@/hooks/api/use-chat-api";
import { ForkChatRequestBody } from "@/generated/types.gen";


export function useCreateChatHandler() {
    // Use the refactored hook
    const createChatMutation = useCreateChat();

    const handleCreateChat = useCallback(
        async (chatTitle: string, currentChatId?: string) => {
            try {
                // Construct the input object matching CreateChatInput
                const input: CreateChatInput = {
                    title: chatTitle,
                    copyExisting: false,
                    ...(currentChatId && { currentChatId: currentChatId }),
                };
                const newChat = await createChatMutation.mutateAsync(input);

                console.log("[handleCreateChat] Create mutation triggered for:", chatTitle);
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