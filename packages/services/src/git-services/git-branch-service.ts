import type {
  GitBranch,
  GitBranchEnhanced,
  GitBranchListEnhancedResponse
} from '@promptliano/schemas'
import { ApiError } from '@promptliano/shared'
import { BaseGitService } from './base-git-service'
import { gitStatusService } from './git-status-service'

/**
 * Service for Git branch management operations
 */
export class GitBranchService extends BaseGitService {
  /**
   * Get all branches
   */
  async getBranches(projectId: number): Promise<GitBranch[]> {
    try {
      const { git } = await this.getGitInstance(projectId)

      const branchSummary = await git.branchLocal()
      const remoteBranches = await git.branch(['-r'])

      const branches: GitBranch[] = []

      // Add local branches
      for (const [name, branch] of Object.entries(branchSummary.branches)) {
        branches.push({
          name,
          current: branch.current,
          isRemote: false,
          commit: branch.commit,
          tracking: null,
          ahead: 0,
          behind: 0
        })
      }

      // Add remote branches
      for (const [name, branch] of Object.entries(remoteBranches.branches)) {
        if (!name.includes('HEAD')) {
          branches.push({
            name,
            current: false,
            isRemote: true,
            commit: branch.commit,
            tracking: null,
            ahead: 0,
            behind: 0
          })
        }
      }

      return branches
    } catch (error) {
      if (error instanceof ApiError) throw error
      this.handleGitError(error, 'get branches')
    }
  }

  /**
   * Get current branch
   */
  async getCurrentBranch(projectId: number): Promise<string | null> {
    try {
      const { git } = await this.getGitInstance(projectId)
      const status = await git.status()
      return status.current || null
    } catch (error) {
      if (error instanceof ApiError) throw error
      this.handleGitError(error, 'get current branch')
    }
  }

  /**
   * Create a new branch
   */
  async createBranch(projectId: number, branchName: string, startPoint?: string): Promise<void> {
    try {
      const { git } = await this.getGitInstance(projectId)

      if (startPoint) {
        await git.checkoutBranch(branchName, startPoint)
      } else {
        await git.checkoutLocalBranch(branchName)
      }

      gitStatusService.clearCache(projectId)
    } catch (error) {
      if (error instanceof ApiError) throw error
      this.handleGitError(error, 'create branch')
    }
  }

  /**
   * Switch to a branch
   */
  async switchBranch(projectId: number, branchName: string): Promise<void> {
    try {
      const { git } = await this.getGitInstance(projectId)
      await git.checkout(branchName)
      gitStatusService.clearCache(projectId)
    } catch (error) {
      if (error instanceof ApiError) throw error
      this.handleGitError(error, 'switch branch')
    }
  }

  /**
   * Delete a branch
   */
  async deleteBranch(projectId: number, branchName: string, force: boolean = false): Promise<void> {
    try {
      const { git } = await this.getGitInstance(projectId)

      if (force) {
        await git.deleteLocalBranch(branchName, true)
      } else {
        await git.deleteLocalBranch(branchName)
      }
    } catch (error) {
      if (error instanceof ApiError) throw error
      this.handleGitError(error, 'delete branch')
    }
  }

  /**
   * Merge a branch
   */
  async mergeBranch(
    projectId: number,
    branchName: string,
    options?: { noFastForward?: boolean; message?: string }
  ): Promise<void> {
    try {
      const { git } = await this.getGitInstance(projectId)

      const mergeOptions: string[] = []
      if (options?.noFastForward) {
        mergeOptions.push('--no-ff')
      }
      if (options?.message) {
        mergeOptions.push('-m', options.message)
      }

      await git.merge([branchName, ...mergeOptions])
      gitStatusService.clearCache(projectId)
    } catch (error) {
      if (error instanceof ApiError) throw error
      this.handleGitError(error, 'merge branch')
    }
  }

  /**
   * Calculate relative time from a date string
   */
  private getRelativeTime(dateString: string): string {
    const date = new Date(dateString)
    const now = new Date()
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (seconds < 60) return `${seconds} second${seconds !== 1 ? 's' : ''} ago`

    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`

    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`

    const days = Math.floor(hours / 24)
    if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`

    const weeks = Math.floor(days / 7)
    if (weeks < 4) return `${weeks} week${weeks !== 1 ? 's' : ''} ago`

    const months = Math.floor(days / 30)
    if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`

    const years = Math.floor(days / 365)
    return `${years} year${years !== 1 ? 's' : ''} ago`
  }

