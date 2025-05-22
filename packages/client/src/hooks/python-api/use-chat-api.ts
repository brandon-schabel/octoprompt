import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { commonErrorHandler } from './common-mutation-error-handler'
import {
    getAllChatsEndpointApiChatsGetOptions, // Updated name
    getAllChatsEndpointApiChatsGetQueryKey, // Updated name
    getChatMessagesEndpointApiChatsChatIdMessagesGetOptions, // Updated name
    getChatMessagesEndpointApiChatsChatIdMessagesGetQueryKey, // Updated name
    createChatEndpointApiChatsPostMutation, // Updated name
    updateChatEndpointApiChatsChatIdPatchMutation, // Updated name
    deleteChatEndpointApiChatsChatIdDeleteMutation, // Updated name
    forkChatEndpointApiChatsChatIdForkPostMutation, // Updated name
    forkChatFromMessageEndpointApiChatsChatIdForkMessageIdPostMutation, // Updated name
    deleteMessageEndpointApiChatsChatIdMessagesMessageIdDeleteMutation, // Updated name
    getModelsEndpointApiModelsGetOptions // Updated name
} from '../../generated-python/@tanstack/react-query.gen' // Ensure path
import type {
    CreateChatEndpointApiChatsPostData, // Updated name
    CreateChatEndpointApiChatsPostError, // Updated name
    CreateChatEndpointApiChatsPostResponse, // Updated name
    GetChatMessagesEndpointApiChatsChatIdMessagesGetData, // Updated name
    UpdateChatEndpointApiChatsChatIdPatchData, // Updated name
    UpdateChatEndpointApiChatsChatIdPatchError, // Updated name
    UpdateChatEndpointApiChatsChatIdPatchResponse, // Updated name
    DeleteChatEndpointApiChatsChatIdDeleteData, // Updated name
    DeleteChatEndpointApiChatsChatIdDeleteError, // Updated name
    DeleteChatEndpointApiChatsChatIdDeleteResponse, // Updated name
    ForkChatEndpointApiChatsChatIdForkPostData, // Updated name
    ForkChatEndpointApiChatsChatIdForkPostError, // Updated name
    ForkChatEndpointApiChatsChatIdForkPostResponse, // Updated name
    ForkChatFromMessageEndpointApiChatsChatIdForkMessageIdPostData, // Updated name
    ForkChatFromMessageEndpointApiChatsChatIdForkMessageIdPostError, // Updated name
    ForkChatFromMessageEndpointApiChatsChatIdForkMessageIdPostResponse, // Updated name
    // ForkChatRequestBody, // This should match ForkChatEndpointApiChatsChatIdForkPostData['body']
    // ForkChatFromMessageRequestBody, // This should match ForkChatFromMessageEndpointApiChatsChatIdForkMessageIdPostData['body']
    DeleteMessageEndpointApiChatsChatIdMessagesMessageIdDeleteData, // Updated name
    DeleteMessageEndpointApiChatsChatIdMessagesMessageIdDeleteError, // Updated name
    DeleteMessageEndpointApiChatsChatIdMessagesMessageIdDeleteResponse, // Updated name
    GetModelsEndpointApiModelsGetData, // Updated name
} from '../../generated-python/types.gen' // Ensure path
import { Options } from '../../generated-python/sdk.gen' // Ensure path
import { APIProviders } from 'shared/src/schemas/provider-key.schemas'

export type CreateChatInput = CreateChatEndpointApiChatsPostData['body']
export type UpdateChatInput = UpdateChatEndpointApiChatsChatIdPatchData['body']
export type ForkChatRequestBody = ForkChatEndpointApiChatsChatIdForkPostData['body']
export type ForkChatFromMessageRequestBody = ForkChatFromMessageEndpointApiChatsChatIdForkMessageIdPostData['body']


const CHAT_KEYS = {
    all: () => getAllChatsEndpointApiChatsGetQueryKey(), // Updated name
    lists: () => getAllChatsEndpointApiChatsGetQueryKey(), // Updated name
    messages: (chatId: string) =>
        getChatMessagesEndpointApiChatsChatIdMessagesGetQueryKey({ path: { chatId } } as Options<GetChatMessagesEndpointApiChatsChatIdMessagesGetData>) // Updated names
} as const

export function useGetChats() {
    const queryOptions = getAllChatsEndpointApiChatsGetOptions() // Updated name
    return useQuery(queryOptions)
}

export function useGetMessages(chatId: string) {
    const queryOptions = getChatMessagesEndpointApiChatsChatIdMessagesGetOptions({ path: { chatId } } as Options<GetChatMessagesEndpointApiChatsChatIdMessagesGetData>) // Updated names
    return useQuery({
        ...queryOptions,
        enabled: !!chatId
    })
}

export function useCreateChat() {
    const queryClient = useQueryClient()
    const mutationOptions = createChatEndpointApiChatsPostMutation() // Updated name

    return useMutation<CreateChatEndpointApiChatsPostResponse, CreateChatEndpointApiChatsPostError, CreateChatInput>({ // Updated types
        mutationFn: (body: CreateChatInput) => {
            const opts: Options<CreateChatEndpointApiChatsPostData> = { body } // Updated type
            return mutationOptions.mutationFn!(opts)
        },
        onSuccess: (data, variables, context) => {
            queryClient.invalidateQueries({ queryKey: CHAT_KEYS.all() })
        },
        onError: (error) => commonErrorHandler(error as unknown as Error)
    })
}

