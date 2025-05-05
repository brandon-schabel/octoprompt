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
} from '../../generated/@tanstack/react-query.gen';
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
    PostChatsResponse,
    PatchChatsByChatIdResponse,
    DeleteChatsByChatIdResponse,
    PostChatsByChatIdForkResponse,
    PostChatsByChatIdForkByMessageIdResponse,
    DeleteMessagesByMessageIdResponse,
} from '../../generated/types.gen';
import { Options } from '../../generated/sdk.gen';
import { APIProviders } from 'shared/src/schemas/provider-key.schemas';

export type CreateChatInput = PostChatsData['body'];
export type UpdateChatInput = PatchChatsByChatIdData['body'];

const CHAT_KEYS = {
    all: () => getChatsQueryKey(),
    lists: () => getChatsQueryKey(),
    messages: (chatId: string) => getChatsByChatIdMessagesQueryKey({ path: { chatId } } as Options<GetChatsByChatIdMessagesData>),
} as const;

export function useGetChats() {
    const queryOptions = getChatsOptions();
    return useQuery(queryOptions);
}

export function useGetMessages(chatId: string) {
    const queryOptions = getChatsByChatIdMessagesOptions({ path: { chatId } } as Options<GetChatsByChatIdMessagesData>);
    return useQuery({
        ...queryOptions,
        enabled: !!chatId,
    });
}

export function useCreateChat() {
    const queryClient = useQueryClient();
    const mutationOptions = postChatsMutation(); // Get the generated mutation config

    // Using generated types for better type safety
    return useMutation<PostChatsResponse, PostChatsError, CreateChatInput>({ // Input is the body
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

export function useUpdateChat() {
    const queryClient = useQueryClient();
    const mutationOptions = patchChatsByChatIdMutation();

    // Input includes chatId for path and data for body
    return useMutation<PatchChatsByChatIdResponse, PatchChatsByChatIdError, { chatId: string; data: UpdateChatInput }>({
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

export function useDeleteChat() {
    const queryClient = useQueryClient();
    const mutationOptions = deleteChatsByChatIdMutation();

    // Input is just the chatId string
    return useMutation<DeleteChatsByChatIdResponse, DeleteChatsByChatIdError, string>({
        mutationFn: (chatId: string) => {
            const opts: Options<DeleteChatsByChatIdData> = { path: { chatId } };
            return mutationOptions.mutationFn!(opts);
        },
        onSuccess: (data, variables, context) => {
            const chatId = variables;
            if (chatId) {
                queryClient.invalidateQueries({ queryKey: getChatsByChatIdMessagesQueryKey({ path: { chatId } }) });
                console.log(`Invalidated messages for chat ${chatId} after deleting chat`);
            } else {
                console.warn(`useDeleteChat: Could not invalidate messages for chat ${chatId}, chatId missing.`);
                // Maybe invalidate *all* message queries as a last resort?
                // queryClient.invalidateQueries({ queryKey: [{ _id: 'getChatsByChatIdMessages' }] }); // Prefix might work
            }
        },
        onError: (error) => commonErrorHandler(error as unknown as Error),
    });
}

export function useForkChat() {
    const queryClient = useQueryClient();
    const mutationOptions = postChatsByChatIdForkMutation();

    // Input includes chatId and optional body (excludedMessageIds)
    return useMutation<PostChatsByChatIdForkResponse, PostChatsByChatIdForkError, { chatId: string; body: ForkChatRequestBody }>({
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

export function useForkChatFromMessage() {
    const queryClient = useQueryClient();
    const mutationOptions = postChatsByChatIdForkByMessageIdMutation();

    // Input includes chatId, messageId, and optional body
    return useMutation<PostChatsByChatIdForkByMessageIdResponse, PostChatsByChatIdForkByMessageIdError, { chatId: string; messageId: string; body: ForkChatFromMessageRequestBody }>({
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


export function useDeleteMessage() {
    const queryClient = useQueryClient();
    const mutationOptions = deleteMessagesByMessageIdMutation();

    // Input is messageId string
    return useMutation<DeleteMessagesByMessageIdResponse, DeleteMessagesByMessageIdError, string>({
        mutationFn: (messageId: string) => {
            const opts: Options<DeleteMessagesByMessageIdData> = { path: { messageId } };
            return mutationOptions.mutationFn!(opts);
        },
        onSuccess: (data, variables, context) => {
            console.warn("Message deleted, but cache invalidation might need specific logic based on chatId.");
        },
        onError: (error) => commonErrorHandler(error as unknown as Error),
    });
}

export function useGetModels(provider: APIProviders) {
    const queryOptions = getModelsOptions({ query: { provider, } });
    return useQuery(queryOptions);
}