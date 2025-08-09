import { watch as fsWatch, type FSWatcher, existsSync as fsLibExistsSync } from 'fs'
import { join, extname, resolve as pathResolve, relative, basename } from 'node:path'
import { readdirSync, readFileSync, statSync, Dirent, existsSync as nodeFsExistsSync } from 'node:fs'
import { type Project, type ProjectFile } from '@promptliano/schemas'
import { getFilesConfig } from '@promptliano/config'
import ignorePackage, { type Ignore } from 'ignore'

const filesConfig = getFilesConfig()
const ALLOWED_FILE_CONFIGS = filesConfig.allowedExtensions
const DEFAULT_FILE_EXCLUSIONS = filesConfig.defaultExclusions
const MAX_FILE_SIZE_FOR_SUMMARY = filesConfig.maxFileSizeForSummary
import { truncateForSummarization } from '@promptliano/shared'
import { retryOperation } from '../utils/retry-operation'
import {
  getProjectFiles,
  bulkCreateProjectFiles,
  bulkUpdateProjectFiles,
  bulkDeleteProjectFiles,
  type FileSyncData, // Interface from project-service
  listProjects,
  fileIndexingService
} from '@promptliano/services' // Adjusted path assuming this file is in services/file-services/
import { resolvePath, normalizePathForDb as normalizePathForDbUtil } from '../utils/path-utils'
import { summarizeSingleFile } from '@promptliano/services'
import { analyzeCodeImportsExports } from '../utils/code-analysis'
import { createLogger } from '../utils/logger'

