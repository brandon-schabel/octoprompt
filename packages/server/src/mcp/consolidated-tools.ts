// Re-export all tools from the modular structure
// This file maintains backward compatibility while tools are migrated to the modular structure

// Re-export from the new modular structure
export {
  CONSOLIDATED_TOOLS,
  getConsolidatedToolByName,
  getAllConsolidatedToolNames,
  getAllConsolidatedTools,
  type ConsolidatedToolNames
} from './tools'

// Re-export shared types and enums for backward compatibility
export {
  ProjectManagerAction,
  PromptManagerAction,
  MarkdownPromptManagerAction,
  AgentManagerAction,
  TicketManagerAction,
  TaskManagerAction,
  AIAssistantAction,
  GitManagerAction,
  TabManagerAction,
  FileSummarizationManagerAction
} from './tools/shared'

// Re-export error codes for backward compatibility
export { MCPErrorCode } from './mcp-errors'
