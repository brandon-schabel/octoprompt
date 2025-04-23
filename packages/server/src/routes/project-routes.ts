import { zValidator } from '@hono/zod-validator';
import { z } from '@hono/zod-openapi'
import { OpenAPIHono } from '@hono/zod-openapi';
import { projectsApiValidation, ApiError, buildCombinedFileSummaries, DEFAULT_MODEL_CONFIGS } from "shared";
import {
    createProject, deleteProject, getProjectById, getProjectFiles, listProjects,
    updateProject, forceResummarizeSelectedFiles, resummarizeAllFiles,
    summarizeSelectedFiles, removeSummariesFromFiles
} from "@/services/project-service";
import { syncProject, syncProjectFolder } from "@/services/file-services/file-sync-service";
import { getFileSummaries } from "@/services/file-services/file-summary-service";
import { watchersManager } from "@/services/shared-services";
import { existsSync } from 'node:fs';
import { fetchStructuredOutput } from "@/utils/structured-output-fetcher";
import { getFullProjectSummary } from "@/utils/get-full-project-summary";

// --- Zod Schema for File Suggestions (Moved/Defined Here) ---
export const FileSuggestionsZodSchema = z.object({
    fileIds: z.array(z.string())
});

// --- JSON Schema (Optional but good practice with Zod OpenAPI) ---
export const FileSuggestionsJsonSchema = {
    type: "object",
    properties: {
        fileIds: {
            type: "array",
            items: { type: "string" },
            description: "An array of file IDs relevant to the user input"
        }
    },
    required: ["fileIds"],
    additionalProperties: false
};


// Create a new Hono instance for project routes

// --- Project CRUD ---

const refreshQuerySchema = z.object({
    folder: z.string().optional()
});

