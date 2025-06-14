import { ApiError } from '@octoprompt/shared'

export interface BulkOperationResult<T> {
  succeeded: T[]
  failed: Array<{
    item: any
    error: Error
  }>
}

/**
 * Execute a bulk operation with error handling for individual items
 */
export async function bulkOperation<TInput, TResult>(
  items: TInput[],
  operation: (item: TInput) => Promise<TResult>,
  options?: {
    onError?: (item: TInput, error: unknown) => void
    continueOnError?: boolean
    concurrency?: number
  }
): Promise<BulkOperationResult<TResult>> {
  const { onError, continueOnError = true, concurrency = 1 } = options || {}

  const succeeded: TResult[] = []
  const failed: Array<{ item: TInput; error: Error }> = []

  // Process items with concurrency control
  const processItem = async (item: TInput): Promise<void> => {
    try {
      const result = await operation(item)
      succeeded.push(result)
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error))
      failed.push({ item, error: errorObj })

      if (onError) {
        onError(item, error)
      } else {
        console.error('Bulk operation failed for item:', item, error)
      }

      if (!continueOnError) {
        throw error
      }
    }
  }

  if (concurrency === 1) {
    // Sequential processing
    for (const item of items) {
      await processItem(item)
    }
  } else {
    // Concurrent processing with limit
    const chunks: TInput[][] = []
    for (let i = 0; i < items.length; i += concurrency) {
      chunks.push(items.slice(i, i + concurrency))
    }

    for (const chunk of chunks) {
      await Promise.all(chunk.map(processItem))
    }
  }

  return { succeeded, failed }
}

/**
 * Bulk create with validation and error handling
 */
export async function bulkCreate<TInput, TResult>(
  items: TInput[],
  createFn: (item: TInput) => Promise<TResult>,
  options?: {
    validateDuplicates?: (item: TInput) => Promise<boolean>
    onDuplicate?: (item: TInput) => void
    continueOnError?: boolean
  }
): Promise<BulkOperationResult<TResult>> {
  const itemsToCreate: TInput[] = []

  // Check for duplicates if validator provided
  if (options?.validateDuplicates) {
    for (const item of items) {
      const isDuplicate = await options.validateDuplicates(item)
      if (isDuplicate) {
        if (options.onDuplicate) {
          options.onDuplicate(item)
        }
        console.warn('Skipping duplicate item in bulk create:', item)
      } else {
        itemsToCreate.push(item)
      }
    }
  } else {
    itemsToCreate.push(...items)
  }

  return bulkOperation(itemsToCreate, createFn, {
    continueOnError: options?.continueOnError ?? true
  })
}

/**
 * Bulk update with error handling
 */
export async function bulkUpdate<TId, TUpdate, TResult>(
  updates: Array<{ id: TId; data: TUpdate }>,
  updateFn: (id: TId, data: TUpdate) => Promise<TResult>,
  options?: {
    validateExists?: (id: TId) => Promise<boolean>
    continueOnError?: boolean
  }
): Promise<BulkOperationResult<TResult>> {
  const operation = async (update: { id: TId; data: TUpdate }) => {
    if (options?.validateExists) {
      const exists = await options.validateExists(update.id)
      if (!exists) {
        throw new Error(`Entity with ID ${update.id} not found`)
      }
    }
    return updateFn(update.id, update.data)
  }

  return bulkOperation(updates, operation, {
    continueOnError: options?.continueOnError ?? true
  })
}

/**
 * Bulk delete with validation
 */
export async function bulkDelete<TId>(
  ids: TId[],
  deleteFn: (id: TId) => Promise<boolean>,
  options?: {
    validateExists?: (id: TId) => Promise<boolean>
    continueOnError?: boolean
  }
): Promise<{ deletedCount: number; failed: TId[] }> {
  let deletedCount = 0
  const failed: TId[] = []

  for (const id of ids) {
    try {
      if (options?.validateExists) {
        const exists = await options.validateExists(id)
        if (!exists) {
          console.warn(`Entity with ID ${id} not found during bulk delete`)
          failed.push(id)
          continue
        }
      }

      const deleted = await deleteFn(id)
      if (deleted) {
        deletedCount++
      } else {
        failed.push(id)
      }
    } catch (error) {
      console.error(`Failed to delete entity with ID ${id}:`, error)
      failed.push(id)

      if (!options?.continueOnError) {
        throw error
      }
    }
  }

  return { deletedCount, failed }
}

/**
 * Process items in batches
 */
export async function processBatch<T, R>(
  items: T[],
  batchSize: number,
  processor: (batch: T[]) => Promise<R[]>
): Promise<R[]> {
  const results: R[] = []

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchResults = await processor(batch)
    results.push(...batchResults)
  }

  return results
}

/**
 * Retry an operation with exponential backoff
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number
    initialDelay?: number
    maxDelay?: number
    backoffFactor?: number
    shouldRetry?: (error: unknown) => boolean
  } = {}
): Promise<T> {
  const { maxRetries = 3, initialDelay = 1000, maxDelay = 10000, backoffFactor = 2, shouldRetry = () => true } = options

  let lastError: unknown
  let delay = initialDelay

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error

      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error
      }

      console.warn(`Operation failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`)
      await new Promise((resolve) => setTimeout(resolve, delay))

      delay = Math.min(delay * backoffFactor, maxDelay)
    }
  }

  throw lastError
}
