import { MCPError, MCPErrorCode, createMCPError } from './mcp-errors'

/**
 * Transaction step interface
 */
export interface TransactionStep<T = any> {
  name: string
  execute: () => Promise<T>
  rollback?: (result: T) => Promise<void>
  retryable?: boolean
  maxRetries?: number
}

/**
 * Transaction result interface
 */
export interface TransactionResult<T = any> {
  success: boolean
  results: Map<string, T>
  errors: Map<string, Error>
  rolledBack: boolean
}

/**
 * Transaction options
 */
export interface TransactionOptions {
  stopOnError?: boolean // Stop executing remaining steps on first error
  rollbackOnError?: boolean // Rollback all completed steps on error
  maxRetries?: number // Default max retries for retryable steps
  retryDelay?: number // Delay between retries in ms
}

/**
 * Default transaction options
 */
const DEFAULT_OPTIONS: TransactionOptions = {
  stopOnError: true,
  rollbackOnError: true,
  maxRetries: 3,
  retryDelay: 100
}

/**
 * Transaction wrapper for multi-step operations
 */
export class MCPTransaction {
  private steps: TransactionStep[] = []
  private completedSteps: Array<{ step: TransactionStep; result: any }> = []
  private options: TransactionOptions

  constructor(options: TransactionOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  /**
   * Add a step to the transaction
   */
  addStep<T>(step: TransactionStep<T>): MCPTransaction {
    this.steps.push(step)
    return this
  }
  /**
   * Execute all transaction steps
   */
  async execute<T = any>(): Promise<TransactionResult<T>> {
    const results = new Map<string, T>()
    const errors = new Map<string, Error>()
    let rolledBack = false

    console.log(`[MCPTransaction] Starting transaction with ${this.steps.length} steps`)

    for (const step of this.steps) {
      try {
        console.log(`[MCPTransaction] Executing step: ${step.name}`)

        const result = await this.executeStepWithRetry(step)
        results.set(step.name, result)
        this.completedSteps.push({ step, result })

        console.log(`[MCPTransaction] Step completed: ${step.name}`)
      } catch (error) {
        console.error(`[MCPTransaction] Step failed: ${step.name}`, error)
        errors.set(step.name, error instanceof Error ? error : new Error(String(error)))

        if (this.options.stopOnError) {
          console.log(`[MCPTransaction] Stopping execution due to error`)

          if (this.options.rollbackOnError) {
            rolledBack = await this.rollback()
          }

          break
        }
      }
    }

    const success = errors.size === 0

    if (!success && this.options.rollbackOnError && !rolledBack) {
      rolledBack = await this.rollback()
    }

    console.log(`[MCPTransaction] Transaction completed. Success: ${success}, Rolled back: ${rolledBack}`)

    return {
      success,
      results,
      errors,
      rolledBack
    }
  }
  /**
   * Execute a step with retry logic
   */
  private async executeStepWithRetry<T>(step: TransactionStep<T>): Promise<T> {
    const maxRetries = step.maxRetries ?? this.options.maxRetries ?? 0
    const shouldRetry = step.retryable ?? false

    let lastError: Error | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[MCPTransaction] Retrying step ${step.name} (attempt ${attempt + 1}/${maxRetries + 1})`)
          await this.delay(this.options.retryDelay ?? 100)
        }

        return await step.execute()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        if (!shouldRetry || attempt === maxRetries) {
          throw lastError
        }
      }
    }

    throw lastError || new Error('Step execution failed')
  }

  /**
   * Rollback completed steps
   */
  private async rollback(): Promise<boolean> {
    if (this.completedSteps.length === 0) {
      return false
    }

    console.log(`[MCPTransaction] Starting rollback of ${this.completedSteps.length} completed steps`)

    // Rollback in reverse order
    const stepsToRollback = [...this.completedSteps].reverse()
    let rollbackErrors = 0

    for (const { step, result } of stepsToRollback) {
      if (!step.rollback) {
        console.log(`[MCPTransaction] No rollback defined for step: ${step.name}`)
        continue
      }
      try {
        console.log(`[MCPTransaction] Rolling back step: ${step.name}`)
        await step.rollback(result)
        console.log(`[MCPTransaction] Successfully rolled back: ${step.name}`)
      } catch (error) {
        console.error(`[MCPTransaction] Failed to rollback step ${step.name}:`, error)
        rollbackErrors++
      }
    }
    if (rollbackErrors > 0) {
      console.error(`[MCPTransaction] Rollback completed with ${rollbackErrors} errors`)
    } else {
      console.log(`[MCPTransaction] Rollback completed successfully`)
    }

    return true
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

/**
 * Create and execute a transaction
 */
export async function executeTransaction<T = any>(
  steps: TransactionStep[],
  options?: TransactionOptions
): Promise<TransactionResult<T>> {
  const transaction = new MCPTransaction(options)

  for (const step of steps) {
    transaction.addStep(step)
  }

  return transaction.execute()
}

/**
 * Helper to create a transaction step
 */
export function createTransactionStep<T>(
  name: string,
  execute: () => Promise<T>,
  rollback?: (result: T) => Promise<void>,
  options?: { retryable?: boolean; maxRetries?: number }
): TransactionStep<T> {
  return {
    name,
    execute,
    rollback,
    retryable: options?.retryable,
    maxRetries: options?.maxRetries
  }
}

/**
 * Example transaction for file creation with proper rollback
 */
export function createFileCreationTransaction(projectId: number, filePath: string, content: string): TransactionStep[] {
  let fileId: number | null = null

  return [
    {
      name: 'validate-path',
      execute: async () => {
        // Validate path doesn't contain .. or absolute paths
        if (filePath.includes('..') || filePath.startsWith('/')) {
          throw createMCPError(MCPErrorCode.PATH_TRAVERSAL_DENIED, 'Invalid file path', {
            parameter: 'filePath',
            value: filePath
          })
        }
        return true
      }
    },
    {
      name: 'create-file-record',
      execute: async () => {
        // This would create the file record in the database
        // For now, returning a mock ID
        fileId = Date.now()
        return fileId
      },
      rollback: async (createdFileId: number) => {
        // Remove the file record if it was created
        console.log(`Rolling back file record creation for ID: ${createdFileId}`)
        // Implementation would delete the record
      }
    },
    {
      name: 'write-file-content',
      execute: async () => {
        if (!fileId) throw new Error('File ID not set')
        // Write the actual file content
        return { fileId, path: filePath, content }
      },
      rollback: async (fileInfo: any) => {
        // Delete the physical file if it was written
        console.log(`Rolling back file write for: ${fileInfo.path}`)
        // Implementation would delete the file
      },
      retryable: true,
      maxRetries: 2
    },
    {
      name: 'sync-project',
      execute: async () => {
        // Sync the project to update file listings
        return { projectId, synced: true }
      },
      retryable: true,
      maxRetries: 3
    }
  ]
}
