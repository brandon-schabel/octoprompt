import { DatabaseManager } from '@promptliano/storage'
import type { Database } from 'bun:sqlite'
import {
  type Job,
  type CreateJob,
  type JobFilter,
  type JobProgress,
  type JobError,
  type JobStatus,
  type JobEvent,
  jobSchema,
  createJobSchema
} from '@promptliano/schemas'
import { EventEmitter } from 'node:events'

// Job handler types
export interface JobHandler<TInput = any, TOutput = any> {
  type: string
  name: string
  description?: string
  execute: (job: Job, context: JobContext) => Promise<TOutput>
  validate?: (input: TInput) => boolean
  onCancel?: (job: Job) => Promise<void>
  timeout?: number
  maxRetries?: number
}

export interface JobContext {
  job: Job
  updateProgress: (progress: Partial<JobProgress>) => Promise<void>
  checkCancelled: () => Promise<boolean>
  log: (message: string) => void
}

// Job queue service
export class JobQueueService extends EventEmitter {
  private db: Database
  private handlers = new Map<string, JobHandler>()
  private activeJobs = new Map<number, AbortController>()
  private processing = false
  private processInterval: Timer | null = null

  constructor() {
    super()
    this.db = DatabaseManager.getInstance().getDatabase()
  }

  // Handler registration
  registerHandler(handler: JobHandler): void {
    if (this.handlers.has(handler.type)) {
      throw new Error(`Handler for job type "${handler.type}" already registered`)
    }
    this.handlers.set(handler.type, handler)
    console.log(`[JobQueue] Registered handler for type: ${handler.type}`)
  }

  unregisterHandler(type: string): void {
    this.handlers.delete(type)
    console.log(`[JobQueue] Unregistered handler for type: ${type}`)
  }

  // Job creation
  async createJob(data: CreateJob): Promise<Job> {
    const validated = createJobSchema.parse(data)

    // Check if handler exists
    const handler = this.handlers.get(validated.type)
    if (!handler) {
      throw new Error(`No handler registered for job type: ${validated.type}`)
    }

    // Validate input if handler has validation
    if (handler.validate && !handler.validate(validated.input)) {
      throw new Error(`Invalid input for job type: ${validated.type}`)
    }

    const now = Date.now()
    const job: Omit<Job, 'id'> = {
      type: validated.type,
      status: 'pending',
      priority: validated.options?.priority || 'normal',
      projectId: validated.projectId,
      input: validated.input,
      metadata: validated.metadata,
      created: now,
      updated: now
    }

    // Insert into database
    const stmt = this.db.prepare(`
      INSERT INTO jobs (
        type, status, priority, project_id, input, metadata,
        created_at, updated_at, timeout_ms, max_retries
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const result = stmt.run(
      job.type,
      job.status,
      job.priority,
      job.projectId || null,
      JSON.stringify(job.input),
      job.metadata ? JSON.stringify(job.metadata) : null,
      job.created,
      job.updated,
      validated.options?.timeout || handler.timeout || null,
      validated.options?.maxRetries || handler.maxRetries || 0
    )

    const createdJob: Job = {
      ...job,
      id: result.lastInsertRowid as number
    }

    // Emit creation event
    this.emitJobEvent('job.created', createdJob)

    return createdJob
  }

  // Job retrieval
  async getJob(jobId: number): Promise<Job | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM jobs WHERE id = ?
    `)
    const row = stmt.get(jobId) as any

    if (!row) return null

    return this.rowToJob(row)
  }

  async getJobs(filter: JobFilter = {}): Promise<Job[]> {
    let query = 'SELECT * FROM jobs WHERE 1=1'
    const params: any[] = []

    if (filter.projectId) {
      query += ' AND project_id = ?'
      params.push(filter.projectId)
    }

    if (filter.type) {
      query += ' AND type = ?'
      params.push(filter.type)
    }

    if (filter.status && filter.status.length > 0) {
      const placeholders = filter.status.map(() => '?').join(', ')
      query += ` AND status IN (${placeholders})`
      params.push(...filter.status)
    }

    if (filter.priority && filter.priority.length > 0) {
      const placeholders = filter.priority.map(() => '?').join(', ')
      query += ` AND priority IN (${placeholders})`
      params.push(...filter.priority)
    }

    if (filter.createdAfter) {
      query += ' AND created_at >= ?'
      params.push(filter.createdAfter)
    }

    if (filter.createdBefore) {
      query += ' AND created_at <= ?'
      params.push(filter.createdBefore)
    }

    query += ' ORDER BY created_at DESC'

    if (filter.limit) {
      query += ' LIMIT ?'
      params.push(filter.limit)

      if (filter.offset) {
        query += ' OFFSET ?'
        params.push(filter.offset)
      }
    }

    const stmt = this.db.prepare(query)
    const rows = stmt.all(...params) as any[]

    return rows.map((row) => this.rowToJob(row))
  }

