import { projects, type Project, files, type ProjectFile, eq, and, CreateProjectBody, UpdateProjectBody } from "shared";
import { FileSyncService } from './file-sync-service';
import { db } from "shared/database";

const fileSyncService = new FileSyncService();

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

    async getProjectFiles(projectId: string): Promise<ProjectFile[] | null> {
        const project = await this.getProjectById(projectId);
        if (!project) {
            return null;
        }

        return await db.select()
            .from(files)
            .where(eq(files.projectId, projectId));
    }

}