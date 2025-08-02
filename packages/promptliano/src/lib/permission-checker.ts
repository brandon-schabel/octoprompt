import { access, stat, writeFile, unlink, mkdir, chmod } from 'fs/promises'
import { constants, existsSync } from 'fs'
import { join, dirname } from 'path'
import { platform } from 'os'
import { logger } from './logger.js'

export interface PermissionResult {
  canRead: boolean
  canWrite: boolean
  canExecute: boolean
  isDirectory?: boolean
  owner?: string
  group?: string
  mode?: string
}

export class PermissionChecker {
  async check(path: string): Promise<PermissionResult> {
    const result: PermissionResult = {
      canRead: false,
      canWrite: false,
      canExecute: false
    }

    try {
      // Check if path exists
      if (!existsSync(path)) {
        // Check parent directory permissions instead
        const parent = dirname(path)
        if (existsSync(parent)) {
          return this.check(parent)
        }
        return result
      }

      // Get file stats
      const stats = await stat(path)
      result.isDirectory = stats.isDirectory()

      // Check read permission
      try {
        await access(path, constants.R_OK)
        result.canRead = true
      } catch {
        result.canRead = false
      }

      // Check write permission
      try {
        await access(path, constants.W_OK)
        result.canWrite = true
      } catch {
        result.canWrite = false
      }

      // Check execute permission
      try {
        await access(path, constants.X_OK)
        result.canExecute = true
      } catch {
        result.canExecute = false
      }

      // Get additional info on Unix systems
      if (platform() !== 'win32') {
        result.mode = (stats.mode & parseInt('777', 8)).toString(8)
        // On some systems we can get owner/group info
        // This would require additional native bindings
      }
    } catch (error) {
      logger.debug(`Permission check failed for ${path}:`, error)
    }

    return result
  }

  async checkInstallPermissions(installPath: string): Promise<PermissionResult> {
    // For installation, we need write permission in the parent directory
    const parent = dirname(installPath)

    // Ensure parent exists
    if (!existsSync(parent)) {
      try {
        await mkdir(parent, { recursive: true })
      } catch (error) {
        return {
          canRead: false,
          canWrite: false,
          canExecute: false
        }
      }
    }

    // Check if we can write to parent
    const parentPerms = await this.check(parent)

    // If install path exists, check it directly
    if (existsSync(installPath)) {
      const installPerms = await this.check(installPath)
      return {
        ...installPerms,
        canWrite: parentPerms.canWrite && installPerms.canWrite
      }
    }

    return parentPerms
  }

  async checkExecutable(filePath: string): Promise<boolean> {
    if (!existsSync(filePath)) {
      return false
    }

    if (platform() === 'win32') {
      // On Windows, check file extension instead of permissions
      const ext = filePath.toLowerCase().split('.').pop()
      const executableExtensions = ['exe', 'bat', 'cmd', 'com', 'ps1', 'vbs', 'js', 'msi']
      return executableExtensions.includes(ext || '')
    }

    const perms = await this.check(filePath)
    return perms.canExecute
  }

  async makeExecutable(filePath: string): Promise<void> {
    if (platform() === 'win32') {
      // On Windows, executability is determined by file extension
      const ext = filePath.toLowerCase().split('.').pop()
      const executableExtensions = ['exe', 'bat', 'cmd', 'com', 'ps1', 'vbs', 'js', 'msi']
      if (!executableExtensions.includes(ext || '')) {
        logger.warn(`Cannot make ${filePath} executable on Windows - invalid extension`)
      }
      return
    }

    try {
      const stats = await stat(filePath)
      const newMode = stats.mode | 0o111 // Add execute permission for all
      await chmod(filePath, newMode)
    } catch (error) {
      logger.error(`Failed to make ${filePath} executable:`, error)
      throw new Error(`Cannot make file executable: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async testWrite(path: string): Promise<boolean> {
    const testFile = join(path, `.promptliano-write-test-${Date.now()}`)

    try {
      // Try to create a test file
      await writeFile(testFile, 'test')
      // Clean up
      await unlink(testFile)
      return true
    } catch (error) {
      return false
    }
  }

  async ensureDirectoryPermissions(dirPath: string): Promise<void> {
    try {
      // Create directory if it doesn't exist
      if (!existsSync(dirPath)) {
        await mkdir(dirPath, { recursive: true })
      }

      // Check permissions
      const perms = await this.check(dirPath)

      if (!perms.canWrite) {
        throw new Error(`No write permission for directory: ${dirPath}`)
      }

      if (!perms.canRead) {
        throw new Error(`No read permission for directory: ${dirPath}`)
      }

      // On Unix, ensure execute permission for directories
      if (platform() !== 'win32' && !perms.canExecute) {
        await this.makeExecutable(dirPath)
      }
    } catch (error) {
      logger.error(`Failed to ensure directory permissions for ${dirPath}:`, error)
      throw error
    }
  }

  async checkPortPermission(port: number): Promise<boolean> {
    // On Unix systems, ports below 1024 require root
    if (platform() !== 'win32' && port < 1024) {
      return process.getuid ? process.getuid() === 0 : false
    }
    return true
  }

  getSuggestedPermissions(path: string): string {
    const isDir = existsSync(path) && stat(path).then((s) => s.isDirectory())

    if (platform() === 'win32') {
      return 'Ensure your user account has full control of this folder'
    }

    if (isDir) {
      return 'chmod 755 ' + path
    } else {
      return 'chmod 644 ' + path
    }
  }
}
