
import {
    eq,
    and,
    db,
    inArray,
} from "@db";
import {
    CreateProjectBody,
    UpdateProjectBody,
    schema
} from "shared";
import { FileSyncService } from './file-services/file-sync-service';
import { FileSummaryService } from './file-services/file-summary-service';
import { websocketStateAdapter } from "@/utils/websocket/websocket-state-adapter";

const { projects, files, } = schema;

type Project = schema.Project;
type ProjectFile = schema.ProjectFile;

/**
 * We add a new method `syncProjectFolder(...)` to handle partial syncing (a subdir).
 */

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

        return {
            success: true,
            message: 'Project synchronized successfully',
        };
    }

    /**
     * NEW: sync just a specific subfolder. We do a quick partial sync, ignoring other directories.
     */
    async syncProjectFolder(
        projectId: string,
        folderPath: string
    ): Promise<{ success: boolean; message?: string } | null> {
        const project = await this.getProjectById(projectId);
        if (!project) return null;

        await fileSyncService.syncProjectFolder(project, folderPath);

        return {
            success: true,
            message: `Partial sync for folder "${folderPath}" complete`,
        };
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

        const globalState = await websocketStateAdapter.getState();
        await fileSummaryService.forceSummarizeFiles(projectId, allFiles, globalState);
    }

    async forceResummarizeSelectedFiles(projectId: string, fileIds: string[]) {
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

        const globalState = await websocketStateAdapter.getState();
        const result = await fileSummaryService.forceResummarizeSelectedFiles(
            projectId,
            selectedFiles,
            globalState
        );
        return {
            ...result,
            message: "Selected files have been force re-summarized",
        };
    }

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

        const globalState = await websocketStateAdapter.getState();
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

    async removeSummariesFromFiles(projectId: string, fileIds: string[]) {
        const result = await db.update(files)
            .set({
                summary: null,
                summaryLastUpdatedAt: undefined,
            })
            .where(
                and(
                    eq(files.projectId, projectId),
                    inArray(files.id, fileIds),
                )
            )
            .returning();

        return {
            success: true,
            removedCount: result.length,
            message: `Removed summaries from ${result.length} files`,
        };
    }
}