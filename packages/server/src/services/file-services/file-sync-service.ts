import { join, extname, resolve, relative } from 'node:path';
import { readdirSync, readFileSync, statSync, Dirent, existsSync } from 'node:fs'; // Removed existsSync as it wasn't used
import { db } from "@/utils/database";
// Import Project type from the single source of truth
import { resolvePath, normalizePathForDb as normalizePathForDbUtil } from '@/utils/path-utils';
import { Project } from 'shared/src/schemas/project.schemas';
import { ALLOWED_FILE_CONFIGS, DEFAULT_FILE_EXCLUSIONS } from 'shared/src/constants/file-sync-options';
import ignore, { Ignore } from 'ignore';


// --- Utility functions (normalizePathForDb, computeChecksum, isValidChecksum) remain the same ---
export function normalizePathForDb(pathStr: string): string {
  return normalizePathForDbUtil(pathStr);
}

export function computeChecksum(content: string): string {
  return Bun.hash(content).toString(16);
}

export function isValidChecksum(checksum: string | null): boolean {
  return typeof checksum === 'string' && /^[a-f0-9]+$/.test(checksum);
}


/**
 * Loads ignore rules from .gitignore and combines with default exclusions.
 * @param projectRoot Absolute path to the project root directory.
 * @returns An Ignore instance configured with the rules.
 */
async function loadIgnoreRules(projectRoot: string): Promise<Ignore> {
  const ig = ignore();

  // 1. Add default exclusions (only uncommented ones matter now)
  ig.add(DEFAULT_FILE_EXCLUSIONS);

  // 2. Load .gitignore from the project root
  const gitignorePath = join(projectRoot, '.gitignore');

  try {
    if (existsSync(gitignorePath)) {
      const gitignoreContent = await Bun.file(gitignorePath).text();
      ig.add(gitignoreContent);
      console.log(`[FileSync] Loaded .gitignore rules from: ${gitignorePath}`);
    } else {
      console.log(`[FileSync] No .gitignore file found at: ${gitignorePath}. Using only default exclusions.`);
    }
  } catch (error: any) {
    console.error(`[FileSync] Error reading .gitignore file at ${gitignorePath}: ${error.message}. Using only default exclusions.`);
  }

  // Optionally add patterns that should *always* be ignored, regardless of .gitignore
  // ig.add('.git'); // Example: ensure .git is always ignored

  return ig;
}


/**
 * Recursively finds text files in a directory, respecting ignore rules and allowed configurations.
 * @param dir Absolute path to the directory to scan.
 * @param projectRoot Absolute path to the project root (for relative path calculations).
 * @param ig An Ignore instance pre-configured with exclusion rules.
 * @param allowedConfigs List of allowed file extensions and specific filenames.
 * @returns An array of absolute paths to the allowed files found.
 */
const CRITICAL_EXCLUDED_DIRS = new Set(['node_modules', '.git']);

