import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { dirname, join } from 'node:path';
import { mkdir, readdir, rm, stat } from 'node:fs/promises';

import { ApiError } from 'shared';
import { ApiErrorResponseSchema } from 'shared/src/schemas/common.schemas';
import { ProjectFileMap, ProjectFileSchema, ProjectIdParamsSchema, type ProjectFile } from 'shared/src/schemas/project.schemas';
import { v4 as uuidv4 } from 'uuid';

import { mainOrchestrator, } from '@/services/agents/agent-coder-service';
import { AgentCoderRunRequestSchema, AgentCoderRunResponseSchema, AgentTaskPlanSchema, TaskPlan, AgentCoderRunSuccessDataSchema, CoderAgentDataContext, AgentCoderRunSuccessData, AgentDataLogSchema } from 'shared/src/schemas/agent-coder.schemas';
import { AGENT_LOGS_DIR, getOrchestratorLogFilePaths, listAgentJobs, writeAgentDataLog, getAgentDataLogFilePath } from '@/services/agents/agent-logger';


import { getProjectById, getProjectFiles, getProjectFilesByIds } from '@/services/project-service';
import { buildProjectFileMap } from 'shared/src/utils/projects-utils';
import { getFullProjectSummary } from '@/utils/get-full-project-summary';
import { resolvePath } from '@/utils/path-utils';
import { fromZodError } from 'zod-validation-error';
import { ContentfulStatusCode } from 'hono/utils/http-status';


// --- Run Agent Coder Route ---
const runAgentCoderRoute = createRoute({
    method: 'post',
    path: '/api/projects/{projectId}/agent-coder', // Path remains the same
    tags: ['Projects', 'AI', 'Agent'],
    summary: 'Run the Agent Coder on selected files with a user prompt',
    request: {
        params: ProjectIdParamsSchema,
        body: {
            content: { 'application/json': { schema: AgentCoderRunRequestSchema } },
            required: true,
        },
    },
    responses: {
        200: {
            content: { 'application/json': { schema: AgentCoderRunResponseSchema } }, // Updated response schema
            description: 'Agent Coder executed successfully',
        },
        404: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Project or specified files not found',
        },
        422: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Validation Error (invalid input)',
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error or Agent Coder execution failed',
        },
    },
});

// --- Helper: JSONL Parser (remains the same) ---
/**
 * Parses a string containing JSONL (JSON Lines) data.
 * Skips lines that are empty or cannot be parsed as valid JSON.
 * @param content The raw string content of the JSONL file.
 * @returns An array of parsed JSON objects.
 */
function parseJsonl(content: string): Array<Record<string, unknown>> {
    const lines = content.split('\n');
    const parsedObjects: Array<Record<string, unknown>> = [];
    for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine) { // Skip empty lines
            try {
                parsedObjects.push(JSON.parse(trimmedLine));
            } catch (error) {
                console.warn(`[JSONL Parser] Skipping invalid line: ${trimmedLine.substring(0, 100)}...`, error);
            }
        }
    }
    return parsedObjects;
}

// --- Routes for Getting Agent Run Details ---

// Schema for agentJobId path parameter
const AgentJobIdParamsSchema = z.object({
    agentJobId: z.string().openapi({ description: 'The unique ID of the agent run.' })
});

// Define the schema for the data endpoint response *before* the route definition
// Use AgentCoderRunSuccessDataSchema or a more specific schema if available and accurate
// For now, using z.record(z.unknown()) for flexibility, but refine if possible.
// const AgentRunDataResponseSchema = z.record(z.unknown()).openapi('AgentRunData');
// Use the more specific schema if it aligns with what writeAgentDataLog saves
const AgentRunDataResponseSchema = AgentCoderRunSuccessDataSchema.openapi('AgentRunData');

// Route for getting orchestrator logs for a specific run
const getAgentRunLogsRoute = createRoute({
    method: 'get',
    path: '/api/agent-coder/runs/{agentJobId}/logs', // Updated path
    tags: ['AI', 'Agent', 'Logs'],
    summary: 'Retrieve the orchestrator execution logs (.jsonl) for a specific Agent Coder run',
    request: {
        params: AgentJobIdParamsSchema, // Use agentJobId from path
    },
    responses: {
        200: {
            content: { 'application/json': { schema: z.array(z.record(z.unknown())) } },
            description: 'Agent orchestrator log content as an array of JSON objects',
        },
        404: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Agent run or log file not found',
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error reading log file',
        },
    },
});

