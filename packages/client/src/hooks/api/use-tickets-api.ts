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
import { useApiClient } from './use-api-client'
import { TICKETS_STALE_TIME, RETRY_MAX_ATTEMPTS, RETRY_MAX_DELAY } from '@/lib/constants'
import { toast } from 'sonner'

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

    // Invalidate all tickets for a specific project (any status/variant)
    invalidateProjectTickets: (projectId: number) => {
      // Broadly invalidate any tickets queries scoped to this project
      queryClient.invalidateQueries({
        queryKey: TICKET_KEYS.all,
        exact: false,
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === 'tickets' &&
          query.queryKey.some(
            (key) =>
              typeof key === 'object' && key !== null && 'projectId' in key && (key as any).projectId === projectId
          )
      })
      // Also directly invalidate aggregate/project lists
      queryClient.invalidateQueries({ queryKey: TICKET_KEYS.projectTickets(projectId), exact: false })
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

// Ticket queries
export function useGetTickets(projectId: number, status?: string) {
  const client = useApiClient()

  return useQuery({
    queryKey: TICKET_KEYS.list(projectId, status),
    queryFn: async () => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.tickets.listTickets(projectId, status)
      return response.data
    },
    enabled: !!client && !!projectId,
    staleTime: TICKETS_STALE_TIME
  })
}

export function useGetTicket(ticketId: number) {
  const client = useApiClient()

  return useQuery({
    queryKey: TICKET_KEYS.detail(ticketId),
    queryFn: async () => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.tickets.getTicket(ticketId)
      return response.data
    },
    enabled: !!client && !!ticketId,
    staleTime: 2 * 60 * 1000 // 2 minutes
  })
}

export function useGetTicketsWithCounts(projectId: number, status?: string) {
  const client = useApiClient()

  return useQuery({
    queryKey: TICKET_KEYS.withCounts(projectId, status),
    queryFn: async () => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.tickets.getTicketsWithCounts(projectId, status)
      return response.data
    },
    enabled: !!client && !!projectId,
    staleTime: TICKETS_STALE_TIME
  })
}

export function useGetTicketsWithTasks(projectId: number, status?: string) {
  const client = useApiClient()

  return useQuery({
    queryKey: TICKET_KEYS.withTasks(projectId, status),
    queryFn: async () => {
      if (!client) throw new Error('API client not initialized')
      try {
        const response = await client.tickets.getTicketsWithTasks(projectId, status)
        return response.data || []
      } catch (error) {
        // Re-throw to let React Query handle the error
        throw error
      }
    },
    enabled: !!client && !!projectId,
    staleTime: TICKETS_STALE_TIME,
    retry: RETRY_MAX_ATTEMPTS,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, RETRY_MAX_DELAY)
  })
}

// Task queries
export function useGetTasks(ticketId: number) {
  const client = useApiClient()

  return useQuery({
    queryKey: TICKET_KEYS.tasks(ticketId),
    queryFn: async () => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.tickets.getTasks(ticketId)
      return response.data
    },
    enabled: !!client && !!ticketId,
    staleTime: TICKETS_STALE_TIME
  })
}

// Ticket mutations
export function useCreateTicket() {
  const client = useApiClient()
  const { invalidateProjectTickets, setTicketDetail } = useInvalidateTickets()

  return useMutation({
    mutationFn: async (data: CreateTicketBody) => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.tickets.createTicket(data)
      return response.data
    },
    onSuccess: (ticket) => {
      invalidateProjectTickets(ticket.projectId)
      setTicketDetail(ticket)
      toast.success('Ticket created successfully')
    },
    onError: commonErrorHandler
  })
}

export function useUpdateTicket() {
  const client = useApiClient()
  const queryClient = useQueryClient()
  const { invalidateProjectTickets, setTicketDetail, invalidateTicketData } = useInvalidateTickets()

  return useMutation({
    mutationFn: async ({ ticketId, data }: { ticketId: number; data: UpdateTicketBody }) => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.tickets.updateTicket(ticketId, data)
      return response.data
    },
    onSuccess: (ticket) => {
      setTicketDetail(ticket)
      invalidateTicketData(ticket.id)
      invalidateProjectTickets(ticket.projectId)
      
      // Also invalidate the specific ticket with tasks query
      queryClient.invalidateQueries({
        queryKey: ['tickets', 'withTasks', { projectId: ticket.projectId }],
        exact: false
      })
      
      // Invalidate any queries that might contain this ticket
      queryClient.invalidateQueries({
        queryKey: ['tickets'],
        predicate: (query) => {
          return query.queryKey.some(
            (key) => typeof key === 'object' && key !== null && 'projectId' in key && key.projectId === ticket.projectId
          )
        }
      })
      
      toast.success('Ticket updated successfully')
    },
    onError: commonErrorHandler
  })
}

export function useCompleteTicket() {
  const client = useApiClient()
  const queryClient = useQueryClient()
  const { invalidateAllTickets, invalidateTicketData, invalidateProjectTickets } = useInvalidateTickets()

  return useMutation({
    mutationFn: async (ticketId: number) => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.tickets.completeTicket(ticketId)
      return response.data
    },
    onSuccess: (result) => {
      invalidateTicketData(result.ticket.id)
      invalidateProjectTickets(result.ticket.projectId)
      invalidateAllTickets()
      
      // Also invalidate queue queries - completion may dequeue
      queryClient.invalidateQueries({ queryKey: ['flow'], exact: false })
      queryClient.invalidateQueries({ queryKey: ['queues'], exact: false })
      queryClient.invalidateQueries({ queryKey: ['queue-items'], exact: false })
      queryClient.invalidateQueries({ queryKey: ['queue-stats'], exact: false })
      queryClient.invalidateQueries({ queryKey: ['queues-with-stats'], exact: false })
      
      toast.success('Ticket completed successfully')
    },
    onError: commonErrorHandler
  })
}

