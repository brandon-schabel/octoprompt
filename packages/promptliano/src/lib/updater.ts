import { existsSync } from 'fs'
import { readFile, rm, rename } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import { PromptlianoDownloader } from './downloader.js'
import { logger } from './logger.js'

interface UpdateInfo {
  hasUpdate: boolean
  currentVersion?: string
  latestVersion: string
  releaseNotes?: string
}

interface UpdateOptions {
  onProgress?: (progress: number) => void
}

export class PromptlianoUpdater {
  private installPath: string
  private downloader: PromptlianoDownloader

  constructor() {
    this.installPath = join(homedir(), '.promptliano')
    this.downloader = new PromptlianoDownloader()
  }

  async checkForUpdates(): Promise<UpdateInfo> {
    try {
      // Get current version
      const currentVersion = await this.getCurrentVersion()

      // Check latest version
      const updateInfo = await this.downloader.checkForUpdates(currentVersion)

      return updateInfo
    } catch (error) {
      logger.error('Failed to check for updates:', error)
      throw error
    }
  }

  async update(options: UpdateOptions = {}): Promise<void> {
    try {
      // Create backup directory
      const backupPath = `${this.installPath}.backup`

      // Backup current installation
      if (existsSync(this.installPath)) {
        logger.info('Creating backup of current installation')

        // Remove old backup if exists
        if (existsSync(backupPath)) {
          await rm(backupPath, { recursive: true, force: true })
        }

        // Rename current to backup
        await rename(this.installPath, backupPath)
      }

      try {
        // Download new version
        await this.downloader.download({
          installPath: this.installPath,
          onProgress: options.onProgress
        })

        // Remove backup on success
        if (existsSync(backupPath)) {
          await rm(backupPath, { recursive: true, force: true })
        }

        logger.info('Update completed successfully')
      } catch (error) {
        // Restore backup on failure
        logger.error('Update failed, restoring backup')

        if (existsSync(this.installPath)) {
          await rm(this.installPath, { recursive: true, force: true })
        }

        if (existsSync(backupPath)) {
          await rename(backupPath, this.installPath)
        }

        throw error
      }
    } catch (error) {
      logger.error('Update failed:', error)
      throw error
    }
  }

  async install(): Promise<void> {
    // Post-update tasks
    logger.info('Running post-update tasks')

    // Ensure scripts are executable on Unix
    if (process.platform !== 'win32') {
      const { chmod } = await import('fs/promises')
      const scriptPath = join(this.installPath, 'packages', 'server', 'mcp-start.sh')
      if (existsSync(scriptPath)) {
        await chmod(scriptPath, 0o755)
      }
    }

    // Clear any caches
    const cacheDir = join(this.installPath, '.cache')
    if (existsSync(cacheDir)) {
      await rm(cacheDir, { recursive: true, force: true })
    }

    logger.info('Post-update tasks completed')
  }

  private async getCurrentVersion(): Promise<string | undefined> {
    try {
      const packagePath = join(this.installPath, 'package.json')

      if (!existsSync(packagePath)) {
        return undefined
      }

      const content = await readFile(packagePath, 'utf-8')
      const packageJson = JSON.parse(content)

      return packageJson.version
    } catch (error) {
      logger.debug('Failed to read current version:', error)
      return undefined
    }
  }
}
