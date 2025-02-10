import { router } from "server-router";
import { json } from '@bnk/router';

import { projectsApiValidation, ApiError, buildCombinedFileSummaries } from "shared";
import { z } from "zod";
import { forceResummarizeSelectedFiles, getProjectById, getProjectFiles, removeSummariesFromFiles, resummarizeAllFiles, summarizeSelectedFiles, } from "@/services/project-service";
import { getFileSummaries } from "@/services/file-services/file-summary-service";

router.get("/api/projects/:projectId/file-summaries", {
    validation: {
        params: projectsApiValidation.getFiles.params,
        query: z.object({
            fileIds: z.string().optional(),
        }).optional(),
    },
}, async (_, { params, query }) => {
    const { projectId } = params;
    const fileIds = query?.fileIds?.split(',').filter(Boolean);

    const summaries = await getFileSummaries(projectId, fileIds);
    return json({
        success: true,
        summaries,
    });
});

router.post("/api/projects/:projectId/summarize", {
    validation: {
        body: z.object({
            fileIds: z.array(z.string()).nonempty(),
            force: z.boolean().optional(),
        }),
        params: projectsApiValidation.sync.params,
    },
}, async (_, { params, body }) => {
    const { projectId } = params;
    const { fileIds, force } = body;

    const project = await getProjectById(projectId);
    if (!project) {
        throw new ApiError("Project not found", 404, "NOT_FOUND");
    }

    const result = force
        ? await forceResummarizeSelectedFiles(projectId, fileIds)
        : await summarizeSelectedFiles(projectId, fileIds);

    return json({
        success: true,
        ...result,
    });
});

router.post("/api/projects/:projectId/resummarize-all", {}, async (_, { params }) => {
    const project = await getProjectById(params.projectId);
    if (!project) {
        throw new ApiError("Project not found", 404, "NOT_FOUND");
    }
    await resummarizeAllFiles(params.projectId);

    return json({
        success: true,
        message: "All files have been force-resummarized."
    });
});

router.post("/api/projects/:projectId/remove-summaries", {
    validation: {
        body: z.object({
            fileIds: z.array(z.string()).nonempty(),
        }),
        params: projectsApiValidation.sync.params,
    },
}, async (_, { params, body }) => {
    const { projectId } = params;
    const { fileIds } = body;

    const project = await getProjectById(projectId);
    if (!project) {
        throw new ApiError("Project not found", 404, "NOT_FOUND");
    }

    const result = await removeSummariesFromFiles(projectId, fileIds);
    return json(result);
});

router.get('/api/projects/:projectId/summary', {
    validation: projectsApiValidation.getOrDelete
}, async (_, { params }) => {
    try {
        // const summary = await projectSummaryService.generateProjectSummaryMemory(params.projectId)
        const projectFiles = await getProjectFiles(params.projectId)

        const summary = buildCombinedFileSummaries(projectFiles || [])
        return json({ success: true, summary })
    } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
            throw new ApiError("Project not found", 404, "NOT_FOUND")
        }
        console.error('Error generating project summary:', error)
        throw new ApiError("Failed to generate project summary", 500, "INTERNAL_ERROR")
    }
})