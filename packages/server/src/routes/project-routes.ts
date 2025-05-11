import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
    ApiError,
} from "shared";
import {
    ProjectIdParamsSchema,
    CreateProjectBodySchema,
    UpdateProjectBodySchema,
    RefreshQuerySchema,
    ProjectResponseSchema,
    ProjectListResponseSchema,
    FileListResponseSchema,
    ProjectResponseMultiStatusSchema,
    ProjectSummaryResponseSchema,
    RemoveSummariesBodySchema,
    SuggestFilesBodySchema,
    SummarizeFilesBodySchema,
} from "shared/src/schemas/project.schemas";

import {
    ApiErrorResponseSchema,
    OperationSuccessResponseSchema,
} from 'shared/src/schemas/common.schemas';

import { existsSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { homedir as getHomedir } from 'node:os';

import * as projectService from "@/services/project-service";
import { syncProject, syncProjectFolder, watchersManager } from "@/services/file-services/file-sync-service-unified";
import { buildCombinedFileSummariesXml } from 'shared/src/utils/summary-formatter';
import { generateStructuredData } from '@/services/gen-ai-services';
import { getFullProjectSummary } from '@/utils/get-full-project-summary';
import { SuggestFilesResponseSchema, FileSummaryListResponseSchema, SummarizeFilesResponseSchema, RemoveSummariesResponseSchema, FileSuggestionsZodSchema } from 'shared/src/schemas/gen-ai.schemas';
import { summarizeFiles } from '@/services/project-service';



const createProjectRoute = createRoute({
    method: 'post',
    path: '/api/projects',
    tags: ['Projects'],
    summary: 'Create a new project and sync its files',
    request: {
        body: { content: { 'application/json': { schema: CreateProjectBodySchema } } },
    },
    responses: {
        201: {
            content: { 'application/json': { schema: ProjectResponseSchema } },
            description: 'Project created and initial sync started',
        },
        // Define the 207 response explicitly
        207: {
            content: { 'application/json': { schema: ProjectResponseMultiStatusSchema } },
            description: 'Project created, but post-creation steps encountered issues',
        },
        422: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Validation Error' },
        500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' },
    },
});

const listProjectsRoute = createRoute({
    method: 'get',
    path: '/api/projects',
    tags: ['Projects'],
    summary: 'List all projects',
    responses: {
        200: { content: { 'application/json': { schema: ProjectListResponseSchema } }, description: 'Successfully retrieved all projects' },
        500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' },
    },
});

const getProjectByIdRoute = createRoute({
    method: 'get',
    path: '/api/projects/{projectId}',
    tags: ['Projects'],
    summary: 'Get a specific project by ID',
    request: { params: ProjectIdParamsSchema },
    responses: {
        200: { content: { 'application/json': { schema: ProjectResponseSchema } }, description: 'Successfully retrieved project details' },
        404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Project not found' },
        422: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Validation Error (invalid projectId format)' },
        500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' },
    },
});

const updateProjectRoute = createRoute({
    method: 'patch',
    path: '/api/projects/{projectId}',
    tags: ['Projects'],
    summary: 'Update a project\'s details',
    request: {
        params: ProjectIdParamsSchema,
        body: { content: { 'application/json': { schema: UpdateProjectBodySchema } } },
    },
    responses: {
        200: { content: { 'application/json': { schema: ProjectResponseSchema } }, description: 'Project updated successfully' },
        404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Project not found' },
        422: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Validation Error' },
        500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' },
    },
});

const deleteProjectRoute = createRoute({
    method: 'delete',
    path: '/api/projects/{projectId}',
    tags: ['Projects'],
    summary: 'Delete a project and its associated data',
    request: { params: ProjectIdParamsSchema },
    responses: {
        200: { content: { 'application/json': { schema: OperationSuccessResponseSchema } }, description: 'Project deleted successfully' },
        404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Project not found' },
        422: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Validation Error' },
        500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' },
    },
});

const syncProjectRoute = createRoute({
    method: 'post',
    path: '/api/projects/{projectId}/sync',
    tags: ['Projects', 'Files'],
    summary: 'Manually trigger a full file sync for a project',
    request: { params: ProjectIdParamsSchema },
    responses: {
        200: { content: { 'application/json': { schema: OperationSuccessResponseSchema } }, description: 'Project sync initiated successfully' },
        404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Project not found' },
        422: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Validation Error' },
        500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error during sync' },
    },
});

const getProjectFilesRoute = createRoute({
    method: 'get',
    path: '/api/projects/{projectId}/files',
    tags: ['Projects', 'Files'],
    summary: 'Get the list of files associated with a project',
    request: { params: ProjectIdParamsSchema },
    responses: {
        200: { content: { 'application/json': { schema: FileListResponseSchema } }, description: 'Successfully retrieved project files' },
        404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Project not found' },
        422: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Validation Error' },
        500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' },
    },
});

const refreshProjectRoute = createRoute({
    method: 'post',
    path: '/api/projects/{projectId}/refresh',
    tags: ['Projects', 'Files'],
    summary: 'Refresh project files (sync) optionally limited to a folder',
    request: {
        params: ProjectIdParamsSchema,
        query: RefreshQuerySchema,
    },
    responses: {
        200: { content: { 'application/json': { schema: FileListResponseSchema } }, description: 'Successfully refreshed project files' },
        404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Project not found' },
        422: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Validation Error' },
        500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error during refresh/sync' },
    },
});

const getProjectSummaryRoute = createRoute({
    method: 'get',
    path: '/api/projects/{projectId}/summary',
    tags: ['Projects', 'Files', 'AI'],
    summary: 'Get a combined summary of all files in the project',
    request: { params: ProjectIdParamsSchema },
    responses: {
        200: { content: { 'application/json': { schema: ProjectSummaryResponseSchema } }, description: 'Successfully generated combined project summary' },
        404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Project not found' },
        422: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Validation Error' },
        500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' },
    },
});


const suggestFilesRoute = createRoute({
    method: 'post',
    path: '/api/projects/{projectId}/suggest-files',
    tags: ['Projects', 'Files', 'AI'],
    summary: 'Suggest relevant files based on user input and project context',
    request: {
        params: ProjectIdParamsSchema,
        body: { content: { 'application/json': { schema: SuggestFilesBodySchema } } },
    },
    responses: {
        200: { content: { 'application/json': { schema: SuggestFilesResponseSchema } }, description: 'Successfully suggested files' },
        404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Project not found' },
        422: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Validation Error' },
        500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error or AI processing error' },
    },
});


const summarizeFilesRoute = createRoute({
    method: 'post',
    path: '/api/projects/{projectId}/summarize',
    tags: ['Projects', 'Files', 'AI'],
    summary: 'Summarize selected files in a project (or force re-summarize)',
    request: {
        params: ProjectIdParamsSchema,
        body: { content: { 'application/json': { schema: SummarizeFilesBodySchema } } },
    },
    responses: {
        200: { content: { 'application/json': { schema: SummarizeFilesResponseSchema } }, description: 'File summarization process completed' },
        404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Project or some files not found' },
        422: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Validation Error' },
        500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error during summarization' },
    },
});

const removeSummariesRoute = createRoute({
    method: 'post',
    path: '/api/projects/{projectId}/remove-summaries',
    tags: ['Projects', 'Files'],
    summary: 'Remove summaries from selected files',
    request: {
        params: ProjectIdParamsSchema,
        body: { content: { 'application/json': { schema: RemoveSummariesBodySchema } } },
    },
    responses: {
        200: { content: { 'application/json': { schema: RemoveSummariesResponseSchema } }, description: 'Summaries removed successfully' },
        404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Project or some files not found' },
        422: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Validation Error' },
        500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' },
    },
});

// --- Hono App Instance ---
export const projectRoutes = new OpenAPIHono()
    .openapi(createProjectRoute, async (c) => {
        const body = c.req.valid('json');
        let normalizedPath = body.path;
        if (normalizedPath.startsWith('~')) {
            normalizedPath = normalizedPath.replace(/^~/, getHomedir());
        }
        normalizedPath = resolvePath(normalizedPath);
        console.log(`Creating project - Original path: ${body.path}, Normalized path: ${normalizedPath}`);

        const projectData = { ...body, path: normalizedPath };
        const createdProject = await projectService.createProject(projectData);
        console.log(`Project created with ID: ${createdProject.id}`);

        let syncWarning: string | undefined;
        let syncError: string | undefined;
        let httpStatus: 201 | 207 = 201; // Use explicit status codes

        try {
            if (!existsSync(createdProject.path)) {
                console.warn(`Project path does not exist: ${createdProject.path}`);
                syncWarning = "Project created but directory does not exist. No files will be synced.";
                httpStatus = 207;
            } else {
                console.log(`Starting sync for project: ${createdProject.id} at path: ${createdProject.path}`);
                await syncProject(createdProject);
                console.log(`Finished syncing files for project: ${createdProject.id}`);
                console.log(`Starting file watchers for project: ${createdProject.id}`);
                await watchersManager.startWatchingProject(createdProject, ["node_modules", "dist", ".git", "*.tmp", "*.db-journal"]);
                console.log(`File watchers started for project: ${createdProject.id}`);
                const files = await projectService.getProjectFiles(createdProject.id);
                console.log(`Synced ${files?.length || 0} files for project`);
            }
        } catch (error: any) {
            console.error(`Error during project setup: ${error}`);
            syncError = `Post-creation setup failed: ${String(error)}`;
            httpStatus = 207;
        }

        // Construct the payload matching the schema for the status code
        if (httpStatus === 201) {
            const payload = {
                success: true,
                data: createdProject,
            } satisfies z.infer<typeof ProjectResponseSchema>;
            return c.json(payload, 201);
        } else { // httpStatus === 207
            const payload = {
                success: true,
                data: createdProject,
                ...(syncWarning && { warning: syncWarning }),
                ...(syncError && { error: syncError }),
            } satisfies z.infer<typeof ProjectResponseMultiStatusSchema>;
            return c.json(payload, 207);
        }
    })

    .openapi(listProjectsRoute, async (c) => {
        const projects = await projectService.listProjects();
        const payload = {
            success: true,
            data: projects
        } satisfies z.infer<typeof ProjectListResponseSchema>;
        return c.json(payload, 200);
    })

    .openapi(getProjectByIdRoute, async (c) => {
        const { projectId } = c.req.valid('param');
        const project = await projectService.getProjectById(projectId);
        if (!project) {
            throw new ApiError(404, `Project not found: ${projectId}`, "PROJECT_NOT_FOUND");
        }
        const payload = {
            success: true,
            data: project
        } satisfies z.infer<typeof ProjectResponseSchema>;
        return c.json(payload, 200);
    })

    .openapi(updateProjectRoute, async (c) => {
        const { projectId } = c.req.valid('param');
        const body = c.req.valid('json');
        const updatedProject = await projectService.updateProject(projectId, body);
        if (!updatedProject) {
            throw new ApiError(404, `Project not found: ${projectId}`, "PROJECT_NOT_FOUND");
        }
        const payload = {
            success: true,
            data: updatedProject
        } satisfies z.infer<typeof ProjectResponseSchema>;
        return c.json(payload, 200);
    })

    .openapi(deleteProjectRoute, async (c) => {
        const { projectId } = c.req.valid('param');
        const deleted = await projectService.deleteProject(projectId);
        if (!deleted) {
            throw new ApiError(404, `Project not found: ${projectId}`, "PROJECT_NOT_FOUND");
        }
        watchersManager.stopWatchingProject(projectId);
        // Ensure the returned object matches OperationSuccessResponseSchema
        const payload: z.infer<typeof OperationSuccessResponseSchema> = {
            success: true,
            message: "Project deleted successfully."
        };
        return c.json(payload, 200);
    })

    .openapi(syncProjectRoute, async (c) => {
        const { projectId } = c.req.valid('param');
        const project = await projectService.getProjectById(projectId);
        if (!project) {
            throw new ApiError(404, `Project not found: ${projectId}`, "PROJECT_NOT_FOUND");
        }
        await syncProject(project);
        // Ensure the returned object matches OperationSuccessResponseSchema
        const payload: z.infer<typeof OperationSuccessResponseSchema> = {
            success: true,
            message: "Project sync initiated."
        };
        return c.json(payload, 200);
    })

    .openapi(getProjectFilesRoute, async (c) => {
        const { projectId } = c.req.valid('param');
        const project = await projectService.getProjectById(projectId);
        if (!project) {
            throw new ApiError(404, `Project not found: ${projectId}`, "PROJECT_NOT_FOUND");
        }
        const files = await projectService.getProjectFiles(projectId);
        // Files already have ISO dates from service
        const payload = {
            success: true,
            data: files ?? []
        } satisfies z.infer<typeof FileListResponseSchema>;
        return c.json(payload, 200);
    })

    .openapi(refreshProjectRoute, async (c) => {
        const { projectId } = c.req.valid('param');
        const { folder } = c.req.valid('query');
        const project = await projectService.getProjectById(projectId);
        if (!project) {
            throw new ApiError(404, `Project not found: ${projectId}`, "PROJECT_NOT_FOUND");
        }
        if (folder) {
            await syncProjectFolder(project, folder);
        } else {
            await syncProject(project);
        }
        const files = await projectService.getProjectFiles(projectId);
        // Files are already in API format
        const payload = {
            success: true,
            data: files ?? []
        } satisfies z.infer<typeof FileListResponseSchema>;
        return c.json(payload, 200);
    })


    .openapi(getProjectSummaryRoute, async (c) => {
        const { projectId } = c.req.valid('param');
        const project = await projectService.getProjectById(projectId);
        if (!project) {
            // Throwing here ensures this path doesn't return a success response
            throw new ApiError(404, `Project not found: ${projectId}`, "PROJECT_NOT_FOUND");
        }

        const projectFiles = await projectService.getProjectFiles(projectId);

        // Calculate summary conditionally, default to empty string if no files
        let summary = "";
        if (!projectFiles) {
            console.warn(`No files found for project ${projectId} when generating summary.`);
            // Set summary to empty, but don't return early
            summary = "";
        } else {
            summary = buildCombinedFileSummariesXml(projectFiles);
        }

        // Construct the single success payload at the end
        const payload: z.infer<typeof ProjectSummaryResponseSchema> = {
            success: true,
            summary: summary // Use the calculated summary
        };

        // Explicitly return status 200
        return c.json(payload, 200);
    })
    .openapi(suggestFilesRoute, async (c) => {
        const { projectId } = c.req.valid('param');
        const { userInput } = c.req.valid('json');

        const projectSummary = await getFullProjectSummary(projectId);
        const systemPrompt = `
<role>
You are a code assistant that recommends relevant files based on user input.
You have a list of file summaries and a user request.
</role>

<response_format>
    {"fileIds": ["9d679879sad7fdf324312", "9d679879sad7fdf324312"]}
</response_format>

<guidelines>
- For simple tasks: return max 5 files
- For complex tasks: return max 10 files
- For very complex tasks: return max 20 files
- Do not add comments in your response
- Strictly follow the JSON schema, do not add any additional properties or comments
- DO NOT RETURN THE FILE NAME UNDER ANY CIRCUMSTANCES, JUST THE FILE ID
</guidelines>
        `

        const userPrompt = `
<user_query>
${userInput}
</user_query>

<project_summary>
${projectSummary}
</project_summary>
`;
        try {
            const result = await generateStructuredData({
                prompt: userPrompt,
                schema: FileSuggestionsZodSchema,
                systemMessage: systemPrompt,
            })

            const payload = {
                success: true,
                recommendedFileIds: result.object.fileIds,
            } satisfies z.infer<typeof SuggestFilesResponseSchema>;

            return c.json(payload, 200);
        } catch (error: any) {
            console.error("[SuggestFiles Project] Error:", error);
            if (error instanceof ApiError) throw error;
            throw new ApiError(500, `Failed to suggest files: ${error.message}`, "AI_SUGGESTION_ERROR");
        }
    })

    .openapi(summarizeFilesRoute, async (c) => {
        const { projectId } = c.req.valid('param');
        const { fileIds, force } = c.req.valid('json');

        const result = await summarizeFiles(projectId, fileIds);

        const payload: z.infer<typeof SummarizeFilesResponseSchema> = {
            success: true,
            message: "Summarization process completed.",
            included: result.included,
            skipped: result.skipped,
            updatedFiles: result.updatedFiles,
        };
        return c.json(payload, 200);
    })

    .openapi(removeSummariesRoute, async (c) => {
        const { projectId } = c.req.valid('param');
        const { fileIds } = c.req.valid('json');
        const result = await projectService.removeSummariesFromFiles(projectId, fileIds);
        // Ensure the returned object matches RemoveSummariesResponseSchema (result already has the correct shape)
        if (typeof result.removedCount !== 'number') {
            // Handle potential failure from the service if needed, though schema expects success:true
            console.error("Removal of summaries reported failure from service:", result);
            throw new ApiError(500, result.message || "Failed to remove summaries");
        }
        const payload: z.infer<typeof RemoveSummariesResponseSchema> = {
            success: true, // Explicitly set to true to match schema
            removedCount: result.removedCount,
            message: result.message
        };
        return c.json(payload, 200); // Defaults to 200
    })


// Export the type for the frontend client generator
export type ProjectRouteTypes = typeof projectRoutes;