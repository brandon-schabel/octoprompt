import { db } from "@/utils/database";
import {
    CreateProjectBody,
    UpdateProjectBody,
} from "shared";
import { ProjectReadSchema, FileReadSchema } from "shared/src/utils/database/db-schemas";
import { websocketStateAdapter } from "@/utils/websocket/websocket-state-adapter";
import { forceSummarizeFiles } from "./file-services/file-summary-service";
import { summarizeFiles } from "./file-services/file-summary-service";
import { syncProject } from "./file-services/file-sync-service";
import { Project, ProjectFile } from "shared/schema";


export type RawProject = {
    id: string;
    name: string;
    description: string;
    path: string;
    created_at: number;
    updated_at: number;
};

export type RawFile = {
    id: string;
    project_id: string;
    name: string;
    path: string;
    extension: string;
    size: number;
    content: string | null;
    summary: string | null;
    summary_last_updated_at: number;
    meta: string | null;
    checksum: string | null;
    created_at: number;
    updated_at: number;
};

export function mapProject(row: RawProject): Project {
    const mapped = {
        id: row.id,
        name: row.name,
        description: row.description,
        path: row.path,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
    };
    const project = ProjectReadSchema.parse(mapped);
    return {
        ...project,
        createdAt: new Date(project.createdAt),
        updatedAt: new Date(project.updatedAt)
    };
}

export function mapFile(row: RawFile): ProjectFile {
    const withDefaults = {
        ...row,
        content: row.content ?? null,
        summary: row.summary ?? '',
        meta: row.meta ?? '',
        checksum: row.checksum ?? ''
    };

    const mapped = {
        id: withDefaults.id,
        projectId: withDefaults.project_id,
        name: withDefaults.name,
        path: withDefaults.path,
        extension: withDefaults.extension,
        size: withDefaults.size,
        content: withDefaults.content,
        summary: withDefaults.summary,
        summaryLastUpdatedAt: new Date(withDefaults.summary_last_updated_at),
        meta: withDefaults.meta,
        checksum: withDefaults.checksum,
        createdAt: new Date(withDefaults.created_at),
        updatedAt: new Date(withDefaults.updated_at)
    } as const;

    const validated = FileReadSchema.parse(mapped);
    return {
        ...validated,
        createdAt: new Date(validated.createdAt),
        updatedAt: new Date(validated.updatedAt),
        summaryLastUpdatedAt: new Date(validated.summaryLastUpdatedAt),
        content: validated.content ?? null,
        summary: validated.summary ?? null,
        meta: validated.meta ?? null,
        checksum: validated.checksum ?? null
    };
}

export async function createProject(data: CreateProjectBody): Promise<Project> {
    const stmt = db.prepare(`
        INSERT INTO projects (name, path, description, created_at, updated_at) 
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
    `);
    const created = stmt.get(data.name, data.path, data.description || '') as RawProject;
    return mapProject(created);
}

export async function getProjectById(projectId: string): Promise<Project | null> {
    const stmt = db.prepare(`
        SELECT * FROM projects 
        WHERE id = ? 
        LIMIT 1
    `);
    const found = stmt.get(projectId) as RawProject | undefined;
    if (!found) return null;
    return mapProject(found);
}

export async function listProjects(): Promise<Project[]> {
    const stmt = db.prepare(`
        SELECT * FROM projects
    `);
    const rows = stmt.all() as RawProject[];
    return rows.map(mapProject);
}

export async function updateProject(projectId: string, data: UpdateProjectBody): Promise<Project | null> {
    const stmt = db.prepare(`
        UPDATE projects 
        SET name = ?, description = ?, path = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
        RETURNING *
    `);
    const updated = stmt.get(
        data.name ?? '',
        data.description || '',
        data.path ?? '',
        projectId
    ) as RawProject | undefined;

    if (!updated) return null;
    return mapProject(updated);
}

export async function deleteProject(projectId: string): Promise<boolean> {
    const stmt = db.prepare(`
        DELETE FROM projects 
        WHERE id = ?
        RETURNING *
    `);
    const deleted = stmt.get(projectId) as RawProject | undefined;
    return !!deleted;
}

export async function getProjectFiles(projectId: string): Promise<ProjectFile[] | null> {
    const project = await getProjectById(projectId);
    if (!project) {
        return null;
    }
    const stmt = db.prepare(`
        SELECT * FROM files 
        WHERE project_id = ?
    `);
    const rows = stmt.all(projectId) as RawFile[];
    return rows.map(mapFile);
}

export async function updateFileContent(
    fileId: string,
    content: string,
    options?: { updatedAt?: Date }
): Promise<ProjectFile> {
    const stmt = db.prepare(`
        UPDATE files 
        SET content = ?, 
            updated_at = ${options?.updatedAt ? '?' : 'CURRENT_TIMESTAMP'}
        WHERE id = ?
        RETURNING *
    `);
    const params = options?.updatedAt
        ? [content, options.updatedAt.valueOf(), fileId]
        : [content, fileId];
    const updated = stmt.get(...params) as RawFile | undefined;
    if (!updated) {
        throw new Error('File not found');
    }
    return mapFile(updated);
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
    const placeholders = fileIds.map(() => '?').join(', ');
    const stmt = db.prepare(`
        SELECT * FROM files 
        WHERE project_id = ? AND id IN (${placeholders})
    `);
    const selectedFiles = stmt.all(projectId, ...fileIds) as RawFile[];
    if (!selectedFiles.length) {
        return { included: 0, skipped: 0, message: "No matching files found" };
    }
    const globalState = await websocketStateAdapter.getState();
    await forceSummarizeFiles(projectId, selectedFiles.map(mapFile), globalState);
    return {
        included: selectedFiles.length,
        skipped: 0,
        message: "Selected files have been force re-summarized"
    };
}

export async function summarizeSelectedFiles(projectId: string, fileIds: string[]) {
    const placeholders = fileIds.map(() => '?').join(', ');
    const stmt = db.prepare(`
        SELECT * FROM files 
        WHERE project_id = ? AND id IN (${placeholders})
    `);
    const selectedFiles = stmt.all(projectId, ...fileIds) as RawFile[];
    if (!selectedFiles.length) {
        return { included: 0, skipped: 0, message: "No matching files found" };
    }
    const globalState = await websocketStateAdapter.getState();
    const result = await summarizeFiles(projectId, selectedFiles.map(mapFile), globalState);
    return {
        ...result,
        message: "Requested files have been summarized",
    };
}

export async function removeSummariesFromFiles(projectId: string, fileIds: string[]) {
    const placeholders = fileIds.map(() => '?').join(', ');
    const stmt = db.prepare(`
        UPDATE files 
        SET summary = NULL, summary_last_updated_at = 0 
        WHERE project_id = ? AND id IN (${placeholders})
        RETURNING *
    `);
    const updated = stmt.all(projectId, ...fileIds) as RawFile[];
    return {
        success: true,
        removedCount: updated.length,
        message: `Removed summaries from ${updated.length} files`,
    };
}