  /**
   * Get enhanced branches with detailed information
   */
  async getBranchesEnhanced(projectId: number): Promise<GitBranchListEnhancedResponse> {
    try {
      const { git } = await this.getGitInstance(projectId)

      const status = await git.status()
      const currentBranch = status.current

      const [localBranches, remoteBranches] = await Promise.all([
        git.branchLocal(),
        git.branch(['-r'])
      ])

      // Determine default branch
      let defaultBranch = 'main'
      if ('main' in localBranches.branches) {
        defaultBranch = 'main'
      } else if ('master' in localBranches.branches) {
        defaultBranch = 'master'
      } else if ('origin/main' in remoteBranches.branches) {
        defaultBranch = 'main'
      } else if ('origin/master' in remoteBranches.branches) {
        defaultBranch = 'master'
      }

      const enhancedBranches: GitBranchEnhanced[] = []

      // Process local branches
      for (const [name, branch] of Object.entries(localBranches.branches)) {
        let latestCommit: any = null
        let authorDate: string | undefined

        try {
          const logResult = await git.log([name, '-1'])
          latestCommit = logResult.latest
          authorDate = latestCommit?.date
        } catch (error) {
          this.logger.error(`Failed to get log for branch ${name}:`, error)
        }

        // Fallback: use git show if log failed
        if (!authorDate && branch.commit) {
          try {
            const showResult = await git.show([branch.commit, '--format=%aI', '--no-patch'])
            authorDate = showResult.trim()
          } catch (err) {
            this.logger.debug(`Failed to get date for commit ${branch.commit}`, err)
          }
        }

        // Calculate ahead/behind relative to default branch
        let ahead = 0
        let behind = 0

        if (name !== defaultBranch) {
          try {
            const revList = await git.raw(['rev-list', '--left-right', '--count', `${defaultBranch}...${name}`])
            const [behindStr = '0', aheadStr = '0'] = revList.trim().split('\t')
            behind = parseInt(behindStr, 10) || 0
            ahead = parseInt(aheadStr, 10) || 0
          } catch (error) {
            // If comparison fails, use default values
            ahead = 0
            behind = 0
          }
        }

        enhancedBranches.push({
          name,
          current: branch.current,
          isRemote: false,
          latestCommit: {
            hash: latestCommit?.hash || branch.commit,
            abbreviatedHash: latestCommit?.abbreviatedHash || branch.commit.substring(0, 8),
            subject: latestCommit?.message || '',
            author: latestCommit?.author_name || '',
            relativeTime: authorDate ? this.getRelativeTime(authorDate) : 'Unknown'
          },
          tracking: null,
          ahead: ahead || 0,
          behind: behind || 0,
          lastActivity: authorDate
        })
      }

      // Process remote branches
      for (const [name, branch] of Object.entries(remoteBranches.branches)) {
        if (name.includes('HEAD')) continue

        let latestCommit: any = null
        let authorDate: string | undefined

        try {
          const logResult = await git.log([name, '-1'])
          latestCommit = logResult.latest
          authorDate = latestCommit?.date
        } catch (error) {
          this.logger.error(`Failed to get log for remote branch ${name}:`, error)
        }

        // Fallback: use git show if log failed
        if (!authorDate && branch.commit) {
          try {
            const showResult = await git.show([branch.commit, '--format=%aI', '--no-patch'])
            authorDate = showResult.trim()
          } catch (err) {
            this.logger.debug(`Failed to get date for commit ${branch.commit}`, err)
          }
        }

        if (branch.commit) {
          enhancedBranches.push({
            name,
            current: false,
            isRemote: true,
            latestCommit: {
              hash: latestCommit?.hash || branch.commit,
              abbreviatedHash: latestCommit?.abbreviatedHash || branch.commit.substring(0, 8),
              subject: latestCommit?.message || '',
              author: latestCommit?.author_name || '',
              relativeTime: authorDate ? this.getRelativeTime(authorDate) : 'Unknown'
            },
            tracking: null,
            ahead: 0,
            behind: 0,
            lastActivity: authorDate
          })
        }
      }

      // Sort branches by last activity
      enhancedBranches.sort((a, b) => {
        if (!a.lastActivity) return 1
        if (!b.lastActivity) return -1
        return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
      })

      return {
        success: true,
        data: {
          branches: enhancedBranches,
          current: currentBranch,
          defaultBranch
        }
      }
    } catch (error) {
      if (error instanceof ApiError) throw error
      return {
        success: false,
        message: `Failed to get enhanced branches: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }
}

// Export singleton instance
export const gitBranchService = new GitBranchService()