import { join, extname, resolve, relative, basename } from 'node:path';
import { readdirSync, readFileSync, statSync, Dirent, existsSync } from 'node:fs';
import { resolvePath, normalizePathForDb as normalizePathForDbUtil } from '@/utils/path-utils';
import { Project, ProjectFile } from 'shared/src/schemas/project.schemas';
import { ALLOWED_FILE_CONFIGS, DEFAULT_FILE_EXCLUSIONS } from 'shared/src/constants/file-sync-options';
import ignorePackage, { Ignore } from 'ignore';
import {
  getProjectFiles,
  bulkCreateProjectFiles,
  bulkUpdateProjectFiles,
  bulkDeleteProjectFiles,
  FileSyncData
} from '@/services/project-service';

// --- Utility functions (normalizePathForDb, computeChecksum, isValidChecksum) remain the same ---
export function normalizePathForDb(pathStr: string): string {
  return normalizePathForDbUtil(pathStr);
}

export function computeChecksum(content: string): string {
  // Use Bun's built-in hashing
  const hash = new Bun.CryptoHasher("sha256"); // Use a standard algorithm like SHA-256
  hash.update(content);
  return hash.digest("hex");
  // return Bun.hash(content).toString(16); // Keep original if preferred, but SHA256 is more standard
}

export function isValidChecksum(checksum: string | null): boolean {
  // Adjust regex if using SHA256 (64 hex chars)
  return typeof checksum === 'string' && /^[a-f0-9]{64}$/.test(checksum);
  // return typeof checksum === 'string' && /^[a-f0-9]+$/.test(checksum); // Original regex
}

// --- loadIgnoreRules remains the same ---
export async function loadIgnoreRules(projectRoot: string): Promise<Ignore> {
  const ignoreInstance = ignorePackage();
  ignoreInstance.add(DEFAULT_FILE_EXCLUSIONS);
  console.log(
    "DEFAULT_FILE_EXCLUSIONS added to ignore rules."
  )

  const gitignorePath = join(projectRoot, '.gitignore');

  try {
    if (existsSync(gitignorePath)) {
      // Use Bun's file reading
      const gitignoreContent = await Bun.file(gitignorePath).text();
      ignoreInstance.add(gitignoreContent);
      console.log(`[FileSync] Loaded .gitignore rules from: ${gitignorePath}`);
    } else {
      console.log(`[FileSync] No .gitignore file found at: ${gitignorePath}. Using only default exclusions.`);
    }
  } catch (error: any) {
    console.error(`[FileSync] Error reading .gitignore file at ${gitignorePath}: ${error.message}. Using only default exclusions.`);
  }
  return ignoreInstance;
}


// --- getTextFiles remains the same ---
const CRITICAL_EXCLUDED_DIRS = new Set(['node_modules', '.git', 'dist', 'build']); // Added common ones

