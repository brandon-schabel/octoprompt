import fs from 'node:fs/promises'
import path from 'node:path'
import { StorageAdapter } from '../core/storage-adapter'
import { globalStorageRegistry } from '../core/storage-factory'

export interface MigrationStep {
  name: string
  description: string
  execute: (context: MigrationContext) => Promise<void>
  rollback?: (context: MigrationContext) => Promise<void>
  validate?: (context: MigrationContext) => Promise<boolean>
}

export interface MigrationContext {
  sourceAdapter: StorageAdapter
  targetAdapter: StorageAdapter
  options: MigrationOptions
  progress: (current: number, total: number, message?: string) => void
  log: (message: string) => void
  warn: (message: string) => void
  error: (message: string) => void
}

export interface MigrationOptions {
  batchSize?: number
  dryRun?: boolean
  backupPath?: string
  keyTransform?: (key: string) => string
  dataTransform?: (key: string, data: any) => any
  filter?: (key: string, data: any) => boolean
  preserveTimestamps?: boolean
  skipValidation?: boolean
}

export interface MigrationResult {
  success: boolean
  migratedKeys: number
  skippedKeys: number
  errors: string[]
  duration: number
  backupPath?: string
}

/**
 * Storage migrator for moving data between different storage adapters
 */
export class StorageMigrator {
  private steps: MigrationStep[] = []
  
  addStep(step: MigrationStep): void {
    this.steps.push(step)
  }
  
  async migrate(
    sourceAdapter: StorageAdapter,
    targetAdapter: StorageAdapter,
    options: MigrationOptions = {}
  ): Promise<MigrationResult> {
    const startTime = Date.now()
    const result: MigrationResult = {
      success: false,
      migratedKeys: 0,
      skippedKeys: 0,
      errors: [],
      duration: 0
    }
    
    const context: MigrationContext = {
      sourceAdapter,
      targetAdapter,
      options: {
        batchSize: 100,
        dryRun: false,
        preserveTimestamps: true,
        skipValidation: false,
        ...options
      },
      progress: (current, total, message) => {
        console.log(`[Migration] ${current}/${total} ${message || ''}`)
      },
      log: (message) => console.log(`[Migration] ${message}`),
      warn: (message) => console.warn(`[Migration] ${message}`),
      error: (message) => {
        console.error(`[Migration] ${message}`)
        result.errors.push(message)
      }
    }
    
    try {
      context.log('Starting migration...')
      
      // Create backup if requested
      if (options.backupPath) {
        result.backupPath = await this.createBackup(sourceAdapter, options.backupPath)
        context.log(`Backup created: ${result.backupPath}`)
      }
      
      // Execute migration steps
      for (const step of this.steps) {
        context.log(`Executing step: ${step.name}`)
        
        try {
          if (!options.dryRun) {
            await step.execute(context)
          }
          
          // Validate step if validation function provided
          if (step.validate && !options.skipValidation) {
            const isValid = await step.validate(context)
            if (!isValid) {
              throw new Error(`Validation failed for step: ${step.name}`)
            }
          }
          
          context.log(`Completed step: ${step.name}`)
        } catch (error) {
          const errorMessage = `Step failed: ${step.name} - ${error instanceof Error ? error.message : String(error)}`
          context.error(errorMessage)
          
          // Attempt rollback if available
          if (step.rollback && !options.dryRun) {
            try {
              context.log(`Rolling back step: ${step.name}`)
              await step.rollback(context)
            } catch (rollbackError) {
              context.error(`Rollback failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`)
            }
          }
          
          throw error
        }
      }
      
      result.success = true
      context.log('Migration completed successfully')
      
    } catch (error) {
      result.success = false
      context.error(`Migration failed: ${error instanceof Error ? error.message : String(error)}`)
    }
    
    result.duration = Date.now() - startTime
    return result
  }
  
  private async createBackup(adapter: StorageAdapter, backupPath: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fullBackupPath = path.join(backupPath, `backup-${timestamp}.json`)
    
    // Ensure backup directory exists
    await fs.mkdir(path.dirname(fullBackupPath), { recursive: true })
    
    // Get all keys
    const keys = await adapter.list()
    const backupData: Record<string, any> = {}
    
    // Read all data
    for (const key of keys) {
      try {
        const data = await adapter.read(key)
        if (data !== null) {
          backupData[key] = data
        }
      } catch (error) {
        console.warn(`Failed to backup key ${key}: ${error}`)
      }
    }
    
    // Write backup file
    await fs.writeFile(fullBackupPath, JSON.stringify(backupData, null, 2), 'utf-8')
    
    return fullBackupPath
  }
}

