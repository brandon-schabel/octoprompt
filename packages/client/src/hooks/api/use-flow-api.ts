/**
 * Flow API Hooks - Unified ticket and queue management
 *
 * React Query hooks for interacting with the unified Flow system
 * that combines tickets, tasks, and queues.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Ticket, TicketTask } from '@promptliano/schemas'
import { useApiClient } from './use-api-client'
import { useInvalidateTickets } from '@/hooks/api/use-tickets-api'
import { commonErrorHandler } from './common-mutation-error-handler'
import { QUEUE_REFETCH_INTERVAL } from '@/lib/constants'

// === Types ===

export interface FlowItem {
  id: string
  type: 'ticket' | 'task'
  title: string
  description?: string
  ticket?: Ticket
  task?: TicketTask
  queueId?: number | null
  queuePosition?: number | null
  queueStatus?: string | null
  queuePriority?: number
  created: number
  updated: number
}

export interface FlowData {
  unqueued: {
    tickets: Ticket[]
    tasks: TicketTask[]
  }
  queues: Record<
    number,
    {
      queue: any // TaskQueue type
      tickets: Ticket[]
      tasks: TicketTask[]
    }
  >
}

// === Query Keys ===

export const FLOW_KEYS = {
  all: ['flow'] as const,
  data: (projectId: number) => [...FLOW_KEYS.all, 'data', projectId] as const,
  items: (projectId: number) => [...FLOW_KEYS.all, 'items', projectId] as const,
  unqueued: (projectId: number) => [...FLOW_KEYS.all, 'unqueued', projectId] as const,
  queue: (queueId: number) => [...FLOW_KEYS.all, 'queue', queueId] as const
}

// === Invalidation Utilities ===

export function useInvalidateFlow() {
  const queryClient = useQueryClient()

  return {
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: FLOW_KEYS.all, exact: false })
    },
    invalidateProject: (projectId: number) => {
      queryClient.invalidateQueries({ queryKey: FLOW_KEYS.data(projectId), exact: false })
      queryClient.invalidateQueries({ queryKey: FLOW_KEYS.items(projectId), exact: false })
      queryClient.invalidateQueries({ queryKey: FLOW_KEYS.unqueued(projectId), exact: false })
    },
    invalidateQueue: (queueId: number) => {
      queryClient.invalidateQueries({ queryKey: FLOW_KEYS.queue(queueId), exact: false })
    }
  }
}

// === Query Hooks ===

/**
 * Get complete flow data for a project
 */
export function useGetFlowData(projectId: number, enabled = true) {
  const client = useApiClient()
  // Client null check removed - handled by React Query

  return useQuery({
    queryKey: FLOW_KEYS.data(projectId),
    queryFn: async () => {
      if (!client) throw new Error('API client not initialized')
      const data = await client.flow.getFlowData(projectId)
      return data as FlowData
    },
    enabled: !!client && enabled && !!projectId,
    refetchInterval: QUEUE_REFETCH_INTERVAL,
    staleTime: 1000 // Keep data fresh for 1 second to prevent flicker
  })
}

/**
 * Get flow items as a flat list
 */
export function useGetFlowItems(projectId: number, enabled = true) {
  const client = useApiClient()
  // Client null check removed - handled by React Query

  return useQuery({
    queryKey: FLOW_KEYS.items(projectId),
    queryFn: async () => {
      if (!client) throw new Error('API client not initialized')
      const items = await client.flow.getFlowItems(projectId)
      return items as FlowItem[]
    },
    enabled: !!client && enabled && !!projectId,
    refetchInterval: QUEUE_REFETCH_INTERVAL
  })
}

/**
 * Get unqueued items for a project
 */
export function useGetUnqueuedItems(projectId: number, enabled = true) {
  const client = useApiClient()
  // Client null check removed - handled by React Query

  return useQuery({
    queryKey: FLOW_KEYS.unqueued(projectId),
    queryFn: async () => {
      if (!client) throw new Error('API client not initialized')
      const items = await client.flow.getUnqueuedItems(projectId)
      return items as { tickets: Ticket[]; tasks: TicketTask[] }
    },
    enabled: !!client && enabled && !!projectId,
    refetchInterval: QUEUE_REFETCH_INTERVAL
  })
}

