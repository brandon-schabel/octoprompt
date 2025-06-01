import { watch as fsWatch, FSWatcher, existsSync as fsLibExistsSync } from 'fs'
import { join, extname, resolve as pathResolve, relative, basename } from 'node:path'
import { readdirSync, readFileSync, statSync, Dirent, existsSync as nodeFsExistsSync } from 'node:fs'
import { resolvePath, normalizePathForDb as normalizePathForDbUtil } from '@/utils/path-utils'
import { Project, ProjectFile } from '@octoprompt/schemas'
import { ALLOWED_FILE_CONFIGS, DEFAULT_FILE_EXCLUSIONS } from '@octoprompt/schemas'
import ignorePackage, { Ignore } from 'ignore'
import {
  getProjectFiles,
  bulkCreateProjectFiles,
  bulkUpdateProjectFiles,
  bulkDeleteProjectFiles,
  FileSyncData, // Interface from project-service
  listProjects,
  summarizeSingleFile
} from '@/services/project-service' // Adjusted path assuming this file is in services/file-services/

// -------------------------------------------------------------------------------- //
// -------------------------------- TYPE DEFINITIONS ------------------------------ //
// -------------------------------------------------------------------------------- //

// From file-change-watcher.ts
export type FileChangeEvent = 'created' | 'modified' | 'deleted'

export interface FileChangeListener {
  onFileChanged(event: FileChangeEvent, filePath: string): Promise<void> | void
}

export interface WatchOptions {
  directory: string
  ignorePatterns?: string[]
  recursive?: boolean
}

// From cleanup-service.ts
export type CleanupResult =
  | ({ status: 'success'; removedCount: number } & { projectId: number })
  | ({ status: 'error'; error: unknown } & { projectId: number })

export interface CleanupOptions {
  intervalMs: number
}

// MinimalProject was defined in cleanup-service.ts but not directly used by its exported functions' signatures.
// If it's needed elsewhere, it can be kept. For now, it's not strictly necessary for the combined service exports.
// export type MinimalProject = {
//     id: number;
//     path: string;
// };

// -------------------------------------------------------------------------------- //
// ---------------------------- FILE WATCHER LOGIC (Core) ------------------------- //
// -------------------------------------------------------------------------------- //

/**
 * Checks if a file path matches any of the ignore patterns.
 * Originally from file-change-watcher.ts
 * @param filePath The path of the file to check.
 * @param ignorePatterns An array of glob patterns to ignore.
 * @returns True if the file path should be ignored, false otherwise.
 */
export function isIgnored(filePath: string, ignorePatterns: string[]): boolean {
  for (const pattern of ignorePatterns) {
    // Simple glob to regex: escape dots, replace * with .*
    // For more complex globs, a dedicated library might be better.
    const regexSafe = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape regex special chars
      .replace(/\*/g, '.*') // Replace * with .*
    if (new RegExp(regexSafe).test(filePath)) {
      return true
    }
  }
  return false
}

/**
 * Infers the type of file change event.
 * Originally from file-change-watcher.ts
 * @param eventType The raw event type from the watcher.
 * @param fullPath The full path to the file.
 * @returns The inferred FileChangeEvent or null.
 */
export function inferChangeType(eventType: string, fullPath: string): FileChangeEvent | null {
  if (eventType === 'rename') {
    // fs.watch 'rename' can mean created or deleted.
    // We use fsLibExistsSync here as it's paired with the `fs.watch` module.
    if (fsLibExistsSync(fullPath)) {
      return 'created'
    } else {
      return 'deleted'
    }
  } else if (eventType === 'change') {
    return 'modified'
  }
  return null // Unknown event type
}

/**
 * Creates a functional file-change watcher.
 * Manages a single watcher instance and notifies registered listeners.
 * Originally from file-change-watcher.ts
 */
