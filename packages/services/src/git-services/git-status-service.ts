import type { StatusResult, FileStatusResult } from 'simple-git'
import type { GitStatus, GitFileStatus, GitStatusResult, GitFileStatusType } from '@promptliano/schemas'
import { ApiError } from '@promptliano/shared'
import { BaseGitService } from './base-git-service'
import { retryOperation } from '../utils/retry-operation'

// Cache interface
interface GitStatusCache {
  status: GitStatus
  timestamp: number
}

/**
 * Service for Git status, staging, and diff operations
 */
export class GitStatusService extends BaseGitService {
  private readonly statusCache = new Map<number, GitStatusCache>()
  private readonly CACHE_TTL = 5000 // 5 seconds

  /**
   * Get file status type from simple-git file result
   */
  private getGitFileStatus(file: FileStatusResult): GitFileStatusType {
    if (file.index === 'A' || file.working_dir === 'A') return 'added'
    if (file.index === 'D' || file.working_dir === 'D') return 'deleted'
    if (file.index === 'M' || file.working_dir === 'M') return 'modified'
    if (file.index === 'R' || file.working_dir === 'R') return 'renamed'
    if (file.index === 'C' || file.working_dir === 'C') return 'copied'
    if (file.index === '?' && file.working_dir === '?') return 'untracked'
    if (file.index === '!' && file.working_dir === '!') return 'ignored'
    return 'unchanged'
  }

  /**
   * Map git status to schema
   */
  private mapGitStatusToSchema(status: StatusResult): GitStatus {
    const files: GitFileStatus[] = status.files.map((file) => ({
      path: file.path,
      status: this.getGitFileStatus(file),
      staged: file.index !== ' ' && file.index !== '?',
      index: file.index || null,
      workingDir: file.working_dir || null
    }))

    return {
      isRepo: true,
      current: status.current || null,
      tracking: status.tracking || null,
      ahead: status.ahead,
      behind: status.behind,
      files,
      staged: status.staged,
      modified: status.modified,
      created: status.created,
      deleted: status.deleted,
      renamed: status.renamed.map((r) => r.to),
      conflicted: status.conflicted
    }
  }

