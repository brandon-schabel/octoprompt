import type { GitRemote, GitTag } from '@promptliano/schemas'
import { ApiError } from '@promptliano/shared'
import { BaseGitService } from './base-git-service'
import { gitStatusService } from './git-status-service'

/**
 * Service for Git remote operations, push, pull, fetch, and tags
 */
export class GitRemoteService extends BaseGitService {
  /**
   * Get all remotes
   */
  async getRemotes(projectId: number): Promise<GitRemote[]> {
    try {
      const { git } = await this.getGitInstance(projectId)

      const remotes = await git.getRemotes(true)

      return remotes.map((remote) => ({
        name: remote.name,
        fetch: remote.refs.fetch || '',
        push: remote.refs.push || ''
      }))
    } catch (error) {
      if (error instanceof ApiError) throw error
      this.handleGitError(error, 'get remotes')
    }
  }

  /**
   * Add a remote
   */
  async addRemote(projectId: number, name: string, url: string): Promise<void> {
    try {
      const { git } = await this.getGitInstance(projectId)
      await git.addRemote(name, url)
    } catch (error) {
      if (error instanceof ApiError) throw error
      this.handleGitError(error, 'add remote')
    }
  }

  /**
   * Remove a remote
   */
  async removeRemote(projectId: number, name: string): Promise<void> {
    try {
      const { git } = await this.getGitInstance(projectId)
      await git.removeRemote(name)
    } catch (error) {
      if (error instanceof ApiError) throw error
      this.handleGitError(error, 'remove remote')
    }
  }

  /**
   * Fetch from remote
   */
  async fetch(
    projectId: number,
    remote: string = 'origin',
    options?: { prune?: boolean }
  ): Promise<void> {
    try {
      const { git } = await this.getGitInstance(projectId)

      const fetchOptions: string[] = []
      if (options?.prune) {
        fetchOptions.push('--prune')
      }

      await git.fetch([remote, ...fetchOptions])
    } catch (error) {
      if (error instanceof ApiError) throw error
      this.handleGitError(error, 'fetch from remote')
    }
  }

  /**
   * Pull from remote
   */
  async pull(
    projectId: number,
    remote: string = 'origin',
    branch?: string,
    options?: { rebase?: boolean }
  ): Promise<void> {
    try {
      const { git } = await this.getGitInstance(projectId)

      const pullOptions: any = {}
      if (options?.rebase) {
        pullOptions['--rebase'] = null
      }

      if (branch) {
        await git.pull(remote, branch, pullOptions)
      } else {
        await git.pull(remote, pullOptions)
      }

      gitStatusService.clearCache(projectId)
    } catch (error) {
      if (error instanceof ApiError) throw error
      this.handleGitError(error, 'pull from remote')
    }
  }

  /**
   * Push to remote
   */
  async push(
    projectId: number,
    remote: string = 'origin',
    branch?: string,
    options?: { force?: boolean; setUpstream?: boolean }
  ): Promise<void> {
    try {
      const { git } = await this.getGitInstance(projectId)

      const pushOptions: any = {}
      if (options?.force) {
        pushOptions['--force'] = null
      }
      if (options?.setUpstream) {
        pushOptions['--set-upstream'] = null
      }

      if (branch) {
        await git.push(remote, branch, pushOptions)
      } else {
        await git.push(remote, pushOptions)
      }
    } catch (error) {
      if (error instanceof ApiError) throw error
      this.handleGitError(error, 'push to remote')
    }
  }

  /**
   * Get all tags
   */
  async getTags(projectId: number): Promise<GitTag[]> {
    try {
      const { git } = await this.getGitInstance(projectId)

      const tags = await git.tags([
        '--format=%(refname:short)%09%(objectname)%09%(subject)%09%(taggername)%09%(taggeremail)%09%(taggerdate:iso)'
      ])

      return tags.all.map((tagLine) => {
        const [name = '', commit = '', annotation = '', taggerName = '', taggerEmail = '', taggerDate = ''] =
          tagLine.split('\t')

        const tag: GitTag = {
          name,
          commit,
          annotation: annotation || undefined
        }

        if (taggerName && taggerEmail) {
          tag.tagger = {
            name: taggerName,
            email: taggerEmail,
            date: taggerDate
          }
        }

        return tag
      })
    } catch (error) {
      if (error instanceof ApiError) throw error
      this.handleGitError(error, 'get tags')
    }
  }

  /**
   * Create a tag
   */
  async createTag(
    projectId: number,
    tagName: string,
    options?: { message?: string; ref?: string }
  ): Promise<void> {
    try {
      const { git } = await this.getGitInstance(projectId)

      const tagOptions: string[] = []
      if (options?.message) {
        tagOptions.push('-a', tagName, '-m', options.message)
      } else {
        tagOptions.push(tagName)
      }

      if (options?.ref) {
        tagOptions.push(options.ref)
      }

      await git.tag(tagOptions)
    } catch (error) {
      if (error instanceof ApiError) throw error
      this.handleGitError(error, 'create tag')
    }
  }

  /**
   * Delete a tag
   */
  async deleteTag(projectId: number, tagName: string): Promise<void> {
    try {
      const { git } = await this.getGitInstance(projectId)
      await git.tag(['-d', tagName])
    } catch (error) {
      if (error instanceof ApiError) throw error
      this.handleGitError(error, 'delete tag')
    }
  }
}

// Export singleton instance
export const gitRemoteService = new GitRemoteService()