  // Job cancellation
  async cancelJob(jobId: number): Promise<boolean> {
    const job = await this.getJob(jobId)
    if (!job) return false

    if (job.status !== 'pending' && job.status !== 'running') {
      return false // Can't cancel completed/failed/cancelled jobs
    }

    // Cancel active execution if running
    const controller = this.activeJobs.get(jobId)
    if (controller) {
      controller.abort()
      this.activeJobs.delete(jobId)
    }

    // Update job status
    await this.updateJobStatus(jobId, 'cancelled')

    // Call handler's onCancel if available
    const handler = this.handlers.get(job.type)
    if (handler?.onCancel) {
      try {
        await handler.onCancel(job)
      } catch (error) {
        console.error(`[JobQueue] Error in onCancel for job ${jobId}:`, error)
      }
    }

    return true
  }

  // Start processing jobs
  startProcessing(intervalMs: number = 1000): void {
    if (this.processing) return

    this.processing = true
    this.processInterval = setInterval(() => {
      this.processNextJob().catch((error) => {
        console.error('[JobQueue] Error processing jobs:', error)
      })
    }, intervalMs)

    console.log('[JobQueue] Started job processing')
  }

  // Stop processing jobs
  stopProcessing(): void {
    if (!this.processing) return

    this.processing = false
    if (this.processInterval) {
      clearInterval(this.processInterval)
      this.processInterval = null
    }

    // Cancel all active jobs
    for (const [jobId, controller] of this.activeJobs) {
      controller.abort()
    }
    this.activeJobs.clear()

    console.log('[JobQueue] Stopped job processing')
  }

  // Process next job in queue
  private async processNextJob(): Promise<void> {
    if (!this.processing) return

    // Get next pending job
    const stmt = this.db.prepare(`
      SELECT * FROM jobs 
      WHERE status = 'pending'
      ORDER BY 
        CASE priority 
          WHEN 'high' THEN 1 
          WHEN 'normal' THEN 2 
          WHEN 'low' THEN 3 
        END,
        created_at
      LIMIT 1
    `)

    const row = stmt.get() as any
    if (!row) return // No pending jobs

    const job = this.rowToJob(row)
    const handler = this.handlers.get(job.type)

    if (!handler) {
      console.error(`[JobQueue] No handler for job type: ${job.type}`)
      await this.failJob(job.id, {
        message: `No handler registered for job type: ${job.type}`,
        code: 'NO_HANDLER'
      })
      return
    }

    // Start processing
    await this.executeJob(job, handler)
  }

  // Execute a job
  private async executeJob(job: Job, handler: JobHandler): Promise<void> {
    const controller = new AbortController()
    this.activeJobs.set(job.id, controller)

    try {
      // Update status to running
      await this.updateJobStatus(job.id, 'running')

      // Create context
      const context: JobContext = {
        job,
        updateProgress: async (progress) => {
          await this.updateJobProgress(job.id, progress)
        },
        checkCancelled: async () => {
          return controller.signal.aborted
        },
        log: (message) => {
          console.log(`[Job ${job.id}] ${message}`)
        }
      }

      // Set timeout if specified
      const timeoutMs = job.metadata?.timeout || handler.timeout || 600000 // 10 min default
      const timeoutId = setTimeout(() => {
        controller.abort()
      }, timeoutMs)

      try {
        // Execute handler
        const result = await handler.execute(job, context)

        // Clear timeout
        clearTimeout(timeoutId)

        // Check if was cancelled
        if (controller.signal.aborted) {
          await this.updateJobStatus(job.id, 'cancelled')
        } else {
          // Success
          await this.completeJob(job.id, result)
        }
      } catch (error) {
        clearTimeout(timeoutId)

        if (controller.signal.aborted) {
          await this.updateJobStatus(job.id, 'cancelled')
        } else {
          // Handle retry logic
          const maxRetries = job.metadata?.maxRetries || handler.maxRetries || 0
          
          // Get current retry count from database
          const retryStmt = this.db.prepare('SELECT retry_count FROM jobs WHERE id = ?')
          const retryRow = retryStmt.get(job.id) as any
          const retryCount = retryRow?.retry_count || 0

          if (retryCount < maxRetries) {
            // Retry
            await this.retryJob(job.id, retryCount + 1)
          } else {
            // Fail
            await this.failJob(job.id, {
              message: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined
            })
          }
        }
      }
    } finally {
      this.activeJobs.delete(job.id)
    }
  }

