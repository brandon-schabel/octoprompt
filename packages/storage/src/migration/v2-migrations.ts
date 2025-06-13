import path from 'node:path'
import { ChatStorage } from '../chat-storage'
import { PromptStorage } from '../prompt-storage'
import { ProviderKeyStorage } from '../provider-key-storage'
import { ClaudeCodeStorage } from '../claude-code-storage'
import { ProjectStorage } from '../project-storage'
import type { StorageOptions } from '../core/base-storage'

// Legacy storage imports
import * as chatStorage from '../chat-storage'
import * as promptStorage from '../prompt-storage'
import * as providerKeyStorage from '../provider-key-storage'
import * as claudeCodeStorage from '../claude-code-storage'
import * as projectStorage from '../project-storage'

export interface MigrationOptions {
  dryRun?: boolean
  backupOriginal?: boolean
  validateData?: boolean
  batchSize?: number
  onProgress?: (progress: { current: number; total: number; entity: string }) => void
}

export interface MigrationResult {
  success: boolean
  migrated: number
  errors: string[]
  duration: number
  backupPath?: string
}

/**
 * Migration utilities for upgrading from V1 to V2 storage systems
 */
export class StorageV2Migrator {
  /**
   * Migrate chat storage from V1 to V2
   */
  static async migrateChatStorage(options: MigrationOptions = {}): Promise<MigrationResult> {
    const startTime = Date.now()
    const errors: string[] = []
    let migrated = 0

    try {
      console.log('Starting chat storage migration...')
      
      // Initialize V2 storage
      const v2Storage = new ChatStorage({
        cacheEnabled: false // Disable cache during migration
      })

      // Get all V1 chats
      const v1Chats = await chatStorage.getAllChats()
      console.log(`Found ${v1Chats.length} chats to migrate`)

      if (options.dryRun) {
        console.log('DRY RUN: Would migrate', v1Chats.length, 'chats')
        return {
          success: true,
          migrated: v1Chats.length,
          errors: [],
          duration: Date.now() - startTime
        }
      }

      // Backup original data if requested
      let backupPath: string | undefined
      if (options.backupOriginal) {
        backupPath = await this.backupV1Data('chat_storage')
      }

      // Migrate each chat
      for (let i = 0; i < v1Chats.length; i++) {
        const chat = v1Chats[i]
        
        try {
          // Create chat in V2 storage
          const v2Chat = await v2Storage.create({
            title: chat.title,
            projectId: chat.projectId,
            created: chat.created,
            updated: chat.updated
          })

          // Migrate messages
          const v1Messages = await chatStorage.getChatMessages(chat.id)
          for (const message of v1Messages) {
            await v2Storage.addMessage(v2Chat.id, {
              role: message.role,
              content: message.content,
              type: message.type,
              chatId: v2Chat.id
            })
          }

          migrated++
          
          if (options.onProgress) {
            options.onProgress({ current: i + 1, total: v1Chats.length, entity: 'chats' })
          }
        } catch (error: any) {
          errors.push(`Failed to migrate chat ${chat.id}: ${error.message}`)
        }
      }

      console.log(`Chat migration completed: ${migrated} migrated, ${errors.length} errors`)

      return {
        success: errors.length === 0,
        migrated,
        errors,
        duration: Date.now() - startTime,
        backupPath
      }
    } catch (error: any) {
      errors.push(`Chat migration failed: ${error.message}`)
      return {
        success: false,
        migrated,
        errors,
        duration: Date.now() - startTime
      }
    }
  }

