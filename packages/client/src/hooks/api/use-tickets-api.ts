import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { commonErrorHandler } from './common-mutation-error-handler';
import {
    postApiTicketsMutation,
    patchApiTicketsByTicketIdMutation,
    deleteApiTicketsByTicketIdMutation,
    getApiTicketsByTicketIdQueryKey,
    getApiProjectsByProjectIdTicketsOptions,
    getApiProjectsByProjectIdTicketsQueryKey,
    getApiProjectsByProjectIdTicketsWithCountOptions,
    getApiProjectsByProjectIdTicketsWithCountQueryKey,
    getApiTicketsByTicketIdTasksOptions,
    getApiTicketsByTicketIdTasksQueryKey,
    postApiTicketsByTicketIdTasksMutation,
    deleteApiTicketsByTicketIdTasksByTaskIdMutation,
    patchApiTicketsByTicketIdTasksByTaskIdMutation,
    patchApiTicketsByTicketIdTasksReorderMutation,
    postApiTicketsByTicketIdAutoGenerateTasksMutation,
    getApiTicketsBulkTasksOptions,
    getApiTicketsBulkTasksQueryKey,
    getApiProjectsByProjectIdTicketsWithTasksOptions,
    getApiProjectsByProjectIdTicketsWithTasksQueryKey,
    postApiTicketsByTicketIdLinkFilesMutation,
    postApiTicketsByTicketIdSuggestFilesMutation,
    postApiTicketsByTicketIdSuggestTasksMutation
} from '../generated/@tanstack/react-query.gen';
import type {
    CreateTicketBody,
    UpdateTicketBody,
    GetApiTicketsByTicketIdData,
    PatchApiTicketsByTicketIdData,
    PatchApiTicketsByTicketIdError,
    DeleteApiTicketsByTicketIdData,
    DeleteApiTicketsByTicketIdError,
    GetApiProjectsByProjectIdTicketsData,
    GetApiProjectsByProjectIdTicketsWithCountData,
    GetApiTicketsByTicketIdTasksData,
    PostApiTicketsByTicketIdTasksData,
    PostApiTicketsByTicketIdTasksError,
    DeleteApiTicketsByTicketIdTasksByTaskIdData,
    DeleteApiTicketsByTicketIdTasksByTaskIdError,
    PatchApiTicketsByTicketIdTasksByTaskIdData,
    PatchApiTicketsByTicketIdTasksByTaskIdError,
    PatchApiTicketsByTicketIdTasksReorderData,
    PatchApiTicketsByTicketIdTasksReorderError,
    PostApiTicketsByTicketIdAutoGenerateTasksData,
    PostApiTicketsByTicketIdAutoGenerateTasksError,
    GetApiTicketsBulkTasksData,
    GetApiProjectsByProjectIdTicketsWithTasksData,
    PostApiTicketsByTicketIdLinkFilesData,
    PostApiTicketsByTicketIdLinkFilesError,
    PostApiTicketsByTicketIdSuggestFilesData,
    PostApiTicketsByTicketIdSuggestFilesError,
    SuggestedFilesResponse,
    PostApiTicketsByTicketIdSuggestTasksData,
    PostApiTicketsByTicketIdSuggestTasksError,
    PostApiTicketsData,
    PostApiTicketsError
} from '../generated/types.gen';
import { Options } from '../generated/sdk.gen';

