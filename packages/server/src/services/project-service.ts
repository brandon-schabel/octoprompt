// packages/server/src/services/project-service.ts
import { db } from "@/utils/database";

import { websocketStateAdapter } from "@/utils/websocket/websocket-state-adapter";
import { forceSummarizeFiles, summarizeFiles } from "./file-services/file-summary-service";
import { syncProject } from "./file-services/file-sync-service";
import { CreateProjectBody, Project, ProjectFile, ProjectFileSchema, ProjectSchema, UpdateProjectBody } from "shared/src/schemas/project.schemas";

// --- Internal DB Types and Mapping Functions Removed ---

/**
 * Creates a new project in the database.
 * Transforms and validates the created row against ProjectSchema.
 */
export async function createProject(data: CreateProjectBody): Promise<Project> {
    const stmt = db.prepare(`
        INSERT INTO projects (id, name, path, description, created_at, updated_at)
        VALUES (lower(hex(randomblob(16))), ?, ?, ?, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000) -- Store as milliseconds Unix timestamp
        RETURNING *
    `);
    // Fetch raw row - Note: SQLite CURRENT_TIMESTAMP might return string, use strftime for consistent number
    const row = stmt.get(data.name, data.path, data.description || '') as { id: string; name: string; path: string; description: string; created_at: number; updated_at: number; } | undefined;

    if (!row) {
        // This should theoretically not happen with RETURNING * on successful insert
        throw new Error("Failed to create project or retrieve the created row.");
    }

    try {
        // Transform raw DB data to API shape and validate
        const projectData = {
            id: row.id,
            name: row.name,
            description: row.description,
            path: row.path,
            createdAt: new Date(row.created_at).toISOString(), // Convert number timestamp to ISO string
            updatedAt: new Date(row.updated_at).toISOString()  // Convert number timestamp to ISO string
        };
        return ProjectSchema.parse(projectData);
    } catch (error) {
        console.error(`[ProjectService] Data validation error creating project ${row.id}:`, error);
        throw new Error(`Failed to validate project data after creation for ID ${row.id}`);
    }
}

/**
 * Retrieves a project by its ID.
 * Transforms and validates the found row against ProjectSchema.
 */
export async function getProjectById(projectId: string): Promise<Project | null> {
    const stmt = db.prepare(`
        SELECT * FROM projects
        WHERE id = ?
        LIMIT 1
    `);
    // Fetch raw row
    const row = stmt.get(projectId) as { id: string; name: string; path: string; description: string; created_at: number; updated_at: number; } | undefined;

    if (!row) return null;

    try {
        // Transform raw DB data to API shape and validate
        const projectData = {
            id: row.id,
            name: row.name,
            description: row.description,
            path: row.path,
            createdAt: new Date(row.created_at).toISOString(),
            updatedAt: new Date(row.updated_at).toISOString()
        };
        return ProjectSchema.parse(projectData);
    } catch (error) {
        console.error(`[ProjectService] Data validation error for project ${projectId}:`, error);
        throw new Error(`Failed to validate project data for ID ${projectId}`);
    }
}

/**
 * Lists all projects.
 * Transforms and validates each row against ProjectSchema.
 */
export async function listProjects(): Promise<Project[]> {
    const stmt = db.prepare(`
        SELECT * FROM projects ORDER BY updated_at DESC
    `);
    // Fetch raw rows
    const rows = stmt.all() as { id: string; name: string; path: string; description: string; created_at: number; updated_at: number; }[];

    try {
        // Transform and validate each row
        return rows.map(row => {
            const projectData = {
                id: row.id,
                name: row.name,
                description: row.description,
                path: row.path,
                createdAt: new Date(row.created_at).toISOString(),
                updatedAt: new Date(row.updated_at).toISOString()
            };
            return ProjectSchema.parse(projectData);
        });
    } catch (error) {
        console.error(`[ProjectService] Data validation error listing projects:`, error);
        throw new Error("Failed to validate project list data");
    }
}

/**
 * Updates an existing project.
 * Transforms and validates the updated row against ProjectSchema.
 */
