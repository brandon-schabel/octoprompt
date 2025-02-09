
import { router } from "server-router";
import { ProjectService } from "@/services/project-service";
import { json } from '@bnk/router';

import { projectsApiValidation, ApiError, buildCombinedFileSummaries } from "shared";
import { z } from "zod";
import { FileSummaryService } from "@/services/file-services/file-summary-service";

const refreshQuerySchema = z.object({
    folder: z.string().optional()
});

const projectService = new ProjectService();
const fileSummaryService = new FileSummaryService();

router.post("/api/projects", {
    validation: projectsApiValidation.create,
}, async (_, { body }) => {
    const project = await projectService.createProject(body);
    return json({ success: true, project }, { status: 201 });
});

router.get("/api/projects", {}, async () => {
    const projects = await projectService.listProjects();
    return json({ success: true, projects });
});

router.get("/api/projects/:projectId", {
    validation: projectsApiValidation.getOrDelete
}, async (_, { params }) => {
    const project = await projectService.getProjectById(params.projectId);
    if (!project) {
        throw new ApiError("Project not found", 404, "NOT_FOUND");
    }
    return json({ success: true, project });
});

router.patch("/api/projects/:projectId", {
    validation: projectsApiValidation.update
}, async (_, { params, body }) => {
    const updatedProject = await projectService.updateProject(params.projectId, body);
    if (!updatedProject) {
        throw new ApiError("Project not found", 404, "NOT_FOUND");
    }
    return json({ success: true, project: updatedProject });
});

router.delete("/api/projects/:projectId", {
    validation: projectsApiValidation.getOrDelete
}, async (_, { params }) => {
    const deleted = await projectService.deleteProject(params.projectId);
    if (!deleted) {
        throw new ApiError("Project not found", 404, "NOT_FOUND");
    }
    return json({ success: true });
});

router.post("/api/projects/:projectId/sync", {
    validation: projectsApiValidation.sync
}, async (_, { params }) => {
    const result = await projectService.syncProject(params.projectId);
    if (!result) {
        throw new ApiError("Project not found", 404, "NOT_FOUND");
    }
    return json(result);
});

router.get("/api/projects/:projectId/files", {
    validation: projectsApiValidation.getFiles
}, async (_, { params }) => {
    // 1) Force a check of all files for that project
    await projectService.syncProject(params.projectId);

    // 2) Then return the fresh DB records
    const files = await projectService.getProjectFiles(params.projectId);
    if (!files) {
        throw new ApiError("Project not found", 404, "NOT_FOUND");
    }
    return json({ success: true, files });
});

router.post("/api/projects/:projectId/refresh", {
    validation: {
        params: projectsApiValidation.sync.params,
        query: refreshQuerySchema
    }
}, async (_, { params, query }) => {
    const { projectId } = params;
    const { folder } = query;

    // If folder is provided, do partial sync. Otherwise full sync.
    const refreshResult = folder
        ? await projectService.syncProjectFolder(projectId, folder)
        : await projectService.syncProject(projectId);

    if (!refreshResult) {
        throw new ApiError("Project not found or folder invalid", 404, "NOT_FOUND");
    }

    // Re-fetch updated DB records
    const files = await projectService.getProjectFiles(projectId);
    if (!files) {
        throw new ApiError("Project not found", 404, "NOT_FOUND");
    }

    return json({ success: true, files });
});

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

    const summaries = await fileSummaryService.getFileSummaries(projectId, fileIds);
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

    const project = await projectService.getProjectById(projectId);
    if (!project) {
        throw new ApiError("Project not found", 404, "NOT_FOUND");
    }

    const result = force
        ? await projectService.forceResummarizeSelectedFiles(projectId, fileIds)
        : await projectService.summarizeSelectedFiles(projectId, fileIds);

    return json({
        success: true,
        ...result,
    });
});

router.post("/api/projects/:projectId/resummarize-all", {}, async (_, { params }) => {
    const project = await projectService.getProjectById(params.projectId);
    if (!project) {
        throw new ApiError("Project not found", 404, "NOT_FOUND");
    }
    await projectService.resummarizeAllFiles(params.projectId);

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

    const project = await projectService.getProjectById(projectId);
    if (!project) {
        throw new ApiError("Project not found", 404, "NOT_FOUND");
    }

    const result = await projectService.removeSummariesFromFiles(projectId, fileIds);
    return json(result);
});

router.get('/api/projects/:projectId/summary', {
    validation: projectsApiValidation.getOrDelete
}, async (_, { params }) => {
    try {
        // const summary = await projectSummaryService.generateProjectSummaryMemory(params.projectId)
        const projectFiles = await projectService.getProjectFiles(params.projectId)

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