// === Mutation Hooks ===

/**
 * Enqueue a ticket to a queue
 */
export function useEnqueueTicket() {
  const client = useApiClient()
  // Client null check removed - handled by React Query

  const { invalidateAll } = useInvalidateFlow()
  const { invalidateTicketData, invalidateProjectTickets } = useInvalidateTickets()

  return useMutation({
    mutationFn: async ({
      ticketId,
      queueId,
      priority = 0,
      includeTasks = false
    }: {
      ticketId: number
      queueId: number
      priority?: number
      includeTasks?: boolean
    }) => {
      if (!client) throw new Error('API client not initialized')
      const result = await client.flow.enqueueTicket(ticketId, { queueId, priority, includeTasks })
      return result as Ticket
    },
    onSuccess: (ticket) => {
      invalidateAll()
      if (ticket?.id) invalidateTicketData(ticket.id)
      if ((ticket as any)?.projectId) invalidateProjectTickets((ticket as any).projectId)
    },
    onError: commonErrorHandler
  })
}

/**
 * Enqueue a task to a queue
 */
export function useEnqueueTask() {
  const client = useApiClient()
  // Client null check removed - handled by React Query

  const { invalidateAll } = useInvalidateFlow()

  return useMutation({
    mutationFn: async ({ taskId, queueId, priority = 0 }: { taskId: number; queueId: number; priority?: number }) => {
      if (!client) throw new Error('API client not initialized')
      const result = await client.flow.enqueueTask(taskId, { queueId, priority })
      return result as TicketTask
    },
    onSuccess: () => {
      invalidateAll()
    },
    onError: commonErrorHandler
  })
}

/**
 * Dequeue a ticket (remove from queue)
 */
export function useDequeueTicket() {
  const client = useApiClient()

  const { invalidateAll } = useInvalidateFlow()
  const { invalidateTicketData, invalidateProjectTickets } = useInvalidateTickets()

  return useMutation({
    mutationFn: async (params: number | { ticketId: number; includeTasks?: boolean }) => {
      // Handle both old signature (ticketId) and new signature ({ ticketId, includeTasks })
      const ticketId = typeof params === 'number' ? params : params.ticketId
      const includeTasks = typeof params === 'object' ? params.includeTasks : false

      // Client null check removed - handled by React Query
      if (!client) throw new Error('API client not initialized')
      const result = await client.flow.dequeueTicket(ticketId, { includeTasks })
      return result as Ticket
    },
    onSuccess: (ticket) => {
      invalidateAll()
      if (ticket?.id) invalidateTicketData(ticket.id)
      if ((ticket as any)?.projectId) invalidateProjectTickets((ticket as any).projectId)
    },
    onError: commonErrorHandler
  })
}

/**
 * Dequeue a task (remove from queue)
 */
export function useDequeueTask() {
  const client = useApiClient()

  const { invalidateAll } = useInvalidateFlow()
  const { invalidateTicketData, invalidateProjectTickets } = useInvalidateTickets()

  return useMutation({
    mutationFn: async (taskId: number) => {
      // Client null check removed - handled by React Query
      if (!client) throw new Error('API client not initialized')
      const result = await client.flow.dequeueTask(taskId)
      return result as TicketTask
    },
    onSuccess: (task) => {
      invalidateAll()
      if ((task as any)?.ticketId) invalidateTicketData((task as any).ticketId)
      if ((task as any)?.projectId) invalidateProjectTickets((task as any).projectId)
    },
    onError: commonErrorHandler
  })
}

/**
 * Move an item between queues or to unqueued
 */
export function useMoveItem() {
  const client = useApiClient()
  // Client null check removed - handled by React Query

  const { invalidateAll } = useInvalidateFlow()

  return useMutation({
    mutationFn: async ({
      itemType,
      itemId,
      targetQueueId,
      priority = 0,
      includeTasks = false
    }: {
      itemType: 'ticket' | 'task'
      itemId: number
      targetQueueId: number | null
      priority?: number
      includeTasks?: boolean
    }) => {
      if (!client) throw new Error('API client not initialized')
      const result = await client.flow.moveItem({ itemType, itemId, targetQueueId, priority, includeTasks })
      return result as FlowItem
    },
    onSuccess: () => {
      invalidateAll()
    },
    onError: commonErrorHandler
  })
}