export function createFileChangeWatcher() {
  let watcherInstance: FSWatcher | null = null
  const listeners: FileChangeListener[] = []
  let watchingDirectory: string | null = null // Store the directory being watched

  function registerListener(listener: FileChangeListener): void {
    if (!listeners.includes(listener)) {
      listeners.push(listener)
    }
  }

  function unregisterListener(listener: FileChangeListener): void {
    const index = listeners.indexOf(listener)
    if (index !== -1) {
      listeners.splice(index, 1)
    }
  }

  function startWatching(options: WatchOptions): void {
    const { directory, ignorePatterns = [], recursive = true } = options
    const resolvedDir = resolvePath(directory)

    if (watcherInstance && watchingDirectory === resolvedDir) {
      console.warn(`[FileChangeWatcher] Already watching: ${resolvedDir}`)
      return
    }
    if (watcherInstance) {
      // Stop previous watcher if directory changes
      stopWatching()
    }

    if (!nodeFsExistsSync(resolvedDir)) {
      // Use nodeFsExistsSync for general FS checks
      console.warn(`[FileChangeWatcher] Directory does not exist, cannot watch: ${resolvedDir}`)
      return
    }

    try {
      watcherInstance = fsWatch(resolvedDir, { recursive }, (eventType, filename) => {
        if (!filename) return // filename can be null

        // filename might be relative to a subdirectory if recursive
        // Construct full path carefully.
        // For recursive watch, `filename` is relative to `resolvedDir` if it's a direct child,
        // or it might include sub-paths. `fs.watch` behavior can be OS-dependent.
        // A more robust solution might involve `chokidar` for complex scenarios.
        const fullPath = join(resolvedDir, filename)

        if (isIgnored(filename, ignorePatterns) || isIgnored(fullPath, ignorePatterns)) {
          return
        }

        const changeType = inferChangeType(eventType, fullPath)
        if (!changeType) {
          // console.debug(`[FileChangeWatcher] Unknown event type '${eventType}' for ${filename}`);
          return
        }

        // Notify all listeners
        for (const listener of listeners) {
          const result = listener.onFileChanged(changeType, fullPath)
          if (result && typeof result.then === 'function') {
            result.catch((err: unknown) => {
              console.error('[FileChangeWatcher] Error in listener onFileChanged:', err)
            })
          }
        }
      })
      watchingDirectory = resolvedDir // Store the currently watched directory
      watcherInstance.on('error', (err) => {
        console.error(`[FileChangeWatcher] Watcher error for ${resolvedDir}:`, err)
        stopWatching() // Attempt to stop on error
      })
      console.log(`[FileChangeWatcher] Started watching directory: ${resolvedDir}`)
    } catch (err) {
      console.error(`[FileChangeWatcher] Error starting watch on ${resolvedDir}:`, err)
      watcherInstance = null
      watchingDirectory = null
    }
  }

  function stopWatching(): void {
    if (watcherInstance) {
      watcherInstance.close()
      watcherInstance = null
      console.log(`[FileChangeWatcher] Stopped watching directory: ${watchingDirectory}`)
      watchingDirectory = null
    }
  }

  /** Stops watching and clears all listeners. */
  function stopAllAndClearListeners(): void {
    stopWatching()
    listeners.length = 0 // Clear listeners array
    console.log(`[FileChangeWatcher] All listeners cleared.`)
  }

  return {
    registerListener,
    unregisterListener,
    startWatching,
    stopWatching, // Renamed from stopAll in original file-change-watcher to be more specific
    stopAllAndClearListeners, // New method to fully reset
    getListeners: () => [...listeners] // For inspection/testing if needed
  }
}

// -------------------------------------------------------------------------------- //
// ----------------------------- FILE SYNC LOGIC (Core) --------------------------- //
// -------------------------------------------------------------------------------- //

/**
 * Normalizes a path string for database storage (e.g., converts backslashes to slashes).
 * Originally from file-sync-service.ts
 * @param pathStr The path string to normalize.
 * @returns Normalized path string.
 */
