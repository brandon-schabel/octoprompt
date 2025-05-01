import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { dirname, join } from 'node:path';
import { mkdir, readdir, stat } from 'node:fs/promises';

import { ApiError } from 'shared';
import { ApiErrorResponseSchema } from 'shared/src/schemas/common.schemas';
import { ProjectFile, ProjectIdParamsSchema } from 'shared/src/schemas/project.schemas';

import { mainOrchestrator, AgentCoderRunRequestSchema as OriginalAgentCoderRunRequestSchema, AgentCoderRunResponseSchema, TaskPlan } from '@/services/agents/agent-coder-service';
import { AGENT_LOGS_DIR, getOrchestratorLogFilePath, listLogFiles } from '@/services/agents/agent-logger';

const AgentCoderRunRequestSchema = OriginalAgentCoderRunRequestSchema.extend({
    runTests: z.boolean().optional().default(false).describe('Whether to attempt running tests after code generation'),
});

import { getProjectById, getProjectFiles, getProjectFilesByIds } from '@/services/project-service';
import { buildProjectFileMap } from 'shared/src/utils/projects-utils';
import { getFullProjectSummary } from '@/utils/get-full-project-summary';
import { resolvePath } from '@/utils/path-utils';

const runAgentCoderRoute = createRoute({
    method: 'post',
    path: '/api/projects/{projectId}/agent-coder',
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
            content: { 'application/json': { schema: AgentCoderRunResponseSchema } },
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

// --- Helper: JSONL Parser ---
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
                // Skip lines that fail to parse
                console.warn(`[JSONL Parser] Skipping invalid line: ${trimmedLine.substring(0, 100)}...`, error); // Log warning for debugging
            }
        }
    }
    return parsedObjects;
}

// --- Route for Getting Agent Logs ---

// Use the same pattern as the logger to identify log files
const LOG_FILE_PATTERN_FOR_ROUTE = /^agent-orchestrator-(.+)\.jsonl$/;

// Renamed schema for clarity as it's now query params
const AgentCoderLogQuerySchema = z.object({
    logId: z.string().optional().openapi({ description: 'The unique ID of the log file to retrieve. If omitted, the latest log will be returned.' })
});

const getAgentCoderLogsRoute = createRoute({
    method: 'get',
    path: '/api/agent-coder/logs', // Removed {logId?} from path
    tags: ['AI', 'Agent', 'Logs'],
    summary: 'Retrieve the execution logs for a specific Agent Coder run or the latest run via logId query parameter',
    request: {
        // Moved logId schema to query
        query: AgentCoderLogQuerySchema, // Changed from params to query
    },
    responses: {
        200: {
            content: { 'application/json': { schema: z.array(z.record(z.unknown())) } },
            description: 'Agent Coder log file content as an array of JSON objects',
        },
        404: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Log file not found',
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error reading log file',
        },
    },
});

// --- Route for Listing Agent Logs ---

const ListAgentCoderLogsResponseSchema = z.object({
    success: z.boolean(),
    data: z.array(z.string()).openapi({ description: 'List of available agent log filenames' })
});

const listAgentCoderLogsRoute = createRoute({
    method: 'get',
    path: '/api/agent-coder/logs/list',
    tags: ['AI', 'Agent', 'Logs'],
    summary: 'List available Agent Coder log filenames',
    responses: {
        200: {
            content: { 'application/json': { schema: ListAgentCoderLogsResponseSchema } },
            description: 'List of available agent log filenames',
        },
        500: {
            content: { 'application/json': { schema: ApiErrorResponseSchema } },
            description: 'Internal Server Error retrieving log list',
        },
    },
});

