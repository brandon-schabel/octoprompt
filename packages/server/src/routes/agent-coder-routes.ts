import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { z } from 'zod'
import { dirname, join } from 'node:path'
import { mkdir, rm, stat } from 'node:fs/promises'
import { ApiError } from 'shared'
import { ApiErrorResponseSchema } from 'shared/src/schemas/common.schemas'
import { ProjectFileMap, ProjectIdParamsSchema, type ProjectFile } from 'shared/src/schemas/project.schemas'
import { mainOrchestrator } from '@/services/agents/agent-coder-service'
import {
  AgentCoderRunRequestSchema,
  AgentCoderRunResponseSchema,
  CoderAgentDataContext,
  AgentDataLogSchema
} from 'shared/src/schemas/agent-coder.schemas'
import {
  AGENT_LOGS_DIR,
  getOrchestratorLogFilePaths,
  listAgentJobs,
  getAgentDataLogFilePath
} from '@/services/agents/agent-logger'
import { getProjectById, getProjectFiles } from '@/services/project-service'
import { buildProjectFileMap } from 'shared/src/utils/projects-utils'
import { getFullProjectSummary } from '@/utils/get-full-project-summary'
import { resolvePath } from '@/utils/path-utils'
import { fromZodError } from 'zod-validation-error'
import { log } from '@/services/agents/agent-logger'
import { getPromptsByIds } from '@/services/prompt-service'

// --- Run Agent Coder Route ---
const runAgentCoderRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/agent-coder',
  tags: ['Projects', 'AI', 'Agent'],
  summary: 'Run the Agent Coder on selected files with a user prompt',
  request: {
    params: ProjectIdParamsSchema,
    body: {
      content: { 'application/json': { schema: AgentCoderRunRequestSchema } },
      required: true
    }
  },
  responses: {
    200: {
      content: { 'application/json': { schema: AgentCoderRunResponseSchema } },
      description: 'Agent Coder executed successfully'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Project or specified files not found'
    },
    422: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Validation Error (invalid input)'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error or Agent Coder execution failed'
    }
  }
})

// Parses a string containing JSONL (JSON Lines) data.
// Skips lines that are empty or cannot be parsed as valid JSON.
async function parseJsonl(content: string): Promise<Array<Record<string, unknown>>> {
  const lines = content.split('\n')
  const parsedObjects: Array<Record<string, unknown>> = []
  for (const line of lines) {
    const trimmedLine = line.trim()
    if (trimmedLine) {
      // Skip empty lines
      try {
        parsedObjects.push(JSON.parse(trimmedLine))
      } catch (error: any) {
        await log(`[JSONL Parser] Skipping invalid line: ${trimmedLine.substring(0, 100)}...`, 'warn', {
          error: error.message
        })
      }
    }
  }
  return parsedObjects
}

// Schema for agentJobId path parameter
const AgentJobIdParamsSchema = z.object({
  agentJobId: z.string().openapi({ description: 'The unique ID of the agent run.' }),
  projectId: z.string().openapi({ description: 'The unique ID of the project.' })
})

// Route for getting orchestrator logs for a specific run
const getAgentRunLogsRoute = createRoute({
  method: 'get',
  path: '/api/agent-coder/project/{projectId}/runs/{agentJobId}/logs',
  tags: ['AI', 'Agent', 'Logs'],
  summary: 'Retrieve the orchestrator execution logs (.jsonl) for a specific Agent Coder run',
  request: {
    params: AgentJobIdParamsSchema
  },
  responses: {
    200: {
      content: { 'application/json': { schema: z.array(z.record(z.unknown())) } },
      description: 'Agent orchestrator log content as an array of JSON objects'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Agent run or log file not found'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error reading log file'
    }
  }
})

// Route for getting agent data for a specific run
const getAgentRunDataRoute = createRoute({
  method: 'get',
  path: '/api/agent-coder/project/{projectId}/runs/{agentJobId}/data',
  tags: ['AI', 'Agent', 'Data'],
  summary: 'Retrieve the agent data log (.json) for a specific Agent Coder run',
  request: {
    params: AgentJobIdParamsSchema
  },
  responses: {
    200: {
      content: { 'application/json': { schema: AgentDataLogSchema } },
      description: 'Agent data log content as a JSON object'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Agent run or data file not found'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error reading or parsing data file'
    }
  }
})

