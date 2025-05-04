import { db } from "@/utils/database";
import { normalizeToIsoString } from "@/utils/parse-timestamp";
import { normalizePathForDb as normalizePathForDbUtil, resolvePath } from '@/utils/path-utils';

import { forceSummarizeFiles, summarizeFiles } from "./file-services/file-summary-service";
import { syncProject } from "./file-services/file-sync-service";
import { CreateProjectBody, Project, ProjectFile, ProjectFileSchema, ProjectSchema, UpdateProjectBody } from "shared/src/schemas/project.schemas";
import path from 'path';

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
            createdAt: normalizeToIsoString(row.created_at) ?? 'ErrorParsingDate',
            updatedAt: normalizeToIsoString(row.updated_at) ?? 'ErrorParsingDate'
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
            createdAt: normalizeToIsoString(row.created_at) ?? 'ErrorParsingDate',
            updatedAt: normalizeToIsoString(row.updated_at) ?? 'ErrorParsingDate'
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
                createdAt: normalizeToIsoString(row.created_at) ?? 'ErrorParsingDate',
                updatedAt: normalizeToIsoString(row.updated_at) ?? 'ErrorParsingDate'
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
            createdAt: normalizeToIsoString(updatedRow.created_at) ?? 'ErrorParsingDate',
            updatedAt: normalizeToIsoString(updatedRow.updated_at) ?? 'ErrorParsingDate'
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
                summaryLastUpdatedAt: normalizeToIsoString(row.summary_last_updated_at) ?? null,
                meta: row.meta,
                checksum: row.checksum,
                createdAt: normalizeToIsoString(row.created_at) ?? 'ErrorParsingDate',
                updatedAt: normalizeToIsoString(row.updated_at) ?? 'ErrorParsingDate'
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
            summaryLastUpdatedAt: normalizeToIsoString(updatedRow.summary_last_updated_at) ?? null,
            meta: updatedRow.meta,
            checksum: updatedRow.checksum,
            createdAt: normalizeToIsoString(updatedRow.created_at) ?? 'ErrorParsingDate',
            updatedAt: normalizeToIsoString(updatedRow.updated_at) ?? 'ErrorParsingDate'
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

    // Pass the validated ProjectFile array
    await forceSummarizeFiles(allFiles); // Pass only the files array
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
                summaryLastUpdatedAt: normalizeToIsoString(row.summary_last_updated_at) ?? null,
                meta: row.meta, checksum: row.checksum, createdAt: normalizeToIsoString(row.created_at) ?? 'ErrorParsingDate',
                updatedAt: normalizeToIsoString(row.updated_at) ?? 'ErrorParsingDate'
            };
            return ProjectFileSchema.parse(fileData)
        });
    } catch (error) {
        console.error(`[ProjectService] Data validation error preparing files for forced re-summarization (Project: ${projectId}):`, error);
        throw new Error(`Failed to validate file data for forced re-summarization`);
    }

    // Pass the validated ProjectFile array
    await forceSummarizeFiles(selectedFiles); // Pass only the selected files array

    return {
        included: selectedFiles.length,
        skipped: 0, // This function forces, so skipping isn't the primary outcome here
        message: `Selected ${selectedFiles.length} files have been queued for force re-summarization`
    };
}

/**
 * Summarizes a specific list of file IDs within a project (skipping already summarized).
 */
export async function summarizeSelectedFiles(projectId: string, fileIds: string[],) {
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
                summaryLastUpdatedAt: normalizeToIsoString(row.summary_last_updated_at) ?? null,
                meta: row.meta, checksum: row.checksum, createdAt: normalizeToIsoString(row.created_at) ?? 'ErrorParsingDate',
                updatedAt: normalizeToIsoString(row.updated_at) ?? 'ErrorParsingDate'
            };
            return ProjectFileSchema.parse(fileData)
        });
    } catch (error) {
        console.error(`[ProjectService] Data validation error preparing files for summarization (Project: ${projectId}):`, error);
        throw new Error(`Failed to validate file data for summarization`);
    }

    // const globalState = await getCurrentState();
    // Pass the validated ProjectFile array



    const result = await summarizeFiles(projectId, selectedFiles.map((f) => f.id));

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