export function normalizePathForDb(pathStr: string): string {
  return normalizePathForDbUtil(pathStr) // Uses the imported utility
}

/**
 * Computes a checksum (SHA256 hex) for a given string content.
 * Originally from file-sync-service.ts
 * @param content The string content.
 * @returns The hex-encoded SHA256 checksum.
 */
export function computeChecksum(content: string): string {
  const hash = new Bun.CryptoHasher('sha256')
  hash.update(content)
  return hash.digest('hex')
}

/**
 * Validates if a string is a valid SHA256 checksum.
 * Originally from file-sync-service.ts
 * @param checksum The checksum string to validate.
 * @returns True if valid, false otherwise.
 */
export function isValidChecksum(checksum: string | null | undefined): boolean {
  return typeof checksum === 'string' && /^[a-f0-9]{64}$/.test(checksum)
}

const CRITICAL_EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.vscode',
  '.idea',
  'venv',
  '.DS_Store'
])

/**
 * Loads ignore rules from .gitignore and default exclusions.
 * Originally from file-sync-service.ts
 * @param projectRoot The root directory of the project.
 * @returns An Ignore instance from the 'ignore' package.
 */
export async function loadIgnoreRules(projectRoot: string): Promise<Ignore> {
  const ignoreInstance = ignorePackage()
  ignoreInstance.add(DEFAULT_FILE_EXCLUSIONS) // Add default patterns like .DS_Store, etc.

  const gitignorePath = join(projectRoot, '.gitignore')
  try {
    if (nodeFsExistsSync(gitignorePath)) {
      const gitignoreContent = await Bun.file(gitignorePath).text()
      ignoreInstance.add(gitignoreContent)
      // console.log(`[FileSync] Loaded .gitignore rules from: ${gitignorePath}`);
    } else {
      // console.log(`[FileSync] No .gitignore file found at: ${gitignorePath}. Using only default exclusions.`);
    }
  } catch (error: any) {
    console.error(
      `[FileSync] Error reading .gitignore file at ${gitignorePath}: ${error.message}. Using only default exclusions.`
    )
  }
  return ignoreInstance
}

/**
 * Recursively finds all text files in a directory that match allowed configurations and are not ignored.
 * Originally from file-sync-service.ts
 * @param dir The directory to search.
 * @param projectRoot The root directory of the project (for relative path calculations).
 * @param ignoreFilter The Ignore instance for filtering files.
 * @param allowedConfigs List of allowed file extensions or names.
 * @returns An array of absolute file paths.
 */
export function getTextFiles(
  dir: string,
  projectRoot: string,
  ignoreFilter: Ignore,
  allowedConfigs: string[] = ALLOWED_FILE_CONFIGS
): string[] {
  let filesFound: string[] = []
  let entries: Dirent[]

  try {
    if (!nodeFsExistsSync(dir) || !statSync(dir).isDirectory()) {
      // console.warn(`[FileSync] Path is not a directory or doesn't exist: ${dir}`);
      return []
    }
    entries = readdirSync(dir, { withFileTypes: true })
  } catch (error: any) {
    if (error.code === 'EACCES' || error.code === 'EPERM') {
      // console.warn(`[FileSync] Permission denied reading directory ${dir}. Skipping.`);
    } else if (error.code === 'ENOENT') {
      // console.warn(`[FileSync] Directory disappeared before reading: ${dir}. Skipping.`);
    } else {
      console.error(`[FileSync] Error reading directory ${dir}: ${error.message}`)
    }
    return []
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    // Relative path from projectRoot for ignore checking
    const relativePath = relative(projectRoot, fullPath)
    const normalizedRelativePath = normalizePathForDb(relativePath)

    if (entry.isDirectory() && CRITICAL_EXCLUDED_DIRS.has(entry.name)) {
      continue
    }

    if (ignoreFilter.ignores(normalizedRelativePath)) {
      continue
    }

    if (entry.isDirectory()) {
      filesFound.push(...getTextFiles(fullPath, projectRoot, ignoreFilter, allowedConfigs))
    } else if (entry.isFile()) {
      const entryName = entry.name
      const extension = extname(entryName).toLowerCase()
      if (allowedConfigs.includes(extension) || allowedConfigs.includes(entryName)) {
        try {
          // Optional: Add file size check if needed, e.g., statSync(fullPath).size < MAX_FILE_SIZE
          filesFound.push(fullPath)
        } catch (statError: any) {
          if (statError.code === 'ENOENT') {
            // console.warn(`[FileSync] File disappeared before stating: ${fullPath}`);
          } else {
            console.error(`[FileSync] Error stating file ${fullPath}: ${statError.message}`)
          }
        }
      }
    }
  }
  return filesFound
}

