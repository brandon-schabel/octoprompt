export * from './src/chat-service'
export * from './src/project-service'
export * from './src/project-statistics-service'
export * from './src/prompt-service'
export * from './src/provider-key-service'
export * from './src/provider-settings-service'
export * from './src/ticket-service'
export * from './src/queue-service'
export * from './src/queue-cleanup-service'
export * from './src/queue-timeout-service'
export * from './src/flow-service'
export * from './src/queue-state-machine'
export * from './src/mcp-service'
export * from './src/git-service'
export * from './src/active-tab-service'
export * from './src/job-service'
export * from './src/agents/agent-logger'

export * from './src/file-services/file-sync-service-unified'
export * from './src/model-providers/model-fetcher-service'
export * from './src/model-providers/provider-defaults'
export * from './src/gen-ai-services'

// Export new utilities
export * from './src/utils/error-handlers'
export * from './src/utils/bulk-operations'
export * from './src/core/base-service'
export * from './src/utils/logger'

// server side utils
export * from './src/utils/project-summary-service'
export * from './src/utils/file-importance-scorer'
export * from './src/utils/json-scribe'
export * from './src/utils/path-utils'

export * from './src/utils/storage-maintenance'
export * from './src/file-search-service'
export * from './src/file-indexing-service'
export * from './src/mcp-tracking-service'
export * from './src/file-relevance-service'
export * from './src/file-suggestion-strategy-service'
export * from './src/utils/compact-file-formatter'
export * from './src/utils/file-suggestion-utils'
export * from './src/file-grouping-service'
export * from './src/file-summarization-tracker'
export * from './src/enhanced-summarization-service'
export * from './src/tab-name-generation-service'
export * from './src/agent-instruction-service'
export * from './src/agent-file-detection-service'
export * from './src/mcp-installation-service'
export * from './src/mcp-config-manager'
export * from './src/mcp-project-config-service'
export * from './src/mcp-project-server-manager'
export * from './src/mcp-global-config-service'
export * from './src/claude-agent-service'
export * from './src/claude-command-service'
// Re-export types from schemas for backward compatibility
export type {
  CreateClaudeCommandBody,
  UpdateClaudeCommandBody,
  SearchCommandsQuery,
  CommandGenerationRequest,
  CreateProjectBody,
  UpdateProjectBody
} from '@promptliano/schemas'
export * from './src/claude-code-mcp-service'
export * from './src/claude-code-file-reader-service'
export * from './src/claude-code-import-service'
export * from './src/claude-hook-service'
export * from './src/parser-service'
export * from './src/parsers'
