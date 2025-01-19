import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../use-api';
import { CreateTicketBody, UpdateTicketBody } from 'shared';
import { Ticket, TicketTask } from 'shared/schema';
import { commonErrorHandler } from './common-mutation-error-handler';

export interface TicketWithCount extends Ticket {
    taskCount: number;
}

export interface TicketResult {
    success: boolean;
    ticket?: Ticket;
    tickets?: Ticket[];
    message?: string;
    linkedFiles?: any[];
    suggestedTasks?: string[];
    tasks?: TicketTask[];
    task?: TicketTask;
    ticketsWithCount?: TicketWithCount[];
    ticketsWithTasks?: TicketWithTasks[];
}


export interface TicketWithTasks extends Ticket {
    tasks: TicketTask[];
}

export const TICKET_KEYS = {
    all: ['tickets'] as const,
    listByProject: (projectId: string) => [...TICKET_KEYS.all, 'list', projectId] as const,
    listWithCount: (projectId: string) => [...TICKET_KEYS.all, 'list-with-count', projectId] as const,
    detail: (ticketId: string) => [...TICKET_KEYS.all, 'detail', ticketId] as const,
    tasks: (ticketId: string) => [...TICKET_KEYS.detail(ticketId), 'tasks'] as const,
    bulkTasks: (ticketIds: string[]) => [...TICKET_KEYS.all, 'bulk-tasks', ticketIds.join(',')] as const,
    listWithTasks: (projectId: string) => [...TICKET_KEYS.all, 'list-with-tasks', projectId] as const,
};

// List tickets by project
export function useListTickets(projectId: string, status?: string) {
    const { api } = useApi();
    return useQuery({
        queryKey: TICKET_KEYS.listByProject(projectId),
        queryFn: async () => {
            const qs = status ? `?status=${status}` : '';
            const resp = await api.request(`/api/projects/${projectId}/tickets${qs}`);
            return resp.json() as Promise<TicketResult>;
        },
        enabled: !!projectId,
    });
}

export function useListTicketsWithCount(projectId: string, status?: string) {
    const { api } = useApi();
    return useQuery({
        queryKey: TICKET_KEYS.listWithCount(projectId).concat(status || 'all'),
        queryFn: async () => {
            const qs = status && status !== "all" ? `?status=${status}` : '';
            const resp = await api.request(`/api/projects/${projectId}/tickets-with-count${qs}`);
            const data = await resp.json() as TicketResult;
            return data;
        },
        enabled: !!projectId,
    });
}

// Create a new ticket
export function useCreateTicket() {
    const { api } = useApi();
    const queryClient = useQueryClient();

    return useMutation<TicketResult, Error, CreateTicketBody>({
        mutationFn: async (body) => {
            const resp = await api.request('/api/tickets', {
                method: 'POST',
                body,
            });
            return resp.json();
        },
        onSuccess: (data) => {
            // Invalidate all ticket queries for this project
            if (data.ticket?.projectId) {
                queryClient.invalidateQueries({
                    queryKey: TICKET_KEYS.all,
                    refetchType: 'all'
                });
            }
        },
        onError: commonErrorHandler
    });
}

// Update a ticket
export function useUpdateTicket() {
    const { api } = useApi();
    const queryClient = useQueryClient();

    return useMutation<TicketResult, Error, { ticketId: string; updates: UpdateTicketBody }>({
        mutationFn: async ({ ticketId, updates }) => {
            const resp = await api.request(`/api/tickets/${ticketId}`, {
                method: 'PATCH',
                body: updates,
            });
            return resp.json();
        },
        onSuccess: (data) => {
            // Invalidate all ticket queries for this project
            if (data.ticket?.projectId) {
                queryClient.invalidateQueries({
                    queryKey: TICKET_KEYS.all,
                    refetchType: 'all'
                });
            }
        },
        onError: commonErrorHandler
    });
}

// Link files to ticket
export function useLinkFilesToTicket() {
    const { api } = useApi();
    return useMutation<TicketResult, Error, { ticketId: string; fileIds: string[] }>({
        mutationFn: async ({ ticketId, fileIds }) => {
            const resp = await api.request(`/api/tickets/${ticketId}/link-files`, {
                method: 'POST',
                body: { fileIds },
            });
            return resp.json();
        },
        onError: commonErrorHandler
    });
}

// Suggest tasks
export function useSuggestTasksForTicket() {
    const { api } = useApi();
    return useMutation<TicketResult, Error, { ticketId: string; userContext?: string }>({
        mutationFn: async ({ ticketId, userContext }) => {
            const resp = await api.request(`/api/tickets/${ticketId}/suggest-tasks`, {
                method: 'POST',
                body: { userContext },
            });
            return resp.json();
        },
        onError: commonErrorHandler
    });
}

