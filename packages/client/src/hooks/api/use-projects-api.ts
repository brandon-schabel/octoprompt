import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { commonErrorHandler } from './common-mutation-error-handler';
import {
    getApiProjectsOptions,
    getApiProjectsQueryKey,
    getApiProjectsByProjectIdOptions,
    getApiProjectsByProjectIdQueryKey,
    getApiProjectsByProjectIdFilesOptions,
    getApiProjectsByProjectIdFilesQueryKey,
    getApiProjectsByProjectIdFileSummariesOptions,
    getApiProjectsByProjectIdFileSummariesQueryKey,
    postApiProjectsMutation,
    patchApiProjectsByProjectIdMutation,
    deleteApiProjectsByProjectIdMutation,
    postApiProjectsByProjectIdSyncMutation,
    postApiProjectsByProjectIdSummarizeMutation,
    postApiProjectsByProjectIdResummarizeAllMutation,
    postApiProjectsByProjectIdRemoveSummariesMutation,
    postApiProjectsByProjectIdSuggestFilesMutation,
    postApiProjectsByProjectIdRefreshMutation,

} from '../../generated/@tanstack/react-query.gen';
import type {
    PostApiProjectsData,
    PostApiProjectsError,
    PostApiProjectsResponse,
    GetApiProjectsByProjectIdData,
    PatchApiProjectsByProjectIdData,
    PatchApiProjectsByProjectIdError,
    PatchApiProjectsByProjectIdResponse,
    DeleteApiProjectsByProjectIdData,
    DeleteApiProjectsByProjectIdError,
    DeleteApiProjectsByProjectIdResponse,
    GetApiProjectsByProjectIdFilesData,
    PostApiProjectsByProjectIdSyncData,
    PostApiProjectsByProjectIdSyncError,
    PostApiProjectsByProjectIdSyncResponse,
    GetApiProjectsByProjectIdFileSummariesData,
    PostApiProjectsByProjectIdSummarizeData,
    PostApiProjectsByProjectIdSummarizeError,
    PostApiProjectsByProjectIdSummarizeResponse,
    PostApiProjectsByProjectIdResummarizeAllData,
    PostApiProjectsByProjectIdResummarizeAllError,
    PostApiProjectsByProjectIdResummarizeAllResponse,
    PostApiProjectsByProjectIdRemoveSummariesData,
    PostApiProjectsByProjectIdRemoveSummariesError,
    PostApiProjectsByProjectIdRemoveSummariesResponse,
    PostApiProjectsByProjectIdSuggestFilesData,
    PostApiProjectsByProjectIdSuggestFilesError,
    PostApiProjectsByProjectIdSuggestFilesResponse,
    PostApiProjectsByProjectIdRefreshData,
    PostApiProjectsByProjectIdRefreshError,
    PostApiProjectsByProjectIdRefreshResponse,
} from '../../generated/types.gen';
import { Options } from '../../generated/sdk.gen';

export type CreateProjectInput = PostApiProjectsData['body'];
export type UpdateProjectInput = PatchApiProjectsByProjectIdData['body'];
export type SummarizeFilesInput = PostApiProjectsByProjectIdSummarizeData['body'];
export type RemoveSummariesInput = PostApiProjectsByProjectIdRemoveSummariesData['body'];
export type SuggestFilesInput = PostApiProjectsByProjectIdSuggestFilesData['body'];

const PROJECT_KEYS = {
    all: () => getApiProjectsQueryKey(),
    lists: () => getApiProjectsQueryKey(),
    details: () => [...getApiProjectsQueryKey(), 'detail'] as const, // Custom structure if needed, but direct ID key is better
    detail: (projectId: string) => getApiProjectsByProjectIdQueryKey({ path: { projectId } } as Options<GetApiProjectsByProjectIdData>), // Corresponds to old ['projects', 'detail', id]
    summaries: (projectId: string) => getApiProjectsByProjectIdFileSummariesQueryKey({ path: { projectId } } as Options<GetApiProjectsByProjectIdFileSummariesData>), // Corresponds to old ['projects', 'file-summaries', projectId]
} as const;