const TICKET_KEYS = {
    all: ['tickets'] as const,
    listByProject: (projectId: string) =>
        getApiProjectsByProjectIdTicketsQueryKey({ path: { projectId } } as Options<GetApiProjectsByProjectIdTicketsData>),
    listWithCount: (projectId: string, status?: string) =>
        getApiProjectsByProjectIdTicketsWithCountQueryKey({
            path: { projectId },
            query: status && status !== "all" ? { status } : undefined
        } as Options<GetApiProjectsByProjectIdTicketsWithCountData>),
    detail: (ticketId: string) =>
        getApiTicketsByTicketIdQueryKey({ path: { ticketId } } as Options<GetApiTicketsByTicketIdData>),
    tasks: (ticketId: string) =>
        getApiTicketsByTicketIdTasksQueryKey({ path: { ticketId } } as Options<GetApiTicketsByTicketIdTasksData>),
    bulkTasks: (ticketIds: string[]) =>
        getApiTicketsBulkTasksQueryKey({ query: { ids: ticketIds.join(',') } } as Options<GetApiTicketsBulkTasksData>),
    listWithTasks: (projectId: string, status?: string) =>
        getApiProjectsByProjectIdTicketsWithTasksQueryKey({
            path: { projectId },
            query: status && status !== "all" ? { status } : undefined
        } as Options<GetApiProjectsByProjectIdTicketsWithTasksData>),
};

// List tickets by project
export function useListTickets(projectId: string, status?: string) {
    const queryOptions = getApiProjectsByProjectIdTicketsOptions({
        path: { projectId },
        query: status ? { status } : undefined
    } as Options<GetApiProjectsByProjectIdTicketsData>);

    return useQuery({
        ...queryOptions,
        enabled: !!projectId,
    });
}

export function useListTicketsWithCount(projectId: string, status?: string) {
    const queryOptions = getApiProjectsByProjectIdTicketsWithCountOptions({
        path: { projectId },
        query: status && status !== "all" ? { status } : undefined
    } as Options<GetApiProjectsByProjectIdTicketsWithCountData>);

    return useQuery({
        ...queryOptions,
        enabled: !!projectId,
    });
}

// Create a new ticket
export function useCreateTicket() {
    const queryClient = useQueryClient();
    const mutationOptions = postApiTicketsMutation();

    return useMutation<unknown, PostApiTicketsError, CreateTicketBody>({
        mutationFn: (body: CreateTicketBody) => {
            const opts: Options<PostApiTicketsData> = { body };
            return mutationOptions.mutationFn!(opts);
        },
        onSuccess: (data: any) => {
            // Invalidate all ticket queries for this project
            if (data.ticket?.projectId) {
                queryClient.invalidateQueries({
                    queryKey: TICKET_KEYS.all,
                    refetchType: 'all'
                });
            }
        },
        onError: (error) => commonErrorHandler(error as unknown as Error),
    });
}

// Update a ticket
export function useUpdateTicket() {
    const queryClient = useQueryClient();
    const mutationOptions = patchApiTicketsByTicketIdMutation();

    return useMutation<unknown, PatchApiTicketsByTicketIdError, { ticketId: string; updates: UpdateTicketBody }>({
        mutationFn: ({ ticketId, updates }) => {
            const opts: Options<PatchApiTicketsByTicketIdData> = {
                path: { ticketId },
                body: updates
            };
            return mutationOptions.mutationFn!(opts);
        },
        onSuccess: (data: any) => {
            // Invalidate all ticket queries for this project
            if (data.ticket?.projectId) {
                queryClient.invalidateQueries({
                    queryKey: TICKET_KEYS.all,
                    refetchType: 'all'
                });
            }
        },
        onError: (error) => commonErrorHandler(error as unknown as Error),
    });
}

export function useDeleteTicket() {
    const queryClient = useQueryClient();
    const mutationOptions = deleteApiTicketsByTicketIdMutation();

    return useMutation<unknown, DeleteApiTicketsByTicketIdError, string>({
        mutationFn: (ticketId: string) => {
            const opts: Options<DeleteApiTicketsByTicketIdData> = { path: { ticketId } };
            return mutationOptions.mutationFn!(opts);
        },
        onSuccess: (data, ticketId) => {
            queryClient.invalidateQueries({
                queryKey: TICKET_KEYS.all,
                refetchType: 'all'
            });

            queryClient.invalidateQueries({
                queryKey: TICKET_KEYS.detail(ticketId)
            });

            queryClient.invalidateQueries({
                queryKey: TICKET_KEYS.tasks(ticketId)
            });
        },
        onError: (error) => commonErrorHandler(error as unknown as Error),
    });
}