// Create a new project
export const projectRoutes = new OpenAPIHono().post("/api/projects",
    zValidator('json', projectsApiValidation.create.body),
    async (c) => {
        const body = c.req.valid('json');
        const { resolve } = await import('node:path');
        const { homedir } = await import('node:os');

        let normalizedPath = body.path;
        if (normalizedPath.startsWith('~')) {
            normalizedPath = normalizedPath.replace(/^~/, homedir());
        }
        normalizedPath = resolve(normalizedPath);
        console.log(`Creating project - Original path: ${body.path}, Normalized path: ${normalizedPath}`);

        const projectData = { ...body, path: normalizedPath };
        const project = await createProject(projectData);
        console.log(`Project created with ID: ${project.id}`);

        try {
            if (!existsSync(project.path)) {
                console.error(`Project path does not exist: ${project.path}`);
                return c.json({
                    success: true,
                    project,
                    warning: "Project created but directory does not exist. No files will be synced."
                }, 201);
            }

            console.log(`Starting sync for project: ${project.id} at path: ${project.path}`);
            await syncProject(project);
            console.log(`Finished syncing files for project: ${project.id}`);

            console.log(`Starting file watchers for project: ${project.id}`);
            await watchersManager.startWatchingProject(project, ["node_modules", "dist", ".git", "*.tmp", "*.db-journal"]);
            console.log(`File watchers started for project: ${project.id}`);

            const files = await getProjectFiles(project.id);
            console.log(`Synced ${files?.length || 0} files for project`);
        } catch (error) {
            console.error(`Error during project setup: ${error}`);
            // Still return the created project, maybe with an error indication in the response body
            return c.json({
                success: true, // Indicate project creation succeeded
                project,
                error: `Post-creation setup failed: ${String(error)}`
            }, 207); // 207 Multi-Status might be appropriate
        }

        return c.json({ success: true, project }, 201);
    }
).get("/api/projects", async (c) => {
    const projects = await listProjects();
    return c.json({ success: true, projects });
}).get("/api/projects/:projectId",
    zValidator('param', projectsApiValidation.getOrDelete.params),
    async (c) => {
        const { projectId } = c.req.valid('param');
        const project = await getProjectById(projectId);
        if (!project) {
            throw new ApiError(404, "Project not found", "NOT_FOUND");
        }
        return c.json({ success: true, project });
    }
)
    .patch("/api/projects/:projectId",
        zValidator('param', projectsApiValidation.update.params),
        zValidator('json', projectsApiValidation.update.body),
        async (c) => {
            const { projectId } = c.req.valid('param');
            const body = c.req.valid('json');
            const updatedProject = await updateProject(projectId, body);
            if (!updatedProject) {
                throw new ApiError(404, "Project not found", "NOT_FOUND");
            }
            return c.json({ success: true, project: updatedProject });
        }
    ).delete("/api/projects/:projectId",
        zValidator('param', projectsApiValidation.getOrDelete.params),
        async (c) => {
            const { projectId } = c.req.valid('param');
            const deleted = await deleteProject(projectId);
            if (!deleted) {
                throw new ApiError(404, "Project not found", "NOT_FOUND");
            }
            return c.json({ success: true }, 200); // Consider 204 No Content
        }
    ).post("/api/projects/:projectId/sync",
        zValidator('param', projectsApiValidation.sync.params),
        async (c) => {
            const { projectId } = c.req.valid('param');
            const project = await getProjectById(projectId);
            if (!project) {
                throw new ApiError(404, "Project not found", "NOT_FOUND");
            }
            await syncProject(project);
            return c.json({ success: true, message: "Project sync initiated." });
        }
    ).get("/api/projects/:projectId/files",
        zValidator('param', projectsApiValidation.getFiles.params),
        async (c) => {
            const { projectId } = c.req.valid('param');
            const project = await getProjectById(projectId);
            if (!project) {
                throw new ApiError(404, "Project not found", "NOT_FOUND");
            }
            await syncProject(project); // Ensure latest files are considered
            const files = await getProjectFiles(projectId);
            // The service likely returns null/[] if no files, not an error
            return c.json({ success: true, files: files ?? [] });
        }
    ).post("/api/projects/:projectId/refresh",
        zValidator('param', projectsApiValidation.sync.params),
        zValidator('query', refreshQuerySchema),
        async (c) => {
            const { projectId } = c.req.valid('param');
            const { folder } = c.req.valid('query');
            const project = await getProjectById(projectId);
            if (!project) {
                throw new ApiError(404, "Project not found", "NOT_FOUND");
            }
            if (folder) {
                await syncProjectFolder(project, folder);
            } else {
                await syncProject(project);
            }
            const files = await getProjectFiles(projectId);
            return c.json({ success: true, files: files ?? [] });
        }
    ).get("/api/projects/:projectId/debug-file-sync",
        zValidator('param', projectsApiValidation.sync.params),
        async (c) => {
            console.log("DEBUG FILE SYNC ENDPOINT CALLED");
            const { projectId } = c.req.valid('param');
            const project = await getProjectById(projectId);
            if (!project) {
                throw new ApiError(404, "Project not found", "NOT_FOUND");
            }

            console.log(`Debug sync for project: ${project.id} at path: ${project.path}`);
            const pathExists = existsSync(project.path);
            console.log(`Checking if path exists: ${pathExists}`);

            if (!pathExists) {
                return c.json({ success: false, error: "Project path does not exist on server.", path: project.path, exists: false }, 404);
            }

            try {
                const { resolve } = await import('node:path');
                const { readdirSync } = await import('node:fs');

                const absoluteProjectPath = resolve(project.path);
                console.log(`Absolute project path: ${absoluteProjectPath}`);

                try {
                    const entries = readdirSync(absoluteProjectPath, { withFileTypes: true });
                    console.log(`Found ${entries.length} entries in directory`);
                } catch (err) {
                    console.error(`Error reading directory: ${err}`);
                    return c.json({ success: false, error: `Error reading project directory: ${String(err)}` }, 500);
                }

                await syncProject(project); // Perform the sync

                const files = await getProjectFiles(project.id);
                console.log(`Synced ${files?.length || 0} files for project`);

                return c.json({
                    success: true,
                    message: "Manual sync completed",
                    fileCount: files?.length || 0,
                    path: project.path,
                    exists: true // Checked above
                });
            } catch (error) {
                console.error(`Error in debug sync: ${error}`);
                return c.json({ success: false, error: String(error) }, 500);
            }
        }
    ).get("/api/projects/:projectId/file-summaries",
        zValidator('param', projectsApiValidation.getFiles.params), // Reuse param schema
        zValidator('query', z.object({
            fileIds: z.string().optional(), // Comma-separated string
        }).optional()),
        async (c) => {
            const { projectId } = c.req.valid('param');
            const query = c.req.valid('query');
            const fileIds = query?.fileIds?.split(',').filter(Boolean); // Split string into array

            const summaries = await getFileSummaries(projectId, fileIds); // Pass optional fileIds array
            return c.json({
                success: true,
                summaries,
            });
        }
    ).post("/api/projects/:projectId/summarize",
        zValidator('param', projectsApiValidation.sync.params), // Reuse param schema
        zValidator('json', z.object({
            fileIds: z.array(z.string()).nonempty("At least one file ID is required."),
            force: z.boolean().optional().default(false),
        })),
        async (c) => {
            const { projectId } = c.req.valid('param');
            const { fileIds, force } = c.req.valid('json');

            // Project existence check is handled within the service functions, but checking here is fine too.
            const project = await getProjectById(projectId);
            if (!project) {
                throw new ApiError(404, "Project not found", "NOT_FOUND");
            }

            const result = force
                ? await forceResummarizeSelectedFiles(projectId, fileIds)
                : await summarizeSelectedFiles(projectId, fileIds);

            return c.json({
                success: true,
                ...result, // Spread the result which might contain counts etc.
            });
        }
    ).post("/api/projects/:projectId/resummarize-all",
        zValidator('param', projectsApiValidation.sync.params), // Added validator for consistency
        async (c) => {
            const { projectId } = c.req.param(); // Can use req.param directly if simple

            const project = await getProjectById(projectId);
            if (!project) {
                    throw new ApiError(404, "Project not found", "NOT_FOUND");
            }
            // Consider making this async and returning a 202 Accepted if it's long-running
            await resummarizeAllFiles(projectId);

            return c.json({
                success: true,
                message: "Process to force-resummarize all files started." // Or finished if synchronous
            });
        }
    ).post("/api/projects/:projectId/remove-summaries",
        zValidator('param', projectsApiValidation.sync.params), // Reuse param schema
        zValidator('json', z.object({
            fileIds: z.array(z.string()).nonempty("At least one file ID is required."),
        })),
        async (c) => {
            const { projectId } = c.req.valid('param');
            const { fileIds } = await c.req.valid('json');

            const project = await getProjectById(projectId);
            if (!project) {
                throw new ApiError(404, "Project not found", "NOT_FOUND");
            }

            const result = await removeSummariesFromFiles(projectId, fileIds);
            return c.json(result);
        }
    ).get('/api/projects/:projectId/summary',
        zValidator('param', projectsApiValidation.getOrDelete.params), // Reuse param schema
        async (c) => {
            try {
                const { projectId } = c.req.valid('param');
                const projectFiles = await getProjectFiles(projectId); // Fetch files with summaries

                // This function combines summaries already present on the files
                const summary = buildCombinedFileSummaries(projectFiles || []);
                return c.json({ success: true, summary });
            } catch (error) {
                // Catch specific errors if needed, otherwise let global handler manage
                console.error('Error generating project summary:', error);
                if (error instanceof Error && error.message.includes('not found')) {
                    throw new ApiError(404, "Project not found when fetching files for summary", "NOT_FOUND");
                }
                throw new ApiError(500, "Failed to generate project summary", "INTERNAL_ERROR");
            }
        }
    ).post(
        "/api/projects/:projectId/suggest-files",
        zValidator('param', z.object({ projectId: z.string() })),
        zValidator('json', z.object({ userInput: z.string().min(1) })),
        async (c) => {
            const { projectId } = c.req.valid('param');
            const { userInput } = c.req.valid('json');

            const projectSummary = await getFullProjectSummary(projectId); // Fetches and combines summaries

            const systemPrompt = `
      You are a code assistant that recommends relevant files based on user input.
      You have a list of file summaries and a user request.

      Return only valid JSON with the shape: {"fileIds": ["abc123", "def456"]}

      Guidelines:
      - For simple tasks: return max 5 files
      - For complex tasks: return max 10 files
      - For very complex tasks: return max 20 files
      - Do not add comments in your response
      - Strictly follow the JSON schema, do not add any additional properties or comments
    `;

            const userMessage = `
      User Query: ${userInput}

      Below is a combined summary of project files:
      ${projectSummary}
    `;

            try {
                const cfg = DEFAULT_MODEL_CONFIGS['suggest-code-files'];
                const result = await fetchStructuredOutput({
                    userMessage,
                    systemMessage: systemPrompt,
                    zodSchema: FileSuggestionsZodSchema, // Use schema defined above
                    jsonSchema: FileSuggestionsJsonSchema, // Use schema defined above
                    schemaName: "FileSuggestions",
                    model: cfg.model,
                    temperature: cfg.temperature,
                    chatId: `project-${projectId}-suggest-files`
                });

                return c.json({
                    success: true,
                    recommendedFileIds: result.fileIds,
                    // combinedSummaries: projectSummary // Optionally include context
                });
            } catch (error) {
                console.error("[SuggestFiles Project] Error:", error);
                throw new ApiError(500, "Failed to suggest files for project", "INTERNAL_ERROR");
            }
        }
    );


// Export the type for the frontend client
export type ProjectRouteTypes = typeof projectRoutes;