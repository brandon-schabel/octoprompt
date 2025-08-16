import { z } from 'zod'
import { BaseApiClient } from '../base-client'
import type { 
  GitBranch,
  GitCommit,
  GitStatus,
  GitStash,
  GitWorktree,
  GitFileDiff,
  GitDiff,
  GitBranchListResponse,
  GitLogResponse,
  GitCompareCommitsResponse,
  GitDiffRequest,
  DataResponseSchema,
  GitStatusResult,
  GetProjectGitStatusResponse,
  GitWorktreePruneResponse,
  GitDiffResponse
} from '../types'

// Define missing types locally that don't exist in schemas
type GitDiffFile = GitFileDiff
type GitCommitDetails = GitCommit

// Import schemas
import {
  getProjectGitStatusResponseSchema,
  stageFilesRequestSchema,
  unstageFilesRequestSchema,
  gitOperationResponseSchema,
  gitDiffRequestSchema,
  gitDiffResponseSchema,
  gitBranchListResponseSchema,
  gitLogResponseSchema,
  gitCreateBranchRequestSchema,
  gitSwitchBranchRequestSchema,
  gitMergeBranchRequestSchema,
  gitPushRequestSchema,
  gitResetRequestSchema,
  gitCommitSchema,
  gitRemoteSchema,
  gitTagSchema,
  gitStashSchema,
  gitBlameSchema,
  gitLogEnhancedRequestSchema,
  gitLogEnhancedResponseSchema,
  gitBranchListEnhancedResponseSchema,
  gitCommitDetailResponseSchema,
  gitWorktreeListResponseSchema,
  gitWorktreeAddRequestSchema,
  gitWorktreeRemoveRequestSchema,
  gitWorktreeLockRequestSchema,
  gitWorktreePruneRequestSchema,
  gitWorktreePruneResponseSchema
} from '@promptliano/schemas'

// Additional Git types
// GitStatusResult and GetProjectGitStatusResponse are now imported from types
type GitOperationResponse = {
  success: boolean
  message: string
  data?: any
}

type GitDataResponse<T> = {
  success: boolean
  data?: T
  message?: string
}
// GitDiffResponse is imported from types/schemas
type GitLogEntry = GitCommit
type GitRemote = {
  name: string
  url: string
  type: 'fetch' | 'push'
}
type GitTag = {
  name: string
  ref: string
  message?: string
  annotated: boolean
  tagger?: {
    name: string
    email: string
    date: string
  }
}
type GitBlame = {
  file: string
  lines: Array<{
    line: number
    content: string
    commit: string
    author: string
    date: string
  }>
}
type GitLogEnhancedRequest = {
  limit?: number
  skip?: number
  branch?: string
  author?: string
  since?: string
  until?: string
  grep?: string
  path?: string
}
type GitLogEnhancedResponse = DataResponseSchema<GitLogEntry[]> & {
  hasMore: boolean
  totalCount: number
}
type GitBranchListEnhancedResponse = DataResponseSchema<GitBranch[]>
type GitCommitDetailResponse = DataResponseSchema<GitCommitDetails>
type GitWorktreeListResponse = DataResponseSchema<GitWorktree[]>
type GitWorktreeAddRequest = {
  path: string
  branch?: string
  commit?: string
  force?: boolean
}
type GitWorktreeRemoveRequest = {
  path: string
  force?: boolean
}
type GitWorktreeLockRequest = {
  path: string
  reason?: string
}
type GitWorktreePruneRequest = {
  dryRun?: boolean
}
// GitWorktreePruneResponse is imported from types/schemas

/**
 * Git API client for managing Git operations, branches, commits, and worktrees
 */
export class GitClient extends BaseApiClient {
  /**
   * Get Git status for a project
   */
  async getProjectGitStatus(projectId: number): Promise<GetProjectGitStatusResponse> {
    const result = await this.request('GET', `/projects/${projectId}/git/status`, {
      responseSchema: getProjectGitStatusResponseSchema
    })
    return result as unknown as GetProjectGitStatusResponse
  }

  // File staging operations

  /**
   * Stage specific files
   */
  async stageFiles(projectId: number, filePaths: string[]): Promise<GitOperationResponse> {
    const validatedData = this.validateBody(stageFilesRequestSchema, { filePaths })
    const result = await this.request('POST', `/projects/${projectId}/git/stage`, {
      body: validatedData,
      responseSchema: gitOperationResponseSchema
    })
    return result as GitOperationResponse
  }

