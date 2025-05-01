// packages/server/src/routes/agent-coder-routes.ts
import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { z } from 'zod';

import { ApiError } from 'shared';
import { ApiErrorResponseSchema } from 'shared/src/schemas/common.schemas';
import { ProjectIdParamsSchema } from 'shared/src/schemas/project.schemas';


import { mainOrchestrator, AgentCoderRunRequestSchema, AgentCoderRunResponseSchema } from '@/services/agents/agent-coder-service';
import { getProjectFiles, getProjectFilesByIds } from '@/services/project-service';
import { buildProjectFileMap } from 'shared/src/utils/projects-utils';
import { getFullProjectSummary } from '@/utils/get-full-project-summary';


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

        try {
            // 1. Fetch selected files
            const projectFiles = await getProjectFiles(projectId);
            const projectFileMap = buildProjectFileMap(projectFiles ?? []);
            const projectSummaryContext = await getFullProjectSummary(projectId);

            if (typeof projectSummaryContext !== 'string') {
                throw new ApiError(500, 'Project summary context is not a string', 'PROJECT_SUMMARY_CONTEXT_NOT_A_STRING');
            }


            // grab files by selectedFileIds
            const initialFiles = projectFiles?.filter(f => selectedFileIds.includes(f.id)) ?? [];

            if (initialFiles.length === 0) {
                throw new ApiError(404, `No matching files found for the provided IDs in project ${projectId}.`, 'NO_MATCHING_FILES_FOUND');
            }

            // 2. TODO: Combine prompts if selectedPromptIds are used
            // const combinedUserInput = ...

            console.log(`[Agent Coder Route] Starting orchestrator for project ${projectId} with ${initialFiles.length} files.`);

            // 3. Call the orchestrator
            const result = await mainOrchestrator({ userInput, projectFiles: projectFiles ?? [], runTests, projectFileMap, projectSummaryContext });

            console.log(`[Agent Coder Route] Orchestrator finished for project ${projectId}. Success: ${result.success}`);

            // Convert Map<string, ProjectFile> back to ProjectFile[] for the response
            const updatedFilesArray = result.files ? Array.from(result.files.values()) : [];

            // 4. Check result and Format Response
            if (!result.success) {
                const failedTasks = result.tasks?.tasks.filter(t => t.status === 'FAILED').map(t => t.title).join(', ') || 'unknown tasks';
                const message = `Agent Coder execution failed. Failed tasks: ${failedTasks}`;
                console.error(`[Agent Coder Route] ${message}`, result.tasks);
                // Throw 500, but include task details if available
                throw new ApiError(500, message, 'AGENT_CODER_FAILED', { tasks: result.tasks });
            }

            const responsePayload: z.infer<typeof AgentCoderRunResponseSchema> = {
                success: true,
                data: {
                    updatedFiles: updatedFilesArray,
                    taskPlan: result.tasks ?? undefined
                }
            };
            return c.json(responsePayload, 200);

        } catch (error: any) {
            console.error(`[Agent Coder Route] Error executing agent for project ${projectId}:`, error);
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError(500, `Failed to execute Agent Coder: ${error.message}`, 'AGENT_CODER_EXECUTION_ERROR');
        }
    });
