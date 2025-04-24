// File: packages/client/src/hooks/api/use-project-api.ts
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

} from '../generated/@tanstack/react-query.gen';
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
} from '../generated/types.gen';
import { Options } from '../generated/sdk.gen';

export type CreateProjectInput = PostApiProjectsData['body'];
export type UpdateProjectInput = PatchApiProjectsByProjectIdData['body'];
export type SummarizeFilesInput = PostApiProjectsByProjectIdSummarizeData['body'];
export type RemoveSummariesInput = PostApiProjectsByProjectIdRemoveSummariesData['body'];
export type SuggestFilesInput = PostApiProjectsByProjectIdSuggestFilesData['body'];

// --- Define Query Keys using generated functions ---
// Note: Ensure names align with old keys if strict backward compatibility in cache structure is needed,
// but using generated keys directly is preferred for maintainability.
const PROJECT_KEYS = {
    all: () => getApiProjectsQueryKey(), // Corresponds to old ['projects']
    lists: () => getApiProjectsQueryKey(), // Corresponds to old ['projects', 'list']
    // list: (filters: string) => [...PROJECT_KEYS.lists(), { filters }] as const, // Not directly used by generated queries here
    details: () => [...getApiProjectsQueryKey(), 'detail'] as const, // Custom structure if needed, but direct ID key is better
    detail: (projectId: string) => getApiProjectsByProjectIdQueryKey({ path: { projectId } } as Options<GetApiProjectsByProjectIdData>), // Corresponds to old ['projects', 'detail', id]
    summaries: (projectId: string) => getApiProjectsByProjectIdFileSummariesQueryKey({ path: { projectId } } as Options<GetApiProjectsByProjectIdFileSummariesData>), // Corresponds to old ['projects', 'file-summaries', projectId]
    // summarize: (id: string) => [...PROJECT_KEYS.all, 'summarize', id] as const, // Not a standard query key, use mutation invalidation
} as const;

// Separate keys for files, consistent with previous structure but using generated key function
const PROJECT_FILES_KEYS = {
    all: ['project-files'] as const, // Keep custom namespace if desired
    lists: () => [...PROJECT_FILES_KEYS.all, 'list'] as const,
    list: (projectId: string) => getApiProjectsByProjectIdFilesQueryKey({ path: { projectId } } as Options<GetApiProjectsByProjectIdFilesData>), // Corresponds to old ['project-files', 'list', { projectId }]
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
    // Construct query options, including optional query parameter
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
            // Invalidate using the new generated query key function
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.lists() });
            // Handle 207 response if needed - the 'data' contains the response body
            if ('warning' in data || 'error' in data) { // Check if it's the multi-status response
                console.warn(`Project creation completed with issues: Warning: ${data.warning}, Error: ${data.error}`);
                // Optionally show a toast or specific UI feedback here
            }
            // Optionally call original onSuccess if it existed or add custom logic
        },
        onError: (error) => commonErrorHandler(error as unknown as Error), // Keep common error handler
    });
};

export const useUpdateProject = () => {
    const queryClient = useQueryClient();
    const mutationOptions = patchApiProjectsByProjectIdMutation();

    // Input includes projectId for path and data for body
    return useMutation<PatchApiProjectsByProjectIdResponse, PatchApiProjectsByProjectIdError, { projectId: string; data: UpdateProjectInput }>({
        mutationFn: (vars: { projectId: string; data: UpdateProjectInput }) => {
            const opts: Options<PatchApiProjectsByProjectIdData> = { path: { projectId: vars.projectId }, body: vars.data };
            return mutationOptions.mutationFn!(opts);
        },
        onSuccess: (data, variables, context) => {
            const projectId = variables.projectId;
            // Invalidate using the new generated query key functions
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.detail(projectId) });
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.lists() });
        },
        onError: (error) => commonErrorHandler(error as unknown as Error),
    });
};

export const useDeleteProject = () => {
    const queryClient = useQueryClient();
    const mutationOptions = deleteApiProjectsByProjectIdMutation();

    // Input is just the projectId string
    return useMutation<DeleteApiProjectsByProjectIdResponse, DeleteApiProjectsByProjectIdError, string>({
        mutationFn: (projectId: string) => {
            const opts: Options<DeleteApiProjectsByProjectIdData> = { path: { projectId } };
            return mutationOptions.mutationFn!(opts);
        },
        onSuccess: (data, variables, context) => {
            const projectId = variables; // 'variables' is the projectId here
            // Invalidate list and remove detail query from cache
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.lists() });
            queryClient.removeQueries({ queryKey: PROJECT_KEYS.detail(projectId) });
            // Also remove related queries like files and summaries for the deleted project
            queryClient.removeQueries({ queryKey: PROJECT_FILES_KEYS.list(projectId) });
            queryClient.removeQueries({ queryKey: PROJECT_KEYS.summaries(projectId) });
        },
        onError: (error) => commonErrorHandler(error as unknown as Error),
    });
};