export async function updateProject(projectId: string, data: UpdateProjectBody): Promise<Project | null> {
    const stmt = db.prepare(`
        UPDATE projects
        SET name = COALESCE(?, name),
            description = COALESCE(?, description),
            path = COALESCE(?, path),
            updated_at = strftime('%s', 'now') * 1000
        WHERE id = ?
        RETURNING *
    `);
    // Fetch raw updated row
    const updatedRow = stmt.get(
        data.name ?? null, // Use ?? for clarity over || for potentially empty strings
        data.description ?? null,
        data.path ?? null,
        projectId
    ) as { id: string; name: string; path: string; description: string; created_at: number; updated_at: number; } | undefined;

    if (!updatedRow) return null;

    try {
        // Transform and validate
        const projectData = {
            id: updatedRow.id,
            name: updatedRow.name,
            description: updatedRow.description,
            path: updatedRow.path,
            createdAt: new Date(updatedRow.created_at).toISOString(),
            updatedAt: new Date(updatedRow.updated_at).toISOString()
        };
        return ProjectSchema.parse(projectData);
    } catch (error) {
        console.error(`[ProjectService] Data validation error updating project ${projectId}:`, error);
        throw new Error(`Failed to validate project data after update for ID ${projectId}`);
    }
}

/**
 * Deletes a project by its ID.
 * Returns true if deletion was successful, false otherwise.
 */
export async function deleteProject(projectId: string): Promise<boolean> {
    // CASCADE delete handles related files, tickets, etc. defined in DB schema
    const stmt = db.prepare(`
        DELETE FROM projects
        WHERE id = ?
        RETURNING id -- Only need to know if something was returned
    `);
    const deleted = stmt.get(projectId) as { id: string } | undefined;
    return !!deleted; // Return true if an ID was returned (meaning a row was deleted)
}

/**
 * Retrieves all files associated with a project.
 * Transforms and validates each file row against ProjectFileSchema.
 */
export async function getProjectFiles(projectId: string): Promise<ProjectFile[] | null> {
    // Optional: Check if project exists first if needed, getProjectById is already refactored
    const project = await getProjectById(projectId);
    if (!project) {
        console.warn(`[ProjectService] Attempted to get files for non-existent project: ${projectId}`);
        return null; // Return null if project doesn't exist
    }

    const stmt = db.prepare(`
        SELECT * FROM files
        WHERE project_id = ?
    `);
    // Fetch raw file rows
    const rows = stmt.all(projectId) as {
        id: string; project_id: string; name: string; path: string; extension: string;
        size: number; content: string | null; summary: string | null;
        summary_last_updated_at: number | null; meta: string | null; checksum: string | null;
        created_at: number; updated_at: number;
    }[];

    try {
        // Transform and validate each file row
        return rows.map(row => {
            const fileData = {
                id: row.id,
                projectId: row.project_id,
                name: row.name,
                path: row.path,
                extension: row.extension,
                size: row.size,
                content: row.content,
                summary: row.summary,
                summaryLastUpdatedAt: row.summary_last_updated_at ? new Date(row.summary_last_updated_at).toISOString() : null,
                meta: row.meta,
                checksum: row.checksum,
                createdAt: new Date(row.created_at).toISOString(),
                updatedAt: new Date(row.updated_at).toISOString()
            };
            return ProjectFileSchema.parse(fileData);
        });
    } catch (error) {
        console.error(`[ProjectService] Data validation error listing files for project ${projectId}:`, error);
        throw new Error(`Failed to validate file list data for project ${projectId}`);
    }
}

/**
 * Updates the content and optionally the updated_at timestamp of a file.
 * Transforms and validates the updated file row against ProjectFileSchema.
 */