/**
 * Compares disk files with database records and determines CRUD operations.
 * Delegates these operations to project-service.
 * Originally from file-sync-service.ts
 * @param project The project object.
 * @param absoluteProjectPath Absolute path to the project on disk.
 * @param absoluteFilePathsOnDisk Absolute paths of files found on disk (already filtered by initial ignore).
 * @param ignoreFilter The Ignore instance for checking deletions of previously tracked files.
 * @returns Counts of created, updated, deleted, and skipped files.
 */
export async function syncFileSet(
  project: Project,
  absoluteProjectPath: string,
  absoluteFilePathsOnDisk: string[],
  ignoreFilter: Ignore
): Promise<{ created: number; updated: number; deleted: number; skipped: number }> {
  // console.log(`[FileSync] Starting syncFileSet for project ${project.id} with ${absoluteFilePathsOnDisk.length} disk files.`);

  let filesToCreate: FileSyncData[] = []
  let filesToUpdate: { fileId: number; data: FileSyncData }[] = []
  let fileIdsToDelete: number[] = []
  let skippedCount = 0

  const existingDbFiles = await getProjectFiles(project.id) // From project-service
  if (existingDbFiles === null) {
    console.error(`[FileSync] Failed to retrieve existing files for project ${project.id}. Aborting syncFileSet.`)
    throw new Error(`Could not retrieve existing files for project ${project.id}`)
  }

  const dbFileMap = new Map<string, ProjectFile>(existingDbFiles.map((f) => [normalizePathForDb(f.path), f]))

  for (const absFilePath of absoluteFilePathsOnDisk) {
    const relativePath = relative(absoluteProjectPath, absFilePath)
    const normalizedRelativePath = normalizePathForDb(relativePath)

    try {
      const content = readFileSync(absFilePath, 'utf-8')
      const stats = statSync(absFilePath)
      const checksum = computeChecksum(content)
      const fileName = basename(normalizedRelativePath)
      let extension = extname(fileName).toLowerCase()
      if (!extension && fileName.startsWith('.')) {
        extension = fileName // e.g., '.env'
      }

      const fileData: FileSyncData = {
        path: normalizedRelativePath,
        name: fileName,
        extension: extension,
        content: content,
        size: stats.size,
        checksum: checksum
      }

      const existingDbFile = dbFileMap.get(normalizedRelativePath)

      if (existingDbFile) {
        if (!isValidChecksum(existingDbFile.checksum) || existingDbFile.checksum !== checksum) {
          filesToUpdate.push({ fileId: existingDbFile.id, data: fileData })
        } else {
          skippedCount++
        }
        dbFileMap.delete(normalizedRelativePath) // Processed
      } else {
        filesToCreate.push(fileData)
      }
    } catch (fileError: any) {
      console.error(
        `[FileSync] Error processing file ${absFilePath} (relative: ${normalizedRelativePath}): ${fileError.message}. Skipping.`
      )
      dbFileMap.delete(normalizedRelativePath) // Remove if it was in DB but couldn't be processed
    }
  }

  // Files remaining in dbFileMap are in DB but not on disk OR now ignored
  for (const [normalizedDbPath, dbFile] of dbFileMap.entries()) {
    // If a file is still in dbFileMap, it means it wasn't in absoluteFilePathsOnDisk.
    // This could be because it was deleted from disk, or it's now ignored by getTextFiles.
    // We also need to check if a file that *was* tracked is *now* explicitly ignored by current rules.
    if (ignoreFilter.ignores(normalizedDbPath)) {
      // console.log(`[FileSync] Queuing for deletion (now ignored by ignoreFilter): ${normalizedDbPath}`);
      fileIdsToDelete.push(dbFile.id)
    } else {
      // console.log(`[FileSync] Queuing for deletion (not found on disk and not caught by current ignoreFilter): ${normalizedDbPath}`);
      fileIdsToDelete.push(dbFile.id)
    }
  }

  let createdCount = 0,
    updatedCount = 0,
    deletedCount = 0

  try {
    if (filesToCreate.length > 0) {
      // console.log(`[FileSync] Creating ${filesToCreate.length} new file records...`);
      const createdResult = await bulkCreateProjectFiles(project.id, filesToCreate)
      createdCount = createdResult.length
    }
    if (filesToUpdate.length > 0) {
      // console.log(`[FileSync] Updating ${filesToUpdate.length} existing file records...`);
      const updatedResult = await bulkUpdateProjectFiles(project.id, filesToUpdate)
      updatedCount = updatedResult.length
    }
    if (fileIdsToDelete.length > 0) {
      // console.log(`[FileSync] Deleting ${fileIdsToDelete.length} file records...`);
      const deleteResult = await bulkDeleteProjectFiles(project.id, fileIdsToDelete)
      deletedCount = deleteResult.deletedCount
    }
    // console.log(`[FileSync] SyncFileSet results - Created: ${createdCount}, Updated: ${updatedCount}, Deleted: ${deletedCount}, Skipped: ${skippedCount}`);
    return { created: createdCount, updated: updatedCount, deleted: deletedCount, skipped: skippedCount }
  } catch (error) {
    console.error(`[FileSync] Error during DB batch operations for project ${project.id}:`, error)
    throw new Error(`SyncFileSet failed during storage operations for project ${project.id}`)
  }
}

