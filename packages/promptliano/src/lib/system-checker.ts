import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { homedir, platform } from 'os'
import { logger } from './logger.js'
import { safeExec, safeInstallBun } from './safe-exec.js'
import { paths, promptlianoPaths } from './cross-platform-paths.js'

export class SystemChecker {
  async checkNodeVersion(): Promise<{
    valid: boolean
    version: string
    required: string
  }> {
    try {
      const { stdout } = await safeExec('node --version')
      const version = stdout.trim().replace('v', '')
      const [major] = version.split('.').map(Number)

      return {
        valid: major >= 18,
        version,
        required: '18.0.0'
      }
    } catch (error) {
      logger.error('Failed to check Node.js version:', error)
      return { valid: false, version: 'unknown', required: '18.0.0' }
    }
  }

  async checkBun(): Promise<{
    installed: boolean
    version?: string
    path?: string
  }> {
    try {
      const { stdout } = await safeExec('bun --version')
      const version = stdout.trim()

      const { stdout: pathOutput } = await safeExec(platform() === 'win32' ? 'where bun' : 'which bun')

      return {
        installed: true,
        version,
        path: pathOutput.trim()
      }
    } catch (error) {
      return { installed: false }
    }
  }

  async installBun(): Promise<void> {
    try {
      await safeInstallBun()

      // Add to PATH for current session
      const bunPath = paths.joinPath(paths.getHomeDir(), '.bun', 'bin')
      const pathSep = platform() === 'win32' ? ';' : ':'
      process.env.PATH = `${bunPath}${pathSep}${process.env.PATH}`

      logger.info('Bun installed successfully')
    } catch (error) {
      logger.error('Failed to install Bun:', error)
      throw new Error('Bun installation failed. Please install manually from https://bun.sh')
    }
  }

  async checkPromptliano(): Promise<{
    installed: boolean
    path?: string
    version?: string
  }> {
    const installPath = promptlianoPaths.getInstallDir()

    // Check for bundled installation first
    const bundledServerPath = paths.joinPath(installPath, 'server.js')
    // Then check for source structure
    const sourceServerPath = paths.joinPath(installPath, 'packages', 'server')

    if (!existsSync(bundledServerPath) && !existsSync(sourceServerPath)) {
      return { installed: false }
    }

    try {
      // Try to read version from package.json
      const packagePath = paths.joinPath(installPath, 'package.json')
      if (existsSync(packagePath)) {
        const packageContent = await readFile(packagePath, 'utf-8')
        const packageJson = JSON.parse(packageContent)
        return {
          installed: true,
          path: installPath,
          version: packageJson.version
        }
      }
    } catch (error) {
      // Ignore version read errors
    }

    return {
      installed: true,
      path: installPath
    }
  }

  async checkMCPConfigs(): Promise<{
    configured: string[]
    configs: Record<string, any>
  }> {
    const configured: string[] = []
    const configs: Record<string, any> = {}

    // Check each editor's config
    const editors = [
      {
        name: 'claude',
        path: promptlianoPaths.getMCPConfigPath('claude')
      },
      {
        name: 'vscode',
        path: promptlianoPaths.getMCPConfigPath('vscode')
      },
      {
        name: 'cursor',
        path: promptlianoPaths.getMCPConfigPath('cursor')
      },
      {
        name: 'windsurf',
        path: promptlianoPaths.getMCPConfigPath('windsurf')
      }
    ]

    for (const editor of editors) {
      if (existsSync(editor.path)) {
        try {
          const configContent = await readFile(editor.path, 'utf-8')
          const config = JSON.parse(configContent)
          const mcpKey = editor.name === 'claude' ? 'mcpServers' : 'mcp.servers'

          if (config[mcpKey]) {
            const promptlianoServers = Object.keys(config[mcpKey]).filter((key) => key.includes('promptliano'))

            if (promptlianoServers.length > 0) {
              configured.push(editor.name)
              configs[editor.name] = promptlianoServers
            }
          }
        } catch (error) {
          // Ignore parse errors
        }
      }
    }

    return { configured, configs }
  }

  async checkServer(): Promise<{
    running: boolean
    port?: number
    pid?: number
  }> {
    try {
      // Try to connect to default port
      const response = await fetch('http://localhost:3579/api/health', {
        signal: AbortSignal.timeout(2000)
      })

      if (response.ok) {
        return {
          running: true,
          port: 3579
        }
      }
    } catch (error) {
      // Server not running
    }

    return { running: false }
  }

  async checkNetwork(): Promise<{
    connected: boolean
    latency?: number
  }> {
    try {
      const start = Date.now()
      const response = await fetch('https://api.github.com', {
        signal: AbortSignal.timeout(5000)
      })
      const latency = Date.now() - start

      return {
        connected: response.ok,
        latency
      }
    } catch (error) {
      return { connected: false }
    }
  }
}
