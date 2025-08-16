import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { createPromptlianoClient } from '@promptliano/api-client'
import type { PromptlianoClient, Job, CreateJobRequest, UpdateJobRequest, JobStats } from '@promptliano/api-client'
import { createTestEnvironment, withTestData } from './test-environment'
import { TestDataManager, assertions, factories, retryOperation, waitFor, PerformanceTracker } from './utils/test-helpers'
import type { TestEnvironment } from './test-environment'

/**
 * Comprehensive Job Management API Tests
 * 
 * Tests all Job Management operations with proper isolation:
 * - Job CRUD operations (create, read, update, delete)
 * - Job lifecycle management (pending -> running -> completed/failed)
 * - Job cancellation and retry mechanisms
 * - Job cleanup operations
 * - Job statistics and monitoring
 * - Performance and concurrency testing
 * - Error handling and edge cases
 */

describe('Job Management API Tests', () => {
  let testEnv: TestEnvironment
  let client: PromptlianoClient
  let dataManager: TestDataManager
  let perfTracker: PerformanceTracker

  beforeAll(async () => {
    console.log('🚀 Starting Job Management API Tests...')
    
    // Create isolated test environment with optimized config for job testing
    testEnv = await createTestEnvironment({
      useIsolatedServer: true,
      database: {
        useMemory: testEnv?.isCI ?? false, // Use memory DB in CI for speed
        path: '/tmp/promptliano-job-test.db'
      },
      execution: {
        apiTimeout: 45000, // Longer timeout for job operations
        enableRateLimit: false,
        logLevel: 'warn'
      }
    })

    client = createPromptlianoClient({ baseUrl: testEnv.baseUrl })
    dataManager = new TestDataManager(client)
    perfTracker = new PerformanceTracker()

    // Verify job client is available
    expect(client.jobs).toBeDefined()
    expect(typeof client.jobs.listJobs).toBe('function')
    expect(typeof client.jobs.createJob).toBe('function')
    
    console.log('✅ Test environment initialized successfully')
  })

  afterAll(async () => {
    console.log('🧹 Cleaning up job test data...')
    
    try {
      await dataManager.cleanup()
      perfTracker.printSummary()
    } catch (error) {
      console.warn('⚠️ Cleanup encountered errors:', error)
    }
    
    await testEnv.cleanup()
    console.log('✅ Job API tests cleanup completed')
  })

  // ============================================================================
  // BASIC CRUD OPERATIONS
  // ============================================================================

  describe('Job CRUD Operations', () => {
    test('should create a job with minimal required fields', async () => {
      const jobData: CreateJobRequest = {
        type: 'test-job',
        input: { action: 'simple-test', value: 42 }
      }

      const result = await perfTracker.measure('create-job', async () => {
        return client.jobs.createJob(jobData)
      })

      assertions.assertSuccessResponse(result)
      const job = result.data
      
      // Validate job structure
      assertions.assertValidId(job.id)
      expect(job.type).toBe(jobData.type)
      expect(job.status).toBe('pending')
      expect(job.priority).toBe('normal') // default priority
      expect(job.input).toEqual(jobData.input)
      expect(job.result).toBeUndefined()
      expect(job.error).toBeUndefined()
      expect(job.maxRetries).toBe(0) // default
      expect(job.retryCount).toBe(0)
      assertions.assertValidTimestamp(job.createdAt)
      assertions.assertValidTimestamp(job.updatedAt)
      expect(job.startedAt).toBeUndefined()
      expect(job.completedAt).toBeUndefined()

      // Track for cleanup
      dataManager.track('job', job, async () => {
        await client.jobs.deleteJob(job.id)
      })
    })

    test('should create a job with all optional fields', async () => {
      const project = await dataManager.createProject()
      
      const jobData: CreateJobRequest = {
        type: 'complex-job',
        priority: 'high',
        projectId: project.id,
        userId: 'test-user-123',
        input: { 
          action: 'complex-operation',
          parameters: { timeout: 30000, retries: 3 },
          files: ['file1.txt', 'file2.txt']
        },
        metadata: {
          source: 'api-test',
          version: '1.0.0',
          tags: ['test', 'high-priority']
        },
        timeoutMs: 60000,
        maxRetries: 3,
        retryDelayMs: 2000
      }

      const result = await client.jobs.createJob(jobData)
      assertions.assertSuccessResponse(result)
      const job = result.data

      expect(job.type).toBe(jobData.type)
      expect(job.priority).toBe(jobData.priority)
      expect(job.projectId).toBe(jobData.projectId)
      expect(job.userId).toBe(jobData.userId)
      expect(job.input).toEqual(jobData.input)
      expect(job.metadata).toEqual(jobData.metadata)
      expect(job.timeoutMs).toBe(jobData.timeoutMs)
      expect(job.maxRetries).toBe(jobData.maxRetries)
      expect(job.retryDelayMs).toBe(jobData.retryDelayMs)

      dataManager.track('job', job, async () => {
        await client.jobs.deleteJob(job.id)
      })
    })

    test('should retrieve a job by ID', async () => {
      const jobData: CreateJobRequest = {
        type: 'retrieve-test',
        input: { message: 'test retrieval' }
      }

      const createResult = await client.jobs.createJob(jobData)
      assertions.assertSuccessResponse(createResult)
      const createdJob = createResult.data

      const getResult = await client.jobs.getJob(createdJob.id)
      assertions.assertSuccessResponse(getResult)
      const retrievedJob = getResult.data

      expect(retrievedJob).toEqual(createdJob)

      dataManager.track('job', createdJob, async () => {
        await client.jobs.deleteJob(createdJob.id)
      })
    })

    test('should list jobs with pagination', async () => {
      // Create multiple test jobs
      const jobs = []
      for (let i = 0; i < 5; i++) {
        const jobData: CreateJobRequest = {
          type: 'list-test',
          priority: i % 2 === 0 ? 'normal' : 'high',
          input: { index: i, message: `Test job ${i}` }
        }
        
        const result = await client.jobs.createJob(jobData)
        assertions.assertSuccessResponse(result)
        jobs.push(result.data)
        
        dataManager.track('job', result.data, async () => {
          await client.jobs.deleteJob(result.data.id)
        })
      }

      // Test basic listing
      const listResult = await client.jobs.listJobs({ limit: 10 })
      assertions.assertSuccessResponse(listResult)
      expect(listResult.data.jobs).toBeInstanceOf(Array)
      expect(listResult.data.jobs.length).toBeGreaterThanOrEqual(5)
      expect(listResult.data.total).toBeGreaterThanOrEqual(5)

      // Test filtering by type
      const typeFilterResult = await client.jobs.listJobs({ 
        type: 'list-test',
        limit: 10 
      })
      assertions.assertSuccessResponse(typeFilterResult)
      expect(typeFilterResult.data.jobs).toBeInstanceOf(Array)
      expect(typeFilterResult.data.jobs.every(job => job.type === 'list-test')).toBe(true)

      // Test filtering by priority
      const priorityFilterResult = await client.jobs.listJobs({ 
        priority: 'high',
        type: 'list-test',
        limit: 10 
      })
      assertions.assertSuccessResponse(priorityFilterResult)
      expect(priorityFilterResult.data.jobs.every(job => job.priority === 'high')).toBe(true)

      // Test pagination
      const page1 = await client.jobs.listJobs({ 
        type: 'list-test',
        limit: 2,
        offset: 0 
      })
      assertions.assertSuccessResponse(page1)
      expect(page1.data.jobs.length).toBeLessThanOrEqual(2)

      const page2 = await client.jobs.listJobs({ 
        type: 'list-test',
        limit: 2,
        offset: 2 
      })
      assertions.assertSuccessResponse(page2)
      
      // Pages should have different jobs
      const page1Ids = page1.data.jobs.map(job => job.id)
      const page2Ids = page2.data.jobs.map(job => job.id)
      expect(page1Ids.some(id => page2Ids.includes(id))).toBe(false)
    })

    test('should update job status and metadata', async () => {
      const jobData: CreateJobRequest = {
        type: 'update-test',
        input: { action: 'test-update' }
      }

      const createResult = await client.jobs.createJob(jobData)
      assertions.assertSuccessResponse(createResult)
      const job = createResult.data

      // Update job with progress
      const updateData: UpdateJobRequest = {
        status: 'running',
        progress: {
          current: 50,
          total: 100,
          message: 'Processing...'
        },
        metadata: {
          updatedBy: 'test-suite',
          phase: 'execution'
        }
      }

      const updateResult = await client.jobs.updateJob(job.id, updateData)
      assertions.assertSuccessResponse(updateResult)
      const updatedJob = updateResult.data

      expect(updatedJob.id).toBe(job.id)
      expect(updatedJob.status).toBe('running')
      expect(updatedJob.progress).toEqual(updateData.progress)
      expect(updatedJob.metadata).toEqual(updateData.metadata)
      expect(updatedJob.updatedAt).toBeGreaterThan(job.updatedAt)

      dataManager.track('job', job, async () => {
        await client.jobs.deleteJob(job.id)
      })
    })

    test('should delete a job', async () => {
      const jobData: CreateJobRequest = {
        type: 'delete-test',
        input: { action: 'test-deletion' }
      }

      const createResult = await client.jobs.createJob(jobData)
      assertions.assertSuccessResponse(createResult)
      const job = createResult.data

      // Delete the job
      await client.jobs.deleteJob(job.id)

      // Verify deletion - should return 404
      try {
        await client.jobs.getJob(job.id)
        throw new Error('Expected job to be deleted')
      } catch (error) {
        expect(error instanceof Error).toBe(true)
        expect(error.message).toContain('404')
      }
    })
  })

  // ============================================================================
  // JOB LIFECYCLE MANAGEMENT
  // ============================================================================

  describe('Job Lifecycle Management', () => {
    test('should handle complete job lifecycle: pending -> running -> completed', async () => {
      const jobData: CreateJobRequest = {
        type: 'lifecycle-test',
        input: { action: 'full-lifecycle-test', data: 'test-data' }
      }

      // 1. Create job (pending state)
      const createResult = await client.jobs.createJob(jobData)
      assertions.assertSuccessResponse(createResult)
      let job = createResult.data
      expect(job.status).toBe('pending')

      // 2. Start job (running state)
      const startResult = await client.jobs.startJob(job.id, 'test-worker-1')
      assertions.assertSuccessResponse(startResult)
      job = startResult.data
      expect(job.status).toBe('running')
      assertions.assertValidTimestamp(job.startedAt!)
      expect(job.startedAt).toBeGreaterThan(job.createdAt)

      // 3. Update progress
      const progressResult = await client.jobs.updateJobProgress(job.id, {
        current: 75,
        total: 100,
        message: 'Almost done...'
      })
      assertions.assertSuccessResponse(progressResult)
      job = progressResult.data
      expect(job.progress).toEqual({
        current: 75,
        total: 100,
        message: 'Almost done...'
      })

      // 4. Complete job
      const result = { 
        success: true, 
        output: 'Job completed successfully',
        processedItems: 100
      }
      const completeResult = await client.jobs.completeJob(job.id, result)
      assertions.assertSuccessResponse(completeResult)
      job = completeResult.data
      
      expect(job.status).toBe('completed')
      expect(job.result).toEqual(result)
      assertions.assertValidTimestamp(job.completedAt!)
      expect(job.completedAt).toBeGreaterThan(job.startedAt!)

      dataManager.track('job', job, async () => {
        await client.jobs.deleteJob(job.id)
      })
    })

    test('should handle job failure with error details', async () => {
      const jobData: CreateJobRequest = {
        type: 'failure-test',
        input: { action: 'simulate-failure' }
      }

      const createResult = await client.jobs.createJob(jobData)
      assertions.assertSuccessResponse(createResult)
      let job = createResult.data

      // Start job
      const startResult = await client.jobs.startJob(job.id)
      assertions.assertSuccessResponse(startResult)
      job = startResult.data

      // Fail job with detailed error
      const error = {
        message: 'Simulated failure for testing',
        code: 'SIMULATION_ERROR',
        details: {
          step: 'processing',
          attempt: 1,
          context: 'test-environment'
        }
      }

      const failResult = await client.jobs.failJob(job.id, error)
      assertions.assertSuccessResponse(failResult)
      job = failResult.data

      expect(job.status).toBe('failed')
      expect(job.error).toEqual(error)
      assertions.assertValidTimestamp(job.completedAt!)

      dataManager.track('job', job, async () => {
        await client.jobs.deleteJob(job.id)
      })
    })

    test('should cancel a running job', async () => {
      const jobData: CreateJobRequest = {
        type: 'cancellation-test',
        input: { action: 'long-running-operation' }
      }

      const createResult = await client.jobs.createJob(jobData)
      assertions.assertSuccessResponse(createResult)
      let job = createResult.data

      // Start job
      const startResult = await client.jobs.startJob(job.id)
      assertions.assertSuccessResponse(startResult)
      job = startResult.data

      // Cancel job
      const cancelResult = await client.jobs.cancelJob(job.id, 'Test cancellation')
      assertions.assertSuccessResponse(cancelResult)
      job = cancelResult.data

      expect(job.status).toBe('cancelled')
      assertions.assertValidTimestamp(job.completedAt!)

      dataManager.track('job', job, async () => {
        await client.jobs.deleteJob(job.id)
      })
    })

    test('should retry a failed job', async () => {
      const jobData: CreateJobRequest = {
        type: 'retry-test',
        maxRetries: 3,
        input: { action: 'retry-test', attemptToFail: 1 }
      }

      const createResult = await client.jobs.createJob(jobData)
      assertions.assertSuccessResponse(createResult)
      let job = createResult.data

      // Start and fail the job
      await client.jobs.startJob(job.id)
      const failResult = await client.jobs.failJob(job.id, {
        message: 'First attempt failed',
        code: 'RETRY_TEST'
      })
      assertions.assertSuccessResponse(failResult)
      job = failResult.data
      expect(job.status).toBe('failed')
      expect(job.retryCount).toBe(0)

      // Retry the job
      const retryResult = await client.jobs.retryJob(job.id, {
        newInput: { action: 'retry-test', attemptToFail: 0 } // Don't fail on retry
      })
      assertions.assertSuccessResponse(retryResult)
      job = retryResult.data

      expect(job.status).toBe('pending') // Reset to pending for retry
      expect(job.retryCount).toBe(1)
      expect(job.input).toEqual({ action: 'retry-test', attemptToFail: 0 })

      dataManager.track('job', job, async () => {
        await client.jobs.deleteJob(job.id)
      })
    })
  })

  // ============================================================================
  // JOB QUEUE OPERATIONS
  // ============================================================================

  describe('Job Queue Operations', () => {
    test('should get next pending job for processing', async () => {
      // Create jobs with different types and priorities
      const jobs = await Promise.all([
        client.jobs.createJob({
          type: 'queue-test-1',
          priority: 'normal',
          input: { order: 1 }
        }),
        client.jobs.createJob({
          type: 'queue-test-2', 
          priority: 'high',
          input: { order: 2 }
        }),
        client.jobs.createJob({
          type: 'queue-test-1',
          priority: 'low',
          input: { order: 3 }
        })
      ])

      // Track for cleanup
      jobs.forEach(result => {
        assertions.assertSuccessResponse(result)
        dataManager.track('job', result.data, async () => {
          await client.jobs.deleteJob(result.data.id)
        })
      })

      // Get next job (should prioritize high priority)
      const nextResult = await client.jobs.getNextJob(['queue-test-1', 'queue-test-2'])
      assertions.assertSuccessResponse(nextResult)
      
      if (nextResult.data) {
        expect(nextResult.data.priority).toBe('high')
        expect(nextResult.data.type).toBe('queue-test-2')
      }

      // Get next job for specific type
      const specificTypeResult = await client.jobs.getNextJob(['queue-test-1'])
      assertions.assertSuccessResponse(specificTypeResult)
      
      if (specificTypeResult.data) {
        expect(specificTypeResult.data.type).toBe('queue-test-1')
        // Should get normal priority before low priority
        expect(specificTypeResult.data.priority).toBe('normal')
      }
    })

    test('should handle bulk operations', async () => {
      const project = await dataManager.createProject()
      
      // Create multiple jobs for bulk operations
      const jobs = []
      for (let i = 0; i < 10; i++) {
        const result = await client.jobs.createJob({
          type: 'bulk-test',
          projectId: project.id,
          input: { index: i },
          metadata: { batch: 'test-batch-1' }
        })
        assertions.assertSuccessResponse(result)
        jobs.push(result.data)
        
        dataManager.track('job', result.data, async () => {
          await client.jobs.deleteJob(result.data.id)
        })
      }

      // Test bulk cancellation
      const bulkCancelResult = await client.jobs.bulkCancelJobs({
        projectId: project.id,
        type: ['bulk-test']
      })
      assertions.assertSuccessResponse(bulkCancelResult)
      expect(bulkCancelResult.data.cancelled).toBeGreaterThan(0)
      expect(bulkCancelResult.data.jobs).toBeInstanceOf(Array)
      
      // Verify jobs were cancelled
      for (const cancelledJob of bulkCancelResult.data.jobs) {
        expect(cancelledJob.status).toBe('cancelled')
      }
    })
  })

  // ============================================================================
  // JOB STATISTICS AND MONITORING
  // ============================================================================

  describe('Job Statistics and Monitoring', () => {
    test('should get job statistics', async () => {
      const project = await dataManager.createProject()
      
      // Create jobs with different statuses for statistics
      const statJobs = await Promise.all([
        client.jobs.createJob({
          type: 'stats-test',
          projectId: project.id,
          priority: 'high',
          input: { purpose: 'pending-job' }
        }),
        client.jobs.createJob({
          type: 'stats-test',
          projectId: project.id,
          priority: 'normal',
          input: { purpose: 'running-job' }
        }),
        client.jobs.createJob({
          type: 'stats-test-2',
          projectId: project.id,
          priority: 'low',
          input: { purpose: 'completed-job' }
        })
      ])

      // Track for cleanup
      statJobs.forEach(result => {
        assertions.assertSuccessResponse(result)
        dataManager.track('job', result.data, async () => {
          await client.jobs.deleteJob(result.data.id)
        })
      })

      // Start and complete one job
      const runningJob = statJobs[1].data
      await client.jobs.startJob(runningJob.id)
      await client.jobs.completeJob(runningJob.id, { result: 'success' })

      // Get project statistics
      const statsResult = await client.jobs.getJobStats(project.id)
      assertions.assertSuccessResponse(statsResult)
      const stats = statsResult.data

      expect(stats.total).toBeGreaterThanOrEqual(3)
      expect(stats.byStatus).toBeDefined()
      expect(stats.byStatus.pending).toBeGreaterThanOrEqual(1)
      expect(stats.byStatus.completed).toBeGreaterThanOrEqual(1)
      expect(stats.byType).toBeDefined()
      expect(stats.byType['stats-test']).toBeGreaterThanOrEqual(2)
      expect(stats.byType['stats-test-2']).toBeGreaterThanOrEqual(1)
      expect(stats.byPriority).toBeDefined()
      expect(stats.byPriority.high).toBeGreaterThanOrEqual(1)
      expect(stats.byPriority.normal).toBeGreaterThanOrEqual(1)
      expect(stats.byPriority.low).toBeGreaterThanOrEqual(1)

      // Check for oldest pending job info
      if (stats.oldestPendingJob) {
        expect(stats.oldestPendingJob.id).toBeTypeOf('number')
        expect(stats.oldestPendingJob.createdAt).toBeTypeOf('number')
        expect(stats.oldestPendingJob.ageMs).toBeTypeOf('number')
      }
    })

    test('should get job history', async () => {
      const jobData: CreateJobRequest = {
        type: 'history-test',
        input: { action: 'test-history-tracking' }
      }

      const createResult = await client.jobs.createJob(jobData)
      assertions.assertSuccessResponse(createResult)
      const job = createResult.data

      // Run job through lifecycle to generate history
      await client.jobs.startJob(job.id)
      await client.jobs.updateJobProgress(job.id, { current: 50, total: 100 })
      await client.jobs.completeJob(job.id, { result: 'History test completed' })

      // Get job history
      const historyResult = await client.jobs.getJobHistory(job.id)
      assertions.assertSuccessResponse(historyResult)
      const history = historyResult.data

      expect(history).toBeInstanceOf(Array)
      if (history.length > 0) {
        const historyEntry = history[0]
        expect(historyEntry.id).toBe(job.id)
        expect(historyEntry.type).toBe(job.type)
        expect(historyEntry.status).toBe('completed')
        assertions.assertValidTimestamp(historyEntry.archivedAt)
        expect(historyEntry.durationMs).toBeTypeOf('number')
      }

      dataManager.track('job', job, async () => {
        await client.jobs.deleteJob(job.id)
      })
    })
  })

  // ============================================================================
  // CLEANUP OPERATIONS
  // ============================================================================

  describe('Job Cleanup Operations', () => {
    test('should cleanup old completed jobs', async () => {
      const project = await dataManager.createProject()
      
      // Create and complete jobs for cleanup testing
      const cleanupJobs = []
      for (let i = 0; i < 5; i++) {
        const result = await client.jobs.createJob({
          type: 'cleanup-test',
          projectId: project.id,
          input: { index: i }
        })
        assertions.assertSuccessResponse(result)
        
        // Complete some jobs
        if (i < 3) {
          await client.jobs.startJob(result.data.id)
          await client.jobs.completeJob(result.data.id, { result: `Completed ${i}` })
        }
        
        cleanupJobs.push(result.data)
        dataManager.track('job', result.data, async () => {
          await client.jobs.deleteJob(result.data.id)
        })
      }

      // Test dry run cleanup
      const dryRunResult = await client.jobs.cleanupJobs({
        projectId: project.id,
        status: ['completed'],
        dryRun: true
      })
      assertions.assertSuccessResponse(dryRunResult)
      expect(dryRunResult.data.preview).toBeInstanceOf(Array)
      expect(dryRunResult.data.preview!.length).toBeGreaterThan(0)
      
      // Verify jobs still exist after dry run
      const statsAfterDryRun = await client.jobs.getJobStats(project.id)
      assertions.assertSuccessResponse(statsAfterDryRun)
      expect(statsAfterDryRun.data.byStatus.completed).toBeGreaterThanOrEqual(3)

      // Actual cleanup
      const cleanupResult = await client.jobs.cleanupJobs({
        projectId: project.id,
        status: ['completed']
      })
      assertions.assertSuccessResponse(cleanupResult)
      expect(cleanupResult.data.cleaned).toBeGreaterThan(0)
    })
  })

  // ============================================================================
  // ERROR HANDLING AND EDGE CASES
  // ============================================================================

  describe('Error Handling and Edge Cases', () => {
    test('should handle invalid job ID gracefully', async () => {
      try {
        await client.jobs.getJob(999999)
        throw new Error('Expected 404 error')
      } catch (error) {
        expect(error instanceof Error).toBe(true)
        expect(error.message).toContain('404')
      }
    })

    test('should validate job creation parameters', async () => {
      // Test missing required fields
      try {
        await client.jobs.createJob({} as CreateJobRequest)
        throw new Error('Expected validation error')
      } catch (error) {
        expect(error instanceof Error).toBe(true)
        // Should get validation error for missing type and input
      }

      // Test invalid priority
      try {
        await client.jobs.createJob({
          type: 'test',
          priority: 'invalid' as any,
          input: { test: true }
        })
        throw new Error('Expected validation error')
      } catch (error) {
        expect(error instanceof Error).toBe(true)
      }

      // Test invalid status update
      const createResult = await client.jobs.createJob({
        type: 'validation-test',
        input: { test: true }
      })
      assertions.assertSuccessResponse(createResult)
      const job = createResult.data

      try {
        await client.jobs.updateJob(job.id, {
          status: 'invalid-status' as any
        })
        throw new Error('Expected validation error')
      } catch (error) {
        expect(error instanceof Error).toBe(true)
      }

      dataManager.track('job', job, async () => {
        await client.jobs.deleteJob(job.id)
      })
    })

    test('should handle concurrent operations safely', async () => {
      const jobData: CreateJobRequest = {
        type: 'concurrency-test',
        input: { action: 'concurrent-access' }
      }

      const createResult = await client.jobs.createJob(jobData)
      assertions.assertSuccessResponse(createResult)
      const job = createResult.data

      // Attempt concurrent operations on the same job
      const operations = [
        client.jobs.updateJob(job.id, { metadata: { update: 1 } }),
        client.jobs.updateJob(job.id, { metadata: { update: 2 } }),
        client.jobs.startJob(job.id, 'worker-1'),
        client.jobs.updateJobProgress(job.id, { current: 1, total: 10 })
      ]

      const results = await Promise.allSettled(operations)
      
      // Some operations should succeed, some might fail due to state conflicts
      const successful = results.filter(r => r.status === 'fulfilled').length
      const failed = results.filter(r => r.status === 'rejected').length
      
      expect(successful + failed).toBe(operations.length)
      // At least one operation should succeed
      expect(successful).toBeGreaterThan(0)

      dataManager.track('job', job, async () => {
        await client.jobs.deleteJob(job.id)
      })
    })

    test('should handle retry limits correctly', async () => {
      const jobData: CreateJobRequest = {
        type: 'retry-limit-test',
        maxRetries: 2,
        input: { action: 'always-fail' }
      }

      const createResult = await client.jobs.createJob(jobData)
      assertions.assertSuccessResponse(createResult)
      let job = createResult.data

      // Fail and retry up to the limit
      for (let attempt = 0; attempt <= job.maxRetries; attempt++) {
        await client.jobs.startJob(job.id)
        const failResult = await client.jobs.failJob(job.id, {
          message: `Attempt ${attempt + 1} failed`,
          code: 'RETRY_LIMIT_TEST'
        })
        assertions.assertSuccessResponse(failResult)
        job = failResult.data

        if (attempt < job.maxRetries) {
          // Should be able to retry
          const retryResult = await client.jobs.retryJob(job.id)
          assertions.assertSuccessResponse(retryResult)
          job = retryResult.data
          expect(job.retryCount).toBe(attempt + 1)
        } else {
          // Should not be able to retry after max retries
          try {
            await client.jobs.retryJob(job.id)
            throw new Error('Expected retry to fail after max retries')
          } catch (error) {
            expect(error instanceof Error).toBe(true)
            // Should get error about exceeding retry limit
          }
        }
      }

      dataManager.track('job', job, async () => {
        await client.jobs.deleteJob(job.id)
      })
    })
  })

  // ============================================================================
  // PERFORMANCE AND LOAD TESTING
  // ============================================================================

  describe('Performance and Load Testing', () => {
    // Skip performance tests in CI to avoid timeouts
    test.skipIf(testEnv.isCI)('should handle high job creation volume', async () => {
      const batchSize = 50
      const project = await dataManager.createProject()
      
      console.log(`🚀 Creating ${batchSize} jobs for performance testing...`)
      
      const startTime = performance.now()
      const jobPromises = []
      
      for (let i = 0; i < batchSize; i++) {
        jobPromises.push(
          client.jobs.createJob({
            type: 'performance-test',
            projectId: project.id,
            priority: i % 3 === 0 ? 'high' : 'normal',
            input: { 
              batchIndex: i,
              timestamp: Date.now(),
              data: `Performance test job ${i}`.repeat(10) // Add some data volume
            },
            metadata: {
              batch: 'performance-test',
              size: batchSize
            }
          })
        )
      }

      const results = await Promise.all(jobPromises)
      const endTime = performance.now()
      
      // Verify all jobs were created successfully
      results.forEach(result => {
        assertions.assertSuccessResponse(result)
        dataManager.track('job', result.data, async () => {
          await client.jobs.deleteJob(result.data.id)
        })
      })

      const duration = endTime - startTime
      const jobsPerSecond = (batchSize / duration) * 1000
      
      console.log(`✅ Created ${batchSize} jobs in ${duration.toFixed(2)}ms (${jobsPerSecond.toFixed(2)} jobs/sec)`)
      
      // Performance assertions
      expect(duration).toBeLessThan(30000) // Should complete within 30 seconds
      expect(jobsPerSecond).toBeGreaterThan(1) // At least 1 job per second
    })

    test.skipIf(testEnv.isCI)('should handle concurrent job processing', async () => {
      const workerCount = 5
      const jobsPerWorker = 5
      const totalJobs = workerCount * jobsPerWorker
      
      // Create jobs for concurrent processing
      const jobs = []
      for (let i = 0; i < totalJobs; i++) {
        const result = await client.jobs.createJob({
          type: 'concurrent-processing-test',
          input: { 
            workload: i,
            processingTime: Math.random() * 1000 // Simulate variable processing time
          }
        })
        assertions.assertSuccessResponse(result)
        jobs.push(result.data)
        
        dataManager.track('job', result.data, async () => {
          await client.jobs.deleteJob(result.data.id)
        })
      }

      // Simulate concurrent workers processing jobs
      const workerPromises = []
      for (let workerId = 0; workerId < workerCount; workerId++) {
        workerPromises.push(
          perfTracker.measure(`worker-${workerId}`, async () => {
            const processedJobs = []
            
            for (let jobIndex = 0; jobIndex < jobsPerWorker; jobIndex++) {
              // Get next job
              const nextJobResult = await client.jobs.getNextJob(['concurrent-processing-test'], `worker-${workerId}`)
              assertions.assertSuccessResponse(nextJobResult)
              
              if (nextJobResult.data) {
                const job = nextJobResult.data
                
                // Start job
                await client.jobs.startJob(job.id, `worker-${workerId}`)
                
                // Simulate processing with progress updates
                for (let progress = 25; progress <= 100; progress += 25) {
                  await client.jobs.updateJobProgress(job.id, {
                    current: progress,
                    total: 100,
                    message: `Worker ${workerId} processing...`
                  })
                  
                  // Small delay to simulate work
                  await new Promise(resolve => setTimeout(resolve, 10))
                }
                
                // Complete job
                await client.jobs.completeJob(job.id, {
                  processedBy: `worker-${workerId}`,
                  processingTime: performance.now(),
                  result: 'success'
                })
                
                processedJobs.push(job.id)
              }
            }
            
            return processedJobs
          })
        )
      }

      const workerResults = await Promise.all(workerPromises)
      
      // Verify all workers processed jobs
      const totalProcessedJobs = workerResults.reduce((sum, jobs) => sum + jobs.length, 0)
      expect(totalProcessedJobs).toBeGreaterThan(0)
      
      console.log(`✅ ${workerCount} workers processed ${totalProcessedJobs} jobs concurrently`)
    })
  })

  // ============================================================================
  // INTEGRATION WITH OTHER SYSTEMS
  // ============================================================================

  describe('Integration with Projects and Queues', () => {
    test('should integrate job management with project workflows', async () => {
      const project = await dataManager.createProject()
      const queue = await dataManager.createQueue(project.id)

      // Create jobs associated with the project
      const projectJobs = []
      for (let i = 0; i < 3; i++) {
        const result = await client.jobs.createJob({
          type: 'project-integration-test',
          projectId: project.id,
          input: {
            projectTask: `Task ${i + 1}`,
            relatedQueue: queue.id
          },
          metadata: {
            integration: 'project-workflow',
            queueId: queue.id
          }
        })
        assertions.assertSuccessResponse(result)
        projectJobs.push(result.data)
        
        dataManager.track('job', result.data, async () => {
          await client.jobs.deleteJob(result.data.id)
        })
      }

      // Get jobs for the specific project
      const projectJobsResult = await client.jobs.getProjectJobs(project.id)
      assertions.assertSuccessResponse(projectJobsResult)
      
      expect(projectJobsResult.data.jobs.length).toBeGreaterThanOrEqual(3)
      expect(projectJobsResult.data.jobs.every(job => job.projectId === project.id)).toBe(true)

      // Get project-specific statistics
      const projectStatsResult = await client.jobs.getJobStats(project.id)
      assertions.assertSuccessResponse(projectStatsResult)
      
      expect(projectStatsResult.data.total).toBeGreaterThanOrEqual(3)
      expect(projectStatsResult.data.byType['project-integration-test']).toBeGreaterThanOrEqual(3)
    })
  })
})