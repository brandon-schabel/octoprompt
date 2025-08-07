import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  TaskQueue,
  QueueItem,
  CreateQueueBody,
  UpdateQueueBody,
  EnqueueItemBody,
  UpdateQueueItemBody,
  QueueStats,
  QueueWithStats,
  GetNextTaskResponse,
  BatchEnqueueBody,
  BatchUpdateItemsBody
} from '@promptliano/schemas'
import { promptlianoClient } from '@/hooks/promptliano-client'
import { DataResponseSchema } from '@promptliano/api-client'
import { toast } from 'sonner'

// Query keys
export const queueKeys = {
  all: ['queues'] as const,
  lists: () => [...queueKeys.all, 'list'] as const,
  list: (projectId: number) => [...queueKeys.lists(), projectId] as const,
  details: () => [...queueKeys.all, 'detail'] as const,
  detail: (queueId: number) => [...queueKeys.details(), queueId] as const,
  stats: () => [...queueKeys.all, 'stats'] as const,
  stat: (queueId: number) => [...queueKeys.stats(), queueId] as const,
  allStats: (projectId: number) => [...queueKeys.all, 'all-stats', projectId] as const,
  items: () => [...queueKeys.all, 'items'] as const,
  itemList: (queueId: number, status?: string) =>
    status ? ([...queueKeys.items(), queueId, status] as const) : ([...queueKeys.items(), queueId] as const)
}

// Hooks for queues

export function useGetQueues(projectId: number) {
  return useQuery({
    queryKey: queueKeys.list(projectId),
    queryFn: async () => {
      const response = await promptlianoClient.queues.listQueues(projectId)
      return response.data
    },
    enabled: !!projectId
  })
}

export function useGetQueue(queueId: number) {
  return useQuery({
    queryKey: queueKeys.detail(queueId),
    queryFn: async () => {
      const response = await promptlianoClient.queues.getQueue(queueId)
      return response.data
    },
    enabled: !!queueId
  })
}

export function useCreateQueue(projectId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Omit<CreateQueueBody, 'projectId'>) => {
      const response = await promptlianoClient.queues.createQueue(projectId, {
        ...data,
        projectId
      })
      return response.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queueKeys.list(projectId) })
      queryClient.invalidateQueries({ queryKey: queueKeys.allStats(projectId) })
      toast.success(`Queue "${data.name}" created successfully`)
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create queue')
    }
  })
}

export function useUpdateQueue(queueId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: UpdateQueueBody) => {
      const response = await promptlianoClient.queues.updateQueue(queueId, data)
      return response.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queueKeys.detail(queueId) })
      queryClient.invalidateQueries({ queryKey: queueKeys.list(data.projectId) })
      queryClient.invalidateQueries({ queryKey: queueKeys.allStats(data.projectId) })
      toast.success('Queue updated successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update queue')
    }
  })
}

export function useDeleteQueue() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ queueId, projectId }: { queueId: number; projectId: number }) => {
      const response = await promptlianoClient.queues.deleteQueue(queueId)
      return { ...response.data, projectId }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queueKeys.list(variables.projectId) })
      queryClient.invalidateQueries({ queryKey: queueKeys.allStats(variables.projectId) })
      toast.success('Queue deleted successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete queue')
    }
  })
}

// Hooks for queue items

export function useGetQueueItems(queueId: number, status?: string) {
  return useQuery({
    queryKey: queueKeys.itemList(queueId, status),
    queryFn: async () => {
      const response = await promptlianoClient.queues.getQueueItems(queueId, status)
      return response.data
    },
    enabled: !!queueId
  })
}

export function useEnqueueItem(queueId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: EnqueueItemBody) => {
      const response = await promptlianoClient.queues.enqueueItem(queueId, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queueKeys.items() })
      queryClient.invalidateQueries({ queryKey: queueKeys.stats() })
      toast.success('Item enqueued successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to enqueue item')
    }
  })
}

export function useEnqueueTicket(queueId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ ticketId, priority }: { ticketId: number; priority?: number }) => {
      const response = await promptlianoClient.queues.enqueueTicket(queueId, ticketId, priority)
      return response.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queueKeys.items() })
      queryClient.invalidateQueries({ queryKey: queueKeys.stats() })
      toast.success(`${data.length} tasks enqueued successfully`)
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to enqueue ticket tasks')
    }
  })
}

export function useBatchEnqueueItems(queueId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: BatchEnqueueBody) => {
      const response = await promptlianoClient.queues.batchEnqueue(queueId, data)
      return response.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queueKeys.items() })
      queryClient.invalidateQueries({ queryKey: queueKeys.stats() })
      toast.success(`${data.length} items enqueued successfully`)
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to batch enqueue items')
    }
  })
}

export function useUpdateQueueItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ itemId, data }: { itemId: number; data: UpdateQueueItemBody }) => {
      const response = await promptlianoClient.queues.updateQueueItem(itemId, data)
      return response.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queueKeys.items() })
      queryClient.invalidateQueries({ queryKey: queueKeys.stats() })
      toast.success('Queue item updated successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update queue item')
    }
  })
}