  /**
   * Unstage specific files
   */
  async unstageFiles(projectId: number, filePaths: string[]): Promise<GitOperationResponse> {
    const validatedData = this.validateBody(unstageFilesRequestSchema, { filePaths })
    const result = await this.request('POST', `/projects/${projectId}/git/unstage`, {
      body: validatedData,
      responseSchema: gitOperationResponseSchema
    })
    return result as GitOperationResponse
  }

  /**
   * Stage all changes
   */
  async stageAll(projectId: number): Promise<GitOperationResponse> {
    const result = await this.request('POST', `/projects/${projectId}/git/stage-all`, {
      responseSchema: gitOperationResponseSchema
    })
    return result as GitOperationResponse
  }

  /**
   * Unstage all changes
   */
  async unstageAll(projectId: number): Promise<GitOperationResponse> {
    const result = await this.request('POST', `/projects/${projectId}/git/unstage-all`, {
      responseSchema: gitOperationResponseSchema
    })
    return result as GitOperationResponse
  }

  /**
   * Commit staged changes
   */
  async commitChanges(projectId: number, message: string): Promise<GitOperationResponse> {
    const validatedData = this.validateBody(z.object({ message: z.string().min(1) }), { message })
    const result = await this.request('POST', `/projects/${projectId}/git/commit`, {
      body: validatedData,
      responseSchema: gitOperationResponseSchema
    })
    return result as GitOperationResponse
  }

  /**
   * Get file diff
   */
  async getFileDiff(projectId: number, filePath: string, options?: { staged?: boolean; commit?: string }): Promise<GitDiffResponse> {
    const queryParams = new URLSearchParams({ filePath })
    if (options?.staged) queryParams.append('staged', 'true')
    if (options?.commit) queryParams.append('commit', options.commit)

    const result = await this.request('GET', `/projects/${projectId}/git/diff?${queryParams}`, {
      responseSchema: gitDiffResponseSchema
    })
    return result as unknown as GitDiffResponse
  }

  // Branch Management

  /**
   * Get all branches
   */
  async getBranches(projectId: number): Promise<GitBranchListResponse> {
    const result = await this.request('GET', `/projects/${projectId}/git/branches`, {
      responseSchema: gitBranchListResponseSchema
    })
    return result as GitBranchListResponse
  }

  /**
   * Create a new branch
   */
  async createBranch(projectId: number, name: string, startPoint?: string): Promise<GitOperationResponse> {
    const validatedData = this.validateBody(gitCreateBranchRequestSchema, { name, startPoint })
    const result = await this.request('POST', `/projects/${projectId}/git/branches`, {
      body: validatedData,
      responseSchema: gitOperationResponseSchema
    })
    return result as GitOperationResponse
  }

  /**
   * Switch to a branch
   */
  async switchBranch(projectId: number, name: string): Promise<GitOperationResponse> {
    const validatedData = this.validateBody(gitSwitchBranchRequestSchema, { name })
    const result = await this.request('POST', `/projects/${projectId}/git/branches/switch`, {
      body: validatedData,
      responseSchema: gitOperationResponseSchema
    })
    return result as GitOperationResponse
  }

  /**
   * Delete a branch
   */
  async deleteBranch(projectId: number, branchName: string, force?: boolean): Promise<GitOperationResponse> {
    const result = await this.request(
      'DELETE',
      `/projects/${projectId}/git/branches/${encodeURIComponent(branchName)}`,
      {
        params: force ? { force: 'true' } : undefined,
        responseSchema: gitOperationResponseSchema
      }
    )
    return result as GitOperationResponse
  }

  // Commit History

  /**
   * Get commit log
   */
  async getCommitLog(projectId: number, options?: { limit?: number; skip?: number; branch?: string; file?: string }): Promise<GitLogResponse> {
    const params: Record<string, any> = {}
    if (options?.limit) params.limit = options.limit
    if (options?.skip) params.skip = options.skip
    if (options?.branch) params.branch = options.branch
    if (options?.file) params.file = options.file

    const result = await this.request('GET', `/projects/${projectId}/git/log`, {
      params,
      responseSchema: gitLogResponseSchema
    })
    return result as GitLogResponse
  }

  // Remote Operations

