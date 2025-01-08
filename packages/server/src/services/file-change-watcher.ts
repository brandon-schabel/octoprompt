// file-change-watcher.ts
import { watch, FSWatcher } from "fs";

export type FileChangeEvent = 'created' | 'modified' | 'deleted';

export interface FileChangeListener {
  onFileChanged(event: FileChangeEvent, filePath: string): Promise<void> | void;
}

interface WatchOptions {
  directory: string;
  ignorePatterns?: string[];
  recursive?: boolean;
}

/**
 * A cross-platform file-change watcher using Node's fs.watch
 */
export class FileChangeWatcher {
  private listeners: FileChangeListener[] = [];
  private watchers: FSWatcher[] = [];

  public registerListener(listener: FileChangeListener): void {
    this.listeners.push(listener);
  }

  public unregisterListener(listener: FileChangeListener): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  public startWatching(options: WatchOptions): void {
    const { directory, ignorePatterns = [], recursive = true } = options;

    const watcher = watch(
      directory,
      { recursive },
      (eventType, filename) => {
        if (!filename) return;

        const normalizedPath = `${directory}/${filename}`;
        if (this.isIgnored(normalizedPath, ignorePatterns)) {
          return;
        }

        const changeType = this.inferChangeType(eventType);
        if (changeType) {
          for (const listener of this.listeners) {
            listener.onFileChanged(changeType, normalizedPath);
          }
        }
      }
    );

    // Handle watcher errors
    watcher.on('error', (error) => {
      console.error(`[FileChangeWatcher] Error watching ${directory}:`, error);
    });

    this.watchers.push(watcher);
    console.log(`[FileChangeWatcher] Now watching: ${directory}`);

    // Setup cleanup on process exit
    process.on('SIGINT', () => this.stopAll());
    process.on('SIGTERM', () => this.stopAll());
  }

  public stopAll(): void {
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];
  }

  private isIgnored(filePath: string, ignorePatterns: string[]): boolean {
    for (const pattern of ignorePatterns) {
      if (filePath.includes(pattern.replace('*', ''))) {
        return true;
      }
    }
    return false;
  }

  private inferChangeType(eventType: string): FileChangeEvent | null {
    switch (eventType) {
      case 'change':
        return 'modified';
      case 'rename':
        // Note: fs.watch treats both creation and deletion as 'rename' events
        // You might need additional logic here if you need to distinguish between created/deleted
        return 'created';
      default:
        return null;
    }
  }
}