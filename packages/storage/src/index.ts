// Export core base classes
export { BaseStorage, type BaseEntity, type StorageOptions } from './core/base-storage'
export { BaseStorageString } from './core/base-storage-string'

// Export existing storage
export * from './project-storage'
export * from './chat-storage'
export * from './prompt-storage'
export * from './claude-code-storage'
export * from './provider-key-storage'

// Export new enhanced storage system
export * from './core/storage-adapter'
export * from './core/locks'
export * from './core/multi-level-cache'
export * from './core/storage-factory'

// Export adapters
export * from './adapters/memory-storage-adapter'
export * from './adapters/file-storage-adapter'

// Export migration utilities
export * from './migration/storage-migrator'
export * from './migration/v2-migrations'

// Export enhanced storage implementations
export * from './project-storage'

// Re-export core types and utilities
export type {
  StorageAdapter,
  StorageConfig,
  StorageAdapterType,
  StorageError,
  StorageErrorCode,
  StorageMetrics
} from './core/storage-adapter'

export type { ReadWriteLock, Lock, LockManager } from './core/locks'

export type { MultiLevelCache, MultiLevelCacheConfig, CacheLevel, CacheStats } from './core/multi-level-cache'

export type { CachedStorageAdapter, StorageRegistry } from './core/storage-factory'

export { globalStorageRegistry, createProjectStorage, createTestStorage } from './core/storage-factory'

export { globalLockManager } from './core/locks'

export type { MigrationStep, MigrationContext, MigrationOptions, MigrationResult } from './migration/storage-migrator'

export { StorageMigrator, MigrationSteps, StorageMigrationUtils, migrateStorage } from './migration/storage-migrator'
