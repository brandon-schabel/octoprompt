export * from './src/chat-storage'
export * from './src/project-storage'
export * from './src/prompt-storage'
export * from './src/provider-key-storage'
export * from './src/ticket-storage'
export * from './src/mcp-storage'
export * from './src/selected-files-storage'
export * from './src/active-tab-storage'

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