export function useBatchUpdateQueueItems() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: BatchUpdateItemsBody) => {
      const response = await promptlianoClient.queues.batchUpdateItems(data)
      return response.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queueKeys.items() })
      queryClient.invalidateQueries({ queryKey: queueKeys.stats() })
      toast.success(`${data.length} items updated successfully`)
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to batch update items')
    }
  })
}

export function useDeleteQueueItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (itemId: number) => {
      const response = await promptlianoClient.queues.deleteQueueItem(itemId)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queueKeys.items() })
      queryClient.invalidateQueries({ queryKey: queueKeys.stats() })
      queryClient.invalidateQueries({ queryKey: ['unqueued-items'] })
      toast.success('Queue item deleted successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete queue item')
    }
  })
}

// Hook to clear all items from a queue
export function useClearQueue(queueId: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      // Get all items in the queue
      const itemsResponse = await promptlianoClient.queues.getQueueItems(queueId)
      const items = itemsResponse.data

      // Delete each item
      const deletePromises = items.map((item) => promptlianoClient.queues.deleteQueueItem(item.id))

      await Promise.all(deletePromises)
      return { clearedCount: items.length }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queueKeys.items() })
      queryClient.invalidateQueries({ queryKey: queueKeys.stats() })
      queryClient.invalidateQueries({ queryKey: ['unqueued-items'] })
      toast.success(`Cleared ${data.clearedCount} items from queue`)
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to clear queue')
    }
  })
}

// Hooks for queue statistics

export function useGetQueueStats(queueId: number) {
  return useQuery({
    queryKey: queueKeys.stat(queueId),
    queryFn: async () => {
      const response = await promptlianoClient.queues.getQueueStats(queueId)
      return response.data
    },
    enabled: !!queueId,
    refetchInterval: 5000 // Auto-refresh every 5 seconds
  })
}

export function useGetQueuesWithStats(projectId: number) {
  return useQuery({
    queryKey: queueKeys.allStats(projectId),
    queryFn: async () => {
      const response = await promptlianoClient.queues.getQueuesWithStats(projectId)
      return response.data
    },
    enabled: !!projectId,
    refetchInterval: 5000 // Auto-refresh every 5 seconds
  })
}

export function useGetQueueWithStats(queueId: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...queueKeys.detail(queueId), 'with-stats'],
    queryFn: async () => {
      // Get queue details
      const queueResponse = await promptlianoClient.queues.getQueue(queueId)
      // Get queue stats
      const statsResponse = await promptlianoClient.queues.getQueueStats(queueId)

      const result: QueueWithStats = {
        queue: queueResponse.data,
        stats: statsResponse.data
      }

      return result
    },
    enabled: options?.enabled !== false && !!queueId,
    refetchInterval: 5000 // Auto-refresh every 5 seconds
  })
}

// Hook for agents to get next task

export function useGetNextTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ queueId, agentId }: { queueId: number; agentId?: string }) => {
      const response = await promptlianoClient.queues.getNextTask(queueId, agentId)
      return response.data
    },
    onSuccess: (data, variables) => {
      if (data.queueItem) {
        queryClient.invalidateQueries({ queryKey: queueKeys.itemList(variables.queueId) })
        queryClient.invalidateQueries({ queryKey: queueKeys.stat(variables.queueId) })
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to get next task')
    }
  })
}

// Bulk move items
export function useBulkMoveItems() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      itemIds,
      targetQueueId,
      positions
    }: {
      itemIds: number[]
      targetQueueId: number
      positions?: number[]
    }) => {
      const response = await promptlianoClient.queues.bulkMoveItems(itemIds, targetQueueId, positions)
      return response.data
    },
    onSuccess: (_, variables) => {
      // Invalidate all queue-related queries
      queryClient.invalidateQueries({ queryKey: queueKeys.all })
      queryClient.invalidateQueries({ queryKey: ['unqueued-items'] })
      toast.success('Items moved successfully')
    },
    onError: (error) => {
      toast.error('Failed to move items')
      console.error('Error moving items:', error)
    }
  })
}

// Reorder queue items
export function useReorderQueueItems() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ queueId, itemIds }: { queueId: number; itemIds: number[] }) => {
      const response = await promptlianoClient.queues.reorderQueueItems(queueId, itemIds)
      return response.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queueKeys.detail(variables.queueId) })
      queryClient.invalidateQueries({ queryKey: queueKeys.itemList(variables.queueId) })
      toast.success('Items reordered successfully')
    },
    onError: (error) => {
      toast.error('Failed to reorder items')
      console.error('Error reordering items:', error)
    }
  })
}

// Get queue timeline
export function useGetQueueTimeline(queueId: number) {
  return useQuery({
    queryKey: [...queueKeys.detail(queueId), 'timeline'],
    queryFn: async () => {
      const response = await promptlianoClient.queues.getQueueTimeline(queueId)
      return response.data
    },
    enabled: !!queueId
  })
}

// Get unqueued items
export function useGetUnqueuedItems(projectId: number) {
  return useQuery({
    queryKey: ['unqueued-items', projectId],
    queryFn: async () => {
      const response = await promptlianoClient.queues.getUnqueuedItems(projectId)
      return response.data
    },
    enabled: !!projectId,
    refetchInterval: 10000 // Refetch every 10 seconds
  })
}