function mapDbRowToProjectFile(row: any): ProjectFile | null {
    if (!row) return null;
    try {
        // Map DB fields directly to schema fields
        const mapped: Omit<ProjectFile, 'summaryLastUpdatedAt' | 'createdAt' | 'updatedAt'> & {
            summary_last_updated_at: number | null;
            created_at: number;
            updated_at: number;
        } = {
            id: row.id,
            projectId: row.project_id, // DB uses project_id
            name: row.name,             // Add name if missing in original helper
            path: row.path,
            extension: row.extension,   // Add extension if missing
            size: row.size,
            content: row.content,      // DB content is nullable
            summary: row.summary,      // DB summary defaults to "", Zod allows string | null
            meta: row.meta,            // DB meta defaults to "", Zod allows string | null
            checksum: row.checksum,    // DB checksum defaults to "", Zod allows string | null
            // Raw numeric timestamps from DB
            summary_last_updated_at: row.summary_last_updated_at,
            created_at: row.created_at,
            updated_at: row.updated_at
        };

        // Transform timestamps and validate
        const fileData = {
            ...mapped,
            // Use normalizeToIsoString for timestamps
            summaryLastUpdatedAt: normalizeToIsoString(mapped.summary_last_updated_at) ?? null,
            createdAt: normalizeToIsoString(mapped.created_at) ?? 'ErrorParsingDate', // Handle potential parse error
            updatedAt: normalizeToIsoString(mapped.updated_at) ?? 'ErrorParsingDate'  // Handle potential parse error
        };

        // Use safeParse for robustness
        const result = ProjectFileSchema.safeParse(fileData);


        if (!result.success) {
            console.error(`Failed to parse project file data (ID: ${row.id}, Path: ${row.path}): ${result.error.message}`, fileData);
            return null; // Return null on parse failure
        }

        return result.data;
    } catch (e) {
        console.error(`Error mapping DB row to ProjectFile (ID: ${row.id}):`, e);
        return null;
    }
}

// Helper function to map DB row to Project schema
function mapDbRowToProject(row: any): Project | null {
    if (!row) return null;
    try {
        const mapped = {
            id: row.id,
            name: row.name,
            rootPath: row.root_path,
            createdAt: normalizeToIsoString(row.created_at) ?? new Date(0).toISOString(),
            updatedAt: normalizeToIsoString(row.updated_at) ?? new Date(0).toISOString(),
            lastIndexed: normalizeToIsoString(row.last_indexed)
        };
        const result = ProjectSchema.safeParse(mapped);
        if (!result.success) {
            console.error(`Failed to parse project data (ID: ${row.id}): ${result.error.message}`, mapped);
            return null;
        }
        return result.data;
    } catch (e) {
        console.error(`Error mapping DB row to Project (ID: ${row.id}):`, e);
        return null;
    }
}


/**
 * Creates a new file record in the database associated with a project.
 * Intended for placeholder creation before content generation/modification.
 */
