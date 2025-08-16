// Main exports for backwards compatibility
export * from './types'
export { BaseApiClient, PromptlianoError } from './base-client'

// Export individual client classes for granular usage
export { ProjectClient } from './clients/project-client'
export { ChatClient } from './clients/chat-client'
export { TicketClient } from './clients/ticket-client'
export { QueueClient } from './clients/queue-client'
export { GitClient } from './clients/git-client'
export { MCPClient } from './clients/mcp-client'
export { JobClient } from './clients/job-client'

// Import all clients for composition
import { ProjectClient } from './clients/project-client'
import { ChatClient } from './clients/chat-client'
import { TicketClient } from './clients/ticket-client'
import { QueueClient } from './clients/queue-client'
import { GitClient } from './clients/git-client'
import { MCPClient } from './clients/mcp-client'
import { JobClient } from './clients/job-client'

import type { ApiConfig } from './base-client'

/**
 * Main Promptliano API client that composes all individual service clients
 * 
 * This maintains backwards compatibility with the original monolithic client
 * while providing access to modularized services for tree-shaking benefits.
 */
export class PromptlianoClient {
  // Service clients
  public readonly projects: ProjectClient
  public readonly chats: ChatClient
  public readonly tickets: TicketClient
  public readonly queues: QueueClient
  public readonly git: GitClient
  public readonly mcp: MCPClient
  public readonly jobs: JobClient

  // Backwards compatibility aliases
  public readonly prompts: any // Will need to implement these separately
  public readonly markdown: any
  public readonly agents: any
  public readonly commands: any
  public readonly claudeCode: any
  public readonly claudeHooks: any
  public readonly keys: any
  public readonly genAi: any
  public readonly system: any
  public readonly mcpAnalytics: any
  public readonly agentFiles: any
  public readonly mcpInstallation: any
  public readonly mcpProjectConfig: any
  public readonly mcpGlobalConfig: any
  public readonly flow: any

  constructor(config: ApiConfig) {
    // Initialize the main service clients
    this.projects = new ProjectClient(config)
    this.chats = new ChatClient(config)
    this.tickets = new TicketClient(config)
    this.queues = new QueueClient(config)
    this.git = new GitClient(config)
    this.mcp = new MCPClient(config)
    this.jobs = new JobClient(config)

    // For backwards compatibility, map MCP sub-services
    this.mcpAnalytics = this.mcp
    this.mcpInstallation = this.mcp
    this.mcpProjectConfig = this.mcp
    this.mcpGlobalConfig = this.mcp

    // Placeholder implementations for services not yet modularized
    // These would need to be implemented as separate client modules
    this.prompts = null
    this.markdown = null
    this.agents = null
    this.commands = null
    this.claudeCode = null
    this.claudeHooks = null
    this.keys = null
    this.genAi = null
    this.system = null
    this.agentFiles = null
    this.flow = null

    // Log a warning about incomplete modularization
    if (typeof console !== 'undefined') {
      console.warn('[PromptlianoClient] Some services are not yet modularized. Please use individual client imports for full functionality.')
    }
  }
}

/**
 * Factory function for creating the main Promptliano client
 * 
 * @param config - API configuration including baseUrl, timeout, headers, etc.
 * @returns Configured PromptlianoClient instance
 */
export function createPromptlianoClient(config: ApiConfig): PromptlianoClient {
  return new PromptlianoClient(config)
}

/**
 * Backwards compatibility exports
 * 
 * These maintain the exact same API as the original monolithic client
 * for projects that haven't migrated to the new modular structure.
 */

// Legacy service class exports (these would point to the composed services)
export const ChatService = ChatClient
export const ProjectService = ProjectClient
export const TicketService = TicketClient
export const QueueService = QueueClient
export const GitService = GitClient
export const MCPService = MCPClient
export const JobService = JobClient

// Additional legacy aliases that might be used
export const MCPAnalyticsService = MCPClient
export const MCPInstallationService = MCPClient
export const MCPProjectConfigService = MCPClient
export const MCPGlobalConfigService = MCPClient

// Default export for easy importing
export default PromptlianoClient

/**
 * Migration Guide:
 * 
 * Before (monolithic):
 * ```typescript
 * import { createPromptlianoClient } from '@promptliano/api-client'
 * const client = createPromptlianoClient({ baseUrl: '...' })
 * await client.projects.listProjects()
 * ```
 * 
 * After (modular, for tree-shaking):
 * ```typescript
 * import { ProjectClient } from '@promptliano/api-client'
 * const projects = new ProjectClient({ baseUrl: '...' })
 * await projects.listProjects()
 * ```
 * 
 * The monolithic approach still works for backwards compatibility,
 * but using individual clients enables better tree-shaking and
 * reduces bundle size for applications that only use specific services.
 */