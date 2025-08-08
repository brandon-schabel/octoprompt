import { existsSync } from 'fs'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { dirname } from 'path'
import { detectEditors } from './editor-detector.js'
import { MCPConfigurator } from './mcp-configurator.js'
import { promptlianoPaths, paths } from './cross-platform-paths.js'
import { logger } from './logger.js'

export interface EditorConfig {
  id: string
  name: string
  configPath: string
  mcpKey: string
  installed: boolean
  configured: boolean
  version?: string
}

export interface MCPServerConfig {
  command: string
  args: string[]
  env?: Record<string, string>
}

/**
 * Unified service for managing editor configurations
 */
export class EditorService {
  private configurator: MCPConfigurator
  private supportedEditors: Map<string, Partial<EditorConfig>>

  constructor() {
    this.configurator = new MCPConfigurator()
    this.supportedEditors = new Map([
      [
        'claude',
        {
          name: 'Claude Desktop',
          mcpKey: 'mcpServers'
        }
      ],
      [
        'vscode',
        {
          name: 'VS Code',
          mcpKey: 'mcp.servers'
        }
      ],
      [
        'cursor',
        {
          name: 'Cursor',
          mcpKey: 'mcp.servers'
        }
      ],
      [
        'windsurf',
        {
          name: 'Windsurf',
          mcpKey: 'mcp.servers'
        }
      ],
      [
        'claude-code',
        {
          name: 'Claude Code',
          mcpKey: 'mcp.servers'
        }
      ]
    ])
  }

  /**
   * Get all editor configurations
   */
  async getAllEditorConfigs(): Promise<EditorConfig[]> {
    const configs: EditorConfig[] = []
    const detected = await detectEditors()

    for (const [id, editorInfo] of this.supportedEditors) {
      const detectedEditor = detected.find((e) => e.id === id)
      const configPath = this.getConfigPath(id)

      const config: EditorConfig = {
        id,
        name: editorInfo.name!,
        configPath,
        mcpKey: editorInfo.mcpKey!,
        installed: !!detectedEditor,
        configured: await this.isConfigured(id),
        version: detectedEditor?.version
      }

      configs.push(config)
    }

    return configs
  }

  /**
   * Get configuration for a specific editor
   */
  async getEditorConfig(editorId: string): Promise<EditorConfig | null> {
    const configs = await this.getAllEditorConfigs()
    return configs.find((c) => c.id === editorId) || null
  }

  /**
   * Check if an editor has Promptliano configured
   */
  async isConfigured(editorId: string): Promise<boolean> {
    try {
      const configPath = this.getConfigPath(editorId)
      if (!existsSync(configPath)) {
        return false
      }

      const content = await readFile(configPath, 'utf-8')
      const config = JSON.parse(content)
      const mcpKey = this.supportedEditors.get(editorId)?.mcpKey || 'mcp.servers'

      if (!config[mcpKey]) {
        return false
      }

      // Check for any promptliano server
      const servers = Object.keys(config[mcpKey])
      return servers.some((key) => key.toLowerCase().includes('promptliano'))
    } catch (error) {
      logger.debug(`Failed to check ${editorId} configuration:`, error)
      return false
    }
  }

