import { watch, FSWatcher, existsSync } from "fs";
import { resolvePath } from "@/utils/path-utils";

export type FileChangeEvent = "created" | "modified" | "deleted";

export interface FileChangeListener {
  onFileChanged(event: FileChangeEvent, filePath: string): Promise<void> | void;
}

export interface WatchOptions {
  directory: string;
  ignorePatterns?: string[];
  recursive?: boolean;
}

/**
 * On macOS, Node's fs.watch does not reliably support `recursive: true`.
 * For robust cross-platform recursion, consider chokidar or Bun.watch.
 */
export function isIgnored(filePath: string, ignorePatterns: string[]): boolean {
  for (const pattern of ignorePatterns) {
    const regexSafe = pattern.replace(/\./g, "\\.").replace(/\*/g, ".*");
    if (new RegExp(regexSafe).test(filePath)) {
      return true;
    }
  }
  return false;
}

export function inferChangeType(eventType: string, fullPath: string): FileChangeEvent | null {
  if (eventType === "rename") {
    if (existsSync(fullPath)) {
      return "created";
    } else {
      return "deleted";
    }
  } else if (eventType === "change") {
    return "modified";
  }
  return null;
}

/**
 * Creates a functional file-change watcher that can manage multiple watchers/listeners.
 */
export function createFileChangeWatcher() {
  const watchers = new Map<string, FSWatcher>();
  const listeners: FileChangeListener[] = [];

  function registerListener(listener: FileChangeListener): void {
    listeners.push(listener);
  }

  function unregisterListener(listener: FileChangeListener): void {
    const index = listeners.indexOf(listener);
    if (index !== -1) {
      listeners.splice(index, 1);
    }
  }

  function startWatching(options: WatchOptions): void {
    const { directory, ignorePatterns = [], recursive = true } = options;
    
    // Expand home directory if it exists
    const resolvedPath = resolvePath(directory);
    
    if (!existsSync(resolvedPath)) {
      console.warn(`[FileChangeWatcher] Directory does not exist: ${resolvedPath}`);
      return;
    }

    if (watchers.has(resolvedPath)) {
      console.warn(`[FileChangeWatcher] Already watching: ${resolvedPath}`);
      return;
    }

    try {
      const watcher = watch(
        resolvedPath,
        { recursive },
        (eventType, filename) => {
          if (!filename) return;

          const fullPath = `${resolvedPath}/${filename}`;
          if (isIgnored(filename, ignorePatterns)) return;

          const changeType = inferChangeType(eventType, fullPath);
          if (!changeType) return;

          // Notify all listeners
          for (const listener of listeners) {
            listener.onFileChanged(changeType, fullPath);
          }
        }
      );

      watchers.set(resolvedPath, watcher);
    } catch (err) {
      console.error(`[FileChangeWatcher] Error watching ${resolvedPath}:`, err);
    }
  }

  function stopAll(): void {
    for (const [path, watcher] of watchers.entries()) {
      watcher.close();
      watchers.delete(path);
    }
  }

  return {
    registerListener,
    unregisterListener,
    startWatching,
    stopAll,
  };
}