/**
 * Bulk move items
 */
export function useBulkMoveItems() {
  const client = useApiClient()
  // Client null check removed - handled by React Query

  const { invalidateAll } = useInvalidateFlow()

  return useMutation({
    mutationFn: async ({
      items,
      targetQueueId,
      priority = 0
    }: {
      items: Array<{ itemType: 'ticket' | 'task'; itemId: number }>
      targetQueueId: number | null
      priority?: number
    }) => {
      if (!client) throw new Error('API client not initialized')
      const result = await client.flow.bulkMoveItems({ items, targetQueueId, priority })
      return result as { success: boolean; movedCount: number }
    },
    onSuccess: () => {
      invalidateAll()
    },
    onError: commonErrorHandler
  })
}

// === Processing Hooks ===

/**
 * Start processing an item
 */
export function useStartProcessing() {
  const client = useApiClient()
  // Client null check removed - handled by React Query

  const { invalidateAll } = useInvalidateFlow()

  return useMutation({
    mutationFn: async ({
      itemType,
      itemId,
      agentId
    }: {
      itemType: 'ticket' | 'task'
      itemId: number
      agentId: string
    }) => {
      if (!client) throw new Error('API client not initialized')
      const result = await client.flow.startProcessingItem({ itemType, itemId, agentId })
      return result as { success: boolean }
    },
    onSuccess: () => {
      invalidateAll()
    },
    onError: commonErrorHandler
  })
}

/**
 * Complete processing an item
 */
export function useCompleteProcessing() {
  const client = useApiClient()
  // Client null check removed - handled by React Query

  const { invalidateAll } = useInvalidateFlow()

  return useMutation({
    mutationFn: async ({
      itemType,
      itemId,
      processingTime
    }: {
      itemType: 'ticket' | 'task'
      itemId: number
      processingTime?: number
    }) => {
      if (!client) throw new Error('API client not initialized')
      const result = await client.flow.completeProcessingItem({ itemType, itemId, processingTime })
      return result as { success: boolean }
    },
    onSuccess: () => {
      invalidateAll()
    },
    onError: commonErrorHandler
  })
}

/**
 * Fail processing an item
 */
export function useFailProcessing() {
  const client = useApiClient()
  // Client null check removed - handled by React Query

  const { invalidateAll } = useInvalidateFlow()

  return useMutation({
    mutationFn: async ({
      itemType,
      itemId,
      errorMessage
    }: {
      itemType: 'ticket' | 'task'
      itemId: number
      errorMessage: string
    }) => {
      if (!client) throw new Error('API client not initialized')
      const result = await client.flow.failProcessingItem({ itemType, itemId, errorMessage })
      return result as { success: boolean }
    },
    onSuccess: () => {
      invalidateAll()
    },
    onError: commonErrorHandler
  })
}

/**
 * Complete a queue item (mark as done)
 */
export function useCompleteQueueItem() {
  const client = useApiClient()
  const queryClient = useQueryClient()
  const { invalidateAll } = useInvalidateFlow()

  return useMutation({
    mutationFn: async ({
      itemType,
      itemId,
      ticketId
    }: {
      itemType: 'ticket' | 'task'
      itemId: number
      ticketId?: number
    }) => {
      if (!client) throw new Error('API client not initialized')
      const result = await client.queues.completeQueueItem(itemType, itemId, ticketId)
      return result
    },
    onSuccess: (_, variables) => {
      // Invalidate all flow queries to refresh the board
      invalidateAll()

      // Also invalidate ticket and queue queries
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['queues'] })
      queryClient.invalidateQueries({ queryKey: ['queue-stats'] })
      queryClient.invalidateQueries({ queryKey: ['queues-with-stats'] })
    },
    onError: commonErrorHandler
  })
}
