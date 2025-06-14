import { type ProjectFile } from '@octoprompt/schemas'
import { syncProject, type FileChangeEvent, type FileChangeListener } from '../file-services/file-sync-service-unified'
import { getProject } from '../project-service'

export interface FileChangeRecord {
  sessionId: string
  timestamp: number
  event: FileChangeEvent
  filePath: string
  projectId: number
}

export class ClaudeCodeFileTracker implements FileChangeListener {
  private changeHistory: Map<string, FileChangeRecord[]> = new Map()
  private activeWatchers: Map<number, () => void> = new Map()

  /**
   * Start tracking file changes for a Claude Code session
   */
  async startTracking(sessionId: string, projectId: number): Promise<void> {
    if (!this.changeHistory.has(sessionId)) {
      this.changeHistory.set(sessionId, [])
    }

    // Don't create duplicate watchers for the same project
    if (this.activeWatchers.has(projectId)) {
      return
    }

    try {
      const project = await getProject(projectId)
      if (!project) {
        throw new Error(`Project ${projectId} not found`)
      }

      // The file sync service already has watchers running
      // We just need to ensure it's syncing this project
      await syncProject(project)

      // Mark this project as being watched
      this.activeWatchers.set(projectId, () => {
        // Cleanup function - currently no-op since file sync service handles cleanup
      })

      console.log(`[ClaudeCodeFileTracker] Started tracking project ${projectId} for session ${sessionId}`)
    } catch (error) {
      console.error(`[ClaudeCodeFileTracker] Failed to start tracking:`, error)
      throw error
    }
  }

  /**
   * Stop tracking file changes for a project
   */
  stopTracking(projectId: number): void {
    const cleanup = this.activeWatchers.get(projectId)
    if (cleanup) {
      cleanup()
      this.activeWatchers.delete(projectId)
      console.log(`[ClaudeCodeFileTracker] Stopped tracking project ${projectId}`)
    }
  }

  /**
   * Handle file change events
   */
  async onFileChanged(event: FileChangeEvent, filePath: string): Promise<void> {
    // Find which project this file belongs to
    for (const [projectId] of this.activeWatchers) {
      // Find sessions tracking this project
      for (const [sessionId, records] of this.changeHistory) {
        const projectRecords = records.filter((r) => r.projectId === projectId)
        if (projectRecords.length > 0 || this.activeWatchers.has(projectId)) {
          // Record the change
          const record: FileChangeRecord = {
            sessionId,
            timestamp: Date.now(),
            event,
            filePath,
            projectId
          }

          const sessionRecords = this.changeHistory.get(sessionId) || []
          sessionRecords.push(record)
          this.changeHistory.set(sessionId, sessionRecords)

          console.log(`[ClaudeCodeFileTracker] Recorded ${event} for ${filePath} in session ${sessionId}`)
        }
      }
    }
  }

  /**
   * Get all file changes for a session
   */
  getSessionChanges(sessionId: string): FileChangeRecord[] {
    return this.changeHistory.get(sessionId) || []
  }

  /**
   * Get file changes for a session within a time range
   */
  getSessionChangesInRange(sessionId: string, startTime: number, endTime: number): FileChangeRecord[] {
    const changes = this.getSessionChanges(sessionId)
    return changes.filter((c) => c.timestamp >= startTime && c.timestamp <= endTime)
  }

  /**
   * Clear change history for a session
   */
  clearSessionHistory(sessionId: string): void {
    this.changeHistory.delete(sessionId)
  }

  /**
   * Get a summary of changes by file
   */
  getChangesSummary(sessionId: string): Map<string, FileChangeEvent[]> {
    const changes = this.getSessionChanges(sessionId)
    const summary = new Map<string, FileChangeEvent[]>()

    for (const change of changes) {
      const events = summary.get(change.filePath) || []
      events.push(change.event)
      summary.set(change.filePath, events)
    }

    return summary
  }

  /**
   * Export change history for persistence
   */
  exportHistory(): { sessionId: string; changes: FileChangeRecord[] }[] {
    const result: { sessionId: string; changes: FileChangeRecord[] }[] = []

    for (const [sessionId, changes] of this.changeHistory) {
      result.push({ sessionId, changes })
    }

    return result
  }

  /**
   * Import change history from persistence
   */
  importHistory(data: { sessionId: string; changes: FileChangeRecord[] }[]): void {
    for (const { sessionId, changes } of data) {
      this.changeHistory.set(sessionId, changes)
    }
  }
}

// Create a singleton instance
export const claudeCodeFileTracker = new ClaudeCodeFileTracker()
