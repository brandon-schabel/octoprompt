// Global MCP configuration service
// Handles MCP configurations that apply across all projects
// No project-specific IDs or paths in global configs

import * as fs from 'fs/promises'
import * as fsSync from 'fs'
import * as path from 'path'
import * as os from 'os'
import { z } from 'zod'
import { createLogger } from './utils/logger'
import { EventEmitter } from 'events'

const logger = createLogger('MCPGlobalConfigService')

// Global configuration schemas
export const GlobalMCPServerConfigSchema = z.object({
  type: z.enum(['stdio', 'http']).default('stdio'),
  command: z.string(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  timeout: z.number().optional()
})

export const GlobalMCPConfigSchema = z.object({
  servers: z.record(GlobalMCPServerConfigSchema),
  defaultServerUrl: z.string().default('http://localhost:3147/api/mcp'),
  debugMode: z.boolean().default(false),
  defaultTimeout: z.number().optional(),
  globalEnv: z.record(z.string()).optional()
})

export const GlobalInstallationRecordSchema = z.object({
  tool: z.string(),
  installedAt: z.number(),
  configPath: z.string(),
  serverName: z.string(),
  version: z.string().optional()
})

export const GlobalMCPStateSchema = z.object({
  installations: z.array(GlobalInstallationRecordSchema),
  config: GlobalMCPConfigSchema,
  lastModified: z.number()
})

export type GlobalMCPServerConfig = z.infer<typeof GlobalMCPServerConfigSchema>
export type GlobalMCPConfig = z.infer<typeof GlobalMCPConfigSchema>
export type GlobalInstallationRecord = z.infer<typeof GlobalInstallationRecordSchema>
export type GlobalMCPState = z.infer<typeof GlobalMCPStateSchema>

export class MCPGlobalConfigService extends EventEmitter {
  private configPath: string
  private stateCache: GlobalMCPState | null = null
  private fileWatcher: fsSync.FSWatcher | null = null

  constructor() {
    super()
    this.configPath = path.join(os.homedir(), '.promptliano', 'global-mcp-config.json')
  }

  /**
   * Initialize the service and ensure config directory exists
   */
  async initialize(): Promise<void> {
    const configDir = path.dirname(this.configPath)
    await fs.mkdir(configDir, { recursive: true })

    // Load or create initial state
    await this.loadState()

    // Set up file watching
    this.watchConfigFile()
  }

  /**
   * Get the global MCP configuration
   */
  async getGlobalConfig(): Promise<GlobalMCPConfig> {
    const state = await this.loadState()
    return state.config
  }

  /**
   * Update the global MCP configuration
   */
  async updateGlobalConfig(updates: Partial<GlobalMCPConfig>): Promise<GlobalMCPConfig> {
    const state = await this.loadState()

    state.config = {
      ...state.config,
      ...updates,
      servers: {
        ...state.config.servers,
        ...(updates.servers || {})
      }
    }

    state.lastModified = Date.now()
    await this.saveState(state)

    this.emit('configChanged', state.config)
    return state.config
  }

  /**
   * Get all global installations
   */
  async getGlobalInstallations(): Promise<GlobalInstallationRecord[]> {
    const state = await this.loadState()
    return state.installations
  }

  /**
   * Add a global installation record
   */
  async addGlobalInstallation(installation: Omit<GlobalInstallationRecord, 'installedAt'>): Promise<void> {
    const state = await this.loadState()

    // Remove existing installation for the same tool if any
    state.installations = state.installations.filter((i) => i.tool !== installation.tool)

    // Add new installation
    state.installations.push({
      ...installation,
      installedAt: Date.now()
    })

    state.lastModified = Date.now()
    await this.saveState(state)

    this.emit('installationAdded', installation)
  }

  /**
   * Remove a global installation record
   */
  async removeGlobalInstallation(tool: string): Promise<void> {
    const state = await this.loadState()

    const removed = state.installations.find((i) => i.tool === tool)
    state.installations = state.installations.filter((i) => i.tool !== tool)

    state.lastModified = Date.now()
    await this.saveState(state)

    if (removed) {
      this.emit('installationRemoved', removed)
    }
  }

  /**
   * Check if a tool has global Promptliano installed
   */
  async hasGlobalInstallation(tool: string): Promise<boolean> {
    const state = await this.loadState()
    return state.installations.some((i) => i.tool === tool)
  }

  /**
   * Get global server configuration for MCP
   */
  async getGlobalServerConfig(): Promise<GlobalMCPServerConfig> {
    const config = await this.getGlobalConfig()

    // Get the Promptliano installation path
    let promptlianoPath = process.cwd()
    if (promptlianoPath.includes('packages/server')) {
      promptlianoPath = path.resolve(promptlianoPath, '../..')
    }

    const scriptPath =
      process.platform === 'win32'
        ? path.join(promptlianoPath, 'packages/server/mcp-start.bat')
        : path.join(promptlianoPath, 'packages/server/mcp-start.sh')

    return {
      type: 'stdio',
      command: process.platform === 'win32' ? 'cmd.exe' : 'sh',
      args: process.platform === 'win32' ? ['/c', scriptPath] : [scriptPath],
      env: {
        // No project ID for global installation
        PROMPTLIANO_API_URL: config.defaultServerUrl,
        MCP_DEBUG: config.debugMode ? 'true' : 'false',
        NODE_ENV: 'production',
        ...config.globalEnv
      },
      timeout: config.defaultTimeout
    }
  }

  /**
   * Get default configuration for new installations
   */
  getDefaultConfig(): GlobalMCPConfig {
    return {
      servers: {
        promptliano: {
          type: 'stdio',
          command: process.platform === 'win32' ? 'cmd.exe' : 'sh',
          args: [],
          env: {}
        }
      },
      defaultServerUrl: 'http://localhost:3147/api/mcp',
      debugMode: false,
      globalEnv: {}
    }
  }

  /**
   * Load state from disk
   */
  private async loadState(): Promise<GlobalMCPState> {
    if (this.stateCache) {
      return this.stateCache
    }

    try {
      const content = await fs.readFile(this.configPath, 'utf-8')
      const rawState = JSON.parse(content)
      this.stateCache = GlobalMCPStateSchema.parse(rawState)
      return this.stateCache
    } catch (error) {
      // Create default state if file doesn't exist or is invalid
      const defaultState: GlobalMCPState = {
        installations: [],
        config: this.getDefaultConfig(),
        lastModified: Date.now()
      }

      this.stateCache = defaultState
      await this.saveState(defaultState)
      return defaultState
    }
  }

  /**
   * Save state to disk
   */
  private async saveState(state: GlobalMCPState): Promise<void> {
    this.stateCache = state
    await fs.writeFile(this.configPath, JSON.stringify(state, null, 2), 'utf-8')
    logger.info('Global MCP configuration saved')
  }

  /**
   * Watch configuration file for changes
   */
  private watchConfigFile(): void {
    if (this.fileWatcher) {
      try {
        if (typeof this.fileWatcher.close === 'function') {
          this.fileWatcher.close()
        }
      } catch (error) {
        logger.error('Failed to close existing watcher:', error)
      }
      this.fileWatcher = null
    }

    try {
      this.fileWatcher = fsSync.watch(this.configPath, async (eventType) => {
        if (eventType === 'change') {
          logger.info('Global MCP config file changed')

          // Clear cache to force reload
          this.stateCache = null

          try {
            const state = await this.loadState()
            this.emit('stateChanged', state)
          } catch (error) {
            logger.error('Failed to reload global config:', error)
            this.emit('configError', error)
          }
        }
      })
    } catch (error) {
      logger.error('Failed to watch config file:', error)
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    if (this.fileWatcher) {
      try {
        if (typeof this.fileWatcher.close === 'function') {
          this.fileWatcher.close()
        }
      } catch (error) {
        logger.error('Failed to close file watcher:', error)
      }
      this.fileWatcher = null
    }

    this.stateCache = null
    this.removeAllListeners()
  }
}

export const mcpGlobalConfigService = new MCPGlobalConfigService()