const PROJECT_FILES_KEYS = {
    all: ['project-files'] as const,
    lists: () => [...PROJECT_FILES_KEYS.all, 'list'] as const,
    list: (projectId: string) => getApiProjectsByProjectIdFilesQueryKey({ path: { projectId } } as Options<GetApiProjectsByProjectIdFilesData>),
} as const;

export const useGetProjects = () => {
    const queryOptions = getApiProjectsOptions();
    return useQuery(queryOptions);
};

export const useGetProject = (projectId: string) => {
    const queryOptions = getApiProjectsByProjectIdOptions({ path: { projectId } } as Options<GetApiProjectsByProjectIdData>);
    return useQuery({
        ...queryOptions,
        enabled: !!projectId,
    });
};

export const useGetProjectFiles = (projectId: string) => {
    const queryOptions = getApiProjectsByProjectIdFilesOptions({ path: { projectId } } as Options<GetApiProjectsByProjectIdFilesData>);
    return useQuery({
        ...queryOptions,
        enabled: !!projectId,
        refetchOnWindowFocus: true,
        refetchOnMount: true,
    });
};

export const useGetFileSummaries = (projectId: string, fileIds?: string[]) => {
    const queryParams: Options<GetApiProjectsByProjectIdFileSummariesData>['query'] =
        fileIds && fileIds.length > 0 ? { fileIds: fileIds.join(',') } : undefined;

    const queryOptions = getApiProjectsByProjectIdFileSummariesOptions({
        path: { projectId },
        query: queryParams,
    } as Options<GetApiProjectsByProjectIdFileSummariesData>);

    return useQuery({
        ...queryOptions,
        enabled: !!projectId,
    });
};

export const useCreateProject = () => {
    const queryClient = useQueryClient();
    const mutationOptions = postApiProjectsMutation();

    return useMutation<PostApiProjectsResponse, PostApiProjectsError, CreateProjectInput>({
        mutationFn: (body: CreateProjectInput) => {
            const opts: Options<PostApiProjectsData> = { body };
            return mutationOptions.mutationFn!(opts);
        },
        onSuccess: (data, variables, context) => {
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.lists() });
            if ('warning' in data || 'error' in data) { // Check if it's the multi-status response
                console.warn(`Project creation completed with issues: Warning: ${data.warning}, Error: ${data.error}`);
            }
        },
        onError: (error) => commonErrorHandler(error as unknown as Error), // Keep common error handler
    });
};

export const useUpdateProject = () => {
    const queryClient = useQueryClient();
    const mutationOptions = patchApiProjectsByProjectIdMutation();

    return useMutation<PatchApiProjectsByProjectIdResponse, PatchApiProjectsByProjectIdError, { projectId: string; data: UpdateProjectInput }>({
        mutationFn: (vars: { projectId: string; data: UpdateProjectInput }) => {
            const opts: Options<PatchApiProjectsByProjectIdData> = { path: { projectId: vars.projectId }, body: vars.data };
            return mutationOptions.mutationFn!(opts);
        },
        onSuccess: (data, variables, context) => {
            const projectId = variables.projectId;
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.detail(projectId) });
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.lists() });
        },
        onError: (error) => commonErrorHandler(error as unknown as Error),
    });
};

export const useDeleteProject = () => {
    const queryClient = useQueryClient();
    const mutationOptions = deleteApiProjectsByProjectIdMutation();

    return useMutation<DeleteApiProjectsByProjectIdResponse, DeleteApiProjectsByProjectIdError, string>({
        mutationFn: (projectId: string) => {
            const opts: Options<DeleteApiProjectsByProjectIdData> = { path: { projectId } };
            return mutationOptions.mutationFn!(opts);
        },
        onSuccess: (data, variables, context) => {
            const projectId = variables;
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.lists() });
            queryClient.removeQueries({ queryKey: PROJECT_KEYS.detail(projectId) });
            queryClient.removeQueries({ queryKey: PROJECT_FILES_KEYS.list(projectId) });
            queryClient.removeQueries({ queryKey: PROJECT_KEYS.summaries(projectId) });
        },
        onError: (error) => commonErrorHandler(error as unknown as Error),
    });
};

