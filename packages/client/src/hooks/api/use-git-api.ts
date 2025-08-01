import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { promptlianoClient } from '../promptliano-client'
import { toast } from 'sonner'

import type {
  GitStatusResult,
  GitBranch,
  GitLogEntry,
  GitRemote,
  GitTag,
  GitStash,
  GitLogEnhancedRequest,
  GitLogEnhancedResponse,
  GitBranchListEnhancedResponse,
  GitCommitDetailResponse
} from '@promptliano/schemas'

export function useProjectGitStatus(projectId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: ['projects', projectId, 'git', 'status'],
    queryFn: async () => {
      if (!projectId) {
        throw new Error('Project ID is required')
      }
      const response = await promptlianoClient.git.getProjectGitStatus(projectId)
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
      return promptlianoClient.git.stageFiles(projectId, filePaths)
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
      return promptlianoClient.git.unstageFiles(projectId, filePaths)
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
      return promptlianoClient.git.stageAll(projectId)
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
      return promptlianoClient.git.unstageAll(projectId)
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
      return promptlianoClient.git.commitChanges(projectId, message)
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
      const response = await promptlianoClient.git.getFileDiff(projectId, filePath, options)
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
      const response = await promptlianoClient.git.getBranches(projectId)
      if (!response.success || !response.data) {
        throw new Error('Failed to fetch branches')
      }
      return response.data
    },
    enabled: enabled && !!projectId,
    staleTime: 10000 // Consider branches stale after 10 seconds
  })
}

// Enhanced branches with additional metadata
export function useBranchesEnhanced(projectId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: ['projects', projectId, 'git', 'branches', 'enhanced'],
    queryFn: async () => {
      if (!projectId) {
        throw new Error('Project ID is required')
      }
      const response = await promptlianoClient.git.getBranchesEnhanced(projectId)
      if (!response.success || !response.data) {
        throw new Error(response.message || 'Failed to fetch enhanced branches')
      }
      return response
    },
    enabled: enabled && !!projectId,
    staleTime: 10000, // Consider branches stale after 10 seconds
    refetchInterval: 30000 // Refetch every 30 seconds to keep branch data fresh
  })
}

export function useCreateBranch(projectId: number | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ name, startPoint }: { name: string; startPoint?: string }) => {
      if (!projectId) {
        throw new Error('Project ID is required')
      }
      return promptlianoClient.git.createBranch(projectId, name, startPoint)
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
      return promptlianoClient.git.switchBranch(projectId, branchName)
    },
    onSuccess: (data, branchName) => {
      // Invalidate all branch-related queries
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

export function useDeleteBranch(projectId: number | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ branchName, force }: { branchName: string; force?: boolean }) => {
      if (!projectId) {
        throw new Error('Project ID is required')
      }
      return promptlianoClient.git.deleteBranch(projectId, branchName, force)
    },
    onSuccess: (data, variables) => {
      // Invalidate all branch-related queries
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'git', 'branches'] })
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'git', 'status'] })
      toast.success(`Deleted branch '${variables.branchName}'`)
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete branch: ${error.message}`)
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
      const response = await promptlianoClient.git.getCommitLog(projectId, options)
      if (!response.success || !response.data) {
        throw new Error('Failed to fetch commit log')
      }
      return response
    },
    enabled: enabled && !!projectId,
    staleTime: 30000 // Consider log stale after 30 seconds
  })
}

// Enhanced commit log with pagination and advanced filters
export function useCommitLogEnhanced(projectId: number | undefined, params?: GitLogEnhancedRequest, enabled = true) {
  return useQuery({
    queryKey: ['projects', projectId, 'git', 'log', 'enhanced', params],
    queryFn: async () => {
      if (!projectId) {
        throw new Error('Project ID is required')
      }
      const response = await promptlianoClient.git.getCommitLogEnhanced(projectId, params)
      if (!response.success || !response.data) {
        throw new Error(response.message || 'Failed to fetch enhanced commit log')
      }
      return response
    },
    enabled: enabled && !!projectId,
    staleTime: 30000 // Consider log stale after 30 seconds
  })
}

// Get detailed information about a specific commit
export function useCommitDetail(
  projectId: number | undefined,
  hash: string | undefined,
  includeFileContents?: boolean,
  enabled = true
) {
  return useQuery({
    queryKey: ['projects', projectId, 'git', 'commits', hash, { includeFileContents }],
    queryFn: async () => {
      if (!projectId || !hash) {
        throw new Error('Project ID and commit hash are required')
      }
      const response = await promptlianoClient.git.getCommitDetail(projectId, hash, includeFileContents)
      if (!response.success || !response.data) {
        throw new Error(response.message || 'Failed to fetch commit details')
      }
      return response
    },
    enabled: enabled && !!projectId && !!hash,
    staleTime: 60000 // Consider commit details stale after 1 minute
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
      const response = await promptlianoClient.git.getRemotes(projectId)
      if (!response.success || !response.data) {
        throw new Error('Failed to fetch remotes')
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
      return promptlianoClient.git.push(projectId, remote, branch, { force, setUpstream })
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
      return promptlianoClient.git.fetch(projectId, remote, prune)
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
      return promptlianoClient.git.pull(projectId, remote, branch, rebase)
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
      const response = await promptlianoClient.git.getTags(projectId)
      if (!response.success || !response.data) {
        throw new Error('Failed to fetch tags')
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
      return promptlianoClient.git.createTag(projectId, name, { message, ref })
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
      const response = await promptlianoClient.git.getStashList(projectId)
      if (!response.success || !response.data) {
        throw new Error('Failed to fetch stash list')
      }
      return response
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
      return promptlianoClient.git.stash(projectId, message)
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
      return promptlianoClient.git.stashApply(projectId, ref)
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

export function useGitStashPop(projectId: number | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (ref?: string) => {
      if (!projectId) {
        throw new Error('Project ID is required')
      }
      return promptlianoClient.git.stashPop(projectId, ref)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'git', 'status'] })
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'git', 'stash'] })
      toast.success('Stash popped successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to pop stash: ${error.message}`)
    }
  })
}

