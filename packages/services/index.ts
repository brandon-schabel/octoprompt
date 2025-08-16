export * from './src/chat-service'
export * from './src/project-service'
export * from './src/project-statistics-service'
export * from './src/prompt-service'
export * from './src/provider-key-service'
export * from './src/provider-settings-service'
export * from './src/custom-provider-validator'
export * from './src/ticket-service'
export * from './src/queue-service'
// Explicit re-export to avoid CleanupResult ambiguity with file-sync-service-unified
export { cleanupQueueData, resetQueue, moveFailedToDeadLetter, getQueueHealth } from './src/queue-cleanup-service'
export type { CleanupResult as QueueCleanupResult } from './src/queue-cleanup-service'
export * from './src/queue-timeout-service'
export * from './src/flow-service'
export * from './src/queue-state-machine'
export * from './src/mcp-service'
export * from './src/git-service'
export * from './src/active-tab-service'
// Do not export agent-logger - it contains Bun imports and should only be used server-side
// export * from './src/agents/agent-logger'

// Explicit re-export to avoid CleanupResult ambiguity with queue-cleanup-service
export {
  isIgnored,
  inferChangeType,
  createFileChangeWatcher,
  computeChecksum,
  isValidChecksum,
  loadIgnoreRules,
  getTextFiles,
  syncFileSet,
  syncProject,
  syncProjectFolder,
  createFileChangePlugin,
  createWatchersManager,
  createCleanupService,
  watchersManager
} from './src/file-services/file-sync-service-unified'
export type {
  FileChangeListener,
  WatchOptions,
  CleanupOptions,
  CleanupResult as FileServiceCleanupResult
} from './src/file-services/file-sync-service-unified'
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
// path-utils moved to @promptliano/shared

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
export * from './src/tab-name-generation-service'
export * from './src/agent-instruction-service'
export * from './src/agent-file-detection-service'
// Explicit re-export to avoid VSCodeSettings ambiguity with parsers
export { MCPInstallationService } from './src/mcp-installation-service'
export type {
  MCPInstallationOptions,
  MCPInstallationResult,
  MCPToolInfo,
  VSCodeSettings as MCPVSCodeSettings
} from './src/mcp-installation-service'
export { VSCodeSettingsSchema as MCPVSCodeSettingsSchema } from './src/mcp-installation-service'
export * from './src/mcp-config-manager'
export * from './src/mcp-project-config-service'
export * from './src/mcp-project-server-manager'
export * from './src/mcp-global-config-service'
export * from './src/mcp-installation-service'
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
// Re-export hook-related types from schemas for backward compatibility
export type {
  HookEvent,
  HookConfigurationLevel,
  CreateHookConfigBody,
  UpdateHookConfigBody,
  HookGenerationRequest,
  HookTestRequest,
  HookListItem,
  CreateHookRequest,
  UpdateHookRequest
} from '@promptliano/schemas'
export * from './src/parser-service'
// Parsers moved to @promptliano/shared
export * from './src/markdown-prompt-service'

export * from './src/enhanced-summarization-service'