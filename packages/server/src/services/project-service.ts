import { resolvePath } from '@/utils/path-utils';
import { projectStorage, type ProjectFilesStorage, ProjectFilesStorageSchema } from '@/utils/project-storage';
import { forceSummarizeFiles, summarizeFiles } from "./file-services/file-summary-service";
import { syncProject } from "./file-services/file-sync-service";
import { CreateProjectBody, Project, ProjectFile, ProjectFileSchema, ProjectSchema, UpdateProjectBody } from "shared/src/schemas/project.schemas";
import path from 'path';
import { ZodError } from "zod"

/**
 * Creates a new project stored in JSON.
 */
export async function createProject(data: CreateProjectBody): Promise<Project> {
    const projectId = projectStorage.generateId('proj');
    const now = new Date().toISOString();

    const newProjectData: Project = {
        id: projectId,
        name: data.name,
        path: data.path, // Store the path as provided initially
        description: data.description || '',
        createdAt: now,
        updatedAt: now,
    };

    try {
        // Validate the new project data structure itself
        const validatedProject = ProjectSchema.parse(newProjectData);

        const projects = await projectStorage.readProjects();
        if (projects[projectId]) {
            // Extremely unlikely with timestamp/random ID, but good practice
            throw new Error(`Project ID conflict for ${projectId}`);
        }
        projects[projectId] = validatedProject;
        await projectStorage.writeProjects(projects);

        // Create the project's file storage (empty initially)
        await projectStorage.writeProjectFiles(projectId, {}); // Ensures directory is created

        return validatedProject;
    } catch (error) {
        console.error(`[ProjectService] Error creating project ${data.name}:`, error);
        if (error instanceof ZodError) {
            throw new Error(`Validation failed creating project: ${error.message}`);
        }
        throw new Error(`Failed to create project ${data.name}. Reason: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Retrieves a project by its ID from JSON.
 */
export async function getProjectById(projectId: string): Promise<Project | null> {
    try {
        const projects = await projectStorage.readProjects();
        // The read function already validates against ProjectSchema
        return projects[projectId] || null;
    } catch (error) {
        console.error(`[ProjectService] Error getting project ${projectId}:`, error);
        // Don't throw, return null as per original logic possibility
        return null;
    }
}

/**
 * Lists all projects from JSON.
 */
export async function listProjects(): Promise<Project[]> {
    try {
        const projects = await projectStorage.readProjects();
        const projectList = Object.values(projects);
        // Sort by updatedAt descending, assuming ISO strings compare correctly
        projectList.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        return projectList;
    } catch (error) {
        console.error(`[ProjectService] Error listing projects:`, error);
        throw new Error(`Failed to list projects. Reason: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Updates an existing project in JSON.
 */
export async function updateProject(projectId: string, data: UpdateProjectBody): Promise<Project | null> {
    try {
        const projects = await projectStorage.readProjects();
        const existingProject = projects[projectId];

        if (!existingProject) {
            return null; // Project not found
        }

        // Create updated project data, merging fields
        const updatedProjectData: Project = {
            ...existingProject,
            name: data.name ?? existingProject.name,
            path: data.path ?? existingProject.path,
            description: data.description ?? existingProject.description,
            updatedAt: new Date().toISOString(), // Update timestamp
        };

        // Validate the final structure
        const validatedProject = ProjectSchema.parse(updatedProjectData);

        projects[projectId] = validatedProject;
        await projectStorage.writeProjects(projects);

        return validatedProject;
    } catch (error) {
        console.error(`[ProjectService] Error updating project ${projectId}:`, error);
        if (error instanceof ZodError) {
            throw new Error(`Validation failed updating project ${projectId}: ${error.message}`);
        }
        throw new Error(`Failed to update project ${projectId}. Reason: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Deletes a project from JSON and its associated file data.
 */
export async function deleteProject(projectId: string): Promise<boolean> {
    try {
        const projects = await projectStorage.readProjects();
        if (!projects[projectId]) {
            return false; // Project didn't exist
        }

        delete projects[projectId];
        await projectStorage.writeProjects(projects);

        // Also delete the project's file data directory
        await projectStorage.deleteProjectData(projectId);

        return true;
    } catch (error) {
        console.error(`[ProjectService] Error deleting project ${projectId}:`, error);
        // Return false on failure to maintain boolean signature
        return false;
    }
}

/**
 * Retrieves all files associated with a project from JSON.
 */
export async function getProjectFiles(projectId: string): Promise<ProjectFile[] | null> {
    try {
        // Optional: Check if project exists first (could be redundant if file read handles it)
        const projectExists = await getProjectById(projectId);
        if (!projectExists) {
            console.warn(`[ProjectService] Attempted to get files for non-existent project: ${projectId}`);
            return null;
        }

        const files = await projectStorage.readProjectFiles(projectId);
        // readProjectFiles validates each file against ProjectFileSchema
        return Object.values(files);
    } catch (error) {
        console.error(`[ProjectService] Error getting files for project ${projectId}:`, error);
        // Return null or throw depending on desired behavior on error
        // Let's throw, as failure here is likely more critical than project get/list
        throw new Error(`Failed to get files for project ${projectId}. Reason: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Updates the content and timestamp of a specific file within a project's JSON.
 * NOTE: Requires projectId context now.
 */
export async function updateFileContent(
    projectId: string, // Added projectId
    fileId: string,
    content: string,
    options?: { updatedAt?: Date }
): Promise<ProjectFile> {
    try {
        const files = await projectStorage.readProjectFiles(projectId);
        const existingFile = files[fileId];

        if (!existingFile) {
            throw new Error(`[ProjectService] File not found with ID ${fileId} in project ${projectId} during content update.`);
        }

        const newUpdatedAt = options?.updatedAt?.toISOString() ?? new Date().toISOString();

        const updatedFileData: ProjectFile = {
            ...existingFile,
            content: content,
            size: Buffer.byteLength(content, 'utf8'), // Recalculate size
            updatedAt: newUpdatedAt,
            // Consider if checksum needs update here too, depends on how checksums are used
            // checksum: calculateChecksum(content),
        };

        // Validate the updated file structure
        const validatedFile = ProjectFileSchema.parse(updatedFileData);

        files[fileId] = validatedFile;
        await projectStorage.writeProjectFiles(projectId, files);

        return validatedFile;
    } catch (error) {
        console.error(`[ProjectService] Error updating file content for ${fileId} in project ${projectId}:`, error);
        if (error instanceof ZodError) {
            throw new Error(`Validation failed updating file content for ${fileId}: ${error.message}`);
        }
        throw new Error(`Failed to update file content for ${fileId}. Reason: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Fetches project, syncs files, gets files, and forces summarization for all files.
 * NOTE: forceSummarizeFiles needs access to modify/save file data now.
 */
export async function resummarizeAllFiles(projectId: string): Promise<void> {
    const project = await getProjectById(projectId);
    if (!project) {
        throw new Error(`[ProjectService] Project not found with ID ${projectId} for resummarize all.`);
    }

    // Sync files first (assuming syncProject is adapted to use JSON or works independently)
    await syncProject(project); // syncProject might internally call bulk create/update/delete using the new JSON methods

    const allFiles = await getProjectFiles(projectId); // Get potentially updated list
    if (!allFiles || allFiles.length === 0) {
        console.warn(`[ProjectService] No files found for project ${projectId} after sync during resummarize all.`);
        return;
    }

    try {
        // forceSummarizeFiles should ideally return the modified files or handle saving internally
        // Option 1: Assume it modifies the passed array objects directly
        await forceSummarizeFiles(allFiles); // Pass the array

        // If forceSummarizeFiles modified the objects, we need to reconstruct the map and save
        const updatedFilesMap = allFiles.reduce((acc, file) => {
            acc[file.id] = file; // Re-create the map
            return acc;
        }, {} as ProjectFilesStorage);

        // Validate the *entire map* before saving to catch inconsistencies
        const validatedMap = ProjectFilesStorageSchema.parse(updatedFilesMap);

        await projectStorage.writeProjectFiles(projectId, validatedMap);
        console.log(`[ProjectService] Completed resummarizeAllFiles and saved updates for project ${projectId}`);

    } catch (error) {
        console.error(`[ProjectService] Error during file summarization or saving for project ${projectId} in resummarizeAllFiles:`, error);
        // Decide if partial success is acceptable or if the whole operation should fail
        throw new Error(`Failed during resummarization process for project ${projectId}. Reason: ${error instanceof Error ? error.message : String(error)}`);
    }
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

    try {
        const allFilesMap = await projectStorage.readProjectFiles(projectId);
        const selectedFiles: ProjectFile[] = [];
        for (const fileId of fileIds) {
            if (allFilesMap[fileId]) {
                selectedFiles.push(allFilesMap[fileId]);
            } else {
                console.warn(`[ProjectService] File ID ${fileId} not found in project ${projectId} for force resummarize.`);
            }
        }

        if (selectedFiles.length === 0) {
            return { included: 0, skipped: 0, message: "No matching files found for the provided IDs" };
        }

        // Assume forceSummarizeFiles modifies the objects in the selectedFiles array
        await forceSummarizeFiles(selectedFiles);

        // Update the main map with modified files
        let modifiedCount = 0;
        selectedFiles.forEach(file => {
            if (allFilesMap[file.id]) { // Ensure it still exists (unlikely to change here)
                // Re-validate *each* modified file before putting back in map
                try {
                    const validatedFile = ProjectFileSchema.parse(file);
                    allFilesMap[file.id] = validatedFile;
                    modifiedCount++;
                } catch (validationError) {
                    console.error(`[ProjectService] Validation failed for file ${file.id} after forceSummarizeFiles:`, validationError);
                    // Option: skip this file or throw error? Let's skip for now.
                }
            }
        });

        // Validate the whole map again before writing
        const validatedMap = ProjectFilesStorageSchema.parse(allFilesMap);

        await projectStorage.writeProjectFiles(projectId, validatedMap);

        return {
            included: modifiedCount, // Report how many were actually processed and saved
            skipped: fileIds.length - modifiedCount, // How many were provided but not found or failed validation
            message: `Selected ${modifiedCount} files processed for force re-summarization.` + (fileIds.length - modifiedCount > 0 ? ` Skipped ${fileIds.length - modifiedCount}.` : '')
        };
    } catch (error) {
        console.error(`[ProjectService] Error during forceResummarizeSelectedFiles for project ${projectId}:`, error);
        throw new Error(`Failed during force re-summarization process for project ${projectId}. Reason: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Summarizes a specific list of file IDs within a project (potentially skipping already summarized).
 * NOTE: summarizeFiles needs similar adaptation as forceSummarizeFiles regarding data modification/saving.
 */
export async function summarizeSelectedFiles(projectId: string, fileIds: string[]): Promise<{ included: number; skipped: number; message: string }> {
    if (fileIds.length === 0) {
        return { included: 0, skipped: 0, message: "No file IDs provided" };
    }
    try {
        const allFilesMap = await projectStorage.readProjectFiles(projectId);
        const selectedFileIdsForSummarize: string[] = []; // Only IDs are needed by summarizeFiles
        const fileObjectsMap: Record<string, ProjectFile> = {}; // Keep objects for update later

        for (const fileId of fileIds) {
            if (allFilesMap[fileId]) {
                selectedFileIdsForSummarize.push(fileId);
                fileObjectsMap[fileId] = allFilesMap[fileId]; // Store object locally
            } else {
                console.warn(`[ProjectService] File ID ${fileId} not found in project ${projectId} for summarize.`);
            }
        }

        if (selectedFileIdsForSummarize.length === 0) {
            return { included: 0, skipped: 0, message: "No matching files found for the provided IDs" };
        }

        // summarizeFiles likely needs adaptation. Let's assume it returns which IDs were processed.
        // It might need the full file objects if it checks content/timestamps.
        // Let's pass the objects map for now.
        const result = await summarizeFiles(projectId, selectedFileIdsForSummarize /* or potentially fileObjectsMap */);
        // --> summarizeFiles needs refactoring <--
        // Assume summarizeFiles *somehow* updates the summaries in the main store or returns updated data.
        // For now, let's simulate a read-after-write or assume it did its job.
        // A more robust approach would involve summarizeFiles returning updated objects
        // or taking a callback to save updated files.

        // Refresh the data to reflect changes made by summarizeFiles (simplistic approach)
        const potentiallyUpdatedFilesMap = await projectStorage.readProjectFiles(projectId);

        const finalIncluded = result.included; // Use result from summarizeFiles
        const finalSkipped = result.skipped; // Use result from summarizeFiles

        return {
            included: finalIncluded,
            skipped: finalSkipped,
            message: `Summarization process completed for ${selectedFileIdsForSummarize.length} requested files. Included: ${finalIncluded}, Skipped: ${finalSkipped}.`
        };
    } catch (error) {
        console.error(`[ProjectService] Error during summarizeSelectedFiles for project ${projectId}:`, error);
        throw new Error(`Failed during summarization process for project ${projectId}. Reason: ${error instanceof Error ? error.message : String(error)}`);
    }
}


/**
 * Removes summaries and their update timestamps from selected files in JSON.
 */
export async function removeSummariesFromFiles(projectId: string, fileIds: string[]) {
    if (fileIds.length === 0) {
        return { success: true, removedCount: 0, message: "No file IDs provided" };
    }
    try {
        const files = await projectStorage.readProjectFiles(projectId);
        let removedCount = 0;
        const now = new Date().toISOString();

        for (const fileId of fileIds) {
            if (files[fileId]) {
                const file = files[fileId];
                // Check if modification is needed
                if (file.summary !== null || file.summaryLastUpdatedAt !== null) {
                    const updatedFileData: ProjectFile = {
                        ...file,
                        summary: null,
                        summaryLastUpdatedAt: null,
                        updatedAt: now // Also update the main timestamp
                    };
                    // Validate the change
                    files[fileId] = ProjectFileSchema.parse(updatedFileData); // Update in map after validation
                    removedCount++;
                }
            } else {
                console.warn(`[ProjectService] File ID ${fileId} not found in project ${projectId} for remove summary.`);
            }
        }

        if (removedCount > 0) {
            // Validate the whole map before writing only if changes were made
            const validatedMap = ProjectFilesStorageSchema.parse(files);
            await projectStorage.writeProjectFiles(projectId, validatedMap);
        }

        return {
            success: true,
            removedCount: removedCount,
            message: `Removed summaries from ${removedCount} files.`,
        };
    } catch (error) {
        console.error(`[ProjectService] Error removing summaries for project ${projectId}:`, error);
        if (error instanceof ZodError) {
            throw new Error(`Validation failed removing summaries for project ${projectId}: ${error.message}`);
        }
        // Return success: false on general errors
        return {
            success: false,
            removedCount: 0,
            message: `Error removing summaries: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}

/**
 * Creates a new file record in the project's JSON file.
 */
export async function createProjectFileRecord(
    projectId: string,
    filePath: string, // This should be relative to project root or absolute
    initialContent: string = ''
): Promise<ProjectFile> {
    const project = await getProjectById(projectId);
    if (!project) {
        throw new Error(`[ProjectService] Cannot create file record: Project not found with ID ${projectId}`);
    }

    // Resolve paths similar to original logic
    const absoluteProjectPath = resolvePath(project.path); // Make sure resolvePath handles potential errors
    const absoluteFilePath = resolvePath(filePath.startsWith('/') || filePath.startsWith('~') || path.isAbsolute(filePath) ? filePath : path.join(absoluteProjectPath, filePath));
    // Store path relative to project root for consistency within the project's files.json
    const normalizedRelativePath = path.relative(absoluteProjectPath, absoluteFilePath);

    const fileId = projectStorage.generateId('file');
    const now = new Date().toISOString();
    const fileName = path.basename(normalizedRelativePath);
    const fileExtension = path.extname(normalizedRelativePath);
    const size = Buffer.byteLength(initialContent, 'utf8');

    const newFileData: ProjectFile = {
        id: fileId,
        projectId: projectId,
        name: fileName,
        path: normalizedRelativePath, // Store the relative path
        extension: fileExtension,
        size: size,
        content: initialContent, // Store initial content
        summary: null,
        summaryLastUpdatedAt: null,
        meta: '{}', // Default meta, ensure schema allows string
        checksum: null, // Calculate checksum if needed: calculateChecksum(initialContent),
        createdAt: now,
        updatedAt: now,
    };

    try {
        // Validate the new file data
        const validatedFile = ProjectFileSchema.parse(newFileData);

        const files = await projectStorage.readProjectFiles(projectId);
        if (files[fileId]) {
            throw new Error(`File ID conflict for ${fileId} in project ${projectId}`);
        }
        files[fileId] = validatedFile;

        // Validate the whole map before writing
        const validatedMap = ProjectFilesStorageSchema.parse(files);
        await projectStorage.writeProjectFiles(projectId, validatedMap);

        return validatedFile;

    } catch (error) {
        console.error(`[ProjectService] Error creating file record for ${filePath} in project ${projectId}:`, error);
        if (error instanceof ZodError) {
            throw new Error(`Validation failed creating file record for ${filePath}: ${error.message}`);
        }
        throw new Error(`Failed to create file record for ${filePath}. Reason: ${error instanceof Error ? error.message : String(error)}`);
    }
}


// --- Bulk Operations ---
// Note: These lose the transactional safety of the database. Errors in the middle
// might leave the JSON file in a partially updated state.

/** Represents the data needed to create or update a file record during sync. */
export interface FileSyncData {
    path: string; // Normalized relative path
    name: string;
    extension: string;
    content: string;
    size: number;
    checksum: string; // Assuming checksum is provided by sync logic
}

/** Creates multiple file records in the project's JSON file. */
export async function bulkCreateProjectFiles(projectId: string, filesToCreate: FileSyncData[]): Promise<ProjectFile[]> {
    if (filesToCreate.length === 0) return [];

    const createdFiles: ProjectFile[] = [];
    const now = new Date().toISOString();
    let files: ProjectFilesStorage | null = null; // Read only once

    try {
        files = await projectStorage.readProjectFiles(projectId);

        for (const fileData of filesToCreate) {
            const fileId = projectStorage.generateId('file');

            // Basic check for duplicates based on path within this batch
            const existingInMap = Object.values(files).find(f => f.path === fileData.path);
            if (existingInMap) {
                console.warn(`[ProjectService] Skipping duplicate path in bulk create: ${fileData.path} in project ${projectId}`);
                continue; // Skip this file
            }

            const newFileData: ProjectFile = {
                id: fileId,
                projectId: projectId,
                name: fileData.name,
                path: fileData.path,
                extension: fileData.extension,
                size: fileData.size,
                content: fileData.content, // Storing content from sync
                summary: null,
                summaryLastUpdatedAt: null,
                meta: '{}',
                checksum: fileData.checksum, // Store checksum from sync
                createdAt: now,
                updatedAt: now,
            };

            try {
                // Validate *each* new file individually
                const validatedFile = ProjectFileSchema.parse(newFileData);
                if (files[fileId]) {
                    console.error(`[ProjectService] File ID conflict during bulk create: ${fileId}. Skipping.`);
                    continue;
                }
                files[fileId] = validatedFile;
                createdFiles.push(validatedFile);
            } catch (validationError) {
                console.error(`[ProjectService] Validation failed for file ${fileData.path} during bulk create:`, validationError);
                // Decide: skip this file or abort the whole bulk operation?
                // Let's skip this file for now.
                continue;
            }
        }

        if (createdFiles.length > 0) {
            // Validate the final map before writing
            const validatedMap = ProjectFilesStorageSchema.parse(files);
            await projectStorage.writeProjectFiles(projectId, validatedMap);
        }

        return createdFiles;

    } catch (error) {
        console.error(`[ProjectService] Error during bulk file creation for project ${projectId}:`, error);
        // Rethrow the error, indicating partial success might have occurred
        throw new Error(`Bulk file creation failed for project ${projectId}. Some files might be created. Reason: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/** Updates multiple existing file records based on their IDs. */
export async function bulkUpdateProjectFiles(projectId: string, updates: { fileId: string; data: FileSyncData }[]): Promise<ProjectFile[]> {
    if (updates.length === 0) return [];

    const updatedFilesResult: ProjectFile[] = [];
    const now = new Date().toISOString();
    let files: ProjectFilesStorage | null = null;

    try {
        files = await projectStorage.readProjectFiles(projectId);
        let changesMade = false;

        for (const { fileId, data } of updates) {
            const existingFile = files[fileId];
            if (!existingFile) {
                console.warn(`[ProjectService] File ID ${fileId} not found during bulk update for project ${projectId}. Skipping.`);
                continue;
            }

            const updatedFileData: ProjectFile = {
                ...existingFile,
                content: data.content,
                extension: data.extension, // Keep extension? Sync might detect changes.
                size: data.size,
                checksum: data.checksum,
                updatedAt: now,
                // Important: Do NOT overwrite createdAt, name, path, projectId, id
                // Optionally reset summary? Depends on sync logic.
                // summary: null,
                // summaryLastUpdatedAt: null,
            };

            try {
                // Validate each update
                const validatedFile = ProjectFileSchema.parse(updatedFileData);
                files[fileId] = validatedFile;
                updatedFilesResult.push(validatedFile);
                changesMade = true;
            } catch (validationError) {
                console.error(`[ProjectService] Validation failed for file ${fileId} (${existingFile.path}) during bulk update:`, validationError);
                // Skip this update
                continue;
            }
        }

        if (changesMade) {
            // Validate the final map before writing
            const validatedMap = ProjectFilesStorageSchema.parse(files);
            await projectStorage.writeProjectFiles(projectId, validatedMap);
        }

        return updatedFilesResult;

    } catch (error) {
        console.error(`[ProjectService] Error during bulk file update for project ${projectId}:`, error);
        throw new Error(`Bulk file update failed for project ${projectId}. Some files might be updated. Reason: ${error instanceof Error ? error.message : String(error)}`);
    }
}


/** Deletes multiple files by their IDs for a specific project. */
export async function bulkDeleteProjectFiles(projectId: string, fileIdsToDelete: string[]): Promise<{ success: boolean, deletedCount: number }> {
    if (fileIdsToDelete.length === 0) {
        return { success: true, deletedCount: 0 };
    }

    let files: ProjectFilesStorage | null = null;
    let deletedCount = 0;
    let changesMade = false;

    try {
        files = await projectStorage.readProjectFiles(projectId);

        for (const fileId of fileIdsToDelete) {
            if (files[fileId]) {
                delete files[fileId];
                deletedCount++;
                changesMade = true;
            } else {
                console.warn(`[ProjectService] File ID ${fileId} not found during bulk delete for project ${projectId}.`);
            }
        }

        if (changesMade) {
            // No individual validation needed for deletes, just write the result
            // Optional: could still validate the remaining map structure
            const validatedMap = ProjectFilesStorageSchema.parse(files);
            await projectStorage.writeProjectFiles(projectId, validatedMap);
        }

        return { success: true, deletedCount };

    } catch (error) {
        console.error(`[ProjectService] Error during bulk file deletion for project ${projectId}:`, error);
        // Return failure but report count based on attempted deletes before error if possible
        return { success: false, deletedCount };
    }
}


/** Retrieves specific files by ID for a project */
export async function getProjectFilesByIds(projectId: string, fileIds: string[]): Promise<ProjectFile[]> {
    if (!fileIds || fileIds.length === 0) {
        return [];
    }
    const uniqueFileIds = [...new Set(fileIds)]; // Avoid duplicate lookups

    try {
        const filesMap = await projectStorage.readProjectFiles(projectId);
        const resultFiles: ProjectFile[] = [];

        for (const id of uniqueFileIds) {
            if (filesMap[id]) {
                resultFiles.push(filesMap[id]);
            }
        }
        // Data is already validated on read by projectStorage.readProjectFiles
        return resultFiles;
    } catch (error) {
        console.error(`[ProjectService] Error fetching project files by IDs for project ${projectId}:`, error);
        throw new Error(`Failed to fetch files by IDs for project ${projectId}. Reason: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// --- Keep FileSyncData interface if used by sync service ---
// export interface FileSyncData { ... }