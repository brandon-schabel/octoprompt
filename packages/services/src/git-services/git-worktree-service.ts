import type { GitWorktree } from '@promptliano/schemas'
import { ApiError } from '@promptliano/shared'
import { BaseGitService } from './base-git-service'
import * as path from 'path'

/**
 * Service for Git worktree management
 */
export class GitWorktreeService extends BaseGitService {
  /**
   * Get all worktrees
   */
  async getWorktrees(projectId: number): Promise<GitWorktree[]> {
    try {
      const { git, projectPath } = await this.getGitInstance(projectId)

      // Get worktrees using porcelain format
      const worktreeList = await git.raw(['worktree', 'list', '--porcelain'])

      const worktrees: GitWorktree[] = []
      const lines = worktreeList.split('\n')

      let currentWorktree: Partial<GitWorktree> = {}

      for (const line of lines) {
        if (!line.trim()) {
          // Empty line indicates end of worktree entry
          if (currentWorktree.path) {
            worktrees.push({
              path: currentWorktree.path,
              branch: currentWorktree.branch || 'HEAD',
              commit: currentWorktree.commit || '',
              isMain: currentWorktree.isMain || false,
              isLocked: currentWorktree.isLocked || false,
              lockReason: currentWorktree.lockReason,
              prunable: currentWorktree.prunable
            })
            currentWorktree = {}
          }
          continue
        }

        const [key, ...valueParts] = line.split(' ')
        const value = valueParts.join(' ')

        switch (key) {
          case 'worktree':
            currentWorktree.path = value
            // Check if this is the main worktree
            currentWorktree.isMain = path.resolve(value) === projectPath
            break
          case 'HEAD':
            currentWorktree.commit = value
            break
          case 'branch':
            // branch refs/heads/branch-name
            currentWorktree.branch = value.replace('refs/heads/', '')
            break
          case 'detached':
            // If detached, there's no branch
            currentWorktree.branch = 'HEAD'
            break
          case 'locked':
            currentWorktree.isLocked = true
            if (value) {
              currentWorktree.lockReason = value
            }
            break
          case 'prunable':
            currentWorktree.prunable = true
            break
        }
      }

      // Add the last worktree if exists
      if (currentWorktree.path) {
        worktrees.push({
          path: currentWorktree.path,
          branch: currentWorktree.branch || 'HEAD',
          commit: currentWorktree.commit || '',
          isMain: currentWorktree.isMain || false,
          isLocked: currentWorktree.isLocked || false,
          lockReason: currentWorktree.lockReason,
          prunable: currentWorktree.prunable
        })
      }

      return worktrees
    } catch (error) {
      if (error instanceof ApiError) throw error
      this.handleGitError(error, 'get worktrees')
    }
  }

  /**
   * Add a worktree
   */
  async addWorktree(
    projectId: number,
    options: {
      path: string
      branch?: string
      newBranch?: string
      commitish?: string
      detach?: boolean
    }
  ): Promise<void> {
    try {
      const { git } = await this.getGitInstance(projectId)

      // Resolve the worktree path to absolute
      const worktreePath = path.resolve(options.path)

      const args = ['worktree', 'add']

      // Add options
      if (options.newBranch) {
        args.push('-b', options.newBranch)
      } else if (options.detach) {
        args.push('--detach')
      }

      args.push(worktreePath)

      // Add branch/commit to checkout
      if (options.commitish) {
        args.push(options.commitish)
      } else if (options.branch && !options.newBranch) {
        args.push(options.branch)
      }

      await git.raw(args)
    } catch (error) {
      if (error instanceof ApiError) throw error
      this.handleGitError(error, 'add worktree')
    }
  }

  /**
   * Remove a worktree
   */
  async removeWorktree(projectId: number, worktreePath: string, force: boolean = false): Promise<void> {
    try {
      const { git } = await this.getGitInstance(projectId)

      // Get current worktrees to validate
      const worktrees = await this.getWorktrees(projectId)
      const targetPath = path.resolve(worktreePath)
      const worktree = worktrees.find((w) => path.resolve(w.path) === targetPath)

      if (!worktree) {
        throw new ApiError(404, 'Worktree not found', 'WORKTREE_NOT_FOUND')
      }

      if (worktree.isMain) {
        throw new ApiError(400, 'Cannot remove the main worktree', 'CANNOT_REMOVE_MAIN_WORKTREE')
      }

      const args = ['worktree', 'remove']
      if (force) {
        args.push('--force')
      }
      args.push(targetPath)

      await git.raw(args)
    } catch (error) {
      if (error instanceof ApiError) throw error
      this.handleGitError(error, 'remove worktree')
    }
  }

  /**
   * Lock a worktree
   */
  async lockWorktree(projectId: number, worktreePath: string, reason?: string): Promise<void> {
    try {
      const { git } = await this.getGitInstance(projectId)

      const targetPath = path.resolve(worktreePath)

      const args = ['worktree', 'lock']
      if (reason) {
        args.push('--reason', reason)
      }
      args.push(targetPath)

      await git.raw(args)
    } catch (error) {
      if (error instanceof ApiError) throw error
      this.handleGitError(error, 'lock worktree')
    }
  }

  /**
   * Unlock a worktree
   */
  async unlockWorktree(projectId: number, worktreePath: string): Promise<void> {
    try {
      const { git } = await this.getGitInstance(projectId)

      const targetPath = path.resolve(worktreePath)

      await git.raw(['worktree', 'unlock', targetPath])
    } catch (error) {
      if (error instanceof ApiError) throw error
      this.handleGitError(error, 'unlock worktree')
    }
  }

  /**
   * Prune worktrees
   */
  async pruneWorktrees(projectId: number, dryRun: boolean = false): Promise<string[]> {
    try {
      const { git } = await this.getGitInstance(projectId)

      const args = ['worktree', 'prune']
      if (dryRun) {
        args.push('--dry-run')
      }
      args.push('--verbose')

      const result = await git.raw(args)

      // Parse the output to get pruned worktree paths
      const prunedPaths: string[] = []
      const lines = result.split('\n').filter(Boolean)

      for (const line of lines) {
        // Git outputs lines like "Removing worktrees/branch-name: gitdir file points to non-existent location"
        const match = line.match(/^Removing (.+?):|^Would remove (.+?):/)
        if (match) {
          prunedPaths.push(match[1] || match[2] || '')
        }
      }

      return prunedPaths
    } catch (error) {
      if (error instanceof ApiError) throw error
      this.handleGitError(error, 'prune worktrees')
    }
  }
}

// Export singleton instance
export const gitWorktreeService = new GitWorktreeService()