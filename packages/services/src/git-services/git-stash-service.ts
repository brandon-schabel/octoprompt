import type { GitStash } from '@promptliano/schemas'
import { ApiError } from '@promptliano/shared'
import { BaseGitService } from './base-git-service'
import { gitStatusService } from './git-status-service'

/**
 * Service for Git stash operations
 */
export class GitStashService extends BaseGitService {
  /**
   * Stash changes
   */
  async stash(projectId: number, message?: string): Promise<void> {
    try {
      const { git } = await this.getGitInstance(projectId)

      if (message) {
        await git.stash(['push', '-m', message])
      } else {
        await git.stash()
      }

      gitStatusService.clearCache(projectId)
    } catch (error) {
      if (error instanceof ApiError) throw error
      this.handleGitError(error, 'stash changes')
    }
  }

  /**
   * List stashes
   */
  async stashList(projectId: number): Promise<GitStash[]> {
    try {
      const { git } = await this.getGitInstance(projectId)

      const stashListResult = await git.stashList()

      return stashListResult.all.map((stashItem, index) => {
        // Parse stash message format: stash@{0}: WIP on branch: message
        const message = stashItem.message || ''
        const match = message.match(/WIP on (.+?): (.+)$/) || message.match(/On (.+?): (.+)$/)

        return {
          index,
          message: match && match[2] ? match[2] : message,
          branch: match && match[1] ? match[1] : 'unknown',
          date: stashItem.date || new Date().toISOString()
        }
      })
    } catch (error) {
      if (error instanceof ApiError) throw error
      this.handleGitError(error, 'list stashes')
    }
  }

  /**
   * Apply a stash
   */
  async stashApply(projectId: number, stashRef: string = 'stash@{0}'): Promise<void> {
    try {
      const { git } = await this.getGitInstance(projectId)
      await git.stash(['apply', stashRef])
      gitStatusService.clearCache(projectId)
    } catch (error) {
      if (error instanceof ApiError) throw error
      this.handleGitError(error, 'apply stash')
    }
  }

  /**
   * Pop a stash
   */
  async stashPop(projectId: number, stashRef: string = 'stash@{0}'): Promise<void> {
    try {
      const { git } = await this.getGitInstance(projectId)
      await git.stash(['pop', stashRef])
      gitStatusService.clearCache(projectId)
    } catch (error) {
      if (error instanceof ApiError) throw error
      this.handleGitError(error, 'pop stash')
    }
  }

  /**
   * Drop a stash
   */
  async stashDrop(projectId: number, stashRef: string = 'stash@{0}'): Promise<void> {
    try {
      const { git } = await this.getGitInstance(projectId)
      await git.stash(['drop', stashRef])
    } catch (error) {
      if (error instanceof ApiError) throw error
      this.handleGitError(error, 'drop stash')
    }
  }
}

// Export singleton instance
export const gitStashService = new GitStashService()