import { projects, type Project, files, type ProjectFile, eq, and, CreateProjectBody, UpdateProjectBody, inArray } from "shared";
import { FileSyncService } from './file-sync-service';
import { FileSummaryService } from './file-summary-service';
import { db } from "shared/database";
import { wsManager } from "@/websocket/websocket-manager";

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

        // 1. Sync the files to ensure the DB has the latest project structure
        await fileSyncService.syncProject(project);

        // 2. Retrieve all project files
        const allFiles = await this.getProjectFiles(projectId);
        if (!allFiles) {
            return {
                success: false,
                message: 'Failed to retrieve project files',
            };
        }

        // 3. Summarize files if needed, up to MAX_SUMMARIES_PER_SYNC
        // await fileSummaryService.summarizeFiles(projectId, allFiles);

        return {
            success: true,
            message: 'Project synchronized and file summaries updated successfully',
        };
    }

    async getProjectFiles(projectId: string): Promise<ProjectFile[] | null> {
        const project = await this.getProjectById(projectId);
        if (!project) {
            return null;
        }

        return await db.select()
            .from(files)
            .where(eq(files.projectId, projectId));
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

    async summarizeSelectedFiles(projectId: string, fileIds: string[]) {
        // 1. Fetch the matching files
        const selectedFiles = await db.select()
            .from(files)
            .where(
                and(
                    eq(files.projectId, projectId),
                    inArray(files.id, fileIds),
                )
            )

        if (!selectedFiles.length) {
            return { included: 0, skipped: 0, message: "No matching files found" }
        }

        // 2. Grab the global state to pass in any allow/ignore patterns (if needed)
        //   If you already have a method for retrieving the global state from DB, use it.
        //   Otherwise, pass an empty or default globalState for now:
        const globalState = await wsManager.getStateFromDB()

        // 3. Summarize the files
        const result = await fileSummaryService.summarizeFiles(
            projectId,
            selectedFiles,
            globalState
        )
        return {
            ...result,
            message: "Requested files have been summarized",
        }
    }

}