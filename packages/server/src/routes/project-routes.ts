import { router } from "server-router";
import { json } from '@bnk/router';

import { projectsApiValidation, ApiError, buildCombinedFileSummaries } from "shared";
import { z } from "zod";
import { createProject, deleteProject, forceResummarizeSelectedFiles, getProjectById, getProjectFiles, listProjects, removeSummariesFromFiles, resummarizeAllFiles, summarizeSelectedFiles, updateProject } from "@/services/project-service";
import { getFileSummaries } from "@/services/file-services/file-summary-service";
import { syncProject, syncProjectFolder } from "@/services/file-services/file-sync-service";

const refreshQuerySchema = z.object({
    folder: z.string().optional()
});


router.post("/api/projects", {
    validation: projectsApiValidation.create,
}, async (_, { body }) => {
    const project = await createProject(body);
    return json({ success: true, project }, { status: 201 });
});

router.get("/api/projects", {}, async () => {
    const projects = await listProjects();
    return json({ success: true, projects });
});

router.get("/api/projects/:projectId", {
    validation: projectsApiValidation.getOrDelete
}, async (_, { params }) => {
    const project = await getProjectById(params.projectId);
    if (!project) {
        throw new ApiError("Project not found", 404, "NOT_FOUND");
    }
    return json({ success: true, project });
});

router.patch("/api/projects/:projectId", {
    validation: projectsApiValidation.update
}, async (_, { params, body }) => {
    const updatedProject = await updateProject(params.projectId, body);
    if (!updatedProject) {
        throw new ApiError("Project not found", 404, "NOT_FOUND");
    }
    return json({ success: true, project: updatedProject });
});

router.delete("/api/projects/:projectId", {
    validation: projectsApiValidation.getOrDelete
}, async (_, { params }) => {
    const deleted = await deleteProject(params.projectId);
    if (!deleted) {
        throw new ApiError("Project not found", 404, "NOT_FOUND");
    }
    return json({ success: true });
});

router.post("/api/projects/:projectId/sync", {
    validation: projectsApiValidation.sync
}, async (_, { params }) => {
    const project = await getProjectById(params.projectId);
    if (!project) {
        throw new ApiError("Project not found", 404, "NOT_FOUND");
    }
    await syncProject(project);
    return json({ success: true });
});

router.get("/api/projects/:projectId/files", {
    validation: projectsApiValidation.getFiles
}, async (_, { params }) => {
    const project = await getProjectById(params.projectId);
    if (!project) {
        throw new ApiError("Project not found", 404, "NOT_FOUND");
    }
    await syncProject(project);
    const files = await getProjectFiles(params.projectId);
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
    const project = await getProjectById(projectId);
    if (!project) {
        throw new ApiError("Project not found", 404, "NOT_FOUND");
    }
    if (folder) {
        await syncProjectFolder(project, folder);
    } else {
        await syncProject(project);
    }
    const files = await getProjectFiles(projectId);
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