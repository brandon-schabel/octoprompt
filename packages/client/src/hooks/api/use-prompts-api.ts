import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Prompt } from 'shared';
import { commonErrorHandler } from './common-mutation-error-handler';
import {
    getApiPromptsOptions,
    getApiPromptsQueryKey,
    postApiPromptsMutation,
    getApiPromptsByPromptIdOptions,
    getApiPromptsByPromptIdQueryKey,
    patchApiPromptsByPromptIdMutation,
    deleteApiPromptsByPromptIdMutation,
    getApiProjectsByProjectIdPromptsOptions,
    getApiProjectsByProjectIdPromptsQueryKey,
    postApiProjectsByProjectIdPromptsByPromptIdMutation,
    deleteApiProjectsByProjectIdPromptsByPromptIdMutation
} from '../generated/@tanstack/react-query.gen';
import type {
    GetApiPromptsData,
    PostApiPromptsData,
    PostApiPromptsError,
    GetApiPromptsByPromptIdData,
    PatchApiPromptsByPromptIdData,
    PatchApiPromptsByPromptIdError,
    DeleteApiPromptsByPromptIdData,
    DeleteApiPromptsByPromptIdError,
    GetApiProjectsByProjectIdPromptsData,
    PostApiProjectsByProjectIdPromptsByPromptIdData,
    PostApiProjectsByProjectIdPromptsByPromptIdError,
    DeleteApiProjectsByProjectIdPromptsByPromptIdData,
    DeleteApiProjectsByProjectIdPromptsByPromptIdError,
} from '../generated/types.gen'; // Corrected import path again to be relative to hooks dir
import { Options } from '../generated/sdk.gen'; // Corrected import path again to be relative to hooks dir

// Removed PromptResponse, PromptListResponse, EnhancedPromptListResponse as generated types cover this.

// Updated types to match generated hook inputs
export type CreatePromptInput = PostApiPromptsData['body'];
export type UpdatePromptInput = PatchApiPromptsByPromptIdData['body'];

// Reusing generated query keys structure
const PROMPT_KEYS = {
    all: () => getApiPromptsQueryKey(),
    lists: () => getApiPromptsQueryKey(), // Assuming lists are the same as 'all' for this base
    byProject: (projectId: string) => getApiProjectsByProjectIdPromptsQueryKey({ path: { projectId } } as Options<GetApiProjectsByProjectIdPromptsData>),
    details: () => [...getApiPromptsQueryKey(), 'detail'], // Maintain detail structure if needed
    detail: (id: string) => getApiPromptsByPromptIdQueryKey({ path: { promptId: id } } as Options<GetApiPromptsByPromptIdData>)
} as const;

// Get all prompts using generated options
export function useGetPrompts(options?: Partial<GetApiPromptsData['query']>) {
    const queryOptions = getApiPromptsOptions({ query: options } as Options<GetApiPromptsData>);
    return useQuery(queryOptions);
}

interface GetAllPromptsOptions {
    includeMetadata?: boolean; // Example of passing query params
    includeDeleted?: boolean;
    staleTime?: number;
    gcTime?: number;
}

// Enhanced prompt fetching using generated options
export function useGetAllPrompts(options?: GetAllPromptsOptions) {
    const { staleTime, gcTime, ...queryParams } = options || {};
    const queryOpts = getApiPromptsOptions({
        query: queryParams as GetApiPromptsData['query']
    } as Options<GetApiPromptsData>);

    return useQuery({
        ...queryOpts,
        staleTime: staleTime ?? 1000 * 60 * 5, // 5 minutes by default
        gcTime: gcTime ?? 1000 * 60 * 30, // 30 minutes by default
        // Select or transform data if needed to match previous EnhancedPromptListResponse structure
    });
}

// Get prompt by ID using generated options
export function useGetPrompt(id: string) {
    const queryOptions = getApiPromptsByPromptIdOptions({ path: { promptId: id } } as Options<GetApiPromptsByPromptIdData>);
    return useQuery({
        ...queryOptions,
        enabled: !!id,
    });
}


// Create prompt using generated mutation
export function useCreatePrompt() {
    const queryClient = useQueryClient();
    const mutationOptions = postApiPromptsMutation();

    return useMutation<unknown, PostApiPromptsError, Options<PostApiPromptsData>>({
        mutationFn: mutationOptions.mutationFn!,
        onSuccess: (data, variables, context) => {
            queryClient.invalidateQueries({ queryKey: PROMPT_KEYS.all() });
            // Optionally call original onSuccess if provided
            // mutationOptions.onSuccess?.(data, variables, context);
        },
        onError: (error) => commonErrorHandler(error as unknown as Error), // Cast error type
    });
}

