// Last 5 changes: Created comprehensive ticket API hooks following Promptliano patterns
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CreateTicketBody,
  UpdateTicketBody,
  CreateTaskBody,
  UpdateTaskBody,
  ReorderTasksBody,
  Ticket,
  TicketTask,
  TicketWithTasks,
  TicketWithTaskCount
} from '@promptliano/schemas'
import { commonErrorHandler } from './common-mutation-error-handler'
import { promptlianoClient } from '../promptliano-client'
import { TICKETS_STALE_TIME, RETRY_MAX_ATTEMPTS, RETRY_MAX_DELAY } from '@/lib/constants'

// Query keys for caching
export const TICKET_KEYS = {
  all: ['tickets'] as const,
  lists: () => [...TICKET_KEYS.all, 'list'] as const,
  list: (projectId: number, status?: string) => [...TICKET_KEYS.lists(), { projectId, status }] as const,
  details: () => [...TICKET_KEYS.all, 'detail'] as const,
  detail: (ticketId: number) => [...TICKET_KEYS.details(), ticketId] as const,
  tasks: (ticketId: number) => [...TICKET_KEYS.all, 'tasks', ticketId] as const,
  withTasks: (projectId: number, status?: string) => [...TICKET_KEYS.all, 'withTasks', { projectId, status }] as const,
  withCounts: (projectId: number, status?: string) =>
    [...TICKET_KEYS.all, 'withCounts', { projectId, status }] as const,
  projectTickets: (projectId: number) => [...TICKET_KEYS.all, 'project', projectId] as const
}

// --- Ticket Invalidation Utilities ---
export function useInvalidateTickets() {
  const queryClient = useQueryClient()

  return {
    // Invalidate all ticket-related queries
    invalidateAllTickets: () => {
      queryClient.invalidateQueries({ queryKey: TICKET_KEYS.all })
    },

    // Invalidate all tickets for a specific project
    invalidateProjectTickets: (projectId: number) => {
      queryClient.invalidateQueries({ queryKey: TICKET_KEYS.list(projectId) })
      queryClient.invalidateQueries({ queryKey: TICKET_KEYS.withTasks(projectId) })
      queryClient.invalidateQueries({ queryKey: TICKET_KEYS.withCounts(projectId) })
      queryClient.invalidateQueries({ queryKey: TICKET_KEYS.projectTickets(projectId) })
    },

    // Invalidate specific ticket detail
    invalidateTicket: (ticketId: number) => {
      queryClient.invalidateQueries({ queryKey: TICKET_KEYS.detail(ticketId) })
    },

    // Invalidate tasks for a ticket
    invalidateTicketTasks: (ticketId: number) => {
      queryClient.invalidateQueries({ queryKey: TICKET_KEYS.tasks(ticketId) })
    },

    // Remove ticket from cache completely
    removeTicket: (ticketId: number) => {
      queryClient.removeQueries({ queryKey: TICKET_KEYS.detail(ticketId) })
      queryClient.removeQueries({ queryKey: TICKET_KEYS.tasks(ticketId) })
    },

    // Set specific ticket detail in the cache
    setTicketDetail: (ticket: Ticket) => {
      queryClient.setQueryData(TICKET_KEYS.detail(ticket.id), ticket)
    },

    // Invalidate all data related to a ticket
    invalidateTicketData: (ticketId: number) => {
      queryClient.invalidateQueries({ queryKey: TICKET_KEYS.detail(ticketId) })
      queryClient.invalidateQueries({ queryKey: TICKET_KEYS.tasks(ticketId) })
    }
  }
}

// Hook exports

// Ticket queries
export function useGetTickets(projectId: number, status?: string) {
  return useQuery({
    queryKey: TICKET_KEYS.list(projectId, status),
    queryFn: async () => {
      const response = await promptlianoClient.tickets.listTickets(projectId, status)
      return response.data
    },
    enabled: !!projectId,
    staleTime: TICKETS_STALE_TIME
  })
}

export function useGetTicket(ticketId: number) {
  return useQuery({
    queryKey: TICKET_KEYS.detail(ticketId),
    queryFn: async () => {
      const response = await promptlianoClient.tickets.getTicket(ticketId)
      return response.data
    },
    enabled: !!ticketId,
    staleTime: 2 * 60 * 1000 // 2 minutes
  })
}

export function useGetTicketsWithCounts(projectId: number, status?: string) {
  return useQuery({
    queryKey: TICKET_KEYS.withCounts(projectId, status),
    queryFn: async () => {
      const response = await promptlianoClient.tickets.getTicketsWithCounts(projectId, status)
      return response.data
    },
    enabled: !!projectId,
    staleTime: TICKETS_STALE_TIME
  })
}

export function useGetTicketsWithTasks(projectId: number, status?: string) {
  return useQuery({
    queryKey: TICKET_KEYS.withTasks(projectId, status),
    queryFn: async () => {
      try {
        const response = await promptlianoClient.tickets.getTicketsWithTasks(projectId, status)
        return response.data || []
      } catch (error) {
        // Re-throw to let React Query handle the error
        throw error
      }
    },
    enabled: !!projectId,
    staleTime: TICKETS_STALE_TIME,
    retry: RETRY_MAX_ATTEMPTS,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, RETRY_MAX_DELAY)
  })
}

// Task queries
export function useGetTasks(ticketId: number) {
  return useQuery({
    queryKey: TICKET_KEYS.tasks(ticketId),
    queryFn: async () => {
      const response = await promptlianoClient.tickets.getTasks(ticketId)
      return response.data
    },
    enabled: !!ticketId,
    staleTime: TICKETS_STALE_TIME
  })
}

