import {
    projects,
    type Project,
    files,
    type ProjectFile,
    eq,
    and,
    CreateProjectBody,
    UpdateProjectBody,
    inArray,
} from "shared";
import { FileSyncService } from './file-services/file-sync-service';
import { FileSummaryService } from './file-services/file-summary-service';
import { db } from "shared/database";
import { getState } from "@/websocket/websocket-config";


const fileSyncService = new FileSyncService();
const fileSummaryService = new FileSummaryService();

export class ProjectService {
    async createProject(data: CreateProjectBody): Promise<Project> {
        const [project] = await db.insert(projects)
            .values({
                name: data.name,
                path: data.path,
                description: data.description || '',
            })
            .returning();

        return project;
    }

    async getProjectById(projectId: string): Promise<Project | null> {
        const [project] = await db.select()
            .from(projects)
            .where(and(eq(projects.id, projectId)))
            .limit(1);

        return project || null;
    }

    async listProjects(): Promise<Project[]> {
        return await db.select()
            .from(projects);
    }

    async updateProject(projectId: string, data: UpdateProjectBody): Promise<Project | null> {
        const [updatedProject] = await db.update(projects)
            .set({
                ...data,
                updatedAt: new Date(),
            })
            .where(and(eq(projects.id, projectId)))
            .returning();

        return updatedProject || null;
    }

    async deleteProject(projectId: string): Promise<boolean> {
        const [deletedProject] = await db.delete(projects)
            .where(and(eq(projects.id, projectId)))
            .returning();

        return !!deletedProject;
    }

    async syncProject(projectId: string): Promise<{ success: boolean; message?: string } | null> {
        const project = await this.getProjectById(projectId);
        if (!project) return null;

        await fileSyncService.syncProject(project);

        const allFiles = await this.getProjectFiles(projectId);
        if (!allFiles) {
            return {
                success: false,
                message: 'Failed to retrieve project files',
            };
        }

        // Optionally auto-summarize here if desired.
        return {
            success: true,
            message: 'Project synchronized successfully',
        };
    }

    /**
     * Force re-summarize every file in the project.
     */
    async resummarizeAllFiles(projectId: string) {
        const project = await this.getProjectById(projectId);
        if (!project) {
            throw new Error('Project not found');
        }
        await fileSyncService.syncProject(project);

        const allFiles = await this.getProjectFiles(projectId);
        if (!allFiles) {
            throw new Error('No files found for project');
        }

        const globalState = await getState()
        await fileSummaryService.forceSummarizeFiles(projectId, allFiles, globalState);
    }

    async getProjectFiles(projectId: string): Promise<ProjectFile[] | null> {
        const project = await this.getProjectById(projectId);
        if (!project) {
            return null;
        }

        return db.select()
            .from(files)
            .where(eq(files.projectId, projectId))
            .all();
    }

    async updateFileContent(fileId: string, content: string): Promise<ProjectFile> {
        const [updatedFile] = await db.update(files)
            .set({
                content,
                updatedAt: new Date(),
            })
            .where(eq(files.id, fileId))
            .returning();

        if (!updatedFile) {
            throw new Error('File not found');
        }

        return updatedFile;
    }

    /**
     * Summarize a selected set of files by ID.
     */
    async summarizeSelectedFiles(projectId: string, fileIds: string[]) {
        const selectedFiles = await db.select()
            .from(files)
            .where(
                and(
                    eq(files.projectId, projectId),
                    inArray(files.id, fileIds),
                )
            );

        if (!selectedFiles.length) {
            return { included: 0, skipped: 0, message: "No matching files found" };
        }

        const globalState = await getState();
        const result = await fileSummaryService.summarizeFiles(
            projectId,
            selectedFiles,
            globalState
        );
        return {
            ...result,
            message: "Requested files have been summarized",
        };
    }
}