export const agentCoderRoutes = new OpenAPIHono()
    .openapi(runAgentCoderRoute, async (c) => {
        const { projectId } = c.req.valid('param');
        const { userInput, selectedFileIds, runTests = false /*, selectedPromptIds */ } = c.req.valid('json');

        console.log(`[Agent Coder Route] Received request for project ${projectId}`);

        let resultFilesForResponse: ProjectFile[] = []; // Store files for the response

        try {
            // 1. Fetch necessary project data (combine fetches if possible)
            const project = await getProjectById(projectId); // Fetch project details
            if (!project) {
                throw new ApiError(404, `Project ${projectId} not found.`);
            }
            const projectFiles = await getProjectFiles(projectId); // Fetch all current files
            const projectFileMap = buildProjectFileMap(projectFiles ?? []);
            const projectSummaryContext = await getFullProjectSummary(projectId);

            if (typeof projectSummaryContext !== 'string') {
                throw new ApiError(500, 'Project summary context is not a string', 'PROJECT_SUMMARY_CONTEXT_NOT_A_STRING');
            }

            // Check initial files (context for the agent)
            const initialFiles = projectFiles?.filter(f => selectedFileIds.includes(f.id)) ?? [];
            if (initialFiles.length === 0 && selectedFileIds.length > 0) {
                // Don't throw error if no files were selected, but do if specific IDs were requested and not found.
                console.warn(`[Agent Coder Route] No matching files found for the provided IDs in project ${projectId}.`);
                // Depending on requirements, you might still want to throw an error here.
                // throw new ApiError(404, `No matching files found for the provided IDs in project ${projectId}.`, 'NO_MATCHING_FILES_FOUND');
            }


            // 2. TODO: Combine prompts if selectedPromptIds are used
            // const combinedUserInput = ...

            console.log(`[Agent Coder Route] Starting orchestrator for project ${projectId}.`);

            // 3. Call the orchestrator
            // Pass the full project files array for context, orchestrator decides what to use/modify
            const orchestratorResult = await mainOrchestrator({
                userInput,
                projectFiles: projectFiles ?? [],
                projectFileMap, // Pass the map derived from *all* project files
                projectSummaryContext,
                // Note: mainOrchestrator internally uses the projectFileMap to get current state
                // Ensure it handles the initial files correctly if needed.
            });

            console.log(`[Agent Coder Route] Orchestrator finished for project ${projectId}. Success: ${orchestratorResult.success}`);

            // Explicitly type the result to guide TypeScript inference
            const typedOrchestratorResult: {
                success: boolean;
                files: ProjectFile[];
                tasks: TaskPlan | null;
                logId: string
            } = orchestratorResult;

            // 4. Check orchestrator result
            if (!typedOrchestratorResult.success) { // Use the typed result
                const failedTasks = typedOrchestratorResult.tasks?.tasks.filter(t => t.status === 'FAILED').map(t => t.title).join(', ') || 'unknown tasks';
                const message = `Agent Coder execution failed. Failed tasks: ${failedTasks}`;
                console.error(`[Agent Coder Route] ${message}`, typedOrchestratorResult.tasks);
                // Throw 500, but include task details if available
                throw new ApiError(500, message, 'AGENT_CODER_FAILED', { tasks: typedOrchestratorResult.tasks });
            }

            // --- 5. Write updated/new files to filesystem ---
            if (typedOrchestratorResult.files.length > 0) {
                console.log(`[Agent Coder Route] Writing ${typedOrchestratorResult.files.length} updated/new files to filesystem...`);
                try {
                    const absoluteProjectPath = resolvePath(project.path); // Get absolute project root
                    const originalFileMap = projectFileMap; // Use the map fetched earlier

                    const writePromises = typedOrchestratorResult.files.map(async (updatedFile) => {
                        // Basic check: only write files with content
                        if (updatedFile.content === null || updatedFile.content === undefined) {
                            console.warn(`[Agent Coder Route] Skipping file write for ${updatedFile.path} due to null content.`);
                            return;
                        }

                        // Find the original file state (if it existed)
                        const originalFile = originalFileMap.get(updatedFile.id);
                        const originalChecksum = originalFile?.checksum;
                        // Recalculate if missing or null/undefined (ensure content is not null first)
                        const newChecksum = (updatedFile.content !== null && updatedFile.content !== undefined)
                            ? (updatedFile.checksum ?? Bun.hash(updatedFile.content).toString(16))
                            : updatedFile.checksum; // Keep original if content is null


                        // Determine if write is needed:
                        // - File is new (no originalFile) OR
                        // - Checksum has changed (and both are valid)
                        const needsWrite = !originalFile || (isValidChecksum(originalChecksum) && isValidChecksum(newChecksum) && originalChecksum !== newChecksum);

                        if (!needsWrite) {
                            console.log(`[Agent Coder Route] Skipping unchanged file: ${updatedFile.path}`);
                            return;
                        }

                        const absoluteFilePath = join(absoluteProjectPath, updatedFile.path); // Use join
                        const directoryPath = dirname(absoluteFilePath); // Use dirname

                        try {
                            // Ensure parent directory exists
                            await mkdir(directoryPath, { recursive: true }); // Use fsPromises.mkdir
                            // Write the file content
                            await Bun.write(absoluteFilePath, updatedFile.content);
                            console.log(`[Agent Coder Route] Successfully wrote file: ${updatedFile.path}`);
                        } catch (writeError: any) {
                            console.error(`[Agent Coder Route] Failed to write file ${updatedFile.path}: ${writeError.message}`);
                            // Throw error to be caught by Promise.allSettled
                            throw new Error(`Failed to write ${updatedFile.path}: ${writeError.message}`);
                        }
                    });

                    // Execute all writes concurrently and collect results
                    const writeResults = await Promise.allSettled(writePromises);
                    const failedWrites = writeResults.filter(r => r.status === 'rejected');

                    if (failedWrites.length > 0) {
                        console.error(`[Agent Coder Route] ${failedWrites.length} file(s) failed to write to filesystem:`);
                        failedWrites.forEach((failure) => {
                            console.error(`- ${(failure as PromiseRejectedResult).reason}`);
                        });
                        // Optional: Add a warning to the response or change status code
                        // c.status(207); // Multi-Status could be appropriate
                    } else {
                        console.log(`[Agent Coder Route] All necessary file writes completed successfully.`);
                    }

                } catch (fileWriteSetupError: any) {
                    // Error preparing for writes (e.g., resolving project path)
                    console.error(`[Agent Coder Route] Error setting up file writing for project ${projectId}: ${fileWriteSetupError.message}`);
                    // Decide how to handle this - maybe add a warning?
                    // For now, log it and still return the orchestrator result.
                }
            } else {
                console.log(`[Agent Coder Route] Orchestrator returned no files to write.`);
            }
            // --- End File Writing ---

            // 6. Check orchestrator result again for final response structure
            if (!typedOrchestratorResult.success) { // Use typed result
                // This case should ideally be caught earlier, but handle defensively
                console.error("[Agent Coder Route] Orchestrator returned success=false unexpectedly at response stage.", typedOrchestratorResult.tasks);
                throw new ApiError(500, "Agent Coder failed during execution.", 'AGENT_CODER_FAILED_LATE', { tasks: typedOrchestratorResult.tasks });
            }

            // 7. Format and Send Success Response
            // Construct payload directly from successful orchestrator result
            const responsePayload: z.infer<typeof AgentCoderRunResponseSchema> = {
                success: true, // Known true because we checked typedOrchestratorResult.success
                data: {
                    // Use files directly from the successful result
                    updatedFiles: typedOrchestratorResult.files,
                    taskPlan: typedOrchestratorResult.tasks ?? undefined,
                    logId: typedOrchestratorResult.logId
                }
            };
            return c.json(responsePayload, 200);

        } catch (error: any) {
            console.error(`[Agent Coder Route] Error executing agent for project ${projectId}:`, error);
            if (error instanceof ApiError) {
                // Ensure the status code aligns with defined responses (404, 422, 500)
                const status = [404, 422, 500].includes(error.status) ? error.status : 500;
                // Construct payload conforming to ApiErrorResponseSchema, safely handling details
                const errorDetails = (typeof error.details === 'object' && error.details !== null)
                    ? error.details as Record<string, any>
                    : undefined;
                const errorPayload: z.infer<typeof ApiErrorResponseSchema> = {
                    success: false,
                    error: { code: error.code, message: error.message, details: errorDetails }
                };
                return c.json(errorPayload, status as 404 | 422 | 500);
            }
            // Generic internal server error
            const errorPayload: z.infer<typeof ApiErrorResponseSchema> = { success: false, error: { code: 'AGENT_CODER_EXECUTION_ERROR', message: `Failed to execute Agent Coder: ${error.message}` } };
            return c.json(errorPayload, 500);
        }
    })
    // Add the new logs route handler
    .openapi(getAgentCoderLogsRoute, async (c) => {
        const { logId } = c.req.valid('query'); // Corrected: Changed from 'param' to 'query'

        console.log(`[Agent Logs Route] Request for logId query: ${logId ?? 'latest'}`);

        try {
            let logFilePath: string;

            if (logId) {
                // Specific log ID provided
                const { filePath, logId: logIdFromFilePath } = getOrchestratorLogFilePath(logId);
                logFilePath = filePath;
                console.log(`[Agent Logs Route] Using specific log path: ${filePath}, logId: ${logIdFromFilePath}`);
            } else {
                // No log ID, find the latest log
                console.log(`[Agent Logs Route] No logId provided, searching for latest log in ${AGENT_LOGS_DIR}`);
                const files = await readdir(AGENT_LOGS_DIR);
                // Corrected filter: Use the regex pattern to find .jsonl files
                const logFiles = files.filter(f => LOG_FILE_PATTERN_FOR_ROUTE.test(f));

                if (logFiles.length === 0) {
                    console.warn(`[Agent Logs Route] No matching *.jsonl log files found in ${AGENT_LOGS_DIR}`); // Updated warning
                    const errorPayload404: z.infer<typeof ApiErrorResponseSchema> = {
                        success: false,
                        error: { code: 'LOG_NOT_FOUND', message: `No agent log files found.` }
                    };
                    return c.json(errorPayload404, 404);
                }

                // Get stats for each log file to find the most recent
                const fileStats = await Promise.all(
                    logFiles.map(async (file) => {
                        const filePath = join(AGENT_LOGS_DIR, file);
                        const stats = await stat(filePath);
                        return { path: filePath, mtimeMs: stats.mtimeMs };
                    })
                );

                // Sort by modification time descending
                fileStats.sort((a, b) => b.mtimeMs - a.mtimeMs);
                logFilePath = fileStats[0].path;
                console.log(`[Agent Logs Route] Found latest log file: ${logFilePath}`);
            }

            // Now read the determined log file
            const logFile = Bun.file(logFilePath);
            const exists = await logFile.exists();

            if (!exists) {
                const message = logId
                    ? `Log file with ID ${logId} not found.`
                    : `Latest log file (${logFilePath}) not found or inaccessible.`;
                console.warn(`[Agent Logs Route] Log file not found: ${logFilePath}`);
                const errorPayload404: z.infer<typeof ApiErrorResponseSchema> = {
                    success: false,
                    error: { code: 'LOG_NOT_FOUND', message }
                };
                return c.json(errorPayload404, 404);
            }

            const logContent = await logFile.text();
            console.log(`[Agent Logs Route] Successfully retrieved log file: ${logFilePath}`);

            // Parse the JSONL content
            const parsedLogs = parseJsonl(logContent);

            // Return the parsed logs as JSON
            return c.json(parsedLogs, 200);

        } catch (error: any) {
            // Handle specific Bun errors or fs errors if needed
            if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
                console.error(`[Agent Logs Route] Directory or file not found:`, error);
                const errorPayload404: z.infer<typeof ApiErrorResponseSchema> = {
                    success: false,
                    error: { code: 'AGENT_LOGS_DIRECTORY_NOT_FOUND', message: `Log directory or specific log file not found: ${error.message}` }
                };
                return c.json(errorPayload404, 404);
            }

            console.error(`[Agent Logs Route] Error retrieving log (query: ${logId ?? 'latest'}):`, error);

            // Removed specific ApiError 404 check as it's less likely with the new logic structure

            const errorPayload500: z.infer<typeof ApiErrorResponseSchema> = {
                success: false,
                error: { code: 'LOG_RETRIEVAL_ERROR', message: `Failed to retrieve logs: ${error instanceof Error ? error.message : String(error)}` }
            };
            return c.json(errorPayload500, 500);
        }
    })
    // Add the new route handler for listing logs
    .openapi(listAgentCoderLogsRoute, async (c) => {
        console.log(`[Agent Logs List Route] Request received.`);
        try {
            const logFilenames = await listLogFiles();
            const responsePayload: z.infer<typeof ListAgentCoderLogsResponseSchema> = {
                success: true,
                data: logFilenames,
            };
            return c.json(responsePayload, 200);
        } catch (error: any) {
            console.error(`[Agent Logs List Route] Error listing log files:`, error);
            const errorPayload: z.infer<typeof ApiErrorResponseSchema> = {
                success: false,
                error: {
                    code: 'LOG_LIST_ERROR',
                    message: `Failed to list agent logs: ${error instanceof Error ? error.message : String(error)}`
                }
            };
            return c.json(errorPayload, 500);
        }
    });

// Helper function (you might already have this elsewhere)
function isValidChecksum(checksum: string | null | undefined): checksum is string {
    return typeof checksum === 'string' && /^[a-f0-9]+$/.test(checksum);
}
