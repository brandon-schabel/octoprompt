import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { dirname, join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { Context } from 'hono';

import { ApiError } from 'shared';
import { ApiErrorResponseSchema } from 'shared/src/schemas/common.schemas';
import { ProjectFile, ProjectIdParamsSchema } from 'shared/src/schemas/project.schemas';

import { mainOrchestrator, AgentCoderRunRequestSchema as OriginalAgentCoderRunRequestSchema, AgentCoderRunResponseSchema } from '@/services/agents/agent-coder-service';
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

            // Convert Map<string, ProjectFile> or ProjectFile[] back to ProjectFile[] for the response/writing
            // Handle potential Map return type
            const orchestratorFiles = orchestratorResult.files ?? [];
            resultFilesForResponse = Array.isArray(orchestratorFiles)
                ? orchestratorFiles
                : Array.from(orchestratorFiles.values());

            // 4. Check orchestrator result
            if (!orchestratorResult.success) {
                const failedTasks = orchestratorResult.tasks?.tasks.filter(t => t.status === 'FAILED').map(t => t.title).join(', ') || 'unknown tasks';
                const message = `Agent Coder execution failed. Failed tasks: ${failedTasks}`;
                console.error(`[Agent Coder Route] ${message}`, orchestratorResult.tasks);
                // Throw 500, but include task details if available
                throw new ApiError(500, message, 'AGENT_CODER_FAILED', { tasks: orchestratorResult.tasks });
            }

            // --- 5. Write updated/new files to filesystem ---
            if (resultFilesForResponse.length > 0) {
                console.log(`[Agent Coder Route] Writing ${resultFilesForResponse.length} updated/new files to filesystem...`);
                try {
                    const absoluteProjectPath = resolvePath(project.path); // Get absolute project root

                    // Fetch original files again to compare checksums (more reliable than comparing content strings)
                    // Alternatively, the orchestrator could return *only* the changed files with original checksums included.
                    // For simplicity now, let's re-fetch or use the previously fetched map.
                    const originalFileMap = projectFileMap; // Use the map fetched earlier

                    const writePromises = resultFilesForResponse.map(async (updatedFile) => {
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


            // 6. Format and Send Success Response
            const responsePayload: z.infer<typeof AgentCoderRunResponseSchema> = {
                success: true,
                data: {
                    updatedFiles: resultFilesForResponse, // Return the state as determined by the orchestrator
                    taskPlan: orchestratorResult.tasks ?? undefined
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
    });

// Helper function (you might already have this elsewhere)
function isValidChecksum(checksum: string | null | undefined): checksum is string {
    return typeof checksum === 'string' && /^[a-f0-9]+$/.test(checksum);
}