export const useSyncProject = (projectId: string) => {
    const queryClient = useQueryClient();
    const mutationOptions = postApiProjectsByProjectIdSyncMutation();

    return useMutation<PostApiProjectsByProjectIdSyncResponse, PostApiProjectsByProjectIdSyncError, void>({
        mutationFn: () => {
            const opts: Options<PostApiProjectsByProjectIdSyncData> = { path: { projectId } };
            return mutationOptions.mutationFn!(opts);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.detail(projectId) });
            queryClient.invalidateQueries({ queryKey: PROJECT_FILES_KEYS.list(projectId) });
        },
        onError: (error) => commonErrorHandler(error as unknown as Error),
    });
};



export const useFindSuggestedFiles = (projectId: string) => {
    const mutationOptions = postApiProjectsByProjectIdSuggestFilesMutation();

    return useMutation<PostApiProjectsByProjectIdSuggestFilesResponse, PostApiProjectsByProjectIdSuggestFilesError, string>({
        mutationFn: async (userInput: string) => {
            const body: SuggestFilesInput = { userInput };
            const opts: Options<PostApiProjectsByProjectIdSuggestFilesData> = { path: { projectId }, body };
            return mutationOptions.mutationFn!(opts);
        },
        onError: (error) => commonErrorHandler(error as unknown as Error),
    });
};

export const useResummarizeAllFiles = (projectId: string) => {
    const queryClient = useQueryClient();
    const mutationOptions = postApiProjectsByProjectIdResummarizeAllMutation();

    return useMutation<PostApiProjectsByProjectIdResummarizeAllResponse, PostApiProjectsByProjectIdResummarizeAllError, void>({
        mutationFn: () => {
            const opts: Options<PostApiProjectsByProjectIdResummarizeAllData> = { path: { projectId } };
            return mutationOptions.mutationFn!(opts);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.summaries(projectId) });
            queryClient.invalidateQueries({ queryKey: PROJECT_FILES_KEYS.list(projectId) });
        },
        onError: (error) => commonErrorHandler(error as unknown as Error)
    });
};

export const useRemoveSummariesFromFiles = (projectId: string) => {
    const queryClient = useQueryClient();
    const mutationOptions = postApiProjectsByProjectIdRemoveSummariesMutation();

    return useMutation<PostApiProjectsByProjectIdRemoveSummariesResponse, PostApiProjectsByProjectIdRemoveSummariesError, string[]>({
        mutationFn: (fileIds: string[]) => {
            const body: RemoveSummariesInput = { fileIds };
            const opts: Options<PostApiProjectsByProjectIdRemoveSummariesData> = { path: { projectId }, body };
            return mutationOptions.mutationFn!(opts);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.summaries(projectId) });
            queryClient.invalidateQueries({ queryKey: PROJECT_FILES_KEYS.list(projectId) });
        },
        onError: (error) => commonErrorHandler(error as unknown as Error)
    });
};

export function useRefreshProject(projectId: string) {
    const queryClient = useQueryClient();
    const mutationOptions = postApiProjectsByProjectIdRefreshMutation();

    return useMutation<PostApiProjectsByProjectIdRefreshResponse, PostApiProjectsByProjectIdRefreshError, { folder?: string }>({
        mutationFn: async (vars: { folder?: string }) => {
            const opts: Options<PostApiProjectsByProjectIdRefreshData> = { path: { projectId } };
            if (vars.folder) {
                opts.query = { folder: vars.folder };
            }
            return mutationOptions.mutationFn!(opts);
        },
        onSuccess: () => {
            // Invalidate the project's file list
            queryClient.invalidateQueries({ queryKey: PROJECT_FILES_KEYS.list(projectId) });
        },
        onError: (error) => commonErrorHandler(error as unknown as Error),
    });
}