/**
 * Orchestrates the synchronization process for an entire project.
 * Loads ignore rules, gets disk files, and calls syncFileSet.
 * Originally from file-sync-service.ts
 * @param project The project to sync.
 * @returns Counts of created, updated, deleted, and skipped files.
 */
export async function syncProject(
  project: Project
): Promise<{ created: number; updated: number; deleted: number; skipped: number }> {
  try {
    const absoluteProjectPath = resolvePath(project.path)
    if (!nodeFsExistsSync(absoluteProjectPath) || !statSync(absoluteProjectPath).isDirectory()) {
      console.error(`[FileSync] Project path is not a valid directory: ${absoluteProjectPath}`)
      throw new Error(`Project path is not a valid directory: ${project.path}`)
    }

    const ignoreFilter = await loadIgnoreRules(absoluteProjectPath)
    // console.log(`[FileSync] Starting full sync for project ${project.name} (${project.id}) at path: ${absoluteProjectPath}`);

    const projectFilesOnDisk = getTextFiles(
      absoluteProjectPath,
      absoluteProjectPath,
      ignoreFilter,
      ALLOWED_FILE_CONFIGS
    )
    // console.log(`[FileSync] Found ${projectFilesOnDisk.length} files on disk to potentially sync after applying ignore rules.`);

    const results = await syncFileSet(project, absoluteProjectPath, projectFilesOnDisk, ignoreFilter)
    // console.log(`[FileSync] Successfully completed sync for project ${project.id}.`);
    return results
  } catch (error: any) {
    console.error(`[FileSync] Failed to sync project ${project.id} ${project.name}: ${error.message}`)
    throw error
  }
}

