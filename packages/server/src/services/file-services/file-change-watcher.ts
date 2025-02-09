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
 * For robust cross-platform recursion, consider chokidar or Bun.watch.
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

/**
 * Creates a functional file-change watcher that can manage multiple watchers/listeners.
 */
export function createFileChangeWatcher() {
  const listeners: FileChangeListener[] = [];
  const watchers: FSWatcher[] = [];

  function registerListener(listener: FileChangeListener): void {
    listeners.push(listener);
  }

  function unregisterListener(listener: FileChangeListener): void {
    const idx = listeners.indexOf(listener);
    if (idx !== -1) {
      listeners.splice(idx, 1);
    }
  }

  function startWatching(options: WatchOptions): void {
    const { directory, ignorePatterns = [], recursive = true } = options;

    if (!existsSync(directory)) {
      console.warn(`[FileChangeWatcher] Directory does not exist: ${directory}`);
      return;
    }

    const watcher = watch(directory, { recursive }, (eventType, filename) => {
      if (!filename) return;
      const fullPath = `${directory}/${filename}`;
      if (isIgnored(fullPath, ignorePatterns)) {
        return;
      }
      const changeType = inferChangeType(eventType, fullPath);
      if (!changeType) return;

      for (const listener of listeners) {
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

    watchers.push(watcher);
    console.log(`[FileChangeWatcher] Now watching: ${directory}`);
  }

  function stopAll(): void {
    for (const w of watchers) {
      w.close();
    }
    watchers.length = 0;
  }

  return {
    registerListener,
    unregisterListener,
    startWatching,
    stopAll,
  };
}