// Route for getting agent data for a specific run
const getAgentRunDataRoute = createRoute({
    method: 'get',
    path: '/api/agent-coder/runs/{agentJobId}/data', // New path for data
    tags: ['AI', 'Agent', 'Data'], // Updated tags
    summary: 'Retrieve the agent data log (.json) for a specific Agent Coder run',
    request: {
        params: AgentJobIdParamsSchema, // Use agentJobId from path
    },
    responses: {
        200: {
            content: { 'application/json': { schema: AgentDataLogSchema } }, // Reference the data schema
            description: 'Agent data log content as a JSON object',
        },
        404: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Agent run or data file not found',
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error reading or parsing data file',
        },
    },
});

// --- Route for Listing Agent Runs (Job IDs) ---

const ListAgentRunsResponseSchema = z.object({
    success: z.boolean(),
    data: z.array(z.string()).openapi({ description: 'List of available agent run job IDs' })
});

const listAgentRunsRoute = createRoute({
    method: 'get',
    path: '/api/agent-coder/runs', // Updated path to list runs
    tags: ['AI', 'Agent', 'Logs'],
    summary: 'List available Agent Coder run job IDs',
    responses: {
        200: {
            content: { 'application/json': { schema: ListAgentRunsResponseSchema } },
            description: 'List of available agent run job IDs',
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error retrieving run list',
        },
    },
});



// --- Add these near other schema definitions ---

// Schema for the confirmation response
const ConfirmAgentRunChangesResponseSchema = z.object({
    success: z.literal(true),
    message: z.string().openapi({ example: 'Agent run changes successfully written to filesystem.' }),
    writtenFiles: z.array(z.string()).openapi({ description: 'Relative paths of files proposed for writing (actual writes depend on checksums).', example: ['src/new-feature.ts', 'test/new-feature.test.ts'] })
}).openapi('ConfirmAgentRunChangesResponse');


// --- Route Definition for Confirming Changes ---
const confirmAgentRunChangesRoute = createRoute({
    method: 'post', // POST because it changes the state of the filesystem
    path: '/api/agent-coder/runs/{agentJobId}/confirm',
    tags: ['AI', 'Agent', 'Filesystem'],
    summary: 'Confirm and write agent-generated file changes to the filesystem',
    request: {
        params: AgentJobIdParamsSchema, // Reuse existing schema for agentJobId
    },
    responses: {
        200: {
            content: { 'application/json': { schema: ConfirmAgentRunChangesResponseSchema } },
            description: 'Agent run changes successfully written to filesystem.',
        },
        404: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Agent run data, project, or original files not found',
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error reading data log or writing files',
        },
    },
});

// --- Schema for Delete Response ---
const DeleteAgentRunResponseSchema = z.object({
    success: z.literal(true),
    message: z.string().openapi({ example: 'Agent run job-xyz-123 deleted successfully.' })
}).openapi('DeleteAgentRunResponse');


// --- Route Definition for Deleting an Agent Run ---
const deleteAgentRunRoute = createRoute({
    method: 'delete',
    path: '/api/agent-coder/runs/{agentJobId}', // Use DELETE on the specific run resource
    tags: ['AI', 'Agent', 'Admin'], // Add 'Admin' or similar tag
    summary: 'Delete an Agent Coder run and its associated logs/data',
    request: {
        params: AgentJobIdParamsSchema, // Reuse existing schema for agentJobId
    },
    responses: {
        200: {
            content: { 'application/json': { schema: DeleteAgentRunResponseSchema } },
            description: 'Agent run successfully deleted.',
        },
        404: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Agent run directory not found',
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error during deletion',
        },
    },
});