/**
 * Orchestrates the synchronization process for a specific subfolder within a project.
 * Originally from file-sync-service.ts
 * @param project The project containing the folder.
 * @param folderPath Relative path of the folder within the project to sync.
 * @returns Counts of created, updated, deleted, and skipped files.
 */
export async function syncProjectFolder(
  project: Project,
  folderPath: string // Relative path from project root
): Promise<{ created: number; updated: number; deleted: number; skipped: number }> {
  try {
    const absoluteProjectPath = resolvePath(project.path)
    const absoluteFolderToSync = pathResolve(absoluteProjectPath, folderPath) // Use pathResolve for safety

    if (!nodeFsExistsSync(absoluteFolderToSync) || !statSync(absoluteFolderToSync).isDirectory()) {
      console.error(`[FileSync] Folder path is not a valid directory: ${absoluteFolderToSync}`)
      throw new Error(`Folder path is not a valid directory: ${folderPath}`)
    }

    const ignoreFilter = await loadIgnoreRules(absoluteProjectPath) // Project-level ignore rules
    // console.log(`[FileSync] Starting sync for project folder '${folderPath}' in project ${project.name} (${project.id}) at path: ${absoluteFolderToSync}`);

    // Get files only within the specific folder, but use projectRoot for relative path calculations in getTextFiles
    const folderFilesOnDisk = getTextFiles(
      absoluteFolderToSync,
      absoluteProjectPath,
      ignoreFilter,
      ALLOWED_FILE_CONFIGS
    )
    // console.log(`[FileSync] Found ${folderFilesOnDisk.length} files in folder '${folderPath}' to potentially sync.`);

    // syncFileSet will compare these folderFilesOnDisk against the *entire* DB list for the project,
    // and correctly identify deletions *within this folder's scope* or files that became ignored.
    const results = await syncFileSet(project, absoluteProjectPath, folderFilesOnDisk, ignoreFilter)

    // console.log(`[FileSync] Successfully completed sync for folder '${folderPath}' in project ${project.id}.`);
    return results
  } catch (error: any) {
    console.error(
      `[FileSync] Failed to sync folder '${folderPath}' for project ${project.id} ${project.name}: ${error.message}`
    )
    throw error
  }
}

// -------------------------------------------------------------------------------- //
// --------------------------- FILE CHANGE PLUGIN LOGIC --------------------------- //
// -------------------------------------------------------------------------------- //

/**
 * Creates a plugin that uses a file watcher to trigger actions on file changes.
 * Specifically, it re-syncs the project and re-summarizes the changed file.
 * Originally from file-change-plugin.ts
 */
