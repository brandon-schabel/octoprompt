import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useApiClient } from './use-api-client'
import type { Project, CreateProjectBody, UpdateProjectBody, ProjectFile, ProjectStatistics } from '@promptliano/schemas'
import { toast } from 'sonner'
import { useCallback, useRef, useEffect } from 'react'

// Query keys
export const PROJECT_KEYS = {
  all: ['projects'] as const,
  list: () => [...PROJECT_KEYS.all, 'list'] as const,
  detail: (projectId: number) => [...PROJECT_KEYS.all, 'detail', projectId] as const,
  files: (projectId: number) => [...PROJECT_KEYS.all, 'files', projectId] as const,
  filesWithoutContent: (projectId: number) => [...PROJECT_KEYS.all, 'filesWithoutContent', projectId] as const,
  summary: (projectId: number) => [...PROJECT_KEYS.all, 'summary', projectId] as const,
  statistics: (projectId: number) => [...PROJECT_KEYS.all, 'statistics', projectId] as const,
  fileVersions: (projectId: number, originalFileId: number) =>
    [...PROJECT_KEYS.all, 'fileVersions', projectId, originalFileId] as const,
  fileVersion: (projectId: number, originalFileId: number, version?: number) =>
    [...PROJECT_KEYS.all, 'fileVersion', projectId, originalFileId, version || 'latest'] as const
}

// Main CRUD hooks
export function useGetProjects() {
  const client = useApiClient()
  
  return useQuery({
    queryKey: PROJECT_KEYS.list(),
    queryFn: async () => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.projects.listProjects()
      return response.data
    },
    enabled: !!client,
    staleTime: 5 * 60 * 1000
  })
}

export function useGetProject(projectId: number) {
  const client = useApiClient()
  
  return useQuery({
    queryKey: PROJECT_KEYS.detail(projectId),
    queryFn: async () => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.projects.getProject(projectId)
      return response.data
    },
    enabled: !!client && !!projectId && projectId !== -1,
    staleTime: 5 * 60 * 1000
  })
}

export function useCreateProject() {
  const client = useApiClient()
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (data: CreateProjectBody) => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.projects.createProject(data)
      return response.data
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.all })
      queryClient.setQueryData(PROJECT_KEYS.detail(project.id), project)
      toast.success('Project created successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create project')
    }
  })
}

export function useUpdateProject() {
  const client = useApiClient()
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdateProjectBody }) => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.projects.updateProject(id, data)
      return response.data
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.list() })
      queryClient.setQueryData(PROJECT_KEYS.detail(project.id), project)
      toast.success('Project updated successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update project')
    }
  })
}

export function useDeleteProject() {
  const client = useApiClient()
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (projectId: number) => {
      if (!client) throw new Error('API client not initialized')
      await client.projects.deleteProject(projectId)
      return projectId
    },
    onSuccess: (projectId) => {
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.all })
      queryClient.removeQueries({ queryKey: PROJECT_KEYS.detail(projectId) })
      toast.success('Project deleted successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete project')
    }
  })
}

// Additional project-specific query hooks
export function useGetProjectFiles(projectId: number) {
  const client = useApiClient()
  
  return useQuery({
    queryKey: PROJECT_KEYS.files(projectId),
    queryFn: async () => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.projects.getProjectFiles(projectId)
      return response.data
    },
    enabled: !!client && !!projectId,
    staleTime: 5 * 60 * 1000
  })
}

export function useGetProjectFilesWithoutContent(projectId: number) {
  const client = useApiClient()
  
  return useQuery({
    queryKey: PROJECT_KEYS.filesWithoutContent(projectId),
    queryFn: async () => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.projects.getProjectFilesWithoutContent(projectId)
      return response.data
    },
    enabled: !!client && !!projectId,
    staleTime: 5 * 60 * 1000
  })
}

export function useGetProjectSummary(projectId: number) {
  const client = useApiClient()
  
  return useQuery({
    queryKey: PROJECT_KEYS.summary(projectId),
    queryFn: async () => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.projects.getProjectSummary(projectId)
      return response
    },
    enabled: !!client && !!projectId,
    staleTime: 5 * 60 * 1000
  })
}

export function useGetProjectStatistics(projectId: number) {
  const client = useApiClient()
  
  return useQuery({
    queryKey: PROJECT_KEYS.statistics(projectId),
    queryFn: async () => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.projects.getProjectStatistics(projectId)
      return response.data
    },
    enabled: !!client && !!projectId,
    staleTime: 5 * 60 * 1000
  })
}

// Project-specific mutations
export function useSyncProject() {
  const client = useApiClient()
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (projectId: number) => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.projects.syncProject(projectId)
      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.all })
      toast.success('Project synced successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to sync project')
    }
  })
}

export function useSuggestFiles() {
  const client = useApiClient()
  
  return useMutation({
    mutationFn: async ({ projectId, params }: { projectId: number; params: any }) => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.projects.suggestFiles(projectId, params)
      return response.data
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to suggest files')
    }
  })
}

export function useOptimizeUserInput() {
  const client = useApiClient()
  
  return useMutation({
    mutationFn: async ({ projectId, data }: { projectId: number; data: any }) => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.prompts.optimizeUserInput(projectId, data)
      return response.data
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to optimize input')
    }
  })
}

