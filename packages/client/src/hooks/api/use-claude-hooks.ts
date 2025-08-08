import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { promptlianoClient } from '@/hooks/promptliano-client'
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
  return useQuery({
    queryKey: [QUERY_KEY_PREFIX, projectPath],
    queryFn: async () => {
      const response = await promptlianoClient.claudeHooks.list(projectPath)
      return response.data
    },
    enabled: !!projectPath
  })
}

/**
 * Hook to get a specific hook
 */
export function useGetHook(projectPath: string, eventName: HookEvent, matcherIndex: number) {
  return useQuery({
    queryKey: [QUERY_KEY_PREFIX, projectPath, eventName, matcherIndex],
    queryFn: async () => {
      const response = await promptlianoClient.claudeHooks.get(projectPath, eventName, matcherIndex)
      return response.data
    },
    enabled: !!projectPath && !!eventName && matcherIndex >= 0
  })
}

/**
 * Hook to create a new hook
 */
export function useCreateHook(projectPath: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateHookConfigBody) => {
      const response = await promptlianoClient.claudeHooks.create(projectPath, data)
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
      const response = await promptlianoClient.claudeHooks.update(projectPath, eventName, matcherIndex, data)
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
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ eventName, matcherIndex }: { eventName: HookEvent; matcherIndex: number }) =>
      promptlianoClient.claudeHooks.delete(projectPath, eventName, matcherIndex),
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
  return useMutation({
    mutationFn: async (data: HookGenerationRequest) => {
      const response = await promptlianoClient.claudeHooks.generate(projectPath, data)
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
  return useMutation({
    mutationFn: async (data: HookTestRequest) => {
      const response = await promptlianoClient.claudeHooks.test(projectPath, data)
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
  return useQuery({
    queryKey: [QUERY_KEY_PREFIX, projectPath, 'search', query],
    queryFn: async () => {
      const response = await promptlianoClient.claudeHooks.search(projectPath, query)
      return response.data
    },
    enabled: !!projectPath && !!query && query.length > 0
  })
}
