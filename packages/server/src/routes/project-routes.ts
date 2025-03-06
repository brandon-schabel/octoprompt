import app from "@/server-router";
import { zValidator } from '@hono/zod-validator';

import { projectsApiValidation, ApiError } from "shared";
import { z } from "zod";
import { createProject, deleteProject, getProjectById, getProjectFiles, listProjects, removeSummariesFromFiles, resummarizeAllFiles, summarizeSelectedFiles, updateProject } from "@/services/project-service";
import { syncProject, syncProjectFolder } from "@/services/file-services/file-sync-service";
import { watchersManager } from "@/services/shared-services";
import { existsSync } from 'node:fs';

const refreshQuerySchema = z.object({
    folder: z.string().optional()
});

// Create a new project
app.post("/api/projects",
    zValidator('json', projectsApiValidation.create.body),
    async (c) => {
        const body = await c.req.valid('json');
        
        // Make sure the path is normalized and absolutized
        const { resolve } = await import('node:path');
        const { homedir } = await import('node:os');
        
        // Handle tilde expansion properly
        let normalizedPath = body.path;
        if (normalizedPath.startsWith('~')) {
            normalizedPath = normalizedPath.replace(/^~/, homedir());
        }
        
        // Now resolve the path
        normalizedPath = resolve(normalizedPath);
        console.log(`Creating project - Original path: ${body.path}, Normalized path: ${normalizedPath}`);
        
        // Create with the normalized path
        const projectData = {
            ...body,
            path: normalizedPath
        };
        
        const project = await createProject(projectData);
        console.log(`Project created with ID: ${project.id}`);
        
        try {
            // Check if the directory exists
            const { existsSync } = await import('node:fs');
            if (!existsSync(project.path)) {
                console.error(`Project path does not exist: ${project.path}`);
                return c.json({ 
                    success: true, 
                    project,
                    warning: "Project created but directory does not exist. No files will be synced."
                }, 201);
            }
            
            // Sync project files immediately after creation
            console.log(`Starting sync for project: ${project.id} at path: ${project.path}`);
            await syncProject(project);
            console.log(`Finished syncing files for project: ${project.id}`);
            
            // Start watching the new project for file changes
            console.log(`Starting file watchers for project: ${project.id}`);
            await watchersManager.startWatchingProject(project, [
                "node_modules",
                "dist",
                ".git",
                "*.tmp",
                "*.db-journal",
            ]);
            console.log(`File watchers started for project: ${project.id}`);
            
            // Check how many files were synced
            const files = await getProjectFiles(project.id);
            console.log(`Synced ${files?.length || 0} files for project`);
        } catch (error) {
            console.error(`Error during project setup: ${error}`);
        }
        
        return c.json({ success: true, project }, 201);
    }
);

// List all projects
app.get("/api/projects", async (c) => {
    const projects = await listProjects();
    return c.json({ success: true, projects });
});

// Get a specific project
app.get("/api/projects/:projectId",
    zValidator('param', projectsApiValidation.getOrDelete.params),
    async (c) => {
        const { projectId } = c.req.valid('param');
        const project = await getProjectById(projectId);
        if (!project) {
            throw new ApiError("Project not found", 404, "NOT_FOUND");
        }
        return c.json({ success: true, project });
    }
);

// Update a project
app.patch("/api/projects/:projectId",
    zValidator('param', projectsApiValidation.update.params),
    zValidator('json', projectsApiValidation.update.body),
    async (c) => {
        const { projectId } = c.req.valid('param');
        const body = await c.req.valid('json');
        const updatedProject = await updateProject(projectId, body);
        if (!updatedProject) {
            throw new ApiError("Project not found", 404, "NOT_FOUND");
        }
        return c.json({ success: true, project: updatedProject });
    }
);

// Delete a project
app.delete("/api/projects/:projectId",
    zValidator('param', projectsApiValidation.getOrDelete.params),
    async (c) => {
        const { projectId } = c.req.valid('param');
        const deleted = await deleteProject(projectId);
        if (!deleted) {
            throw new ApiError("Project not found", 404, "NOT_FOUND");
        }
        return c.json({ success: true });
    }
);

// Sync a project
app.post("/api/projects/:projectId/sync",
    zValidator('param', projectsApiValidation.sync.params),
    async (c) => {
        const { projectId } = c.req.valid('param');
        const project = await getProjectById(projectId);
        if (!project) {
            throw new ApiError("Project not found", 404, "NOT_FOUND");
        }
        await syncProject(project);
        return c.json({ success: true });
    }
);

// Get project files
app.get("/api/projects/:projectId/files",
    zValidator('param', projectsApiValidation.getFiles.params),
    async (c) => {
        const { projectId } = c.req.valid('param');
        const project = await getProjectById(projectId);
        if (!project) {
            throw new ApiError("Project not found", 404, "NOT_FOUND");
        }
        await syncProject(project);
        const files = await getProjectFiles(projectId);
        if (!files) {
            throw new ApiError("Project not found", 404, "NOT_FOUND");
        }
        return c.json({ success: true, files });
    }
);

// Refresh project files
app.post("/api/projects/:projectId/refresh",
    zValidator('param', projectsApiValidation.sync.params),
    zValidator('query', refreshQuerySchema),
    async (c) => {
        const { projectId } = c.req.valid('param');
        const { folder } = c.req.valid('query');
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
        return c.json({ success: true, files });
    }
);

// Add test endpoint for debugging file syncing
app.get("/api/projects/:projectId/debug-file-sync",
    zValidator('param', projectsApiValidation.sync.params),
    async (c) => {
        console.log("DEBUG FILE SYNC ENDPOINT CALLED");
        const { projectId } = c.req.valid('param');
        const project = await getProjectById(projectId);
        if (!project) {
            throw new ApiError("Project not found", 404, "NOT_FOUND");
        }
        
        console.log(`Debug sync for project: ${project.id} at path: ${project.path}`);
        console.log(`Checking if path exists: ${existsSync(project.path)}`);
        
        try {
            // Directly call syncProject with debug logging
            const { resolve } = await import('node:path');
            const { readdirSync } = await import('node:fs');
            
            const absoluteProjectPath = resolve(project.path);
            console.log(`Absolute project path: ${absoluteProjectPath}`);
            
            try {
                const entries = readdirSync(absoluteProjectPath, { withFileTypes: true });
                console.log(`Found ${entries.length} entries in directory`);
            } catch (err) {
                console.error(`Error reading directory: ${err}`);
            }
            
            await syncProject(project);
            
            // Check how many files were synced
            const files = await getProjectFiles(project.id);
            console.log(`Synced ${files?.length || 0} files for project`);
            
            return c.json({ 
                success: true, 
                message: "Manual sync completed",
                fileCount: files?.length || 0,
                path: project.path,
                exists: existsSync(project.path)
            });
        } catch (error) {
            console.error(`Error in debug sync: ${error}`);
            return c.json({ 
                success: false, 
                error: String(error) 
            }, 500);
        }
    }
);