export function useUpdateFileContent() {
  const client = useApiClient()
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ projectId, fileId, content }: { projectId: number; fileId: number; content: string }) => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.projects.updateFileContent(projectId, fileId, content)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.all })
      toast.success('File updated successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update file')
    }
  })
}

// Sync with progress hook  
export function useSyncProjectWithProgress() {
  const { invalidateFiles: invalidateProjectFiles, invalidateDetail: invalidateProject } = useInvalidateProjects()
  const eventSourceRef = useRef<EventSource | null>(null)

  // Cleanup function to close EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [])

  const syncWithProgress = useCallback(
    (
      projectId: number, 
      onProgress?: (event: any) => void,
      abortSignal?: AbortSignal
    ) => {
      return new Promise<{ created: number; updated: number; deleted: number; skipped: number }>(
        (resolve, reject) => {
          // Clean up any existing connection
          if (eventSourceRef.current) {
            eventSourceRef.current.close()
          }

          const eventSource = new EventSource(`/api/projects/${projectId}/sync-stream`)
          eventSourceRef.current = eventSource

          // Handle abort signal for cancellation
          if (abortSignal) {
            abortSignal.addEventListener('abort', () => {
              eventSource.close()
              eventSourceRef.current = null
              reject(new Error('Sync cancelled'))
            })
          }

          let retryCount = 0
          const maxRetries = 3

          eventSource.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data)

              if (data.type === 'progress' && onProgress) {
                onProgress(data.data)
              } else if (data.type === 'complete') {
                eventSource.close()
                eventSourceRef.current = null
                invalidateProjectFiles(projectId)
                invalidateProject(projectId)
                resolve(data.data)
              } else if (data.type === 'error') {
                eventSource.close()
                eventSourceRef.current = null
                reject(new Error(data.data.message || 'Sync failed'))
              }
            } catch (error) {
              console.error('Error parsing SSE data:', error)
            }
          }

          eventSource.onerror = (error) => {
            console.error('SSE error:', error)
            
            // Implement retry logic with exponential backoff
            if (retryCount < maxRetries) {
              retryCount++
              const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 5000)
              console.log(`Retrying SSE connection in ${retryDelay}ms (attempt ${retryCount}/${maxRetries})`)
              
              setTimeout(() => {
                // Check if not aborted
                if (abortSignal?.aborted) {
                  return
                }
                
                // Close old connection and create new one
                eventSource.close()
                const newEventSource = new EventSource(`/api/projects/${projectId}/sync-stream`)
                eventSourceRef.current = newEventSource
                
                // Reattach event handlers
                newEventSource.onmessage = eventSource.onmessage
                newEventSource.onerror = eventSource.onerror
              }, retryDelay)
            } else {
              eventSource.close()
              eventSourceRef.current = null
              reject(new Error('Connection to sync stream failed after retries'))
            }
          }
        }
      )
    },
    [invalidateProjectFiles, invalidateProject]
  )

  return { syncWithProgress }
}

export function useRefreshProject() {
  const client = useApiClient()
  const { invalidateFiles: invalidateProjectFiles } = useInvalidateProjects()

  return useMutation({
    mutationFn: ({ projectId, folder }: { projectId: number; folder?: string }) => {
      if (!client) throw new Error('API client not initialized')
      return client.projects.refreshProject(projectId, folder ? { folder } : undefined)
    },
    onSuccess: (_, { projectId }) => {
      invalidateProjectFiles(projectId)
      toast.success('Project refreshed successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to refresh project')
    }
  })
}

export function useSummarizeProjectFiles() {
  const client = useApiClient()
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({
      projectId,
      fileIds,
      force = false
    }: {
      projectId: number
      fileIds: number[]
      force?: boolean
    }) => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.projects.summarizeFiles(projectId, { fileIds, force })
      return response.data
    },
    onSuccess: (data, variables) => {
      // Invalidate project files to refresh summaries
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.files(variables.projectId) })
      toast.success(`Summarized ${data.included} files`)
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to summarize files')
    }
  })
}

export function useRemoveSummariesFromFiles() {
  const client = useApiClient()
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ projectId, fileIds }: { projectId: number; fileIds: number[] }) => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.projects.removeSummariesFromFiles(projectId, { fileIds })
      return response.data
    },
    onSuccess: (data, variables) => {
      // Invalidate project files to refresh summaries
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.files(variables.projectId) })
      toast.success(`Removed summaries from ${data.removedCount} files`)
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to remove summaries')
    }
  })
}

// Invalidation utilities
export function useInvalidateProjects() {
  const queryClient = useQueryClient()
  
  return {
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.all })
    },
    invalidateList: () => {
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.list() })
    },
    invalidateDetail: (projectId: number) => {
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.detail(projectId) })
    },
    invalidateFiles: (projectId: number) => {
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.files(projectId) })
    },
    invalidateProject: (projectId: number) => {
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.detail(projectId) })
    },
    invalidateProjectFiles: (projectId: number) => {
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.files(projectId) })
    },
    setProjectDetail: (project: Project) => {
      queryClient.setQueryData(PROJECT_KEYS.detail(project.id), project)
    },
    removeProject: (projectId: number) => {
      queryClient.removeQueries({ queryKey: PROJECT_KEYS.detail(projectId) })
    }
  }
}

// Type re-exports for backward compatibility
export type { CreateProjectBody as CreateProjectInput, UpdateProjectBody as UpdateProjectInput } from '@promptliano/schemas'

// Legacy aliases for hooks that had different names
export { useSuggestFiles as useFindSuggestedFiles }