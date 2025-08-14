/**
 * Queue Timeout Recovery Service
 *
 * Automatically monitors and recovers timed-out queue items to prevent
 * items from being stuck indefinitely in the processing state.
 */

import { checkAndHandleTimeouts } from './queue-service'
import { listQueuesByProject } from './queue-service'
import { listProjects } from './project-service'
import { createLogger } from './utils/logger'

const logger = createLogger('QueueTimeoutService')

export class QueueTimeoutService {
  private intervalId: NodeJS.Timeout | null = null
  private checkInterval: number
  private isRunning: boolean = false
  private defaultTimeout: number

  constructor(
    options: {
      checkInterval?: number // How often to check for timeouts (ms)
      defaultTimeout?: number // Default timeout for items without explicit timeout (ms)
    } = {}
  ) {
    this.checkInterval = options.checkInterval || 30000 // Default: 30 seconds
    this.defaultTimeout = options.defaultTimeout || 300000 // Default: 5 minutes
  }

  /**
   * Start the timeout recovery service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Timeout service already running')
      return
    }

    logger.info('Starting queue timeout recovery service', {
      checkInterval: this.checkInterval,
      defaultTimeout: this.defaultTimeout
    })

    this.isRunning = true

    // Run immediately on start
    await this.checkAllQueues()

    // Then run periodically
    this.intervalId = setInterval(async () => {
      if (this.isRunning) {
        await this.checkAllQueues()
      }
    }, this.checkInterval)
  }

  /**
   * Stop the timeout recovery service
   */
  stop(): void {
    if (!this.isRunning) {
      logger.warn('Timeout service not running')
      return
    }

    logger.info('Stopping queue timeout recovery service')

    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    this.isRunning = false
  }

  /**
   * Check all queues for timed-out items
   */
  private async checkAllQueues(): Promise<void> {
    try {
      const startTime = Date.now()
      let totalTimedOut = 0
      let totalErrors = 0

      // Get all projects
      const projects = await listProjects()

      for (const project of projects) {
        try {
          // Get all active queues for this project
          const queues = await listQueuesByProject(project.id)
          const activeQueues = queues.filter((q) => q.status === 'active')

          for (const queue of activeQueues) {
            try {
              // Check and handle timeouts for this queue
              const result = await checkAndHandleTimeouts(queue.id)

              if (result.timedOut > 0) {
                logger.info(`Recovered ${result.timedOut} timed-out items in queue ${queue.name}`, {
                  queueId: queue.id,
                  projectId: project.id
                })
                totalTimedOut += result.timedOut
              }

              if (result.errors.length > 0) {
                logger.warn(`Failed to recover ${result.errors.length} items in queue ${queue.name}`, {
                  queueId: queue.id,
                  projectId: project.id
                })
                totalErrors += result.errors.length
              }
            } catch (error) {
              logger.error(`Error checking timeouts for queue ${queue.id}:`, error)
              totalErrors++
            }
          }
        } catch (error) {
          logger.error(`Error processing project ${project.id}:`, error)
        }
      }

      const duration = Date.now() - startTime

      if (totalTimedOut > 0 || totalErrors > 0) {
        logger.info('Timeout check completed', {
          duration,
          timedOut: totalTimedOut,
          errors: totalErrors
        })
      }
    } catch (error) {
      logger.error('Error during timeout check:', error)
    }
  }

  /**
   * Get service status
   */
  getStatus(): {
    isRunning: boolean
    checkInterval: number
    defaultTimeout: number
  } {
    return {
      isRunning: this.isRunning,
      checkInterval: this.checkInterval,
      defaultTimeout: this.defaultTimeout
    }
  }
}

// Singleton instance
let timeoutService: QueueTimeoutService | null = null

/**
 * Get or create the timeout service instance
 */
export function getQueueTimeoutService(options?: {
  checkInterval?: number
  defaultTimeout?: number
}): QueueTimeoutService {
  if (!timeoutService) {
    timeoutService = new QueueTimeoutService(options)
  }
  return timeoutService
}

/**
 * Start the global timeout service
 */
export async function startQueueTimeoutService(): Promise<void> {
  const service = getQueueTimeoutService()
  await service.start()
}

/**
 * Stop the global timeout service
 */
export function stopQueueTimeoutService(): void {
  const service = getQueueTimeoutService()
  service.stop()
}
