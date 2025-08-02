import { join, resolve, normalize, sep } from 'path'
import { homedir, platform, tmpdir } from 'os'
import { existsSync } from 'fs'

/**
 * Cross-platform path utilities
 */
export class CrossPlatformPaths {
  private platform = platform()

  /**
   * Get user home directory
   */
  getHomeDir(): string {
    return homedir()
  }

  /**
   * Get temp directory
   */
  getTempDir(): string {
    return tmpdir()
  }

  /**
   * Get app data directory based on platform
   */
  getAppDataDir(appName: string): string {
    switch (this.platform) {
      case 'darwin':
        return join(homedir(), 'Library', 'Application Support', appName)
      case 'win32':
        return join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), appName)
      default:
        return join(homedir(), '.config', appName)
    }
  }

  /**
   * Get local app data directory (Windows) or cache directory (Unix)
   */
  getLocalAppDataDir(appName: string): string {
    switch (this.platform) {
      case 'darwin':
        return join(homedir(), 'Library', 'Caches', appName)
      case 'win32':
        return join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), appName)
      default:
        return join(homedir(), '.cache', appName)
    }
  }

  /**
   * Get logs directory
   */
  getLogsDir(appName: string): string {
    switch (this.platform) {
      case 'darwin':
        return join(homedir(), 'Library', 'Logs', appName)
      case 'win32':
        return join(this.getLocalAppDataDir(appName), 'logs')
      default:
        return join(homedir(), '.local', 'share', appName, 'logs')
    }
  }

  /**
   * Get desktop directory
   */
  getDesktopDir(): string {
    return join(homedir(), 'Desktop')
  }

  /**
   * Get documents directory
   */
  getDocumentsDir(): string {
    return join(homedir(), 'Documents')
  }

  /**
   * Get downloads directory
   */
  getDownloadsDir(): string {
    return join(homedir(), 'Downloads')
  }

  /**
   * Convert Windows path to Unix-style
   */
  toUnixPath(path: string): string {
    return path.replace(/\\/g, '/')
  }

  /**
   * Convert Unix path to platform-specific
   */
  toPlatformPath(path: string): string {
    if (this.platform === 'win32') {
      return path.replace(/\//g, '\\')
    }
    return path
  }

  /**
   * Normalize path for current platform
   */
  normalizePath(path: string): string {
    return normalize(resolve(path))
  }

  /**
   * Join paths safely across platforms
   */
  joinPath(...paths: string[]): string {
    return join(...paths)
  }

  /**
   * Get path separator for current platform
   */
  getPathSeparator(): string {
    return sep
  }

  /**
   * Check if path is absolute
   */
  isAbsolutePath(path: string): boolean {
    if (this.platform === 'win32') {
      // Windows absolute paths: C:\, \\server\share, etc.
      return /^([a-zA-Z]:[\\/]|\\\\)/.test(path)
    }
    // Unix absolute paths start with /
    return path.startsWith('/')
  }

  /**
   * Get executable extension for platform
   */
  getExecutableExtension(): string {
    return this.platform === 'win32' ? '.exe' : ''
  }

  /**
   * Get script extension for platform
   */
  getScriptExtension(): string {
    return this.platform === 'win32' ? '.bat' : '.sh'
  }

  /**
   * Find executable in PATH
   */
  async findExecutable(name: string): Promise<string | null> {
    const pathEnv = process.env.PATH || ''
    const pathDirs = pathEnv.split(this.platform === 'win32' ? ';' : ':')

    // Add common directories if not in PATH
    if (this.platform === 'win32') {
      pathDirs.push('C:\\Program Files\\nodejs', 'C:\\Program Files (x86)\\nodejs', join(homedir(), '.bun', 'bin'))
    } else {
      pathDirs.push('/usr/local/bin', '/usr/bin', '/bin', join(homedir(), '.bun', 'bin'))
    }

    for (const dir of pathDirs) {
      const fullPath = join(dir, name + this.getExecutableExtension())
      if (existsSync(fullPath)) {
        return fullPath
      }

      // On Windows, also check without extension
      if (this.platform === 'win32' && existsSync(join(dir, name))) {
        return join(dir, name)
      }
    }

    return null
  }

  /**
   * Expand environment variables in path
   */
  expandPath(path: string): string {
    if (this.platform === 'win32') {
      // Expand Windows environment variables like %APPDATA%
      return path.replace(/%([^%]+)%/g, (_, varName) => {
        return process.env[varName] || `%${varName}%`
      })
    } else {
      // Expand Unix environment variables like $HOME or ${HOME}
      return path.replace(/\$\{?([A-Z_]+)\}?/g, (_, varName) => {
        return process.env[varName] || `$${varName}`
      })
    }
  }

  /**
   * Get shell configuration file path
   */
  getShellConfigPath(): string {
    if (this.platform === 'win32') {
      return join(homedir(), 'Documents', 'WindowsPowerShell', 'Microsoft.PowerShell_profile.ps1')
    }

    // Check which shell is being used
    const shell = process.env.SHELL || '/bin/bash'
    const shellName = shell.split('/').pop()

    switch (shellName) {
      case 'zsh':
        return join(homedir(), '.zshrc')
      case 'fish':
        return join(homedir(), '.config', 'fish', 'config.fish')
      case 'bash':
      default:
        // Check for .bash_profile on macOS, .bashrc on Linux
        const bashProfile = join(homedir(), '.bash_profile')
        if (this.platform === 'darwin' && existsSync(bashProfile)) {
          return bashProfile
        }
        return join(homedir(), '.bashrc')
    }
  }
}

/**
 * Global instance
 */
export const paths = new CrossPlatformPaths()

/**
 * Common Promptliano paths
 */
export class PromptlianoPaths {
  private paths = new CrossPlatformPaths()

  getInstallDir(): string {
    return join(this.paths.getHomeDir(), '.promptliano')
  }

  getDataDir(): string {
    return join(this.getInstallDir(), 'data')
  }

  getLogsDir(): string {
    return join(this.getInstallDir(), 'logs')
  }

  getBackupsDir(): string {
    return join(this.paths.getHomeDir(), '.promptliano-backups')
  }

  getConfigDir(): string {
    return this.paths.getAppDataDir('promptliano')
  }

  getCacheDir(): string {
    return this.paths.getLocalAppDataDir('promptliano')
  }

  getServerPidFile(): string {
    return join(this.getLogsDir(), 'server.pid')
  }

  getMCPConfigPath(editor: string): string {
    switch (editor) {
      case 'claude':
        return this.paths.getAppDataDir('Claude') + sep + 'mcp-settings.json'
      case 'vscode':
        return join(this.paths.getHomeDir(), '.vscode', 'settings.json')
      case 'cursor':
        return join(this.paths.getHomeDir(), '.cursor', 'settings.json')
      case 'windsurf':
        return join(this.paths.getHomeDir(), '.windsurf', 'settings.json')
      default:
        throw new Error(`Unknown editor: ${editor}`)
    }
  }
}

export const promptlianoPaths = new PromptlianoPaths()
