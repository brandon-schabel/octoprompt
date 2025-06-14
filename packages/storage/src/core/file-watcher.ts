import { watch, type FSWatcher, existsSync } from 'node:fs'
import { EventEmitter } from 'node:events'
import path from 'node:path'

export interface FileWatcherOptions {
  debounceMs?: number
  persistent?: boolean
}

export class FileWatcher extends EventEmitter {
  private watchers: Map<string, FSWatcher> = new Map()
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map()
  private options: Required<FileWatcherOptions>

  constructor(options: FileWatcherOptions = {}) {
    super()
    this.options = {
      debounceMs: options.debounceMs ?? 100,
      persistent: options.persistent ?? false
    }
  }

  /**
   * Watch a file for changes
   */
  public watchFile(filePath: string): void {
    if (this.watchers.has(filePath)) {
      return // Already watching
    }

    // Check if file exists before watching
    if (!existsSync(filePath)) {
      // File doesn't exist yet, skip watching for now
      return
    }

    try {
      const watcher = watch(filePath, { persistent: this.options.persistent }, (eventType) => {
        if (eventType === 'change') {
          this.handleFileChange(filePath)
        }
      })

      watcher.on('error', (error) => {
        console.warn(`File watcher error for ${filePath}:`, error)
        this.unwatchFile(filePath)
      })

      this.watchers.set(filePath, watcher)
    } catch (error) {
      console.warn(`Failed to watch file ${filePath}:`, error)
    }
  }

  /**
   * Stop watching a file
   */
  public unwatchFile(filePath: string): void {
    const watcher = this.watchers.get(filePath)
    if (watcher) {
      watcher.close()
      this.watchers.delete(filePath)
    }

    // Clear any pending debounce timer
    const timer = this.debounceTimers.get(filePath)
    if (timer) {
      clearTimeout(timer)
      this.debounceTimers.delete(filePath)
    }
  }

  /**
   * Stop watching all files
   */
  public close(): void {
    for (const [filePath] of this.watchers) {
      this.unwatchFile(filePath)
    }
  }

  private handleFileChange(filePath: string): void {
    // Clear existing timer if any
    const existingTimer = this.debounceTimers.get(filePath)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // Set new debounced timer
    const timer = setTimeout(() => {
      this.debounceTimers.delete(filePath)
      this.emit('change', filePath)
    }, this.options.debounceMs)

    this.debounceTimers.set(filePath, timer)
  }
}

// Global file watcher instance
export const globalFileWatcher = new FileWatcher({ persistent: false })
