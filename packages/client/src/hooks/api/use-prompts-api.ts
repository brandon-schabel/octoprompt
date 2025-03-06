/*
 * File: use-prompts-api.ts
 * Purpose: Provides React Query hooks for interacting with the prompts API
 * Key Features:
 * - CRUD operations for prompts
 * - Automatic cache invalidation
 * - Type-safe API calls
 * 
 * Most Recent Changes:
 * - Fixed query options to use gcTime instead of cacheTime
 * - Added proper error typing
 * - Added type-safe options interface
 */

import { useMutation, useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { Prompt } from 'shared';
import { commonErrorHandler } from './common-mutation-error-handler';
import { useApi } from '../use-api';

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
    name: string;
    content: string;
    projectId?: string;
};

export type UpdatePromptInput = {
    name?: string;
    content?: string;
};

// Add new types for enhanced prompt responses
export type EnhancedPromptListResponse = PromptListResponse & {
    metadata?: {
        totalCount: number;
        lastUpdated: string;
    };
};

const PROMPT_KEYS = {
    all: ['prompts'] as const,
    lists: () => [...PROMPT_KEYS.all, 'list'] as const,
    byProject: (projectId: string) => [...PROMPT_KEYS.lists(), { projectId }] as const,
    details: () => [...PROMPT_KEYS.all, 'detail'] as const,
    detail: (id: string) => [...PROMPT_KEYS.details(), id] as const,
} as const;

// Get all prompts
export function useGetPrompts() {
    const { api } = useApi();
    return useQuery<PromptListResponse>({
        queryKey: PROMPT_KEYS.all,
        queryFn: async () => {
            const res = await api.request('/api/prompts');
            return res.json();
        },
    });
}

interface GetAllPromptsOptions {
    includeMetadata?: boolean;
    includeDeleted?: boolean;
    staleTime?: number;
    gcTime?: number;
}

// Enhanced prompt fetching with additional features
export function useGetAllPrompts(options?: GetAllPromptsOptions) {
    const { api } = useApi();
    const queryClient = useQueryClient();

    return useQuery({
        queryKey: [...PROMPT_KEYS.all, options],
        queryFn: async () => {
            const queryParams = new URLSearchParams();
            if (options?.includeMetadata) {
                queryParams.append('includeMetadata', 'true');
            }
            if (options?.includeDeleted) {
                queryParams.append('includeDeleted', 'true');
            }

            const url = `/api/prompts${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
            const res = await api.request(url);
            const data: PromptListResponse = await res.json();

            // Add metadata if requested
            if (options?.includeMetadata) {
                return {
                    success: data.success,
                    prompts: data.prompts,
                    error: data.error,
                    metadata: {
                        totalCount: data.prompts.length,
                        lastUpdated: new Date().toISOString(),
                    },
                };
            }

            return data;
        },
        staleTime: options?.staleTime ?? 1000 * 60 * 5, // 5 minutes by default
        gcTime: options?.gcTime ?? 1000 * 60 * 30, // 30 minutes by default
    });
}

// Get prompt by ID
export function useGetPrompt(id: string) {
    const { api } = useApi();
    return useQuery<PromptResponse>({
        queryKey: PROMPT_KEYS.detail(id),
        queryFn: async () => {
            const res = await api.request(`/api/prompts/${id}`);
            return res.json();
        },
        enabled: !!id,
    });
}

// Create prompt
export function useCreatePrompt() {
    const { api } = useApi();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: CreatePromptInput) => {
            const res = await api.request('/api/prompts', {
                method: 'POST',
                body: data,
            });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PROMPT_KEYS.all });
        },
        onError: commonErrorHandler,
    });
}

// Update prompt
export function useUpdatePrompt() {
    const { api } = useApi();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ promptId, data }: { promptId: string; data: UpdatePromptInput }) => {
            const res = await api.request(`/api/prompts/${promptId}`, {
                method: 'PATCH',
                body: data,
            });
            return res.json();
        },
        onSuccess: (_, { promptId }) => {
            queryClient.invalidateQueries({ queryKey: PROMPT_KEYS.detail(promptId) });
            queryClient.invalidateQueries({ queryKey: PROMPT_KEYS.all });
        },
        onError: commonErrorHandler,
    });
}

// Delete prompt
export function useDeletePrompt() {
    const { api } = useApi();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (promptId: string) => {
            const res = await api.request(`/api/prompts/${promptId}`, {
                method: 'DELETE',
            });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PROMPT_KEYS.all });
        },
        onError: commonErrorHandler,
    });
}

// Get prompts by project
export function useGetProjectPrompts(projectId: string) {
    const { api } = useApi();
    return useQuery<PromptListResponse>({
        queryKey: PROMPT_KEYS.byProject(projectId),
        queryFn: async () => {
            const res = await api.request(`/api/projects/${projectId}/prompts`);
            return res.json();
        },
        enabled: !!projectId,
    });
}

// Add prompt to project
export function useAddPromptToProject() {
    const { api } = useApi();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ promptId, projectId }: { promptId: string; projectId: string }) => {
            const res = await api.request(`/api/projects/${projectId}/prompts/${promptId}`, {
                method: 'POST',
            });
            return res.json();
        },
        onSuccess: (_, { projectId }) => {
            queryClient.invalidateQueries({ queryKey: PROMPT_KEYS.byProject(projectId) });
        },
        onError: commonErrorHandler,
    });
}

// Remove prompt from project
export function useRemovePromptFromProject() {
    const { api } = useApi();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ promptId, projectId }: { promptId: string; projectId: string }) => {
            const res = await api.request(`/api/projects/${projectId}/prompts/${promptId}`, {
                method: 'DELETE',
            });
            return res.json();
        },
        onSuccess: (_, { projectId }) => {
            queryClient.invalidateQueries({ queryKey: PROMPT_KEYS.byProject(projectId) });
        },
        onError: commonErrorHandler,
    });
}