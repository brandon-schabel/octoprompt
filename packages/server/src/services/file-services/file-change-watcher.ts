import { watch, FSWatcher } from "fs";

export type FileChangeEvent = 'created' | 'modified' | 'deleted';

export interface FileChangeListener {
  onFileChanged(event: FileChangeEvent, filePath: string): Promise<void> | void;
}

export interface WatchOptions {
  directory: string;
  ignorePatterns?: string[];
  recursive?: boolean;
}

/**
 * A cross-platform file-change watcher using Node's fs.watch.
 * Provides a pluggable listener mechanism for reacting to file changes.
 */
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

    const watcher = watch(
      directory,
      { recursive },
      (eventType, filename) => {
        if (!filename) return;

        const normalizedPath = `${directory}/${filename}`;

        if (isIgnored(normalizedPath, ignorePatterns)) {
          return;
        }

        const changeType = inferChangeType(eventType);
        if (changeType) {
          for (const listener of this.listeners) {
            listener.onFileChanged(changeType, normalizedPath);
          }
        }
      }
    );

    watcher.on('error', (error) => {
      console.error(`[FileChangeWatcher] Error watching ${directory}:`, error);
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

/**
 * Checks if a file path matches any ignore patterns.
 */
export function isIgnored(filePath: string, ignorePatterns: string[]): boolean {
  for (const pattern of ignorePatterns) {
    if (filePath.includes(pattern.replace('*', ''))) {
      return true;
    }
  }
  return false;
}

/**
 * Infers the type of file change based on fs.watch event type.
 */
export function inferChangeType(eventType: string): FileChangeEvent | null {
  switch (eventType) {
    case 'change':
      return 'modified';
    case 'rename':
      // fs.watch treats creation & deletion as 'rename'.
      // Additional logic may be needed to distinguish those events in some environments.
      return 'created';
    default:
      return null;
  }
}