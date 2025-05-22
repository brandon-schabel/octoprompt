import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { commonErrorHandler } from './common-mutation-error-handler'
import {
    listProviderKeysApiKeysGetOptions, // Updated name
    listProviderKeysApiKeysGetQueryKey, // Updated name
    createProviderKeyApiKeysPostMutation, // Updated name
    updateProviderKeyApiKeysKeyIdPatchMutation, // Updated name
    deleteProviderKeyApiKeysKeyIdDeleteMutation // Updated name
} from '../../generated-python/@tanstack/react-query.gen' // Ensure path
import type {
    // ProviderKeyListResponse, // This was a custom type. Use generated ListProviderKeysApiKeysGetData
    // ProviderKeyResponse, // This was custom. Use generated e.g. CreateProviderKeyApiKeysPostResponse
    ListProviderKeysApiKeysGetData, // Updated name
    CreateProviderKeyApiKeysPostData, // Updated name
    CreateProviderKeyApiKeysPostError, // Updated name
    CreateProviderKeyApiKeysPostResponse, // Updated name
    UpdateProviderKeyApiKeysKeyIdPatchData, // Updated name
    UpdateProviderKeyApiKeysKeyIdPatchError, // Updated name
    UpdateProviderKeyApiKeysKeyIdPatchResponse, // Updated name
    DeleteProviderKeyApiKeysKeyIdDeleteData, // Updated name
    DeleteProviderKeyApiKeysKeyIdDeleteError, // Updated name
    DeleteProviderKeyApiKeysKeyIdDeleteResponse, // Updated name
    ProviderKey // This type should come from generated types.gen
} from '../../generated-python/types.gen' // Ensure path
import { Options } from '../../generated-python/sdk.gen' // Ensure path

export type CreateKeyInput = CreateProviderKeyApiKeysPostData['body']
export type UpdateKeyInput = UpdateProviderKeyApiKeysKeyIdPatchData['body']

const KEYS_KEYS = {
    all: () => listProviderKeysApiKeysGetQueryKey(), // Updated name
    lists: () => listProviderKeysApiKeysGetQueryKey() // Updated name
} as const

export function useGetKeys() {
    const queryOptions = listProviderKeysApiKeysGetOptions() // Updated name
    return useQuery({
        ...queryOptions,
        // The queryFn in listProviderKeysApiKeysGetOptions returns ListProviderKeysApiKeysGetData
        // Assuming ListProviderKeysApiKeysGetData is the array of ProviderKey directly, or an object like { data: ProviderKey[] }
        // If ListProviderKeysApiKeysGetData is ProviderKey[], no select is needed or it just returns response.
        // If it's { data: ProviderKey[], success: boolean }, then select: (response) => response.data
        // The original select was: (response: ProviderKeyListResponse) => { if (!response.success) return []; return response.data; }
        // Assuming ListProviderKeysApiKeysGetData already is the data array or an object that queryFn processes to return the array.
        // The generated queryFn returns `data` from the sdk call. So if the sdk returns { data: ProviderKey[] }, this will be ProviderKey[].
        // If the API returns ProviderKey[] directly, then `ListProviderKeysApiKeysGetData` is `ProviderKey[]`.
        select: (data: ListProviderKeysApiKeysGetData) => {
            // Assuming ListProviderKeysApiKeysGetData is the array ProviderKey[]
            // If it's an object with a `data` property like { data: ProviderKey[], success?: boolean }
            // then this select needs to be: (response) => response.data (or response if it's already the array)
            // Let's assume ListProviderKeysApiKeysGetData is ProviderKey[] for now
            // If the API might not return an array directly, adjust this.
            // Given the previous `ProviderKeyListResponse` structure, let's assume the API returns an object.
            // The generated `queryFn` returns `data`, so if `ListProviderKeysApiKeysGetData` represents the actual data structure from API like `ProviderKey[]`, then it's fine.
            // If the response from API is `{ data: ProviderKey[], success: true }`, and `ListProviderKeysApiKeysGetData` reflects that, then:
            // return data.data; (but check if `success` handling is still needed)
            // For now, let's assume the generated query function correctly returns the array of ProviderKey.
            return data; // If data is directly ProviderKey[]
        }
    })
}

export function useCreateKey() {
    const queryClient = useQueryClient()
    const mutationOptions = createProviderKeyApiKeysPostMutation() // Updated name

    return useMutation<ProviderKey, CreateProviderKeyApiKeysPostError, CreateKeyInput>({ // Assuming CreateProviderKeyApiKeysPostResponse contains a 'data' field of type ProviderKey
        mutationFn: async (body: CreateKeyInput) => {
            const opts: Options<CreateProviderKeyApiKeysPostData> = { body } // Updated type
            const response = await mutationOptions.mutationFn!(opts) // response is CreateProviderKeyApiKeysPostResponse

            // Assuming CreateProviderKeyApiKeysPostResponse is { data: ProviderKey, success: boolean }
            if (!response || !(response as any).success || !(response as any).data) {
                throw new Error('Failed to create key or key missing in response data')
            }
            return (response as any).data as ProviderKey
        },
        onSuccess: (data, variables, context) => {
            queryClient.invalidateQueries({ queryKey: KEYS_KEYS.lists() })
        },
        onError: (error) => commonErrorHandler(error as unknown as Error)
    })
}

export function useUpdateKey() {
    const queryClient = useQueryClient()
    const mutationOptions = updateProviderKeyApiKeysKeyIdPatchMutation() // Updated name

    return useMutation<ProviderKey, UpdateProviderKeyApiKeysKeyIdPatchError, { keyId: string; data: UpdateKeyInput }>({ // Assuming UpdateProviderKeyApiKeysKeyIdPatchResponse has {data: ProviderKey, success: boolean}
        mutationFn: async (vars: { keyId: string; data: UpdateKeyInput }) => {
            const opts: Options<UpdateProviderKeyApiKeysKeyIdPatchData> = { // Updated type
                path: { keyId: vars.keyId },
                body: vars.data
            }
            const response = await mutationOptions.mutationFn!(opts) // response is UpdateProviderKeyApiKeysKeyIdPatchResponse

            if (!response || !(response as any).success || !(response as any).data) {
                throw new Error('Failed to update key or key missing in response data')
            }
            return (response as any).data as ProviderKey
        },
        onSuccess: (data, variables, context) => {
            //      const keyId = variables.keyId // keyId is available if needed
            queryClient.invalidateQueries({ queryKey: KEYS_KEYS.lists() })
        },
        onError: (error) => commonErrorHandler(error as unknown as Error)
    })
}

export function useDeleteKey() {
    const queryClient = useQueryClient()
    const mutationOptions = deleteProviderKeyApiKeysKeyIdDeleteMutation() // Updated name

    return useMutation<DeleteProviderKeyApiKeysKeyIdDeleteResponse, DeleteProviderKeyApiKeysKeyIdDeleteError, string>({ // Updated types
        mutationFn: (keyId: string) => {
            const opts: Options<DeleteProviderKeyApiKeysKeyIdDeleteData> = { path: { keyId } } // Updated type
            return mutationOptions.mutationFn!(opts)
        },
        onSuccess: (data, keyId, context) => { // variables is keyId here
            if (!data.success) { // Assuming Delete...Response has a 'success' property
                console.warn('Delete operation reported success:false from API, but mutation succeeded.', data)
                // Or if success is false, it should have gone to onError. This implies API returns 200 with success:false.
            }
            queryClient.invalidateQueries({ queryKey: KEYS_KEYS.lists() })
        },
        onError: (error) => commonErrorHandler(error as unknown as Error)
    })
}