import { EventEmitter } from 'events'

export interface SyncProgressEvent {
  phase: 'initializing' | 'scanning' | 'processing' | 'indexing' | 'finalizing' | 'complete' | 'error'
  totalFiles: number
  processedFiles: number
  currentFile?: string
  message: string
  percentage: number
  estimatedTimeRemaining?: number
  speed?: number // files per second
  error?: Error
  sequenceNumber?: number // For ordering events
}

export interface SyncProgressOptions {
  onProgress?: (event: SyncProgressEvent) => void | Promise<void>
  updateInterval?: number // milliseconds between progress updates
}

export class SyncProgressTracker extends EventEmitter {
  private phase: SyncProgressEvent['phase'] = 'initializing'
  private totalFiles = 0
  private processedFiles = 0
  private startTime = Date.now()
  private lastUpdateTime = Date.now()
  private updateInterval: number
  private currentFile?: string
  private filesPerSecond = 0
  private recentProcessingTimes: number[] = []
  private readonly maxRecentSamples = 10
  private progressQueue: SyncProgressEvent[] = []
  private isProcessingQueue = false
  private sequenceNumber = 0

  constructor(private options: SyncProgressOptions = {}) {
    super()
    this.updateInterval = options.updateInterval || 100 // Default 100ms updates
  }

  setPhase(phase: SyncProgressEvent['phase'], message?: string) {
    this.phase = phase
    this.emitProgress(message || this.getDefaultPhaseMessage(phase))
  }

  setTotalFiles(total: number) {
    this.totalFiles = total
    this.emitProgress(`Found ${total} files to process`)
  }

  incrementProcessed(fileName?: string) {
    const now = Date.now()
    const timeSinceLastFile = now - this.lastUpdateTime

    // Track processing speed
    if (this.processedFiles > 0) {
      this.recentProcessingTimes.push(timeSinceLastFile)
      if (this.recentProcessingTimes.length > this.maxRecentSamples) {
        this.recentProcessingTimes.shift()
      }
    }

    this.processedFiles++
    this.currentFile = fileName
    
    // Only emit progress at update interval to avoid overwhelming
    if (now - this.lastUpdateTime >= this.updateInterval || this.processedFiles === this.totalFiles) {
      this.lastUpdateTime = now
      this.calculateSpeed()
      this.emitProgress()
    }
  }

  private calculateSpeed() {
    const elapsedSeconds = (Date.now() - this.startTime) / 1000
    if (elapsedSeconds > 0 && this.processedFiles > 0) {
      this.filesPerSecond = this.processedFiles / elapsedSeconds
    }
  }

  private calculateEstimatedTimeRemaining(): number | undefined {
    if (this.filesPerSecond > 0 && this.totalFiles > 0) {
      const remainingFiles = this.totalFiles - this.processedFiles
      return Math.ceil(remainingFiles / this.filesPerSecond)
    }
    return undefined
  }

  private getDefaultPhaseMessage(phase: SyncProgressEvent['phase']): string {
    switch (phase) {
      case 'initializing':
        return 'Initializing project sync...'
      case 'scanning':
        return 'Scanning project directory...'
      case 'processing':
        return `Processing files...`
      case 'indexing':
        return 'Indexing files for search...'
      case 'finalizing':
        return 'Finalizing sync...'
      case 'complete':
        return 'Sync completed successfully!'
      case 'error':
        return 'Sync encountered an error'
      default:
        return 'Syncing...'
    }
  }

  private emitProgress(message?: string) {
    const percentage = this.totalFiles > 0 
      ? Math.round((this.processedFiles / this.totalFiles) * 100)
      : 0

    const event: SyncProgressEvent = {
      phase: this.phase,
      totalFiles: this.totalFiles,
      processedFiles: this.processedFiles,
      currentFile: this.currentFile,
      message: message || `Processing ${this.processedFiles}/${this.totalFiles} files`,
      percentage,
      estimatedTimeRemaining: this.calculateEstimatedTimeRemaining(),
      speed: this.filesPerSecond,
      sequenceNumber: ++this.sequenceNumber
    }

    // Queue the event instead of emitting immediately
    this.progressQueue.push(event)
    this.processQueue()
  }

  private async processQueue() {
    if (this.isProcessingQueue || this.progressQueue.length === 0) {
      return
    }

    this.isProcessingQueue = true

    try {
      while (this.progressQueue.length > 0) {
        const event = this.progressQueue.shift()!
        
        // Emit to EventEmitter listeners
        this.emit('progress', event)
        
        // Call the progress callback if provided
        if (this.options.onProgress) {
          try {
            await Promise.resolve(this.options.onProgress(event))
          } catch (err) {
            console.error('Error in progress callback:', err)
          }
        }
        
        // Add a small delay between events to prevent overwhelming
        if (this.progressQueue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 10))
        }
      }
    } finally {
      this.isProcessingQueue = false
    }
  }

  complete(message?: string) {
    this.phase = 'complete'
    this.processedFiles = this.totalFiles
    const elapsedSeconds = (Date.now() - this.startTime) / 1000
    const finalMessage = message || `Sync completed! Processed ${this.totalFiles} files in ${elapsedSeconds.toFixed(1)} seconds`
    this.emitProgress(finalMessage)
  }

  error(error: Error) {
    this.phase = 'error'
    const event: SyncProgressEvent = {
      phase: 'error',
      totalFiles: this.totalFiles,
      processedFiles: this.processedFiles,
      message: `Sync failed: ${error.message}`,
      percentage: 0,
      error,
      sequenceNumber: ++this.sequenceNumber
    }
    
    // Queue the error event for ordered processing
    this.progressQueue.push(event)
    this.processQueue()
    
    // Also emit error directly for error handlers
    this.emit('error', error)
  }

  reset() {
    this.phase = 'initializing'
    this.totalFiles = 0
    this.processedFiles = 0
    this.startTime = Date.now()
    this.lastUpdateTime = Date.now()
    this.currentFile = undefined
    this.filesPerSecond = 0
    this.recentProcessingTimes = []
    this.progressQueue = []
    this.isProcessingQueue = false
    this.sequenceNumber = 0
  }
}

// Helper function to create a progress tracker with standard options
export function createSyncProgressTracker(options?: SyncProgressOptions): SyncProgressTracker {
  return new SyncProgressTracker(options)
}