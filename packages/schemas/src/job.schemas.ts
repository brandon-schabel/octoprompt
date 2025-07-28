import { z } from 'zod'

export const jobStatusSchema = z.enum(['pending', 'running', 'completed', 'failed', 'cancelled'])
export type JobStatus = z.infer<typeof jobStatusSchema>

export const jobPrioritySchema = z.enum(['low', 'normal', 'high'])
export type JobPriority = z.infer<typeof jobPrioritySchema>

export const jobOptionsSchema = z.object({
  timeout: z.number().optional().describe('Maximum execution time in milliseconds'),
  maxRetries: z.number().optional().describe('Maximum number of retry attempts'),
  retryDelay: z.number().optional().describe('Delay between retries in milliseconds'),
  priority: jobPrioritySchema.optional().describe('Job priority for queue ordering')
})
export type JobOptions = z.infer<typeof jobOptionsSchema>

export const jobProgressSchema = z.object({
  current: z.number().describe('Current progress value'),
  total: z.number().describe('Total progress value'),
  percentage: z.number().optional().describe('Progress percentage (0-100)'),
  message: z.string().optional().describe('Human-readable progress message'),
  details: z.record(z.any()).optional().describe('Additional progress details')
})
export type JobProgress = z.infer<typeof jobProgressSchema>

export const jobErrorSchema = z.object({
  message: z.string().describe('Error message'),
  code: z.string().optional().describe('Error code for categorization'),
  details: z.any().optional().describe('Additional error details'),
  stack: z.string().optional().describe('Error stack trace')
})
export type JobError = z.infer<typeof jobErrorSchema>

export const jobSchema = z.object({
  id: z.number().describe('Unique job identifier'),
  type: z.string().describe('Job type identifier (e.g., git.worktree.add)'),
  status: jobStatusSchema.describe('Current job status'),
  priority: jobPrioritySchema.describe('Job execution priority'),

  // Context
  projectId: z.number().optional().describe('Associated project ID'),
  userId: z.string().optional().describe('User who created the job'),

  // Job data
  input: z.record(z.any()).describe('Input parameters for the job'),
  result: z.any().optional().describe('Job execution result'),
  error: jobErrorSchema.optional().describe('Error information if job failed'),

  // Progress tracking
  progress: jobProgressSchema.optional().describe('Current job progress'),

  // Metadata
  metadata: z.record(z.any()).optional().describe('Additional job metadata'),

  // Timestamps
  created: z.number().describe('Job creation timestamp'),
  started: z.number().optional().describe('Job start timestamp'),
  completed: z.number().optional().describe('Job completion timestamp'),
  updated: z.number().describe('Last update timestamp')
})
export type Job = z.infer<typeof jobSchema>

// Job creation schemas
export const createJobSchema = z.object({
  type: z.string().describe('Job type identifier'),
  input: z.record(z.any()).describe('Job input parameters'),
  options: jobOptionsSchema.optional().describe('Job execution options'),
  projectId: z.number().optional().describe('Associated project ID'),
  metadata: z.record(z.any()).optional().describe('Additional metadata')
})
export type CreateJob = z.infer<typeof createJobSchema>

// Job update schemas
export const updateJobProgressSchema = z.object({
  progress: jobProgressSchema.describe('Updated progress information')
})
export type UpdateJobProgress = z.infer<typeof updateJobProgressSchema>

// Job filter schemas
export const jobFilterSchema = z.object({
  projectId: z.number().optional().describe('Filter by project ID'),
  type: z.string().optional().describe('Filter by job type'),
  status: z.array(jobStatusSchema).optional().describe('Filter by status'),
  priority: z.array(jobPrioritySchema).optional().describe('Filter by priority'),
  createdAfter: z.number().optional().describe('Filter jobs created after timestamp'),
  createdBefore: z.number().optional().describe('Filter jobs created before timestamp'),
  limit: z.number().optional().describe('Maximum number of results'),
  offset: z.number().optional().describe('Result offset for pagination')
})
export type JobFilter = z.infer<typeof jobFilterSchema>

// Job event schemas for WebSocket
export const jobEventTypeSchema = z.enum([
  'job.created',
  'job.started',
  'job.progress',
  'job.completed',
  'job.failed',
  'job.cancelled'
])
export type JobEventType = z.infer<typeof jobEventTypeSchema>

export const jobEventSchema = z.object({
  type: jobEventTypeSchema.describe('Event type'),
  jobId: z.number().describe('Job ID'),
  job: jobSchema.describe('Current job state'),
  timestamp: z.number().describe('Event timestamp')
})
export type JobEvent = z.infer<typeof jobEventSchema>

// Job handler registration schema
export const jobHandlerSchema = z.object({
  type: z.string().describe('Job type this handler processes'),
  name: z.string().describe('Human-readable handler name'),
  description: z.string().optional().describe('Handler description'),
  inputSchema: z.any().optional().describe('Zod schema for validating job input'),
  outputSchema: z.any().optional().describe('Zod schema for job output'),
  timeout: z.number().optional().describe('Default timeout for jobs of this type'),
  maxRetries: z.number().optional().describe('Default max retries for this type')
})
export type JobHandler = z.infer<typeof jobHandlerSchema>