/** --- TASKS --- **/
export function useListTasks(ticketId: string) {
    const { api } = useApi();
    return useQuery({
        queryKey: TICKET_KEYS.tasks(ticketId),
        queryFn: async () => {
            const resp = await api.request(`/api/tickets/${ticketId}/tasks`);
            return resp.json() as Promise<TicketResult>;
        },
        enabled: !!ticketId,
    });
}

export function useCreateTask() {
    const { api } = useApi();
    const queryClient = useQueryClient();
    return useMutation<
        TicketResult,
        Error,
        { ticketId: string; content: string }
    >({
        mutationFn: async ({ ticketId, content }) => {
            const resp = await api.request(`/api/tickets/${ticketId}/tasks`, {
                method: 'POST',
                body: { content },
            });
            return resp.json();
        },
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({
                queryKey: TICKET_KEYS.tasks(variables.ticketId)
            });
        },
        onError: commonErrorHandler,
    });
}

export function useUpdateTask() {
    const { api } = useApi();
    const queryClient = useQueryClient();
    return useMutation<
        TicketResult,
        Error,
        { ticketId: string; taskId: string; updates: Partial<{ content: string; done: boolean }> }
    >({
        mutationFn: async ({ ticketId, taskId, updates }) => {
            const resp = await api.request(`/api/tickets/${ticketId}/tasks/${taskId}`, {
                method: 'PATCH',
                body: updates,
            });
            return resp.json();
        },
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({
                queryKey: TICKET_KEYS.tasks(variables.ticketId)
            });
        },
        onError: commonErrorHandler,
    });
}

export function useDeleteTask() {
    const { api } = useApi();
    const queryClient = useQueryClient();
    return useMutation<
        TicketResult,
        Error,
        { ticketId: string; taskId: string }
    >({
        mutationFn: async ({ ticketId, taskId }) => {
            const resp = await api.request(`/api/tickets/${ticketId}/tasks/${taskId}`, {
                method: 'DELETE',
            });
            return resp.json();
        },
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({
                queryKey: TICKET_KEYS.tasks(variables.ticketId)
            });
        },
        onError: commonErrorHandler,
    });
}

export function useReorderTasks() {
    const { api } = useApi();
    const queryClient = useQueryClient();
    return useMutation<
        TicketResult,
        Error,
        { ticketId: string; tasks: Array<{ taskId: string; orderIndex: number }> }
    >({
        mutationFn: async ({ ticketId, tasks }) => {
            const resp = await api.request(`/api/tickets/${ticketId}/tasks/reorder`, {
                method: 'PATCH',
                body: { tasks },
            });
            return resp.json();
        },
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({
                queryKey: TICKET_KEYS.tasks(variables.ticketId)
            });
        },
        onError: commonErrorHandler,
    });
}

export function useAutoGenerateTasks() {
    const { api } = useApi();
    const queryClient = useQueryClient();
    return useMutation<
        TicketResult,
        Error,
        { ticketId: string }
    >({
        mutationFn: async ({ ticketId }) => {
            const resp = await api.request(`/api/tickets/${ticketId}/auto-generate-tasks`, {
                method: 'POST',
            });
            return resp.json();
        },
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({
                queryKey: TICKET_KEYS.tasks(variables.ticketId)
            });
        },
        onError: commonErrorHandler,
    });
};

/**
 * Hook to fetch tasks for multiple tickets at once
 */
export function useBulkTicketTasks(ticketIds: string[]) {
    const { api } = useApi();
    const queryClient = useQueryClient();

    return useQuery({
        queryKey: TICKET_KEYS.bulkTasks(ticketIds),
        queryFn: async () => {
            if (!ticketIds.length) return { tasks: {} };
            const resp = await api.request(`/api/tickets/bulk-tasks?ids=${ticketIds.join(',')}`);
            const data = await resp.json() as { success: boolean; tasks: Record<string, TicketTask[]> };

            // Prefill the cache for individual ticket tasks
            Object.entries(data.tasks).forEach(([ticketId, tasks]) => {
                queryClient.setQueryData(
                    TICKET_KEYS.tasks(ticketId),
                    { success: true, tasks }
                );
            });

            return data;
        },
        enabled: ticketIds.length > 0,
    });
}

/**
 * List all tickets for a project with their tasks included.
 */
export function useListTicketsWithTasks(
    projectId: string,
    status?: string
) {
    const { api } = useApi();
    return useQuery({
        queryKey: TICKET_KEYS.listWithTasks(projectId).concat(status || 'all'),
        queryFn: async () => {
            const qs = status && status !== 'all' ? `?status=${status}` : '';
            const resp = await api.request(`/api/projects/${projectId}/tickets-with-tasks${qs}`);
            const data: TicketResult = await resp.json();
            return data;
        },
        enabled: !!projectId,
    });
}