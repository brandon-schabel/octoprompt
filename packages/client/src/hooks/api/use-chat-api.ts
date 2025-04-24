import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { commonErrorHandler } from './common-mutation-error-handler';
import {
    getChatsOptions,
    getChatsQueryKey,
    getChatsByChatIdMessagesOptions,
    getChatsByChatIdMessagesQueryKey,
    postChatsMutation,
    patchChatsByChatIdMutation,
    deleteChatsByChatIdMutation,
    postChatsByChatIdForkMutation,
    postChatsByChatIdForkByMessageIdMutation,
    deleteMessagesByMessageIdMutation,
    getModelsOptions,
} from '../generated/@tanstack/react-query.gen';
import type {
    PostChatsData,
    PostChatsError,
    GetChatsByChatIdMessagesData,
    PatchChatsByChatIdData,
    PatchChatsByChatIdError,
    DeleteChatsByChatIdData,
    DeleteChatsByChatIdError,
    PostChatsByChatIdForkData,
    PostChatsByChatIdForkError,
    PostChatsByChatIdForkByMessageIdData,
    PostChatsByChatIdForkByMessageIdError,
    ForkChatRequestBody,
    ForkChatFromMessageRequestBody,
    DeleteMessagesByMessageIdData,
    DeleteMessagesByMessageIdError,
    GetModelsData,
} from '../generated/types.gen';
import { Options } from '../generated/sdk.gen'; // Only needed if passing full Options<>
import { APIProviders } from 'shared/src/schemas/provider-key.schemas';

// Define input types based on generated request body types
export type CreateChatInput = PostChatsData['body'];
export type UpdateChatInput = PatchChatsByChatIdData['body'];

// Define Query Keys using generated functions
const CHAT_KEYS = {
    all: () => getChatsQueryKey(),
    lists: () => getChatsQueryKey(), // Alias for clarity if needed
    // No specific 'detail' for a single chat via GET /chats/{id}, lists handle chat entities
    messages: (chatId: string) => getChatsByChatIdMessagesQueryKey({ path: { chatId } } as Options<GetChatsByChatIdMessagesData>),
} as const;

// --- Query Hooks ---

// Get all chats
export function useGetChats() {
    const queryOptions = getChatsOptions(); // No params needed for base request
    return useQuery(queryOptions);
}

// Get messages for a specific chat
export function useGetMessages(chatId: string) {
    const queryOptions = getChatsByChatIdMessagesOptions({ path: { chatId } } as Options<GetChatsByChatIdMessagesData>);
    return useQuery({
        ...queryOptions,
        enabled: !!chatId, // Only run query if chatId is provided
    });
}

// --- Mutation Hooks ---

// Create a new chat
export function useCreateChat() {
    const queryClient = useQueryClient();
    const mutationOptions = postChatsMutation(); // Get the generated mutation config

    // Using generated types for better type safety
    return useMutation<unknown, PostChatsError, CreateChatInput>({ // Input is the body
        mutationFn: (body: CreateChatInput) => {
            const opts: Options<PostChatsData> = { body };
            return mutationOptions.mutationFn!(opts); // Call generated function
        },
        onSuccess: (data, variables, context) => {
            queryClient.invalidateQueries({ queryKey: CHAT_KEYS.all() });
            // Optionally call original onSuccess if it existed or is needed
            // mutationOptions.onSuccess?.(data, variables, context);
        },
        onError: (error) => commonErrorHandler(error as unknown as Error), // Cast error type
    });
}

// Update chat (e.g., title)
export function useUpdateChat() {
    const queryClient = useQueryClient();
    const mutationOptions = patchChatsByChatIdMutation();

    // Input includes chatId for path and data for body
    return useMutation<unknown, PatchChatsByChatIdError, { chatId: string; data: UpdateChatInput }>({
        mutationFn: (vars: { chatId: string; data: UpdateChatInput }) => {
            const opts: Options<PatchChatsByChatIdData> = { path: { chatId: vars.chatId }, body: vars.data };
            return mutationOptions.mutationFn!(opts);
        },
        onSuccess: (data, variables, context) => {
            const chatId = variables.chatId;
            // Invalidate all chats as title might appear in the list
            queryClient.invalidateQueries({ queryKey: CHAT_KEYS.all() });
            // Optionally invalidate messages if needed, though only title changed
            // queryClient.invalidateQueries({ queryKey: CHAT_KEYS.messages(chatId) });
        },
        onError: (error) => commonErrorHandler(error as unknown as Error),
    });
}