export function getTextFiles(
  dir: string,
  projectRoot: string,
  ignore: Ignore,
  allowedConfigs: string[] = ALLOWED_FILE_CONFIGS
): string[] {
  let filesFound: string[] = [];
  let entries: Dirent[];

  try {
    if (!existsSync(dir) || !statSync(dir).isDirectory()) { // Check existence first
      console.warn(`[FileSync] Path is not a directory or doesn't exist: ${dir}`);
      return [];
    }
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (error: any) {
    if (error.code === 'EACCES' || error.code === 'EPERM') {
      console.warn(`[FileSync] Permission denied reading directory ${dir}. Skipping.`);
    } else if (error.code === 'ENOENT') {
      console.warn(`[FileSync] Directory disappeared before reading: ${dir}. Skipping.`);
    } else {
      console.error(`[FileSync] Error reading directory ${dir}: ${error.message}`);
    }
    return [];
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relativePath = relative(projectRoot, fullPath);
    const normalizedRelativePath = normalizePathForDb(relativePath);

    // Optimization: Check critical excludes *before* ignore instance for performance
    if (entry.isDirectory() && CRITICAL_EXCLUDED_DIRS.has(entry.name)) {
      // console.log(`[FileSync] Critically ignoring directory descent: ${relativePath}`);
      continue;
    }

    // Check ignore rules using normalized relative path
    if (ignore.ignores(normalizedRelativePath)) {
      // console.log(`[FileSync] Ignoring (via ig.ignores): ${normalizedRelativePath}`);
      continue;
    }

    if (entry.isDirectory()) {
      filesFound.push(...getTextFiles(fullPath, projectRoot, ignore, allowedConfigs));
    } else if (entry.isFile()) {
      const entryName = entry.name;
      const extension = extname(entryName).toLowerCase();
      if (allowedConfigs.includes(extension) || allowedConfigs.includes(entryName)) {
        try {
          // Optional size check can remain here if needed
          filesFound.push(fullPath);
        } catch (statError: any) {
          if (statError.code === 'ENOENT') {
            console.warn(`[FileSync] File disappeared before stating: ${fullPath}`);
          } else {
            console.error(`[FileSync] Error stating file ${fullPath}: ${statError.message}`);
          }
        }
      } else {
        // console.log(`[FileSync] Skipping (disallowed type): ${normalizedRelativePath}`);
      }
    }
  }
  return filesFound;
}

/**
 * Determines the necessary database operations (create, update, delete)
 * by comparing disk files with database records and delegates these operations
 * to the project-service.
 */
export async function syncFileSet(
  project: Project,
  absoluteProjectPath: string,
  absoluteFilePaths: string[], // Files found on disk *after* initial ignore filtering
  ignore: Ignore // Ignore instance for checking deletions
): Promise<{ created: number; updated: number; deleted: number; skipped: number }> {
  console.log(`[FileSync] Starting sync for project ${project.id} ${project.name} with ${absoluteFilePaths.length} discovered files.`);

  let filesToCreate: FileSyncData[] = [];
  let filesToUpdate: { fileId: string; data: FileSyncData }[] = [];
  let fileIdsToDelete: string[] = [];
  let skippedCount = 0;

  // 1. Get existing files from the database via ProjectService
  const existingDbFiles = await getProjectFiles(project.id);
  if (existingDbFiles === null) {
    // This case should ideally be handled (e.g., project deleted mid-sync?), but for now, we'll error out.
    console.error(`[FileSync] Failed to retrieve existing files for project ${project.id}. Aborting sync.`);
    throw new Error(`Could not retrieve existing files for project ${project.id}`);
  }

  // Create a map for quick lookup of DB files by their normalized relative path
  const dbFileMap = new Map<string, ProjectFile>(
    existingDbFiles.map(f => [normalizePathForDb(f.path), f])
  );

  // 2. Process files found on disk
  const currentDiskFilesSet = new Set<string>(); // Store normalized relative paths found on disk

  for (const absFilePath of absoluteFilePaths) {
    const relativePath = relative(absoluteProjectPath, absFilePath);
    const normalizedRelativePath = normalizePathForDb(relativePath);
    currentDiskFilesSet.add(normalizedRelativePath); // Track this file as present

    try {
      const content = readFileSync(absFilePath, 'utf-8');
      const stats = statSync(absFilePath);
      const checksum = computeChecksum(content);
      const fileName = basename(normalizedRelativePath);
      // Ensure extension is correctly extracted, handle dotfiles
      let extension = extname(fileName).toLowerCase();
      if (!extension && fileName.startsWith('.')) {
        extension = fileName; // Treat e.g., '.env' as the extension
      }


      const fileData: FileSyncData = {
        path: normalizedRelativePath,
        name: fileName,
        extension: extension,
        content: content,
        size: stats.size,
        checksum: checksum,
      };

      const existingDbFile = dbFileMap.get(normalizedRelativePath);

      if (existingDbFile) {
        // File exists in DB, check if update needed
        if (!isValidChecksum(existingDbFile.checksum) || existingDbFile.checksum !== checksum) {
          // Checksum mismatch or invalid, queue for update
          filesToUpdate.push({ fileId: existingDbFile.id, data: fileData });
        } else {
          // Checksum matches, skip
          skippedCount++;
        }
        // Remove from map to track processed DB files
        dbFileMap.delete(normalizedRelativePath);
      } else {
        // File not in DB, queue for creation
        filesToCreate.push(fileData);
      }

    } catch (fileError: any) {
      console.error(`[FileSync] Error processing file ${absFilePath} (relative: ${normalizedRelativePath}): ${fileError.message}. Skipping file.`);
      // Remove from map if it existed, as we couldn't process it
      dbFileMap.delete(normalizedRelativePath);
    }
  }

  // 3. Determine files to delete
  // Files remaining in dbFileMap are those in the DB but NOT found on disk OR those explicitly ignored now.
  for (const [normalizedDbPath, dbFile] of dbFileMap.entries()) {
    // Check if the file is now ignored OR if it wasn't found on disk (already handled by it remaining in the map)
    // The check `!currentDiskFilesSet.has(normalizedDbPath)` is implicitly true here because we removed found files.
    // We just need to double-check the ignore rules in case a file exists but was added to .gitignore.
    if (ignore.ignores(normalizedDbPath)) {
      console.log(`[FileSync] Queuing for deletion (now ignored): ${normalizedDbPath}`);
      fileIdsToDelete.push(dbFile.id);
    } else {
      console.log(`[FileSync] Queuing for deletion (not found on disk): ${normalizedDbPath}`);
      fileIdsToDelete.push(dbFile.id); // File in DB, not in currentDiskFilesSet -> delete
    }
  }


  // 4. Execute batch operations via ProjectService
  let createdCount = 0;
  let updatedCount = 0;
  let deletedCount = 0;

  try {
    if (filesToCreate.length > 0) {
      console.log(`[FileSync] Creating ${filesToCreate.length} new file records...`);
      const createdResult = await bulkCreateProjectFiles(project.id, filesToCreate);
      createdCount = createdResult.length; // Count successfully created files
    }
    if (filesToUpdate.length > 0) {
      console.log(`[FileSync] Updating ${filesToUpdate.length} existing file records...`);
      const updatedResult = await bulkUpdateProjectFiles(project.id, filesToUpdate);
      updatedCount = updatedResult.length; // Count successfully updated files
    }
    if (fileIdsToDelete.length > 0) {
      console.log(`[FileSync] Deleting ${fileIdsToDelete.length} file records...`);
      const deleteResult = await bulkDeleteProjectFiles(project.id, fileIdsToDelete);
      if (deleteResult.success) {
        deletedCount = deleteResult.deletedCount;
      } else {
        console.error(`[FileSync] Bulk deletion failed for project ${project.id}.`);
        // Potentially throw or handle differently
      }
    }

    console.log(`[FileSync] Sync results - Created: ${createdCount}, Updated: ${updatedCount}, Deleted: ${deletedCount}, Skipped (Unchanged): ${skippedCount}`);
    return { created: createdCount, updated: updatedCount, deleted: deletedCount, skipped: skippedCount };

  } catch (error) {
    console.error(`[FileSync] Error during database batch operations for project ${project.id}:`, error);
    // Rethrow or handle error appropriately
    throw new Error(`Sync failed during storage operations for project ${project.id}`);
  }
}

/**
 * Orchestrates the synchronization process for an entire project.
 */
export async function syncProject(project: Project): Promise<{ created: number; updated: number; deleted: number; skipped: number }> {
  try {
    const absoluteProjectPath = resolvePath(project.path);
    if (!existsSync(absoluteProjectPath) || !statSync(absoluteProjectPath).isDirectory()) {
      console.error(`[FileSync] Project path is not a valid directory: ${absoluteProjectPath}`);
      throw new Error(`Project path is not a valid directory: ${project.path}`);
    }

    // Load ignore rules
    const ignore = await loadIgnoreRules(absoluteProjectPath);

    console.log(`[FileSync] Starting full sync for project ${project.name} (${project.id}) at path: ${absoluteProjectPath}`);

    // Find all relevant files respecting ignore rules
    const projectFiles = getTextFiles(absoluteProjectPath, absoluteProjectPath, ignore, ALLOWED_FILE_CONFIGS);
    console.log(`[FileSync] Found ${projectFiles.length} files on disk to potentially sync after applying ignore rules.`);

    // Delegate the comparison and DB operations to syncFileSet
    const results = await syncFileSet(project, absoluteProjectPath, projectFiles, ignore);

    console.log(`[FileSync] Successfully completed sync for project ${project.id}.`);
    return results;

  } catch (error: any) {
    console.error(`[FileSync] Failed to sync project ${project.id} ${project.name}: ${error.message}`);
    throw error; // Re-throw the error for higher-level handling
  }
}

/**
 * Orchestrates the synchronization process for a specific subfolder within a project.
 */
export async function syncProjectFolder(project: Project, folderPath: string): Promise<{ created: number; updated: number; deleted: number; skipped: number }> {
  try {
    const absoluteProjectPath = resolvePath(project.path);
    const absoluteFolderToSync = resolve(absoluteProjectPath, folderPath);

    if (!existsSync(absoluteFolderToSync) || !statSync(absoluteFolderToSync).isDirectory()) {
      console.error(`[FileSync] Folder path is not a valid directory: ${absoluteFolderToSync}`);
      throw new Error(`Folder path is not a valid directory: ${folderPath}`);
    }

    // Load ignore rules for the *entire project*
    const ignore = await loadIgnoreRules(absoluteProjectPath);

    console.log(`[FileSync] Starting sync for project folder ${absoluteProjectPath}, project ${project.name} (${project.id}) at path: ${absoluteFolderToSync}`);

    // Find files *within the specific folder*, using the project root's ignore rules
    const folderFiles = getTextFiles(absoluteFolderToSync, absoluteProjectPath, ignore, ALLOWED_FILE_CONFIGS);
    console.log(`[FileSync] Found ${folderFiles.length} files in folder ${folderPath} to potentially sync after applying ignore rules.`);

    // Delegate the comparison and DB operations to syncFileSet
    // NOTE: syncFileSet now handles deletions correctly by comparing the list of files *passed to it*
    // (folderFiles in this case) against the *entire* DB list for the project, and applying ignore rules.
    // It will correctly identify files within this folder that were deleted or became ignored.
    const results = await syncFileSet(project, absoluteProjectPath, folderFiles, ignore);

    console.log(`[FileSync] Successfully completed sync for folder '${folderPath}' in project ${project.id}.`);
    return results;

  } catch (error: any) {
    console.error(`[FileSync] Failed to sync folder '${folderPath}' for project ${project.id} ${project.name}: ${error.message}`);
    throw error; // Re-throw the error
  }
}