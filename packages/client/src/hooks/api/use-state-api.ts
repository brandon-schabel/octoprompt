// src/hooks/api/use-state-api.ts (Updated)

import { useQuery, useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import { commonErrorHandler } from './common-mutation-error-handler'; // Adjust path if needed
import {
    // State Getters
    getApiStateOptions,
    getApiStateQueryKey,
    // State Setters (Specific)
    postApiStateSettingsMutation,
    postApiStateActiveProjectTabMutation,
    postApiStateActiveChatMutation,
    postApiStateProjectTabsMutation, // Add new tab
    postApiStateProjectTabsByTabIdMutation, // Update specific tab
    deleteApiStateProjectTabsByTabIdMutation, // Delete specific tab
    // postApiStateProjectTabsReplaceAllMutation, // Potentially useful? (Keep commented for now)
    // State Setters (Full Replace - Keep if needed)
    putApiStateMutation,
    // Generic Partial Update (Deprecate in favor of specific ones)
    // postApiStateUpdateMutation, // We aim to replace usages of this
} from '../generated/@tanstack/react-query.gen'; // Adjust path
import type {
    // General State Types
    GetApiStateResponse,
    GlobalState,
    // Specific Setter Payloads/Responses (Import what's needed based on generated types)
    PostApiStateSettingsData,
    PostApiStateSettingsResponse,
    PostApiStateSettingsError,
    PostApiStateActiveProjectTabData,
    PostApiStateActiveProjectTabResponse,
    PostApiStateActiveProjectTabError,
    PostApiStateActiveChatData,
    PostApiStateActiveChatResponse,
    PostApiStateActiveChatError,
    PostApiStateProjectTabsData, // For adding a new tab
    PostApiStateProjectTabsResponse,
    PostApiStateProjectTabsError,
    PostApiStateProjectTabsByTabIdData, // For updating a specific tab
    PostApiStateProjectTabsByTabIdResponse,
    PostApiStateProjectTabsByTabIdError,
    DeleteApiStateProjectTabsByTabIdData, // For deleting a specific tab
    DeleteApiStateProjectTabsByTabIdResponse,
    DeleteApiStateProjectTabsByTabIdError,
    // PostApiStateProjectTabsReplaceAllData, // If using replace all
    // PostApiStateProjectTabsReplaceAllResponse,
    // PostApiStateProjectTabsReplaceAllError,
    PutApiStateData, // For full replace
    PutApiStateError,
    PutApiStateResponse,
    ReplaceStateBody,
    // Types needed by updaters
    AppSettings,
    ProjectTabState,
} from '../generated/types.gen'; // Adjust path
import { Options } from '../generated';

// --- State Getter (Keep as is) ---
export function useGetState() {
    const queryOptions = getApiStateOptions();
    return useQuery<
        GetApiStateResponse, // Contains { success: boolean, data: GlobalState }
        Error,
        GetApiStateResponse,
        ReturnType<typeof getApiStateQueryKey>
    >({
        ...queryOptions, // Includes queryKey and queryFn
        refetchOnWindowFocus: true, // Keep or adjust as needed
        // staleTime: 1000 * 60 * 5, // Example: 5 minutes stale time
    });
}

// --- State Update Handler (Common Logic) ---
// Helper to update cache on success for all state mutations
const handleStateMutationSuccess = (
    queryClient: ReturnType<typeof useQueryClient>,
    // Type the data based on the expected *Response* type from specific mutations
    // All specific mutations should return a response containing the full GlobalState
    data: { success?: boolean; data?: GlobalState } | undefined
) => {
    if (data?.success && data.data) {
        console.log("State mutation successful, updating cache.", data.data);
        // Directly set the cache with the latest full state from the server response
        queryClient.setQueryData(getApiStateQueryKey(), { success: true, data: data.data });
    } else {
        // Fallback to invalidation if response format is unexpected or update failed partially
        console.warn("State mutation response invalid or success=false, invalidating cache.", data);
        queryClient.invalidateQueries({ queryKey: getApiStateQueryKey() });
    }
};

// --- Specific State Mutation Hooks ---

/**
 * Mutation hook to update the entire AppSettings object.
 */
export function useUpdateSettingsMutation(
    options?: UseMutationOptions<PostApiStateSettingsResponse, PostApiStateSettingsError, AppSettings>
) {
    const queryClient = useQueryClient();
    const mutationGenOptions = postApiStateSettingsMutation();

    return useMutation<PostApiStateSettingsResponse, PostApiStateSettingsError, AppSettings>({
        mutationFn: async (settings: AppSettings) => {
            const opts: Options<PostApiStateSettingsData> = { body: settings };
            if (!mutationGenOptions.mutationFn) {
                throw new Error("Mutation function not available for postApiStateSettings");
            }
            // The generated mutationFn expects Options<Data>, which includes the body
            return await mutationGenOptions.mutationFn(opts);
        },
        onSuccess: (data, variables, context) => {
            handleStateMutationSuccess(queryClient, data);
            options?.onSuccess?.(data, variables, context);
        },
        onError: (error, variables, context) => {
            commonErrorHandler(error as unknown as Error);
            queryClient.invalidateQueries({ queryKey: getApiStateQueryKey() }); // Invalidate on error
            options?.onError?.(error, variables, context);
        },
        // Allow overriding other mutation options
        ...options,
    });
}

/**
 * Mutation hook to set the active project tab ID.
 */
export function useSetActiveProjectTabMutation(
    options?: UseMutationOptions<PostApiStateActiveProjectTabResponse, PostApiStateActiveProjectTabError, string | null>
) {
    const queryClient = useQueryClient();
    const mutationGenOptions = postApiStateActiveProjectTabMutation();

    return useMutation<PostApiStateActiveProjectTabResponse, PostApiStateActiveProjectTabError, string | null>({
        mutationFn: async (tabId: string | null) => {
            // The generated type PostApiStateActiveProjectTabData likely expects { body: { activeTabId: string | null } }
            const opts: Options<PostApiStateActiveProjectTabData> = { body: { tabId: tabId ?? 'no-tab-id' } };
            if (!mutationGenOptions.mutationFn) {
                throw new Error("Mutation function not available for postApiStateActiveProjectTab");
            }
            return await mutationGenOptions.mutationFn(opts);
        },
        onSuccess: (data, variables, context) => {
            handleStateMutationSuccess(queryClient, data);
            options?.onSuccess?.(data, variables, context);
        },
        onError: (error, variables, context) => {
            commonErrorHandler(error as unknown as Error);
            queryClient.invalidateQueries({ queryKey: getApiStateQueryKey() });
            options?.onError?.(error, variables, context);
        },
        ...options,
    });
}

/**
 * Mutation hook to set the active chat ID.
 */
export function useSetActiveChatMutation(
    options?: UseMutationOptions<PostApiStateActiveChatResponse, PostApiStateActiveChatError, string | null>
) {
    const queryClient = useQueryClient();
    const mutationGenOptions = postApiStateActiveChatMutation();

    return useMutation<PostApiStateActiveChatResponse, PostApiStateActiveChatError, string | null>({
        mutationFn: async (chatId: string | null) => {
            // The generated type PostApiStateActiveChatData likely expects { body: { activeChatId: string | null } }
            const opts: Options<PostApiStateActiveChatData> = {
                body: { chatId: chatId ?? 'no-chat-id' }
            };
            if (!mutationGenOptions.mutationFn) {
                throw new Error("Mutation function not available for postApiStateActiveChat");
            }
            return await mutationGenOptions.mutationFn(opts);
        },
        onSuccess: (data, variables, context) => {
            handleStateMutationSuccess(queryClient, data);
            options?.onSuccess?.(data, variables, context);
        },
        onError: (error, variables, context) => {
            commonErrorHandler(error as unknown as Error);
            queryClient.invalidateQueries({ queryKey: getApiStateQueryKey() });
            options?.onError?.(error, variables, context);
        },
        ...options,
    });
}

/**
 * Mutation hook to add a new project tab.
 * Assumes the body should contain the full ProjectTabState for the new tab.
 * The backend should handle assigning an ID if not provided or use the one in the state.
 * IMPORTANT: Check if your backend expects the *full* ProjectTabState object or just specific fields on creation.
 */
export function useCreateProjectTabMutation(
    options?: UseMutationOptions<PostApiStateProjectTabsResponse, PostApiStateProjectTabsError, ProjectTabState>
) {
    const queryClient = useQueryClient();
    const mutationGenOptions = postApiStateProjectTabsMutation();

    return useMutation<PostApiStateProjectTabsResponse, PostApiStateProjectTabsError, ProjectTabState>({
        mutationFn: async (newTabData: ProjectTabState) => {
            // The generated type PostApiStateProjectTabsData likely expects { body: ProjectTabState }
            const opts: Options<PostApiStateProjectTabsData> = { body: { ...newTabData, projectId: 'no-project-id' } };
            if (!mutationGenOptions.mutationFn) {
                throw new Error("Mutation function not available for postApiStateProjectTabs");
            }
            return await mutationGenOptions.mutationFn(opts);
        },
        onSuccess: (data, variables, context) => {
            handleStateMutationSuccess(queryClient, data);
            options?.onSuccess?.(data, variables, context);
        },
        onError: (error, variables, context) => {
            commonErrorHandler(error as unknown as Error);
            queryClient.invalidateQueries({ queryKey: getApiStateQueryKey() });
            options?.onError?.(error, variables, context);
        },
        ...options,
    });
}

/**
 * Input type for updating a specific project tab.
 */
export interface UpdateProjectTabVariables {
    tabId: string;
    partial: Partial<ProjectTabState>;
}

/**
 * Mutation hook to update a specific project tab using its ID.
 */
export function useUpdateProjectTabMutation(
    options?: UseMutationOptions<PostApiStateProjectTabsByTabIdResponse, PostApiStateProjectTabsByTabIdError, UpdateProjectTabVariables>
) {
    const queryClient = useQueryClient();
    const mutationGenOptions = postApiStateProjectTabsByTabIdMutation();

    return useMutation<PostApiStateProjectTabsByTabIdResponse, PostApiStateProjectTabsByTabIdError, UpdateProjectTabVariables>({
        mutationFn: async ({ tabId, partial }: UpdateProjectTabVariables) => {
            // The generated type PostApiStateProjectTabsByTabIdData likely expects { path: { tabId: string }, body: Partial<ProjectTabState> }
            const opts: Options<PostApiStateProjectTabsByTabIdData> = {
                path: { tabId: tabId }, // Ensure path param name matches ('tab_id' vs 'tabId')
                body: partial,
            };
            if (!mutationGenOptions.mutationFn) {
                throw new Error("Mutation function not available for postApiStateProjectTabsByTabId");
            }
            return await mutationGenOptions.mutationFn(opts);
        },
        onSuccess: (data, variables, context) => {
            handleStateMutationSuccess(queryClient, data);
            options?.onSuccess?.(data, variables, context);
        },
        onError: (error, variables, context) => {
            commonErrorHandler(error as unknown as Error);
            queryClient.invalidateQueries({ queryKey: getApiStateQueryKey() });
            options?.onError?.(error, variables, context);
        },
        ...options,
    });
}

/**
 * Mutation hook to delete a specific project tab by its ID.
 */
export function useDeleteProjectTabMutation(
    options?: UseMutationOptions<DeleteApiStateProjectTabsByTabIdResponse, DeleteApiStateProjectTabsByTabIdError, string>
) {
    const queryClient = useQueryClient();
    const mutationGenOptions = deleteApiStateProjectTabsByTabIdMutation();

    return useMutation<DeleteApiStateProjectTabsByTabIdResponse, DeleteApiStateProjectTabsByTabIdError, string>({
        mutationFn: async (tabIdToDelete: string) => {
            // The generated type DeleteApiStateProjectTabsByTabIdData likely expects { path: { tabId: string } }
            const opts: Options<DeleteApiStateProjectTabsByTabIdData> = {
                path: { tabId: tabIdToDelete }, // Ensure path param name matches
            };
            if (!mutationGenOptions.mutationFn) {
                throw new Error("Mutation function not available for deleteApiStateProjectTabsByTabId");
            }
            return await mutationGenOptions.mutationFn(opts);
        },
        onSuccess: (data, variables, context) => {
            // Note: The response from a DELETE might not contain the full state.
            // It's often safer to invalidate after a delete.
            console.log(`Tab ${variables} deleted successfully.`);
            queryClient.invalidateQueries({ queryKey: getApiStateQueryKey() });
            // Or, if the response *does* contain the updated state:
            // handleStateMutationSuccess(queryClient, data);
            options?.onSuccess?.(data, variables, context);
        },
        onError: (error, variables, context) => {
            commonErrorHandler(error as unknown as Error);
            queryClient.invalidateQueries({ queryKey: getApiStateQueryKey() });
            options?.onError?.(error, variables, context);
        },
        ...options,
    });
}


// --- Full State Replacement (Keep if necessary) ---
/**
 * Mutation hook to replace the *entire* GlobalState. Use with caution.
 */
export function useUpdateState(
    options?: UseMutationOptions<PutApiStateResponse, PutApiStateError, ReplaceStateBody>
) {
    const queryClient = useQueryClient();
    const mutationGenOptions = putApiStateMutation();

    // Ensure ReplaceStateBody is the correct type (likely GlobalState)
    return useMutation<PutApiStateResponse, PutApiStateError, ReplaceStateBody>({
        mutationFn: async (variables: ReplaceStateBody) => {
            const opts: Options<PutApiStateData> = { body: variables };
            if (!mutationGenOptions.mutationFn) {
                throw new Error("Mutation function not available for putApiState");
            }
            return await mutationGenOptions.mutationFn(opts);
        },
        onSuccess: (data, variables, context) => {
            // Assuming PutApiStateResponse contains the full new state
            handleStateMutationSuccess(queryClient, data);
            options?.onSuccess?.(data, variables, context);
        },
        onError: (error, variables, context) => {
            commonErrorHandler(error as unknown as Error);
            queryClient.invalidateQueries({ queryKey: getApiStateQueryKey() });
            options?.onError?.(error, variables, context);
        },
        ...options,
    });
}

// --- Generic Partial Update (Consider Removing/Renaming) ---
// We are trying to replace usages of this hook. Keep it only if
// absolutely necessary for keys without specific endpoints.
/*
import { postApiStateUpdateMutation } from '../generated/@tanstack/react-query.gen';
import { PostApiStateUpdateData, PostApiStateUpdateError, PostApiStateUpdateResponse, UpdateStatePartialBody } from '../generated/types.gen';

export function useUpdateStateGenericPartial(
    options?: UseMutationOptions<PostApiStateUpdateResponse, PostApiStateUpdateError, UpdateStatePartialBody>
) {
    const queryClient = useQueryClient();
    const mutationGenOptions = postApiStateUpdateMutation();

    return useMutation<PostApiStateUpdateResponse, PostApiStateUpdateError, UpdateStatePartialBody>({
        mutationFn: async (variables: UpdateStatePartialBody) => {
            const opts: Options<PostApiStateUpdateData> = { body: variables };
            if (!mutationGenOptions.mutationFn) {
                throw new Error("Mutation function not available for postApiStateUpdate");
            }
            return await mutationGenOptions.mutationFn(opts);
        },
        onSuccess: (data, variables, context) => {
            handleStateMutationSuccess(queryClient, data);
            options?.onSuccess?.(data, variables, context);
        },
        onError: (error, variables, context) => {
            commonErrorHandler(error as unknown as Error);
            queryClient.invalidateQueries({ queryKey: getApiStateQueryKey() });
            options?.onError?.(error, variables, context);
        }
    });
}
*/