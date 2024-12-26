import { router } from "server-router";
import { ProjectService } from "@/services/project-service";
import { json } from '@bnk/router';
import { projectsApiValidation, } from "shared";

const projectService = new ProjectService();

const API_ERRORS = {
    NOT_FOUND: (details?: unknown) =>
        json.error('Project not found', 404, details),
    UNAUTHORIZED: (details?: unknown) =>
        json.error('Unauthorized access', 401, details),
    INTERNAL_ERROR: (error: unknown) => {
        console.error('Internal server error:', error);
        return json.error('Internal server error', 500);
    }
} as const;

router.post("/api/projects", {
    validation: projectsApiValidation.create,
}, async (_, { body }) => {
    try {
        const project = await projectService.createProject(body);

        return json({ success: true, project }, { status: 201 });
    } catch (error) {
        return API_ERRORS.INTERNAL_ERROR(error);
    }
});

router.get("/api/projects", {}, async () => {
    try {
        const projects = await projectService.listProjects();
        return json({ success: true, projects });
    } catch (error) {
        return API_ERRORS.INTERNAL_ERROR(error);
    }
});

router.get("/api/projects/:projectId", {
    validation: projectsApiValidation.getOrDelete
}, async (_, { params }) => {
    try {
        const project = await projectService.getProjectById(params.projectId);
        if (!project) {
            return API_ERRORS.NOT_FOUND();
        }
        return json({ success: true, project });
    } catch (error) {
        return API_ERRORS.INTERNAL_ERROR(error);
    }
});

router.patch("/api/projects/:projectId", {
    validation: projectsApiValidation.update
}, async (_, { params, body }) => {
    try {
        const updatedProject = await projectService.updateProject(params.projectId, body);
        if (!updatedProject) {
            return API_ERRORS.NOT_FOUND();
        }
        return json({ success: true, project: updatedProject });
    } catch (error) {
        return API_ERRORS.INTERNAL_ERROR(error);
    }
});

router.delete("/api/projects/:projectId", {
    validation: projectsApiValidation.getOrDelete
}, async (_, { params }) => {
    try {
        const deleted = await projectService.deleteProject(params.projectId);
        if (!deleted) {
            return API_ERRORS.NOT_FOUND();
        }
        return json({ success: true });
    } catch (error) {
        return API_ERRORS.INTERNAL_ERROR(error);
    }
});

router.post("/api/projects/:projectId/sync", {
    validation: projectsApiValidation.sync
}, async (_, { params }) => {
    try {
        const result = await projectService.syncProject(params.projectId);
        if (!result) {
            return API_ERRORS.NOT_FOUND();
        }
        return json(result);
    } catch (error) {
        return API_ERRORS.INTERNAL_ERROR(error);
    }
});

router.get("/api/projects/:projectId/files", {
    validation: projectsApiValidation.getFiles
}, async (_, { params }) => {
    try {
        const files = await projectService.getProjectFiles(params.projectId);
        if (!files) {
            return API_ERRORS.NOT_FOUND();
        }
        return json({ success: true, files });
    } catch (error) {
        return API_ERRORS.INTERNAL_ERROR(error);
    }
});