export function useGitStashDrop(projectId: number | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (ref?: string) => {
      if (!projectId) {
        throw new Error('Project ID is required')
      }
      return promptlianoClient.git.stashDrop(projectId, ref)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'git', 'stash'] })
      toast.success('Stash dropped successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to drop stash: ${error.message}`)
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
      return promptlianoClient.git.reset(projectId, ref, mode)
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

// ============================================
// Worktree Operations Hooks
// ============================================

export function useGitWorktrees(projectId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: ['projects', projectId, 'git', 'worktrees'],
    queryFn: async () => {
      if (!projectId) {
        throw new Error('Project ID is required')
      }
      const response = await promptlianoClient.git.worktrees.list(projectId)
      if (!response.success || !response.data) {
        throw new Error(response.message || 'Failed to fetch worktrees')
      }
      return response.data
    },
    enabled: enabled && !!projectId
  })
}

export function useAddGitWorktree(projectId: number | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      path: string
      branch?: string
      newBranch?: string
      commitish?: string
      detach?: boolean
    }) => {
      if (!projectId) {
        throw new Error('Project ID is required')
      }
      return promptlianoClient.git.worktrees.add(projectId, params)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'git', 'worktrees'] })
      toast.success('Worktree created successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to create worktree: ${error.message}`)
    }
  })
}

export function useRemoveGitWorktree(projectId: number | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ path, force }: { path: string; force?: boolean }) => {
      if (!projectId) {
        throw new Error('Project ID is required')
      }
      return promptlianoClient.git.worktrees.remove(projectId, { path, force })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'git', 'worktrees'] })
      toast.success('Worktree removed successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove worktree: ${error.message}`)
    }
  })
}

export function useLockGitWorktree(projectId: number | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ path, reason }: { path: string; reason?: string }) => {
      if (!projectId) {
        throw new Error('Project ID is required')
      }
      return promptlianoClient.git.worktrees.lock(projectId, { path, reason })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'git', 'worktrees'] })
      toast.success('Worktree locked successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to lock worktree: ${error.message}`)
    }
  })
}

export function useUnlockGitWorktree(projectId: number | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ path }: { path: string }) => {
      if (!projectId) {
        throw new Error('Project ID is required')
      }
      return promptlianoClient.git.worktrees.unlock(projectId, { path })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'git', 'worktrees'] })
      toast.success('Worktree unlocked successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to unlock worktree: ${error.message}`)
    }
  })
}

export function usePruneGitWorktrees(projectId: number | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ dryRun }: { dryRun?: boolean } = {}) => {
      if (!projectId) {
        throw new Error('Project ID is required')
      }
      return promptlianoClient.git.worktrees.prune(projectId, { dryRun })
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'git', 'worktrees'] })
      if (variables?.dryRun) {
        const prunedPaths = data.data || []
        if (prunedPaths.length === 0) {
          toast.info('No worktrees to prune')
        } else {
          toast.info(`Would prune ${prunedPaths.length} worktree(s):\n${prunedPaths.join('\n')}`)
        }
      } else {
        const prunedPaths = data.data || []
        if (prunedPaths.length === 0) {
          toast.success('No worktrees needed pruning')
        } else {
          toast.success(`Pruned ${prunedPaths.length} worktree(s)`)
        }
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to prune worktrees: ${error.message}`)
    }
  })
}