export async function updateFileContent(
    fileId: string,
    content: string,
    options?: { updatedAt?: Date } // Keep Date object for potential external setting
): Promise<ProjectFile> {
    const setUpdatedAtClause = options?.updatedAt ? '?' : "strftime('%s', 'now') * 1000";
    const stmt = db.prepare(`
        UPDATE files
        SET content = ?,
            updated_at = ${setUpdatedAtClause}
        WHERE id = ?
        RETURNING *
    `);
    const params: (string | number)[] = options?.updatedAt
        ? [content, options.updatedAt.valueOf(), fileId] // Pass timestamp as number
        : [content, fileId];

    // Fetch raw updated row
    const updatedRow = stmt.get(...params) as {
        id: string; project_id: string; name: string; path: string; extension: string;
        size: number; content: string | null; summary: string | null;
        summary_last_updated_at: number | null; meta: string | null; checksum: string | null;
        created_at: number; updated_at: number;
    } | undefined;

    if (!updatedRow) {
        throw new Error(`[ProjectService] File not found with ID ${fileId} during content update.`);
    }

    try {
        // Transform and validate
        const fileData = {
            id: updatedRow.id,
            projectId: updatedRow.project_id,
            name: updatedRow.name,
            path: updatedRow.path,
            extension: updatedRow.extension,
            size: updatedRow.size,
            content: updatedRow.content,
            summary: updatedRow.summary,
            summaryLastUpdatedAt: updatedRow.summary_last_updated_at ? new Date(updatedRow.summary_last_updated_at).toISOString() : null,
            meta: updatedRow.meta,
            checksum: updatedRow.checksum,
            createdAt: new Date(updatedRow.created_at).toISOString(),
            updatedAt: new Date(updatedRow.updated_at).toISOString()
        };
        return ProjectFileSchema.parse(fileData);
    } catch (error) {
        console.error(`[ProjectService] Data validation error updating file content for ${fileId}:`, error);
        throw new Error(`Failed to validate file data after content update for ID ${fileId}`);
    }
}

/**
 * Fetches project, syncs files, gets files, and forces summarization for all files.
 */
export async function resummarizeAllFiles(projectId: string): Promise<void> {
    const project = await getProjectById(projectId);
    if (!project) {
        throw new Error(`[ProjectService] Project not found with ID ${projectId} for resummarize all.`);
    }
    // Sync files first to ensure we have the latest state
    await syncProject(project);

    // Get the validated list of files
    const allFiles = await getProjectFiles(projectId);
    if (!allFiles || allFiles.length === 0) {
        console.warn(`[ProjectService] No files found for project ${projectId} after sync during resummarize all.`);
        // Decide behavior: maybe return silently or throw specific error?
        // For now, let's assume forceSummarizeFiles handles empty list gracefully or throws.
        return; // Or throw new Error('No files found for project to resummarize');
    }

    const globalState = await websocketStateAdapter.getState();
    // Pass the validated ProjectFile array
    await forceSummarizeFiles(projectId, allFiles, globalState);
}

/**
 * Forces re-summarization for a specific list of file IDs within a project.
 */
export async function forceResummarizeSelectedFiles(
    projectId: string,
    fileIds: string[]
): Promise<{ included: number; skipped: number; message: string }> {
    if (fileIds.length === 0) {
        return { included: 0, skipped: 0, message: "No file IDs provided" };
    }
    const placeholders = fileIds.map(() => '?').join(', ');
    const stmt = db.prepare(`
        SELECT * FROM files
        WHERE project_id = ? AND id IN (${placeholders})
    `);
    // Fetch raw rows for selected files
    const selectedRawFiles = stmt.all(projectId, ...fileIds) as {
        id: string; project_id: string; name: string; path: string; extension: string;
        size: number; content: string | null; summary: string | null;
        summary_last_updated_at: number | null; meta: string | null; checksum: string | null;
        created_at: number; updated_at: number;
    }[];

    if (selectedRawFiles.length === 0) {
        return { included: 0, skipped: 0, message: "No matching files found for the provided IDs" };
    }

    let selectedFiles: ProjectFile[];
    try {
        // Transform and validate the fetched raw files
        selectedFiles = selectedRawFiles.map(row => {
            const fileData = {
                id: row.id, projectId: row.project_id, name: row.name, path: row.path,
                extension: row.extension, size: row.size, content: row.content, summary: row.summary,
                summaryLastUpdatedAt: row.summary_last_updated_at ? new Date(row.summary_last_updated_at).toISOString() : null,
                meta: row.meta, checksum: row.checksum, createdAt: new Date(row.created_at).toISOString(),
                updatedAt: new Date(row.updated_at).toISOString()
            };
            return ProjectFileSchema.parse(fileData)
        });
    } catch (error) {
        console.error(`[ProjectService] Data validation error preparing files for forced re-summarization (Project: ${projectId}):`, error);
        throw new Error(`Failed to validate file data for forced re-summarization`);
    }

    const globalState = await websocketStateAdapter.getState();
    // Pass the validated ProjectFile array
    await forceSummarizeFiles(projectId, selectedFiles, globalState);

    return {
        included: selectedFiles.length,
        skipped: 0, // This function forces, so skipping isn't the primary outcome here
        message: `Selected ${selectedFiles.length} files have been queued for force re-summarization`
    };
}