  /**
   * Migrate prompt storage from V1 to V2
   */
  static async migratePromptStorage(options: MigrationOptions = {}): Promise<MigrationResult> {
    const startTime = Date.now()
    const errors: string[] = []
    let migrated = 0

    try {
      console.log('Starting prompt storage migration...')
      
      // Initialize V2 storage
      const v2Storage = new PromptStorage({
        cacheEnabled: false // Disable cache during migration
      })

      // Get all V1 prompts
      const v1Prompts = await promptStorage.getAllPrompts()
      console.log(`Found ${v1Prompts.length} prompts to migrate`)

      if (options.dryRun) {
        console.log('DRY RUN: Would migrate', v1Prompts.length, 'prompts')
        return {
          success: true,
          migrated: v1Prompts.length,
          errors: [],
          duration: Date.now() - startTime
        }
      }

      // Backup original data if requested
      let backupPath: string | undefined
      if (options.backupOriginal) {
        backupPath = await this.backupV1Data('prompt_storage')
      }

      // Migrate each prompt
      for (let i = 0; i < v1Prompts.length; i++) {
        const prompt = v1Prompts[i]
        
        try {
          // Create prompt in V2 storage
          await v2Storage.create({
            name: prompt.name,
            content: prompt.content,
            category: prompt.category,
            tags: prompt.tags || [],
            isGlobal: prompt.isGlobal || false,
            visibility: prompt.visibility || 'private',
            created: prompt.created,
            updated: prompt.updated
          })

          migrated++
          
          if (options.onProgress) {
            options.onProgress({ current: i + 1, total: v1Prompts.length, entity: 'prompts' })
          }
        } catch (error: any) {
          errors.push(`Failed to migrate prompt ${prompt.id}: ${error.message}`)
        }
      }

      console.log(`Prompt migration completed: ${migrated} migrated, ${errors.length} errors`)

      return {
        success: errors.length === 0,
        migrated,
        errors,
        duration: Date.now() - startTime,
        backupPath
      }
    } catch (error: any) {
      errors.push(`Prompt migration failed: ${error.message}`)
      return {
        success: false,
        migrated,
        errors,
        duration: Date.now() - startTime
      }
    }
  }

  /**
   * Migrate provider key storage from V1 to V2
   */
  static async migrateProviderKeyStorage(options: MigrationOptions = {}): Promise<MigrationResult> {
    const startTime = Date.now()
    const errors: string[] = []
    let migrated = 0

    try {
      console.log('Starting provider key storage migration...')
      
      // Initialize V2 storage with encryption
      const v2Storage = new ProviderKeyStorage({
        cacheEnabled: false, // Disable cache during migration
        encryption: {
          enabled: true,
          algorithm: 'aes-256-cbc'
        }
      })

      // Get all V1 provider keys
      const v1Keys = await providerKeyStorage.getAllProviderKeys()
      console.log(`Found ${v1Keys.length} provider keys to migrate`)

      if (options.dryRun) {
        console.log('DRY RUN: Would migrate', v1Keys.length, 'provider keys')
        return {
          success: true,
          migrated: v1Keys.length,
          errors: [],
          duration: Date.now() - startTime
        }
      }

      // Backup original data if requested
      let backupPath: string | undefined
      if (options.backupOriginal) {
        backupPath = await this.backupV1Data('provider_key_storage')
      }

      // Migrate each provider key
      for (let i = 0; i < v1Keys.length; i++) {
        const key = v1Keys[i]
        
        try {
          // Create provider key in V2 storage
          await v2Storage.create({
            provider: key.provider,
            key: key.key,
            environment: key.environment || 'production',
            isActive: key.isActive !== false,
            description: key.description,
            expiresAt: key.expiresAt,
            lastUsed: key.lastUsed
          })

          migrated++
          
          if (options.onProgress) {
            options.onProgress({ current: i + 1, total: v1Keys.length, entity: 'provider keys' })
          }
        } catch (error: any) {
          errors.push(`Failed to migrate provider key ${key.id}: ${error.message}`)
        }
      }

      console.log(`Provider key migration completed: ${migrated} migrated, ${errors.length} errors`)

      return {
        success: errors.length === 0,
        migrated,
        errors,
        duration: Date.now() - startTime,
        backupPath
      }
    } catch (error: any) {
      errors.push(`Provider key migration failed: ${error.message}`)
      return {
        success: false,
        migrated,
        errors,
        duration: Date.now() - startTime
      }
    }
  }