// Delete a chat
export function useDeleteChat() {
    const queryClient = useQueryClient();
    const mutationOptions = deleteChatsByChatIdMutation();

    // Input is just the chatId string
    return useMutation<unknown, DeleteChatsByChatIdError, string>({
        mutationFn: (chatId: string) => {
            const opts: Options<DeleteChatsByChatIdData> = { path: { chatId } };
            return mutationOptions.mutationFn!(opts);
        },
        onSuccess: (data, variables, context) => {
            // 'variables' is the chatId here
            queryClient.invalidateQueries({ queryKey: CHAT_KEYS.all() });
            // Remove messages query for the deleted chat if it exists in cache
            queryClient.removeQueries({ queryKey: CHAT_KEYS.messages(variables) });
        },
        onError: (error) => commonErrorHandler(error as unknown as Error),
    });
}

// Fork a chat (from the beginning)
export function useForkChat() {
    const queryClient = useQueryClient();
    const mutationOptions = postChatsByChatIdForkMutation();

    // Input includes chatId and optional body (excludedMessageIds)
    return useMutation<unknown, PostChatsByChatIdForkError, { chatId: string; body: ForkChatRequestBody }>({
        mutationFn: (vars: { chatId: string; body: ForkChatRequestBody }) => {
            const opts: Options<PostChatsByChatIdForkData> = { path: { chatId: vars.chatId }, body: vars.body };
            return mutationOptions.mutationFn!(opts);
        },
        onSuccess: (data, variables, context) => {
            // Invalidate all chats because a new one was created
            queryClient.invalidateQueries({ queryKey: CHAT_KEYS.all() });
        },
        onError: (error) => commonErrorHandler(error as unknown as Error),
    });
}

// Fork a chat from a specific message
export function useForkChatFromMessage() {
    const queryClient = useQueryClient();
    const mutationOptions = postChatsByChatIdForkByMessageIdMutation();

    // Input includes chatId, messageId, and optional body
    return useMutation<unknown, PostChatsByChatIdForkByMessageIdError, { chatId: string; messageId: string; body: ForkChatFromMessageRequestBody }>({
        mutationFn: (vars: { chatId: string; messageId: string; body: ForkChatFromMessageRequestBody }) => {
            const opts: Options<PostChatsByChatIdForkByMessageIdData> = { path: { chatId: vars.chatId, messageId: vars.messageId }, body: vars.body };
            return mutationOptions.mutationFn!(opts);
        },
        onSuccess: (data, variables, context) => {
            // Invalidate all chats because a new one was created
            queryClient.invalidateQueries({ queryKey: CHAT_KEYS.all() });
        },
        onError: (error) => commonErrorHandler(error as unknown as Error),
    });
}

// Note: deleteMessagesByMessageIdMutation is available if needed, but often message deletion might be handled differently (e.g., soft delete or via chat context)
// If you need a hook for it:

export function useDeleteMessage() {
    const queryClient = useQueryClient();
    const mutationOptions = deleteMessagesByMessageIdMutation();

    // Input is messageId string
    return useMutation<unknown, DeleteMessagesByMessageIdError, string>({
        mutationFn: (messageId: string) => {
            const opts: Options<DeleteMessagesByMessageIdData> = { path: { messageId } };
            return mutationOptions.mutationFn!(opts);
        },
        onSuccess: (data, variables, context) => {
            // How to invalidate depends on how messages are fetched.
            // If fetched per-chat, need to find the chat ID associated with the messageId.
            // This might require more complex cache updates or fetching chat ID beforehand.
            // A simpler approach might be to refetch all messages for the relevant chat
            // if the chatId is known here or passed as part of variables.
            // Example (assuming chatId was passed somehow or available in context):
            // const chatId = context?.chatId || getChatIdFromMessageId(variables); // Pseudo-code
            // if (chatId) {
            //     queryClient.invalidateQueries({ queryKey: CHAT_KEYS.messages(chatId) });
            // }
            console.warn("Message deleted, but cache invalidation might need specific logic based on chatId.");
        },
        onError: (error) => commonErrorHandler(error as unknown as Error),
    });
}

export function useGetModels(provider: APIProviders) {
    const queryOptions = getModelsOptions({ query: { provider, } });
    return useQuery(queryOptions);
}