export function getTextFiles(
  dir: string,
  projectRoot: string,
  ig: Ignore,
  allowedConfigs: string[] = ALLOWED_FILE_CONFIGS
): string[] {
  let filesFound: string[] = [];
  let entries: Dirent[];

  try {
    // Check if directory exists before reading
    if (!statSync(dir).isDirectory()) {
      console.warn(`[FileSync] Path is not a directory or doesn't exist: ${dir}`);
      return [];
    }
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (error: any) {
    // Avoid crashing if permissions are denied for a subdirectory
    if (error.code === 'EACCES' || error.code === 'EPERM') {
      console.warn(`[FileSync] Permission denied reading directory ${dir}. Skipping.`);
    } else {
      console.error(`[FileSync] Error reading directory ${dir}: ${error.message}`);
    }
    return []; // Skip this directory on error
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    // Calculate path relative to project root for ignore checking
    const relativePath = relative(projectRoot, fullPath);
    const normalizedRelativePath = normalizePathForDb(relativePath); // Use normalized path consistently

    // --- START HARDCODED CHECK ---
    // Optimization and Safety: Absolutely prevent descending into critical directories
    if (entry.isDirectory() && CRITICAL_EXCLUDED_DIRS.has(entry.name)) {
      // console.log(`[FileSync] Critically ignoring directory descent: ${relativePath}`);
      continue; // Skip this directory entirely
    }
    // --- END HARDCODED CHECK ---

    // Use the ignore instance to check if the path should be excluded
    // Pass the *normalized relative path* for accurate .gitignore rule matching
    if (ig.ignores(normalizedRelativePath)) {
      // console.log(`[FileSync] Ignoring (via ig.ignores): ${relativePath}`);
      continue;
    }

    if (entry.isDirectory()) {
      // Recursively search in subdirectories (already checked it's not critically excluded)
      filesFound.push(...getTextFiles(fullPath, projectRoot, ig, allowedConfigs));
    } else if (entry.isFile()) {
      const entryName = entry.name;
      const extension = extname(entryName).toLowerCase(); // Use lowercase for comparison
      // Check if the extension or the full filename is in the allowed list
      if (allowedConfigs.includes(extension) || allowedConfigs.includes(entryName)) {
        try {
          // Optional: Add size check if needed (uncomment if desired)
          // const stats = statSync(fullPath);
          // const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB Example
          // if (stats.size > MAX_FILE_SIZE) {
          //     console.warn(`[FileSync] Skipping large file: ${fullPath} (size: ${stats.size})`);
          //     continue;
          // }
          filesFound.push(fullPath);
        } catch (statError: any) {
          // Handle cases where file might disappear between readdir and stat
          if (statError.code === 'ENOENT') {
            console.warn(`[FileSync] File disappeared before stating: ${fullPath}`);
          } else {
            console.error(`[FileSync] Error stating file ${fullPath}: ${statError.message}`);
          }
        }
      } else {
        // console.log(`[FileSync] Skipping (disallowed type): ${relativePath}`);
      }
    }
    // Silently ignore other entry types (symlinks, etc.)
  }
  return filesFound;
}

/**
 * Synchronizes a specific set of absolute file paths with the database for a given project.
 * Handles inserts, updates (based on checksum), and deletions.
 * Assumes the provided file paths have already been filtered by ignore rules.
 */
export async function syncFileSet(
  project: Project,
  absoluteProjectPath: string,
  absoluteFilePaths: string[],
  ig: Ignore // Pass the ignore instance for deletion check
): Promise<void> { // <-- Added ig parameter
  console.log(`[FileSync] Starting sync for project ${project.id} (${project.name}) with ${absoluteFilePaths.length} discovered files.`);
  const dbTransaction = db.transaction(async (filesToProcess: string[]) => {
    // Prepare statements once for efficiency within the transaction
    const selectStmt = db.prepare<any, [string, string]>(`
          SELECT id, checksum FROM files
          WHERE project_id = ? AND path = ?
          LIMIT 1
      `);
    const updateStmt = db.prepare<any, [string, string, number, string, string]>(`
          UPDATE files
          SET content = ?, extension = ?, size = ?, checksum = ?, updated_at = strftime('%s', 'now') * 1000
          WHERE id = ?
      `); // RETURNING * removed - not needed here
    const insertStmt = db.prepare<any, [string, string, string, string, number, string, string]>(`
          INSERT INTO files (project_id, name, path, extension, size, content, checksum, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000)
      `); // RETURNING * removed - not needed here


    let updatedCount = 0;
    let insertedCount = 0;
    let skippedCount = 0;

    // 1) Insert or update for each file found on disk (already filtered)
    for (const filePath of filesToProcess) { // filesToProcess are the ones NOT ignored by getTextFiles
      try {
        const content = readFileSync(filePath, 'utf-8');
        const relativePath = normalizePathForDb(relative(absoluteProjectPath, filePath));
        const fileName = relativePath.split('/').pop() ?? '';
        const extension = extname(fileName).toLowerCase() || (fileName.startsWith('.') ? fileName : '');
        const size = statSync(filePath).size;
        const checksum = computeChecksum(content);

        const existingFile = selectStmt.get(project.id, relativePath) as { id: string; checksum: string | null; } | undefined;

        if (existingFile) {
          if (!isValidChecksum(existingFile.checksum) || existingFile.checksum !== checksum) {
            updateStmt.run(content, extension, size, checksum, existingFile.id);
            updatedCount++;
          } else {
            skippedCount++;
          }
        } else {
          insertStmt.run(project.id, fileName, relativePath, extension, size, content, checksum);
          insertedCount++;
        }
      } catch (fileError: any) {
        console.error(`[FileSync] Error processing file ${filePath}: ${fileError.message}. Skipping file.`);
      }
    }
    console.log(`[FileSync] Processed disk files - Inserted: ${insertedCount}, Updated: ${updatedCount}, Skipped (Unchanged): ${skippedCount}`);

    // 2) Handle deletions: Find files in DB that are NOT in the current valid set OR are ignored now
    // Fetch all files from DB for this project
    const dbFiles = db.prepare<{ path: string; id: string }, [string]>(`
          SELECT id, path FROM files WHERE project_id = ?
      `).all(project.id);

    // Create a set of *normalized relative paths* of files currently valid on disk
    const currentValidFilePathsSet = new Set(
      filesToProcess.map(fp => normalizePathForDb(relative(absoluteProjectPath, fp)))
    );

    const filesToDelete = dbFiles.filter(dbFile => {
      const normalizedDbPath = normalizePathForDb(dbFile.path);
      // Delete if EITHER:
      // 1. The file is no longer present in the valid set found on disk.
      // 2. The file path IS ignored according to the current rules (e.g., added to .gitignore later).
      const shouldDelete = !currentValidFilePathsSet.has(normalizedDbPath) || ig.ignores(normalizedDbPath);
      // if (shouldDelete && !currentValidFilePathsSet.has(normalizedDbPath) && ig.ignores(normalizedDbPath)) {
      //   console.log(`[FileSync] Deleting ${normalizedDbPath} because it is now ignored.`);
      // } else if (shouldDelete && !currentValidFilePathsSet.has(normalizedDbPath)) {
      //   console.log(`[FileSync] Deleting ${normalizedDbPath} because it is no longer on disk.`);
      // }
      return shouldDelete;
    });


    if (filesToDelete.length > 0) {
      console.log(`[FileSync] Deleting ${filesToDelete.length} files from DB that no longer exist on disk or are now ignored.`);
      const placeholders = filesToDelete.map(() => '?').join(', ');
      const deleteStmt = db.prepare(`DELETE FROM files WHERE id IN (${placeholders})`);
      deleteStmt.run(...filesToDelete.map(f => f.id));
    } else {
      console.log(`[FileSync] No files needed deletion from DB.`);
    }
  });

  try {
    await dbTransaction(absoluteFilePaths);
    console.log(`[FileSync] Successfully completed sync for project ${project.id}.`);
  } catch (error) {
    console.error(`[FileSync] Error during sync transaction for project ${project.id}:`, error);
    throw new Error(`Sync failed for project ${project.id}`);
  }
}

/**
 * Synchronizes all allowed text files in a project's directory with the database.
 */
export async function syncProject(project: Project /* Removed exclusions param */): Promise<void> {
  try {
    const absoluteProjectPath = resolvePath(project.path);
    if (!statSync(absoluteProjectPath).isDirectory()) {
      console.error(`[FileSync] Project path is not a valid directory: ${absoluteProjectPath}`);
      throw new Error(`Project path is not a valid directory: ${project.path}`);
    }

    // Load ignore rules ONCE for the project
    const ig = await loadIgnoreRules(absoluteProjectPath);

    console.log(`[FileSync] Starting full sync for project '${project.name}' (${project.id}) at path: ${absoluteProjectPath}`);
    // Pass the ignore instance and project root to getTextFiles
    const projectFiles = getTextFiles(absoluteProjectPath, absoluteProjectPath, ig, ALLOWED_FILE_CONFIGS);
    console.log(`[FileSync] Found ${projectFiles.length} files to potentially sync after applying ignore rules.`);

    // Pass ignore instance to syncFileSet for deletion checks
    await syncFileSet(project, absoluteProjectPath, projectFiles, ig);

  } catch (error: any) {
    console.error(`[FileSync] Failed to sync project ${project.id} (${project.name}): ${error.message}`);
    throw error;
  }
}

/**
 * Synchronizes allowed text files within a specific subfolder of a project.
 * Also removes database entries for files that were previously in this folder but are now gone or ignored.
 */
export async function syncProjectFolder(project: Project, folderPath: string /* Removed exclusions param */): Promise<void> {
  try {
    const absoluteProjectPath = resolvePath(project.path);
    const absoluteFolderToSync = resolve(absoluteProjectPath, folderPath);

    if (!statSync(absoluteFolderToSync).isDirectory()) {
      console.error(`[FileSync] Folder path is not a valid directory: ${absoluteFolderToSync}`);
      throw new Error(`Folder path is not a valid directory: ${folderPath}`);
    }

    // Load ignore rules ONCE for the project root
    const ig = await loadIgnoreRules(absoluteProjectPath);

    console.log(`[FileSync] Starting sync for folder '${folderPath}' in project '${project.name}' (${project.id}) at path: ${absoluteFolderToSync}`);
    // Find files within the specific folder, using the project root's ignore rules
    const folderFiles = getTextFiles(absoluteFolderToSync, absoluteProjectPath, ig, ALLOWED_FILE_CONFIGS);
    console.log(`[FileSync] Found ${folderFiles.length} files in folder ${folderPath} to potentially sync after applying ignore rules.`);

    // Sync the files found within the folder (handles updates/inserts using the main sync logic)
    // We still pass absoluteFilePaths (which contains only files within the target folder)
    // and the project-wide 'ig' instance for consistency in deletion checks.
    await syncFileSet(project, absoluteProjectPath, folderFiles, ig);

    // --- Deletion logic specific to the folder ---
    // The deletion logic within syncFileSet now correctly handles files removed from *or* ignored within this folder,
    // because it compares the full DB list against the `folderFiles` (the valid ones remaining in this folder)
    // and checks against the `ig` instance. No separate deletion logic is strictly needed here anymore.
    console.log(`[FileSync] Successfully completed sync for folder '${folderPath}' in project ${project.id}.`);

  } catch (error: any) {
    console.error(`[FileSync] Failed to sync folder '${folderPath}' for project ${project.id} (${project.name}): ${error.message}`);
    throw error;
  }
}