export async function createProjectFileRecord(
    projectId: string,
    filePath: string,
    initialContent: string = '' // Default to empty content
): Promise<ProjectFile> {
    const project = await getProjectById(projectId);
    if (!project) {
        throw new Error(`[ProjectService] Cannot create file record: Project not found with ID ${projectId}`);
    }

    // Resolve and normalize the path *before* using it
    // Assuming filePath might be relative to project.path or contain ~
    const absoluteProjectPath = resolvePath(project.path);
    const absoluteFilePath = resolvePath(filePath.startsWith('/') || filePath.startsWith('~') ? filePath : path.join(absoluteProjectPath, filePath));
    const normalizedFilePath = normalizePathForDbUtil(path.relative(absoluteProjectPath, absoluteFilePath)); // Store path relative to project root

    // Use the normalized path for DB operations and deriving name/extension
    const fileName = path.basename(normalizedFilePath);
    const fileExtension = path.extname(normalizedFilePath);
    const size = Buffer.byteLength(initialContent, 'utf8');
    const nowTimestamp = Date.now(); // Use a single timestamp for consistency

    // Use SQLite's randomblob for ID generation consistent with createProject
    const stmt = db.prepare(`
        INSERT INTO files (
            id, project_id, name, path, extension,
            size, content, summary, summary_last_updated_at,
            meta, checksum, created_at, updated_at
        )
        VALUES (
            lower(hex(randomblob(16))), ?, ?, ?, ?,
            ?, ?, NULL, 0, -- size, content, summary, summary_last_updated_at (Changed NULL to 0)
            '{}', NULL, ?, ?    -- meta, checksum, created_at, updated_at
        )
        RETURNING *
    `);

    // Fetch raw row using normalized path
    const row = stmt.get(
        projectId, fileName, normalizedFilePath, fileExtension, // Use normalizedFilePath
        size, initialContent, // Use initialContent here
        nowTimestamp, nowTimestamp // Use the same timestamp for created/updated initially
    ) as {
        id: string; project_id: string; name: string; path: string; extension: string;
        size: number; content: string | null; summary: string | null;
        summary_last_updated_at: number | null; meta: string | null; checksum: string | null;
        created_at: number; updated_at: number;
    } | undefined;

    if (!row) {
        throw new Error(`[ProjectService] Failed to create file record for path: ${filePath} in project ${projectId}`);
    }

    try {
        // Transform raw DB data to API shape and validate using existing pattern
        const fileData = {
            id: row.id,
            projectId: row.project_id,
            name: row.name,
            path: row.path, // This should be the normalized path from the DB
            extension: row.extension,
            size: row.size,
            content: row.content, // Should match initialContent or be null if stored differently
            summary: row.summary,
            summaryLastUpdatedAt: normalizeToIsoString(row.summary_last_updated_at) ?? null,
            meta: row.meta ?? '{}', // Ensure meta is not null if schema requires string
            checksum: row.checksum,
            createdAt: normalizeToIsoString(row.created_at) ?? 'ErrorParsingDate',
            updatedAt: normalizeToIsoString(row.updated_at) ?? 'ErrorParsingDate'
        };
        // IMPORTANT: Ensure ProjectFileSchema aligns with the fields being inserted/returned
        // Especially nullability of 'content', 'meta', 'checksum' etc.
        return ProjectFileSchema.parse(fileData);
    } catch (error) {
        console.error(`[ProjectService] Data validation error creating file record ${row.id} (${filePath}):`, error);
        // Consider cleaning up the inserted row if validation fails? Transaction might be better.
        throw new Error(`Failed to validate file data after creation for ID ${row.id} (${filePath})`);
    }
}


/**
 * Represents the data needed to create or update a file record during sync.
 */
export interface FileSyncData {
    path: string; // Normalized relative path
    name: string;
    extension: string;
    content: string;
    size: number;
    checksum: string;
}

/**
 * Creates multiple file records in the database for a project.
 * Uses a transaction for efficiency.
 */
export async function bulkCreateProjectFiles(projectId: string, filesToCreate: FileSyncData[]): Promise<ProjectFile[]> {
    if (filesToCreate.length === 0) return [];

    const createdFiles: ProjectFile[] = [];
    const nowTimestamp = Date.now();

    const createTransaction = db.transaction((files: FileSyncData[]) => {
        const insertStmt = db.prepare<any, [string, string, string, string, number, string, string, number, number, string, number, number]>(`
            INSERT INTO files (id, project_id, name, path, extension, size, content, checksum, created_at, updated_at, meta, summary, summary_last_updated_at)
            VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', NULL, NULL)
            RETURNING *
        `); // Added meta, summary, summary_last_updated_at defaults

        for (const fileData of files) {
            // Note: RETURNING * might return DB types (numbers for dates).
            const row = insertStmt.get(
                projectId,
                fileData.name,
                fileData.path,
                fileData.extension,
                fileData.size,
                fileData.content,
                fileData.checksum,
                nowTimestamp,
                nowTimestamp,
                '{}',
                0,
                0
            ) as any; // Raw row

            if (row) {
                // Transform and validate *each* created file
                try {
                    const mappedFile = mapDbRowToProjectFile(row); // Use existing helper
                    if (mappedFile) {
                        createdFiles.push(mappedFile);
                    } else {
                        console.warn(`[ProjectService] Failed to map/validate file created for path: ${fileData.path}`);
                        // Decide if we should throw or just log
                    }
                } catch (validationError) {
                    console.error(`[ProjectService] Validation error for newly created file <span class="math-inline">\{row\.id\} \(</span>{fileData.path}):`, validationError);
                    // Decide if we should throw or just log
                }
            } else {
                console.error(`[ProjectService] Failed to create or retrieve file record for path: ${fileData.path}`);
                // Potentially throw an error here to abort the transaction if critical
            }
        }
    });

    try {
        createTransaction(filesToCreate);
        return createdFiles;
    } catch (error) {
        console.error(`[ProjectService] Error during bulk file creation transaction for project ${projectId}:`, error);
        throw new Error(`Bulk file creation failed for project ${projectId}`);
    }
}