export function createFileChangePlugin() {
  // Each plugin instance gets its own watcher.
  const internalWatcher = createFileChangeWatcher()
  let currentProject: Project | null = null

  async function handleFileChange(event: FileChangeEvent, changedFilePath: string): Promise<void> {
    if (!currentProject) {
      console.warn('[FileChangePlugin] Project not set, cannot handle file change.')
      return
    }
    // console.log(`[FileChangePlugin] Detected ${event} for ${changedFilePath} in project ${currentProject.id}`);
    try {
      // Re-sync the entire project to update DB based on the change
      // For performance on very large projects, a more targeted sync might be considered,
      // but full sync ensures consistency.
      await syncProject(currentProject) // Uses the syncProject defined in this file

      // After sync, the DB should reflect the file's current state (or its absence if deleted)
      const allFiles = await getProjectFiles(currentProject.id) // From project-service
      if (!allFiles) {
        // console.warn(`[FileChangePlugin] No files found for project ${currentProject.id} after sync.`);
        return
      }

      const absoluteProjectPath = resolvePath(currentProject.path)
      const relativeChangedPath = normalizePathForDb(relative(absoluteProjectPath, changedFilePath))

      const updatedFile = allFiles.find((f) => normalizePathForDb(f.path) === relativeChangedPath)

      if (event === 'deleted') {
        // console.log(`[FileChangePlugin] File ${relativeChangedPath} was deleted. No summarization needed.`);
        // Potentially trigger other cleanup actions for deleted files if necessary.
        return
      }

      if (!updatedFile) {
        // This might happen if the file was immediately deleted after a create/modify event,
        // or if syncProject determined it shouldn't be tracked.
        // console.warn(`[FileChangePlugin] File ${relativeChangedPath} not found in project records after sync. Event was ${event}.`);
        return
      }

      // Re-summarize the (created or modified) file
      // console.log(`[FileChangePlugin] Summarizing ${updatedFile.path}...`);
      await summarizeSingleFile(updatedFile) // From project-service
      // console.log(`[FileChangePlugin] Finished processing ${event} for ${changedFilePath}`);
    } catch (err) {
      console.error('[FileChangePlugin] Error handling file change:', err)
    }
  }

  async function start(project: Project, ignorePatterns: string[] = []): Promise<void> {
    currentProject = project // Store project context
    internalWatcher.registerListener({ onFileChanged: handleFileChange })

    const projectAbsPath = resolvePath(project.path)
    // console.log(`[FileChangePlugin] Starting watcher for project ${project.id} at ${projectAbsPath}`);
    internalWatcher.startWatching({
      directory: projectAbsPath,
      ignorePatterns, // Pass along ignore patterns
      recursive: true
    })
  }

  function stop(): void {
    // console.log(`[FileChangePlugin] Stopping watcher for project ${currentProject?.id}`);
    internalWatcher.stopAllAndClearListeners() // Fully stop and clear listeners for this plugin's watcher
    currentProject = null
  }

  return {
    start,
    stop
  }
}

// -------------------------------------------------------------------------------- //
// ---------------------------- WATCHERS MANAGER LOGIC ---------------------------- //
// -------------------------------------------------------------------------------- //

/**
 * Manages multiple file change plugins (and thus watchers), one per project.
 * Originally from watchers-manager.ts
 */
export function createWatchersManager() {
  const activePlugins = new Map<number, ReturnType<typeof createFileChangePlugin>>()

  async function startWatchingProject(project: Project, ignorePatterns: string[] = []): Promise<void> {
    if (activePlugins.has(project.id)) {
      console.warn(`[WatchersManager] Already watching project: ${project.id}. To reconfigure, stop and start again.`)
      return
    }

    const resolvedProjectPath = resolvePath(project.path)
    if (!nodeFsExistsSync(resolvedProjectPath)) {
      // Use nodeFsExistsSync
      console.error(`[WatchersManager] Project path for ${project.id} doesn't exist: ${resolvedProjectPath}`)
      return
    }

    // console.log(`[WatchersManager] Initializing file change plugin for project: ${project.id} (${resolvedProjectPath})`);
    const plugin = createFileChangePlugin() // Uses the createFileChangePlugin defined in this file
    try {
      await plugin.start(project, ignorePatterns)
      activePlugins.set(project.id, plugin)
      // console.log(`[WatchersManager] Successfully started watching project: ${project.id}`);
    } catch (error) {
      console.error(`[WatchersManager] Error starting plugin for project ${project.id}:`, error)
      plugin.stop() // Ensure cleanup if start fails
    }
  }

  function stopWatchingProject(projectId: number): void {
    const plugin = activePlugins.get(projectId)
    if (!plugin) {
      // console.warn(`[WatchersManager] Not currently watching project: ${projectId}. Cannot stop.`);
      return
    }
    // console.log(`[WatchersManager] Stopping watching for project: ${projectId}`);
    plugin.stop()
    activePlugins.delete(projectId)
    // console.log(`[WatchersManager] Successfully stopped watching project: ${projectId}`);
  }

  function stopAllWatchers(): void {
    // console.log(`[WatchersManager] Stopping all project watchers...`);
    if (activePlugins.size === 0) {
      // console.log("[WatchersManager] No active watchers to stop.");
      return
    }
    for (const [projectId, plugin] of activePlugins.entries()) {
      // console.log(`[WatchersManager] Stopping watcher for project: ${projectId}`);
      plugin.stop()
    }
    activePlugins.clear()
    // console.log("[WatchersManager] All project watchers have been stopped.");
  }

  return {
    startWatchingProject,
    stopWatchingProject,
    stopAllWatchers, // Renamed from stopAll for clarity
    getActiveWatchersCount: () => activePlugins.size // For inspection
  }
}

