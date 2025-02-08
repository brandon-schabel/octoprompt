import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../use-api';
import { CreateProjectBody, UpdateProjectBody, Project, ProjectFile, ApiError, } from 'shared';
import { commonErrorHandler } from './common-mutation-error-handler';

export type ProjectResponse = {
    success: boolean;
    project?: Project;
    error?: string;
};

export type ProjectListResponse = {
    success: boolean;
    projects: Project[];
    error?: string;
};

export type FileListResponse = {
    success: boolean;
    files: ProjectFile[];
    error?: string;
};

export type SyncResponse = {
    success: boolean;
    message?: string;
    error?: string;
};

export type SummarizeFilesResponse = {
    success: boolean;
    summary?: string;
    message?: string;
    error?: string;
};

export type FileSummaryResponse = {
    success: boolean;
    summaries: ProjectFile[];
    error?: string;
};

const PROJECT_KEYS = {
    all: ['projects'] as const,
    lists: () => [...PROJECT_KEYS.all, 'list'] as const,
    list: (filters: string) => [...PROJECT_KEYS.lists(), { filters }] as const,
    details: () => [...PROJECT_KEYS.all, 'detail'] as const,
    detail: (id: string) => [...PROJECT_KEYS.details(), id] as const,
    summarize: (id: string) => [...PROJECT_KEYS.all, 'summarize', id] as const,
    fileSummaries: (projectId: string) =>
        [...PROJECT_KEYS.all, 'file-summaries', projectId] as const,
} as const;

export const PROJECT_FILES_KEYS = {
    all: ['project-files'] as const,
    lists: () => [...PROJECT_FILES_KEYS.all, 'list'] as const,
    list: (projectId: string) => [...PROJECT_FILES_KEYS.lists(), { projectId }] as const,
} as const;

// API calls inline
async function listProjects(api: ReturnType<typeof useApi>['api']): Promise<ProjectListResponse> {
    const response = await api.request('/api/projects');
    return response.json();
}

async function getProjectById(api: ReturnType<typeof useApi>['api'], id: string): Promise<ProjectResponse> {
    const response = await api.request(`/api/projects/${id}`);
    return response.json();
}

async function createProject(api: ReturnType<typeof useApi>['api'], data: CreateProjectBody): Promise<ProjectResponse> {
    const response = await api.request('/api/projects', {
        method: 'POST',
        body: data,
    });
    return response.json();
}

async function updateProject(api: ReturnType<typeof useApi>['api'], id: string, data: UpdateProjectBody): Promise<ProjectResponse> {
    const response = await api.request(`/api/projects/${id}`, {
        method: 'PATCH',
        body: data,
    });
    return response.json();
}

async function deleteProject(api: ReturnType<typeof useApi>['api'], id: string): Promise<{ success: boolean; error?: string }> {
    const response = await api.request(`/api/projects/${id}`, {
        method: 'DELETE',
    });
    return response.json();
}

async function getProjectFiles(api: ReturnType<typeof useApi>['api'], projectId: string): Promise<FileListResponse> {
    const response = await api.request(`/api/projects/${projectId}/files`);
    return response.json();
}

async function syncProject(api: ReturnType<typeof useApi>['api'], projectId: string): Promise<SyncResponse> {
    const response = await api.request(`/api/projects/${projectId}/sync`, {
        method: 'POST',
    });
    return response.json();
}

async function summarizeProjectFiles(
    api: ReturnType<typeof useApi>['api'],
    projectId: string,
    fileIds: string[],
    force?: boolean
): Promise<SummarizeFilesResponse> {
    const response = await api.request(`/api/projects/${projectId}/summarize`, {
        method: 'POST',
        body: { fileIds, force },
    });
    return response.json();
}

async function getFileSummaries(
    api: ReturnType<typeof useApi>['api'],
    projectId: string,
    fileIds?: string[]
): Promise<FileSummaryResponse> {
    const queryParams = fileIds?.length ? `?fileIds=${fileIds.join(',')}` : '';
    const response = await api.request(`/api/projects/${projectId}/file-summaries${queryParams}`);
    return response.json();
}

async function resummarizeAllFiles(
    api: ReturnType<typeof useApi>['api'],
    projectId: string
): Promise<{ success: boolean; message?: string }> {
    const response = await api.request(`/api/projects/${projectId}/resummarize-all`, {
        method: 'POST',
    });
    return response.json();
}

async function removeSummariesFromFiles(
    api: ReturnType<typeof useApi>['api'],
    projectId: string,
    fileIds: string[]
): Promise<{ success: boolean; removedCount: number; message?: string }> {
    const response = await api.request(`/api/projects/${projectId}/remove-summaries`, {
        method: 'POST',
        body: { fileIds },
    });
    return response.json();
}

// Hooks
export const useGetProjects = () => {
    const { api } = useApi();
    return useQuery({
        queryKey: PROJECT_KEYS.lists(),
        queryFn: () => listProjects(api),
    });
};

