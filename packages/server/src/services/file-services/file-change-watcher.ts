import { watch, FSWatcher, existsSync } from "fs";

/**
 * Enumerates the type of file change events we care about.
 */
export type FileChangeEvent = "created" | "modified" | "deleted";

/**
 * This listener interface can be plugged into the watcher to respond to file events.
 */
export interface FileChangeListener {
  onFileChanged(event: FileChangeEvent, filePath: string): Promise<void> | void;
}

/**
 * Configuration options for the file watcher.
 */
export interface WatchOptions {
  directory: string;
  ignorePatterns?: string[];
  recursive?: boolean;
}

/**
 * Helper that checks if a path should be ignored based on given patterns.
 */
export function isIgnored(filePath: string, ignorePatterns: string[]): boolean {
  for (const pattern of ignorePatterns) {
    // A simple pattern match: replace '*' with '.*' for minimal wildcard support
    const regexSafe = pattern.replace(/\./g, "\\.").replace(/\*/g, ".*");
    const regex = new RegExp(regexSafe, "i");
    if (regex.test(filePath)) {
      return true;
    }
  }
  return false;
}

/**
 * Infers the type of file change based on Node's fs.watch event type and
 * a check for file existence to distinguish creation vs. deletion.
 */
export function inferChangeType(eventType: string, fullPath: string): FileChangeEvent | null {
  switch (eventType) {
    case "change":
      return "modified";
    case "rename":
      // 'rename' in fs.watch can be either a creation or a deletion.
      // We check if the file exists to decide which event it really is.
      return existsSync(fullPath) ? "created" : "deleted";
    default:
      return null;
  }
}

/**
 * A cross-platform file-change watcher using Node's fs.watch.
 * Provides a pluggable listener mechanism for reacting to file changes.
 * 
 * ## Usage:
 * ```ts
 * const watcher = new FileChangeWatcher();
 * watcher.registerListener({
 *   onFileChanged: (event, path) => console.log(`File ${event}: ${path}`)
 * });
 * watcher.startWatching({ directory: '/path/to/dir' });
 * ```
 */
export class FileChangeWatcher {
  private listeners: FileChangeListener[] = [];
  private watchers: FSWatcher[] = [];

  /**
   * Adds a listener to be notified of file changes.
   */
  public registerListener(listener: FileChangeListener): void {
    this.listeners.push(listener);
  }

  /**
   * Removes a previously registered listener.
   */
  public unregisterListener(listener: FileChangeListener): void {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  /**
   * Begins watching a directory for file changes.
   */
  public startWatching(options: WatchOptions): void {
    const { directory, ignorePatterns = [], recursive = true } = options;

    // Safety check if the directory exist *at the time we attempt to watch*
    if (!existsSync(directory)) {
      console.warn(`[FileChangeWatcher] Directory does not exist: ${directory}. Watcher skipped.`);
      return;
    }

    // Attempt to start watching the directory
    const watcher = watch(directory, { recursive }, (eventType, filename) => {
      if (!filename) return;

      const fullPath = `${directory}/${filename}`;

      // Check if the file should be ignored
      if (isIgnored(fullPath, ignorePatterns)) {
        return;
      }

      // Determine the change type
      const changeType = inferChangeType(eventType, fullPath);
      if (!changeType) {
        return;
      }

      // Notify all listeners
      for (const listener of this.listeners) {
        listener.onFileChanged(changeType, fullPath);
      }
    });

    // If the directory is deleted while we are watching, fs.watch often emits an error
    watcher.on("error", (error) => {
      console.error(`[FileChangeWatcher] Error watching ${directory}:`, error);

      // If it’s specifically ENOENT (no such file or directory),
      // you might want to stop the watcher or handle it in watchers-manager:
      if (error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.warn(`[FileChangeWatcher] Directory disappeared: ${directory}. Stopping watcher.`);
        watcher.close();
      }
    });

    this.watchers.push(watcher);
    console.log(`[FileChangeWatcher] Now watching: ${directory}`);
  }

  /**
   * Stops all watchers.
   */
  public stopAll(): void {
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];
  }
}