export const useSyncProject = (projectId: string) => {
    const queryClient = useQueryClient();
    const mutationOptions = postApiProjectsByProjectIdSyncMutation();

    // Mutation doesn't need extra args if projectId is from hook scope
    return useMutation<PostApiProjectsByProjectIdSyncResponse, PostApiProjectsByProjectIdSyncError, void>({
        mutationFn: () => { // Takes no arguments, uses projectId from closure
            const opts: Options<PostApiProjectsByProjectIdSyncData> = { path: { projectId } };
            return mutationOptions.mutationFn!(opts);
        },
        onSuccess: () => {
            // Invalidate project detail and file list
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.detail(projectId) });
            queryClient.invalidateQueries({ queryKey: PROJECT_FILES_KEYS.list(projectId) });
        },
        onError: (error) => commonErrorHandler(error as unknown as Error),
    });
};


export const useSummarizeProjectFiles = (projectId: string) => {
    const queryClient = useQueryClient();
    const mutationOptions = postApiProjectsByProjectIdSummarizeMutation();

    // Input type defined above (matches hook arguments)
    return useMutation<PostApiProjectsByProjectIdSummarizeResponse, PostApiProjectsByProjectIdSummarizeError, SummarizeFilesInput>({
        mutationFn: (body: SummarizeFilesInput) => {
            const opts: Options<PostApiProjectsByProjectIdSummarizeData> = { path: { projectId }, body };
            return mutationOptions.mutationFn!(opts);
        },
        onSuccess: () => {
            // Invalidate file summaries list
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.summaries(projectId) });
            // Also invalidate the file list as summaries might be embedded/linked
            queryClient.invalidateQueries({ queryKey: PROJECT_FILES_KEYS.list(projectId) });
        },
        onError: (error) => commonErrorHandler(error as unknown as Error),
    });
};

export const useFindSuggestedFiles = (projectId: string) => {
    const mutationOptions = postApiProjectsByProjectIdSuggestFilesMutation();

    // Input is the user query string
    return useMutation<PostApiProjectsByProjectIdSuggestFilesResponse, PostApiProjectsByProjectIdSuggestFilesError, string>({
        mutationFn: async (userInput: string) => {
            // Construct the body expected by the API
            const body: SuggestFilesInput = { userInput };
            const opts: Options<PostApiProjectsByProjectIdSuggestFilesData> = { path: { projectId }, body };
            return mutationOptions.mutationFn!(opts);
        },
        onError: (error) => commonErrorHandler(error as unknown as Error),
        // No default onSuccess invalidation, depends on usage context
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
            // Invalidate file summaries and the file list
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.summaries(projectId) });
            queryClient.invalidateQueries({ queryKey: PROJECT_FILES_KEYS.list(projectId) });
        },
        onError: (error) => commonErrorHandler(error as unknown as Error)
    });
};

export const useRemoveSummariesFromFiles = (projectId: string) => {
    const queryClient = useQueryClient();
    const mutationOptions = postApiProjectsByProjectIdRemoveSummariesMutation();

    // Input is the array of file IDs
    return useMutation<PostApiProjectsByProjectIdRemoveSummariesResponse, PostApiProjectsByProjectIdRemoveSummariesError, string[]>({
        mutationFn: (fileIds: string[]) => {
            // Construct the body object
            const body: RemoveSummariesInput = { fileIds };
            const opts: Options<PostApiProjectsByProjectIdRemoveSummariesData> = { path: { projectId }, body };
            return mutationOptions.mutationFn!(opts);
        },
        onSuccess: () => {
            // Invalidate file summaries and the file list
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.summaries(projectId) });
            queryClient.invalidateQueries({ queryKey: PROJECT_FILES_KEYS.list(projectId) });
        },
        onError: (error) => commonErrorHandler(error as unknown as Error)
    });
};

export function useRefreshProject(projectId: string) {
    const queryClient = useQueryClient();
    const mutationOptions = postApiProjectsByProjectIdRefreshMutation();

    // Input defines the optional folder query parameter
    return useMutation<PostApiProjectsByProjectIdRefreshResponse, PostApiProjectsByProjectIdRefreshError, { folder?: string }>({
        mutationFn: async (vars: { folder?: string }) => {
            // Construct options with path and optional query
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