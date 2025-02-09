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
import { websocketStateAdapter } from "@/utils/websocket/websocket-state-adapter";
import { forceSummarizeFiles } from "./file-services/file-summary-service";
import { summarizeFiles } from "./file-services/file-summary-service";
import { syncProject } from "./file-services/file-sync-service";

const { projects, files } = schema;

type Project = schema.Project;
type ProjectFile = schema.ProjectFile;



export async function createProject(data: CreateProjectBody): Promise<Project> {
    const [project] = await db.insert(projects)
        .values({
            name: data.name,
            path: data.path,
            description: data.description || '',
        })
        .returning();

    return project;
}

export async function getProjectById(projectId: string): Promise<Project | null> {
    const [project] = await db.select()
        .from(projects)
        .where(and(eq(projects.id, projectId)))
        .limit(1);

    return project || null;
}

export async function listProjects(): Promise<Project[]> {
    return await db.select()
        .from(projects);
}

export async function updateProject(projectId: string, data: UpdateProjectBody): Promise<Project | null> {
    const [updatedProject] = await db.update(projects)
        .set({
            ...data,
            updatedAt: new Date(),
        })
        .where(and(eq(projects.id, projectId)))
        .returning();

    return updatedProject || null;
}

export async function deleteProject(projectId: string): Promise<boolean> {
    const [deletedProject] = await db.delete(projects)
        .where(and(eq(projects.id, projectId)))
        .returning();

    return !!deletedProject;
}


export async function getProjectFiles(projectId: string): Promise<ProjectFile[] | null> {
    const project = await getProjectById(projectId);
    if (!project) {
        return null;
    }

    return db.select()
        .from(files)
        .where(eq(files.projectId, projectId))
        .all();
}

export async function updateFileContent(fileId: string, content: string): Promise<ProjectFile> {
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

export async function resummarizeAllFiles(projectId: string) {
    const project = await getProjectById(projectId);
    if (!project) {
        throw new Error('Project not found');
    }
    await syncProject(project);

    const allFiles = await getProjectFiles(projectId);
    if (!allFiles) {
        throw new Error('No files found for project');
    }

    const globalState = await websocketStateAdapter.getState();
    await forceSummarizeFiles(projectId, allFiles, globalState);
}

export async function forceResummarizeSelectedFiles(
    projectId: string,
    fileIds: string[]
): Promise<{ included: number; skipped: number; message: string }> {
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
    await forceSummarizeFiles(
        projectId,
        selectedFiles,
        globalState
    );
    return {
        included: selectedFiles.length,
        skipped: 0,
        message: "Selected files have been force re-summarized",
    };
}

export async function summarizeSelectedFiles(projectId: string, fileIds: string[]) {
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
    const result = await summarizeFiles(
        projectId,
        selectedFiles,
        globalState
    );
    return {
        ...result,
        message: "Requested files have been summarized",
    };
}

export async function removeSummariesFromFiles(projectId: string, fileIds: string[]) {
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