export const useGetProject = (id: string) => {
    const { api } = useApi();
    return useQuery({
        queryKey: PROJECT_KEYS.detail(id),
        queryFn: () => getProjectById(api, id),
        enabled: !!id,

        // throwOnError: (error) => {
        //     console.log("error", error)
        //     if (error instanceof ApiError) {
        //         toast("Error Getting Project")
        //         return false;
        //     }
        //     return false;
        // },
    });
};


export const useCreateProject = () => {
    const { api } = useApi();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (newProject: CreateProjectBody) => createProject(api, newProject),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.lists() });
        },
        onError: commonErrorHandler,
    });
};

export const useUpdateProject = () => {
    const { api } = useApi();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: UpdateProjectBody }) =>
            updateProject(api, id, updates),
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.detail(id) });
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.lists() });
        },
        onError: commonErrorHandler
    });
};

export const useDeleteProject = () => {
    const { api } = useApi();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => deleteProject(api, id),
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.lists() });
            queryClient.removeQueries({ queryKey: PROJECT_KEYS.detail(id) });
        },
        onError: commonErrorHandler
    });
};

export const useGetProjectFiles = (projectId: string) => {
    const { api } = useApi();
    return useQuery({
        queryKey: PROJECT_FILES_KEYS.list(projectId),
        queryFn: () => getProjectFiles(api, projectId),
        enabled: !!projectId,
        // NEW: re-fetch whenever window regains focus
        refetchOnWindowFocus: true,
        refetchOnMount: true,
    });
};

export const useSyncProject = (projectId: string) => {
    const { api } = useApi();
    const queryClient = useQueryClient();
    return useMutation<SyncResponse, Error>({
        mutationFn: () => syncProject(api, projectId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.detail(projectId) });
            queryClient.invalidateQueries({ queryKey: PROJECT_FILES_KEYS.list(projectId) });
        },
        onError: commonErrorHandler
    });
};
export const useSyncProjectInterval = (projectId: string) => {
    const { api } = useApi();
    return useQuery({
        queryKey: ['sync-project', projectId],
        queryFn: () => syncProject(api, projectId),
        refetchInterval: 30000,
    });
};
export const useSummarizeProjectFiles = (projectId: string) => {
    const { api } = useApi();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ fileIds, force }: { fileIds: string[], force?: boolean }) => {
            return summarizeProjectFiles(api, projectId, fileIds, force);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.summarize(projectId) });
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.fileSummaries(projectId) });
        },
        onError: commonErrorHandler,
    });
};
export const useGetFileSummaries = (projectId: string, fileIds?: string[]) => {
    const { api } = useApi();
    return useQuery({
        queryKey: PROJECT_KEYS.fileSummaries(projectId),
        queryFn: () => getFileSummaries(api, projectId, fileIds),
        enabled: !!projectId,
    });
};

export type SuggestedFilesResponse = {
    success: boolean
    recommendedFileIds?: string[]
    rawLLMOutput?: string
    message?: string
}

export const useFindSuggestedFiles = (projectId: string) => {
    const { api } = useApi()

    return useMutation<SuggestedFilesResponse, Error, string>({
        // The mutate function's argument will be the `userInput` (a string).
        mutationFn: async (userInput: string) => {
            const response = await api.request(`/api/projects/${projectId}/suggest-files`, {
                method: 'POST',
                body: { userInput },
            })
            return response.json() as Promise<SuggestedFilesResponse>
        },
        onError: commonErrorHandler,
    })
}

export const useResummarizeAllFiles = (projectId: string) => {
    const { api } = useApi();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => resummarizeAllFiles(api, projectId),
        onSuccess: () => {
            // Invalidate file summaries to trigger a refresh
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.fileSummaries(projectId) });
        },
        onError: commonErrorHandler
    });
};

export const useRemoveSummariesFromFiles = (projectId: string) => {
    const { api } = useApi();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (fileIds: string[]) => removeSummariesFromFiles(api, projectId, fileIds),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.fileSummaries(projectId) });
        },
        onError: commonErrorHandler
    });
};



export type RefreshProjectResponse = {
    success: boolean;
    files?: ProjectFile[];
    message?: string;
};


export function useRefreshProject(projectId: string) {
    const { api } = useApi();
    const queryClient = useQueryClient();

    return useMutation<RefreshProjectResponse, Error, { folder?: string }>({
        mutationFn: async ({ folder }) => {
            const url = folder
                ? `/api/projects/${projectId}/refresh?folder=${encodeURIComponent(folder)}`
                : `/api/projects/${projectId}/refresh`;
            const response = await api.request(url, { method: "POST" });
            return response.json() as Promise<RefreshProjectResponse>;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PROJECT_FILES_KEYS.list(projectId) });
        },
    });
}