export function useDeleteTicket() {
  const client = useApiClient()
  const { invalidateAllTickets, removeTicket } = useInvalidateTickets()

  return useMutation({
    mutationFn: async ({ ticketId, projectId }: { ticketId: number; projectId: number }) => {
      if (!client) throw new Error('API client not initialized')
      await client.tickets.deleteTicket(ticketId)
      return { ticketId, projectId }
    },
    onSuccess: ({ ticketId }) => {
      removeTicket(ticketId)
      invalidateAllTickets()
      toast.success('Ticket deleted successfully')
    },
    onError: commonErrorHandler
  })
}

// Task mutations
export function useCreateTask() {
  const client = useApiClient()
  const { invalidateTicketTasks, invalidateAllTickets } = useInvalidateTickets()

  return useMutation({
    mutationFn: async ({ ticketId, data }: { ticketId: number; data: CreateTaskBody }) => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.tickets.createTask(ticketId, data)
      return response.data
    },
    onSuccess: (task) => {
      invalidateTicketTasks(task.ticketId)
      invalidateAllTickets()
      toast.success('Task created successfully')
    },
    onError: commonErrorHandler
  })
}

export function useUpdateTask() {
  const client = useApiClient()
  const queryClient = useQueryClient()
  const { invalidateTicketTasks, invalidateAllTickets } = useInvalidateTickets()

  return useMutation({
    mutationFn: async ({ ticketId, taskId, data }: { ticketId: number; taskId: number; data: UpdateTaskBody }) => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.tickets.updateTask(ticketId, taskId, data)
      return response.data
    },
    onSuccess: (task, variables) => {
      invalidateTicketTasks(task.ticketId)
      invalidateAllTickets()
      
      // Ensure ticket detail and flow/queue views refresh
      queryClient.invalidateQueries({ queryKey: TICKET_KEYS.detail(task.ticketId), exact: false })
      queryClient.invalidateQueries({ queryKey: [...TICKET_KEYS.all, 'withTasks'], exact: false })
      queryClient.invalidateQueries({ queryKey: ['flow'], exact: false })
      queryClient.invalidateQueries({ queryKey: TICKET_KEYS.tasks(task.ticketId), refetchType: 'all' })
      
      toast.success('Task updated successfully')
      
      // Log for debugging
      console.log('Task updated successfully:', {
        taskId: task.id,
        ticketId: task.ticketId,
        updatedFields: variables.data
      })
    },
    onError: commonErrorHandler
  })
}

export function useDeleteTask() {
  const client = useApiClient()
  const { invalidateTicketTasks, invalidateAllTickets } = useInvalidateTickets()

  return useMutation({
    mutationFn: async ({ ticketId, taskId }: { ticketId: number; taskId: number }) => {
      if (!client) throw new Error('API client not initialized')
      await client.tickets.deleteTask(ticketId, taskId)
      return { ticketId, taskId }
    },
    onSuccess: ({ ticketId }) => {
      invalidateTicketTasks(ticketId)
      invalidateAllTickets()
      toast.success('Task deleted successfully')
    },
    onError: commonErrorHandler
  })
}

export function useReorderTasks() {
  const client = useApiClient()
  const queryClient = useQueryClient()
  const { invalidateAllTickets } = useInvalidateTickets()

  return useMutation({
    mutationFn: async ({ ticketId, data }: { ticketId: number; data: ReorderTasksBody }) => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.tickets.reorderTasks(ticketId, data)
      return response.data
    },
    onSuccess: (tasks, { ticketId }) => {
      queryClient.setQueryData(TICKET_KEYS.tasks(ticketId), tasks)
      invalidateAllTickets()
      toast.success('Tasks reordered successfully')
    },
    onError: commonErrorHandler
  })
}

// AI-powered mutations
export function useSuggestTasks() {
  const client = useApiClient()

  return useMutation({
    mutationFn: async ({ ticketId, userContext }: { ticketId: number; userContext?: string }) => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.tickets.suggestTasks(ticketId, userContext)
      return response.data.suggestedTasks
    },
    onError: commonErrorHandler
  })
}

export function useAutoGenerateTasks() {
  const client = useApiClient()
  const { invalidateTicketTasks, invalidateAllTickets } = useInvalidateTickets()

  return useMutation({
    mutationFn: async (ticketId: number) => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.tickets.autoGenerateTasks(ticketId)
      return response.data
    },
    onSuccess: (tasks) => {
      if (tasks.length > 0) {
        const ticketId = tasks[0].ticketId
        invalidateTicketTasks(ticketId)
        invalidateAllTickets()
        toast.success(`Generated ${tasks.length} tasks`)
      }
    },
    onError: commonErrorHandler
  })
}

export function useSuggestFiles() {
  const client = useApiClient()

  return useMutation({
    mutationFn: async ({ ticketId, extraUserInput }: { ticketId: number; extraUserInput?: string }) => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.tickets.suggestFiles(ticketId, extraUserInput)
      return response.data
    },
    onError: commonErrorHandler
  })
}