export const writeFilesToFileSystem = async ({
    agentJobId,
    projectFileMap,
    absoluteProjectPath,
    updatedFiles
}: {
    agentJobId: string,
    projectFileMap: ProjectFileMap,
    absoluteProjectPath: string,
    updatedFiles: ProjectFile[]
}) => {
    try {
        const writePromises = updatedFiles.map(async (updatedFile) => {
            if (updatedFile.content === null || updatedFile.content === undefined) {
                console.warn(`[Agent Coder Route ${agentJobId}] Skipping write for ${updatedFile.path} (null content).`);
                return;
            }
            const originalFile = projectFileMap.get(updatedFile.id);
            const originalChecksum = originalFile?.checksum;
            const newChecksum = (updatedFile.content !== null && updatedFile.content !== undefined)
                ? (updatedFile.checksum ?? Bun.hash(updatedFile.content).toString(16))
                : updatedFile.checksum;

            const needsWrite = !originalFile || (isValidChecksum(originalChecksum) && isValidChecksum(newChecksum) && originalChecksum !== newChecksum);
            if (!needsWrite) {
                return;
            }

            const absoluteFilePath = join(absoluteProjectPath, updatedFile.path);
            const directoryPath = dirname(absoluteFilePath);

            try {
                await mkdir(directoryPath, { recursive: true });
                await Bun.write(absoluteFilePath, updatedFile.content);
                console.log(`[Agent Coder Route ${agentJobId}] Wrote code file: ${updatedFile.path}`);
            } catch (writeError: any) {
                console.error(`[Agent Coder Route ${agentJobId}] Failed to write ${updatedFile.path}: ${writeError.message}`);
                throw new Error(`Failed write: ${updatedFile.path}`); // For Promise.allSettled
            }
        });

        const writeResults = await Promise.allSettled(writePromises);
        const failedWrites = writeResults.filter(r => r.status === 'rejected');
        if (failedWrites.length > 0) {
            console.error(`[Agent Coder Route ${agentJobId}] ${failedWrites.length} file write(s) failed:`);
            failedWrites.forEach((f) => console.error(`- ${(f as PromiseRejectedResult).reason}`));
            // Optional: Add warning to response or status 207
        } else {
            console.log(`[Agent Coder Route ${agentJobId}] All necessary code file writes completed.`);
        }
    } catch (fileWriteSetupError: any) {
        console.error(`[Agent Coder Route ${agentJobId}] Error setting up code file writing: ${fileWriteSetupError.message}`);
    }
}

