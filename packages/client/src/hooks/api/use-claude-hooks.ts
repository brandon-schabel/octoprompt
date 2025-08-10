import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApiClient } from './use-api-client'
import type {
  CreateHookConfigBody,
  UpdateHookConfigBody,
  HookGenerationRequest,
  HookTestRequest,
  HookEvent
} from '@promptliano/schemas'
import { toast } from 'sonner'

const QUERY_KEY_PREFIX = 'claude-hooks'

/**
 * Hook to list all hooks for a project
 */
export function useGetProjectHooks(projectPath: string) {
  const client = useApiClient()
  // Client null check removed - handled by React Query

  return useQuery({
    queryKey: [QUERY_KEY_PREFIX, projectPath],
    queryFn: async () => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.claudeHooks.list(projectPath)
      return response.data
    },
    enabled: !!client && !!projectPath
  })
}

/**
 * Hook to get a specific hook
 */
export function useGetHook(projectPath: string, eventName: HookEvent, matcherIndex: number) {
  const client = useApiClient()
  // Client null check removed - handled by React Query

  return useQuery({
    queryKey: [QUERY_KEY_PREFIX, projectPath, eventName, matcherIndex],
    queryFn: async () => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.claudeHooks.get(projectPath, eventName, matcherIndex)
      return response.data
    },
    enabled: !!client && !!projectPath && !!eventName && matcherIndex >= 0
  })
}

/**
 * Hook to create a new hook
 */
export function useCreateHook(projectPath: string) {
  const client = useApiClient()

  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateHookConfigBody) => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.claudeHooks.create(projectPath, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY_PREFIX, projectPath] })
      toast.success('Hook created successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create hook')
    }
  })
}

/**
 * Hook to update an existing hook
 */
export function useUpdateHook(projectPath: string) {
  const client = useApiClient()
  // Client null check removed - handled by React Query

  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      eventName,
      matcherIndex,
      data
    }: {
      eventName: HookEvent
      matcherIndex: number
      data: UpdateHookConfigBody
    }) => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.claudeHooks.update(projectPath, eventName, matcherIndex, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY_PREFIX, projectPath] })
      toast.success('Hook updated successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update hook')
    }
  })
}

/**
 * Hook to delete a hook
 */
export function useDeleteHook(projectPath: string) {
  const client = useApiClient()
  // Client null check removed - handled by React Query

  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ eventName, matcherIndex }: { eventName: HookEvent; matcherIndex: number }) => {
      if (!client) throw new Error('API client not initialized')
      return client.claudeHooks.delete(projectPath, eventName, matcherIndex)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY_PREFIX, projectPath] })
      toast.success('Hook deleted successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete hook')
    }
  })
}

/**
 * Hook to generate a hook from natural language
 */
export function useGenerateHook(projectPath: string) {
  const client = useApiClient()

  return useMutation({
    mutationFn: async (data: HookGenerationRequest) => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.claudeHooks.generate(projectPath, data)
      return response.data
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to generate hook')
    }
  })
}

/**
 * Hook to test a hook configuration
 */
export function useTestHook(projectPath: string) {
  const client = useApiClient()

  return useMutation({
    mutationFn: async (data: HookTestRequest) => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.claudeHooks.test(projectPath, data)
      return response.data
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to test hook')
    }
  })
}

/**
 * Hook to search hooks
 */
export function useSearchHooks(projectPath: string, query: string) {
  const client = useApiClient()
  // Client null check removed - handled by React Query

  return useQuery({
    queryKey: [QUERY_KEY_PREFIX, projectPath, 'search', query],
    queryFn: async () => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.claudeHooks.search(projectPath, query)
      return response.data
    },
    enabled: !!client && !!projectPath && !!query && query.length > 0
  })
}
