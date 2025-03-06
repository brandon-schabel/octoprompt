import app from "@/server-router";
import { zValidator } from '@hono/zod-validator';

import { projectsApiValidation, ApiError, buildCombinedFileSummaries } from "shared";
import { z } from "zod";
import { forceResummarizeSelectedFiles, getProjectById, getProjectFiles, removeSummariesFromFiles, resummarizeAllFiles, summarizeSelectedFiles, } from "@/services/project-service";
import { getFileSummaries } from "@/services/file-services/file-summary-service";

app.get("/api/projects/:projectId/file-summaries", 
    zValidator('param', projectsApiValidation.getFiles.params),
    zValidator('query', z.object({
        fileIds: z.string().optional(),
    }).optional()),
    async (c) => {
        const { projectId } = c.req.valid('param');
        const query = c.req.valid('query');
        const fileIds = query?.fileIds?.split(',').filter(Boolean);

        const summaries = await getFileSummaries(projectId, fileIds);
        return c.json({
            success: true,
            summaries,
        });
    }
);

app.post("/api/projects/:projectId/summarize", 
    zValidator('param', projectsApiValidation.sync.params),
    zValidator('json', z.object({
        fileIds: z.array(z.string()).nonempty(),
        force: z.boolean().optional(),
    })),
    async (c) => {
        const { projectId } = c.req.valid('param');
        const { fileIds, force } = await c.req.valid('json');

        const project = await getProjectById(projectId);
        if (!project) {
            throw new ApiError("Project not found", 404, "NOT_FOUND");
        }

        const result = force
            ? await forceResummarizeSelectedFiles(projectId, fileIds)
            : await summarizeSelectedFiles(projectId, fileIds);

        return c.json({
            success: true,
            ...result,
        });
    }
);

app.post("/api/projects/:projectId/resummarize-all", 
    async (c) => {
        const { projectId } = c.req.param();
        
        const project = await getProjectById(projectId);
        if (!project) {
            throw new ApiError("Project not found", 404, "NOT_FOUND");
        }
        await resummarizeAllFiles(projectId);

        return c.json({
            success: true,
            message: "All files have been force-resummarized."
        });
    }
);

app.post("/api/projects/:projectId/remove-summaries", 
    zValidator('param', projectsApiValidation.sync.params),
    zValidator('json', z.object({
        fileIds: z.array(z.string()).nonempty(),
    })),
    async (c) => {
        const { projectId } = c.req.valid('param');
        const { fileIds } = await c.req.valid('json');

        const project = await getProjectById(projectId);
        if (!project) {
            throw new ApiError("Project not found", 404, "NOT_FOUND");
        }

        const result = await removeSummariesFromFiles(projectId, fileIds);
        return c.json(result);
    }
);

app.get('/api/projects/:projectId/summary', 
    zValidator('param', projectsApiValidation.getOrDelete.params),
    async (c) => {
        try {
            const { projectId } = c.req.valid('param');
            // const summary = await projectSummaryService.generateProjectSummaryMemory(projectId)
            const projectFiles = await getProjectFiles(projectId);

            const summary = buildCombinedFileSummaries(projectFiles || []);
            return c.json({ success: true, summary });
        } catch (error) {
            if (error instanceof Error && error.message.includes('not found')) {
                throw new ApiError("Project not found", 404, "NOT_FOUND");
            }
            console.error('Error generating project summary:', error);
            throw new ApiError("Failed to generate project summary", 500, "INTERNAL_ERROR");
        }
    }
);