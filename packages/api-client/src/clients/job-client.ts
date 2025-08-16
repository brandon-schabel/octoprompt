import { BaseApiClient } from '../base-client'
import type { DataResponseSchema, ApiConfig } from '../base-client'

// Job types based on the previous migration schema
export interface Job {
  id: number
  type: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  priority: 'low' | 'normal' | 'high'
  projectId?: number
  userId?: string
  input: Record<string, any>
  result?: Record<string, any>
  error?: {
    message: string
    code?: string
    details?: any
  }
  progress?: {
    current: number
    total: number
    message?: string
  }
  metadata?: Record<string, any>
  createdAt: number
  startedAt?: number
  completedAt?: number
  updatedAt: number
  timeoutMs?: number
  maxRetries: number
  retryCount: number
  retryDelayMs: number
}

export interface JobHistory {
  id: number
  type: string
  status: string
  priority: string
  projectId?: number
  userId?: string
  input: Record<string, any>
  result?: Record<string, any>
  error?: Record<string, any>
  metadata?: Record<string, any>
  createdAt: number
  startedAt?: number
  completedAt?: number
  durationMs?: number
  archivedAt: number
}

export interface CreateJobRequest {
  type: string
  priority?: 'low' | 'normal' | 'high'
  projectId?: number
  userId?: string
  input: Record<string, any>
  metadata?: Record<string, any>
  timeoutMs?: number
  maxRetries?: number
  retryDelayMs?: number
}

export interface UpdateJobRequest {
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  result?: Record<string, any>
  error?: {
    message: string
    code?: string
    details?: any
  }
  progress?: {
    current: number
    total: number
    message?: string
  }
  metadata?: Record<string, any>
}

export interface ListJobsRequest {
  projectId?: number
  status?: Job['status'] | Job['status'][]
  type?: string | string[]
  priority?: Job['priority'] | Job['priority'][]
  limit?: number
  offset?: number
  sortBy?: 'createdAt' | 'startedAt' | 'completedAt' | 'priority'
  sortOrder?: 'asc' | 'desc'
  includeHistory?: boolean
}

export interface RetryJobRequest {
  resetRetryCount?: boolean
  newInput?: Record<string, any>
  newPriority?: Job['priority']
}

export interface CleanupJobsRequest {
  olderThanDays?: number
  status?: Job['status'][]
  type?: string[]
  projectId?: number
  dryRun?: boolean
}

export interface JobStats {
  total: number
  byStatus: Record<Job['status'], number>
  byType: Record<string, number>
  byPriority: Record<Job['priority'], number>
  avgDurationMs?: number
  oldestPendingJob?: {
    id: number
    createdAt: number
    ageMs: number
  }
}

/**
 * Client for Job Management API operations
 */
export class JobClient extends BaseApiClient {
  constructor(config: ApiConfig) {
    super(config)
  }

  /**
   * List jobs with filtering and pagination
   */
  async listJobs(params: ListJobsRequest = {}): Promise<DataResponseSchema<{
    jobs: Job[]
    total: number
    hasMore: boolean
  }>> {
    const searchParams = new URLSearchParams()
    
    if (params.projectId !== undefined) {
      searchParams.append('projectId', params.projectId.toString())
    }
    if (params.status) {
      const statuses = Array.isArray(params.status) ? params.status : [params.status]
      statuses.forEach(status => searchParams.append('status', status))
    }
    if (params.type) {
      const types = Array.isArray(params.type) ? params.type : [params.type]
      types.forEach(type => searchParams.append('type', type))
    }
    if (params.priority) {
      const priorities = Array.isArray(params.priority) ? params.priority : [params.priority]
      priorities.forEach(priority => searchParams.append('priority', priority))
    }
    if (params.limit) {
      searchParams.append('limit', params.limit.toString())
    }
    if (params.offset) {
      searchParams.append('offset', params.offset.toString())
    }
    if (params.sortBy) {
      searchParams.append('sortBy', params.sortBy)
    }
    if (params.sortOrder) {
      searchParams.append('sortOrder', params.sortOrder)
    }
    if (params.includeHistory) {
      searchParams.append('includeHistory', 'true')
    }

    return this.get(`/api/jobs?${searchParams.toString()}`)
  }

