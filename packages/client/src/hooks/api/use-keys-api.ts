import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { commonErrorHandler } from './common-mutation-error-handler'
import {
  getApiKeysOptions,
  getApiKeysQueryKey,
  postApiKeysMutation,
  patchApiKeysByKeyIdMutation,
  deleteApiKeysByKeyIdMutation
} from '../../generated/@tanstack/react-query.gen'
import type {
  ProviderKeyListResponse,
  ProviderKeyResponse,
  PostApiKeysData,
  PostApiKeysError,
  PatchApiKeysByKeyIdData,
  PatchApiKeysByKeyIdError,
  DeleteApiKeysByKeyIdData,
  DeleteApiKeysByKeyIdError,
  DeleteApiKeysByKeyIdResponse,
  ProviderKey
} from '../../generated/types.gen'
import { Options } from '../../generated/sdk.gen'

export type CreateKeyInput = PostApiKeysData['body']
export type UpdateKeyInput = PatchApiKeysByKeyIdData['body']

const KEYS_KEYS = {
  all: () => getApiKeysQueryKey(),
  lists: () => getApiKeysQueryKey()
} as const

export function useGetKeys() {
  const queryOptions = getApiKeysOptions()
  return useQuery({
    ...queryOptions,

    select: (response: ProviderKeyListResponse) => {
      if (!response.success) {
        console.error('useGetKeys received unsuccessful response:', response)
        return []
      }
      return response.data
    }
  })
}

export function useCreateKey() {
  const queryClient = useQueryClient()
  const mutationOptions = postApiKeysMutation()

  return useMutation<ProviderKey, PostApiKeysError, CreateKeyInput>({
    mutationFn: async (body: CreateKeyInput) => {
      const opts: Options<PostApiKeysData> = { body }
      const response: ProviderKeyResponse = await mutationOptions.mutationFn!(opts)

      if (!response || !response.success || !response.data) {
        throw new Error('Failed to create key or key missing in response data')
      }
      return response.data
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: KEYS_KEYS.lists() })
    },
    onError: (error) => commonErrorHandler(error as unknown as Error)
  })
}

export function useUpdateKey() {
  const queryClient = useQueryClient()
  const mutationOptions = patchApiKeysByKeyIdMutation()

  return useMutation<ProviderKey, PatchApiKeysByKeyIdError, { keyId: string; data: UpdateKeyInput }>({
    mutationFn: async (vars: { keyId: string; data: UpdateKeyInput }) => {
      const opts: Options<PatchApiKeysByKeyIdData> = {
        path: { keyId: vars.keyId },
        body: vars.data
      }
      const response: ProviderKeyResponse = await mutationOptions.mutationFn!(opts)

      if (!response || !response.success || !response.data) {
        throw new Error('Failed to update key or key missing in response data')
      }
      return response.data
    },
    onSuccess: (data, variables, context) => {
      const keyId = variables.keyId
      queryClient.invalidateQueries({ queryKey: KEYS_KEYS.lists() })
    },
    onError: (error) => commonErrorHandler(error as unknown as Error)
  })
}

export function useDeleteKey() {
  const queryClient = useQueryClient()
  const mutationOptions = deleteApiKeysByKeyIdMutation()

  return useMutation<DeleteApiKeysByKeyIdResponse, DeleteApiKeysByKeyIdError, string>({
    mutationFn: (keyId: string) => {
      const opts: Options<DeleteApiKeysByKeyIdData> = { path: { keyId } }
      return mutationOptions.mutationFn!(opts)
    },
    onSuccess: (data, variables, context) => {
      if (!data.success) {
        console.warn('Delete operation reported success, but response flag is false:', data)
      }
      const keyId = variables
      queryClient.invalidateQueries({ queryKey: KEYS_KEYS.lists() })
    },
    onError: (error) => commonErrorHandler(error as unknown as Error)
  })
}
