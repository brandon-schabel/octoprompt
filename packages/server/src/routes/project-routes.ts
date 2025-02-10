import { router } from "server-router";
import { json } from '@bnk/router';

import { projectsApiValidation, ApiError } from "shared";
import { z } from "zod";
import { createProject, deleteProject, getProjectById, getProjectFiles, listProjects, removeSummariesFromFiles, resummarizeAllFiles, summarizeSelectedFiles, updateProject } from "@/services/project-service";
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