// Ticket mutations
export function useCreateTicket() {
  const { invalidateProjectTickets, setTicketDetail } = useInvalidateTickets()

  return useMutation({
    mutationFn: async (data: CreateTicketBody) => {
      const response = await promptlianoClient.tickets.createTicket(data)
      return response.data
    },
    onSuccess: (ticket) => {
      // Invalidate all ticket lists for the project
      invalidateProjectTickets(ticket.projectId)
      // Set the new ticket in cache
      setTicketDetail(ticket)
    },
    onError: commonErrorHandler
  })
}

export function useUpdateTicket() {
  const { invalidateProjectTickets, setTicketDetail } = useInvalidateTickets()

  return useMutation({
    mutationFn: async ({ ticketId, data }: { ticketId: number; data: UpdateTicketBody }) => {
      const response = await promptlianoClient.tickets.updateTicket(ticketId, data)
      return response.data
    },
    onSuccess: (ticket) => {
      // Update the specific ticket in cache
      setTicketDetail(ticket)
      // Invalidate all ticket lists for the project
      invalidateProjectTickets(ticket.projectId)
    },
    onError: commonErrorHandler
  })
}

export function useDeleteTicket() {
  const { invalidateAllTickets, removeTicket } = useInvalidateTickets()

  return useMutation({
    mutationFn: async ({ ticketId, projectId }: { ticketId: number; projectId: number }) => {
      await promptlianoClient.tickets.deleteTicket(ticketId)
      return { ticketId, projectId }
    },
    onSuccess: ({ ticketId, projectId }) => {
      // Remove the specific ticket from cache
      removeTicket(ticketId)
      // Invalidate all ticket lists for the project
      invalidateAllTickets()
    },
    onError: commonErrorHandler
  })
}

// Task mutations
export function useCreateTask() {
  const { invalidateTicketTasks, invalidateAllTickets } = useInvalidateTickets()

  return useMutation({
    mutationFn: async ({ ticketId, data }: { ticketId: number; data: CreateTaskBody }) => {
      const response = await promptlianoClient.tickets.createTask(ticketId, data)
      return response.data
    },
    onSuccess: (task) => {
      // Invalidate tasks for this ticket
      invalidateTicketTasks(task.ticketId)
      // Invalidate all ticket queries to update counts
      invalidateAllTickets()
    },
    onError: commonErrorHandler
  })
}

export function useUpdateTask() {
  const { invalidateTicketTasks, invalidateAllTickets } = useInvalidateTickets()

  return useMutation({
    mutationFn: async ({ ticketId, taskId, data }: { ticketId: number; taskId: number; data: UpdateTaskBody }) => {
      const response = await promptlianoClient.tickets.updateTask(ticketId, taskId, data)
      return response.data
    },
    onSuccess: (task) => {
      // Invalidate tasks for this ticket
      invalidateTicketTasks(task.ticketId)
      // Invalidate all ticket queries to update counts
      invalidateAllTickets()
    },
    onError: commonErrorHandler
  })
}

export function useDeleteTask() {
  const { invalidateTicketTasks, invalidateAllTickets } = useInvalidateTickets()

  return useMutation({
    mutationFn: async ({ ticketId, taskId }: { ticketId: number; taskId: number }) => {
      await promptlianoClient.tickets.deleteTask(ticketId, taskId)
      return { ticketId, taskId }
    },
    onSuccess: ({ ticketId }) => {
      // Invalidate tasks for this ticket
      invalidateTicketTasks(ticketId)
      // Invalidate all ticket queries to update counts
      invalidateAllTickets()
    },
    onError: commonErrorHandler
  })
}

export function useReorderTasks() {
  const queryClient = useQueryClient()
  const { invalidateAllTickets } = useInvalidateTickets()

  return useMutation({
    mutationFn: async ({ ticketId, data }: { ticketId: number; data: ReorderTasksBody }) => {
      const response = await promptlianoClient.tickets.reorderTasks(ticketId, data)
      return response.data
    },
    onSuccess: (tasks, { ticketId }) => {
      // Update tasks in cache with the new order
      queryClient.setQueryData(TICKET_KEYS.tasks(ticketId), tasks)
      // Invalidate all ticket queries to ensure consistency
      invalidateAllTickets()
    },
    onError: commonErrorHandler
  })
}

// AI-powered mutations
export function useSuggestTasks() {
  return useMutation({
    mutationFn: async ({ ticketId, userContext }: { ticketId: number; userContext?: string }) => {
      const response = await promptlianoClient.tickets.suggestTasks(ticketId, userContext)
      return response.data.suggestedTasks
    },
    onError: commonErrorHandler
  })
}

export function useAutoGenerateTasks() {
  const { invalidateTicketTasks, invalidateAllTickets } = useInvalidateTickets()

  return useMutation({
    mutationFn: async (ticketId: number) => {
      const response = await promptlianoClient.tickets.autoGenerateTasks(ticketId)
      return response.data
    },
    onSuccess: (tasks) => {
      if (tasks.length > 0) {
        const ticketId = tasks[0].ticketId
        // Invalidate tasks for this ticket
        invalidateTicketTasks(ticketId)
        // Invalidate all ticket queries to update counts
        invalidateAllTickets()
      }
    },
    onError: commonErrorHandler
  })
}

export function useSuggestFiles() {
  return useMutation({
    mutationFn: async ({ ticketId, extraUserInput }: { ticketId: number; extraUserInput?: string }) => {
      const response = await promptlianoClient.tickets.suggestFiles(ticketId, extraUserInput)
      return response.data
    },
    onError: commonErrorHandler
  })
}
