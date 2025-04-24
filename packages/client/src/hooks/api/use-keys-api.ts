import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { commonErrorHandler } from './common-mutation-error-handler';
import {
    getApiKeysOptions,
    getApiKeysQueryKey,
    // getApiKeysByKeyIdOptions, // Optional
    // getApiKeysByKeyIdQueryKey, // Optional
    postApiKeysMutation,
    patchApiKeysByKeyIdMutation,
    deleteApiKeysByKeyIdMutation,
} from '../generated/@tanstack/react-query.gen';
import type {
    // Import response types which likely follow { success: boolean, data: ... }
    ProviderKeyListResponse, // Expect: { success: boolean, data: ProviderKey[] }
    ProviderKeyResponse,     // Expect: { success: boolean, data: ProviderKey }
    // Import data/payload types
    PostApiKeysData,
    PostApiKeysError,
    PatchApiKeysByKeyIdData,
    PatchApiKeysByKeyIdError,
    DeleteApiKeysByKeyIdData,
    DeleteApiKeysByKeyIdError,
    DeleteApiKeysByKeyIdResponse,
    // Import the core entity type
    ProviderKey,
    // GetApiKeysByKeyIdData, // Optional
} from '../generated/types.gen'; // Adjust path if needed
import { Options } from '../generated/sdk.gen'; // Adjust path if needed

// Define input types based on generated request body types
export type CreateKeyInput = PostApiKeysData['body'];
export type UpdateKeyInput = PatchApiKeysByKeyIdData['body'];

// Define Query Keys using generated functions
const KEYS_KEYS = {
    all: () => getApiKeysQueryKey(),
    lists: () => getApiKeysQueryKey(),
    // detail: (keyId: string) => getApiKeysByKeyIdQueryKey({ path: { keyId } } as Options<GetApiKeysByKeyIdData>), // Optional
} as const;

// --- Query Hooks ---

// Get all provider keys
export function useGetKeys() {
    const queryOptions = getApiKeysOptions();
    return useQuery({
        ...queryOptions,
        // The response ('data' fed into select) is ProviderKeyListResponse
        // which has the structure { success: boolean, data: ProviderKey[] }
        // Select the 'data' property which holds the array of keys.
        select: (response: ProviderKeyListResponse) => {
            // Add a check for safety, although react-query usually throws on error status codes
            if (!response.success) {
                console.error("useGetKeys received unsuccessful response:", response);
                return []; // Or throw an error
            }
            return response.data; // Access the array via response.data
        },
    });
}

// Optional: Hook to get a single key by ID
// export function useGetKey(keyId: string) {
//     const queryOptions = getApiKeysByKeyIdOptions({ path: { keyId } } as Options<GetApiKeysByKeyIdData>);
//     return useQuery({
//         ...queryOptions,
//         enabled: !!keyId,
//         // Select the 'data' property which holds the single key object
//         select: (response: ProviderKeyResponse) => {
//             if (!response.success) {
//                 console.error("useGetKey received unsuccessful response:", response);
//                 throw new Error("Failed to fetch key"); // Or return null/undefined
//             }
//            return response.data;
//         }
//     });
// }

// --- Mutation Hooks ---

// Create a new provider key
export function useCreateKey() {
    const queryClient = useQueryClient();
    const mutationOptions = postApiKeysMutation();

    // Result expected is ProviderKey based on original hook.
    // The mutation function returns ProviderKeyResponse { success: boolean, data: ProviderKey }
    return useMutation<ProviderKey, PostApiKeysError, CreateKeyInput>({
        mutationFn: async (body: CreateKeyInput) => {
            const opts: Options<PostApiKeysData> = { body };
            // The actual response from the API call
            const response: ProviderKeyResponse = await mutationOptions.mutationFn!(opts);

            // Check the success flag and presence of data property
            if (!response || !response.success || !response.data) {
                // Throw an error that commonErrorHandler can potentially handle,
                // or based on API spec, the error might already be thrown by react-query/sdk
                throw new Error('Failed to create key or key missing in response data');
            }
            // Return the ProviderKey object from the 'data' property
            return response.data;
        },
        onSuccess: (data, variables, context) => {
            queryClient.invalidateQueries({ queryKey: KEYS_KEYS.lists() });
        },
        onError: (error) => commonErrorHandler(error as unknown as Error),
    });
}

// Update an existing provider key
export function useUpdateKey() {
    const queryClient = useQueryClient();
    const mutationOptions = patchApiKeysByKeyIdMutation();

    // Input needs keyId and data. Result expected is ProviderKey.
    // Mutation returns ProviderKeyResponse { success: boolean, data: ProviderKey }
    return useMutation<ProviderKey, PatchApiKeysByKeyIdError, { keyId: string; data: UpdateKeyInput }>({
        mutationFn: async (vars: { keyId: string; data: UpdateKeyInput }) => {
            const opts: Options<PatchApiKeysByKeyIdData> = {
                path: { keyId: vars.keyId },
                body: vars.data
            };
            // Actual API response
            const response: ProviderKeyResponse = await mutationOptions.mutationFn!(opts);

            // Check success flag and data property
            if (!response || !response.success || !response.data) {
                throw new Error('Failed to update key or key missing in response data');
            }
            // Return the updated ProviderKey object from the 'data' property
            return response.data;
        },
        onSuccess: (data, variables, context) => {
            const keyId = variables.keyId;
            queryClient.invalidateQueries({ queryKey: KEYS_KEYS.lists() });
            // Optional: Invalidate detail query
            // queryClient.invalidateQueries({ queryKey: KEYS_KEYS.detail(keyId) });
        },
        onError: (error) => commonErrorHandler(error as unknown as Error),
    });
}

// Delete a provider key
export function useDeleteKey() {
    const queryClient = useQueryClient();
    const mutationOptions = deleteApiKeysByKeyIdMutation();

    // Using DeleteApiKeysByKeyIdResponse which likely follows { success: boolean, message?: string }
    return useMutation<DeleteApiKeysByKeyIdResponse, DeleteApiKeysByKeyIdError, string>({
        mutationFn: (keyId: string) => {
            const opts: Options<DeleteApiKeysByKeyIdData> = { path: { keyId } };
            // Response here might just be { success: true } or similar
            return mutationOptions.mutationFn!(opts);
        },
        onSuccess: (data, variables, context) => {
            // Check success flag from response if needed
            if (!data.success) {
                console.warn("Delete operation reported success, but response flag is false:", data);
                // Decide if this should be an error or just a warning
            }
            const keyId = variables;
            queryClient.invalidateQueries({ queryKey: KEYS_KEYS.lists() });
            // Optional: Remove detail query
            // queryClient.removeQueries({ queryKey: KEYS_KEYS.detail(keyId) });
        },
        onError: (error) => commonErrorHandler(error as unknown as Error),
    });
}