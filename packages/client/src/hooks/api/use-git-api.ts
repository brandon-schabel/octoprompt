import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { octoClient } from '../octo-client'
import { toast } from 'sonner'

import type { GitStatusResult, GitBranch, GitLogEntry, GitRemote, GitTag, GitStash } from '@octoprompt/schemas'

export function useProjectGitStatus(projectId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: ['projects', projectId, 'git', 'status'],
    queryFn: async () => {
      if (!projectId) {
        throw new Error('Project ID is required')
      }
      const response = await octoClient.git.getProjectGitStatus(projectId)
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
      return octoClient.git.stageFiles(projectId, filePaths)
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
      return octoClient.git.unstageFiles(projectId, filePaths)
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
      return octoClient.git.stageAll(projectId)
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
      return octoClient.git.unstageAll(projectId)
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
      return octoClient.git.commitChanges(projectId, message)
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

export function useFileDiff(
  projectId: number | undefined,
  filePath: string | undefined,
  options?: { staged?: boolean; commit?: string },
  enabled = true
) {
  return useQuery({
    queryKey: ['projects', projectId, 'git', 'diff', filePath, options],
    queryFn: async () => {
      if (!projectId || !filePath) {
        throw new Error('Project ID and file path are required')
      }
      const response = await octoClient.git.getFileDiff(projectId, filePath, options)
      if (!response.success || !response.data) {
        throw new Error(response.message || 'Failed to fetch file diff')
      }
      return response.data
    },
    enabled: enabled && !!projectId && !!filePath,
    staleTime: 30000 // Consider diff stale after 30 seconds
  })
}

// ============================================
// Branch Management Hooks
// ============================================

export function useGitBranches(projectId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: ['projects', projectId, 'git', 'branches'],
    queryFn: async () => {
      if (!projectId) {
        throw new Error('Project ID is required')
      }
      const response = await octoClient.git.getBranches(projectId)
      if (!response.success || !response.data) {
        throw new Error(response.message || 'Failed to fetch branches')
      }
      return response.data
    },
    enabled: enabled && !!projectId,
    staleTime: 10000 // Consider branches stale after 10 seconds
  })
}

export function useCreateBranch(projectId: number | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ name, startPoint }: { name: string; startPoint?: string }) => {
      if (!projectId) {
        throw new Error('Project ID is required')
      }
      return octoClient.git.createBranch(projectId, name, startPoint)
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'git', 'branches'] })
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'git', 'status'] })
      toast.success(`Created branch '${variables.name}'`)
    },
    onError: (error: Error) => {
      toast.error(`Failed to create branch: ${error.message}`)
    }
  })
}

export function useSwitchBranch(projectId: number | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (branchName: string) => {
      if (!projectId) {
        throw new Error('Project ID is required')
      }
      return octoClient.git.switchBranch(projectId, branchName)
    },
    onSuccess: (data, branchName) => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'git', 'branches'] })
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'git', 'status'] })
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'git', 'log'] })
      toast.success(`Switched to branch '${branchName}'`)
    },
    onError: (error: Error) => {
      toast.error(`Failed to switch branch: ${error.message}`)
    }
  })
}

// ============================================
// Commit History Hooks
// ============================================

export function useGitLog(
  projectId: number | undefined,
  options?: { limit?: number; skip?: number; branch?: string; file?: string },
  enabled = true
) {
  return useQuery({
    queryKey: ['projects', projectId, 'git', 'log', options],
    queryFn: async () => {
      if (!projectId) {
        throw new Error('Project ID is required')
      }
      const response = await octoClient.git.getCommitLog(projectId, options)
      if (!response.success || !response.data) {
        throw new Error(response.message || 'Failed to fetch commit log')
      }
      return response
    },
    enabled: enabled && !!projectId,
    staleTime: 30000 // Consider log stale after 30 seconds
  })
}

// ============================================
// Remote Operations Hooks
// ============================================