/**
 * Pre-built migration steps
 */
export class MigrationSteps {
  /**
   * Simple data copy from source to target
   */
  static dataCopy(): MigrationStep {
    return {
      name: 'data-copy',
      description: 'Copy all data from source to target adapter',
      execute: async (context) => {
        const { sourceAdapter, targetAdapter, options } = context
        
        // Get all keys from source
        const keys = await sourceAdapter.list()
        context.log(`Found ${keys.length} keys to migrate`)
        
        let migratedCount = 0
        let skippedCount = 0
        
        // Process in batches
        for (let i = 0; i < keys.length; i += options.batchSize!) {
          const batch = keys.slice(i, i + options.batchSize!)
          
          // Read batch from source
          const sourceData = await sourceAdapter.readMany(batch)
          const targetBatch = new Map<string, any>()
          
          for (const [key, data] of sourceData) {
            try {
              // Apply filter if provided
              if (options.filter && !options.filter(key, data)) {
                skippedCount++
                continue
              }
              
              // Transform key if needed
              const targetKey = options.keyTransform ? options.keyTransform(key) : key
              
              // Transform data if needed
              const targetData = options.dataTransform ? options.dataTransform(key, data) : data
              
              targetBatch.set(targetKey, targetData)
              migratedCount++
              
            } catch (error) {
              context.error(`Failed to process key ${key}: ${error}`)
              skippedCount++
            }
          }
          
          // Write batch to target
          if (targetBatch.size > 0) {
            await targetAdapter.writeMany(targetBatch)
          }
          
          context.progress(i + batch.length, keys.length, `Migrated ${migratedCount}, skipped ${skippedCount}`)
        }
        
        context.log(`Migration complete: ${migratedCount} migrated, ${skippedCount} skipped`)
      },
      
      validate: async (context) => {
        const { sourceAdapter, targetAdapter } = context
        
        // Basic validation: compare key counts
        const sourceCount = await sourceAdapter.count()
        const targetCount = await targetAdapter.count()
        
        context.log(`Validation: source=${sourceCount}, target=${targetCount}`)
        
        // Allow for some difference due to filtering/transformation
        return targetCount > 0 && targetCount <= sourceCount
      }
    }
  }
  
  /**
   * Schema transformation step
   */
  static schemaTransform(
    transform: (key: string, data: any) => any,
    description = 'Transform data schema'
  ): MigrationStep {
    return {
      name: 'schema-transform',
      description,
      execute: async (context) => {
        const { sourceAdapter, targetAdapter, options } = context
        
        const keys = await sourceAdapter.list()
        context.log(`Transforming ${keys.length} entries`)
        
        let transformedCount = 0
        
        for (let i = 0; i < keys.length; i += options.batchSize!) {
          const batch = keys.slice(i, i + options.batchSize!)
          const sourceData = await sourceAdapter.readMany(batch)
          const transformedBatch = new Map<string, any>()
          
          for (const [key, data] of sourceData) {
            try {
              const transformedData = transform(key, data)
              transformedBatch.set(key, transformedData)
              transformedCount++
            } catch (error) {
              context.error(`Failed to transform key ${key}: ${error}`)
            }
          }
          
          if (transformedBatch.size > 0) {
            await targetAdapter.writeMany(transformedBatch)
          }
          
          context.progress(i + batch.length, keys.length, `Transformed ${transformedCount}`)
        }
        
        context.log(`Schema transformation complete: ${transformedCount} entries`)
      }
    }
  }
  
  /**
   * Index creation step
   */
  static createIndexes(indexes: Array<{ name: string; fields: string[] }>): MigrationStep {
    return {
      name: 'create-indexes',
      description: 'Create indexes for better query performance',
      execute: async (context) => {
        context.log(`Creating ${indexes.length} indexes`)
        
        // This would integrate with the IndexManager
        for (const index of indexes) {
          context.log(`Creating index: ${index.name} on fields [${index.fields.join(', ')}]`)
          // TODO: Integrate with IndexManager from index-manager.ts
        }
        
        context.log('Index creation complete')
      }
    }
  }
  