export function useUpdateChat() {
    const queryClient = useQueryClient()
    const mutationOptions = updateChatEndpointApiChatsChatIdPatchMutation() // Updated name

    return useMutation<UpdateChatEndpointApiChatsChatIdPatchResponse, UpdateChatEndpointApiChatsChatIdPatchError, { chatId: string; data: UpdateChatInput }>({ // Updated types
        mutationFn: (vars: { chatId: string; data: UpdateChatInput }) => {
            const opts: Options<UpdateChatEndpointApiChatsChatIdPatchData> = { path: { chatId: vars.chatId }, body: vars.data } // Updated type
            return mutationOptions.mutationFn!(opts)
        },
        onSuccess: (data, variables, context) => {
            const chatId = variables.chatId
            queryClient.invalidateQueries({ queryKey: CHAT_KEYS.all() })
            // queryClient.invalidateQueries({ queryKey: CHAT_KEYS.messages(chatId) }); // if title/metadata shown in messages view
        },
        onError: (error) => commonErrorHandler(error as unknown as Error)
    })
}

export function useDeleteChat() {
    const queryClient = useQueryClient()
    const mutationOptions = deleteChatEndpointApiChatsChatIdDeleteMutation() // Updated name

    return useMutation<DeleteChatEndpointApiChatsChatIdDeleteResponse, DeleteChatEndpointApiChatsChatIdDeleteError, string>({ // Updated types
        mutationFn: (chatId: string) => {
            const opts: Options<DeleteChatEndpointApiChatsChatIdDeleteData> = { path: { chatId } } // Updated type
            return mutationOptions.mutationFn!(opts)
        },
        onSuccess: (data, chatId, context) => { // variables is chatId here
            // Invalidate all chats list
            queryClient.invalidateQueries({ queryKey: CHAT_KEYS.all() });
            // Remove specific chat messages from cache
            queryClient.removeQueries({ queryKey: CHAT_KEYS.messages(chatId) });
        },
        onError: (error) => commonErrorHandler(error as unknown as Error)
    })
}

export function useForkChat() {
    const queryClient = useQueryClient()
    const mutationOptions = forkChatEndpointApiChatsChatIdForkPostMutation() // Updated name

    return useMutation<
        ForkChatEndpointApiChatsChatIdForkPostResponse, // Updated name
        ForkChatEndpointApiChatsChatIdForkPostError, // Updated name
        { chatId: string; body: ForkChatRequestBody }
    >({
        mutationFn: (vars: { chatId: string; body: ForkChatRequestBody }) => {
            const opts: Options<ForkChatEndpointApiChatsChatIdForkPostData> = { path: { chatId: vars.chatId }, body: vars.body } // Updated type
            return mutationOptions.mutationFn!(opts)
        },
        onSuccess: (data, variables, context) => {
            queryClient.invalidateQueries({ queryKey: CHAT_KEYS.all() })
        },
        onError: (error) => commonErrorHandler(error as unknown as Error)
    })
}

export function useForkChatFromMessage() {
    const queryClient = useQueryClient()
    const mutationOptions = forkChatFromMessageEndpointApiChatsChatIdForkMessageIdPostMutation() // Updated name

    return useMutation<
        ForkChatFromMessageEndpointApiChatsChatIdForkMessageIdPostResponse, // Updated name
        ForkChatFromMessageEndpointApiChatsChatIdForkMessageIdPostError, // Updated name
        { chatId: string; messageId: string; body: ForkChatFromMessageRequestBody }
    >({
        mutationFn: (vars: { chatId: string; messageId: string; body: ForkChatFromMessageRequestBody }) => {
            const opts: Options<ForkChatFromMessageEndpointApiChatsChatIdForkMessageIdPostData> = { // Updated type
                path: { chatId: vars.chatId, messageId: vars.messageId },
                body: vars.body
            }
            return mutationOptions.mutationFn!(opts)
        },
        onSuccess: (data, variables, context) => {
            queryClient.invalidateQueries({ queryKey: CHAT_KEYS.all() })
        },
        onError: (error) => commonErrorHandler(error as unknown as Error)
    })
}

export function useDeleteMessage() {
    const queryClient = useQueryClient()
    const mutationOptions = deleteMessageEndpointApiChatsChatIdMessagesMessageIdDeleteMutation() // Updated name

    return useMutation<DeleteMessageEndpointApiChatsChatIdMessagesMessageIdDeleteResponse, DeleteMessageEndpointApiChatsChatIdMessagesMessageIdDeleteError, { chatId: string; messageId: string }>({ // Updated types
        mutationFn: (vars: { chatId: string; messageId: string }) => {
            const opts: Options<DeleteMessageEndpointApiChatsChatIdMessagesMessageIdDeleteData> = { path: { chatId: vars.chatId, messageId: vars.messageId } } // Updated type
            return mutationOptions.mutationFn!(opts)
        },
        onSuccess: (data, variables, context) => {
            queryClient.invalidateQueries({ queryKey: CHAT_KEYS.messages(variables.chatId) })
        },
        onError: (error) => commonErrorHandler(error as unknown as Error)
    })
}

export function useGetModels(provider: APIProviders) { // Ensure APIProviders is compatible with query type
    const queryOptions = getModelsEndpointApiModelsGetOptions({ query: { provider } as Options<GetModelsEndpointApiModelsGetData>['query'] }) // Updated name, cast query for type safety
    return useQuery(queryOptions) // Response type is GetModelsEndpointApiModelsGetData
}