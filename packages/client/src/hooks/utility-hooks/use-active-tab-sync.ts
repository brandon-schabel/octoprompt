import { useEffect, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useGetActiveProjectTabId, useProjectTabById } from '@/hooks/use-kv-local-storage'
import { useDebounceCallback } from './use-debounce'
import { octoClient } from '../octo-client'
import type { ProjectTabState } from '@octoprompt/schemas'

export function useActiveTabSync(projectId: number | undefined) {
  const [activeTabId] = useGetActiveProjectTabId()
  const queryClient = useQueryClient()
  
  // Convert activeTabId to number if it's a string
  const tabIdNumber = typeof activeTabId === 'string' ? parseInt(activeTabId) : activeTabId
  const activeTab = useProjectTabById(tabIdNumber || -1)
  
  // Extract tab metadata for syncing
  const getTabMetadata = useCallback((tab: ProjectTabState | undefined) => {
    if (!tab) return undefined
    
    return {
      displayName: tab.displayName,
      selectedFiles: tab.selectedFiles,
      selectedPrompts: tab.selectedPrompts,
      userPrompt: tab.userPrompt,
      fileSearch: tab.fileSearch,
      contextLimit: tab.contextLimit,
      preferredEditor: tab.preferredEditor,
      suggestedFileIds: tab.suggestedFileIds,
      ticketSearch: tab.ticketSearch,
      ticketSort: tab.ticketSort,
      ticketStatusFilter: tab.ticketStatusFilter
    }
  }, [])

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
    mutationFn: async ({ projectId, tabId, tabMetadata }: { 
      projectId: number; 
      tabId: number;
      tabMetadata?: ReturnType<typeof getTabMetadata>
    }) => {
      return await octoClient.projects.setActiveTab(projectId, { tabId, tabMetadata })
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
  const debouncedSync = useDebounceCallback((projectId: number, tabId: number, tabMetadata?: ReturnType<typeof getTabMetadata>) => {
    syncMutation.mutate({ projectId, tabId, tabMetadata })
  }, 500) // Wait 500ms after changes stop

  // Sync when active tab changes or tab data changes
  useEffect(() => {
    if (!projectId || projectId === -1 || !activeTabId) return

    // Convert activeTabId to number if it's a string
    const tabIdNumber = typeof activeTabId === 'string' ? parseInt(activeTabId) : activeTabId
    if (isNaN(tabIdNumber)) return

    const tabMetadata = getTabMetadata(activeTab)
    debouncedSync(projectId, tabIdNumber, tabMetadata)
  }, [activeTabId, projectId, activeTab, debouncedSync, getTabMetadata])

  // Function to manually trigger sync
  const syncNow = useCallback(() => {
    if (!projectId || projectId === -1 || !activeTabId) return

    const tabIdNumber = typeof activeTabId === 'string' ? parseInt(activeTabId) : activeTabId
    if (isNaN(tabIdNumber)) return

    const tabMetadata = getTabMetadata(activeTab)
    syncMutation.mutate({ projectId, tabId: tabIdNumber, tabMetadata })
  }, [activeTabId, projectId, activeTab, syncMutation, getTabMetadata])

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