import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { commonErrorHandler } from './common-mutation-error-handler'
import {
    listProviderKeysApiKeysGet,
    createProviderKeyApiKeysPost,
    updateProviderKeyApiKeysKeyIdPatch,
    deleteProviderKeyApiKeysKeyIdDelete
} from '../../generated-python/sdk.gen'
import type {
    ProviderKeyListResponse,
    ProviderKeyResponse,
    CreateProviderKeyApiKeysPostData,
    CreateProviderKeyApiKeysPostError,
    UpdateProviderKeyApiKeysKeyIdPatchData,
    UpdateProviderKeyApiKeysKeyIdPatchError,
    DeleteProviderKeyApiKeysKeyIdDeleteData,
    DeleteProviderKeyApiKeysKeyIdDeleteError,
    CreateProviderKeyBody,
    UpdateProviderKeyBody,
    ProviderKey
} from '../../generated-python/types.gen'
import { Options } from '../../generated-python/sdk.gen'

// Define the response type locally since it's missing from generated types
type OperationSuccessResponse = {
    success: true
    message: string
}

export type CreateKeyInput = CreateProviderKeyBody
export type UpdateKeyInput = UpdateProviderKeyBody

const KEYS_KEYS = {
    all: () => ['keys'] as const,
    lists: () => ['keys', 'list'] as const
} as const

export function useGetKeys() {
    return useQuery({
        queryKey: KEYS_KEYS.lists(),
        queryFn: async () => {
            const response = await listProviderKeysApiKeysGet()
            if ('data' in response && response.data) {
                return response.data
            }
            throw new Error('Failed to fetch keys')
        },
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

    return useMutation<ProviderKey, CreateProviderKeyApiKeysPostError, CreateKeyInput>({
        mutationFn: async (body: CreateKeyInput) => {
            const opts: Options<CreateProviderKeyApiKeysPostData> = { body }
            const response = await createProviderKeyApiKeysPost(opts)

            if ('data' in response && response.data && response.data.success && response.data.data) {
                return response.data.data
            }
            throw new Error('Failed to create key or key missing in response data')
        },
        onSuccess: (data, variables, context) => {
            queryClient.invalidateQueries({ queryKey: KEYS_KEYS.lists() })
        },
        onError: (error) => commonErrorHandler(error as unknown as Error)
    })
}

export function useUpdateKey() {
    const queryClient = useQueryClient()

    return useMutation<ProviderKey, UpdateProviderKeyApiKeysKeyIdPatchError, { keyId: string; data: UpdateKeyInput }>({
        mutationFn: async (vars: { keyId: string; data: UpdateKeyInput }) => {
            const opts: Options<UpdateProviderKeyApiKeysKeyIdPatchData> = {
                path: { keyId: vars.keyId },
                body: vars.data
            }
            const response = await updateProviderKeyApiKeysKeyIdPatch(opts)

            if ('data' in response && response.data && response.data.success && response.data.data) {
                return response.data.data
            }
            throw new Error('Failed to update key or key missing in response data')
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

    return useMutation<OperationSuccessResponse, DeleteProviderKeyApiKeysKeyIdDeleteError, string>({
        mutationFn: async (keyId: string) => {
            const opts: Options<DeleteProviderKeyApiKeysKeyIdDeleteData> = { path: { keyId } }
            const response = await deleteProviderKeyApiKeysKeyIdDelete(opts)

            if ('data' in response && response.data) {
                return response.data
            }
            throw new Error('Failed to delete key')
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
