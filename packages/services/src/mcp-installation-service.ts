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

export const MCPToolSchema = z.enum(['claude-desktop', 'vscode', 'cursor', 'continue'])
export type MCPTool = z.infer<typeof MCPToolSchema>

export const MCPConfigSchema = z.object({
  mcpServers: z.record(z.object({
    command: z.string(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string()).optional()
  }))
})

export type MCPConfig = z.infer<typeof MCPConfigSchema>

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
        config = JSON.parse(existingContent) as MCPConfig
        
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
        
        config.mcpServers[serverName] = {
          command: scriptPath,
          env: {
            OCTOPROMPT_PROJECT_ID: projectId.toString(),
            MCP_DEBUG: debug ? 'true' : 'false'
          }
        }
      } else if (tool === 'vscode' || tool === 'cursor') {
        // VS Code/Cursor use a different config format
        // This would be handled through workspace settings
        return {
          success: false,
          message: 'VS Code/Cursor MCP installation not yet implemented'
        }
      }

      // Write updated config
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')
      
      // Ensure script is executable on Unix-like systems
      if (tool === 'claude-desktop' && this.platform !== 'win32') {
        const scriptPath = config.mcpServers[serverName].command
        try {
          await fs.chmod(scriptPath, 0o755)
        } catch (error) {
          console.warn('Could not set script permissions:', error)
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

      const content = await fs.readFile(configPath, 'utf-8')
      const config = JSON.parse(content) as MCPConfig

      // Find and remove OctoPrompt server entries
      const serverName = `octoprompt-${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
      
      if (serverName in config.mcpServers) {
        delete config.mcpServers[serverName]
        
        // Write updated config
        await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')
        
        return {
          success: true,
          message: 'Successfully removed OctoPrompt MCP configuration'
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
        // VS Code settings.json location varies
        return null // Will be handled differently
      case 'cursor':
        // Cursor settings location
        return null // Will be handled differently
      case 'continue':
        return path.join(os.homedir(), '.continue/config.json')
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
        hasOctoPrompt = content.includes('octoprompt')
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

    try {
      // Check if code command is available
      await execAsync('code --version')
      installed = true
    } catch {
      installed = false
    }

    return {
      tool: 'vscode',
      name: 'Visual Studio Code',
      installed,
      // VS Code config is handled differently
    }
  }

  private async checkCursor(): Promise<MCPToolInfo> {
    let installed = false

    try {
      // Check if cursor command is available
      await execAsync('cursor --version')
      installed = true
    } catch {
      installed = false
    }

    return {
      tool: 'cursor',
      name: 'Cursor',
      installed,
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
        hasOctoPrompt = content.includes('octoprompt')
      } catch {
        installed = false
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

  private async getOctopromptPath(): Promise<string> {
    // Get the current working directory as the OctoPrompt path
    // In production, this might be different
    return process.cwd()
  }

  private async validateInstallation(
    configPath: string,
    serverName: string
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      const content = await fs.readFile(configPath, 'utf-8')
      const config = JSON.parse(content) as MCPConfig

      // Check if server config exists
      if (!(serverName in config.mcpServers)) {
        return { valid: false, error: 'Server configuration not found' }
      }

      const serverConfig = config.mcpServers[serverName]

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
}

export const mcpInstallationService = new MCPInstallationService()