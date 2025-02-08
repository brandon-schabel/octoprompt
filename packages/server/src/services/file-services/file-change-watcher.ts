import { watch, FSWatcher, existsSync } from "fs";

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
 * On macOS, Node’s fs.watch does not reliably support `recursive: true`.
 * If you need robust cross-platform recursion, consider:
 *  - `chokidar` (npm package) 
 *  - or `Bun.watch` if you’re running in Bun environment.
 */

export function isIgnored(filePath: string, ignorePatterns: string[]): boolean {
  for (const pattern of ignorePatterns) {
    const regexSafe = pattern.replace(/\./g, "\\.").replace(/\*/g, ".*");
    const regex = new RegExp(regexSafe, "i");
    if (regex.test(filePath)) {
      return true;
    }
  }
  return false;
}

export function inferChangeType(eventType: string, fullPath: string): FileChangeEvent | null {
  switch (eventType) {
    case "change":
      return "modified";
    case "rename":
      return existsSync(fullPath) ? "created" : "deleted";
    default:
      return null;
  }
}

export class FileChangeWatcher {
  private listeners: FileChangeListener[] = [];
  private watchers: FSWatcher[] = [];

  public registerListener(listener: FileChangeListener): void {
    this.listeners.push(listener);
  }

  public unregisterListener(listener: FileChangeListener): void {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  public startWatching(options: WatchOptions): void {
    const { directory, ignorePatterns = [], recursive = true } = options;

    if (!existsSync(directory)) {
      console.warn(`[FileChangeWatcher] Directory does not exist: ${directory}`);
      return;
    }

    // On non-Windows platforms, `recursive: true` is basically not supported with fs.watch. 
    // For real cross-platform watchers, consider chokidar or Bun.watch
    const watcher = watch(directory, { recursive }, (eventType, filename) => {
      if (!filename) return;
      const fullPath = `${directory}/${filename}`;
      if (isIgnored(fullPath, ignorePatterns)) {
        return;
      }
      const changeType = inferChangeType(eventType, fullPath);
      if (!changeType) return;

      for (const listener of this.listeners) {
        listener.onFileChanged(changeType, fullPath);
      }
    });

    watcher.on("error", (error) => {
      console.error(`[FileChangeWatcher] Error watching ${directory}:`, error);
      if (error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.warn(`[FileChangeWatcher] Directory disappeared: ${directory}. Stopping watcher.`);
        watcher.close();
      }
    });

    this.watchers.push(watcher);
    console.log(`[FileChangeWatcher] Now watching: ${directory}`);
  }

  public stopAll(): void {
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];
  }
}