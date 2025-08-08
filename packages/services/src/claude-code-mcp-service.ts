import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { z } from 'zod'
import { createLogger } from './utils/logger'
import { getProjectById } from './project-service'
import { createHash } from 'crypto'
import { claudeCodeFileReaderService } from './claude-code-file-reader-service'
import type { ClaudeSession, ClaudeMessage, ClaudeProjectData } from '@promptliano/schemas'

const logger = createLogger('ClaudeCodeMCPService')

// Configuration schemas
const MCPServerConfigSchema = z.object({
  command: z.string(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional()
})

const ClaudeDesktopConfigSchema = z.object({
  mcpServers: z.record(MCPServerConfigSchema).optional()
})

const ClaudeCodeConfigSchema = z.object({
  mcpServers: z.record(MCPServerConfigSchema).optional(),
  defaultMcpServers: z.array(z.string()).optional(),
  projectBindings: z.record(z.any()).optional()
})

const ProjectMCPConfigSchema = z.object({
  mcpServers: z.record(MCPServerConfigSchema).optional()
})

export interface ClaudeCodeMCPStatus {
  claudeDesktop: {
    installed: boolean
    configExists: boolean
    hasPromptliano: boolean
    configPath?: string
    error?: string
  }
  claudeCode: {
    globalConfigExists: boolean
    globalHasPromptliano: boolean
    globalConfigPath?: string
    projectConfigExists: boolean
    projectHasPromptliano: boolean
    projectConfigPath?: string
    localConfigExists: boolean
    localHasPromptliano: boolean
    localConfigPath?: string
    error?: string
  }
  projectId: string
  installCommand: string
}

export class ClaudeCodeMCPService {
  private readonly platform = process.platform

  /**
   * Get Claude Desktop config path based on platform
   */
  private getClaudeDesktopConfigPath(): string {
    if (this.platform === 'darwin') {
      return path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
    } else if (this.platform === 'win32') {
      return path.join(os.homedir(), 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json')
    } else {
      return path.join(os.homedir(), '.config', 'claude', 'claude_desktop_config.json')
    }
  }

  /**
   * Get Claude Code config paths
   */
  private getClaudeCodeConfigPaths() {
    return {
      global: path.join(os.homedir(), '.claude.json'),
      local: path.join(os.homedir(), '.claude.json') // Same file but with project-specific sections
    }
  }

  /**
   * Check if a file exists
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
   * Read and parse JSON file safely
   */
  private async readJsonFile<T>(filePath: string): Promise<T | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(content)
    } catch (error) {
      logger.debug(`Failed to read JSON file ${filePath}:`, error)
      return null
    }
  }

  /**
   * Check if configuration has Promptliano server
   */
  private hasPromptlianoServer(servers: Record<string, any> | undefined): boolean {
    if (!servers) return false
    return Object.keys(servers).some(key => key.toLowerCase().includes('promptliano'))
  }

  /**
   * Generate project ID from path
   */
  private generateProjectId(projectPath: string): string {
    const hash = createHash('sha256')
    hash.update(projectPath)
    const hexHash = hash.digest('hex')
    const numericHash = parseInt(hexHash.substring(0, 8), 16)
    return Math.abs(numericHash).toString()
  }

  /**
   * Check Claude Desktop installation and configuration
   */
  private async checkClaudeDesktop(): Promise<ClaudeCodeMCPStatus['claudeDesktop']> {
    const configPath = this.getClaudeDesktopConfigPath()
    
    try {
      // Check if Claude Desktop is installed
      let installed = false
      if (this.platform === 'darwin') {
        installed = await this.fileExists('/Applications/Claude.app')
      } else if (this.platform === 'win32') {
        const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files'
        installed = await this.fileExists(path.join(programFiles, 'Claude', 'Claude.exe'))
      }

      // Check configuration
      const configExists = await this.fileExists(configPath)
      let hasPromptliano = false

      if (configExists) {
        const config = await this.readJsonFile<z.infer<typeof ClaudeDesktopConfigSchema>>(configPath)
        if (config) {
          try {
            const validConfig = ClaudeDesktopConfigSchema.parse(config)
            hasPromptliano = this.hasPromptlianoServer(validConfig.mcpServers)
          } catch {
            // Invalid config format
          }
        }
      }

      return {
        installed,
        configExists,
        hasPromptliano,
        configPath
      }
    } catch (error) {
      logger.error('Error checking Claude Desktop:', error)
      return {
        installed: false,
        configExists: false,
        hasPromptliano: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Check Claude Code CLI configuration
   */
  private async checkClaudeCode(projectPath: string): Promise<ClaudeCodeMCPStatus['claudeCode']> {
    const paths = this.getClaudeCodeConfigPaths()
    const projectMCPPath = path.join(projectPath, '.mcp.json')
    const projectId = this.generateProjectId(projectPath)

    try {
      // Check global config
      const globalConfigExists = await this.fileExists(paths.global)
      let globalHasPromptliano = false

      if (globalConfigExists) {
        const config = await this.readJsonFile<z.infer<typeof ClaudeCodeConfigSchema>>(paths.global)
        if (config) {
          try {
            const validConfig = ClaudeCodeConfigSchema.parse(config)
            globalHasPromptliano = this.hasPromptlianoServer(validConfig.mcpServers)
          } catch {
            // Invalid config format
          }
        }
      }

      // Check project config (.mcp.json)
      const projectConfigExists = await this.fileExists(projectMCPPath)
      let projectHasPromptliano = false

      if (projectConfigExists) {
        const config = await this.readJsonFile<z.infer<typeof ProjectMCPConfigSchema>>(projectMCPPath)
        if (config) {
          try {
            const validConfig = ProjectMCPConfigSchema.parse(config)
            projectHasPromptliano = this.hasPromptlianoServer(validConfig.mcpServers)
          } catch {
            // Invalid config format
          }
        }
      }

      // Check local config (project-specific section in global config)
      let localHasPromptliano = false
      if (globalConfigExists) {
        const config = await this.readJsonFile<any>(paths.global)
        if (config?.projectBindings?.[projectId]) {
          localHasPromptliano = true
        }
      }

      return {
        globalConfigExists,
        globalHasPromptliano,
        globalConfigPath: paths.global,
        projectConfigExists,
        projectHasPromptliano,
        projectConfigPath: projectMCPPath,
        localConfigExists: globalConfigExists,
        localHasPromptliano,
        localConfigPath: paths.local
      }
    } catch (error) {
      logger.error('Error checking Claude Code:', error)
      return {
        globalConfigExists: false,
        globalHasPromptliano: false,
        projectConfigExists: false,
        projectHasPromptliano: false,
        localConfigExists: false,
        localHasPromptliano: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get MCP status for Claude Code
   */
  async getMCPStatus(projectId: number): Promise<ClaudeCodeMCPStatus> {
    const project = await getProjectById(projectId)
    const projectPath = project.path
    const projectIdStr = this.generateProjectId(projectPath)

    const [claudeDesktop, claudeCode] = await Promise.all([
      this.checkClaudeDesktop(),
      this.checkClaudeCode(projectPath)
    ])

    // Generate install command using the actual Promptliano project ID
    const serverUrl = process.env.PROMPTLIANO_SERVER_URL || 'http://localhost:3147/api/mcp'
    const installCommand = `claude add promptliano --url ${serverUrl} --project-id ${projectId} --global`

    return {
      claudeDesktop,
      claudeCode,
      projectId: projectIdStr,
      installCommand
    }
  }

  /**
   * Get all Claude Code sessions for a project
   */
  async getSessions(projectId: number): Promise<ClaudeSession[]> {
    const project = await getProjectById(projectId)
    
    try {
      // First check if Claude Code is installed
      const isInstalled = await claudeCodeFileReaderService.isClaudeCodeInstalled()
      if (!isInstalled) {
        logger.debug('Claude Code is not installed')
        return []
      }

      // Try to find Claude project that matches
      const claudeProjectPath = await claudeCodeFileReaderService.findProjectByPath(project.path)
      if (!claudeProjectPath) {
        logger.debug(`No Claude Code data found for project: ${project.path}`)
        return []
      }

      return await claudeCodeFileReaderService.getSessions(claudeProjectPath)
    } catch (error) {
      logger.error('Failed to get Claude sessions:', error)
      return []
    }
  }

  /**
   * Get messages for a specific Claude Code session
   */
  async getSessionMessages(projectId: number, sessionId: string): Promise<ClaudeMessage[]> {
    const project = await getProjectById(projectId)
    
    try {
      const claudeProjectPath = await claudeCodeFileReaderService.findProjectByPath(project.path)
      if (!claudeProjectPath) {
        return []
      }

      return await claudeCodeFileReaderService.getSessionMessages(claudeProjectPath, sessionId)
    } catch (error) {
      logger.error('Failed to get session messages:', error)
      return []
    }
  }

  /**
   * Get Claude Code project data
   */
  async getProjectData(projectId: number): Promise<ClaudeProjectData | null> {
    const project = await getProjectById(projectId)
    
    try {
      const claudeProjectPath = await claudeCodeFileReaderService.findProjectByPath(project.path)
      if (!claudeProjectPath) {
        return null
      }

      return await claudeCodeFileReaderService.getProjectData(claudeProjectPath)
    } catch (error) {
      logger.error('Failed to get project data:', error)
      return null
    }
  }

  /**
   * Watch for Claude Code chat updates
   */
  watchChatHistory(projectId: number, onUpdate: (messages: ClaudeMessage[]) => void): () => void {
    let cleanup: (() => void) | null = null

    // Async initialization
    getProjectById(projectId).then(project => {
      claudeCodeFileReaderService.findProjectByPath(project.path).then(claudeProjectPath => {
        if (claudeProjectPath) {
          cleanup = claudeCodeFileReaderService.watchChatHistory(claudeProjectPath, onUpdate)
        }
      })
    }).catch(error => {
      logger.error('Failed to set up chat watcher:', error)
    })

    // Return cleanup function
    return () => {
      if (cleanup) {
        cleanup()
      }
    }
  }
}

// Create singleton instance
export const claudeCodeMCPService = new ClaudeCodeMCPService()

// Export factory function for consistency
export function createClaudeCodeMCPService(): ClaudeCodeMCPService {
  return claudeCodeMCPService
}