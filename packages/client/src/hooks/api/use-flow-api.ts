/**
 * Flow API Hooks - Unified ticket and queue management
 *
 * React Query hooks for interacting with the unified Flow system
 * that combines tickets, tasks, and queues.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Ticket, TicketTask } from '@promptliano/schemas'
import { promptlianoClient } from '../promptliano-client'
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
      queryClient.invalidateQueries({ queryKey: FLOW_KEYS.all })
    },
    invalidateProject: (projectId: number) => {
      queryClient.invalidateQueries({ queryKey: FLOW_KEYS.data(projectId) })
      queryClient.invalidateQueries({ queryKey: FLOW_KEYS.items(projectId) })
      queryClient.invalidateQueries({ queryKey: FLOW_KEYS.unqueued(projectId) })
    },
    invalidateQueue: (queueId: number) => {
      queryClient.invalidateQueries({ queryKey: FLOW_KEYS.queue(queueId) })
    }
  }
}

// === Query Hooks ===

/**
 * Get complete flow data for a project
 */
export function useGetFlowData(projectId: number, enabled = true) {
  return useQuery({
    queryKey: FLOW_KEYS.data(projectId),
    queryFn: async () => {
      const data = await promptlianoClient.flow.getFlowData(projectId)
      return data as FlowData
    },
    enabled: enabled && !!projectId,
    refetchInterval: QUEUE_REFETCH_INTERVAL,
    staleTime: 1000 // Keep data fresh for 1 second to prevent flicker
  })
}

/**
 * Get flow items as a flat list
 */
export function useGetFlowItems(projectId: number, enabled = true) {
  return useQuery({
    queryKey: FLOW_KEYS.items(projectId),
    queryFn: async () => {
      const items = await promptlianoClient.flow.getFlowItems(projectId)
      return items as FlowItem[]
    },
    enabled: enabled && !!projectId,
    refetchInterval: QUEUE_REFETCH_INTERVAL
  })
}

/**
 * Get unqueued items for a project
 */
export function useGetUnqueuedItems(projectId: number, enabled = true) {
  return useQuery({
    queryKey: FLOW_KEYS.unqueued(projectId),
    queryFn: async () => {
      const items = await promptlianoClient.flow.getUnqueuedItems(projectId)
      return items as { tickets: Ticket[]; tasks: TicketTask[] }
    },
    enabled: enabled && !!projectId,
    refetchInterval: QUEUE_REFETCH_INTERVAL
  })
}

// === Mutation Hooks ===

/**
 * Enqueue a ticket to a queue
 */
export function useEnqueueTicket() {
  const { invalidateAll } = useInvalidateFlow()

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
      const result = await promptlianoClient.flow.enqueueTicket(ticketId, { queueId, priority, includeTasks })
      return result as Ticket
    },
    onSuccess: () => {
      invalidateAll()
    },
    onError: commonErrorHandler
  })
}

/**
 * Enqueue a task to a queue
 */
export function useEnqueueTask() {
  const { invalidateAll } = useInvalidateFlow()

  return useMutation({
    mutationFn: async ({ taskId, queueId, priority = 0 }: { taskId: number; queueId: number; priority?: number }) => {
      const result = await promptlianoClient.flow.enqueueTask(taskId, { queueId, priority })
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
  const { invalidateAll } = useInvalidateFlow()

  return useMutation({
    mutationFn: async (ticketId: number) => {
      const result = await promptlianoClient.flow.dequeueTicket(ticketId)
      return result as Ticket
    },
    onSuccess: () => {
      invalidateAll()
    },
    onError: commonErrorHandler
  })
}

/**
 * Dequeue a task (remove from queue)
 */
export function useDequeueTask() {
  const { invalidateAll } = useInvalidateFlow()

  return useMutation({
    mutationFn: async (taskId: number) => {
      const result = await promptlianoClient.flow.dequeueTask(taskId)
      return result as TicketTask
    },
    onSuccess: () => {
      invalidateAll()
    },
    onError: commonErrorHandler
  })
}

/**
 * Move an item between queues or to unqueued
 */
export function useMoveItem() {
  const { invalidateAll } = useInvalidateFlow()

  return useMutation({
    mutationFn: async ({
      itemType,
      itemId,
      targetQueueId,
      priority = 0
    }: {
      itemType: 'ticket' | 'task'
      itemId: number
      targetQueueId: number | null
      priority?: number
    }) => {
      const result = await promptlianoClient.flow.moveItem({ itemType, itemId, targetQueueId, priority })
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
      const result = await promptlianoClient.flow.bulkMoveItems({ items, targetQueueId, priority })
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
      const result = await promptlianoClient.flow.startProcessingItem({ itemType, itemId, agentId })
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
      const result = await promptlianoClient.flow.completeProcessingItem({ itemType, itemId, processingTime })
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
      const result = await promptlianoClient.flow.failProcessingItem({ itemType, itemId, errorMessage })
      return result as { success: boolean }
    },
    onSuccess: () => {
      invalidateAll()
    },
    onError: commonErrorHandler
  })
}
