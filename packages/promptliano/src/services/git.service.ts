import simpleGit, { type SimpleGit } from 'simple-git'
import { Logger } from '../utils/logger.js'
import { fileExists } from '../utils/paths.js'
import { join } from 'node:path'

export class GitService {
  private git: SimpleGit
  private logger: Logger

  constructor(logger: Logger) {
    this.git = simpleGit()
    this.logger = logger
  }

  async clone(repoUrl: string, targetPath: string): Promise<void> {
    const spinner = this.logger.spinner(`Cloning repository to ${targetPath}`)

    try {
      await this.git.clone(repoUrl, targetPath, ['--depth', '1'])
      spinner.succeed('Repository cloned successfully')
    } catch (error) {
      spinner.fail('Failed to clone repository')
      throw error
    }
  }

  async pull(repoPath: string): Promise<void> {
    const spinner = this.logger.spinner('Pulling latest changes')

    try {
      const git = simpleGit(repoPath)
      await git.pull()
      spinner.succeed('Repository updated successfully')
    } catch (error) {
      spinner.fail('Failed to pull changes')
      throw error
    }
  }

  async isRepo(path: string): Promise<boolean> {
    if (!fileExists(path)) {
      return false
    }

    try {
      const git = simpleGit(path)
      await git.checkIsRepo()
      return true
    } catch {
      return false
    }
  }

  async getCurrentBranch(repoPath: string): Promise<string | null> {
    try {
      const git = simpleGit(repoPath)
      const branch = await git.revparse(['--abbrev-ref', 'HEAD'])
      return branch.trim()
    } catch {
      return null
    }
  }

  async hasRemote(repoPath: string): Promise<boolean> {
    try {
      const git = simpleGit(repoPath)
      const remotes = await git.getRemotes()
      return remotes.length > 0
    } catch {
      return false
    }
  }

  async getLatestCommit(repoPath: string): Promise<string | null> {
    try {
      const git = simpleGit(repoPath)
      const log = await git.log(['-1'])
      return log.latest?.hash || null
    } catch {
      return null
    }
  }
}