  /**
   * Migrate Claude Code storage from V1 to V2
   */
  static async migrateClaudeCodeStorage(options: MigrationOptions = {}): Promise<MigrationResult> {
    const startTime = Date.now()
    const errors: string[] = []
    let migrated = 0

    try {
      console.log('Starting Claude Code storage migration...')
      
      // Initialize V2 storage
      const v2Storage = new ClaudeCodeStorage({
        cacheEnabled: false // Disable cache during migration
      })

      // Get all V1 sessions
      const v1Sessions = await claudeCodeStorage.getAllClaudeCodeSessions()
      console.log(`Found ${v1Sessions.length} Claude Code sessions to migrate`)

      if (options.dryRun) {
        console.log('DRY RUN: Would migrate', v1Sessions.length, 'Claude Code sessions')
        return {
          success: true,
          migrated: v1Sessions.length,
          errors: [],
          duration: Date.now() - startTime
        }
      }

      // Backup original data if requested
      let backupPath: string | undefined
      if (options.backupOriginal) {
        backupPath = await this.backupV1Data('claude_code_storage')
      }

      // Migrate each session
      for (let i = 0; i < v1Sessions.length; i++) {
        const session = v1Sessions[i]
        
        try {
          // Create session in V2 storage
          const v2Session = await v2Storage.createSession({
            id: session.id,
            projectPath: session.projectPath,
            status: session.status,
            lastActivity: session.lastActivity
          })

          // Migrate messages
          const v1Messages = await claudeCodeStorage.getClaudeCodeSessionMessages(session.id)
          for (const message of v1Messages) {
            await v2Storage.addMessage(v2Session.id, {
              type: message.type,
              content: message.content,
              session_id: message.session_id,
              is_error: message.is_error,
              total_cost_usd: message.total_cost_usd,
              duration_ms: message.duration_ms,
              num_turns: message.num_turns,
              result: message.result,
              message: message.message
            })
          }

          migrated++
          
          if (options.onProgress) {
            options.onProgress({ current: i + 1, total: v1Sessions.length, entity: 'Claude Code sessions' })
          }
        } catch (error: any) {
          errors.push(`Failed to migrate Claude Code session ${session.id}: ${error.message}`)
        }
      }

      console.log(`Claude Code migration completed: ${migrated} migrated, ${errors.length} errors`)

      return {
        success: errors.length === 0,
        migrated,
        errors,
        duration: Date.now() - startTime,
        backupPath
      }
    } catch (error: any) {
      errors.push(`Claude Code migration failed: ${error.message}`)
      return {
        success: false,
        migrated,
        errors,
        duration: Date.now() - startTime
      }
    }
  }

  /**
   * Migrate project storage from V1 to V2
   */
  static async migrateProjectStorage(options: MigrationOptions = {}): Promise<MigrationResult> {
    const startTime = Date.now()
    const errors: string[] = []
    let migrated = 0

    try {
      console.log('Starting project storage migration...')
      
      // Initialize V2 storage
      const v2Storage = new ProjectStorage({
        cacheEnabled: false // Disable cache during migration
      })

      // Get all V1 projects
      const v1Projects = await projectStorage.getAllProjects()
      console.log(`Found ${v1Projects.length} projects to migrate`)

      if (options.dryRun) {
        console.log('DRY RUN: Would migrate', v1Projects.length, 'projects')
        return {
          success: true,
          migrated: v1Projects.length,
          errors: [],
          duration: Date.now() - startTime
        }
      }

      // Backup original data if requested
      let backupPath: string | undefined
      if (options.backupOriginal) {
        backupPath = await this.backupV1Data('project_storage')
      }

      // Migrate each project
      for (let i = 0; i < v1Projects.length; i++) {
        const project = v1Projects[i]
        
        try {
          // Create project in V2 storage
          const v2Project = await v2Storage.create({
            name: project.name,
            path: project.path,
            description: project.description,
            aiSummary: project.aiSummary,
            gitRemoteUrl: project.gitRemoteUrl,
            ignorePatterns: project.ignorePatterns || [],
            created: project.created,
            updated: project.updated
          })

          // Migrate project files
          const v1Files = await projectStorage.getProjectFiles(project.id)
          const fileStorage = v2Storage.getFileStorage(v2Project.id)
          
          for (const file of v1Files) {
            await fileStorage.create({
              path: file.path,
              content: file.content,
              extension: file.extension,
              size: file.size,
              checksum: file.checksum,
              lastSyncedAt: file.lastSyncedAt,
              syncVersion: file.syncVersion || 0
            })
          }

          migrated++
          
          if (options.onProgress) {
            options.onProgress({ current: i + 1, total: v1Projects.length, entity: 'projects' })
          }
        } catch (error: any) {
          errors.push(`Failed to migrate project ${project.id}: ${error.message}`)
        }
      }

      console.log(`Project migration completed: ${migrated} migrated, ${errors.length} errors`)

      return {
        success: errors.length === 0,
        migrated,
        errors,
        duration: Date.now() - startTime,
        backupPath
      }
    } catch (error: any) {
      errors.push(`Project migration failed: ${error.message}`)
      return {
        success: false,
        migrated,
        errors,
        duration: Date.now() - startTime
      }
    }
  }