// Update prompt using generated mutation
export function useUpdatePrompt() {
    const queryClient = useQueryClient();
    const mutationOptions = patchApiPromptsByPromptIdMutation();

    return useMutation<unknown, PatchApiPromptsByPromptIdError, { promptId: string; data: UpdatePromptInput }>({
        // Generated mutation expects Options<Patch...> which includes path and body
        mutationFn: (vars: { promptId: string; data: UpdatePromptInput }) => {
            const opts: Options<PatchApiPromptsByPromptIdData> = { path: { promptId: vars.promptId }, body: vars.data };
            return mutationOptions.mutationFn!(opts);
        },
        onSuccess: (data, variables, context) => {
            const promptId = variables.promptId;
            queryClient.invalidateQueries({ queryKey: PROMPT_KEYS.detail(promptId) });
            queryClient.invalidateQueries({ queryKey: PROMPT_KEYS.all() });
            // mutationOptions.onSuccess?.(data, variables, context);
        },
        onError: (error) => commonErrorHandler(error as unknown as Error), // Cast error type
    });
}

// Delete prompt using generated mutation
export function useDeletePrompt() {
    const queryClient = useQueryClient();
    const mutationOptions = deleteApiPromptsByPromptIdMutation();

    return useMutation<unknown, DeleteApiPromptsByPromptIdError, string>({
        // Generated mutation expects Options<Delete...> which includes path
        mutationFn: (promptId: string) => {
            const opts: Options<DeleteApiPromptsByPromptIdData> = { path: { promptId } };
            return mutationOptions.mutationFn!(opts);
        },
        onSuccess: (data, variables, context) => {
            // variables is the promptId string here
            queryClient.invalidateQueries({ queryKey: PROMPT_KEYS.all() });
            // Also invalidate the specific detail if needed, though it's deleted
            // queryClient.invalidateQueries({ queryKey: PROMPT_KEYS.detail(variables) });
            // mutationOptions.onSuccess?.(data, variables, context);
        },
        onError: (error) => commonErrorHandler(error as unknown as Error), // Cast error type
    });
}

// Get prompts by project using generated options
export function useGetProjectPrompts(projectId: string) {
    const queryOptions = getApiProjectsByProjectIdPromptsOptions({ path: { projectId } } as Options<GetApiProjectsByProjectIdPromptsData>);
    return useQuery({
        ...queryOptions,
        enabled: !!projectId,
        // Select or transform data if needed to match previous structure
    });
}


// Add prompt to project using generated mutation
export function useAddPromptToProject() {
    const queryClient = useQueryClient();
    const mutationOptions = postApiProjectsByProjectIdPromptsByPromptIdMutation();

    return useMutation<unknown, PostApiProjectsByProjectIdPromptsByPromptIdError, { promptId: string; projectId: string }>({
        // Generated mutation expects Options<Post...> which includes path
        mutationFn: (vars: { promptId: string; projectId: string }) => {
            const opts: Options<PostApiProjectsByProjectIdPromptsByPromptIdData> = { path: { promptId: vars.promptId, projectId: vars.projectId } };
            return mutationOptions.mutationFn!(opts);
        },
        onSuccess: (data, variables, context) => {
            const projectId = variables.projectId;
            queryClient.invalidateQueries({ queryKey: PROMPT_KEYS.byProject(projectId) });
            // mutationOptions.onSuccess?.(data, variables, context);
        },
        onError: (error) => commonErrorHandler(error as unknown as Error), // Cast error type
    });
}

// Remove prompt from project using generated mutation
export function useRemovePromptFromProject() {
    const queryClient = useQueryClient();
    const mutationOptions = deleteApiProjectsByProjectIdPromptsByPromptIdMutation();

    return useMutation<unknown, DeleteApiProjectsByProjectIdPromptsByPromptIdError, { promptId: string; projectId: string }>({
        // Generated mutation expects Options<Delete...> which includes path
        mutationFn: (vars: { promptId: string; projectId: string }) => {
            const opts: Options<DeleteApiProjectsByProjectIdPromptsByPromptIdData> = { path: { promptId: vars.promptId, projectId: vars.projectId } };
            return mutationOptions.mutationFn!(opts);
        },
        onSuccess: (data, variables, context) => {
            const projectId = variables.projectId;
            queryClient.invalidateQueries({ queryKey: PROMPT_KEYS.byProject(projectId) });
            // mutationOptions.onSuccess?.(data, variables, context);
        },
        onError: (error) => commonErrorHandler(error as unknown as Error), // Cast error type
    });
}