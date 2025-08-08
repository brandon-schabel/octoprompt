import { z } from '@hono/zod-openapi'
import {
  validateRequiredParam,
  validateDataField,
  createTrackedHandler,
  MCPError,
  MCPErrorCode,
  createMCPError,
  formatMCPErrorResponse,
  type MCPToolDefinition,
  type MCPToolResponse
} from '../shared'
import { getJobQueue } from '@promptliano/services'

export enum JobManagerAction {
  LIST = 'list',
  GET = 'get',
  CREATE = 'create',
  CANCEL = 'cancel',
  RETRY = 'retry',
  CLEANUP = 'cleanup'
}

const JobManagerSchema = z.object({
  action: z.enum([
    JobManagerAction.LIST,
    JobManagerAction.GET,
    JobManagerAction.CREATE,
    JobManagerAction.CANCEL,
    JobManagerAction.RETRY,
    JobManagerAction.CLEANUP
  ]),
  jobId: z.number().optional(),
  projectId: z.number().optional(),
  data: z.any().optional()
})

export const jobManagerTool: MCPToolDefinition = {
  name: 'job_manager',
  description:
    'Manage background jobs and long-running operations. Actions: list (get jobs with filters), get (get single job status), create (create new job), cancel (cancel running job), retry (retry failed job), cleanup (remove old completed jobs)',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'The action to perform',
        enum: Object.values(JobManagerAction)
      },
      jobId: {
        type: 'number',
        description: 'The job ID (required for get, cancel, retry actions)'
      },
      projectId: {
        type: 'number',
        description: 'The project ID (optional for list, required for create)'
      },
      data: {
        type: 'object',
        description:
          'Action-specific data. For list: { status: ["pending", "running"], limit: 10 }. For create: { type: "git.worktree.add", input: {...}, options: { priority: "high" } }. For cleanup: { olderThanDays: 30 }'
      }
    },
    required: ['action']
  },
  handler: createTrackedHandler(
    'job_manager',
    async (args: z.infer<typeof JobManagerSchema>): Promise<MCPToolResponse> => {
      try {
        const { action, jobId, projectId, data } = args
        const jobQueue = getJobQueue()
        switch (action) {
          case JobManagerAction.LIST: {
            const filter = data || {}
            if (projectId) filter.projectId = projectId
            const jobs = await jobQueue.getJobs(filter)
            return {
              content: [
                {
                  type: 'text',
                  text: `Found ${jobs.length} jobs:\n${jobs
                    .map(
                      (job) =>
                        `- Job ${job.id}: ${job.type} (${job.status}) - Created ${new Date(job.created).toISOString()}`
                    )
                    .join('\n')}`
                }
              ]
            }
          }
          case JobManagerAction.GET: {
            const validJobId = validateRequiredParam(jobId, 'jobId', 'number')
            const job = await jobQueue.getJob(validJobId)
            if (!job) {
              return {
                content: [{ type: 'text', text: `Job ${validJobId} not found` }]
              }
            }
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(job, null, 2)
                }
              ]
            }
          }
          case JobManagerAction.CREATE: {
            const validProjectId = projectId ? validateRequiredParam(projectId, 'projectId', 'number') : undefined
            const jobType = validateDataField<string>(data, 'type', 'string', '"git.worktree.add"')
            const jobInput = validateDataField<any>(data, 'input', 'object', '{ path: "/path/to/worktree" }')
            const job = await jobQueue.createJob({
              type: jobType,
              input: jobInput,
              projectId: validProjectId,
              options: data.options,
              metadata: data.metadata
            })
            return {
              content: [
                {
                  type: 'text',
                  text: `Created job ${job.id} of type ${job.type} with status ${job.status}`
                }
              ]
            }
          }
          case JobManagerAction.CANCEL: {
            const validJobId = validateRequiredParam(jobId, 'jobId', 'number')
            const cancelled = await jobQueue.cancelJob(validJobId)
            return {
              content: [
                {
                  type: 'text',
                  text: cancelled
                    ? `Job ${validJobId} cancelled successfully`
                    : `Failed to cancel job ${validJobId} (may already be completed)`
                }
              ]
            }
          }
          case JobManagerAction.RETRY: {
            const validJobId = validateRequiredParam(jobId, 'jobId', 'number')
            const originalJob = await jobQueue.getJob(validJobId)
            if (!originalJob) {
              return {
                content: [{ type: 'text', text: `Job ${validJobId} not found` }]
              }
            }
            if (originalJob.status !== 'failed') {
              return {
                content: [
                  { type: 'text', text: `Job ${validJobId} is not in failed state (current: ${originalJob.status})` }
                ]
              }
            }
            const newJob = await jobQueue.createJob({
              type: originalJob.type,
              input: originalJob.input,
              projectId: originalJob.projectId,
              metadata: {
                ...originalJob.metadata,
                retriedFromJobId: validJobId
              }
            })
            return {
              content: [
                {
                  type: 'text',
                  text: `Created retry job ${newJob.id} based on failed job ${validJobId}`
                }
              ]
            }
          }
          case JobManagerAction.CLEANUP: {
            const olderThanDays = data?.olderThanDays || 30
            const deletedCount = await jobQueue.cleanupOldJobs(olderThanDays)
            return {
              content: [
                {
                  type: 'text',
                  text: `Cleaned up ${deletedCount} jobs older than ${olderThanDays} days`
                }
              ]
            }
          }
          default:
            throw createMCPError(MCPErrorCode.UNKNOWN_ACTION, `Unknown action: ${action}`, {
              action,
              validActions: Object.values(JobManagerAction)
            })
        }
      } catch (error) {
        const mcpError =
          error instanceof MCPError
            ? error
            : MCPError.fromError(error, {
                tool: 'job_manager',
                action: args.action
              })
        return formatMCPErrorResponse(mcpError)
      }
    }
  )
}