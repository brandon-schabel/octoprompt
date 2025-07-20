import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../octo-client'
import { toast } from 'sonner'

import type { GitStatusResult } from '@octoprompt/schemas'

export function useProjectGitStatus(projectId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: ['projects', projectId, 'git', 'status'],
    queryFn: async () => {
      if (!projectId) {
        throw new Error('Project ID is required')
      }
      const response = await apiClient.git.getProjectGitStatus(projectId)
      if (!response.success || !response.data) {
        throw new Error(response.message || 'Failed to fetch git status')
      }
      return response.data
    },
    enabled: enabled && !!projectId,
    refetchInterval: 5000, // Refetch every 5 seconds to keep status updated
    staleTime: 4000 // Consider data stale after 4 seconds
  })
}

export function useGitFilesWithChanges(projectId: number | undefined) {
  const { data: gitStatus } = useProjectGitStatus(projectId)

  if (!gitStatus || !gitStatus.success) {
    return []
  }

  return gitStatus.data.files.filter((file) => file.status !== 'unchanged' && file.status !== 'ignored')
}

export function useStageFiles(projectId: number | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (filePaths: string[]) => {
      if (!projectId) {
        throw new Error('Project ID is required')
      }
      return apiClient.git.stageFiles(projectId, filePaths)
    },
    onSuccess: (data, filePaths) => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'git', 'status'] })
      toast.success(`Staged ${filePaths.length} file(s)`)
    },
    onError: (error: Error) => {
      toast.error(`Failed to stage files: ${error.message}`)
    }
  })
}

export function useUnstageFiles(projectId: number | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (filePaths: string[]) => {
      if (!projectId) {
        throw new Error('Project ID is required')
      }
      return apiClient.git.unstageFiles(projectId, filePaths)
    },
    onSuccess: (data, filePaths) => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'git', 'status'] })
      toast.success(`Unstaged ${filePaths.length} file(s)`)
    },
    onError: (error: Error) => {
      toast.error(`Failed to unstage files: ${error.message}`)
    }
  })
}

export function useStageAll(projectId: number | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!projectId) {
        throw new Error('Project ID is required')
      }
      return apiClient.git.stageAll(projectId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'git', 'status'] })
      toast.success('Staged all files')
    },
    onError: (error: Error) => {
      toast.error(`Failed to stage all files: ${error.message}`)
    }
  })
}

export function useUnstageAll(projectId: number | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!projectId) {
        throw new Error('Project ID is required')
      }
      return apiClient.git.unstageAll(projectId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'git', 'status'] })
      toast.success('Unstaged all files')
    },
    onError: (error: Error) => {
      toast.error(`Failed to unstage all files: ${error.message}`)
    }
  })
}

export function useCommitChanges(projectId: number | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (message: string) => {
      if (!projectId) {
        throw new Error('Project ID is required')
      }
      return apiClient.git.commitChanges(projectId, message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'git', 'status'] })
      toast.success('Changes committed successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to commit changes: ${error.message}`)
    }
  })
}