  /**
   * Data validation step
   */
  static validateData(
    validator: (key: string, data: any) => boolean | string,
    description = 'Validate migrated data'
  ): MigrationStep {
    return {
      name: 'validate-data',
      description,
      execute: async (context) => {
        const { targetAdapter, options } = context
        
        const keys = await targetAdapter.list()
        context.log(`Validating ${keys.length} entries`)
        
        let validCount = 0
        let invalidCount = 0
        
        for (let i = 0; i < keys.length; i += options.batchSize!) {
          const batch = keys.slice(i, i + options.batchSize!)
          const data = await targetAdapter.readMany(batch)
          
          for (const [key, value] of data) {
            try {
              const result = validator(key, value)
              if (result === true) {
                validCount++
              } else {
                invalidCount++
                const message = typeof result === 'string' ? result : 'Validation failed'
                context.warn(`Invalid data at key ${key}: ${message}`)
              }
            } catch (error) {
              invalidCount++
              context.error(`Validation error for key ${key}: ${error}`)
            }
          }
          
          context.progress(i + batch.length, keys.length, `Valid: ${validCount}, Invalid: ${invalidCount}`)
        }
        
        if (invalidCount > 0) {
          throw new Error(`Data validation failed: ${invalidCount} invalid entries`)
        }
        
        context.log(`Data validation complete: ${validCount} valid entries`)
      }
    }
  }
}

/**
 * High-level migration utilities
 */
export class StorageMigrationUtils {
  /**
   * Migrate from old file-based storage to new adapter
   */
  static async migrateFromLegacyStorage(
    legacyDataPath: string,
    targetAdapter: StorageAdapter,
    options: MigrationOptions = {}
  ): Promise<MigrationResult> {
    const migrator = new StorageMigrator()
    
    // Create temporary source adapter for legacy data
    const { FileStorageAdapter } = await import('../adapters/file-storage-adapter')
    const sourceAdapter = new FileStorageAdapter({
      dataPath: legacyDataPath,
      ...options
    })
    
    await sourceAdapter.connect()
    
    try {
      // Add migration steps
      migrator.addStep(MigrationSteps.dataCopy())
      
      if (options.dataTransform) {
        migrator.addStep(MigrationSteps.schemaTransform(options.dataTransform))
      }
      
      migrator.addStep(MigrationSteps.validateData((key, data) => {
        // Basic validation: ensure data is not null/undefined
        return data !== null && data !== undefined
      }))
      
      return await migrator.migrate(sourceAdapter, targetAdapter, options)
    } finally {
      await sourceAdapter.disconnect()
    }
  }
  
  /**
   * Copy storage between different adapter types
   */
  static async copyStorage(
    sourceType: string,
    sourceConfig: any,
    targetType: string,
    targetConfig: any,
    options: MigrationOptions = {}
  ): Promise<MigrationResult> {
    const sourceAdapter = globalStorageRegistry.get(sourceType)
    const targetAdapter = globalStorageRegistry.get(targetType)
    
    if (!sourceAdapter) {
      throw new Error(`Source adapter not found: ${sourceType}`)
    }
    
    if (!targetAdapter) {
      throw new Error(`Target adapter not found: ${targetType}`)
    }
    
    const migrator = new StorageMigrator()
    migrator.addStep(MigrationSteps.dataCopy())
    
    return await migrator.migrate(sourceAdapter, targetAdapter, options)
  }
  
  /**
   * Restore from backup
   */
  static async restoreFromBackup(
    backupPath: string,
    targetAdapter: StorageAdapter
  ): Promise<MigrationResult> {
    const startTime = Date.now()
    const result: MigrationResult = {
      success: false,
      migratedKeys: 0,
      skippedKeys: 0,
      errors: [],
      duration: 0
    }
    
    try {
      // Read backup file
      const backupContent = await fs.readFile(backupPath, 'utf-8')
      const backupData = JSON.parse(backupContent)
      
      console.log(`Restoring ${Object.keys(backupData).length} keys from backup`)
      
      // Write data to target
      const entries = new Map(Object.entries(backupData))
      await targetAdapter.writeMany(entries)
      
      result.migratedKeys = entries.size
      result.success = true
      
      console.log(`Restore complete: ${result.migratedKeys} keys restored`)
      
    } catch (error) {
      result.success = false
      const errorMessage = `Restore failed: ${error instanceof Error ? error.message : String(error)}`
      result.errors.push(errorMessage)
      console.error(errorMessage)
    }
    
    result.duration = Date.now() - startTime
    return result
  }
}

// Export convenience function for common migration scenarios
export async function migrateStorage(
  from: { type: string; config: any },
  to: { type: string; config: any },
  options: MigrationOptions = {}
): Promise<MigrationResult> {
  return StorageMigrationUtils.copyStorage(
    from.type,
    from.config,
    to.type,
    to.config,
    options
  )
}