  /**
   * Configure MCP for an editor
   */
  async configureMCP(
    editorId: string,
    options: {
      projectPath: string
      promptlianoPath?: string
      serverName?: string
    }
  ): Promise<{ success: boolean; error?: string }> {
    const editor = await this.getEditorConfig(editorId)
    if (!editor) {
      return { success: false, error: 'Unsupported editor' }
    }

    if (!editor.installed) {
      return { success: false, error: `${editor.name} is not installed` }
    }

    try {
      // Use the existing configurator
      return await this.configurator.configure({
        editor: editorId,
        projectPath: options.projectPath,
        promptlianoPath: options.promptlianoPath || promptlianoPaths.getInstallDir()
      })
    } catch (error) {
      logger.error(`Failed to configure ${editorId}:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Remove MCP configuration for an editor
   */
  async removeMCPConfig(editorId: string): Promise<boolean> {
    try {
      const editor = await this.getEditorConfig(editorId)
      if (!editor || !editor.configured) {
        return true // Already not configured
      }

      const content = await readFile(editor.configPath, 'utf-8')
      const config = JSON.parse(content)

      if (config[editor.mcpKey]) {
        // Remove all promptliano servers
        const servers = Object.keys(config[editor.mcpKey])
        servers.forEach((key) => {
          if (key.toLowerCase().includes('promptliano')) {
            delete config[editor.mcpKey][key]
          }
        })

        // Clean up empty mcp key
        if (Object.keys(config[editor.mcpKey]).length === 0) {
          delete config[editor.mcpKey]
        }

        // Write back
        await writeFile(editor.configPath, JSON.stringify(config, null, 2))
      }

      return true
    } catch (error) {
      logger.error(`Failed to remove ${editorId} config:`, error)
      return false
    }
  }

  /**
   * Get all configured Promptliano servers for an editor
   */
  async getPromptlianoServers(editorId: string): Promise<Record<string, MCPServerConfig>> {
    try {
      const editor = await this.getEditorConfig(editorId)
      if (!editor || !editor.configured) {
        return {}
      }

      const content = await readFile(editor.configPath, 'utf-8')
      const config = JSON.parse(content)

      if (!config[editor.mcpKey]) {
        return {}
      }

      const servers: Record<string, MCPServerConfig> = {}

      for (const [key, value] of Object.entries(config[editor.mcpKey])) {
        if (key.toLowerCase().includes('promptliano')) {
          servers[key] = value as MCPServerConfig
        }
      }

      return servers
    } catch (error) {
      logger.error(`Failed to get servers for ${editorId}:`, error)
      return {}
    }
  }

  /**
   * Update server configuration
   */
  async updateServerConfig(editorId: string, serverName: string, serverConfig: MCPServerConfig): Promise<boolean> {
    try {
      const editor = await this.getEditorConfig(editorId)
      if (!editor) {
        return false
      }

      // Ensure config directory exists
      await mkdir(dirname(editor.configPath), { recursive: true })

      let config: any = {}
      if (existsSync(editor.configPath)) {
        const content = await readFile(editor.configPath, 'utf-8')
        config = JSON.parse(content)
      }

      // Initialize mcp key if needed
      if (!config[editor.mcpKey]) {
        config[editor.mcpKey] = {}
      }

      // Update server config
      config[editor.mcpKey][serverName] = serverConfig

      // Write back
      await writeFile(editor.configPath, JSON.stringify(config, null, 2))

      return true
    } catch (error) {
      logger.error(`Failed to update ${editorId} server config:`, error)
      return false
    }
  }

  /**
   * Get config path for an editor
   */
  private getConfigPath(editorId: string): string {
    try {
      return promptlianoPaths.getMCPConfigPath(editorId)
    } catch {
      // Fallback for unsupported editors
      return paths.joinPath(paths.getHomeDir(), `.${editorId}`, 'settings.json')
    }
  }

  /**
   * Validate MCP configuration
   */
  async validateConfig(editorId: string): Promise<{
    valid: boolean
    errors: string[]
    warnings: string[]
  }> {
    const errors: string[] = []
    const warnings: string[] = []

    try {
      const editor = await this.getEditorConfig(editorId)
      if (!editor) {
        errors.push('Unsupported editor')
        return { valid: false, errors, warnings }
      }

      if (!editor.installed) {
        errors.push(`${editor.name} is not installed`)
        return { valid: false, errors, warnings }
      }

      if (!editor.configured) {
        warnings.push('No Promptliano configuration found')
        return { valid: true, errors, warnings }
      }

      const servers = await this.getPromptlianoServers(editorId)

      for (const [name, config] of Object.entries(servers)) {
        // Check command exists
        if (!config.command) {
          errors.push(`Server ${name}: missing command`)
        }

        // Check if command is executable
        if (config.command && !existsSync(config.command)) {
          const found = await paths.findExecutable(config.command)
          if (!found) {
            errors.push(`Server ${name}: command not found: ${config.command}`)
          }
        }

        // Check args
        if (!Array.isArray(config.args)) {
          errors.push(`Server ${name}: args must be an array`)
        }

        // Validate environment variables
        if (config.env && typeof config.env !== 'object') {
          errors.push(`Server ${name}: env must be an object`)
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings
      }
    } catch (error) {
      errors.push(`Failed to validate: ${error}`)
      return { valid: false, errors, warnings }
    }
  }
}

/**
 * Global instance
 */
export const editorService = new EditorService()
