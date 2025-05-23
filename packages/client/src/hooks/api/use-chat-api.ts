import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { commonErrorHandler } from './common-mutation-error-handler'
import {
  getApiChatsOptions,
  getApiChatsQueryKey,
  getApiChatsByChatIdMessagesOptions,
  getApiChatsByChatIdMessagesQueryKey,
  postApiChatsMutation,
  patchApiChatsByChatIdMutation,
  deleteApiChatsByChatIdMutation,
  postApiChatsByChatIdForkMutation,
  postApiChatsByChatIdForkByMessageIdMutation,
  deleteApiChatsByChatIdMessagesByMessageIdMutation,
  getApiModelsOptions
} from '../../generated/@tanstack/react-query.gen'
import type {
  PostApiChatsData,
  PostApiChatsError,
  GetApiChatsByChatIdMessagesData,
  PatchApiChatsByChatIdData,
  PatchApiChatsByChatIdError,
  DeleteApiChatsByChatIdData,
  DeleteApiChatsByChatIdError,
  PostApiChatsByChatIdForkData,
  PostApiChatsByChatIdForkError,
  PostApiChatsByChatIdForkByMessageIdData,
  PostApiChatsByChatIdForkByMessageIdError,
  ForkChatRequestBody,
  ForkChatFromMessageRequestBody,
  DeleteApiChatsByChatIdMessagesByMessageIdData,
  DeleteApiChatsByChatIdMessagesByMessageIdError,
  GetApiModelsData,
  PostApiChatsResponse,
  PatchApiChatsByChatIdResponse,
  DeleteApiChatsByChatIdResponse,
  PostApiChatsByChatIdForkResponse,
  PostApiChatsByChatIdForkByMessageIdResponse,
  DeleteApiChatsByChatIdMessagesByMessageIdResponse,

} from '../../generated/types.gen'
import { Options } from '../../generated/sdk.gen'
import { APIProviders } from 'shared/src/schemas/provider-key.schemas'
import { createChatEndpointApiChatsPostMutation, getAllChatsEndpointApiChatsGetOptions } from '@/generated-python/@tanstack/react-query.gen'
import { CreateChatBody, CreateChatEndpointApiChatsPostData, CreateChatEndpointApiChatsPostResponse } from '@/generated-python'

export type CreateChatInput = PostApiChatsData['body']
export type UpdateChatInput = PatchApiChatsByChatIdData['body']

const CHAT_KEYS = {
  all: () => getApiChatsQueryKey(),
  lists: () => getApiChatsQueryKey(),
  messages: (chatId: string) =>
    getApiChatsByChatIdMessagesQueryKey({ path: { chatId } } as Options<GetApiChatsByChatIdMessagesData>)
} as const

export function useGetChats() {
  const queryOptions = getAllChatsEndpointApiChatsGetOptions()

  return useQuery(queryOptions)
}

export function useGetMessages(chatId: string) {
  const queryOptions = getApiChatsByChatIdMessagesOptions({ path: { chatId } } as Options<GetApiChatsByChatIdMessagesData>)
  return useQuery({
    ...queryOptions,
    enabled: !!chatId
  })
}

export function useCreateChat() {
  const queryClient = useQueryClient()
  const mutationOptions = createChatEndpointApiChatsPostMutation() // Get the generated mutation config

  // Using generated types for better type safety
  return useMutation<CreateChatEndpointApiChatsPostResponse, PostApiChatsError, CreateChatBody>({
    // Input is the body
    mutationFn: (body: CreateChatBody) => {
      const opts: Options<CreateChatEndpointApiChatsPostData> = { body }
      return mutationOptions.mutationFn!(opts) // Call generated function
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: CHAT_KEYS.all() })
      // Optionally call original onSuccess if it existed or is needed
      // mutationOptions.onSuccess?.(data, variables, context);
    },
    onError: (error) => commonErrorHandler(error as unknown as Error) // Cast error type
  })
}