export function useGitRemotes(projectId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: ['projects', projectId, 'git', 'remotes'],
    queryFn: async () => {
      if (!projectId) {
        throw new Error('Project ID is required')
      }
      const response = await octoClient.git.getRemotes(projectId)
      if (!response.success || !response.data) {
        throw new Error(response.message || 'Failed to fetch remotes')
      }
      return response.data
    },
    enabled: enabled && !!projectId,
    staleTime: 60000 // Consider remotes stale after 1 minute
  })
}

export function useGitPush(projectId: number | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      remote,
      branch,
      force,
      setUpstream
    }: {
      remote?: string
      branch?: string
      force?: boolean
      setUpstream?: boolean
    }) => {
      if (!projectId) {
        throw new Error('Project ID is required')
      }
      return octoClient.git.push(projectId, remote, branch, { force, setUpstream })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'git', 'status'] })
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'git', 'branches'] })
      toast.success('Pushed changes successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to push: ${error.message}`)
    }
  })
}

export function useGitFetch(projectId: number | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ remote, prune }: { remote?: string; prune?: boolean }) => {
      if (!projectId) {
        throw new Error('Project ID is required')
      }
      return octoClient.git.fetch(projectId, remote, prune)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'git', 'branches'] })
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'git', 'remotes'] })
      toast.success('Fetched from remote successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to fetch: ${error.message}`)
    }
  })
}

export function useGitPull(projectId: number | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ remote, branch, rebase }: { remote?: string; branch?: string; rebase?: boolean }) => {
      if (!projectId) {
        throw new Error('Project ID is required')
      }
      return octoClient.git.pull(projectId, remote, branch, rebase)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] })
      toast.success('Pulled changes successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to pull: ${error.message}`)
    }
  })
}

// ============================================
// Tag Management Hooks
// ============================================

export function useGitTags(projectId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: ['projects', projectId, 'git', 'tags'],
    queryFn: async () => {
      if (!projectId) {
        throw new Error('Project ID is required')
      }
      const response = await octoClient.git.getTags(projectId)
      if (!response.success || !response.data) {
        throw new Error(response.message || 'Failed to fetch tags')
      }
      return response.data
    },
    enabled: enabled && !!projectId,
    staleTime: 30000 // Consider tags stale after 30 seconds
  })
}

export function useCreateTag(projectId: number | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ name, message, ref }: { name: string; message?: string; ref?: string }) => {
      if (!projectId) {
        throw new Error('Project ID is required')
      }
      return octoClient.git.createTag(projectId, name, { message, ref })
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'git', 'tags'] })
      toast.success(`Created tag '${variables.name}'`)
    },
    onError: (error: Error) => {
      toast.error(`Failed to create tag: ${error.message}`)
    }
  })
}

// ============================================
// Stash Management Hooks
// ============================================

export function useGitStashList(projectId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: ['projects', projectId, 'git', 'stash'],
    queryFn: async () => {
      if (!projectId) {
        throw new Error('Project ID is required')
      }
      const response = await octoClient.git.getStashList(projectId)
      if (!response.success || !response.data) {
        throw new Error(response.message || 'Failed to fetch stash list')
      }
      return response.data
    },
    enabled: enabled && !!projectId,
    staleTime: 10000 // Consider stash list stale after 10 seconds
  })
}

export function useGitStash(projectId: number | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (message?: string) => {
      if (!projectId) {
        throw new Error('Project ID is required')
      }
      return octoClient.git.stash(projectId, message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'git', 'status'] })
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'git', 'stash'] })
      toast.success('Changes stashed successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to stash changes: ${error.message}`)
    }
  })
}

export function useGitStashApply(projectId: number | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (ref?: string) => {
      if (!projectId) {
        throw new Error('Project ID is required')
      }
      return octoClient.git.stashApply(projectId, ref)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'git', 'status'] })
      toast.success('Stash applied successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to apply stash: ${error.message}`)
    }
  })
}

// ============================================
// Reset Operations Hooks
// ============================================

export function useGitReset(projectId: number | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ ref, mode }: { ref: string; mode?: 'soft' | 'mixed' | 'hard' }) => {
      if (!projectId) {
        throw new Error('Project ID is required')
      }
      return octoClient.git.reset(projectId, ref, mode)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] })
      toast.success('Reset completed successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to reset: ${error.message}`)
    }
  })
}
