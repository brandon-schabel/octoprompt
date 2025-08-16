// Project-level MCP configuration service
// Handles loading and managing .mcp.json files at the project level
// Supports configuration hierarchy: project > user > global

import * as fs from 'fs/promises'
import * as fsSync from 'fs'
import * as path from 'path'
import * as os from 'os'
import { z } from 'zod'
import { createLogger } from './utils/logger'
import { EventEmitter } from 'events'
import { getProjectById } from './project-service'
import { toPosixPath, toOSPath, joinPosix } from '@promptliano/shared'

const logger = createLogger('MCPProjectConfigService')

// Configuration schemas
export const MCPServerConfigSchema = z.object({
  type: z.enum(['stdio', 'http']).default('stdio'),
  command: z.string(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  timeout: z.number().optional()
})

export const MCPInputConfigSchema = z.object({
  type: z.enum(['promptString', 'promptNumber', 'promptBoolean']),
  id: z.string(),
  description: z.string(),
  default: z.any().optional(),
  password: z.boolean().optional()
})

// Support both old 'servers' format and new 'mcpServers' format
export const ProjectMCPConfigSchema = z
  .object({
    mcpServers: z.record(MCPServerConfigSchema).optional(),
    inputs: z.array(MCPInputConfigSchema).optional(),
    extends: z.union([z.string(), z.array(z.string())]).optional()
  })
  .refine((data) => data.mcpServers, "Config must have either 'mcpServers' or 'servers' field")

export type MCPServerConfig = z.infer<typeof MCPServerConfigSchema>
export type MCPInputConfig = z.infer<typeof MCPInputConfigSchema>
export type ProjectMCPConfig = z.infer<typeof ProjectMCPConfigSchema>

// Configuration file paths by priority (highest to lowest)
const CONFIG_FILE_NAMES = [
  '.vscode/mcp.json', // VS Code workspace-specific
  '.cursor/mcp.json', // Cursor IDE project-specific
  '.mcp.json' // Universal project root (primary)
  // '.promptliano/mcp.json'   // Promptliano-specific
]

export interface MCPConfigLocation {
  path: string
  exists: boolean
  priority: number
}

export interface ResolvedMCPConfig {
  config: ProjectMCPConfig
  source: string
  projectPath: string
}

export class MCPProjectConfigService extends EventEmitter {
  private configCache = new Map<number, ResolvedMCPConfig>()
  private fileWatchers = new Map<string, fsSync.FSWatcher>()

  constructor() {
    super()
  }

  /**
   * Get the servers from config, handling both formats
   */
  private getServersFromConfig(config: ProjectMCPConfig): Record<string, MCPServerConfig> {
    return config.mcpServers || {}
  }

  /**
   * Get all possible config file locations for a project
   */
  async getConfigLocations(projectId: number): Promise<MCPConfigLocation[]> {
    try {
      const project = await getProjectById(projectId)
      
      if (!project) {
        throw new Error(`Project with ID ${projectId} not found`)
      }
      
      const projectPath = project.path

      if (!projectPath) {
        throw new Error(`Project ${projectId} has no path defined`)
      }

      const locations: MCPConfigLocation[] = []

      for (let i = 0; i < CONFIG_FILE_NAMES.length; i++) {
        const configFileName = CONFIG_FILE_NAMES[i]
        if (!configFileName) continue

        const configPath = path.join(projectPath, configFileName)
        const exists = await this.fileExists(configPath)

        locations.push({
          path: configPath,
          exists,
          priority: CONFIG_FILE_NAMES.length - i // Higher number = higher priority
        })
      }

      return locations
    } catch (error: any) {
      logger.error('Error getting config locations:', { projectId, error: error.message })
      throw error
    }
  }

  /**
   * Load project-level MCP configuration
   */
  async loadProjectConfig(projectId: number): Promise<ResolvedMCPConfig | null> {
    try {
      // Check cache first
      if (this.configCache.has(projectId)) {
        return this.configCache.get(projectId)!
      }

      const project = await getProjectById(projectId)
      
      if (!project) {
        throw new Error(`Project with ID ${projectId} not found`)
      }
      
      const projectPath = project.path
      
      if (!projectPath) {
        throw new Error(`Project ${projectId} has no path defined`)
      }
      
      const locations = await this.getConfigLocations(projectId)

      // Find the first existing config file (highest priority)
      const existingConfig = locations.sort((a, b) => b.priority - a.priority).find((loc) => loc.exists)

      if (!existingConfig) {
        logger.debug(`No MCP config found for project ${projectId}`)
        return null
      }

      try {
        const content = await fs.readFile(existingConfig.path, 'utf-8')
        const rawConfig = JSON.parse(content)
        const config = ProjectMCPConfigSchema.parse(rawConfig)

        const resolved: ResolvedMCPConfig = {
          config,
          source: existingConfig.path,
          projectPath
        }

        // Cache the result
        this.configCache.set(projectId, resolved)

        // Set up file watcher
        this.watchConfigFile(projectId, existingConfig.path)

        logger.info(`Loaded MCP config for project ${projectId} from ${existingConfig.path}`)
        return resolved
      } catch (fileError) {
        logger.error(`Failed to load MCP config from ${existingConfig.path}:`, fileError)
        throw new Error(`Invalid MCP configuration: ${fileError instanceof Error ? fileError.message : String(fileError)}`)
      }
    } catch (error: any) {
      logger.error('Error loading project config:', { projectId, error: error.message })
      throw error
    }
  }

  /**
   * Get user-level MCP configuration
   */
  async getUserConfig(): Promise<ProjectMCPConfig | null> {
    const userConfigPath = path.join(os.homedir(), '.promptliano', 'mcp-config.json')

    try {
      if (await this.fileExists(userConfigPath)) {
        const content = await fs.readFile(userConfigPath, 'utf-8')
        const rawConfig = JSON.parse(content)
        return ProjectMCPConfigSchema.parse(rawConfig)
      }
    } catch (error) {
      logger.error('Failed to load user MCP config:', error)
    }

    return null
  }

  /**
   * Get global/default MCP configuration
   */
  async getGlobalConfig(): Promise<ProjectMCPConfig | null> {
    // For now, return a minimal default config
    // This could be extended to load from a system-wide location
    return {
      mcpServers: {}
    }
  }

  /**
   * Merge configurations with proper precedence
   * Project > User > Global
   */
  async getMergedConfig(projectId: number): Promise<ProjectMCPConfig> {
    const [projectConfig, userConfig, globalConfig] = await Promise.all([
      this.loadProjectConfig(projectId),
      this.getUserConfig(),
      this.getGlobalConfig()
    ])

    // Start with global config
    let merged: ProjectMCPConfig = globalConfig || { mcpServers: {} }

    // Merge user config
    if (userConfig) {
      merged = this.mergeConfigs(merged, userConfig)
    }

    // Merge project config (highest priority)
    if (projectConfig) {
      merged = this.mergeConfigs(merged, projectConfig.config)
    }

    return merged
  }

  /**
   * Get expanded configuration (with variables resolved)
   */
  async getExpandedConfig(projectId: number): Promise<ProjectMCPConfig> {
    const mergedConfig = await this.getMergedConfig(projectId)
    return this.expandVariables(mergedConfig, projectId)
  }

  /**
   * Expand environment variables in configuration
   */
  async expandVariables(config: ProjectMCPConfig, projectId: number): Promise<ProjectMCPConfig> {
    const project = await getProjectById(projectId)
    
    if (!project) {
      throw new Error(`Project with ID ${projectId} not found`)
    }
    
    if (!project.path) {
      throw new Error(`Project ${projectId} has no path defined`)
    }

    const variables: Record<string, string> = {
      workspaceFolder: toPosixPath(project.path),
      projectId: String(projectId),
      projectName: project.name,
      userHome: toPosixPath(os.homedir()),
      ...process.env
    }

    const expandedConfig = JSON.parse(JSON.stringify(config)) as ProjectMCPConfig

    // Expand variables in server configurations
    const servers = this.getServersFromConfig(expandedConfig)
    for (const [serverName, serverConfig] of Object.entries(servers)) {
      // Expand in command
      serverConfig.command = this.expandString(serverConfig.command, variables)

      // Expand in args
      if (serverConfig.args) {
        serverConfig.args = serverConfig.args.map((arg) => this.expandString(arg, variables))
      }

      // Expand in env
      if (serverConfig.env) {
        const expandedEnv: Record<string, string> = {}
        for (const [key, value] of Object.entries(serverConfig.env)) {
          expandedEnv[key] = this.expandString(value, variables)
        }
        serverConfig.env = expandedEnv
      }
    }

    // Update the config with expanded servers
    if (expandedConfig.mcpServers) {
      expandedConfig.mcpServers = servers
    }

    return expandedConfig
  }

  /**
   * Save project configuration
   */
  async saveProjectConfig(projectId: number, config: ProjectMCPConfig): Promise<void> {
    const project = await getProjectById(projectId)
    const configPath = path.join(project.path, '.mcp.json')

    // Ensure directory exists
    const configDir = path.dirname(configPath)
    await fs.mkdir(configDir, { recursive: true })

    // Write config
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')

    // Clear cache
    this.configCache.delete(projectId)

    // Emit change event
    this.emit('configChanged', projectId, config)

    logger.info(`Saved MCP config for project ${projectId}`)
  }

  /**
   * Save project configuration to a specific location
   */
  async saveProjectConfigToLocation(projectId: number, config: ProjectMCPConfig, locationPath: string): Promise<void> {
    const project = await getProjectById(projectId)

    // Validate that the location is one of the allowed paths
    const allowedPaths = CONFIG_FILE_NAMES.map((name) => path.join(project.path, name))
    const fullPath = path.isAbsolute(locationPath) ? locationPath : path.join(project.path, locationPath)

    if (!allowedPaths.includes(fullPath)) {
      throw new Error(`Invalid config location: ${locationPath}. Must be one of: ${CONFIG_FILE_NAMES.join(', ')}`)
    }

    // Ensure directory exists
    const configDir = path.dirname(fullPath)
    await fs.mkdir(configDir, { recursive: true })

    // Write config
    await fs.writeFile(fullPath, JSON.stringify(config, null, 2), 'utf-8')

    // Clear cache
    this.configCache.delete(projectId)

    // Emit change event
    this.emit('configChanged', projectId, config)

    logger.info(`Saved MCP config for project ${projectId} to ${fullPath}`)
  }

  /**
   * Get editor type from config location path
   */
  getEditorType(locationPath: string): string {
    // Normalize path to use forward slashes for consistent comparison
    const normalizedPath = toPosixPath(locationPath)

    if (normalizedPath.includes('.vscode/mcp.json')) {
      return 'vscode'
    } else if (normalizedPath.includes('.cursor/mcp.json')) {
      return 'cursor'
    }
    // else if (normalizedPath.includes('.promptliano/mcp.json')) {
    //   return 'promptliano'
    // }
    else if (normalizedPath.includes('.mcp.json')) {
      return 'universal'
    }
    return 'unknown'
  }

  /**
   * Get default config for a specific editor location
   */
  async getDefaultConfigForLocation(projectId: number, locationPath: string): Promise<ProjectMCPConfig> {
    const project = await getProjectById(projectId)
    const editorType = this.getEditorType(locationPath)

    // Get the Promptliano installation path - need to find the monorepo root
    let promptlianoPath = process.cwd()

    // Try to find the root by looking for package.json with workspaces
    let currentPath = promptlianoPath
    let foundRoot = false

    // Go up directories until we find the root package.json with workspaces
    for (let i = 0; i < 5; i++) {
      try {
        const packageJsonPath = path.join(currentPath, 'package.json')
        await fs.access(packageJsonPath)
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'))

        // Check if this is the root package.json (has workspaces)
        if (packageJson.workspaces) {
          promptlianoPath = currentPath
          foundRoot = true
          logger.debug('Found Promptliano root via package.json:', promptlianoPath)
          break
        }
      } catch {
        // Continue searching
      }

      const parentPath = path.dirname(currentPath)
      if (parentPath === currentPath) break // Reached filesystem root
      currentPath = parentPath
    }

    // Define normalizedCwd in the correct scope
    const normalizedCwd = toPosixPath(promptlianoPath)

    if (!foundRoot) {
      // Fallback: if we're in packages/server, go up two levels
      if (normalizedCwd.includes('packages/server')) {
        promptlianoPath = path.resolve(promptlianoPath, '../..')
        logger.debug('Using fallback method - adjusted from packages/server')
      }
    }

    const scriptPath =
      process.platform === 'win32'
        ? path.join(promptlianoPath, 'packages/server/mcp-start.bat')
        : path.join(promptlianoPath, 'packages/server/mcp-start.sh')

    logger.info('MCP Config Generation:', {
      initialCwd: process.cwd(),
      detectedRoot: promptlianoPath,
      foundRoot,
      scriptPath,
      scriptPathNormalized: toPosixPath(scriptPath)
    })

    // Validate that the script actually exists
    try {
      await fs.access(scriptPath)
      logger.debug('Script path validated successfully')
    } catch (error) {
      logger.warn(`MCP start script not found at: ${scriptPath}`, {
        promptlianoPath,
        normalizedCwd,
        scriptPath
      })
      // Don't throw here - let's see what's actually happening
    }

    // Base config that works for all editors (using new format)
    const baseConfig: ProjectMCPConfig = {
      mcpServers: {
        promptliano: {
          type: 'stdio',
          command: process.platform === 'win32' ? 'cmd.exe' : 'sh',
          args: process.platform === 'win32' ? ['/c', toOSPath(scriptPath)] : [toOSPath(scriptPath)],
          env: {
            PROMPTLIANO_PROJECT_ID: projectId.toString(),
            PROMPTLIANO_PROJECT_PATH: toPosixPath(project.path),
            PROMPTLIANO_API_URL: 'http://localhost:3147/api/mcp',
            NODE_ENV: 'production'
          }
        }
      }
    }

    // Editor-specific adjustments if needed
    if (editorType === 'vscode' || editorType === 'cursor') {
      // VS Code and Cursor use the same format
      return baseConfig
    } else if (editorType === 'claude-code') {
      // Claude Code doesn't use JSON config files, but we return the base config
      // for reference purposes (though it won't be saved to a file)
      return baseConfig
    }

    return baseConfig
  }

  /**
   * Watch configuration file for changes
   */
  private watchConfigFile(projectId: number, configPath: string): void {
    // Remove existing watcher if any
    this.unwatchConfigFile(configPath)

    try {
      const watcher = fsSync.watch(configPath, async (eventType) => {
        if (eventType === 'change') {
          logger.info(`MCP config changed for project ${projectId}`)

          // Clear cache
          this.configCache.delete(projectId)

          // Reload and emit event
          try {
            const newConfig = await this.loadProjectConfig(projectId)
            if (newConfig) {
              this.emit('configChanged', projectId, newConfig.config)
            }
          } catch (error) {
            logger.error('Failed to reload MCP config:', error)
            this.emit('configError', projectId, error)
          }
        }
      })

      this.fileWatchers.set(configPath, watcher)
    } catch (error) {
      logger.error(`Failed to watch config file ${configPath}:`, error)
    }
  }

  /**
   * Stop watching a configuration file
   */
  private unwatchConfigFile(configPath: string): void {
    const watcher = this.fileWatchers.get(configPath)
    if (watcher) {
      watcher.close()
      this.fileWatchers.delete(configPath)
    }
  }

  /**
   * Clear all watchers and cache
   */
  async cleanup(): Promise<void> {
    // Close all file watchers
    for (const watcher of this.fileWatchers.values()) {
      watcher.close()
    }
    this.fileWatchers.clear()

    // Clear cache
    this.configCache.clear()
  }

  /**
   * Helper to check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Helper to merge two configurations
   */
  private mergeConfigs(base: ProjectMCPConfig, override: ProjectMCPConfig): ProjectMCPConfig {
    const baseServers = this.getServersFromConfig(base)
    const overrideServers = this.getServersFromConfig(override)

    return {
      mcpServers: {
        ...baseServers,
        ...overrideServers
      },
      inputs: override.inputs || base.inputs,
      extends: override.extends || base.extends
    }
  }

  /**
   * Helper to expand variables in a string
   */
  private expandString(str: string, variables: Record<string, string>): string {
    return str.replace(/\$\{([^}]+)\}/g, (match, varName) => {
      // Handle default values: ${VAR:-default}
      const [name, defaultValue] = varName.split(':-')
      const value = variables[name]

      if (value !== undefined) {
        return value
      } else if (defaultValue !== undefined) {
        return defaultValue
      } else {
        return match // Keep original if not found
      }
    })
  }
}

export const mcpProjectConfigService = new MCPProjectConfigService()
