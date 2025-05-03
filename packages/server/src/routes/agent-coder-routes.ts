import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { dirname, join } from 'node:path';
import { mkdir, readdir, stat } from 'node:fs/promises';

import { ApiError } from 'shared';
import { ApiErrorResponseSchema } from 'shared/src/schemas/common.schemas';
import { ProjectFileSchema, ProjectIdParamsSchema, type ProjectFile } from 'shared/src/schemas/project.schemas';
import { v4 as uuidv4 } from 'uuid';

import { mainOrchestrator, } from '@/services/agents/agent-coder-service';
import { AgentCoderRunRequestSchema, AgentCoderRunResponseSchema, AgentTaskPlanSchema, TaskPlan, AgentCoderRunSuccessDataSchema } from 'shared/src/schemas/agent-coder.schemas';
import { AGENT_LOGS_DIR, getOrchestratorLogFilePaths, listAgentJobs, writeAgentDataLog, getAgentDataLogFilePath } from '@/services/agents/agent-logger';


import { getProjectById, getProjectFiles, getProjectFilesByIds } from '@/services/project-service';
import { buildProjectFileMap } from 'shared/src/utils/projects-utils';
import { getFullProjectSummary } from '@/utils/get-full-project-summary';
import { resolvePath } from '@/utils/path-utils';

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
            content: { 'application/json': { schema: AgentRunDataResponseSchema } }, // Reference the data schema
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
            const orchestratorResult = await mainOrchestrator({
                userInput,
                projectFiles,
                projectFileMap,
                projectSummaryContext,
                agentJobId,
                projectId,
            });

            console.log(`[Agent Coder Route ${agentJobId}] Orchestrator finished. Success: ${orchestratorResult.success}`);

            // Assume orchestratorResult includes an `agentDataLog` object for the data file
            // Let's define a more specific type for the expected successful result
            type OrchestratorSuccessResult = {
                success: true;
                files: ProjectFile[];
                tasks: TaskPlan | null;
                agentJobId: string; // Expect agentJobId back, though we already have it
                agentDataLog: Record<string, any>; // The data to be saved
            };

            // Type guard for success
            function isSuccessResult(result: any): result is OrchestratorSuccessResult {
                return result && result.success === true && typeof result.agentJobId === 'string' && typeof result.agentDataLog === 'object';
            }

            // 3. Write Agent Data Log (if successful)
            if (isSuccessResult(orchestratorResult)) {
                await writeAgentDataLog(agentJobId, orchestratorResult.agentDataLog);
            } else {
                // Handle failure before file writes
                const failedTasks = orchestratorResult.tasks?.tasks.filter(t => t.status === 'FAILED').map(t => t.title).join(', ') || 'unknown tasks';
                const message = `Agent Coder execution failed (run ${agentJobId}). Failed tasks: ${failedTasks}`;
                console.error(`[Agent Coder Route ${agentJobId}] ${message}`, orchestratorResult.tasks);
                throw new ApiError(500, message, 'AGENT_CODER_FAILED', { tasks: orchestratorResult.tasks, agentJobId });
            }

            // Type assertion after check
            const successfulResult = orchestratorResult as OrchestratorSuccessResult;

            // --- 4. Write updated/new code files to filesystem ---
            if (successfulResult.files.length > 0) {
                console.log(`[Agent Coder Route ${agentJobId}] Writing ${successfulResult.files.length} updated/new code files...`);
                try {
                    const absoluteProjectPath = resolvePath(project.path);
                    const originalFileMap = projectFileMap;

                    const writePromises = successfulResult.files.map(async (updatedFile) => {
                        if (updatedFile.content === null || updatedFile.content === undefined) {
                            console.warn(`[Agent Coder Route ${agentJobId}] Skipping write for ${updatedFile.path} (null content).`);
                            return;
                        }
                        const originalFile = originalFileMap.get(updatedFile.id);
                        const originalChecksum = originalFile?.checksum;
                        const newChecksum = (updatedFile.content !== null && updatedFile.content !== undefined)
                            ? (updatedFile.checksum ?? Bun.hash(updatedFile.content).toString(16))
                            : updatedFile.checksum;

                        const needsWrite = !originalFile || (isValidChecksum(originalChecksum) && isValidChecksum(newChecksum) && originalChecksum !== newChecksum);
                        if (!needsWrite) {
                            // console.log(`[Agent Coder Route ${agentJobId}] Skipping unchanged file: ${updatedFile.path}`);
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
                    // Log and continue, data is already saved, response indicates success but maybe with warnings?
                }
            } else {
                console.log(`[Agent Coder Route ${agentJobId}] Orchestrator returned no code files to write.`);
            }
            // --- End Code File Writing ---

            // 5. Format and Send Success Response
            const responsePayload: z.infer<typeof AgentCoderRunResponseSchema> = {
                success: true,
                data: {
                    updatedFiles: successfulResult.files,
                    taskPlan: successfulResult.tasks as TaskPlan,
                    agentJobId: agentJobId, // Return the ID
                }
            };
            return c.json(responsePayload, 200);

        } catch (error: any) {
            console.error(`[Agent Coder Route ${agentJobId}] Error during execution:`, error);
            // Close logger if it was initialized and an error occurred
            // await closeLogger(); // Consider adding this if errors leave logger open

            if (error instanceof ApiError) {
                const status = [404, 422, 500].includes(error.status) ? error.status : 500;
                const errorDetails = (typeof error.details === 'object' && error.details !== null)
                    ? { ...error.details, agentJobId } // Add agentJobId to error details
                    : { agentJobId };
                const errorPayload: z.infer<typeof ApiErrorResponseSchema> = {
                    success: false,
                    error: { code: error.code, message: error.message, details: errorDetails }
                };
                return c.json(errorPayload, status as 404 | 422 | 500);
            } else {
                // Generic error
                const errorPayload: z.infer<typeof ApiErrorResponseSchema> = {
                    success: false,
                    error: {
                        code: 'AGENT_CODER_EXECUTION_ERROR',
                        message: `Agent Coder failed (run ${agentJobId}): ${error.message}`,
                        details: { agentJobId }
                    }
                };
                return c.json(errorPayload, 500);
            }
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
    });

// Helper function (remains the same)
function isValidChecksum(checksum: string | null | undefined): checksum is string {
    return typeof checksum === 'string' && /^[a-f0-9]+$/.test(checksum);
}