/**
 * Summarizes a specific list of file IDs within a project (skipping already summarized).
 */
export async function summarizeSelectedFiles(projectId: string, fileIds: string[]) {
    if (fileIds.length === 0) {
        return { included: 0, skipped: 0, message: "No file IDs provided" };
    }
    const placeholders = fileIds.map(() => '?').join(', ');
    const stmt = db.prepare(`
        SELECT * FROM files
        WHERE project_id = ? AND id IN (${placeholders})
    `);
    // Fetch raw rows for selected files
    const selectedRawFiles = stmt.all(projectId, ...fileIds) as {
        id: string; project_id: string; name: string; path: string; extension: string;
        size: number; content: string | null; summary: string | null;
        summary_last_updated_at: number | null; meta: string | null; checksum: string | null;
        created_at: number; updated_at: number;
    }[];

    if (selectedRawFiles.length === 0) {
        return { included: 0, skipped: 0, message: "No matching files found for the provided IDs" };
    }

    let selectedFiles: ProjectFile[];
    try {
        // Transform and validate the fetched raw files
        selectedFiles = selectedRawFiles.map(row => {
            const fileData = {
                id: row.id, projectId: row.project_id, name: row.name, path: row.path,
                extension: row.extension, size: row.size, content: row.content, summary: row.summary,
                summaryLastUpdatedAt: row.summary_last_updated_at ? new Date(row.summary_last_updated_at).toISOString() : null,
                meta: row.meta, checksum: row.checksum, createdAt: new Date(row.created_at).toISOString(),
                updatedAt: new Date(row.updated_at).toISOString()
            };
            return ProjectFileSchema.parse(fileData)
        });
    } catch (error) {
        console.error(`[ProjectService] Data validation error preparing files for summarization (Project: ${projectId}):`, error);
        throw new Error(`Failed to validate file data for summarization`);
    }


    const globalState = await websocketStateAdapter.getState();
    // Pass the validated ProjectFile array
    const result = await summarizeFiles(projectId, selectedFiles, globalState);

    return {
        ...result, // { included: number, skipped: number }
        message: `Requested ${selectedFiles.length} files have been processed for summarization`,
    };
}

/**
 * Removes summaries and their update timestamps from selected files.
 */
export async function removeSummariesFromFiles(projectId: string, fileIds: string[]) {
    if (fileIds.length === 0) {
        return { success: true, removedCount: 0, message: "No file IDs provided to remove summaries from" };
    }
    const placeholders = fileIds.map(() => '?').join(', ');
    const stmt = db.prepare(`
        UPDATE files
        SET summary = NULL, summary_last_updated_at = NULL,
            updated_at = strftime('%s', 'now') * 1000 -- Also update the main timestamp
        WHERE project_id = ? AND id IN (${placeholders})
        RETURNING id -- Only need count, so just return ID
    `);
    const updated = stmt.all(projectId, ...fileIds) as { id: string }[]; // Only need the count

    // No parsing needed here, just returning counts/status
    return {
        success: true,
        removedCount: updated.length,
        message: `Removed summaries from ${updated.length} files`,
    };
}