export function useLinkFilesToTicket() {
    const queryClient = useQueryClient();
    const mutationOptions = postApiTicketsByTicketIdLinkFilesMutation();

    return useMutation<unknown, PostApiTicketsByTicketIdLinkFilesError, { ticketId: string; fileIds: string[] }>({
        mutationFn: ({ ticketId, fileIds }) => {
            const opts: Options<PostApiTicketsByTicketIdLinkFilesData> = {
                path: { ticketId },
                body: { fileIds }
            };
            return mutationOptions.mutationFn!(opts);
        },
        onSuccess: (data, { ticketId }) => {
            queryClient.invalidateQueries({
                queryKey: TICKET_KEYS.detail(ticketId)
            });
        },
        onError: (error) => commonErrorHandler(error as unknown as Error),
    });
}

export function useSuggestTasksForTicket() {
    const mutationOptions = postApiTicketsByTicketIdSuggestTasksMutation();

    return useMutation<unknown, PostApiTicketsByTicketIdSuggestTasksError, { ticketId: string; userContext?: string }>({
        mutationFn: ({ ticketId, userContext }) => {
            const opts: Options<PostApiTicketsByTicketIdSuggestTasksData> = {
                path: { ticketId },
                body: userContext ? { userContext } : undefined
            };
            return mutationOptions.mutationFn!(opts);
        },
        onError: (error) => commonErrorHandler(error as unknown as Error),
    });
}

export function useListTasks(ticketId: string) {
    const queryOptions = getApiTicketsByTicketIdTasksOptions({
        path: { ticketId }
    } as Options<GetApiTicketsByTicketIdTasksData>);

    return useQuery({
        ...queryOptions,
        enabled: !!ticketId,
    });
}

export function useCreateTask() {
    const queryClient = useQueryClient();
    const mutationOptions = postApiTicketsByTicketIdTasksMutation();

    return useMutation<unknown, PostApiTicketsByTicketIdTasksError, { ticketId: string; content: string }>({
        mutationFn: ({ ticketId, content }) => {
            const opts: Options<PostApiTicketsByTicketIdTasksData> = {
                path: { ticketId },
                body: { content }
            };
            return mutationOptions.mutationFn!(opts);
        },
        onSuccess: (data, { ticketId }) => {
            queryClient.invalidateQueries({
                queryKey: TICKET_KEYS.tasks(ticketId)
            });
        },
        onError: (error) => commonErrorHandler(error as unknown as Error),
    });
}

export function useUpdateTask() {
    const queryClient = useQueryClient();
    const mutationOptions = patchApiTicketsByTicketIdTasksByTaskIdMutation();

    return useMutation<unknown, PatchApiTicketsByTicketIdTasksByTaskIdError,
        { ticketId: string; taskId: string; updates: Partial<{ content: string; done: boolean }> }>({
            mutationFn: ({ ticketId, taskId, updates }) => {
                const opts: Options<PatchApiTicketsByTicketIdTasksByTaskIdData> = {
                    path: { ticketId, taskId },
                    body: updates
                };
                return mutationOptions.mutationFn!(opts);
            },
            onSuccess: (data, { ticketId }) => {
                queryClient.invalidateQueries({
                    queryKey: TICKET_KEYS.tasks(ticketId)
                });
            },
            onError: (error) => commonErrorHandler(error as unknown as Error),
        });
}

