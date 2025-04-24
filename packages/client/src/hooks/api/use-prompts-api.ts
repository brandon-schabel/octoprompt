import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
    deleteApiProjectsByProjectIdPromptsByPromptIdMutation,
    postApiPromptOptimizeMutation,
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
    PostApiPromptOptimizeError,
    PostApiPromptOptimizeData,
    PostApiPromptOptimizeResponse,
} from '../generated/types.gen';
import { Options } from '../generated/sdk.gen';


export type CreatePromptInput = PostApiPromptsData['body'];
export type UpdatePromptInput = PatchApiPromptsByPromptIdData['body'];

const PROMPT_KEYS = {
    all: () => getApiPromptsQueryKey(),
    lists: () => getApiPromptsQueryKey(),
    byProject: (projectId: string) => getApiProjectsByProjectIdPromptsQueryKey({ path: { projectId } } as Options<GetApiProjectsByProjectIdPromptsData>),
    details: () => [...getApiPromptsQueryKey(), 'detail'],
    detail: (id: string) => getApiPromptsByPromptIdQueryKey({ path: { promptId: id } } as Options<GetApiPromptsByPromptIdData>)
} as const;

export function useGetPrompts(options?: Partial<GetApiPromptsData['query']>) {
    const queryOptions = getApiPromptsOptions({ query: options } as Options<GetApiPromptsData>);
    return useQuery(queryOptions);
}

interface GetAllPromptsOptions {
    includeMetadata?: boolean;
    includeDeleted?: boolean;
    staleTime?: number;
    gcTime?: number;
}

export function useGetAllPrompts(options?: GetAllPromptsOptions) {
    const { staleTime, gcTime } = options || {};

    const queryOpts = getApiPromptsOptions();

    return useQuery({
        ...queryOpts,
        staleTime: staleTime ?? 1000 * 60 * 5,
        gcTime: gcTime ?? 1000 * 60 * 30,
    });
}

export function useGetPrompt(id: string) {
    const queryOptions = getApiPromptsByPromptIdOptions({ path: { promptId: id } } as Options<GetApiPromptsByPromptIdData>);
    return useQuery({
        ...queryOptions,
        enabled: !!id,
    });
}


export function useCreatePrompt() {
    const queryClient = useQueryClient();
    const mutationOptions = postApiPromptsMutation();

    return useMutation<unknown, PostApiPromptsError, Options<PostApiPromptsData>>({
        mutationFn: mutationOptions.mutationFn!,
        onSuccess: (data, variables, context) => {
            queryClient.invalidateQueries({ queryKey: PROMPT_KEYS.all() });
        },
        onError: (error) => commonErrorHandler(error as unknown as Error),
    });
}

export function useUpdatePrompt() {
    const queryClient = useQueryClient();
    const mutationOptions = patchApiPromptsByPromptIdMutation();

    return useMutation<unknown, PatchApiPromptsByPromptIdError, { promptId: string; data: UpdatePromptInput }>({
        mutationFn: (vars: { promptId: string; data: UpdatePromptInput }) => {
            const opts: Options<PatchApiPromptsByPromptIdData> = { path: { promptId: vars.promptId }, body: vars.data };
            return mutationOptions.mutationFn!(opts);
        },
        onSuccess: (data, variables, context) => {
            const promptId = variables.promptId;
            queryClient.invalidateQueries({ queryKey: PROMPT_KEYS.detail(promptId) });
            queryClient.invalidateQueries({ queryKey: PROMPT_KEYS.all() });
        },
        onError: (error) => commonErrorHandler(error as unknown as Error),
    });
}

export function useDeletePrompt() {
    const queryClient = useQueryClient();
    const mutationOptions = deleteApiPromptsByPromptIdMutation();

    return useMutation<unknown, DeleteApiPromptsByPromptIdError, string>({
        mutationFn: (promptId: string) => {
            const opts: Options<DeleteApiPromptsByPromptIdData> = { path: { promptId } };
            return mutationOptions.mutationFn!(opts);
        },
        onSuccess: (data, variables, context) => {
            queryClient.invalidateQueries({ queryKey: PROMPT_KEYS.all() });
        },
        onError: (error) => commonErrorHandler(error as unknown as Error),
    });
}

export function useGetProjectPrompts(projectId: string) {
    const queryOptions = getApiProjectsByProjectIdPromptsOptions({ path: { projectId } } as Options<GetApiProjectsByProjectIdPromptsData>);
    return useQuery({
        ...queryOptions,
        enabled: !!projectId,
    });
}


export function useAddPromptToProject() {
    const queryClient = useQueryClient();
    const mutationOptions = postApiProjectsByProjectIdPromptsByPromptIdMutation();

    return useMutation<unknown, PostApiProjectsByProjectIdPromptsByPromptIdError, { promptId: string; projectId: string }>({
        mutationFn: (vars: { promptId: string; projectId: string }) => {
            const opts: Options<PostApiProjectsByProjectIdPromptsByPromptIdData> = { path: { promptId: vars.promptId, projectId: vars.projectId } };
            return mutationOptions.mutationFn!(opts);
        },
        onSuccess: (data, variables, context) => {
            const projectId = variables.projectId;
            queryClient.invalidateQueries({ queryKey: PROMPT_KEYS.byProject(projectId) });
        },
        onError: (error) => commonErrorHandler(error as unknown as Error),
    });
}

export function useRemovePromptFromProject() {
    const queryClient = useQueryClient();
    const mutationOptions = deleteApiProjectsByProjectIdPromptsByPromptIdMutation();

    return useMutation<unknown, DeleteApiProjectsByProjectIdPromptsByPromptIdError, { promptId: string; projectId: string }>({
        mutationFn: (vars: { promptId: string; projectId: string }) => {
            const opts: Options<DeleteApiProjectsByProjectIdPromptsByPromptIdData> = { path: { promptId: vars.promptId, projectId: vars.projectId } };
            return mutationOptions.mutationFn!(opts);
        },
        onSuccess: (data, variables, context) => {
            const projectId = variables.projectId;
            queryClient.invalidateQueries({ queryKey: PROMPT_KEYS.byProject(projectId) });
        },
        onError: (error) => commonErrorHandler(error as unknown as Error),
    });
}

export const useOptimizePrompt = () => {
    const mutationOptions = postApiPromptOptimizeMutation();
    return useMutation<PostApiPromptOptimizeResponse, PostApiPromptOptimizeError, string>({
        mutationFn: (userContext: string) => {
            const opts: Options<PostApiPromptOptimizeData> = { body: { userContext } };
            return mutationOptions.mutationFn!(opts);
        },
        onError: (error) => commonErrorHandler(error as unknown as Error),
    });
}