const logger = createLogger('FileSync')
const watcherLogger = logger.child('Watcher')
const pluginLogger = logger.child('Plugin')
const cleanupLogger = logger.child('Cleanup')

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
      watcherLogger.warn(`Already watching: ${resolvedDir}`)
      return
    }
    if (watcherInstance) {
      // Stop previous watcher if directory changes
      stopWatching()
    }

    if (!nodeFsExistsSync(resolvedDir)) {
      // Use nodeFsExistsSync for general FS checks
      watcherLogger.warn(`Directory does not exist, cannot watch: ${resolvedDir}`)
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
          return
        }

        // Notify all listeners
        for (const listener of listeners) {
          const result = listener.onFileChanged(changeType, fullPath)
          if (result && typeof result.then === 'function') {
            result.catch((err: unknown) => {
              watcherLogger.error('Error in listener onFileChanged', err)
            })
          }
        }
      })
      watchingDirectory = resolvedDir // Store the currently watched directory
      watcherInstance.on('error', (err) => {
        watcherLogger.error(`Watcher error for ${resolvedDir}`, err)
        stopWatching() // Attempt to stop on error
      })
      watcherLogger.debug(`Started watching directory: ${resolvedDir}`)
    } catch (err) {
      watcherLogger.error(`Error starting watch on ${resolvedDir}`, err)
      watcherInstance = null
      watchingDirectory = null
    }
  }

  function stopWatching(): void {
    if (watcherInstance) {
      watcherInstance.close()
      watcherInstance = null
      watcherLogger.debug(`Stopped watching directory: ${watchingDirectory}`)
      watchingDirectory = null
    }
  }

  /** Stops watching and clears all listeners. */
  function stopAllAndClearListeners(): void {
    stopWatching()
    listeners.length = 0 // Clear listeners array
    watcherLogger.debug(`All listeners cleared`)
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
  return typeof checksum === 'string' && /^[a-f0-9]{64}$/i.test(checksum)
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
    }
  } catch (error: any) {
    logger.error(`Error reading .gitignore file at ${gitignorePath}`, error)
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
      logger.debug(`Permission denied reading directory ${dir}. Skipping.`)
    } else if (error.code === 'ENOENT') {
      logger.debug(`Directory disappeared before reading: ${dir}. Skipping.`)
    } else {
      logger.error(`Error reading directory ${dir}`, error)
    }
    return []
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    // Relative path from projectRoot for ignore checking
    const relativePath = relative(projectRoot, fullPath)
    const normalizedRelativePath = normalizePathForDbUtil(relativePath)

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
            logger.debug(`File disappeared before stating: ${fullPath}`)
          } else {
            logger.error(`Error stating file ${fullPath}`, statError)
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
  logger.verbose(`Starting syncFileSet for project ${project.id} with ${absoluteFilePathsOnDisk.length} disk files`)

  let filesToCreate: FileSyncData[] = []
  let filesToUpdate: { fileId: number; data: FileSyncData }[] = []
  let fileIdsToDelete: number[] = []
  let skippedCount = 0
  let processedCount = 0

  const existingDbFiles = await getProjectFiles(project.id) // From project-service
  if (existingDbFiles === null) {
    logger.error(`Failed to retrieve existing files for project ${project.id}. Aborting syncFileSet.`)
    throw new Error(`Could not retrieve existing files for project ${project.id}`)
  }

  logger.info(
    `[SYNC] Comparing ${absoluteFilePathsOnDisk.length} disk files with ${existingDbFiles.length} database files`
  )
  const dbFileMap = new Map<string, ProjectFile>(existingDbFiles.map((f) => [normalizePathForDbUtil(f.path), f]))

  for (const absFilePath of absoluteFilePathsOnDisk) {
    processedCount++

    // Log progress every 100 files for large projects
    if (processedCount % 100 === 0) {
      logger.info(`[SYNC PROGRESS] Processed ${processedCount}/${absoluteFilePathsOnDisk.length} files...`)
    }

    const relativePath = relative(absoluteProjectPath, absFilePath)
    const normalizedRelativePath = normalizePathForDbUtil(relativePath)

    try {
      const stats = statSync(absFilePath)

      // Read file content and compute checksum
      let content: string
      let checksum: string
      const rawContent = readFileSync(absFilePath, 'utf-8')

      // Always compute checksum from the full content for change detection
      checksum = computeChecksum(rawContent)

      // Truncate content for storage and summarization to control AI costs
      const truncationResult = truncateForSummarization(rawContent)
      content = truncationResult.content

      if (truncationResult.wasTruncated) {
        logger.debug(`File truncated for summarization`, {
          path: normalizedRelativePath,
          project: `${project.name} (ID: ${project.id})`,
          fileSize: stats.size,
          originalLength: truncationResult.originalLength,
          truncatedLength: content.length,
          reduction: `${Math.round((1 - content.length / truncationResult.originalLength) * 100)}%`
        })
      }

      const fileName = basename(normalizedRelativePath)
      let extension = extname(fileName).toLowerCase()
      if (!extension && fileName.startsWith('.')) {
        extension = fileName // e.g., '.env'
      }

      // Analyze imports/exports for supported file types (skip if truncated)
      let codeAnalysis = null
      if (['.js', '.jsx', '.ts', '.tsx', '.py'].includes(extension) && !truncationResult.wasTruncated) {
        codeAnalysis = analyzeCodeImportsExports(content, fileName)
      }

      const fileData: FileSyncData = {
        path: normalizedRelativePath,
        name: fileName,
        extension: extension,
        content: content,
        size: stats.size,
        checksum: checksum,
        imports: codeAnalysis?.imports || null,
        exports: codeAnalysis?.exports || null
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
      const isTruncationRelated =
        fileError?.message?.includes('truncated') || fileError?.message?.includes("Expected ']'")
      if (!isTruncationRelated) {
        logger.error(`Error processing ${normalizedRelativePath}`, fileError)
      }
      dbFileMap.delete(normalizedRelativePath) // Remove if it was in DB but couldn't be processed
    }
  }

  // Files remaining in dbFileMap are in DB but not on disk OR now ignored
  for (const [normalizedDbPath, dbFile] of dbFileMap.entries()) {
    // If a file is still in dbFileMap, it means it wasn't in absoluteFilePathsOnDisk.
    // This could be because it was deleted from disk, or it's now ignored by getTextFiles.
    // We also need to check if a file that *was* tracked is *now* explicitly ignored by current rules.
    if (ignoreFilter.ignores(normalizedDbPath)) {
      logger.verbose(`Queuing for deletion (now ignored by ignoreFilter): ${normalizedDbPath}`)
      fileIdsToDelete.push(dbFile.id)
    } else {
      logger.verbose(`Queuing for deletion (not found on disk): ${normalizedDbPath}`)
      fileIdsToDelete.push(dbFile.id)
    }
  }

  let createdCount = 0,
    updatedCount = 0,
    deletedCount = 0
  let createdFiles: ProjectFile[] = []
  let updatedFiles: ProjectFile[] = []

  // Process in chunks to avoid overwhelming the database
  const CHUNK_SIZE = 100

  try {
    if (filesToCreate.length > 0) {
      logger.info(`[SYNC] Creating ${filesToCreate.length} new file records in chunks of ${CHUNK_SIZE}`)

      for (let i = 0; i < filesToCreate.length; i += CHUNK_SIZE) {
        const chunk = filesToCreate.slice(i, Math.min(i + CHUNK_SIZE, filesToCreate.length))
        logger.verbose(
          `Creating files ${i + 1}-${Math.min(i + CHUNK_SIZE, filesToCreate.length)} of ${filesToCreate.length}`
        )

        const chunkResults = await bulkCreateProjectFiles(project.id, chunk)
        createdFiles.push(...chunkResults)
        createdCount += chunkResults.length
      }
    }

    if (filesToUpdate.length > 0) {
      logger.info(`[SYNC] Updating ${filesToUpdate.length} existing file records in chunks of ${CHUNK_SIZE}`)

      for (let i = 0; i < filesToUpdate.length; i += CHUNK_SIZE) {
        const chunk = filesToUpdate.slice(i, Math.min(i + CHUNK_SIZE, filesToUpdate.length))
        logger.verbose(
          `Updating files ${i + 1}-${Math.min(i + CHUNK_SIZE, filesToUpdate.length)} of ${filesToUpdate.length}`
        )

        const chunkResults = await bulkUpdateProjectFiles(project.id, chunk)
        updatedFiles.push(...chunkResults)
        updatedCount += chunkResults.length
      }
    }

    if (fileIdsToDelete.length > 0) {
      logger.info(`[SYNC] Deleting ${fileIdsToDelete.length} file records in chunks of ${CHUNK_SIZE}`)

      for (let i = 0; i < fileIdsToDelete.length; i += CHUNK_SIZE) {
        const chunk = fileIdsToDelete.slice(i, Math.min(i + CHUNK_SIZE, fileIdsToDelete.length))
        logger.verbose(
          `Deleting files ${i + 1}-${Math.min(i + CHUNK_SIZE, fileIdsToDelete.length)} of ${fileIdsToDelete.length}`
        )

        const deleteResult = await bulkDeleteProjectFiles(project.id, chunk)
        deletedCount += deleteResult.deletedCount
      }
    }
    logger.info(
      `SyncFileSet results - Created: ${createdCount}, Updated: ${updatedCount}, Deleted: ${deletedCount}, Skipped: ${skippedCount}`
    )

    // Index new and updated files immediately
    if (createdCount > 0 || updatedCount > 0) {
      const filesToIndex = [...createdFiles, ...updatedFiles]

      try {
        const indexResult = await fileIndexingService.indexFiles(filesToIndex)
        logger.info(
          `File indexing completed - Indexed: ${indexResult.indexed}, Skipped: ${indexResult.skipped}, Failed: ${indexResult.failed}`
        )
      } catch (error) {
        logger.error('File indexing failed', error)
        // Don't throw - let sync complete even if indexing fails
      }
    }
    // Remove deleted files from index
    if (deletedCount > 0) {
      try {
        for (const fileId of fileIdsToDelete) {
          await fileIndexingService.removeFileFromIndex(fileId)
        }
        logger.info(`Removed ${fileIdsToDelete.length} files from search index`)
      } catch (error) {
        logger.error('Failed to remove files from index', error)
        // Don't throw - let sync complete even if index cleanup fails
      }
    }
    return { created: createdCount, updated: updatedCount, deleted: deletedCount, skipped: skippedCount }
  } catch (error) {
    logger.error(`Error during DB batch operations for project ${project.id}`, error)
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
  const startTime = Date.now()
  logger.info(`[SYNC START] Project: ${project.name} (ID: ${project.id})`)

  // Wrap the sync operation in retry logic for resilience
  return retryOperation(
    async () => {
      const absoluteProjectPath = resolvePath(project.path)
      if (!nodeFsExistsSync(absoluteProjectPath) || !statSync(absoluteProjectPath).isDirectory()) {
        logger.error(`Project path is not a valid directory: ${absoluteProjectPath}`)
        throw new Error(`Project path is not a valid directory: ${project.path}`)
      }

      const ignoreFilter = await loadIgnoreRules(absoluteProjectPath)
      logger.debug(`Starting full sync for project ${project.name} (${project.id}) at path: ${absoluteProjectPath}`)

      // Log scanning phase
      logger.info(`[SYNC] Scanning files in ${absoluteProjectPath}...`)
      const scanStartTime = Date.now()

      const projectFilesOnDisk = getTextFiles(
        absoluteProjectPath,
        absoluteProjectPath,
        ignoreFilter,
        ALLOWED_FILE_CONFIGS
      )

      const scanDuration = Date.now() - scanStartTime
      logger.info(
        `[SYNC] File scan completed in ${scanDuration}ms. Found ${projectFilesOnDisk.length} files to process`
      )

      // Process files
      logger.info(`[SYNC] Processing ${projectFilesOnDisk.length} files...`)
      const results = await syncFileSet(project, absoluteProjectPath, projectFilesOnDisk, ignoreFilter)

      const totalDuration = Date.now() - startTime
      logger.info(
        `[SYNC COMPLETE] Project ${project.id} synced in ${totalDuration}ms - Created: ${results.created}, Updated: ${results.updated}, Deleted: ${results.deleted}, Skipped: ${results.skipped}`
      )

      return results
    },
    {
      maxAttempts: 3,
      initialDelay: 2000,
      maxDelay: 10000,
      shouldRetry: (error: any, attempt: number) => {
        // Don't retry on invalid project path errors
        if (error.message?.includes('not a valid directory')) {
          return false
        }
        // Retry on file system errors, database errors, and network errors
        const retryableErrors = ['EBUSY', 'ENOENT', 'EACCES', 'SQLITE_BUSY', 'SQLITE_LOCKED', 'ETIMEDOUT', 'ECONNRESET']
        const shouldRetry = retryableErrors.some((code) => error.code === code || error.message?.includes(code))

        if (shouldRetry) {
          logger.warn(`[SYNC RETRY] Project ${project.id} sync failed on attempt ${attempt}, will retry...`)
        }

        return shouldRetry
      }
    }
  ).catch((error: any) => {
    const duration = Date.now() - startTime
    logger.error(
      `[SYNC FAILED] Project ${project.id} ${project.name} failed after ${duration}ms and all retry attempts`,
      error
    )
    throw error
  })
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
      logger.error(`Folder path is not a valid directory: ${absoluteFolderToSync}`)
      throw new Error(`Folder path is not a valid directory: ${folderPath}`)
    }

    const ignoreFilter = await loadIgnoreRules(absoluteProjectPath) // Project-level ignore rules
    logger.debug(`Starting sync for project folder '${folderPath}' in project ${project.name} (${project.id})`)

    // Get files only within the specific folder, but use projectRoot for relative path calculations in getTextFiles
    const folderFilesOnDisk = getTextFiles(
      absoluteFolderToSync,
      absoluteProjectPath,
      ignoreFilter,
      ALLOWED_FILE_CONFIGS
    )
    logger.verbose(`Found ${folderFilesOnDisk.length} files in folder '${folderPath}' to potentially sync`)

    // syncFileSet will compare these folderFilesOnDisk against the *entire* DB list for the project,
    // and correctly identify deletions *within this folder's scope* or files that became ignored.
    const results = await syncFileSet(project, absoluteProjectPath, folderFilesOnDisk, ignoreFilter)

    logger.debug(`Successfully completed sync for folder '${folderPath}' in project ${project.id}`)
    return results
  } catch (error: any) {
    logger.error(`Failed to sync folder '${folderPath}' for project ${project.id} ${project.name}`, error)
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
      pluginLogger.warn('Project not set, cannot handle file change.')
      return
    }
    pluginLogger.verbose(`Detected ${event} for ${changedFilePath} in project ${currentProject.id}`)
    try {
      // Re-sync the entire project to update DB based on the change
      // For performance on very large projects, a more targeted sync might be considered,
      // but full sync ensures consistency.
      await syncProject(currentProject) // Uses the syncProject defined in this file

      // After sync, the DB should reflect the file's current state (or its absence if deleted)
      const allFiles = await getProjectFiles(currentProject.id) // From project-service
      if (!allFiles) {
        pluginLogger.warn(`No files found for project ${currentProject.id} after sync.`)
        return
      }

      const absoluteProjectPath = resolvePath(currentProject.path)
      const relativeChangedPath = normalizePathForDbUtil(relative(absoluteProjectPath, changedFilePath))

      const updatedFile = allFiles.find((f) => normalizePathForDbUtil(f.path) === relativeChangedPath)

      if (event === 'deleted') {
        pluginLogger.verbose(`File ${relativeChangedPath} was deleted. No summarization needed.`)
        // Potentially trigger other cleanup actions for deleted files if necessary.
        return
      }

      if (!updatedFile) {
        // This might happen if the file was immediately deleted after a create/modify event,
        // or if syncProject determined it shouldn't be tracked.
        pluginLogger.verbose(`File ${relativeChangedPath} not found in project records after sync. Event was ${event}.`)
        return
      }

      // Re-summarize the (created or modified) file
      pluginLogger.verbose(`Summarizing ${updatedFile.path}...`)
      await summarizeSingleFile(updatedFile, true) // From summarize-files-agent - force=true for new/updated files
      pluginLogger.verbose(`Finished processing ${event} for ${changedFilePath}`)
    } catch (err) {
      pluginLogger.error('Error handling file change', err)
    }
  }

  async function start(project: Project, ignorePatterns: string[] = []): Promise<void> {
    currentProject = project // Store project context
    internalWatcher.registerListener({ onFileChanged: handleFileChange })

    const projectAbsPath = resolvePath(project.path)
    pluginLogger.debug(`Starting watcher for project ${project.id} at ${projectAbsPath}`)
    internalWatcher.startWatching({
      directory: projectAbsPath,
      ignorePatterns, // Pass along ignore patterns
      recursive: true
    })
  }

  function stop(): void {
    pluginLogger.debug(`Stopping watcher for project ${currentProject?.id}`)
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
      logger.warn(`Already watching project: ${project.id}. To reconfigure, stop and start again.`)
      return
    }

    const resolvedProjectPath = resolvePath(project.path)
    if (!nodeFsExistsSync(resolvedProjectPath)) {
      // Use nodeFsExistsSync
      logger.error(`Project path for ${project.id} doesn't exist: ${resolvedProjectPath}`)
      return
    }

    logger.debug(`Initializing file change plugin for project: ${project.id} (${resolvedProjectPath})`)
    const plugin = createFileChangePlugin() // Uses the createFileChangePlugin defined in this file
    try {
      await plugin.start(project, ignorePatterns)
      activePlugins.set(project.id, plugin)
      logger.debug(`Successfully started watching project: ${project.id}`)
    } catch (error) {
      logger.error(`Error starting plugin for project ${project.id}`, error)
      plugin.stop() // Ensure cleanup if start fails
    }
  }

  function stopWatchingProject(projectId: number): void {
    const plugin = activePlugins.get(projectId)
    if (!plugin) {
      logger.warn(`Not currently watching project: ${projectId}. Cannot stop.`)
      return
    }
    logger.debug(`Stopping watching for project: ${projectId}`)
    plugin.stop()
    activePlugins.delete(projectId)
    logger.debug(`Successfully stopped watching project: ${projectId}`)
  }

  function stopAllWatchers(): void {
    logger.debug(`Stopping all project watchers...`)
    if (activePlugins.size === 0) {
      logger.debug('No active watchers to stop.')
      return
    }
    for (const [projectId, plugin] of activePlugins.entries()) {
      logger.debug(`Stopping watcher for project: ${projectId}`)
      plugin.stop()
    }
    activePlugins.clear()
    logger.debug('All project watchers have been stopped.')
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
    cleanupLogger.debug('Starting cleanupAllProjects...')
    try {
      const projectsToClean = await listProjects() // From project-service
      if (!projectsToClean || projectsToClean.length === 0) {
        cleanupLogger.debug('No projects found to clean up.')
        return []
      }
      cleanupLogger.debug(`Found ${projectsToClean.length} projects to process.`)

      const results: CleanupResult[] = []

      for (const project of projectsToClean) {
        cleanupLogger.verbose(`Processing project ${project.id} (${project.name})`)
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
          cleanupLogger.verbose(`Successfully processed project ${project.id}.`)
        } catch (error) {
          cleanupLogger.error(`Error cleaning project ${project.id}`, error)
          results.push({
            projectId: project.id,
            status: 'error',
            error
          })
        }
      }
      cleanupLogger.debug('Finished cleanupAllProjects.')
      return results
    } catch (error) {
      cleanupLogger.error('Fatal error fetching projects during cleanupAllProjects', error)
      return [] // Return empty array on fatal error fetching projects
    }
  }

  function start(): void {
    if (intervalId) {
      cleanupLogger.warn('Cleanup service already started.')
      return
    }
    cleanupLogger.debug(`Starting periodic cleanup every ${options.intervalMs}ms.`)
    intervalId = setInterval(() => {
      cleanupLogger.verbose('Periodic cleanup task triggered.')
      cleanupAllProjects().catch((err) => {
        // Catch errors from the async cleanupAllProjects promise
        cleanupLogger.error('Unhandled error during periodic cleanupAllProjects execution', err)
      })
    }, options.intervalMs)
    cleanupLogger.debug(`Periodic cleanup started with interval ID: ${intervalId}.`)
  }

  function stop(): void {
    if (!intervalId) {
      cleanupLogger.warn('Cleanup service is not running, cannot stop.')
      return
    }
    cleanupLogger.debug(`Stopping periodic cleanup (interval ID: ${intervalId}).`)
    clearInterval(intervalId)
    intervalId = null
    cleanupLogger.debug('Periodic cleanup stopped.')
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
