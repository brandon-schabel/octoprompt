// Export existing storage
export * from './src/project-storage'
export * from './src/chat-storage'
export * from './src/prompt-storage'
export * from './src/claude-code-storage'
export * from './src/provider-key-storage'
export * from './src/attachment-storage'

// Export new core utilities
export * from './src/core/indexed-storage'
export * from './src/core/index-builder'
export * from './src/core/storage-query-utils'
export * from './src/core/storage-patterns'

// Export new enhanced storage system
export * from './src/core/storage-adapter'
export * from './src/core/locks'
export * from './src/core/multi-level-cache'
export * from './src/core/storage-factory'

// Export adapters
export * from './src/adapters/memory-storage-adapter'
export * from './src/adapters/file-storage-adapter'

// Export migration utilities
export * from './src/migration/storage-migrator'
export * from './src/migration/v2-migrations'

// Export enhanced storage implementations
export * from './src/project-storage'

// Export file watcher for cache invalidation
export * from './src/core/file-watcher'

// Re-export core types and utilities
export type {
  StorageAdapter,
  StorageConfig,
  StorageAdapterType,
  StorageError,
  StorageErrorCode,
  StorageMetrics
} from './src/core/storage-adapter'

export type {
  IndexDefinition
} from './src/core/indexed-storage'

export type {
  IndexBuilderOptions
} from './src/core/index-builder'

export {
  IndexBuilder,
  createIndexBuilder,
  IndexBuilders
} from './src/core/index-builder'

export type {
  VersionedEntity,
  SoftDeletableEntity,
  AuditableEntity
} from './src/core/storage-patterns'

export type {
  ReadWriteLock,
  Lock,
  LockManager
} from './src/core/locks'

export type {
  MultiLevelCache,
  MultiLevelCacheConfig,
  CacheLevel,
  CacheStats
} from './src/core/multi-level-cache'

export type {
  CachedStorageAdapter,
  StorageRegistry
} from './src/core/storage-factory'

export {
  globalStorageRegistry,
  createProjectStorage,
  createTestStorage
} from './src/core/storage-factory'

export {
  globalLockManager
} from './src/core/locks'

export type {
  MigrationStep,
  MigrationContext,
  MigrationOptions,
  MigrationResult
} from './src/migration/storage-migrator'

export {
  StorageMigrator,
  MigrationSteps,
  StorageMigrationUtils,
  migrateStorage
} from './src/migration/storage-migrator'