export function useUpdateChat() {
  const queryClient = useQueryClient()
  const mutationOptions = patchApiChatsByChatIdMutation()

  // Input includes chatId for path and data for body
  return useMutation<PatchApiChatsByChatIdResponse, PatchApiChatsByChatIdError, { chatId: string; data: UpdateChatInput }>({
    mutationFn: (vars: { chatId: string; data: UpdateChatInput }) => {
      const opts: Options<PatchApiChatsByChatIdData> = { path: { chatId: vars.chatId }, body: vars.data }
      return mutationOptions.mutationFn!(opts)
    },
    onSuccess: (data, variables, context) => {
      const chatId = variables.chatId
      // Invalidate all chats as title might appear in the list
      queryClient.invalidateQueries({ queryKey: CHAT_KEYS.all() })
      // Optionally invalidate messages if needed, though only title changed
      // queryClient.invalidateQueries({ queryKey: CHAT_KEYS.messages(chatId) });
    },
    onError: (error) => commonErrorHandler(error as unknown as Error)
  })
}

export function useDeleteChat() {
  const queryClient = useQueryClient()
  const mutationOptions = deleteApiChatsByChatIdMutation()

  // Input is just the chatId string
  return useMutation<DeleteApiChatsByChatIdResponse, DeleteApiChatsByChatIdError, string>({
    mutationFn: (chatId: string) => {
      const opts: Options<DeleteApiChatsByChatIdData> = { path: { chatId } }
      return mutationOptions.mutationFn!(opts)
    },
    onSuccess: (data, variables, context) => {
      const chatId = variables
      if (chatId) {
        queryClient.invalidateQueries({ queryKey: getApiChatsByChatIdMessagesQueryKey({ path: { chatId } }) })
      } else {
        console.warn(`useDeleteChat: Could not invalidate messages for chat ${chatId}, chatId missing.`)
      }
    },
    onError: (error) => commonErrorHandler(error as unknown as Error)
  })
}

export function useForkChat() {
  const queryClient = useQueryClient()
  const mutationOptions = postApiChatsByChatIdForkMutation()

  // Input includes chatId and optional body (excludedMessageIds)
  return useMutation<
    PostApiChatsByChatIdForkResponse,
    PostApiChatsByChatIdForkError,
    { chatId: string; body: ForkChatRequestBody }
  >({
    mutationFn: (vars: { chatId: string; body: ForkChatRequestBody }) => {
      const opts: Options<PostApiChatsByChatIdForkData> = { path: { chatId: vars.chatId }, body: vars.body }
      return mutationOptions.mutationFn!(opts)
    },
    onSuccess: (data, variables, context) => {
      // Invalidate all chats because a new one was created
      queryClient.invalidateQueries({ queryKey: CHAT_KEYS.all() })
    },
    onError: (error) => commonErrorHandler(error as unknown as Error)
  })
}

export function useForkChatFromMessage() {
  const queryClient = useQueryClient()
  const mutationOptions = postApiChatsByChatIdForkByMessageIdMutation()

  // Input includes chatId, messageId, and optional body
  return useMutation<
    PostApiChatsByChatIdForkByMessageIdResponse,
    PostApiChatsByChatIdForkByMessageIdError,
    { chatId: string; messageId: string; body: ForkChatFromMessageRequestBody }
  >({
    mutationFn: (vars: { chatId: string; messageId: string; body: ForkChatFromMessageRequestBody }) => {
      const opts: Options<PostApiChatsByChatIdForkByMessageIdData> = {
        path: { chatId: vars.chatId, messageId: vars.messageId },
        body: vars.body
      }
      return mutationOptions.mutationFn!(opts)
    },
    onSuccess: (data, variables, context) => {
      // Invalidate all chats because a new one was created
      queryClient.invalidateQueries({ queryKey: CHAT_KEYS.all() })
    },
    onError: (error) => commonErrorHandler(error as unknown as Error)
  })
}

export function useDeleteMessage() {
  const queryClient = useQueryClient()
  const mutationOptions = deleteApiChatsByChatIdMessagesByMessageIdMutation()

  // Input is messageId string
  return useMutation<DeleteApiChatsByChatIdMessagesByMessageIdResponse, DeleteApiChatsByChatIdMessagesByMessageIdError, { chatId: string; messageId: string }>({
    mutationFn: (vars: { chatId: string; messageId: string }) => {
      const opts: Options<DeleteApiChatsByChatIdMessagesByMessageIdData> = { path: { chatId: vars.chatId, messageId: vars.messageId } }
      return mutationOptions.mutationFn!(opts)
    },
    onSuccess: (data, variables, context) => {
      console.warn('Message deleted, but cache invalidation might need specific logic based on chatId.')
    },
    onError: (error) => commonErrorHandler(error as unknown as Error)
  })
}

export function useGetModels(provider: APIProviders) {
  const queryOptions = getApiModelsOptions({ query: { provider } })
  return useQuery(queryOptions)
}