// --- Route for Listing Agent Runs (Job IDs) ---
const ListAgentRunsResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(z.string()).openapi({ description: 'List of available agent run job IDs' })
})

const ListAgentRunsParamsSchema = z.object({
  projectId: z.string().openapi({ description: 'The unique ID of the project.' })
})

const listAgentRunsRoute = createRoute({
  method: 'get',
  path: '/api/agent-coder/project/{projectId}/runs', // Updated path to list runs
  tags: ['AI', 'Agent', 'Logs'],
  summary: 'List available Agent Coder run job IDs',
  request: {
    params: ListAgentRunsParamsSchema
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ListAgentRunsResponseSchema } },
      description: 'List of available agent run job IDs'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error retrieving run list'
    }
  }
})

// Schema for the confirmation response
const ConfirmAgentRunChangesResponseSchema = z
  .object({
    success: z.literal(true),
    message: z.string().openapi({ example: 'Agent run changes successfully written to filesystem.' }),
    writtenFiles: z
      .array(z.string())
      .openapi({
        description: 'Relative paths of files proposed for writing (actual writes depend on checksums).',
        example: ['src/new-feature.ts', 'test/new-feature.test.ts']
      })
  })
  .openapi('ConfirmAgentRunChangesResponse')

// --- Route Definition for Confirming Changes ---
const confirmAgentRunChangesRoute = createRoute({
  method: 'post',
  path: '/api/agent-coder/project/{projectId}/runs/{agentJobId}/confirm',
  tags: ['AI', 'Agent', 'Filesystem'],
  summary: 'Confirm and write agent-generated file changes to the filesystem',
  request: {
    params: AgentJobIdParamsSchema
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ConfirmAgentRunChangesResponseSchema } },
      description: 'Agent run changes successfully written to filesystem.'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Agent run data, project, or original files not found'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error reading data log or writing files'
    }
  }
})

// --- Schema for Delete Response ---
const DeleteAgentRunResponseSchema = z
  .object({
    success: z.literal(true),
    message: z.string().openapi({ example: 'Agent run job-xyz-123 deleted successfully.' })
  })
  .openapi('DeleteAgentRunResponse')

// --- Route Definition for Deleting an Agent Run ---
const deleteAgentRunRoute = createRoute({
  method: 'delete',
  path: '/api/agent-coder/runs/{agentJobId}',
  tags: ['AI', 'Agent', 'Admin'],
  summary: 'Delete an Agent Coder run and its associated logs/data',
  request: {
    params: AgentJobIdParamsSchema
  },
  responses: {
    200: {
      content: { 'application/json': { schema: DeleteAgentRunResponseSchema } },
      description: 'Agent run successfully deleted.'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Agent run directory not found'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error during deletion'
    }
  }
})

export const writeFilesToFileSystem = async ({
  agentJobId,
  projectFileMap,
  absoluteProjectPath,
  updatedFiles
}: {
  agentJobId: string
  projectFileMap: ProjectFileMap
  absoluteProjectPath: string
  updatedFiles: ProjectFile[]
}) => {
  try {
    const writePromises = updatedFiles.map(async (updatedFile) => {
      if (updatedFile.content === null || updatedFile.content === undefined) {
        await log(`[Agent Coder Route ${agentJobId}] Skipping write for ${updatedFile.path} (null content).`, 'warn', {
          agentJobId,
          filePath: updatedFile.path
        })
        return
      }
      const originalFile = projectFileMap.get(updatedFile.id)
      const originalChecksum = originalFile?.checksum
      const newChecksum =
        updatedFile.content !== null && updatedFile.content !== undefined
          ? (updatedFile.checksum ?? Bun.hash(updatedFile.content).toString(16))
          : updatedFile.checksum

      const needsWrite =
        !originalFile ||
        (isValidChecksum(originalChecksum) && isValidChecksum(newChecksum) && originalChecksum !== newChecksum)
      if (!needsWrite) {
        return
      }

      const absoluteFilePath = join(absoluteProjectPath, updatedFile.path)
      const directoryPath = dirname(absoluteFilePath)

      try {
        await mkdir(directoryPath, { recursive: true })
        await Bun.write(absoluteFilePath, updatedFile.content)
        await log(`[Agent Coder Route ${agentJobId}] Wrote code file: ${updatedFile.path}`, 'info', {
          agentJobId,
          filePath: updatedFile.path
        })
      } catch (writeError: any) {
        await log(
          `[Agent Coder Route ${agentJobId}] Failed to write ${updatedFile.path}: ${writeError.message}`,
          'error',
          { agentJobId, filePath: updatedFile.path, error: writeError.message, stack: writeError.stack }
        )
        throw new Error(`Failed write: ${updatedFile.path}`) // For Promise.allSettled
      }
    })

    const writeResults = await Promise.allSettled(writePromises)
    const failedWrites = writeResults.filter((r) => r.status === 'rejected')
    if (failedWrites.length > 0) {
      await log(`[Agent Coder Route ${agentJobId}] ${failedWrites.length} file write(s) failed:`, 'error', {
        agentJobId,
        failedCount: failedWrites.length
      })
      failedWrites.forEach(
        async (f) =>
          await log(`- ${(f as PromiseRejectedResult).reason}`, 'error', {
            agentJobId,
            reason: (f as PromiseRejectedResult).reason
          })
      )
      // Optional: Add warning to response or status 207
    } else {
      await log(`[Agent Coder Route ${agentJobId}] All necessary code file writes completed.`, 'info', { agentJobId })
    }
  } catch (fileWriteSetupError: any) {
    await log(
      `[Agent Coder Route ${agentJobId}] Error setting up code file writing: ${fileWriteSetupError.message}`,
      'error',
      { agentJobId, error: fileWriteSetupError.message, stack: fileWriteSetupError.stack }
    )
  }
}

