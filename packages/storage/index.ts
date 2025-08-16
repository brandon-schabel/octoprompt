// Export base-storage first as other storage classes depend on it
export * from './src/base-storage'
export * from './src/utils/storage-helpers'
export * from './src/utils/transaction-helpers'

// Export storage implementations
export * from './src/chat-storage'
export * from './src/project-storage'
export * from './src/prompt-storage'
export * from './src/provider-key-storage'
export * from './src/ticket-storage'
export * from './src/queue-storage'
export * from './src/mcp-storage'
export * from './src/active-tab-storage'
export * from './src/claude-agent-storage'
export * from './src/claude-command-storage'
export * from './src/claude-hook-storage'
export * from './src/claude-hook-storage-simple'
export * from './src/parser-registry'

// Export missing storage instances that services need
export { activeTabStorage } from './src/active-tab-storage'
export { chatStorage } from './src/chat-storage'
export { claudeAgentStorage } from './src/claude-agent-storage'
export { claudeHookStorageSimple } from './src/claude-hook-storage-simple'
export { mcpStorage } from './src/mcp-storage'
export { mcpTrackingStorage } from './src/mcp-tracking-storage'
export { parserRegistry } from './src/parser-registry'
export { projectStorage } from './src/project-storage'
export { promptStorage } from './src/prompt-storage'
export { providerKeyStorage } from './src/provider-key-storage'
export { queueStorage } from './src/queue-storage'
export { ticketStorage } from './src/ticket-storage'

// Export missing types for ChatMessagesStorage and ParserRegistry
export type { ChatMessagesStorage } from './src/chat-storage'
export { ParserRegistry } from './src/parser-registry'

// Export everything from storage-v2 except MigrationConfig
export { StorageV2, FileAdapter, MemoryAdapter } from './src/storage-v2'

export type {
  StorageAdapter,
  IndexConfig,
  CacheConfig,
  StorageV2Config,
  MigrationConfig as StorageV2MigrationConfig
} from './src/storage-v2'

export * from './src/sqlite-adapter'
export * from './src/sqlite-db-manager-adapter'
export * from './src/database-manager'
export * from './src/database-adapter'

// Export everything from migrations with renamed MigrationConfig
export {
  MigrationRunner,
  createMigration,
  runMigrations,
  createAddFieldMigration,
  createRenameFieldMigration,
  createTransformMigration,
  createFilterMigration,
  getMigrationStatus,
  validateMigrations
} from './src/migrations'

export type { Migration, MigrationFunction, MigrationHistoryEntry, MigrationConfig } from './src/migrations'

export * from './src/mcp-tracking-storage'
export * from './src/encryption-key-storage'
export * from './src/test-utils'
