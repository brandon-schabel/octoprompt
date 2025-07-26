// Recent changes:
// - Initial implementation of MCP config manager
// - Handles different config formats for various tools
// - Platform-specific path handling
// - Config validation and migration support
// - Session status integration

import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { z } from 'zod'
import { getActiveSessions } from '../../server/src/mcp/transport'

export const MCPStatusSchema = z.object({
  connected: z.boolean(),
  sessionId: z.string().optional(),
  lastActivity: z.number().optional(),
  projectId: z.number().optional(),
  tool: z.string().optional()
})

export type MCPStatus = z.infer<typeof MCPStatusSchema>

export const MCPProjectConfigSchema = z.object({
  projectId: z.number(),
  projectName: z.string(),
  mcpEnabled: z.boolean(),
  installedTools: z.array(z.object({
    tool: z.string(),
    installedAt: z.number(),
    configPath: z.string().optional(),
    serverName: z.string()
  })).default([]),
  customInstructions: z.string().optional()
})

export type MCPProjectConfig = z.infer<typeof MCPProjectConfigSchema>

export class MCPConfigManager {
  private readonly configDir: string

  constructor() {
    this.configDir = path.join(os.homedir(), '.octoprompt', 'mcp-configs')
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.configDir, { recursive: true })
  }

  async getProjectConfig(projectId: number): Promise<MCPProjectConfig | null> {
    try {
      const configPath = this.getProjectConfigPath(projectId)
      const content = await fs.readFile(configPath, 'utf-8')
      return MCPProjectConfigSchema.parse(JSON.parse(content))
    } catch {
      return null
    }
  }

  async saveProjectConfig(config: MCPProjectConfig): Promise<void> {
    const configPath = this.getProjectConfigPath(config.projectId)
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')
  }

  async updateProjectConfig(
    projectId: number,
    updates: Partial<MCPProjectConfig>
  ): Promise<MCPProjectConfig> {
    const existing = await this.getProjectConfig(projectId)
    
    const updated: MCPProjectConfig = existing ? {
      ...existing,
      ...updates,
      installedTools: updates.installedTools || existing.installedTools
    } : {
      projectId,
      projectName: updates.projectName || 'Unknown Project',
      mcpEnabled: updates.mcpEnabled ?? true,
      installedTools: updates.installedTools || [],
      customInstructions: updates.customInstructions
    }

    await this.saveProjectConfig(updated)
    return updated
  }

  async addInstalledTool(
    projectId: number,
    tool: string,
    configPath: string | undefined,
    serverName: string
  ): Promise<void> {
    const config = await this.getProjectConfig(projectId)
    
    if (config) {
      // Remove existing entry for this tool if any
      config.installedTools = config.installedTools.filter(t => t.tool !== tool)
      
      // Add new entry
      config.installedTools.push({
        tool,
        installedAt: Date.now(),
        configPath,
        serverName
      })
      
      await this.saveProjectConfig(config)
    } else {
      // Create new config
      await this.saveProjectConfig({
        projectId,
        projectName: 'Unknown Project',
        mcpEnabled: true,
        installedTools: [{
          tool,
          installedAt: Date.now(),
          configPath,
          serverName
        }]
      })
    }
  }

  async removeInstalledTool(projectId: number, tool: string): Promise<void> {
    const config = await this.getProjectConfig(projectId)
    
    if (config) {
      config.installedTools = config.installedTools.filter(t => t.tool !== tool)
      await this.saveProjectConfig(config)
    }
  }

  async getProjectStatus(projectId: number): Promise<MCPStatus> {
    // Get active sessions from the transport
    const activeSessions = getActiveSessions()
    
    // Find sessions for this project
    const projectSessions = activeSessions.filter(
      session => session.projectId === projectId
    )

    if (projectSessions.length > 0) {
      // Get the most recent session
      const latestSession = projectSessions.reduce((latest, current) => 
        current.lastActivity > latest.lastActivity ? current : latest
      )

      return {
        connected: true,
        sessionId: latestSession.id,
        lastActivity: latestSession.lastActivity,
        projectId
      }
    }

    return {
      connected: false,
      projectId
    }
  }

  async getAllProjectStatuses(): Promise<Map<number, MCPStatus>> {
    const statuses = new Map<number, MCPStatus>()
    const activeSessions = getActiveSessions()

    // Group sessions by project
    for (const session of activeSessions) {
      if (session.projectId) {
        const existing = statuses.get(session.projectId)
        
        if (!existing || session.lastActivity > (existing.lastActivity || 0)) {
          statuses.set(session.projectId, {
            connected: true,
            sessionId: session.id,
            lastActivity: session.lastActivity,
            projectId: session.projectId
          })
        }
      }
    }

    return statuses
  }

  async getGlobalStatus(): Promise<{ totalSessions: number; projectSessions: number }> {
    const activeSessions = getActiveSessions()
    const projectSessions = activeSessions.filter(s => s.projectId !== undefined).length

    return {
      totalSessions: activeSessions.length,
      projectSessions
    }
  }

  private getProjectConfigPath(projectId: number): string {
    return path.join(this.configDir, `project-${projectId}.json`)
  }

  async migrateOldConfigs(): Promise<void> {
    // This method can be used to migrate configs from old formats
    // Currently a placeholder for future use
  }

  async listProjectConfigs(): Promise<MCPProjectConfig[]> {
    try {
      const files = await fs.readdir(this.configDir)
      const configs: MCPProjectConfig[] = []

      for (const file of files) {
        if (file.startsWith('project-') && file.endsWith('.json')) {
          try {
            const content = await fs.readFile(path.join(this.configDir, file), 'utf-8')
            const config = MCPProjectConfigSchema.parse(JSON.parse(content))
            configs.push(config)
          } catch {
            // Skip invalid configs
          }
        }
      }

      return configs
    } catch {
      return []
    }
  }

  async exportConfig(projectId: number): Promise<string | null> {
    const config = await this.getProjectConfig(projectId)
    return config ? JSON.stringify(config, null, 2) : null
  }

  async importConfig(projectId: number, configData: string): Promise<void> {
    try {
      const parsed = JSON.parse(configData)
      const config = MCPProjectConfigSchema.parse({
        ...parsed,
        projectId // Ensure correct project ID
      })
      await this.saveProjectConfig(config)
    } catch (error) {
      throw new Error(`Invalid config format: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

export const mcpConfigManager = new MCPConfigManager()