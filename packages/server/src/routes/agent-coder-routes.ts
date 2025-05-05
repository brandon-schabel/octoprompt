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
        const { projectId, } = c.req.valid('param');
        const { userInput, selectedFileIds, agentJobId = 'no-job-id' } = c.req.valid('json');

        console.log(`[Agent Coder Route] Starting run ${agentJobId} for project ${projectId}`);

        try {
            // 1. Fetch project data
            const project = await getProjectById(projectId);
            if (!project) throw new ApiError(404, `Project ${projectId} not found.`);

            const projectFiles = await getProjectFiles(projectId) ?? [];
            const projectFileMap = buildProjectFileMap(projectFiles);
            const projectSummaryContext = await getFullProjectSummary(projectId);
            if (typeof projectSummaryContext !== 'string') {
                throw new ApiError(500, 'Project summary context error');
            }

            const initialFiles = projectFiles.filter(f => selectedFileIds.includes(f.id));
            // Optional: Warn/error if selectedFileIds requested but no files found (logic remains same)
            if (initialFiles.length === 0 && selectedFileIds.length > 0) {
                console.warn(`[Agent Coder Route ${agentJobId}] No matching files found for IDs: ${selectedFileIds.join(', ')}`);
            }

            // 2. Call the orchestrator (pass agentJobId)
            console.log(`[Agent Coder Route ${agentJobId}] Calling main orchestrator...`);
            const coderAgentDataContext: CoderAgentDataContext = {
                userInput,
                projectFiles,
                projectFileMap,
                projectSummaryContext,
                agentJobId,
                project
            }
            const orchestratorResult = await mainOrchestrator(coderAgentDataContext);

            console.log(`[Agent Coder Route ${agentJobId}] Orchestrator finished. Success: ${orchestratorResult.success}`);



            // 3. Write Agent Data Log (if successful)
            if (orchestratorResult.success) {
                await writeAgentDataLog(agentJobId, orchestratorResult.agentDataLog);
            } else {
                // Handle failure before file writes
                const failedTasks = orchestratorResult?.tasks?.tasks.filter(t => t.status === 'FAILED').map(t => t.title).join(', ') || 'unknown tasks';
                const message = `Agent Coder execution failed (run ${agentJobId}). Failed tasks: ${failedTasks}`;
                console.error(`[Agent Coder Route ${agentJobId}] ${message}`, orchestratorResult.tasks);
                throw new ApiError(500, message, 'AGENT_CODER_FAILED', { tasks: orchestratorResult.tasks, agentJobId });
            }



            // 5. Format and Send Success Response
            const responsePayload: z.infer<typeof AgentCoderRunResponseSchema> = {
                success: true,
                data: {
                    updatedFiles: orchestratorResult.updatedFiles,
                    taskPlan: orchestratorResult.tasks as TaskPlan,
                    agentJobId: agentJobId, // Return the ID
                }
            };
            return c.json(responsePayload, 200);
        } catch (error: any) {
            console.error(`[Agent Coder Route ${agentJobId}] Error during execution:`, error);
            const errorPayload: z.infer<typeof ApiErrorResponseSchema> = {
                success: false,
                error: {
                    code: 'RUN_ERROR',
                    message: `Failed to run agent coder: ${error instanceof Error ? error.message : String(error)}`
                }
            };
            return c.json(errorPayload, 500);
        }
    })

    // --- List Agent Runs Handler ---
    .openapi(listAgentRunsRoute, async (c) => { // KEEP THIS ROUTE
        console.log(`[Agent Runs List Route] Request received.`);
        try {
            const jobIds = await listAgentJobs(); // Uses the correct logger function
            const responsePayload: z.infer<typeof ListAgentRunsResponseSchema> = {
                success: true,
                data: jobIds,
            };
            return c.json(responsePayload, 200);
        } catch (error: any) {
            console.error(`[Agent Runs List Route] Error listing agent job IDs:`, error);
            const errorPayload: z.infer<typeof ApiErrorResponseSchema> = {
                success: false,
                error: {
                    code: 'RUN_LIST_ERROR',
                    message: `Failed to list agent runs: ${error instanceof Error ? error.message : String(error)}`
                }
            };
            return c.json(errorPayload, 500);
        }
    })

    // --- Get Agent Run Orchestrator Logs Handler ---
    .openapi(getAgentRunLogsRoute, async (c) => {
        const { agentJobId } = c.req.valid('param');
        console.log(`[Agent Logs Route] Request received for job ID: ${agentJobId}`);

        try {
            // 1. Get log file path
            const { filePath } = await getOrchestratorLogFilePaths(agentJobId);
            console.log(`[Agent Logs Route] Found log file path: ${filePath}`);

            // 2. Read log file content
            const logFile = Bun.file(filePath);
            if (!(await logFile.exists())) {
                console.error(`[Agent Logs Route] Log file not found at path: ${filePath}`);
                throw new ApiError(404, `Agent run ${agentJobId} logs not found.`);
            }
            const logContent = await logFile.text();

            // 3. Parse JSONL content
            const parsedLogs = parseJsonl(logContent);
            console.log(`[Agent Logs Route] Parsed ${parsedLogs.length} log entries.`);

            // 4. Return parsed logs
            return c.json(parsedLogs, 200);

        } catch (error: any) {
            console.error(`[Agent Logs Route] Error retrieving logs for ${agentJobId}:`, error);

            if (error instanceof ApiError && error.status === 404) {
                const errorPayload: z.infer<typeof ApiErrorResponseSchema> = {
                    success: false,
                    error: { code: 'LOGS_NOT_FOUND', message: error.message, details: { agentJobId } }
                };
                return c.json(errorPayload, 404);
            } else if (error.code === 'ENOENT') { // Handle file not found specifically if getOrchestratorLogFilePaths doesn't throw ApiError
                const errorPayload: z.infer<typeof ApiErrorResponseSchema> = {
                    success: false,
                    error: { code: 'LOGS_NOT_FOUND', message: `Log file for agent run ${agentJobId} not found.`, details: { agentJobId } }
                };
                return c.json(errorPayload, 404);
            }
            else {
                const errorPayload: z.infer<typeof ApiErrorResponseSchema> = {
                    success: false,
                    error: {
                        code: 'LOG_RETRIEVAL_ERROR',
                        message: `Failed to retrieve logs for agent run ${agentJobId}: ${error.message}`,
                        details: { agentJobId }
                    }
                };
                return c.json(errorPayload, 500);
            }
        }
    })

    // --- Get Agent Run Data Handler ---
    .openapi(getAgentRunDataRoute, async (c) => {
        const { agentJobId } = c.req.valid('param');
        console.log(`[Agent Data Route] Request received for job ID: ${agentJobId}`);

        try {
            // 1. Get data file path
            const dataFilePath = getAgentDataLogFilePath(agentJobId);
            console.log(`[Agent Data Route] Resolved data file path: ${dataFilePath}`);

            // 2. Read and parse data file content
            const dataFile = Bun.file(dataFilePath);
            if (!(await dataFile.exists())) {
                console.error(`[Agent Data Route] Data file not found at path: ${dataFilePath}`);
                throw new ApiError(404, `Agent run ${agentJobId} data not found.`);
            }

            // Read as JSON directly
            const agentData = await dataFile.json();
            console.log(`[Agent Data Route] Successfully parsed data for job ${agentJobId}`);

            // 3. Return parsed data
            return c.json(agentData, 200);

        } catch (error: any) {
            console.error(`[Agent Data Route] Error retrieving data for ${agentJobId}:`, error);

            // Handle specific errors
            if (error instanceof ApiError && error.status === 404) {
                const errorPayload: z.infer<typeof ApiErrorResponseSchema> = {
                    success: false,
                    error: { code: 'DATA_NOT_FOUND', message: error.message, details: { agentJobId } }
                };
                return c.json(errorPayload, 404);
            } else if (error instanceof SyntaxError) { // Handle JSON parsing error
                const errorPayload: z.infer<typeof ApiErrorResponseSchema> = {
                    success: false,
                    error: { code: 'DATA_PARSE_ERROR', message: `Failed to parse data file for agent run ${agentJobId}. Invalid JSON.`, details: { agentJobId, error: error.message } }
                };
                return c.json(errorPayload, 500);
            } else if (error.code === 'ENOENT') { // Handle file system error more explicitly
                const errorPayload: z.infer<typeof ApiErrorResponseSchema> = {
                    success: false,
                    error: { code: 'DATA_NOT_FOUND', message: `Data file for agent run ${agentJobId} not found.`, details: { agentJobId } }
                };
                return c.json(errorPayload, 404);
            }
            else { // Generic server error
                const errorPayload: z.infer<typeof ApiErrorResponseSchema> = {
                    success: false,
                    error: {
                        code: 'DATA_RETRIEVAL_ERROR',
                        message: `Failed to retrieve data for agent run ${agentJobId}: ${error.message}`,
                        details: { agentJobId }
                    }
                };
                return c.json(errorPayload, 500);
            }
        }
    })
    .openapi(confirmAgentRunChangesRoute, async (c) => {
        const { agentJobId } = c.req.valid('param');
        console.log(`[Agent Confirm Route] Request received for job ID: ${agentJobId}`);

        try {
            // 1. Get data file path
            const dataFilePath = getAgentDataLogFilePath(agentJobId);
            console.log(`[Agent Confirm Route] Reading data file path: ${dataFilePath}`);

            // 2. Read and parse data file content
            const dataFile = Bun.file(dataFilePath);
            if (!(await dataFile.exists())) {
                console.error(`[Agent Confirm Route] Data file not found at path: ${dataFilePath}`);
                throw new ApiError(404, `Agent run ${agentJobId} data log not found.`);
            }

            const agentDataLogRaw = await dataFile.json();

            const validationResult = AgentDataLogSchema.safeParse(agentDataLogRaw);


            // 3. Validate and Extract required data from the log
            if (!validationResult.success) {
                const error = fromZodError(validationResult.error);
                console.error(`[Agent Confirm Route] Invalid data log structure for ${agentJobId}: ${error.message}`, validationResult.error.format());
                // Use the specific schema name in the error code if desired
                throw new ApiError(500, `Invalid agent data log structure for agent run ${agentJobId}.`, 'AGENT_DATA_LOG_INVALID', { agentJobId, details: error.message });
            }

            // Extract data - field names 'projectId' and 'updatedFiles' are the same
            const { projectId, updatedFiles } = validationResult.data;


            console.log(`[Agent Confirm Route] Found ${updatedFiles?.length ?? 0} proposed file changes in data log for project ${projectId}.`);

            // 4. Fetch Original Project Data (needed for comparison in writeFilesToFileSystem)
            const project = await getProjectById(projectId);
            if (!project) {
                throw new ApiError(404, `Project ${projectId} associated with agent run ${agentJobId} not found.`);
            }
            // Ensure you have a way to resolve the project's base path
            // You might need a configuration variable for the base directory if it's relative
            const absoluteProjectPath = resolvePath(project.path); // Use your path resolution logic
            if (!absoluteProjectPath) {
                throw new ApiError(500, `Could not determine absolute path for project ${projectId}.`);
            }
            console.log(`[Agent Confirm Route] Absolute project path: ${absoluteProjectPath}`);


            const originalProjectFiles = await getProjectFiles(projectId);
            if (!originalProjectFiles) {
                throw new ApiError(404, `Original files for project ${projectId} could not be fetched.`);
            }
            const originalProjectFileMap = buildProjectFileMap(originalProjectFiles);
            console.log(`[Agent Confirm Route] Built original project file map with ${originalProjectFileMap.size} files.`);


            // 5. Call the write function
            console.log(`[Agent Confirm Route ${agentJobId}] Calling writeFilesToFileSystem...`);
            await writeFilesToFileSystem({
                agentJobId,
                projectFileMap: originalProjectFileMap, // Pass the ORIGINAL map
                absoluteProjectPath,
                updatedFiles: updatedFiles ?? [] // Pass the files proposed by the agent run
            });
            console.log(`[Agent Confirm Route ${agentJobId}] writeFilesToFileSystem completed.`);
            // NOTE: writeFilesToFileSystem logs errors internally but doesn't throw for individual file failures.
            // We assume success here if the overall function didn't throw.

            // 6. Return Success Response
            const successPayload: z.infer<typeof ConfirmAgentRunChangesResponseSchema> = {
                success: true,
                message: 'Agent run changes successfully written to filesystem.',
                // Return the paths that were *intended* to be written.
                writtenFiles: updatedFiles?.map(f => f.path) ?? []
            };
            return c.json(successPayload, 200);

        } catch (error: any) {
            console.error(`[Agent Confirm Route] Error confirming changes for ${agentJobId}:`, error);

            // Handle specific known errors (like 404)
            if (error instanceof ApiError) {
                const errorPayload: z.infer<typeof ApiErrorResponseSchema> = {
                    success: false,
                    error: { code: error.code ?? 'CONFIRM_ERROR', message: error.message, details: { agentJobId, ...(error.details as Record<string, any>) } }
                };
                // Return using the correct schema and declared status
                return c.json(errorPayload, error.status as (404 | 500));
            } else if (error instanceof SyntaxError) { // JSON parsing error
                const errorPayload: z.infer<typeof ApiErrorResponseSchema> = {
                    success: false,
                    error: { code: 'DATA_PARSE_ERROR', message: `Failed to parse data log file for agent run ${agentJobId}. Invalid JSON.`, details: { agentJobId, error: error.message } }
                };
                // Return using the correct schema and declared status (500)
                return c.json(errorPayload, 500);
            } else if (error.code === 'ENOENT') { // File system error (e.g., Bun.file not found)
                const errorPayload: z.infer<typeof ApiErrorResponseSchema> = {
                    success: false,
                    error: { code: 'DATA_NOT_FOUND', message: `Data log file for agent run ${agentJobId} not found.`, details: { agentJobId } }
                };
                // Return using the correct schema and declared status (404)
                return c.json(errorPayload, 404);
            }
            else { // Generic server error
                const errorPayload: z.infer<typeof ApiErrorResponseSchema> = {
                    success: false,
                    error: {
                        code: 'CONFIRM_FAILED',
                        message: `Failed to confirm agent run changes for ${agentJobId}: ${error.message}`,
                        details: { agentJobId }
                    }
                };
                return c.json(errorPayload, 500);
            }
        }
    })
    .openapi(deleteAgentRunRoute, async (c) => {
        const { agentJobId } = c.req.valid('param');
        console.log(`[Agent Delete Route] Request received for job ID: ${agentJobId}`);

        const agentRunDirectory = join(AGENT_LOGS_DIR, agentJobId);

        try {
            // 1. Check if the directory exists first (optional but good practice for 404)
            try {
                await stat(agentRunDirectory); // Check if path exists and is accessible
            } catch (checkError: any) {
                if (checkError.code === 'ENOENT') {
                    console.warn(`[Agent Delete Route] Directory not found for ${agentJobId}: ${agentRunDirectory}`);
                    throw new ApiError(404, `Agent run ${agentJobId} not found.`);
                }
                // Re-throw other errors during the check
                throw checkError;
            }

            // 2. Delete the directory recursively
            console.log(`[Agent Delete Route] Attempting to delete directory: ${agentRunDirectory}`);
            await rm(agentRunDirectory, { recursive: true, force: true }); // Use recursive and force
            console.log(`[Agent Delete Route] Successfully deleted directory for ${agentJobId}`);

            // 3. Return Success Response
            const successPayload: z.infer<typeof DeleteAgentRunResponseSchema> = {
                success: true,
                message: `Agent run ${agentJobId} deleted successfully.`,
            };
            return c.json(successPayload, 200);

        } catch (error: any) {
            console.error(`[Agent Delete Route] Error deleting run ${agentJobId}:`, error);

            if (error instanceof ApiError && error.status === 404) {
                const errorPayload: z.infer<typeof ApiErrorResponseSchema> = {
                    success: false,
                    error: { code: 'RUN_NOT_FOUND', message: error.message, details: { agentJobId } }
                };
                return c.json(errorPayload, 404);
            } else { // Generic server error
                const errorPayload: z.infer<typeof ApiErrorResponseSchema> = {
                    success: false,
                    error: {
                        code: 'DELETE_FAILED',
                        message: `Failed to delete agent run ${agentJobId}: ${error.message}`,
                        details: { agentJobId }
                    }
                };
                return c.json(errorPayload, 500);
            }
        }
    })


// Helper function (remains the same)
function isValidChecksum(checksum: string | null | undefined): checksum is string {
    return typeof checksum === 'string' && /^[a-f0-9]+$/.test(checksum);
}
