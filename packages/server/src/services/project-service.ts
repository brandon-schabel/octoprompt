import { resolvePath } from '@/utils/path-utils';
import { projectStorage, type ProjectFilesStorage, ProjectFilesStorageSchema } from '@/utils/project-storage';
import { syncProject } from "./file-services/file-sync-service";
import { CreateProjectBody, Project, ProjectFile, ProjectFileSchema, ProjectSchema, UpdateProjectBody } from "shared/src/schemas/project.schemas";
import path from 'path';
import { z, ZodError } from "zod"
import { LOW_MODEL_CONFIG } from 'shared';
import { APIProviders } from 'shared/src/schemas/provider-key.schemas';
import { generateStructuredData } from './gen-ai-services';

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

export async function resummarizeAllFiles(projectId: string): Promise<void> {
    const project = await getProjectById(projectId);
    if (!project) {
        throw new Error(`[ProjectService] Project not found with ID ${projectId} for resummarize all.`);
    }

    // Sync files to ensure projects files are up to date before creating the summaries
    await syncProject(project);

    const allFiles = await getProjectFiles(projectId);
    if (!allFiles || allFiles.length === 0) {
        console.warn(`[ProjectService] No files found for project ${projectId} after sync during resummarize all.`);
        return;
    }

    try {
        // forceSummarizeFiles should ideally return the modified files or handle saving internally
        // Option 1: Assume it modifies the passed array objects directly
        await summarizeFiles(projectId, allFiles.map(f => f.id)); // Pass the array

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
        path: normalizedRelativePath, // stores relative path to project root, because we store project file root
        // so we can get the full path with project root path + file path
        extension: fileExtension,
        size: size,
        content: initialContent,
        summary: null,
        summaryLastUpdatedAt: null,
        meta: '{}',
        checksum: null,
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





/**
 * Exposed for unit testing. Summarizes a single file if it meets conditions
 * and updates the project's file storage.
 */
export async function summarizeSingleFile(file: ProjectFile): Promise<ProjectFile> {
    const fileContent = file.content || "";

    // --- Initial checks remain the same ---
    if (!fileContent.trim()) {
        console.warn(`[SummarizeSingleFile] File ${file.path} is empty, skipping summarization.`);
        // No DB update needed here, just return
        throw new Error(`File ${file.path} is empty, skipping summarization.`);
    }

    // --- AI Generation Logic (remains mostly the same) ---
    const systemPrompt = `
  ## You are a coding assistant specializing in concise code summaries.
  1. Provide a short overview of what the file does.
  2. Outline main exports (functions/classes).
  3. Respond with only the textual summary, minimal fluff, no suggestions or code blocks.
  `;

    const cfg = LOW_MODEL_CONFIG;
    const provider = cfg.provider as APIProviders || 'openai';
    const modelId = cfg.model;

    if (!modelId) {
        console.error(`[SummarizeSingleFile] Model not configured for summarize-file task for file ${file.path}.`);
        throw new Error(`Model not configured for summarize-file task for file ${file.path}.`);
    }

    try {
        const result = await generateStructuredData({
            prompt: fileContent,
            options: cfg,
            schema: z.object({
                summary: z.string()
            }),
            systemMessage: systemPrompt
        });

        const summary = result.object.summary;
        const trimmedSummary = summary.trim();

        // --- Update Project File Storage ---
        const updatedFile = await projectStorage.updateProjectFile(file.projectId, file.id, {
            summary: trimmedSummary,
        });


        console.log(`[SummarizeSingleFile] Successfully summarized and updated file: ${file.path} in project ${file.projectId}`);
        return updatedFile;
    } catch (error) {
        console.error(`[SummarizeSingleFile] Error summarizing file ${file.path} (project ${file.projectId}) using ${provider}/${modelId}:`, error);
        // Optionally mark as failed in storage?
        // await updateFileSummaryStatus(file.projectId, file.id, null, 'failed_error');
        // handle error quietly or rethrow/log based on desired behavior
        throw new Error(`Failed to summarize file ${file.path} in project ${file.projectId}. Reason: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Summarize multiple files, respecting summarization rules.
 * Processes files sequentially to avoid storage write conflicts.
 */
export async function summarizeFiles(
    projectId: string,
    fileIdsToSummarize: string[],
): Promise<{ included: number; skipped: number, updatedFiles: ProjectFile[] }> {
    // Use the project-service function to get files
    const allProjectFiles = await getProjectFiles(projectId);

    if (!allProjectFiles) {
        console.warn(`[BatchSummarize] No files found for project ${projectId}.`);
        return { included: 0, skipped: 0, updatedFiles: [] };
    }

    // Filter the fetched files based on the provided IDs
    const filesToProcess = allProjectFiles.filter((f) => fileIdsToSummarize.includes(f.id));
    const totalFiles = filesToProcess.length;


    const updatedFiles: ProjectFile[] = [];

    // --- Process Sequentially ---
    for (const file of filesToProcess) {
        const updatedFile = await summarizeSingleFile(file); // This handles internal checks and storage update
        updatedFiles.push(updatedFile);

    }

    console.log(`[BatchSummarize] File summarization batch complete for project ${projectId}. Included: ${totalFiles}, Skipped: ${totalFiles - updatedFiles.length}`);
    return { included: totalFiles, skipped: totalFiles - updatedFiles.length, updatedFiles };
}


