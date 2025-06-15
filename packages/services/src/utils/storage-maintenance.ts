import { 
  projectStorage, 
  chatStorage, 
  promptStorage, 
  providerKeyStorage,
  claudeCodeStorage,
  createCleanupScheduler,
  type CleanupOptions
} from '@octoprompt/storage'
import path from 'node:path'

interface MaintenanceOptions {
  enableScheduledCleanup?: boolean
  cleanupIntervalMs?: number
  initialCleanup?: boolean
  verbose?: boolean
}

let cleanupSchedulers: Array<{ stop: () => void }> = []

/**
 * Initialize storage maintenance routines
 */
export async function initializeStorageMaintenance(
  options: MaintenanceOptions = {}
): Promise<void> {
  const {
    enableScheduledCleanup = true,
    cleanupIntervalMs = 3600000, // 1 hour
    initialCleanup = true,
    verbose = false
  } = options

  console.log('[StorageMaintenance] Initializing storage maintenance...')

  // Perform initial cleanup if requested
  if (initialCleanup) {
    await performInitialCleanup({ verbose })
  }

  // Set up scheduled cleanup if enabled
  if (enableScheduledCleanup) {
    setupScheduledCleanup(cleanupIntervalMs, verbose)
  }
}

/**
 * Perform initial cleanup on startup
 */
async function performInitialCleanup(options: { verbose?: boolean }): Promise<void> {
  console.log('[StorageMaintenance] Performing initial cleanup...')

  const cleanupOptions: CleanupOptions = {
    dryRun: false,
    verbose: options.verbose,
    continueOnError: true
  }

  const storages = [
    { name: 'projects', storage: projectStorage, basePath: 'data/projects' },
    { name: 'chats', storage: chatStorage, basePath: 'data/chat_storage' },
    { name: 'prompts', storage: promptStorage, basePath: 'data/prompt_storage' },
    { name: 'tickets', basePath: 'data/ticket_storage' },
    { name: 'provider keys', storage: providerKeyStorage, basePath: 'data/provider_key_storage' },
  ]

  for (const { name, storage, basePath } of storages) {
    try {
      if (options.verbose) {
        console.log(`[StorageMaintenance] Cleaning ${name} storage...`)
      }

      // Clean temp files first
      await cleanTempFiles(basePath, cleanupOptions)

      // Note: Full cleanup is disabled by default to prevent accidental data loss
      // Uncomment the following to enable full cleanup:
      // const cleanup = new StorageCleanup(storage as any, basePath)
      // const result = await cleanup.cleanup(cleanupOptions)
      // 
      // if (options.verbose || result.errors.length > 0) {
      //   console.log(`[StorageMaintenance] ${name} cleanup result:`, {
      //     orphanedFiles: result.orphanedFiles.length,
      //     invalidEntities: result.invalidEntities.length,
      //     corruptedFiles: result.corruptedFiles.length,
      //     errors: result.errors.length
      //   })
      // }
    } catch (error) {
      console.error(`[StorageMaintenance] Error cleaning ${name} storage:`, error)
    }
  }

  console.log('[StorageMaintenance] Initial cleanup completed')
}

/**
 * Clean temporary files in a directory
 */
async function cleanTempFiles(
  basePath: string,
  options: CleanupOptions
): Promise<void> {
  const fs = await import('node:fs/promises')
  const { existsSync } = await import('node:fs')

  if (!existsSync(basePath)) return

  try {
    const files = await fs.readdir(basePath, { recursive: true })
    let cleaned = 0

    for (const file of files) {
      if (typeof file === 'string' && file.endsWith('.tmp')) {
        const fullPath = path.join(basePath, file)
        try {
          await fs.unlink(fullPath)
          cleaned++
          if (options.verbose) {
            console.log(`[StorageMaintenance] Removed temp file: ${fullPath}`)
          }
        } catch (error: any) {
          if (error.code !== 'ENOENT' && !options.continueOnError) {
            throw error
          }
        }
      }
    }

    if (cleaned > 0) {
      console.log(`[StorageMaintenance] Removed ${cleaned} temp files from ${basePath}`)
    }
  } catch (error) {
    console.error(`[StorageMaintenance] Error cleaning temp files in ${basePath}:`, error)
  }
}

/**
 * Set up scheduled cleanup tasks
 */
function setupScheduledCleanup(intervalMs: number, verbose: boolean): void {
  console.log(`[StorageMaintenance] Setting up scheduled cleanup (interval: ${intervalMs}ms)`)

  // For now, only set up temp file cleanup on schedule
  const tempFileCleanup = setInterval(async () => {
    if (verbose) {
      console.log('[StorageMaintenance] Running scheduled temp file cleanup...')
    }

    const basePaths = [
      'data/projects',
      'data/chat_storage',
      'data/prompt_storage',
      'data/ticket_storage',
      'data/provider_key_storage',
      'data/claude_code_storage'
    ]

    for (const basePath of basePaths) {
      await cleanTempFiles(basePath, {
        continueOnError: true,
        verbose: false
      })
    }
  }, intervalMs)

  // Store cleanup interval for shutdown
  cleanupSchedulers.push({
    stop: () => clearInterval(tempFileCleanup)
  })

  // Note: Full cleanup schedulers are disabled by default
  // Uncomment to enable full cleanup on schedule:
  // const storages = [...]
  // for (const { storage, basePath } of storages) {
  //   const scheduler = createCleanupScheduler(storage as any, basePath, intervalMs)
  //   scheduler.start()
  //   cleanupSchedulers.push(scheduler)
  // }
}

/**
 * Stop all cleanup schedulers
 */
export function stopStorageMaintenance(): void {
  console.log('[StorageMaintenance] Stopping all cleanup schedulers...')
  
  for (const scheduler of cleanupSchedulers) {
    scheduler.stop()
  }
  
  cleanupSchedulers = []
}

/**
 * Perform emergency cleanup (e.g., on critical errors)
 */
export async function performEmergencyCleanup(): Promise<void> {
  console.log('[StorageMaintenance] Performing emergency cleanup...')

  // Only clean temp files in emergency
  const basePaths = [
    'data',
    'data/projects',
    'data/chat_storage',
    'data/prompt_storage',
    'data/ticket_storage',
    'data/provider_key_storage',
    'data/claude_code_storage'
  ]

  for (const basePath of basePaths) {
    try {
      await cleanTempFiles(basePath, {
        continueOnError: true,
        verbose: false
      })
    } catch (error) {
      console.error(`[StorageMaintenance] Emergency cleanup error in ${basePath}:`, error)
    }
  }
}