export const agentCoderRoutes = new OpenAPIHono()
  .openapi(runAgentCoderRoute, async (c) => {
    const { projectId: routeProjectId } = c.req.valid('param')
    const {
      userInput,
      selectedFileIds: routeSelectedFileIds,
      agentJobId: routeAgentJobId = 'no-job-id',
      selectedPromptIds
    } = c.req.valid('json')

    const prompts = await getPromptsByIds(selectedPromptIds || [])

    await log(`[Agent Coder Route] Starting run ${routeAgentJobId} for project ${routeProjectId}`, 'info', {
      agentJobId: routeAgentJobId,
      projectId: routeProjectId
    })

    const project = await getProjectById(routeProjectId)
    if (!project) {
      await log(`[Agent Coder Route ${routeAgentJobId}] Project ${routeProjectId} not found.`, 'error', {
        agentJobId: routeAgentJobId,
        projectId: routeProjectId
      })
      throw new ApiError(404, `Project ${routeProjectId} not found.`)
    }

    const projectFiles = (await getProjectFiles(routeProjectId)) ?? []
    const projectSummaryContext = await getFullProjectSummary(routeProjectId)
    if (typeof projectSummaryContext !== 'string') {
      await log(
        `[Agent Coder Route ${routeAgentJobId}] Project summary context error for project ${routeProjectId}.`,
        'error',
        { agentJobId: routeAgentJobId, projectId: routeProjectId }
      )
      throw new ApiError(500, 'Project summary context error', 'PROJECT_SUMMARY_ERROR')
    }

    if (
      projectFiles.filter((f) => routeSelectedFileIds.includes(f.id)).length === 0 &&
      routeSelectedFileIds.length > 0
    ) {
      await log(
        `[Agent Coder Route ${routeAgentJobId}] No matching files found for IDs: ${routeSelectedFileIds.join(', ')}`,
        'warn',
        { agentJobId: routeAgentJobId, selectedFileIds: routeSelectedFileIds }
      )
    }

    await log(`[Agent Coder Route ${routeAgentJobId}] Calling main orchestrator...`, 'info', {
      agentJobId: routeAgentJobId
    })
    const coderAgentDataContext: CoderAgentDataContext = {
      userInput,
      projectFiles,
      projectFileMap: buildProjectFileMap(projectFiles),
      projectSummaryContext,
      agentJobId: routeAgentJobId,
      project,
      prompts,
      selectedFileIds: routeSelectedFileIds
    }
    const orchestratorResultData = await mainOrchestrator(coderAgentDataContext)

    await log(`[Agent Coder Route ${routeAgentJobId}] Orchestrator finished successfully.`, 'info', {
      agentJobId: routeAgentJobId
    })

    const responsePayload: z.infer<typeof AgentCoderRunResponseSchema> = {
      success: true,
      data: {
        updatedFiles: orchestratorResultData.updatedFiles,
        taskPlan: orchestratorResultData.taskPlan === null ? undefined : orchestratorResultData.taskPlan,
        agentJobId: orchestratorResultData.agentJobId
      }
    }
    return c.json(responsePayload, 200)
  })
  .openapi(listAgentRunsRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const jobIds = await listAgentJobs(projectId)

    const responsePayload: z.infer<typeof ListAgentRunsResponseSchema> = {
      success: true,
      data: jobIds
    }
    return c.json(responsePayload, 200)
  })
  .openapi(getAgentRunLogsRoute, async (c) => {
    const { agentJobId, projectId } = c.req.valid('param')

    const { filePath } = await getOrchestratorLogFilePaths(projectId, agentJobId)

    const logFile = Bun.file(filePath)
    if (!(await logFile.exists())) {
      throw new ApiError(
        404,
        `Agent run ${agentJobId} logs not found. File does not exist: ${filePath}`,
        'LOG_FILE_NOT_FOUND'
      )
    }
    const logContent = await logFile.text()

    const parsedLogs = await parseJsonl(logContent)

    return c.json(parsedLogs, 200)
  })
  .openapi(getAgentRunDataRoute, async (c) => {
    const { agentJobId, projectId } = c.req.valid('param')

    const dataFilePath = await getAgentDataLogFilePath(projectId, agentJobId) // This function should be robust

    const dataFile = Bun.file(dataFilePath)
    if (!(await dataFile.exists())) {
      throw new ApiError(
        404,
        `Agent run ${agentJobId} data not found. File does not exist: ${dataFilePath}`,
        'DATA_LOG_NOT_FOUND'
      )
    }

    const agentData = await dataFile.json()

    return c.json(agentData, 200)
  })
  .openapi(confirmAgentRunChangesRoute, async (c) => {
    const { agentJobId, projectId } = c.req.valid('param')
    await log(`[Agent Confirm Route] Request received for job ID: ${agentJobId}`, 'info', { agentJobId })

    const dataFilePath = await getAgentDataLogFilePath(projectId, agentJobId)
    await log(`[Agent Confirm Route] Reading data file path: ${dataFilePath}`, 'info', { agentJobId, dataFilePath })

    const dataFile = Bun.file(dataFilePath)
    if (!(await dataFile.exists())) {
      await log(`[Agent Confirm Route] Data file not found at path: ${dataFilePath}`, 'error', {
        agentJobId,
        dataFilePath
      })
      throw new ApiError(404, `Agent run ${agentJobId} data log not found.`, 'AGENT_DATA_LOG_MISSING')
    }

    const agentDataLogRaw = await dataFile.json()
    const validationResult = AgentDataLogSchema.safeParse(agentDataLogRaw)

    if (!validationResult.success) {
      const error = fromZodError(validationResult.error)
      await log(`[Agent Confirm Route] Invalid data log structure for ${agentJobId}: ${error.message}`, 'error', {
        agentJobId,
        errorMessage: error.message,
        validationError: validationResult.error.format()
      })
      throw new ApiError(
        500,
        `Invalid agent data log structure for agent run ${agentJobId}.`,
        'AGENT_DATA_LOG_INVALID',
        { agentJobId, details: error.message }
      )
    }

    const { updatedFiles: agentProposedFiles } = validationResult.data

    if (!agentProposedFiles || agentProposedFiles.length === 0) {
      await log(`[Agent Confirm Route ${agentJobId}] No file changes proposed in data log. Nothing to write.`, 'info', {
        agentJobId
      })
      return c.json(
        {
          success: true,
          message: 'No file changes were proposed by the agent. Filesystem unchanged.',
          writtenFiles: []
        } satisfies z.infer<typeof ConfirmAgentRunChangesResponseSchema>,
        200
      )
    }

    await log(
      `[Agent Confirm Route] Found ${agentProposedFiles.length} proposed file changes in data log for project ${projectId}.`,
      'info',
      { agentJobId, projectId, fileCount: agentProposedFiles.length }
    )

    const projectData = await getProjectById(projectId)
    if (!projectData) {
      await log(`[Agent Confirm Route ${agentJobId}] Project ${projectId} not found.`, 'error', {
        agentJobId,
        projectId
      })
      throw new ApiError(
        404,
        `Project ${projectId} associated with agent run ${agentJobId} not found.`,
        'PROJECT_NOT_FOUND_FOR_CONFIRM'
      )
    }
    const absoluteProjectPath = resolvePath(projectData.path)
    if (!absoluteProjectPath) {
      await log(
        `[Agent Confirm Route ${agentJobId}] Could not determine absolute path for project ${projectId}.`,
        'error',
        { agentJobId, projectId }
      )
      throw new ApiError(
        500,
        `Could not determine absolute path for project ${projectId}.`,
        'PROJECT_PATH_RESOLUTION_FAILED'
      )
    }
    await log(`[Agent Confirm Route] Absolute project path: ${absoluteProjectPath}`, 'info', {
      agentJobId,
      projectId,
      absoluteProjectPath
    })

    const originalProjectFiles = await getProjectFiles(projectId)
    if (!originalProjectFiles) {
      await log(
        `[Agent Confirm Route ${agentJobId}] Original files for project ${projectId} could not be fetched or project is empty.`,
        'error',
        { agentJobId, projectId }
      )
      throw new ApiError(
        404,
        `Original files for project ${projectId} could not be fetched or project is empty.`,
        'ORIGINAL_FILES_NOT_FOUND_FOR_CONFIRM'
      )
    }
    const originalProjectFileMap = buildProjectFileMap(originalProjectFiles)
    await log(
      `[Agent Confirm Route] Built original project file map with ${originalProjectFileMap.size} files.`,
      'info',
      { agentJobId, projectId, mapSize: originalProjectFileMap.size }
    )

    await log(`[Agent Confirm Route ${agentJobId}] Calling writeFilesToFileSystem...`, 'info', { agentJobId })
    await writeFilesToFileSystem({
      agentJobId,
      projectFileMap: originalProjectFileMap,
      absoluteProjectPath,
      updatedFiles: agentProposedFiles
    })
    await log(`[Agent Confirm Route ${agentJobId}] writeFilesToFileSystem completed.`, 'info', { agentJobId })

    const successPayload: z.infer<typeof ConfirmAgentRunChangesResponseSchema> = {
      success: true,
      message: 'Agent run changes successfully written to filesystem.',
      writtenFiles: agentProposedFiles.map((f) => f.path)
    }
    return c.json(successPayload, 200)
  })
  .openapi(deleteAgentRunRoute, async (c) => {
    const { agentJobId } = c.req.valid('param')
    await log(`[Agent Delete Route] Request received for job ID: ${agentJobId}`, 'info', { agentJobId })

    const agentRunDirectory = join(AGENT_LOGS_DIR, agentJobId)

    try {
      await stat(agentRunDirectory)
    } catch (checkError: any) {
      if (checkError.code === 'ENOENT') {
        await log(`[Agent Delete Route] Directory not found for ${agentJobId}: ${agentRunDirectory}`, 'warn', {
          agentJobId,
          directory: agentRunDirectory,
          errorCode: checkError.code
        })
        throw new ApiError(
          404,
          `Agent run ${agentJobId} not found. Directory does not exist.`,
          'AGENT_RUN_DIR_NOT_FOUND'
        )
      }
      await log(`[Agent Delete Route] Error checking directory for ${agentJobId}: ${checkError.message}`, 'error', {
        agentJobId,
        directory: agentRunDirectory,
        error: checkError.message,
        stack: checkError.stack
      })
      throw new ApiError(
        500,
        `Error checking agent run directory ${agentJobId}: ${checkError.message}`,
        'AGENT_RUN_DIR_STAT_FAILED'
      )
    }

    await log(`[Agent Delete Route] Attempting to delete directory: ${agentRunDirectory}`, 'info', {
      agentJobId,
      directory: agentRunDirectory
    })
    await rm(agentRunDirectory, { recursive: true, force: true }) // rm can throw
    await log(`[Agent Delete Route] Successfully deleted directory for ${agentJobId}`, 'info', {
      agentJobId,
      directory: agentRunDirectory
    })

    const successPayload: z.infer<typeof DeleteAgentRunResponseSchema> = {
      success: true,
      message: `Agent run ${agentJobId} deleted successfully.`
    }
    return c.json(successPayload, 200)
  })

function isValidChecksum(checksum: string | null | undefined): checksum is string {
  return typeof checksum === 'string' && /^[a-f0-9]+$/.test(checksum)
}