  /**
   * Get project git status
   */
  async getProjectGitStatus(projectId: number): Promise<GitStatusResult> {
    try {
      // Check cache first
      const cached = this.statusCache.get(projectId)
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return {
          success: true,
          data: cached.status
        }
      }

      const { git, projectPath } = await this.getGitInstance(projectId)

      // Check if it's a git repository
      const isRepo = await retryOperation(() => git.checkIsRepo(), {
        maxAttempts: 2,
        shouldRetry: (error) => {
          return (
            error.message?.includes('ENOENT') === false && (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT')
          )
        }
      })

      if (!isRepo) {
        return {
          success: false,
          error: {
            type: 'not_a_repo',
            message: 'The project directory is not a git repository'
          }
        }
      }

      // Get the status with retry for network issues
      const status = await retryOperation(() => git.status(), {
        maxAttempts: 3,
        shouldRetry: (error) => {
          return (
            error.code === 'ENOTFOUND' ||
            error.code === 'ETIMEDOUT' ||
            error.message?.includes('Could not read from remote repository')
          )
        }
      })

      const gitStatus = this.mapGitStatusToSchema(status)

      // Cache the result
      this.statusCache.set(projectId, {
        status: gitStatus,
        timestamp: Date.now()
      })

      return {
        success: true,
        data: gitStatus
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      if (errorMessage.includes('not a git repository')) {
        return {
          success: false,
          error: {
            type: 'not_a_repo',
            message: 'The project directory is not a git repository'
          }
        }
      }

      if (errorMessage.includes('git: command not found') || errorMessage.includes('git not found')) {
        return {
          success: false,
          error: {
            type: 'git_not_installed',
            message: 'Git is not installed on the system'
          }
        }
      }

      if (errorMessage.includes('permission denied') || errorMessage.includes('access denied')) {
        return {
          success: false,
          error: {
            type: 'permission_denied',
            message: 'Permission denied when accessing the git repository'
          }
        }
      }

      return {
        success: false,
        error: {
          type: 'unknown',
          message: errorMessage
        }
      }
    }
  }

  /**
   * Clear git status cache
   */
  clearCache(projectId?: number): void {
    if (projectId !== undefined) {
      this.statusCache.delete(projectId)
    } else {
      this.statusCache.clear()
    }
  }

  /**
   * Stage files
   */
  async stageFiles(projectId: number, filePaths: string[]): Promise<void> {
    try {
      const { git, projectPath } = await this.getGitInstance(projectId)
      const relativePaths = this.toRelativePaths(projectPath, filePaths)
      await git.add(relativePaths)
      this.clearCache(projectId)
    } catch (error) {
      if (error instanceof ApiError) throw error
      this.handleGitError(error, 'stage files')
    }
  }

  /**
   * Unstage files
   */
  async unstageFiles(projectId: number, filePaths: string[]): Promise<void> {
    try {
      const { git, projectPath } = await this.getGitInstance(projectId)
      const relativePaths = this.toRelativePaths(projectPath, filePaths)
      await git.reset(['HEAD', ...relativePaths])
      this.clearCache(projectId)
    } catch (error) {
      if (error instanceof ApiError) throw error
      this.handleGitError(error, 'unstage files')
    }
  }

  /**
   * Stage all files
   */
  async stageAll(projectId: number): Promise<void> {
    try {
      const { git } = await this.getGitInstance(projectId)
      await git.add('.')
      this.clearCache(projectId)
    } catch (error) {
      if (error instanceof ApiError) throw error
      this.handleGitError(error, 'stage all files')
    }
  }

  /**
   * Unstage all files
   */
  async unstageAll(projectId: number): Promise<void> {
    try {
      const { git } = await this.getGitInstance(projectId)
      await git.reset(['HEAD'])
      this.clearCache(projectId)
    } catch (error) {
      if (error instanceof ApiError) throw error
      this.handleGitError(error, 'unstage all files')
    }
  }

  /**
   * Get file diff
   */
  async getFileDiff(
    projectId: number,
    filePath: string,
    options?: { commit?: string; staged?: boolean }
  ): Promise<string> {
    try {
      const { git } = await this.getGitInstance(projectId)

      if (options?.staged) {
        return await git.diff(['--cached', '--', filePath])
      } else if (options?.commit) {
        return await git.diff([`${options.commit}^`, options.commit, '--', filePath])
      } else {
        return await git.diff(['--', filePath])
      }
    } catch (error) {
      if (error instanceof ApiError) throw error
      this.handleGitError(error, 'get file diff')
    }
  }

  /**
   * Clean untracked files
   */
  async clean(
    projectId: number,
    options?: { directories?: boolean; force?: boolean; dryRun?: boolean }
  ): Promise<string[]> {
    try {
      const { git } = await this.getGitInstance(projectId)

      const cleanOptions: string[] = []
      if (options?.directories) cleanOptions.push('-d')
      if (options?.force) cleanOptions.push('-f')
      if (options?.dryRun) cleanOptions.push('-n')

      const result = await git.clean(cleanOptions.join('')) as string | { paths?: string[]; files?: string[]; folders?: string[] }

      // Handle both string and CleanSummary results
      if (typeof result === 'string') {
        return result.split('\n').filter(Boolean)
      } else {
        const cleanResult = result as any
        return [...(cleanResult.paths || []), ...(cleanResult.files || []), ...(cleanResult.folders || [])]
      }
    } catch (error) {
      if (error instanceof ApiError) throw error
      this.handleGitError(error, 'clean')
    }
  }
}

// Export singleton instance
export const gitStatusService = new GitStatusService()