  /**
   * Get remote repositories
   */
  async getRemotes(projectId: number): Promise<{ success: boolean; data?: GitRemote[]; message?: string }> {
    const result = await this.request('GET', `/projects/${projectId}/git/remotes`, {
      responseSchema: z.object({
        success: z.boolean(),
        data: z.array(gitRemoteSchema).optional(),
        message: z.string().optional()
      })
    })
    return result as { success: boolean; data?: GitRemote[]; message?: string }
  }

  /**
   * Push changes to remote
   */
  async push(
    projectId: number,
    remote?: string,
    branch?: string,
    options?: { force?: boolean; setUpstream?: boolean }
  ): Promise<GitOperationResponse> {
    const validatedData = this.validateBody(gitPushRequestSchema, {
      remote: remote || 'origin',
      branch,
      force: options?.force,
      setUpstream: options?.setUpstream
    })
    const result = await this.request('POST', `/projects/${projectId}/git/push`, {
      body: validatedData,
      responseSchema: gitOperationResponseSchema
    })
    return result as GitOperationResponse
  }

  /**
   * Fetch from remote
   */
  async fetch(projectId: number, remote?: string, prune?: boolean): Promise<GitOperationResponse> {
    const result = await this.request('POST', `/projects/${projectId}/git/fetch`, {
      body: { remote: remote || 'origin', prune },
      responseSchema: gitOperationResponseSchema
    })
    return result as GitOperationResponse
  }

  /**
   * Pull from remote
   */
  async pull(projectId: number, remote?: string, branch?: string, rebase?: boolean): Promise<GitOperationResponse> {
    const result = await this.request('POST', `/projects/${projectId}/git/pull`, {
      body: { remote: remote || 'origin', branch, rebase },
      responseSchema: gitOperationResponseSchema
    })
    return result as GitOperationResponse
  }

  // Tag Management

  /**
   * Get all tags
   */
  async getTags(projectId: number): Promise<GitDataResponse<GitTag[]>> {
    const result = await this.request('GET', `/projects/${projectId}/git/tags`, {
      responseSchema: z.object({
        success: z.boolean(),
        data: z.array(gitTagSchema).optional(),
        message: z.string().optional()
      })
    })
    return result as GitDataResponse<GitTag[]>
  }

  /**
   * Create a new tag
   */
  async createTag(projectId: number, name: string, options?: { message?: string; ref?: string }): Promise<GitOperationResponse> {
    const result = await this.request('POST', `/projects/${projectId}/git/tags`, {
      body: { name, message: options?.message, ref: options?.ref },
      responseSchema: gitOperationResponseSchema
    })
    return result as GitOperationResponse
  }

  // Stash Management

  /**
   * Create a stash
   */
  async stash(projectId: number, message?: string): Promise<GitOperationResponse> {
    const result = await this.request('POST', `/projects/${projectId}/git/stash`, {
      body: { message },
      responseSchema: gitOperationResponseSchema
    })
    return result as GitOperationResponse
  }

  /**
   * Get stash list
   */
  async getStashList(projectId: number): Promise<GitDataResponse<GitStash[]>> {
    const result = await this.request('GET', `/projects/${projectId}/git/stash`, {
      responseSchema: z.object({
        success: z.literal(true),
        data: z.array(gitStashSchema)
      })
    })
    return result as GitDataResponse<GitStash[]>
  }

  /**
   * Apply a stash
   */
  async stashApply(projectId: number, ref: string = 'stash@{0}'): Promise<GitOperationResponse> {
    const result = await this.request('POST', `/projects/${projectId}/git/stash/${encodeURIComponent(ref)}/apply`, {
      responseSchema: gitOperationResponseSchema
    })
    return result as GitOperationResponse
  }

  /**
   * Pop a stash
   */
  async stashPop(projectId: number, ref: string = 'stash@{0}'): Promise<GitOperationResponse> {
    const result = await this.request('POST', `/projects/${projectId}/git/stash/${encodeURIComponent(ref)}/pop`, {
      responseSchema: gitOperationResponseSchema
    })
    return result as GitOperationResponse
  }

  /**
   * Drop a stash
   */
  async stashDrop(projectId: number, ref: string = 'stash@{0}'): Promise<GitOperationResponse> {
    const result = await this.request('DELETE', `/projects/${projectId}/git/stash/${encodeURIComponent(ref)}`, {
      responseSchema: gitOperationResponseSchema
    })
    return result as GitOperationResponse
  }

  // Reset

