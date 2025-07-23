import { useEffect, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useGetActiveProjectTabId } from '@/hooks/use-kv-local-storage'
import { useDebounceCallback } from './use-debounce'
import { octoClient } from '../octo-client'

export function useActiveTabSync(projectId: number | undefined) {
  const [activeTabId] = useGetActiveProjectTabId()
  const queryClient = useQueryClient()

  // Query to fetch active tab from backend
  const { data: backendActiveTab } = useQuery({
    queryKey: ['activeTab', projectId],
    queryFn: async () => {
      if (!projectId || projectId === -1) return null
      const response = await octoClient.projects.getActiveTab(projectId)
      return response.data
    },
    enabled: !!projectId && projectId !== -1,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 30 * 1000, // Poll every 30 seconds
    refetchIntervalInBackground: true
  })

  // Mutation to sync active tab to backend
  const syncMutation = useMutation({
    mutationFn: async ({ projectId, tabId }: { projectId: number; tabId: number }) => {
      return await octoClient.projects.setActiveTab(projectId, { tabId })
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['activeTab', projectId] })
    },
    onError: (error) => {
      console.error('Failed to sync active tab:', error)
    }
  })

  // Create a debounced sync function
  const debouncedSync = useDebounceCallback((projectId: number, tabId: number) => {
    syncMutation.mutate({ projectId, tabId })
  }, 500) // Wait 500ms after changes stop

  // Sync when active tab changes
  useEffect(() => {
    if (!projectId || projectId === -1 || !activeTabId) return

    // Convert activeTabId to number if it's a string
    const tabIdNumber = typeof activeTabId === 'string' ? parseInt(activeTabId) : activeTabId
    if (isNaN(tabIdNumber)) return

    debouncedSync(projectId, tabIdNumber)
  }, [activeTabId, projectId, debouncedSync])

  // Function to manually trigger sync
  const syncNow = useCallback(() => {
    if (!projectId || projectId === -1 || !activeTabId) return

    const tabIdNumber = typeof activeTabId === 'string' ? parseInt(activeTabId) : activeTabId
    if (isNaN(tabIdNumber)) return

    syncMutation.mutate({ projectId, tabId: tabIdNumber })
  }, [activeTabId, projectId, syncMutation])

  // Function to clear active tab
  const clearActiveTab = useMutation({
    mutationFn: async (projectId: number) => {
      return await octoClient.projects.clearActiveTab(projectId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeTab', projectId] })
    }
  })

  return {
    isLoading: syncMutation.isPending,
    isSynced: syncMutation.isSuccess,
    error: syncMutation.error,
    syncNow,
    clearActiveTab: clearActiveTab.mutate,
    backendActiveTab
  }
}