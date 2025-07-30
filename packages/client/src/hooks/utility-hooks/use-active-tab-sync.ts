import { useEffect, useCallback, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useGetActiveProjectTabId, useProjectTabById } from '@/hooks/use-kv-local-storage'
import { useDebounceCallback } from './use-debounce'
import { promptlianoClient } from '../promptliano-client'
import type { ProjectTabState } from '@promptliano/schemas'

export function useActiveTabSync(projectId: number | undefined) {
  const [activeTabId] = useGetActiveProjectTabId()
  const queryClient = useQueryClient()
  const previousTabMetadataRef = useRef<string>('')

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
      preferredEditor: tab.preferredEditor,
      suggestedFileIds: tab.suggestedFileIds,
      ticketSearch: tab.ticketSearch,
      ticketSort: tab.ticketSort,
      ticketStatusFilter: tab.ticketStatusFilter,
      searchByContent: tab.searchByContent,
      resolveImports: tab.resolveImports,
      bookmarkedFileGroups: tab.bookmarkedFileGroups,
      sortOrder: tab.sortOrder,
      promptsPanelCollapsed: tab.promptsPanelCollapsed,
      selectedFilesCollapsed: tab.selectedFilesCollapsed
    }
  }, [])

  // Query to fetch active tab from backend
  const { data: backendActiveTab } = useQuery({
    queryKey: ['activeTab', projectId],
    queryFn: async () => {
      if (!projectId || projectId === -1) return null
      const response = await promptlianoClient.projects.getActiveTab(projectId)
      return response.data
    },
    enabled: !!projectId && projectId !== -1,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 30 * 1000, // Poll every 30 seconds
    refetchIntervalInBackground: true
  })

  // Mutation to sync active tab to backend
  const syncMutation = useMutation({
    mutationFn: async ({
      projectId,
      tabId,
      tabMetadata
    }: {
      projectId: number
      tabId: number
      tabMetadata?: ReturnType<typeof getTabMetadata>
    }) => {
      return await promptlianoClient.projects.setActiveTab(projectId, { tabId, tabMetadata })
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['activeTab', projectId] })
    },
    onError: (error) => {
      console.error('Failed to sync active tab:', error)
    }
  })

  // Create a debounced sync function with longer delay
  const debouncedSync = useDebounceCallback(
    (projectId: number, tabId: number, tabMetadata?: ReturnType<typeof getTabMetadata>) => {
      syncMutation.mutate({ projectId, tabId, tabMetadata })
    },
    1500
  ) // Wait 1.5 seconds after changes stop to reduce API calls

  // Sync when active tab changes or tab data changes
  useEffect(() => {
    if (!projectId || projectId === -1 || !activeTabId) return

    // Convert activeTabId to number if it's a string
    const tabIdNumber = typeof activeTabId === 'string' ? parseInt(activeTabId) : activeTabId
    if (isNaN(tabIdNumber)) return

    const tabMetadata = getTabMetadata(activeTab)

    // Only sync if metadata has actually changed
    const metadataString = JSON.stringify(tabMetadata)
    if (metadataString !== previousTabMetadataRef.current) {
      previousTabMetadataRef.current = metadataString
      debouncedSync(projectId, tabIdNumber, tabMetadata)
    }
  }, [activeTabId, projectId, activeTab, debouncedSync, getTabMetadata])

  // Optional interval-based sync as a safety net (every 30 seconds)
  useEffect(() => {
    if (!projectId || projectId === -1 || !activeTabId) return

    const intervalId = setInterval(() => {
      const tabIdNumber = typeof activeTabId === 'string' ? parseInt(activeTabId) : activeTabId
      if (!isNaN(tabIdNumber)) {
        const tabMetadata = getTabMetadata(activeTab)
        const metadataString = JSON.stringify(tabMetadata)

        // Only sync if metadata has changed since last interval sync
        if (metadataString !== previousTabMetadataRef.current) {
          previousTabMetadataRef.current = metadataString
          syncMutation.mutate({ projectId, tabId: tabIdNumber, tabMetadata })
        }
      }
    }, 30000) // Sync every 30 seconds as a safety net

    return () => clearInterval(intervalId)
  }, [activeTabId, projectId, activeTab, syncMutation, getTabMetadata])

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
      return await promptlianoClient.projects.clearActiveTab(projectId)
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