  /**
   * Reset to a commit
   */
  async reset(projectId: number, ref: string, mode?: 'soft' | 'mixed' | 'hard'): Promise<GitOperationResponse> {
    const validatedData = this.validateBody(gitResetRequestSchema, { ref, mode: mode || 'mixed' })
    const result = await this.request('POST', `/projects/${projectId}/git/reset`, {
      body: validatedData,
      responseSchema: gitOperationResponseSchema
    })
    return result as GitOperationResponse
  }

  // Enhanced Git Methods

  /**
   * Get enhanced commit log with advanced filtering
   */
  async getCommitLogEnhanced(projectId: number, params?: GitLogEnhancedRequest): Promise<GitLogEnhancedResponse> {
    const validatedParams = params ? this.validateBody(gitLogEnhancedRequestSchema, params) : undefined
    const result = await this.request('GET', `/projects/${projectId}/git/log/enhanced`, {
      params: validatedParams as any,
      responseSchema: gitLogEnhancedResponseSchema
    })
    return result as unknown as GitLogEnhancedResponse
  }

  /**
   * Get enhanced branches with additional metadata
   */
  async getBranchesEnhanced(projectId: number): Promise<GitBranchListEnhancedResponse> {
    const result = await this.request('GET', `/projects/${projectId}/git/branches/enhanced`, {
      responseSchema: gitBranchListEnhancedResponseSchema
    })
    return result as unknown as GitBranchListEnhancedResponse
  }

  /**
   * Get detailed commit information
   */
  async getCommitDetail(projectId: number, hash: string, includeFileContents?: boolean): Promise<GitCommitDetailResponse> {
    const result = await this.request('GET', `/projects/${projectId}/git/commits/${hash}`, {
      params: includeFileContents ? { includeFileContents } : undefined,
      responseSchema: gitCommitDetailResponseSchema
    })
    return result as unknown as GitCommitDetailResponse
  }

  // Worktree Management

  /**
   * Worktree operations grouped as a nested object for better organization
   */
  worktrees = {
    /**
     * List all worktrees
     */
    list: async (projectId: number): Promise<GitWorktreeListResponse> => {
      const result = await this.request('GET', `/projects/${projectId}/git/worktrees`, {
        responseSchema: gitWorktreeListResponseSchema
      })
      return result as GitWorktreeListResponse
    },

    /**
     * Add a new worktree
     */
    add: async (projectId: number, params: GitWorktreeAddRequest): Promise<GitOperationResponse> => {
      const validatedData = this.validateBody(gitWorktreeAddRequestSchema, params)
      const result = await this.request('POST', `/projects/${projectId}/git/worktrees`, {
        body: validatedData,
        responseSchema: gitOperationResponseSchema
      })
      return result as GitOperationResponse
    },

    /**
     * Remove a worktree
     */
    remove: async (projectId: number, params: GitWorktreeRemoveRequest): Promise<GitOperationResponse> => {
      const validatedData = this.validateBody(gitWorktreeRemoveRequestSchema, params)
      const result = await this.request('DELETE', `/projects/${projectId}/git/worktrees`, {
        body: validatedData,
        responseSchema: gitOperationResponseSchema
      })
      return result as GitOperationResponse
    },

    /**
     * Lock a worktree
     */
    lock: async (projectId: number, params: GitWorktreeLockRequest): Promise<GitOperationResponse> => {
      const validatedData = this.validateBody(gitWorktreeLockRequestSchema, params)
      const result = await this.request('POST', `/projects/${projectId}/git/worktrees/lock`, {
        body: validatedData,
        responseSchema: gitOperationResponseSchema
      })
      return result as GitOperationResponse
    },

    /**
     * Unlock a worktree
     */
    unlock: async (projectId: number, params: { path: string }): Promise<GitOperationResponse> => {
      const validatedData = this.validateBody(z.object({ path: z.string() }), params)
      const result = await this.request('POST', `/projects/${projectId}/git/worktrees/unlock`, {
        body: validatedData,
        responseSchema: gitOperationResponseSchema
      })
      return result as GitOperationResponse
    },

    /**
     * Prune worktrees
     */
    prune: async (projectId: number, params: { dryRun?: boolean } = {}): Promise<GitWorktreePruneResponse> => {
      const validatedData = this.validateBody(gitWorktreePruneRequestSchema, params)
      const result = await this.request('POST', `/projects/${projectId}/git/worktrees/prune`, {
        body: validatedData,
        responseSchema: gitWorktreePruneResponseSchema
      })
      return result as unknown as GitWorktreePruneResponse
    }
  }
}