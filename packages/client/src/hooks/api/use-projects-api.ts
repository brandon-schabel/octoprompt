import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../use-api';
import { CreateProjectBody, UpdateProjectBody, Project, ProjectFile } from 'shared';

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

const PROJECT_KEYS = {
    all: ['projects'] as const,
    lists: () => [...PROJECT_KEYS.all, 'list'] as const,
    list: (filters: string) => [...PROJECT_KEYS.lists(), { filters }] as const,
    details: () => [...PROJECT_KEYS.all, 'detail'] as const,
    detail: (id: string) => [...PROJECT_KEYS.details(), id] as const,
} as const;

const PROJECT_FILES_KEYS = {
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
    });
};

export const useGetProjectFiles = (projectId: string) => {
    const { api } = useApi();
    return useQuery({
        queryKey: PROJECT_FILES_KEYS.list(projectId),
        queryFn: () => getProjectFiles(api, projectId),
        enabled: !!projectId,
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
