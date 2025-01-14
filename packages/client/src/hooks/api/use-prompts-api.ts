import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../use-api';
import { Prompt } from 'shared';
import { commonErrorHandler } from './common-mutation-error-handler';

export type PromptResponse = {
    success: boolean;
    prompt?: Prompt;
    error?: string;
};

export type PromptListResponse = {
    success: boolean;
    prompts: Prompt[];
    error?: string;
};

export type CreatePromptInput = {
    projectId: string;
    name: string;
    content: string;
};

export type UpdatePromptInput = {
    name?: string;
    content?: string;
};

const PROMPT_KEYS = {
    all: ['prompts'] as const,
    lists: () => [...PROMPT_KEYS.all, 'list'] as const,
    byProject: (projectId: string) => [...PROMPT_KEYS.lists(), { projectId }] as const,
    details: () => [...PROMPT_KEYS.all, 'detail'] as const,
    detail: (id: string) => [...PROMPT_KEYS.details(), id] as const,
} as const;

// API calls inline
async function createPrompt(api: ReturnType<typeof useApi>['api'], data: CreatePromptInput): Promise<PromptResponse> {
    const response = await api.request('/api/prompts', { method: 'POST', body: data });
    return response.json();
}

async function listPromptsByProject(api: ReturnType<typeof useApi>['api'], projectId: string): Promise<PromptListResponse> {
    const response = await api.request(`/api/projects/${projectId}/prompts`);
    return response.json();
}

async function getPromptById(api: ReturnType<typeof useApi>['api'], promptId: string): Promise<PromptResponse> {
    const response = await api.request(`/api/prompts/${promptId}`);
    return response.json();
}

async function updatePrompt(api: ReturnType<typeof useApi>['api'], promptId: string, data: UpdatePromptInput): Promise<PromptResponse> {
    const response = await api.request(`/api/prompts/${promptId}`, {
        method: 'PATCH',
        body: data,
    });
    return response.json();
}

async function deletePrompt(api: ReturnType<typeof useApi>['api'], promptId: string): Promise<{ success: boolean; error?: string }> {
    const response = await api.request(`/api/prompts/${promptId}`, {
        method: 'DELETE',
    });
    return response.json();
}

async function addPromptToProject(api: ReturnType<typeof useApi>['api'], promptId: string, projectId: string): Promise<{ success: boolean; error?: string }> {
    const response = await api.request(`/api/projects/${projectId}/prompts/${promptId}`, {
        method: 'POST',
    });
    return response.json();
}

async function removePromptFromProject(api: ReturnType<typeof useApi>['api'], promptId: string, projectId: string): Promise<{ success: boolean; error?: string }> {
    const response = await api.request(`/api/projects/${projectId}/prompts/${promptId}`, {
        method: 'DELETE',
    });
    return response.json();
}



// Hooks
export const useGetProjectPrompts = (projectId: string) => {
    const { api } = useApi();
    return useQuery({
        queryKey: PROMPT_KEYS.byProject(projectId),
        queryFn: () => listPromptsByProject(api, projectId),
        enabled: !!projectId,
    });
};

export const useGetPrompt = (id: string) => {
    const { api } = useApi();
    return useQuery({
        queryKey: PROMPT_KEYS.detail(id),
        queryFn: () => getPromptById(api, id),
        enabled: !!id,
    });
};

export const useCreatePrompt = () => {
    const { api } = useApi();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (newPrompt: CreatePromptInput) => createPrompt(api, newPrompt),
        onSuccess: (_, { projectId }) => {
            queryClient.invalidateQueries({ queryKey: PROMPT_KEYS.byProject(projectId) });
        },
        onError: commonErrorHandler
    });
};

export const useUpdatePrompt = () => {
    const { api } = useApi();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, updates }: { id: string; updates: UpdatePromptInput }) => {
            const response = await updatePrompt(api, id, updates);
            if (!response.success) {
                throw new Error(response.error || 'Failed to update prompt');
            }
            return response;
        },
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: PROMPT_KEYS.detail(id) });
            queryClient.invalidateQueries({ queryKey: PROMPT_KEYS.lists() });
        },
        onError: commonErrorHandler
    });
};

export const useDeletePrompt = () => {
    const { api } = useApi();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => deletePrompt(api, id),
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: PROMPT_KEYS.lists(), exact: false });
            queryClient.removeQueries({ queryKey: PROMPT_KEYS.detail(id) });
        },
        onError: commonErrorHandler
    });
};

export const useAddPromptToProject = () => {
    const { api } = useApi();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ promptId, projectId }: { promptId: string, projectId: string }) => addPromptToProject(api, promptId, projectId),
        onSuccess: (_, { promptId, projectId }) => {
            queryClient.invalidateQueries({ queryKey: PROMPT_KEYS.byProject(projectId) });
        },
        onError: commonErrorHandler
    });
};

export const useRemovePromptFromProject = () => {
    const { api } = useApi();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ promptId, projectId }: { promptId: string, projectId: string }) => removePromptFromProject(api, promptId, projectId),
        onSuccess: (_, { promptId, projectId }) => {
            queryClient.invalidateQueries({ queryKey: PROMPT_KEYS.byProject(projectId) });
        },
        onError: commonErrorHandler
    });
};


export function useGetAllPrompts() {
    const { api } = useApi();
    return useQuery<PromptListResponse>({
        queryKey: ['prompts', 'all'],
        queryFn: async () => {
            const res = await api.request('/api/prompts'); 
            return res.json();
        },
    });
}