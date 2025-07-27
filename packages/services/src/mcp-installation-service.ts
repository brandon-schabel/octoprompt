// Recent changes:
// - Initial implementation of MCP installation service
// - Platform detection and config path resolution
// - Backup and restore functionality for existing configs
// - Validation of installation success
// - Support for Claude Desktop and VS Code

import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { z } from 'zod'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export const PlatformSchema = z.enum(['darwin', 'win32', 'linux'])
export type Platform = z.infer<typeof PlatformSchema>

export const MCPToolSchema = z.enum(['claude-desktop', 'vscode', 'cursor', 'continue', 'claude-code', 'windsurf'])
export type MCPTool = z.infer<typeof MCPToolSchema>

// Support both old 'servers' format and new 'mcpServers' format
const MCPServerSchema = z.object({
  command: z.string(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional()
})

export const MCPConfigSchema = z.object({
  mcpServers: z.record(MCPServerSchema).optional(),
  servers: z.record(MCPServerSchema).optional()
}).refine(
  (data) => data.mcpServers || data.servers,
  "Config must have either 'mcpServers' or 'servers' field"
)

export type MCPConfig = z.infer<typeof MCPConfigSchema>

// VS Code/Cursor specific config
export const VSCodeSettingsSchema = z.object({
  'mcp.servers': z.record(z.object({
    command: z.string(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string()).optional()
  })).optional()
})

export type VSCodeSettings = z.infer<typeof VSCodeSettingsSchema>

// Continue specific config
export const ContinueConfigSchema = z.object({
  models: z.array(z.object({
    provider: z.string(),
    model: z.string(),
    mcpServers: z.array(z.string()).optional()
  })).optional(),
  mcpConfigs: z.record(z.object({
    transport: z.string(),
    command: z.string(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string()).optional()
  })).optional()
})

export type ContinueConfig = z.infer<typeof ContinueConfigSchema>

// Claude Code specific config
export const ClaudeCodeConfigSchema = z.object({
  defaultMcpServers: z.array(z.string()).optional(),
  projectBindings: z.record(z.object({
    projectId: z.string(),
    autoConnect: z.boolean().optional()
  })).optional(),
  mcpServers: z.record(z.object({
    command: z.string(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string()).optional()
  })).optional()
})

export type ClaudeCodeConfig = z.infer<typeof ClaudeCodeConfigSchema>

export interface MCPInstallationOptions {
  tool: MCPTool
  projectId: number
  projectName: string
  projectPath: string
  serverUrl?: string
  debug?: boolean
}

export interface MCPInstallationResult {
  success: boolean
  message: string
  configPath?: string
  backedUp?: boolean
  backupPath?: string
}

export interface MCPToolInfo {
  tool: MCPTool
  name: string
  installed: boolean
  configPath?: string
  configExists?: boolean
  hasOctoPrompt?: boolean
}

export class MCPInstallationService {
  private readonly platform: Platform
  private readonly defaultServerUrl = 'http://localhost:3147/api/mcp'

  constructor() {
    this.platform = process.platform as Platform
  }

  /**
   * Migrate old config format to new format
   * Converts 'servers' field to 'mcpServers'
   */
  private migrateConfigFormat(config: any): MCPConfig {
    if (config.servers && !config.mcpServers) {
      return {
        mcpServers: config.servers,
        servers: undefined
      }
    }
    return config
  }

  /**
   * Get the servers from config, handling both formats
   */
  private getServersFromConfig(config: MCPConfig): Record<string, any> {
    return config.mcpServers || config.servers || {}
  }

  /**
   * Set servers in config using the correct format
   */
  private setServersInConfig(config: MCPConfig, servers: Record<string, any>): MCPConfig {
    // Always use mcpServers for new configs
    return {
      ...config,
      mcpServers: servers,
      servers: undefined
    }
  }

  async detectInstalledTools(): Promise<MCPToolInfo[]> {
    const tools: MCPToolInfo[] = []

    // Check Claude Desktop
    const claudeInfo = await this.checkClaudeDesktop()
    tools.push(claudeInfo)

    // Check VS Code
    const vscodeInfo = await this.checkVSCode()
    tools.push(vscodeInfo)

    // Check Cursor
    const cursorInfo = await this.checkCursor()
    tools.push(cursorInfo)

    // Check Continue
    const continueInfo = await this.checkContinue()
    tools.push(continueInfo)

    // Check Claude Code
    const claudeCodeInfo = await this.checkClaudeCode()
    tools.push(claudeCodeInfo)

    // Check Windsurf
    const windsurfInfo = await this.checkWindsurf()
    tools.push(windsurfInfo)

    return tools
  }

  async installMCP(options: MCPInstallationOptions): Promise<MCPInstallationResult> {
    const { tool, projectId, projectName, projectPath, serverUrl, debug } = options

    try {
      // Get config path for the tool
      const configPath = this.getConfigPath(tool)
      if (!configPath) {
        return {
          success: false,
          message: `Configuration path not found for ${tool}`
        }
      }

      // Ensure directory exists
      const configDir = path.dirname(configPath)
      await fs.mkdir(configDir, { recursive: true })

      // Read existing config or create new one
      let config: MCPConfig = { mcpServers: {} }
      let backedUp = false
      let backupPath: string | undefined

      try {
        const existingContent = await fs.readFile(configPath, 'utf-8')
        const parsedConfig = JSON.parse(existingContent)
        config = this.migrateConfigFormat(parsedConfig)
        
        // Create backup
        backupPath = `${configPath}.backup-${Date.now()}`
        await fs.writeFile(backupPath, existingContent)
        backedUp = true
      } catch {
        // No existing config, start fresh
      }

      // Get OctoPrompt executable path
      const octopromptPath = await this.getOctopromptPath()

      // Add OctoPrompt MCP server configuration
      const serverName = `octoprompt-${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
      
      if (tool === 'claude-desktop') {
        // Claude Desktop requires stdio communication, so we use platform-specific scripts
        const scriptPath = this.platform === 'win32' 
          ? path.join(octopromptPath, 'packages/server/mcp-start.bat')
          : path.join(octopromptPath, 'packages/server/mcp-start.sh')
        
        const servers = this.getServersFromConfig(config)
        servers[serverName] = {
          command: scriptPath,
          env: {
            OCTOPROMPT_PROJECT_ID: projectId.toString(),
            MCP_DEBUG: debug ? 'true' : 'false'
          }
        }
        config = this.setServersInConfig(config, servers)
      } else if (tool === 'vscode' || tool === 'cursor' || tool === 'windsurf') {
        // VS Code/Cursor/Windsurf use settings.json format
        const vscodeConfig = await this.installVSCodeStyle(tool, projectId, projectName, projectPath, octopromptPath, debug)
        if (!vscodeConfig.success) {
          return vscodeConfig
        }
        return {
          success: true,
          message: `Successfully installed OctoPrompt MCP for ${tool}`,
          configPath: vscodeConfig.configPath,
          backedUp: vscodeConfig.backedUp,
          backupPath: vscodeConfig.backupPath
        }
      } else if (tool === 'continue') {
        // Continue uses its own config format
        const continueConfig = await this.installContinue(projectId, projectName, projectPath, octopromptPath, debug)
        return continueConfig
      } else if (tool === 'claude-code') {
        // Claude Code uses a hybrid config format
        const claudeCodeConfig = await this.installClaudeCode(projectId, projectName, projectPath, octopromptPath, debug)
        return claudeCodeConfig
      }

      // Write updated config
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')
      
      // Ensure script is executable on Unix-like systems
      if (tool === 'claude-desktop' && this.platform !== 'win32') {
        const servers = this.getServersFromConfig(config)
        const scriptPath = servers[serverName]?.command
        if (scriptPath) {
          try {
            await fs.chmod(scriptPath, 0o755)
          } catch (error) {
            console.warn('Could not set script permissions:', error)
          }
        }
      }

      // Validate installation
      const validation = await this.validateInstallation(configPath, serverName)
      
      if (!validation.valid) {
        // Restore backup if validation failed
        if (backedUp && backupPath) {
          await fs.copyFile(backupPath, configPath)
        }
        return {
          success: false,
          message: `Installation validation failed: ${validation.error}`
        }
      }

      return {
        success: true,
        message: 'Successfully installed OctoPrompt MCP',
        configPath,
        backedUp,
        backupPath
      }
    } catch (error) {
      return {
        success: false,
        message: `Installation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  async uninstallMCP(tool: MCPTool, projectName: string): Promise<MCPInstallationResult> {
    try {
      const configPath = this.getConfigPath(tool)
      if (!configPath) {
        return {
          success: false,
          message: `Configuration path not found for ${tool}`
        }
      }

      const serverName = `octoprompt-${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
      const content = await fs.readFile(configPath, 'utf-8')

      if (tool === 'claude-desktop') {
        const parsedConfig = JSON.parse(content)
        const config = this.migrateConfigFormat(parsedConfig)
        const servers = this.getServersFromConfig(config)
        
        if (serverName in servers) {
          delete servers[serverName]
          const updatedConfig = this.setServersInConfig(config, servers)
          await fs.writeFile(configPath, JSON.stringify(updatedConfig, null, 2), 'utf-8')
          
          return {
            success: true,
            message: 'Successfully removed OctoPrompt MCP configuration'
          }
        }
      } else if (tool === 'vscode' || tool === 'cursor' || tool === 'windsurf') {
        const settings = JSON.parse(content)
        
        if (settings['mcp.servers'] && settings['mcp.servers'][serverName]) {
          delete settings['mcp.servers'][serverName]
          
          // Remove empty mcp.servers if no servers left
          if (Object.keys(settings['mcp.servers']).length === 0) {
            delete settings['mcp.servers']
          }
          
          await fs.writeFile(configPath, JSON.stringify(settings, null, 2), 'utf-8')
          
          return {
            success: true,
            message: `Successfully removed OctoPrompt MCP configuration from ${tool}`
          }
        }
      } else if (tool === 'continue') {
        const config = JSON.parse(content)
        
        if (config.mcpConfigs && config.mcpConfigs[serverName]) {
          delete config.mcpConfigs[serverName]
          
          // Remove from models
          if (config.models && Array.isArray(config.models)) {
            for (const model of config.models) {
              if (model.mcpServers && Array.isArray(model.mcpServers)) {
                model.mcpServers = model.mcpServers.filter((s: string) => s !== serverName)
              }
            }
          }
          
          await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')
          
          return {
            success: true,
            message: 'Successfully removed OctoPrompt MCP configuration from Continue'
          }
        }
      } else if (tool === 'claude-code') {
        const config = JSON.parse(content) as ClaudeCodeConfig
        
        if (config.mcpServers && config.mcpServers[serverName]) {
          delete config.mcpServers[serverName]
          
          // Remove from default servers
          if (config.defaultMcpServers) {
            config.defaultMcpServers = config.defaultMcpServers.filter(s => s !== serverName)
          }
          
          // Remove project bindings for this server
          // We keep the bindings as they might be useful for reinstallation
          
          await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')
          
          return {
            success: true,
            message: 'Successfully removed OctoPrompt MCP configuration from Claude Code'
          }
        }
      }

      return {
        success: false,
        message: 'OctoPrompt MCP configuration not found'
      }
    } catch (error) {
      return {
        success: false,
        message: `Uninstall failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  private getConfigPath(tool: MCPTool): string | null {
    switch (tool) {
      case 'claude-desktop':
        switch (this.platform) {
          case 'darwin':
            return path.join(os.homedir(), 'Library/Application Support/Claude/claude_desktop_config.json')
          case 'win32':
            return path.join(process.env.APPDATA || '', 'Claude/claude_desktop_config.json')
          case 'linux':
            return path.join(os.homedir(), '.config/claude/claude_desktop_config.json')
        }
        break
      case 'vscode':
        switch (this.platform) {
          case 'darwin':
            return path.join(os.homedir(), 'Library/Application Support/Code/User/settings.json')
          case 'win32':
            return path.join(process.env.APPDATA || '', 'Code/User/settings.json')
          case 'linux':
            return path.join(os.homedir(), '.config/Code/User/settings.json')
        }
        break
      case 'cursor':
        switch (this.platform) {
          case 'darwin':
            return path.join(os.homedir(), 'Library/Application Support/Cursor/User/settings.json')
          case 'win32':
            return path.join(process.env.APPDATA || '', 'Cursor/User/settings.json')
          case 'linux':
            return path.join(os.homedir(), '.config/Cursor/User/settings.json')
        }
        break
      case 'windsurf':
        switch (this.platform) {
          case 'darwin':
            return path.join(os.homedir(), 'Library/Application Support/Windsurf/User/settings.json')
          case 'win32':
            return path.join(process.env.APPDATA || '', 'Windsurf/User/settings.json')
          case 'linux':
            return path.join(os.homedir(), '.config/Windsurf/User/settings.json')
        }
        break
      case 'continue':
        return path.join(os.homedir(), '.continue/config.json')
      case 'claude-code':
        return path.join(os.homedir(), '.claude-code/config.json')
    }
    return null
  }

  private async checkClaudeDesktop(): Promise<MCPToolInfo> {
    const configPath = this.getConfigPath('claude-desktop')
    let installed = false
    let configExists = false
    let hasOctoPrompt = false

    // Check if Claude Desktop is installed
    try {
      switch (this.platform) {
        case 'darwin':
          await fs.access('/Applications/Claude.app')
          installed = true
          break
        case 'win32':
          // Check common installation paths
          const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files'
          await fs.access(path.join(programFiles, 'Claude'))
          installed = true
          break
      }
    } catch {
      installed = false
    }

    // Check config
    if (configPath) {
      try {
        const content = await fs.readFile(configPath, 'utf-8')
        configExists = true
        // Parse JSON and check both mcpServers and servers
        const parsedConfig = JSON.parse(content)
        const config = this.migrateConfigFormat(parsedConfig)
        const servers = this.getServersFromConfig(config)
        hasOctoPrompt = servers && Object.keys(servers).some(k => k.includes('octoprompt'))
      } catch {
        configExists = false
      }
    }

    return {
      tool: 'claude-desktop',
      name: 'Claude Desktop',
      installed,
      configPath: configPath || undefined,
      configExists,
      hasOctoPrompt
    }
  }

  private async checkVSCode(): Promise<MCPToolInfo> {
    let installed = false
    const configPath = this.getConfigPath('vscode')
    let configExists = false
    let hasOctoPrompt = false

    try {
      // Check if code command is available
      await execAsync('code --version')
      installed = true
    } catch {
      installed = false
    }

    // Check config
    if (configPath) {
      try {
        const content = await fs.readFile(configPath, 'utf-8')
        configExists = true
        const parsed = JSON.parse(content)
        hasOctoPrompt = parsed['mcp.servers'] && Object.keys(parsed['mcp.servers']).some(k => k.includes('octoprompt'))
      } catch {
        configExists = false
      }
    }

    return {
      tool: 'vscode',
      name: 'Visual Studio Code',
      installed,
      configPath: configPath || undefined,
      configExists,
      hasOctoPrompt
    }
  }

  private async checkCursor(): Promise<MCPToolInfo> {
    let installed = false
    const configPath = this.getConfigPath('cursor')
    let configExists = false
    let hasOctoPrompt = false

    try {
      // Check if cursor command is available
      await execAsync('cursor --version')
      installed = true
    } catch {
      installed = false
    }

    // Check config
    if (configPath) {
      try {
        const content = await fs.readFile(configPath, 'utf-8')
        configExists = true
        const parsed = JSON.parse(content)
        hasOctoPrompt = parsed['mcp.servers'] && Object.keys(parsed['mcp.servers']).some(k => k.includes('octoprompt'))
      } catch {
        configExists = false
      }
    }

    return {
      tool: 'cursor',
      name: 'Cursor',
      installed,
      configPath: configPath || undefined,
      configExists,
      hasOctoPrompt
    }
  }

  private async checkContinue(): Promise<MCPToolInfo> {
    const configPath = this.getConfigPath('continue')
    let installed = false
    let configExists = false
    let hasOctoPrompt = false

    // Check if Continue config exists
    if (configPath) {
      try {
        const content = await fs.readFile(configPath, 'utf-8')
        installed = true
        configExists = true
        // Continue uses a different config format
        const config = JSON.parse(content)
        hasOctoPrompt = config.mcpConfigs && Object.keys(config.mcpConfigs).some(k => k.includes('octoprompt'))
      } catch {
        installed = false
        configExists = false
      }
    }

    return {
      tool: 'continue',
      name: 'Continue',
      installed,
      configPath: configPath || undefined,
      configExists,
      hasOctoPrompt
    }
  }

  private async checkClaudeCode(): Promise<MCPToolInfo> {
    let installed = false
    const configPath = this.getConfigPath('claude-code')
    let configExists = false
    let hasOctoPrompt = false

    // For Claude Code, check if config exists rather than CLI
    // since Claude Code might be web-based or use different installation methods
    if (configPath) {
      try {
        const content = await fs.readFile(configPath, 'utf-8')
        installed = true  // If config exists, assume Claude Code is being used
        configExists = true
        // Claude Code config format
        const config = JSON.parse(content)
        hasOctoPrompt = (config.mcpServers && Object.keys(config.mcpServers).some(k => k.includes('octoprompt'))) ||
                       (config.defaultMcpServers && config.defaultMcpServers.some((s: any) => s.includes('octoprompt')))
      } catch {
        // Also check if Claude Code CLI is available as fallback
        try {
          await execAsync('claude-code --version')
          installed = true
        } catch {
          installed = false
        }
        configExists = false
      }
    }

    return {
      tool: 'claude-code',
      name: 'Claude Code',
      installed,
      configPath: configPath || undefined,
      configExists,
      hasOctoPrompt
    }
  }

  private async checkWindsurf(): Promise<MCPToolInfo> {
    let installed = false
    const configPath = this.getConfigPath('windsurf')
    let configExists = false
    let hasOctoPrompt = false

    try {
      // Check if Windsurf command is available
      await execAsync('windsurf --version')
      installed = true
    } catch {
      // Check for installation by looking for app
      try {
        switch (this.platform) {
          case 'darwin':
            await fs.access('/Applications/Windsurf.app')
            installed = true
            break
          case 'win32':
            const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files'
            await fs.access(path.join(programFiles, 'Windsurf'))
            installed = true
            break
        }
      } catch {
        installed = false
      }
    }

    // Check config
    if (configPath) {
      try {
        const content = await fs.readFile(configPath, 'utf-8')
        configExists = true
        const parsed = JSON.parse(content)
        hasOctoPrompt = parsed['mcp.servers'] && Object.keys(parsed['mcp.servers']).some(k => k.includes('octoprompt'))
      } catch {
        configExists = false
      }
    }

    return {
      tool: 'windsurf',
      name: 'Windsurf',
      installed,
      configPath: configPath || undefined,
      configExists,
      hasOctoPrompt
    }
  }

  private async getOctopromptPath(): Promise<string> {
    // Get the current working directory as the OctoPrompt path
    // In production, this might be different
    return process.cwd()
  }

  private async installVSCodeStyle(
    tool: MCPTool,
    projectId: number,
    projectName: string,
    projectPath: string,
    octopromptPath: string,
    debug?: boolean
  ): Promise<MCPInstallationResult> {
    try {
      const configPath = this.getConfigPath(tool)
      if (!configPath) {
        return {
          success: false,
          message: `Configuration path not found for ${tool}`
        }
      }

      // Ensure directory exists
      const configDir = path.dirname(configPath)
      await fs.mkdir(configDir, { recursive: true })

      // Read existing settings or create new
      let settings: any = {}
      let backedUp = false
      let backupPath: string | undefined

      try {
        const existingContent = await fs.readFile(configPath, 'utf-8')
        settings = JSON.parse(existingContent)
        
        // Create backup
        backupPath = `${configPath}.backup-${Date.now()}`
        await fs.writeFile(backupPath, existingContent)
        backedUp = true
      } catch {
        // No existing config
      }

      // Initialize mcp.servers if it doesn't exist
      if (!settings['mcp.servers']) {
        settings['mcp.servers'] = {}
      }

      // Add OctoPrompt MCP configuration
      const serverName = `octoprompt-${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
      const scriptPath = this.platform === 'win32'
        ? path.join(octopromptPath, 'packages/server/mcp-start.bat')
        : path.join(octopromptPath, 'packages/server/mcp-start.sh')

      settings['mcp.servers'][serverName] = {
        command: scriptPath,
        env: {
          OCTOPROMPT_PROJECT_ID: projectId.toString(),
          OCTOPROMPT_PROJECT_PATH: projectPath,
          MCP_DEBUG: debug ? 'true' : 'false'
        }
      }

      // Write updated settings
      await fs.writeFile(configPath, JSON.stringify(settings, null, 2), 'utf-8')

      // Ensure script is executable on Unix-like systems
      if (this.platform !== 'win32') {
        try {
          await fs.chmod(scriptPath, 0o755)
        } catch (error) {
          console.warn('Could not set script permissions:', error)
        }
      }

      return {
        success: true,
        message: `Successfully installed OctoPrompt MCP for ${tool}`,
        configPath,
        backedUp,
        backupPath
      }
    } catch (error) {
      return {
        success: false,
        message: `Installation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  private async installContinue(
    projectId: number,
    projectName: string,
    projectPath: string,
    octopromptPath: string,
    debug?: boolean
  ): Promise<MCPInstallationResult> {
    try {
      const configPath = this.getConfigPath('continue')
      if (!configPath) {
        return {
          success: false,
          message: 'Configuration path not found for Continue'
        }
      }

      // Ensure directory exists
      const configDir = path.dirname(configPath)
      await fs.mkdir(configDir, { recursive: true })

      // Read existing config or create new
      let config: any = {
        models: [],
        mcpConfigs: {}
      }
      let backedUp = false
      let backupPath: string | undefined

      try {
        const existingContent = await fs.readFile(configPath, 'utf-8')
        config = JSON.parse(existingContent)
        
        // Create backup
        backupPath = `${configPath}.backup-${Date.now()}`
        await fs.writeFile(backupPath, existingContent)
        backedUp = true
      } catch {
        // No existing config
      }

      // Add OctoPrompt MCP configuration
      const serverName = `octoprompt-${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
      const scriptPath = this.platform === 'win32'
        ? path.join(octopromptPath, 'packages/server/mcp-start.bat')
        : path.join(octopromptPath, 'packages/server/mcp-start.sh')

      if (!config.mcpConfigs) {
        config.mcpConfigs = {}
      }

      config.mcpConfigs[serverName] = {
        transport: 'stdio',
        command: scriptPath,
        env: {
          OCTOPROMPT_PROJECT_ID: projectId.toString(),
          MCP_DEBUG: debug ? 'true' : 'false'
        }
      }

      // Update models to include the MCP server
      if (config.models && Array.isArray(config.models)) {
        for (const model of config.models) {
          if (!model.mcpServers) {
            model.mcpServers = []
          }
          if (!model.mcpServers.includes(serverName)) {
            model.mcpServers.push(serverName)
          }
        }
      }

      // Write updated config
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')

      // Ensure script is executable on Unix-like systems
      if (this.platform !== 'win32') {
        try {
          await fs.chmod(scriptPath, 0o755)
        } catch (error) {
          console.warn('Could not set script permissions:', error)
        }
      }

      return {
        success: true,
        message: 'Successfully installed OctoPrompt MCP for Continue',
        configPath,
        backedUp,
        backupPath
      }
    } catch (error) {
      return {
        success: false,
        message: `Installation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  private async installClaudeCode(
    projectId: number,
    projectName: string,
    projectPath: string,
    octopromptPath: string,
    debug?: boolean
  ): Promise<MCPInstallationResult> {
    try {
      const configPath = this.getConfigPath('claude-code')
      if (!configPath) {
        return {
          success: false,
          message: 'Configuration path not found for Claude Code'
        }
      }

      // Ensure directory exists
      const configDir = path.dirname(configPath)
      await fs.mkdir(configDir, { recursive: true })

      // Read existing config or create new
      let config: ClaudeCodeConfig = {
        defaultMcpServers: [],
        projectBindings: {},
        mcpServers: {}
      }
      let backedUp = false
      let backupPath: string | undefined

      try {
        const existingContent = await fs.readFile(configPath, 'utf-8')
        config = JSON.parse(existingContent)
        
        // Create backup
        backupPath = `${configPath}.backup-${Date.now()}`
        await fs.writeFile(backupPath, existingContent)
        backedUp = true
      } catch {
        // No existing config
      }

      // Initialize structures if needed
      if (!config.defaultMcpServers) config.defaultMcpServers = []
      if (!config.projectBindings) config.projectBindings = {}
      if (!config.mcpServers) config.mcpServers = {}

      // Add OctoPrompt MCP server configuration
      const serverName = `octoprompt-${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
      const scriptPath = this.platform === 'win32'
        ? path.join(octopromptPath, 'packages/server/mcp-start.bat')
        : path.join(octopromptPath, 'packages/server/mcp-start.sh')

      config.mcpServers[serverName] = {
        command: scriptPath,
        env: {
          OCTOPROMPT_PROJECT_ID: projectId.toString(),
          MCP_DEBUG: debug ? 'true' : 'false'
        }
      }

      // Add project binding
      config.projectBindings[projectPath] = {
        projectId: projectId.toString(),
        autoConnect: true
      }

      // Add to default servers if not already there
      if (!config.defaultMcpServers.includes(serverName)) {
        config.defaultMcpServers.push(serverName)
      }

      // Write updated config
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')

      // Ensure script is executable on Unix-like systems
      if (this.platform !== 'win32') {
        try {
          await fs.chmod(scriptPath, 0o755)
        } catch (error) {
          console.warn('Could not set script permissions:', error)
        }
      }

      return {
        success: true,
        message: 'Successfully installed OctoPrompt MCP for Claude Code',
        configPath,
        backedUp,
        backupPath
      }
    } catch (error) {
      return {
        success: false,
        message: `Installation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  private async validateInstallation(
    configPath: string,
    serverName: string
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      const content = await fs.readFile(configPath, 'utf-8')
      const parsedConfig = JSON.parse(content)
      const config = this.migrateConfigFormat(parsedConfig)
      const servers = this.getServersFromConfig(config)

      // Check if server config exists
      if (!(serverName in servers)) {
        return { valid: false, error: 'Server configuration not found' }
      }

      const serverConfig = servers[serverName]

      // Validate required fields
      if (!serverConfig.command) {
        return { valid: false, error: 'Missing command field' }
      }

      // Check if the script path exists
      const scriptPath = serverConfig.command
      try {
        await fs.access(scriptPath)
      } catch {
        return { valid: false, error: 'MCP script not found at specified path' }
      }

      return { valid: true }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown validation error'
      }
    }
  }

  async installProjectConfig(
    projectId: number,
    projectPath: string,
    serverUrl?: string
  ): Promise<MCPInstallationResult> {
    try {
      // Use the main .mcp.json location in project root
      const configPath = path.join(projectPath, '.mcp.json')
      
      // Check if config already exists
      let existingConfig: any = {}
      let backedUp = false
      let backupPath: string | undefined
      
      try {
        const existingContent = await fs.readFile(configPath, 'utf-8')
        existingConfig = JSON.parse(existingContent)
        
        // Create backup
        backupPath = `${configPath}.backup-${Date.now()}`
        await fs.writeFile(backupPath, existingContent)
        backedUp = true
      } catch {
        // No existing config, start fresh
      }

      // Get the OctoPrompt installation path
      const octopromptPath = await this.getOctopromptPath()
      const scriptPath = this.platform === 'win32'
        ? path.join(octopromptPath, 'packages/server/mcp-start.bat')
        : path.join(octopromptPath, 'packages/server/mcp-start.sh')

      // Get existing servers if any
      const existingServers = existingConfig.mcpServers || existingConfig.servers || {}
      
      // Create the project MCP configuration using mcpServers format
      const projectConfig = {
        mcpServers: {
          ...existingServers,
          octoprompt: {
            type: 'stdio',
            command: this.platform === 'win32' ? 'cmd.exe' : 'sh',
            args: this.platform === 'win32' 
              ? ['/c', scriptPath]
              : [scriptPath],
            env: {
              OCTOPROMPT_PROJECT_ID: projectId.toString(),
              OCTOPROMPT_PROJECT_PATH: projectPath,
              OCTOPROMPT_API_URL: serverUrl || this.defaultServerUrl,
              NODE_ENV: 'production'
            }
          }
        }
      }

      // Write the configuration
      await fs.writeFile(configPath, JSON.stringify(projectConfig, null, 2), 'utf-8')

      // Ensure script is executable on Unix-like systems
      if (this.platform !== 'win32') {
        try {
          await fs.chmod(scriptPath, 0o755)
        } catch (error) {
          console.warn('Could not set script permissions:', error)
        }
      }

      return {
        success: true,
        message: 'Successfully created project MCP configuration',
        configPath,
        backedUp,
        backupPath
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to create project configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  // Global installation methods

  /**
   * Install OctoPrompt MCP globally for a tool (no project context)
   */
  async installGlobalMCP(tool: MCPTool, serverUrl?: string, debug?: boolean): Promise<MCPInstallationResult> {
    try {
      // Import global config service
      const { mcpGlobalConfigService } = await import('./mcp-global-config-service')
      await mcpGlobalConfigService.initialize()

      // Get config path for the tool
      const configPath = this.getConfigPath(tool)
      if (!configPath) {
        return {
          success: false,
          message: `Configuration path not found for ${tool}`
        }
      }

      // Ensure directory exists
      const configDir = path.dirname(configPath)
      await fs.mkdir(configDir, { recursive: true })

      // Get global server configuration
      const globalServerConfig = await mcpGlobalConfigService.getGlobalServerConfig()

      // Handle different tool types
      if (tool === 'claude-desktop') {
        return await this.installGlobalClaudeDesktop(configPath, globalServerConfig, debug)
      } else if (tool === 'vscode' || tool === 'cursor' || tool === 'windsurf') {
        return await this.installGlobalVSCodeStyle(tool, configPath, globalServerConfig, debug)
      } else if (tool === 'continue') {
        return await this.installGlobalContinue(configPath, globalServerConfig, debug)
      } else if (tool === 'claude-code') {
        return await this.installGlobalClaudeCode(configPath, globalServerConfig, debug)
      }

      return {
        success: false,
        message: `Unsupported tool: ${tool}`
      }
    } catch (error) {
      return {
        success: false,
        message: `Global installation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Uninstall global OctoPrompt MCP for a tool
   */
  async uninstallGlobalMCP(tool: MCPTool): Promise<MCPInstallationResult> {
    try {
      const configPath = this.getConfigPath(tool)
      if (!configPath) {
        return {
          success: false,
          message: `Configuration path not found for ${tool}`
        }
      }

      const serverName = 'octoprompt'
      const content = await fs.readFile(configPath, 'utf-8')

      if (tool === 'claude-desktop') {
        const parsedConfig = JSON.parse(content)
        const config = this.migrateConfigFormat(parsedConfig)
        const servers = this.getServersFromConfig(config)
        
        if (serverName in servers) {
          delete servers[serverName]
          const updatedConfig = this.setServersInConfig(config, servers)
          await fs.writeFile(configPath, JSON.stringify(updatedConfig, null, 2), 'utf-8')
          
          // Update global config service
          const { mcpGlobalConfigService } = await import('./mcp-global-config-service')
          await mcpGlobalConfigService.removeGlobalInstallation(tool)
          
          return {
            success: true,
            message: 'Successfully removed global OctoPrompt MCP configuration'
          }
        }
      } else if (tool === 'vscode' || tool === 'cursor' || tool === 'windsurf') {
        const settings = JSON.parse(content)
        
        if (settings['mcp.servers'] && settings['mcp.servers'][serverName]) {
          delete settings['mcp.servers'][serverName]
          
          if (Object.keys(settings['mcp.servers']).length === 0) {
            delete settings['mcp.servers']
          }
          
          await fs.writeFile(configPath, JSON.stringify(settings, null, 2), 'utf-8')
          
          // Update global config service
          const { mcpGlobalConfigService } = await import('./mcp-global-config-service')
          await mcpGlobalConfigService.removeGlobalInstallation(tool)
          
          return {
            success: true,
            message: `Successfully removed global OctoPrompt MCP configuration from ${tool}`
          }
        }
      } else if (tool === 'continue') {
        const config = JSON.parse(content)
        
        if (config.mcpConfigs && config.mcpConfigs[serverName]) {
          delete config.mcpConfigs[serverName]
          
          // Remove from models
          if (config.models && Array.isArray(config.models)) {
            for (const model of config.models) {
              if (model.mcpServers && Array.isArray(model.mcpServers)) {
                model.mcpServers = model.mcpServers.filter((s: string) => s !== serverName)
              }
            }
          }
          
          await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')
          
          // Update global config service
          const { mcpGlobalConfigService } = await import('./mcp-global-config-service')
          await mcpGlobalConfigService.removeGlobalInstallation(tool)
          
          return {
            success: true,
            message: 'Successfully removed global OctoPrompt MCP configuration from Continue'
          }
        }
      } else if (tool === 'claude-code') {
        const config = JSON.parse(content) as ClaudeCodeConfig
        
        if (config.mcpServers && config.mcpServers[serverName]) {
          delete config.mcpServers[serverName]
          
          // Remove from default servers
          if (config.defaultMcpServers) {
            config.defaultMcpServers = config.defaultMcpServers.filter(s => s !== serverName)
          }
          
          await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')
          
          // Update global config service
          const { mcpGlobalConfigService } = await import('./mcp-global-config-service')
          await mcpGlobalConfigService.removeGlobalInstallation(tool)
          
          return {
            success: true,
            message: 'Successfully removed global OctoPrompt MCP configuration from Claude Code'
          }
        }
      }

      return {
        success: false,
        message: 'Global OctoPrompt MCP configuration not found'
      }
    } catch (error) {
      return {
        success: false,
        message: `Global uninstall failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Detect which tools have global OctoPrompt installations
   */
  async detectGlobalInstallations(): Promise<MCPToolInfo[]> {
    const tools = await this.detectInstalledTools()
    
    // Import global config service
    const { mcpGlobalConfigService } = await import('./mcp-global-config-service')
    await mcpGlobalConfigService.initialize()
    
    // The detectInstalledTools already checks for OctoPrompt correctly
    // Just return the tools as-is since they already have the correct hasOctoPrompt status
    return tools
  }

  // Private helper methods for global installations

  private async installGlobalClaudeDesktop(
    configPath: string,
    globalServerConfig: any,
    debug?: boolean
  ): Promise<MCPInstallationResult> {
    try {
      // Read existing config or create new one
      let config: MCPConfig = { mcpServers: {} }
      let backedUp = false
      let backupPath: string | undefined

      try {
        const existingContent = await fs.readFile(configPath, 'utf-8')
        const parsedConfig = JSON.parse(existingContent)
        config = this.migrateConfigFormat(parsedConfig)
        
        // Create backup
        backupPath = `${configPath}.backup-${Date.now()}`
        await fs.writeFile(backupPath, existingContent)
        backedUp = true
      } catch {
        // No existing config
      }

      // Add global OctoPrompt configuration
      const servers = this.getServersFromConfig(config)
      servers['octoprompt'] = {
        command: globalServerConfig.command,
        args: globalServerConfig.args,
        env: {
          ...globalServerConfig.env,
          MCP_DEBUG: debug ? 'true' : 'false'
        }
      }
      config = this.setServersInConfig(config, servers)

      // Write updated config
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')

      // Ensure script is executable on Unix-like systems
      if (this.platform !== 'win32' && globalServerConfig.args?.[0]) {
        try {
          await fs.chmod(globalServerConfig.args[0], 0o755)
        } catch (error) {
          console.warn('Could not set script permissions:', error)
        }
      }

      // Update global config service
      const { mcpGlobalConfigService } = await import('./mcp-global-config-service')
      await mcpGlobalConfigService.addGlobalInstallation({
        tool: 'claude-desktop',
        configPath,
        serverName: 'octoprompt',
        version: '0.8.0'
      })

      return {
        success: true,
        message: 'Successfully installed global OctoPrompt MCP for Claude Desktop',
        configPath,
        backedUp,
        backupPath
      }
    } catch (error) {
      return {
        success: false,
        message: `Installation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  private async installGlobalVSCodeStyle(
    tool: MCPTool,
    configPath: string,
    globalServerConfig: any,
    debug?: boolean
  ): Promise<MCPInstallationResult> {
    try {
      // Read existing settings or create new
      let settings: any = {}
      let backedUp = false
      let backupPath: string | undefined

      try {
        const existingContent = await fs.readFile(configPath, 'utf-8')
        settings = JSON.parse(existingContent)
        
        // Create backup
        backupPath = `${configPath}.backup-${Date.now()}`
        await fs.writeFile(backupPath, existingContent)
        backedUp = true
      } catch {
        // No existing config
      }

      // Initialize mcp.servers if it doesn't exist
      if (!settings['mcp.servers']) {
        settings['mcp.servers'] = {}
      }

      // Add global OctoPrompt configuration
      settings['mcp.servers']['octoprompt'] = {
        command: globalServerConfig.args?.[0] || globalServerConfig.command,
        env: {
          ...globalServerConfig.env,
          MCP_DEBUG: debug ? 'true' : 'false'
        }
      }

      // Write updated settings
      await fs.writeFile(configPath, JSON.stringify(settings, null, 2), 'utf-8')

      // Ensure script is executable on Unix-like systems
      if (this.platform !== 'win32' && globalServerConfig.args?.[0]) {
        try {
          await fs.chmod(globalServerConfig.args[0], 0o755)
        } catch (error) {
          console.warn('Could not set script permissions:', error)
        }
      }

      // Update global config service
      const { mcpGlobalConfigService } = await import('./mcp-global-config-service')
      await mcpGlobalConfigService.addGlobalInstallation({
        tool,
        configPath,
        serverName: 'octoprompt',
        version: '0.8.0'
      })

      return {
        success: true,
        message: `Successfully installed global OctoPrompt MCP for ${tool}`,
        configPath,
        backedUp,
        backupPath
      }
    } catch (error) {
      return {
        success: false,
        message: `Installation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  private async installGlobalContinue(
    configPath: string,
    globalServerConfig: any,
    debug?: boolean
  ): Promise<MCPInstallationResult> {
    try {
      // Read existing config or create new
      let config: any = {
        models: [],
        mcpConfigs: {}
      }
      let backedUp = false
      let backupPath: string | undefined

      try {
        const existingContent = await fs.readFile(configPath, 'utf-8')
        config = JSON.parse(existingContent)
        
        // Create backup
        backupPath = `${configPath}.backup-${Date.now()}`
        await fs.writeFile(backupPath, existingContent)
        backedUp = true
      } catch {
        // No existing config
      }

      // Add global OctoPrompt configuration
      if (!config.mcpConfigs) {
        config.mcpConfigs = {}
      }

      config.mcpConfigs['octoprompt-global'] = {
        transport: 'stdio',
        command: globalServerConfig.args?.[0] || globalServerConfig.command,
        env: {
          ...globalServerConfig.env,
          MCP_DEBUG: debug ? 'true' : 'false'
        }
      }

      // Update models to include the MCP server
      if (config.models && Array.isArray(config.models)) {
        for (const model of config.models) {
          if (!model.mcpServers) {
            model.mcpServers = []
          }
          if (!model.mcpServers.includes('octoprompt-global')) {
            model.mcpServers.push('octoprompt-global')
          }
        }
      }

      // Write updated config
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')

      // Ensure script is executable on Unix-like systems
      if (this.platform !== 'win32' && globalServerConfig.args?.[0]) {
        try {
          await fs.chmod(globalServerConfig.args[0], 0o755)
        } catch (error) {
          console.warn('Could not set script permissions:', error)
        }
      }

      // Update global config service
      const { mcpGlobalConfigService } = await import('./mcp-global-config-service')
      await mcpGlobalConfigService.addGlobalInstallation({
        tool: 'continue',
        configPath,
        serverName: 'octoprompt',
        version: '0.8.0'
      })

      return {
        success: true,
        message: 'Successfully installed global OctoPrompt MCP for Continue',
        configPath,
        backedUp,
        backupPath
      }
    } catch (error) {
      return {
        success: false,
        message: `Installation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  private async installGlobalClaudeCode(
    configPath: string,
    globalServerConfig: any,
    debug?: boolean
  ): Promise<MCPInstallationResult> {
    try {
      // Read existing config or create new
      let config: ClaudeCodeConfig = {
        defaultMcpServers: [],
        projectBindings: {},
        mcpServers: {}
      }
      let backedUp = false
      let backupPath: string | undefined

      try {
        const existingContent = await fs.readFile(configPath, 'utf-8')
        config = JSON.parse(existingContent)
        
        // Create backup
        backupPath = `${configPath}.backup-${Date.now()}`
        await fs.writeFile(backupPath, existingContent)
        backedUp = true
      } catch {
        // No existing config
      }

      // Initialize structures if needed
      if (!config.defaultMcpServers) config.defaultMcpServers = []
      if (!config.mcpServers) config.mcpServers = {}

      // Add global OctoPrompt server configuration
      config.mcpServers['octoprompt'] = {
        command: globalServerConfig.args?.[0] || globalServerConfig.command,
        env: {
          ...globalServerConfig.env,
          MCP_DEBUG: debug ? 'true' : 'false'
        }
      }

      // Add to default servers if not already there
      if (!config.defaultMcpServers.includes('octoprompt-global')) {
        config.defaultMcpServers.push('octoprompt-global')
      }

      // Write updated config
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')

      // Ensure script is executable on Unix-like systems
      if (this.platform !== 'win32' && globalServerConfig.args?.[0]) {
        try {
          await fs.chmod(globalServerConfig.args[0], 0o755)
        } catch (error) {
          console.warn('Could not set script permissions:', error)
        }
      }

      // Update global config service
      const { mcpGlobalConfigService } = await import('./mcp-global-config-service')
      await mcpGlobalConfigService.addGlobalInstallation({
        tool: 'claude-code',
        configPath,
        serverName: 'octoprompt',
        version: '0.8.0'
      })

      return {
        success: true,
        message: 'Successfully installed global OctoPrompt MCP for Claude Code',
        configPath,
        backedUp,
        backupPath
      }
    } catch (error) {
      return {
        success: false,
        message: `Installation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }
}

export const mcpInstallationService = new MCPInstallationService()