export const agentCoderRoutes = new OpenAPIHono()
    // --- Agent Coder Run Handler ---
    .openapi(runAgentCoderRoute, async (c) => {
        const { projectId: routeProjectId } = c.req.valid('param');
        const { userInput, selectedFileIds: routeSelectedFileIds, agentJobId: routeAgentJobId = 'no-job-id' } = c.req.valid('json');

        console.log(`[Agent Coder Route] Starting run ${routeAgentJobId} for project ${routeProjectId}`);

        // No try-catch here, let ApiErrors propagate
        // 1. Fetch project data
        const project = await getProjectById(routeProjectId);
        if (!project) throw new ApiError(404, `Project ${routeProjectId} not found.`);

        const projectFiles = await getProjectFiles(routeProjectId) ?? [];
        const projectSummaryContext = await getFullProjectSummary(routeProjectId);
        if (typeof projectSummaryContext !== 'string') {
            throw new ApiError(500, 'Project summary context error', 'PROJECT_SUMMARY_ERROR');
        }

        if (projectFiles.filter(f => routeSelectedFileIds.includes(f.id)).length === 0 && routeSelectedFileIds.length > 0) {
            console.warn(`[Agent Coder Route ${routeAgentJobId}] No matching files found for IDs: ${routeSelectedFileIds.join(', ')}`);
            // Potentially throw ApiError(404, ...) here if this is a critical error
        }

        console.log(`[Agent Coder Route ${routeAgentJobId}] Calling main orchestrator...`);
        const coderAgentDataContext: CoderAgentDataContext = {
            userInput,
            projectFiles,
            projectFileMap: buildProjectFileMap(projectFiles),
            projectSummaryContext,
            agentJobId: routeAgentJobId,
            project
        };
        const orchestratorResultData = await mainOrchestrator(coderAgentDataContext);

        console.log(`[Agent Coder Route ${routeAgentJobId}] Orchestrator finished successfully.`);

        const responsePayload: z.infer<typeof AgentCoderRunResponseSchema> = {
            success: true,
            data: {
                updatedFiles: orchestratorResultData.updatedFiles,
                taskPlan: orchestratorResultData.taskPlan === null ? undefined : orchestratorResultData.taskPlan,
                agentJobId: orchestratorResultData.agentJobId,
            }
        };
        return c.json(responsePayload, 200);
    })

    // --- List Agent Runs Handler ---
    .openapi(listAgentRunsRoute, async (c) => {
        console.log(`[Agent Runs List Route] Request received.`);
        // No try-catch, let listAgentJobs throw if it needs to (e.g. fs errors -> ApiError)
        const jobIds = await listAgentJobs(); // listAgentJobs should handle its errors or throw
        const responsePayload: z.infer<typeof ListAgentRunsResponseSchema> = {
            success: true,
            data: jobIds,
        };
        return c.json(responsePayload, 200);
    })

    // --- Get Agent Run Orchestrator Logs Handler ---
    .openapi(getAgentRunLogsRoute, async (c) => {
        const { agentJobId } = c.req.valid('param');
        console.log(`[Agent Logs Route] Request received for job ID: ${agentJobId}`);

        // No try-catch, let errors propagate or be converted to ApiError by helpers
        // 1. Get log file path
        // getOrchestratorLogFilePaths should throw ApiError if job ID is invalid or dir structure is unexpected
        const { filePath } = await getOrchestratorLogFilePaths(agentJobId);
        console.log(`[Agent Logs Route] Found log file path: ${filePath}`);

        // 2. Read log file content
        const logFile = Bun.file(filePath);
        if (!(await logFile.exists())) {
            console.error(`[Agent Logs Route] Log file not found at path: ${filePath}`);
            throw new ApiError(404, `Agent run ${agentJobId} logs not found. File does not exist: ${filePath}`, 'LOG_FILE_NOT_FOUND');
        }
        const logContent = await logFile.text(); // Bun.file.text() can throw

        // 3. Parse JSONL content
        const parsedLogs = parseJsonl(logContent);
        console.log(`[Agent Logs Route] Parsed ${parsedLogs.length} log entries.`);

        // 4. Return parsed logs
        return c.json(parsedLogs, 200);
    })

    // --- Get Agent Run Data Handler ---
    .openapi(getAgentRunDataRoute, async (c) => {
        const { agentJobId } = c.req.valid('param');
        console.log(`[Agent Data Route] Request received for job ID: ${agentJobId}`);

        // No try-catch, let errors propagate
        // 1. Get data file path
        const dataFilePath = getAgentDataLogFilePath(agentJobId); // This function should be robust
        console.log(`[Agent Data Route] Resolved data file path: ${dataFilePath}`);

        // 2. Read and parse data file content
        const dataFile = Bun.file(dataFilePath);
        if (!(await dataFile.exists())) {
            console.error(`[Agent Data Route] Data file not found at path: ${dataFilePath}`);
            throw new ApiError(404, `Agent run ${agentJobId} data not found. File does not exist: ${dataFilePath}`, 'DATA_LOG_NOT_FOUND');
        }

        // Read as JSON directly - Bun.file.json() can throw if not JSON or file issue
        const agentData = await dataFile.json(); // This will throw if parsing fails
        console.log(`[Agent Data Route] Successfully parsed data for job ${agentJobId}`);

        // 3. Return parsed data (already conforms to AgentDataLogSchema if read by dataFile.json() from a valid file)
        return c.json(agentData, 200);
    })
    .openapi(confirmAgentRunChangesRoute, async (c) => {
        const { agentJobId } = c.req.valid('param');
        console.log(`[Agent Confirm Route] Request received for job ID: ${agentJobId}`);

        // No try-catch for ApiErrors
        // 1. Get data file path
        const dataFilePath = getAgentDataLogFilePath(agentJobId);
        console.log(`[Agent Confirm Route] Reading data file path: ${dataFilePath}`);

        // 2. Read and parse data file content
        const dataFile = Bun.file(dataFilePath);
        if (!(await dataFile.exists())) {
            console.error(`[Agent Confirm Route] Data file not found at path: ${dataFilePath}`);
            throw new ApiError(404, `Agent run ${agentJobId} data log not found.`, 'AGENT_DATA_LOG_MISSING');
        }

        const agentDataLogRaw = await dataFile.json(); // Can throw

        const validationResult = AgentDataLogSchema.safeParse(agentDataLogRaw);

        // 3. Validate and Extract required data from the log
        if (!validationResult.success) {
            const error = fromZodError(validationResult.error);
            console.error(`[Agent Confirm Route] Invalid data log structure for ${agentJobId}: ${error.message}`, validationResult.error.format());
            throw new ApiError(500, `Invalid agent data log structure for agent run ${agentJobId}.`, 'AGENT_DATA_LOG_INVALID', { agentJobId, details: error.message });
        }

        const { projectId, updatedFiles: agentProposedFiles } = validationResult.data;

        if (!agentProposedFiles || agentProposedFiles.length === 0) {
            console.log(`[Agent Confirm Route ${agentJobId}] No file changes proposed in data log. Nothing to write.`);
            return c.json({
                success: true,
                message: 'No file changes were proposed by the agent. Filesystem unchanged.',
                writtenFiles: []
            } satisfies z.infer<typeof ConfirmAgentRunChangesResponseSchema>, 200);
        }

        console.log(`[Agent Confirm Route] Found ${agentProposedFiles.length} proposed file changes in data log for project ${projectId}.`);

        const projectData = await getProjectById(projectId);
        if (!projectData) {
            throw new ApiError(404, `Project ${projectId} associated with agent run ${agentJobId} not found.`, 'PROJECT_NOT_FOUND_FOR_CONFIRM');
        }
        const absoluteProjectPath = resolvePath(projectData.path);
        if (!absoluteProjectPath) {
            throw new ApiError(500, `Could not determine absolute path for project ${projectId}.`, 'PROJECT_PATH_RESOLUTION_FAILED');
        }
        console.log(`[Agent Confirm Route] Absolute project path: ${absoluteProjectPath}`);

        const originalProjectFiles = await getProjectFiles(projectId);
        if (!originalProjectFiles) {
            // This case might be an error or imply an empty project, depending on desired behavior.
            // Assuming it's an error if we expect files for comparison.
            throw new ApiError(404, `Original files for project ${projectId} could not be fetched or project is empty.`, 'ORIGINAL_FILES_NOT_FOUND_FOR_CONFIRM');
        }
        const originalProjectFileMap = buildProjectFileMap(originalProjectFiles);
        console.log(`[Agent Confirm Route] Built original project file map with ${originalProjectFileMap.size} files.`);

        // 5. Call the write function
        // writeFilesToFileSystem should ideally throw ApiError on failure, or its errors be converted.
        console.log(`[Agent Confirm Route ${agentJobId}] Calling writeFilesToFileSystem...`);
        await writeFilesToFileSystem({
            agentJobId,
            projectFileMap: originalProjectFileMap,
            absoluteProjectPath,
            updatedFiles: agentProposedFiles
        });
        console.log(`[Agent Confirm Route ${agentJobId}] writeFilesToFileSystem completed.`);

        // 6. Return Success Response
        const successPayload: z.infer<typeof ConfirmAgentRunChangesResponseSchema> = {
            success: true,
            message: 'Agent run changes successfully written to filesystem.',
            writtenFiles: agentProposedFiles.map(f => f.path)
        };
        return c.json(successPayload, 200);
    })
    .openapi(deleteAgentRunRoute, async (c) => {
        const { agentJobId } = c.req.valid('param');
        console.log(`[Agent Delete Route] Request received for job ID: ${agentJobId}`);

        const agentRunDirectory = join(AGENT_LOGS_DIR, agentJobId);

        // No try-catch for ApiError propagation
        try {
            // 1. Check if the directory exists first
            await stat(agentRunDirectory); // Throws if not found (ENOENT)
        } catch (checkError: any) {
            if (checkError.code === 'ENOENT') {
                console.warn(`[Agent Delete Route] Directory not found for ${agentJobId}: ${agentRunDirectory}`);
                throw new ApiError(404, `Agent run ${agentJobId} not found. Directory does not exist.`, 'AGENT_RUN_DIR_NOT_FOUND');
            }
            // For other errors during stat, re-throw as a server error
            console.error(`[Agent Delete Route] Error checking directory for ${agentJobId}:`, checkError);
            throw new ApiError(500, `Error checking agent run directory ${agentJobId}: ${checkError.message}`, 'AGENT_RUN_DIR_STAT_FAILED');
        }

        // 2. Delete the directory recursively
        console.log(`[Agent Delete Route] Attempting to delete directory: ${agentRunDirectory}`);
        await rm(agentRunDirectory, { recursive: true, force: true }); // rm can throw
        console.log(`[Agent Delete Route] Successfully deleted directory for ${agentJobId}`);

        // 3. Return Success Response
        const successPayload: z.infer<typeof DeleteAgentRunResponseSchema> = {
            success: true,
            message: `Agent run ${agentJobId} deleted successfully.`,
        };
        return c.json(successPayload, 200);
    })


// Helper function (remains the same)
function isValidChecksum(checksum: string | null | undefined): checksum is string {
    return typeof checksum === 'string' && /^[a-f0-9]+$/.test(checksum);
}
