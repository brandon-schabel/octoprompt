import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  TaskQueue,
  QueueItem,
  CreateQueueBody,
  UpdateQueueBody,
  EnqueueItemBody,
  QueueStats,
  QueueWithStats,
  GetNextTaskResponse,
  BatchEnqueueBody
} from '@promptliano/schemas'
import { useApiClient } from './use-api-client'
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
  const client = useApiClient()

  return useQuery({
    queryKey: queueKeys.list(projectId),
    queryFn: async () => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.queues.listQueues(projectId)
      return response.data
    },
    enabled: !!client && !!projectId
  })
}

export function useGetQueue(queueId: number) {
  const client = useApiClient()

  return useQuery({
    queryKey: queueKeys.detail(queueId),
    queryFn: async () => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.queues.getQueue(queueId)
      return response.data
    },
    enabled: !!client && !!queueId
  })
}

export function useCreateQueue(projectId: number) {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Omit<CreateQueueBody, 'projectId'>) => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.queues.createQueue(projectId, data)
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
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: UpdateQueueBody) => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.queues.updateQueue(queueId, data)
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
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ queueId, projectId }: { queueId: number; projectId: number }) => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.queues.deleteQueue(queueId)
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
  const client = useApiClient()

  return useQuery({
    queryKey: queueKeys.itemList(queueId, status),
    queryFn: async () => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.queues.getQueueItems(queueId, status)
      return response.data
    },
    enabled: !!client && !!queueId
  })
}

export function useEnqueueItem(queueId: number) {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: EnqueueItemBody) => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.queues.enqueueItem(queueId, data)
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
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ ticketId, priority }: { ticketId: number; priority?: number }) => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.queues.enqueueTicket(queueId, ticketId, priority)
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
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: BatchEnqueueBody) => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.queues.batchEnqueue(queueId, data)
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

// DEPRECATED hooks - kept for backward compatibility
export function useUpdateQueueItem() {
  return useMutation({
    mutationFn: async () => {
      throw new Error('Queue item updates are no longer supported. Use ticket/task update methods instead.')
    },
    onError: () => {
      toast.error('Queue item updates are no longer supported. Use ticket/task update methods instead.')
    }
  })
}

export function useBatchUpdateQueueItems() {
  return useMutation({
    mutationFn: async () => {
      throw new Error('Batch queue item updates are no longer supported. Use ticket/task batch update methods instead.')
    },
    onError: () => {
      toast.error('Batch queue item updates are no longer supported. Use ticket/task batch update methods instead.')
    }
  })
}

export function useDeleteQueueItem() {
  return useMutation({
    mutationFn: async () => {
      throw new Error('Queue item deletion is no longer supported. Use flow service dequeue methods instead.')
    },
    onError: () => {
      toast.error('Queue item deletion is no longer supported. Use flow service dequeue methods instead.')
    }
  })
}

export function useClearQueue() {
  return useMutation({
    mutationFn: async () => {
      throw new Error('Queue clearing is no longer supported. Use flow service dequeue methods for individual items instead.')
    },
    onError: () => {
      toast.error('Queue clearing is no longer supported. Use flow service dequeue methods for individual items instead.')
    }
  })
}

// Hooks for queue statistics
export function useGetQueueStats(queueId: number) {
  const client = useApiClient()

  return useQuery({
    queryKey: queueKeys.stat(queueId),
    queryFn: async () => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.queues.getQueueStats(queueId)
      return response.data
    },
    enabled: !!client && !!queueId,
    refetchInterval: 5000 // Auto-refresh every 5 seconds
  })
}

export function useGetQueuesWithStats(projectId: number) {
  const client = useApiClient()

  return useQuery({
    queryKey: queueKeys.allStats(projectId),
    queryFn: async () => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.queues.getQueuesWithStats(projectId)
      return response.data
    },
    enabled: !!client && !!projectId,
    refetchInterval: 5000 // Auto-refresh every 5 seconds
  })
}

export function useGetQueueWithStats(queueId: number, options?: { enabled?: boolean }) {
  const client = useApiClient()

  return useQuery({
    queryKey: [...queueKeys.detail(queueId), 'with-stats'],
    queryFn: async () => {
      if (!client) throw new Error('API client not initialized')
      // Get queue details
      const queueResponse = await client.queues.getQueue(queueId)
      // Get queue stats
      const statsResponse = await client.queues.getQueueStats(queueId)

      const result: QueueWithStats = {
        queue: {
          ...queueResponse.data,
          status: queueResponse.data.status ?? 'active' // Ensure status has a default value
        },
        stats: statsResponse.data
      }

      return result
    },
    enabled: !!client && options?.enabled !== false && !!queueId,
    refetchInterval: 5000 // Auto-refresh every 5 seconds
  })
}

// Hook for agents to get next task
export function useGetNextTask() {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ queueId, agentId }: { queueId: number; agentId?: string }) => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.queues.getNextTask(queueId, agentId)
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

// Bulk move items - now uses FlowService
export function useBulkMoveItems() {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ itemIds, targetQueueId }: { itemIds: number[]; targetQueueId: number | null }) => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.flow.bulkMoveItems({
        items: itemIds.map((id) => ({ itemType: 'task' as const, itemId: id })),
        targetQueueId
      })
      return response
    },
    onSuccess: () => {
      // Invalidate all queue-related queries
      queryClient.invalidateQueries({ queryKey: queueKeys.all })
      queryClient.invalidateQueries({ queryKey: ['unqueued-items'] })
      queryClient.invalidateQueries({ queryKey: ['flow'] })
      toast.success('Items moved successfully')
    },
    onError: (error) => {
      toast.error('Failed to move items')
      console.error('Error moving items:', error)
    }
  })
}

// Reorder queue items - now uses FlowService
export function useReorderQueueItems() {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ queueId, itemIds }: { queueId: number; itemIds: number[] }) => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.flow.reorderQueueItems({
        queueId,
        items: itemIds.map((id) => ({ itemType: 'task' as const, itemId: id, ticketId: undefined }))
      })
      return response
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queueKeys.detail(variables.queueId) })
      queryClient.invalidateQueries({ queryKey: queueKeys.itemList(variables.queueId) })
      queryClient.invalidateQueries({ queryKey: ['flow'] })
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
  const client = useApiClient()

  return useQuery({
    queryKey: [...queueKeys.detail(queueId), 'timeline'],
    queryFn: async () => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.queues.getQueueTimeline(queueId)
      return response.data
    },
    enabled: !!client && !!queueId
  })
}

// Get unqueued items
export function useGetUnqueuedItems(projectId: number) {
  const client = useApiClient()

  return useQuery({
    queryKey: ['unqueued-items', projectId],
    queryFn: async () => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.queues.getUnqueuedItems(projectId)
      return response.data
    },
    enabled: !!client && !!projectId,
    refetchInterval: 10000 // Refetch every 10 seconds
  })
}