  /**
   * Migrate all storage systems from V1 to V2
   */
  static async migrateAll(options: MigrationOptions = {}): Promise<Record<string, MigrationResult>> {
    console.log('Starting full migration from V1 to V2 storage...')
    
    const results: Record<string, MigrationResult> = {}

    // Migrate in order of dependencies (least dependent first)
    const migrations = [
      { name: 'provider-keys', fn: () => this.migrateProviderKeyStorage(options) },
      { name: 'prompts', fn: () => this.migratePromptStorage(options) },
      { name: 'projects', fn: () => this.migrateProjectStorage(options) },
      { name: 'chats', fn: () => this.migrateChatStorage(options) },
      { name: 'claude-code', fn: () => this.migrateClaudeCodeStorage(options) }
    ]

    for (const migration of migrations) {
      console.log(`\n--- Starting ${migration.name} migration ---`)
      results[migration.name] = await migration.fn()
      
      if (!results[migration.name].success && !options.dryRun) {
        console.error(`${migration.name} migration failed, stopping full migration`)
        break
      }
    }

    // Summary
    const totalMigrated = Object.values(results).reduce((sum, result) => sum + result.migrated, 0)
    const totalErrors = Object.values(results).reduce((sum, result) => sum + result.errors.length, 0)
    const totalDuration = Object.values(results).reduce((sum, result) => sum + result.duration, 0)

    console.log(`\n=== MIGRATION SUMMARY ===`)
    console.log(`Total migrated: ${totalMigrated}`)
    console.log(`Total errors: ${totalErrors}`)
    console.log(`Total duration: ${(totalDuration / 1000).toFixed(2)}s`)
    
    Object.entries(results).forEach(([name, result]) => {
      console.log(`${name}: ${result.migrated} migrated, ${result.errors.length} errors`)
    })

    return results
  }

  /**
   * Backup V1 data before migration
   */
  private static async backupV1Data(storageType: string): Promise<string> {
    const fs = await import('node:fs/promises')
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupDir = path.resolve(process.cwd(), 'data', 'backups', `v1-backup-${timestamp}`)
    const sourceDir = path.resolve(process.cwd(), 'data', storageType)
    
    await fs.mkdir(backupDir, { recursive: true })
    
    // Copy entire storage directory
    const backupPath = path.join(backupDir, storageType)
    await fs.cp(sourceDir, backupPath, { recursive: true, force: true })
    
    console.log(`Backed up ${storageType} to ${backupPath}`)
    return backupPath
  }

  /**
   * Validate migrated data
   */
  static async validateMigration(storageType: string): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = []
    
    try {
      switch (storageType) {
        case 'chats':
          const chatStorage = new ChatStorage()
          const chats = await chatStorage.list()
          console.log(`Validated ${chats.length} chats`)
          break
          
        case 'prompts':
          const promptStorage = new PromptStorage()
          const prompts = await promptStorage.list()
          console.log(`Validated ${prompts.length} prompts`)
          break
          
        case 'provider-keys':
          const keyStorage = new ProviderKeyStorage()
          const keys = await keyStorage.list()
          console.log(`Validated ${keys.length} provider keys`)
          break
          
        case 'claude-code':
          const ccStorage = new ClaudeCodeStorage()
          const sessions = await ccStorage.getAllSessions()
          console.log(`Validated ${sessions.length} Claude Code sessions`)
          break
          
        case 'projects':
          const projectStorage = new ProjectStorage()
          const projects = await projectStorage.list()
          console.log(`Validated ${projects.length} projects`)
          break
          
        default:
          issues.push(`Unknown storage type: ${storageType}`)
      }
    } catch (error: any) {
      issues.push(`Validation failed for ${storageType}: ${error.message}`)
    }
    
    return {
      valid: issues.length === 0,
      issues
    }
  }
}

// Convenience exports
export const migrateChatStorage = StorageV2Migrator.migrateChatStorage.bind(StorageV2Migrator)
export const migratePromptStorage = StorageV2Migrator.migratePromptStorage.bind(StorageV2Migrator)
export const migrateProviderKeyStorage = StorageV2Migrator.migrateProviderKeyStorage.bind(StorageV2Migrator)
export const migrateClaudeCodeStorage = StorageV2Migrator.migrateClaudeCodeStorage.bind(StorageV2Migrator)
export const migrateProjectStorage = StorageV2Migrator.migrateProjectStorage.bind(StorageV2Migrator)
export const migrateAllStorage = StorageV2Migrator.migrateAll.bind(StorageV2Migrator)