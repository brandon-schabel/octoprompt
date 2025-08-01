// Recent changes:
// - Migrated to consolidated tools only
// - Removed all 39 individual tool definitions
// - Now exports only consolidated tool functionality

// MCP Tool Types
export interface MCPToolInputSchema {
  type: 'object'
  properties: Record<
    string,
    {
      type: string
      description: string
      default?: any
      enum?: string[]
    }
  >
  required?: string[]
}

export interface MCPToolContent {
  type: 'text'
  text: string
}

export interface MCPToolResponse {
  content: MCPToolContent[]
  isError?: boolean
}

export interface MCPToolDefinition<TArgs = any> {
  name: string
  description: string
  inputSchema: MCPToolInputSchema
  handler: (args: TArgs, projectId?: number) => Promise<MCPToolResponse>
}

// Re-export consolidated tools and helpers
import {
  CONSOLIDATED_TOOLS,
  getConsolidatedToolByName,
  getAllConsolidatedToolNames,
  getAllConsolidatedTools,
  type ConsolidatedToolNames
} from './consolidated-tools'

export {
  CONSOLIDATED_TOOLS,
  getConsolidatedToolByName,
  getAllConsolidatedToolNames,
  getAllConsolidatedTools,
  type ConsolidatedToolNames
}

// For backward compatibility during transition
export const BUILTIN_TOOLS = CONSOLIDATED_TOOLS
export const getToolByName = getConsolidatedToolByName
export const getAllToolNames = getAllConsolidatedToolNames
export const getAllTools = getAllConsolidatedTools