export function useDeleteTask() {
    const queryClient = useQueryClient();
    const mutationOptions = deleteApiTicketsByTicketIdTasksByTaskIdMutation();

    return useMutation<unknown, DeleteApiTicketsByTicketIdTasksByTaskIdError, { ticketId: string; taskId: string }>({
        mutationFn: ({ ticketId, taskId }) => {
            const opts: Options<DeleteApiTicketsByTicketIdTasksByTaskIdData> = {
                path: { ticketId, taskId }
            };
            return mutationOptions.mutationFn!(opts);
        },
        onSuccess: (data, { ticketId }) => {
            queryClient.invalidateQueries({
                queryKey: TICKET_KEYS.tasks(ticketId)
            });
        },
        onError: (error) => commonErrorHandler(error as unknown as Error),
    });
}

export function useReorderTasks() {
    const queryClient = useQueryClient();
    const mutationOptions = patchApiTicketsByTicketIdTasksReorderMutation();

    return useMutation<unknown, PatchApiTicketsByTicketIdTasksReorderError,
        { ticketId: string; tasks: Array<{ taskId: string; orderIndex: number }> }>({
            mutationFn: ({ ticketId, tasks }) => {
                const opts: Options<PatchApiTicketsByTicketIdTasksReorderData> = {
                    path: { ticketId },
                    body: { tasks }
                };
                return mutationOptions.mutationFn!(opts);
            },
            onSuccess: (data, { ticketId }) => {
                queryClient.invalidateQueries({
                    queryKey: TICKET_KEYS.tasks(ticketId)
                });
            },
            onError: (error) => commonErrorHandler(error as unknown as Error),
        });
}

export function useAutoGenerateTasks() {
    const queryClient = useQueryClient();
    const mutationOptions = postApiTicketsByTicketIdAutoGenerateTasksMutation();

    return useMutation<unknown, PostApiTicketsByTicketIdAutoGenerateTasksError, { ticketId: string }>({
        mutationFn: ({ ticketId }) => {
            const opts: Options<PostApiTicketsByTicketIdAutoGenerateTasksData> = {
                path: { ticketId }
            };
            return mutationOptions.mutationFn!(opts);
        },
        onSuccess: (data, { ticketId }) => {
            queryClient.invalidateQueries({
                queryKey: TICKET_KEYS.tasks(ticketId)
            });
        },
        onError: (error) => commonErrorHandler(error as unknown as Error),
    });
}

export function useBulkTicketTasks(ticketIds: string[]) {
    const queryClient = useQueryClient();
    const queryOptions = getApiTicketsBulkTasksOptions({
        query: { ids: ticketIds.join(',') }
    } as Options<GetApiTicketsBulkTasksData>);

    return useQuery({
        ...queryOptions,
        enabled: ticketIds.length > 0,
        select: (data: any) => {
            // Prefill the cache for individual ticket tasks
            if (data.tasks) {
                Object.entries(data.tasks).forEach(([ticketId, tasks]) => {
                    queryClient.setQueryData(
                        TICKET_KEYS.tasks(ticketId),
                        { success: true, tasks }
                    );
                });
            }
            return data;
        }
    });
}

export function useListTicketsWithTasks(projectId: string, status?: string) {
    const queryOptions = getApiProjectsByProjectIdTicketsWithTasksOptions({
        path: { projectId },
        query: status && status !== 'all' ? { status } : undefined
    } as Options<GetApiProjectsByProjectIdTicketsWithTasksData>);

    return useQuery({
        ...queryOptions,
        enabled: !!projectId,
    });
}

export function useSuggestFilesForTicket(ticketId: string) {
    const mutationOptions = postApiTicketsByTicketIdSuggestFilesMutation();

    return useMutation<SuggestedFilesResponse, PostApiTicketsByTicketIdSuggestFilesError, { extraUserInput?: string }>({
        mutationFn: ({ extraUserInput }) => {
            const opts: Options<PostApiTicketsByTicketIdSuggestFilesData> = {
                path: { ticketId },
                body: extraUserInput ? { extraUserInput } : undefined
            };
            return mutationOptions.mutationFn!(opts) as Promise<SuggestedFilesResponse>;
        },
        onError: (error) => commonErrorHandler(error as unknown as Error),
    });
}