// Main aggregator for all tools

// Import all tool groups
import { documentationSearchTool, websiteDemoRunnerTool } from './website'
import { mcpConfigGeneratorTool, mcpCompatibilityCheckerTool, mcpSetupValidatorTool } from './setup'
import { tabManagerTool } from './ui'
import { aiAssistantTool, agentManagerTool } from './content'
import { projectManagerTool, promptManagerTool, markdownPromptManagerTool } from './project'
import { ticketManagerTool, taskManagerTool, queueManagerTool, queueProcessorTool } from './workflow'
import { gitManagerTool } from './git'

// Import the command manager tool from parent directory
import { commandManagerTool } from '../command-manager-tool'

// Import types
import type { MCPToolDefinition } from '../tools-registry'

// Export the consolidated tools array
export const CONSOLIDATED_TOOLS: readonly MCPToolDefinition[] = [
  // Project tools
  projectManagerTool,
  promptManagerTool,
  markdownPromptManagerTool,
  // Workflow tools
  ticketManagerTool,
  taskManagerTool,
  queueManagerTool,
  queueProcessorTool,
  // Content tools
  aiAssistantTool,
  agentManagerTool,
  // Website tools
  documentationSearchTool,
  websiteDemoRunnerTool,
  // Setup tools
  mcpConfigGeneratorTool,
  mcpCompatibilityCheckerTool,
  mcpSetupValidatorTool,
  // UI tools
  tabManagerTool,
  // Command tool
  commandManagerTool,
  // Git tool
  gitManagerTool
] as const

// Helper functions
export type ConsolidatedToolNames = (typeof CONSOLIDATED_TOOLS)[number]['name']

export function getConsolidatedToolByName(name: string): MCPToolDefinition | undefined {
  return CONSOLIDATED_TOOLS.find((tool) => tool.name === name)
}

export function getAllConsolidatedToolNames(): string[] {
  return CONSOLIDATED_TOOLS.map((tool) => tool.name)
}

export function getAllConsolidatedTools(): readonly MCPToolDefinition[] {
  return CONSOLIDATED_TOOLS
}