// -------------------------------------------------------------------------------- //
// ------------------------------ CLEANUP SERVICE LOGIC --------------------------- //
// -------------------------------------------------------------------------------- //

/**
 * Creates a "cleanup service" that can be started/stopped
 * and can run a periodic cleanupAllProjects task (which syncs projects).
 * Originally from cleanup-service.ts
 */
export function createCleanupService(options: CleanupOptions) {
  let intervalId: ReturnType<typeof setInterval> | null = null

  async function cleanupAllProjects(): Promise<CleanupResult[]> {
    // console.log('[CleanupService] Starting cleanupAllProjects...');
    try {
      const projectsToClean = await listProjects() // From project-service
      if (!projectsToClean || projectsToClean.length === 0) {
        // console.log('[CleanupService] No projects found to clean up.');
        return []
      }
      // console.log(`[CleanupService] Found ${projectsToClean.length} projects to process.`);

      const results: CleanupResult[] = []

      for (const project of projectsToClean) {
        // console.log(`[CleanupService] Processing project ${project.id} (${project.name})`);
        try {
          // The core "cleanup" action is to sync the project.
          await syncProject(project) // Uses the syncProject defined in this file
          results.push({
            projectId: project.id,
            status: 'success',
            removedCount: 0 // syncProject doesn't directly return removedCount in this context
            // This field might need re-evaluation based on what "removedCount" means here.
            // Assuming it means files removed *by sync*, which syncProject result provides.
            // However, original cleanup-service hardcoded 0.
            // For now, keeping it as 0 to match original behavior.
            // To get actual counts, syncProject's return could be used.
          })
          // console.log(`[CleanupService] Successfully processed project ${project.id}.`);
        } catch (error) {
          console.error(`[CleanupService] Error cleaning project ${project.id}:`, error)
          results.push({
            projectId: project.id,
            status: 'error',
            error
          })
        }
      }
      // console.log('[CleanupService] Finished cleanupAllProjects.');
      return results
    } catch (error) {
      console.error('[CleanupService] Fatal error fetching projects during cleanupAllProjects:', error)
      return [] // Return empty array on fatal error fetching projects
    }
  }

  function start(): void {
    if (intervalId) {
      console.warn('[CleanupService] Cleanup service already started.')
      return
    }
    // console.log(`[CleanupService] Starting periodic cleanup every ${options.intervalMs}ms.`);
    intervalId = setInterval(() => {
      // console.log('[CleanupService] Periodic cleanup task triggered.');
      cleanupAllProjects().catch((err) => {
        // Catch errors from the async cleanupAllProjects promise
        console.error('[CleanupService] Unhandled error during periodic cleanupAllProjects execution:', err)
      })
    }, options.intervalMs)
    // console.log(`[CleanupService] Periodic cleanup started with interval ID: ${intervalId}.`);
  }

  function stop(): void {
    if (!intervalId) {
      // console.warn("[CleanupService] Cleanup service is not running, cannot stop.");
      return
    }
    // console.log(`[CleanupService] Stopping periodic cleanup (interval ID: ${intervalId}).`);
    clearInterval(intervalId)
    intervalId = null
    // console.log("[CleanupService] Periodic cleanup stopped.");
  }

  return {
    start,
    stop,
    cleanupAllProjects, // Expose for manual triggering if needed
    isRunning: () => intervalId !== null // For inspection
  }
}

// Create shared instances that can be imported elsewhere
export const watchersManager = createWatchersManager()