/**
 * Updates multiple existing file records based on their IDs.
 * Uses a transaction for efficiency.
 */
export async function bulkUpdateProjectFiles(updates: { fileId: string; data: FileSyncData }[]): Promise<ProjectFile[]> {
    if (updates.length === 0) return [];

    const updatedFiles: ProjectFile[] = [];
    const nowTimestamp = Date.now();

    const updateTransaction = db.transaction((filesToUpdate: { fileId: string; data: FileSyncData }[]) => {
        const updateStmt = db.prepare<any, [string, string, number, string, number, string]>(`
             UPDATE files
             SET content = ?, extension = ?, size = ?, checksum = ?, updated_at = ?
             WHERE id = ?
             RETURNING *
         `); // Added RETURNING *

        for (const { fileId, data } of filesToUpdate) {
            const row = updateStmt.get(
                data.content,
                data.extension,
                data.size,
                data.checksum,
                nowTimestamp,
                fileId
            ) as any; // Raw row

            if (row) {
                try {
                    const mappedFile = mapDbRowToProjectFile(row); // Use existing helper
                    if (mappedFile) {
                        updatedFiles.push(mappedFile);
                    } else {
                        console.warn(`[ProjectService] Failed to map/validate file updated with ID: ${fileId}`);
                    }
                } catch (validationError) {
                    console.error(`[ProjectService] Validation error for updated file ${fileId}:`, validationError);
                }
            } else {
                console.warn(`[ProjectService] Failed to update or retrieve file record with ID: ${fileId}. It might have been deleted.`);
                // Don't throw, just warn, as the file might have been deleted concurrently
            }
        }
    });

    try {
        updateTransaction(updates);
        return updatedFiles;
    } catch (error) {
        console.error(`[ProjectService] Error during bulk file update transaction:`, error);
        throw new Error(`Bulk file update failed`);
    }
}


/**
 * Deletes multiple files by their IDs for a specific project.
 * Uses a transaction for efficiency (though less critical for deletes).
 */
export async function bulkDeleteProjectFiles(projectId: string, fileIdsToDelete: string[]): Promise<{ success: boolean, deletedCount: number }> {
    if (fileIdsToDelete.length === 0) {
        return { success: true, deletedCount: 0 };
    }

    let deletedCount = 0;
    const deleteTransaction = db.transaction((ids: string[]) => {
        const placeholders = ids.map(() => '?').join(', ');
        const deleteStmt = db.prepare(`
            DELETE FROM files
            WHERE project_id = ? AND id IN (${placeholders})
        `);
        // run() returns changes info
        const result = deleteStmt.run(projectId, ...ids);
        deletedCount = result.changes ?? 0;
    });

    try {
        deleteTransaction(fileIdsToDelete);
        return { success: true, deletedCount };
    } catch (error) {
        console.error(`[ProjectService] Error during bulk file deletion transaction for project ${projectId}:`, error);
        return { success: false, deletedCount: 0 }; // Indicate failure
    }
}


// (Keep helper functions mapDbRowToProjectFile, mapDbRowToProject)
// ...

// --- Remove or modify createProjectFileRecord if it's now redundant ---
// Option 1: Keep createProjectFileRecord for single, manual additions (e.g., user creates a new file via UI)
// Option 2: Remove it if bulkCreateProjectFiles covers all creation scenarios.
// Let's keep it for now, but it won't be used by the core sync logic.

// Make sure `getProjectFilesByIds` uses mapDbRowToProjectFile
export async function getProjectFilesByIds(projectId: string, fileIds: string[]): Promise<ProjectFile[]> {
    if (!fileIds || fileIds.length === 0) {
        return [];
    }
    const uniqueFileIds = [...new Set(fileIds)];
    const placeholders = uniqueFileIds.map(() => '?').join(',');

    // Ensure the table name is correct ('files' not 'project_files')
    const stmt = db.prepare(`
        SELECT * FROM files
        WHERE project_id = ? AND id IN (${placeholders})
    `);

    try {
        const rows = stmt.all(projectId, ...uniqueFileIds) as any[];
        // Use the mapping function and filter out nulls
        return rows.map(mapDbRowToProjectFile).filter((file): file is ProjectFile => file !== null);
    } catch (error) {
        console.error(`Error fetching project files by IDs for project ${projectId}:`, error);
        throw new Error(`Database error fetching files: ${error instanceof Error ? error.message : String(error)}`);
    }
}