  // Update job status
  private async updateJobStatus(jobId: number, status: JobStatus): Promise<void> {
    const now = Date.now()
    const stmt = this.db.prepare(`
      UPDATE jobs 
      SET status = ?, updated_at = ?, started_at = CASE WHEN ? = 'running' AND started_at IS NULL THEN ? ELSE started_at END
      WHERE id = ?
    `)
    stmt.run(status, now, status, now, jobId)

    const job = await this.getJob(jobId)
    if (job) {
      this.emitJobEvent(
        status === 'running' ? 'job.started' : status === 'cancelled' ? 'job.cancelled' : 'job.progress',
        job
      )
    }
  }

  // Update job progress
  private async updateJobProgress(jobId: number, progress: Partial<JobProgress>): Promise<void> {
    const job = await this.getJob(jobId)
    if (!job) return

    const updatedProgress = {
      ...job.progress,
      ...progress,
      percentage: progress.total ? Math.round(((progress.current || 0) / progress.total) * 100) : undefined
    }

    const stmt = this.db.prepare(`
      UPDATE jobs 
      SET progress = ?, updated_at = ?
      WHERE id = ?
    `)
    stmt.run(JSON.stringify(updatedProgress), Date.now(), jobId)

    const updatedJob = await this.getJob(jobId)
    if (updatedJob) {
      this.emitJobEvent('job.progress', updatedJob)
    }
  }

  // Complete job
  private async completeJob(jobId: number, result: any): Promise<void> {
    const now = Date.now()
    const stmt = this.db.prepare(`
      UPDATE jobs 
      SET status = 'completed', result = ?, completed_at = ?, updated_at = ?
      WHERE id = ?
    `)
    stmt.run(JSON.stringify(result), now, now, jobId)

    const job = await this.getJob(jobId)
    if (job) {
      this.emitJobEvent('job.completed', job)
    }
  }

  // Fail job
  private async failJob(jobId: number, error: JobError): Promise<void> {
    const now = Date.now()
    const stmt = this.db.prepare(`
      UPDATE jobs 
      SET status = 'failed', error = ?, completed_at = ?, updated_at = ?
      WHERE id = ?
    `)
    stmt.run(JSON.stringify(error), now, now, jobId)

    const job = await this.getJob(jobId)
    if (job) {
      this.emitJobEvent('job.failed', job)
    }
  }

  // Retry job
  private async retryJob(jobId: number, retryCount: number): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE jobs 
      SET status = 'pending', retry_count = ?, updated_at = ?
      WHERE id = ?
    `)
    stmt.run(retryCount, Date.now(), jobId)
  }

  // Helper to convert database row to Job
  private rowToJob(row: any): Job {
    return {
      id: row.id,
      type: row.type,
      status: row.status as JobStatus,
      priority: row.priority,
      projectId: row.project_id || undefined,
      userId: row.user_id || undefined,
      input: JSON.parse(row.input),
      result: row.result ? JSON.parse(row.result) : undefined,
      error: row.error ? JSON.parse(row.error) : undefined,
      progress: row.progress ? JSON.parse(row.progress) : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      created: row.created_at,
      started: row.started_at || undefined,
      completed: row.completed_at || undefined,
      updated: row.updated_at
    }
  }

  // Emit job event
  private emitJobEvent(type: JobEvent['type'], job: Job): void {
    const event: JobEvent = {
      type,
      jobId: job.id,
      job,
      timestamp: Date.now()
    }
    this.emit('job-event', event)
  }

  // Cleanup old jobs
  async cleanupOldJobs(olderThanDays: number = 30): Promise<number> {
    const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000

    // Archive to job_history first
    const archiveStmt = this.db.prepare(`
      INSERT INTO job_history 
      SELECT 
        id, type, status, priority, project_id, user_id,
        input, result, error, metadata,
        created_at, started_at, completed_at,
        CASE WHEN completed_at IS NOT NULL THEN completed_at - started_at ELSE NULL END as duration_ms,
        ? as archived_at
      FROM jobs 
      WHERE status IN ('completed', 'failed', 'cancelled') 
      AND completed_at < ?
    `)

    const deleteStmt = this.db.prepare(`
      DELETE FROM jobs 
      WHERE status IN ('completed', 'failed', 'cancelled') 
      AND completed_at < ?
    `)

    const transaction = this.db.transaction(() => {
      archiveStmt.run(Date.now(), cutoffTime)
      const result = deleteStmt.run(cutoffTime)
      return result.changes
    })

    const deletedCount = transaction()
    console.log(`[JobQueue] Cleaned up ${deletedCount} old jobs`)
    return deletedCount
  }
}

// Singleton instance
let jobQueueInstance: JobQueueService | null = null

export function getJobQueue(): JobQueueService {
  if (!jobQueueInstance) {
    jobQueueInstance = new JobQueueService()
  }
  return jobQueueInstance
}