  /**
   * Get a specific job by ID
   */
  async getJob(jobId: number): Promise<DataResponseSchema<Job>> {
    return this.get(`/api/jobs/${jobId}`)
  }

  /**
   * Create a new job
   */
  async createJob(job: CreateJobRequest): Promise<DataResponseSchema<Job>> {
    return this.post('/jobs', job)
  }

  /**
   * Update an existing job
   */
  async updateJob(jobId: number, updates: UpdateJobRequest): Promise<DataResponseSchema<Job>> {
    return this.patch(`/api/jobs/${jobId}`, updates)
  }

  /**
   * Cancel a job (sets status to cancelled)
   */
  async cancelJob(jobId: number, reason?: string): Promise<DataResponseSchema<Job>> {
    return this.patch(`/api/jobs/${jobId}/cancel`, { reason })
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: number, options: RetryJobRequest = {}): Promise<DataResponseSchema<Job>> {
    return this.post(`/api/jobs/${jobId}/retry`, options)
  }

  /**
   * Delete a job (hard delete)
   */
  async deleteJob(jobId: number): Promise<void> {
    await this.delete(`/api/jobs/${jobId}`)
  }

  /**
   * Get job statistics
   */
  async getJobStats(projectId?: number): Promise<DataResponseSchema<JobStats>> {
    const params = projectId ? `?projectId=${projectId}` : ''
    return this.get(`/api/jobs/stats${params}`)
  }

  /**
   * Cleanup old jobs (archive or delete)
   */
  async cleanupJobs(options: CleanupJobsRequest = {}): Promise<DataResponseSchema<{
    cleaned: number
    archived: number
    deleted: number
    preview?: Job[]
  }>> {
    return this.post('/jobs/cleanup', options)
  }

  /**
   * Get job history for a specific job
   */
  async getJobHistory(jobId: number): Promise<DataResponseSchema<JobHistory[]>> {
    return this.get(`/jobs/${jobId}/history`)
  }

  /**
   * Get jobs by project
   */
  async getProjectJobs(projectId: number, params: Omit<ListJobsRequest, 'projectId'> = {}): Promise<DataResponseSchema<{
    jobs: Job[]
    total: number
    hasMore: boolean
  }>> {
    return this.listJobs({ ...params, projectId })
  }

  /**
   * Bulk cancel jobs by criteria
   */
  async bulkCancelJobs(criteria: {
    projectId?: number
    status?: Job['status'][]
    type?: string[]
    olderThan?: number // timestamp
  }): Promise<DataResponseSchema<{
    cancelled: number
    jobs: Job[]
  }>> {
    return this.post('/jobs/bulk-cancel', criteria)
  }

  /**
   * Get next pending job for processing (for job workers)
   */
  async getNextJob(types?: string[], workerId?: string): Promise<DataResponseSchema<Job | null>> {
    const params = new URLSearchParams()
    if (types?.length) {
      types.forEach(type => params.append('type', type))
    }
    if (workerId) {
      params.append('workerId', workerId)
    }
    
    const query = params.toString()
    return this.get(`/api/jobs/next${query ? `?${query}` : ''}`)
  }

  /**
   * Mark job as started (for job workers)
   */
  async startJob(jobId: number, workerId?: string): Promise<DataResponseSchema<Job>> {
    return this.patch(`/api/jobs/${jobId}/start`, { workerId })
  }

  /**
   * Mark job as completed (for job workers)
   */
  async completeJob(jobId: number, result: Record<string, any>): Promise<DataResponseSchema<Job>> {
    return this.patch(`/api/jobs/${jobId}/complete`, { result })
  }

  /**
   * Mark job as failed (for job workers)
   */
  async failJob(jobId: number, error: {
    message: string
    code?: string
    details?: any
  }): Promise<DataResponseSchema<Job>> {
    return this.patch(`/api/jobs/${jobId}/fail`, { error })
  }

  /**
   * Update job progress (for job workers)
   */
  async updateJobProgress(jobId: number, progress: {
    current: number
    total: number
    message?: string
  }): Promise<DataResponseSchema<Job>> {
    return this.patch(`/api/jobs/${jobId}/progress`, { progress })
  }
}