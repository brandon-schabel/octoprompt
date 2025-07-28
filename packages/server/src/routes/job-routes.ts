import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { createJobSchema, jobFilterSchema, type Job, type JobEvent } from '@promptliano/schemas'
import { getJobQueue } from '@promptliano/services'
import type { Variables } from '../types'

const jobApp = new Hono<{ Variables: Variables }>()

// Create a new job
jobApp.post('/', zValidator('json', createJobSchema), async (c) => {
  const jobData = c.req.valid('json')
  const jobQueue = getJobQueue()

  try {
    const job = await jobQueue.createJob(jobData)
    return c.json(job, 201)
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Failed to create job' }, 400)
  }
})

// Get job by ID
jobApp.get('/:jobId', async (c) => {
  const jobId = parseInt(c.req.param('jobId'))

  if (isNaN(jobId)) {
    return c.json({ error: 'Invalid job ID' }, 400)
  }

  const jobQueue = getJobQueue()
  const job = await jobQueue.getJob(jobId)

  if (!job) {
    return c.json({ error: 'Job not found' }, 404)
  }

  return c.json(job)
})

// Get jobs with filters
jobApp.get('/', zValidator('query', jobFilterSchema), async (c) => {
  const filter = c.req.valid('query')
  const jobQueue = getJobQueue()

  const jobs = await jobQueue.getJobs(filter)
  return c.json({ jobs })
})

// Get jobs for a specific project
jobApp.get('/project/:projectId', async (c) => {
  const projectId = parseInt(c.req.param('projectId'))

  if (isNaN(projectId)) {
    return c.json({ error: 'Invalid project ID' }, 400)
  }

  const jobQueue = getJobQueue()
  const jobs = await jobQueue.getJobs({ projectId })

  return c.json({ jobs })
})

// Cancel a job
jobApp.post('/:jobId/cancel', async (c) => {
  const jobId = parseInt(c.req.param('jobId'))

  if (isNaN(jobId)) {
    return c.json({ error: 'Invalid job ID' }, 400)
  }

  const jobQueue = getJobQueue()
  const cancelled = await jobQueue.cancelJob(jobId)

  if (!cancelled) {
    return c.json({ error: 'Job cannot be cancelled or not found' }, 400)
  }

  return c.json({ success: true })
})

// Retry a failed job
jobApp.post('/:jobId/retry', async (c) => {
  const jobId = parseInt(c.req.param('jobId'))

  if (isNaN(jobId)) {
    return c.json({ error: 'Invalid job ID' }, 400)
  }

  const jobQueue = getJobQueue()
  const job = await jobQueue.getJob(jobId)

  if (!job) {
    return c.json({ error: 'Job not found' }, 404)
  }

  if (job.status !== 'failed') {
    return c.json({ error: 'Can only retry failed jobs' }, 400)
  }

  try {
    // Create a new job with the same parameters
    const newJob = await jobQueue.createJob({
      type: job.type,
      input: job.input,
      projectId: job.projectId,
      metadata: {
        ...job.metadata,
        retriedFromJobId: jobId
      }
    })

    return c.json(newJob, 201)
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Failed to retry job' }, 400)
  }
})

// Cleanup old jobs
jobApp.post(
  '/cleanup',
  zValidator(
    'json',
    z.object({
      olderThanDays: z.number().min(1).optional()
    })
  ),
  async (c) => {
    const { olderThanDays = 30 } = c.req.valid('json')
    const jobQueue = getJobQueue()

    const deletedCount = await jobQueue.cleanupOldJobs(olderThanDays)

    return c.json({
      success: true,
      deletedCount,
      message: `Cleaned up ${deletedCount} jobs older than ${olderThanDays} days`
    })
  }
)

export { jobApp }
