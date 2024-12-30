import { router } from "server-router";
import { ProjectService } from "@/services/project-service";
import { json } from '@bnk/router';

import { projectsApiValidation, ApiError } from "shared";

const projectService = new ProjectService();

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
    const files = await projectService.getProjectFiles(params.projectId);
    if (!files) {
        throw new ApiError("Project not found", 404, "NOT_FOUND");
    }
    return json({ success: true, files });
});