import { useEffect, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useSelectedFiles } from './use-selected-files'
import { useGetProjectTabById } from '@/hooks/use-kv-local-storage'
import { useDebounceCallback } from './use-debounce'
import { octoClient } from '../octo-client'

export function useSelectedFilesSync(projectTabId: string | undefined) {
  const { selectedFiles: selectedFilesIds } = useSelectedFiles()
  const [projectTab] = useGetProjectTabById(Number(projectTabId))

  const projectId = projectTab?.selectedProjectId
  const tabId = projectTabId ? parseInt(projectTabId) : undefined
  const userPrompt = projectTab?.userPrompt || ''
  const selectedPrompts = projectTab?.selectedPrompts || []
  const queryClient = useQueryClient()

  // Query to fetch selected files from backend
  const { data: backendSelection } = useQuery({
    queryKey: ['selectedFiles', projectId, tabId],
    queryFn: async () => {
      if (!projectId || projectId === -1) return null
      const response = await octoClient.projects.getSelectedFiles(projectId, tabId)
      return response.data
    },
    enabled: !!projectId && projectId !== -1,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 30 * 1000, // Poll every 30 seconds
    refetchIntervalInBackground: true
  })

  // Mutation to sync selected files to backend
  const syncMutation = useMutation({
    mutationFn: async ({
      fileIds,
      promptIds,
      userPrompt
    }: {
      fileIds: number[]
      promptIds: number[]
      userPrompt: string
    }) => {
      if (!projectId || projectId === -1 || !tabId) return

      return await octoClient.projects.updateSelectedFiles(projectId, {
        tabId,
        fileIds,
        promptIds,
        userPrompt
      })
    },
    onSuccess: () => {
      // Show a subtle save indicator

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['selectedFiles', projectId, tabId] })
    },
    onError: (error) => {
      console.error('Failed to sync selected files:', error)
    }
  })

  // Create a debounced sync function
  const debouncedSync = useDebounceCallback((fileIds: number[], promptIds: number[], userPrompt: string) => {
    syncMutation.mutate({ fileIds, promptIds, userPrompt })
  }, 1000) // Wait 1 second after changes stop

  // Sync when selections change
  useEffect(() => {
    if (!projectId || projectId === -1 || !tabId) return

    debouncedSync(selectedFilesIds, selectedPrompts, userPrompt)
  }, [selectedFilesIds, selectedPrompts, userPrompt, projectId, tabId, debouncedSync])

  // Function to manually trigger sync
  const syncNow = useCallback(() => {
    if (!projectId || projectId === -1 || !tabId) return

    syncMutation.mutate({ fileIds: selectedFilesIds, promptIds: selectedPrompts, userPrompt })
  }, [selectedFilesIds, selectedPrompts, userPrompt, projectId, tabId, syncMutation])

  // Function to clear selected files
  const clearSelection = useMutation({
    mutationFn: async () => {
      if (!projectId || projectId === -1) return

      return await octoClient.projects.clearSelectedFiles(projectId, tabId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['selectedFiles', projectId, tabId] })
    }
  })

  return {
    isLoading: syncMutation.isPending,
    isSynced: syncMutation.isSuccess,
    error: syncMutation.error,
    syncNow,
    clearSelection: clearSelection.mutate,
    backendSelection
  }
}
