import { ApiError } from '@promptliano/shared'
import { BaseGitService } from './base-git-service'

/**
 * Service for Git configuration management
 */
export class GitConfigService extends BaseGitService {
  /**
   * Get git configuration
   */
  async getConfig(
    projectId: number,
    key?: string,
    options?: { global?: boolean }
  ): Promise<string | Record<string, string>> {
    try {
      const { git } = await this.getGitInstance(projectId)

      if (key) {
        const configOptions: string[] = ['config']
        if (options?.global) {
          configOptions.push('--global')
        }
        configOptions.push(key)

        const value = await git.raw(configOptions)
        return value.trim()
      } else {
        const configOptions: string[] = ['config', '--list']
        if (options?.global) {
          configOptions.push('--global')
        }

        const configList = await git.raw(configOptions)
        const config: Record<string, string> = {}

        configList.split('\n').forEach((line) => {
          const [key, value] = line.split('=', 2)
          if (key && value) {
            config[key] = value
          }
        })

        return config
      }
    } catch (error) {
      if (error instanceof ApiError) throw error
      this.handleGitError(error, 'get config')
    }
  }

  /**
   * Set git configuration
   */
  async setConfig(
    projectId: number,
    key: string,
    value: string,
    options?: { global?: boolean }
  ): Promise<void> {
    try {
      const { git } = await this.getGitInstance(projectId)

      const configOptions: string[] = ['config']
      if (options?.global) {
        configOptions.push('--global')
      }
      configOptions.push(key, value)

      await git.raw(configOptions)
    } catch (error) {
      if (error instanceof ApiError) throw error
      this.handleGitError(error, 'set config')
    }
  }

  /**
   * Unset git configuration
   */
  async unsetConfig(
    projectId: number,
    key: string,
    options?: { global?: boolean }
  ): Promise<void> {
    try {
      const { git } = await this.getGitInstance(projectId)

      const configOptions: string[] = ['config', '--unset']
      if (options?.global) {
        configOptions.push('--global')
      }
      configOptions.push(key)

      await git.raw(configOptions)
    } catch (error) {
      if (error instanceof ApiError) throw error
      this.handleGitError(error, 'unset config')
    }
  }

  /**
   * Get user name from config
   */
  async getUserName(projectId: number, global: boolean = false): Promise<string | null> {
    try {
      const name = await this.getConfig(projectId, 'user.name', { global })
      return typeof name === 'string' ? name : null
    } catch (error) {
      return null
    }
  }

  /**
   * Get user email from config
   */
  async getUserEmail(projectId: number, global: boolean = false): Promise<string | null> {
    try {
      const email = await this.getConfig(projectId, 'user.email', { global })
      return typeof email === 'string' ? email : null
    } catch (error) {
      return null
    }
  }

  /**
   * Set user name in config
   */
  async setUserName(projectId: number, name: string, global: boolean = false): Promise<void> {
    await this.setConfig(projectId, 'user.name', name, { global })
  }

  /**
   * Set user email in config
   */
  async setUserEmail(projectId: number, email: string, global: boolean = false): Promise<void> {
    await this.setConfig(projectId, 'user.email', email, { global })
  }

  /**
   * Get default branch name from config
   */
  async getDefaultBranch(projectId: number): Promise<string> {
    try {
      const branch = await this.getConfig(projectId, 'init.defaultBranch')
      return typeof branch === 'string' && branch ? branch : 'main'
    } catch (error) {
      return 'main'
    }
  }

  /**
   * Set default branch name in config
   */
  async setDefaultBranch(projectId: number, branch: string, global: boolean = false): Promise<void> {
    await this.setConfig(projectId, 'init.defaultBranch', branch, { global })
  }
}

// Export singleton instance
export const gitConfigService = new GitConfigService()