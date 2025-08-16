import {
  type ProjectFile,
  type FileSummaryStatus,
  type SummaryStatus,
  type SummaryProgress,
  type FileSummarizationStats,
  SummaryStatusEnum
} from '@promptliano/schemas'
import { ApiError } from '@promptliano/shared'
import { getProjectFiles } from './project-service'
import { logger } from './utils/logger'
import { getFileImportance } from './utils/file-importance-scorer'

export interface TrackerOptions {
  staleThresholdMs?: number
  includeSkipped?: boolean
  includeEmpty?: boolean
}

export class FileSummarizationTracker {
  private readonly DEFAULT_STALE_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
  private progressMap = new Map<string, SummaryProgress>()
  private fileStatusMap = new Map<string, Map<number, FileSummaryStatus>>()

  /**
   * Get all files that haven't been summarized yet
   */
  async getUnsummarizedFiles(projectId: number, options: TrackerOptions = {}): Promise<ProjectFile[]> {
    const { includeSkipped = false, includeEmpty = false } = options

    try {
      const allFiles = await getProjectFiles(projectId)
      if (!allFiles || allFiles.length === 0) return []

      const statusMap = this.fileStatusMap.get(`project-${projectId}`) || new Map()

      return allFiles.filter((file) => {
        // Check temporary status
        const status = statusMap.get(file.id)
        if (status) {
          if (status.status === 'completed') return false
          if (status.status === 'skipped' && !includeSkipped) return false
          if (status.status === 'failed' && status.retryCount >= 3) return false
        }

        // Check if file has never been summarized
        if (!file.summary || !file.summaryLastUpdated) {
          // Skip empty files unless requested
          if (!file.content && !includeEmpty) return false
          return true
        }

        return false
      })
    } catch (error) {
      logger.error(`Failed to get unsummarized files for project ${projectId}`, error)
      throw new ApiError(
        500,
        `Failed to get unsummarized files: ${error instanceof Error ? error.message : String(error)}`,
        'GET_UNSUMMARIZED_FILES_FAILED'
      )
    }
  }

  /**
   * Get files with stale summaries that need updating
   */
  async getStaleFiles(projectId: number, maxAgeMs?: number): Promise<ProjectFile[]> {
    const threshold = maxAgeMs || this.DEFAULT_STALE_THRESHOLD_MS
    const cutoffTime = Date.now() - threshold

    try {
      const allFiles = await getProjectFiles(projectId)
      if (!allFiles || allFiles.length === 0) return []

      return allFiles.filter((file) => {
        // Must have a summary to be considered stale
        if (!file.summary || !file.summaryLastUpdated) return false

        // Check if summary is older than threshold
        if (file.summaryLastUpdated < cutoffTime) return true

        // Check if file was modified after summary
        if (file.updated && file.updated > file.summaryLastUpdated) return true

        return false
      })
    } catch (error) {
      logger.error(`Failed to get stale files for project ${projectId}`, error)
      throw new ApiError(
        500,
        `Failed to get stale files: ${error instanceof Error ? error.message : String(error)}`,
        'GET_STALE_FILES_FAILED'
      )
    }
  }

  /**
   * Update summarization status for multiple files
   */
  updateSummarizationStatus(
    projectId: number,
    fileStatuses: Array<{ fileId: number; status: SummaryStatus; error?: string }>
  ): void {
    const key = `project-${projectId}`
    let statusMap = this.fileStatusMap.get(key)
    if (!statusMap) {
      statusMap = new Map()
      this.fileStatusMap.set(key, statusMap)
    }

    const now = Date.now()

    for (const { fileId, status, error } of fileStatuses) {
      const existing = statusMap.get(fileId) || {
        fileId,
        status: 'pending',
        retryCount: 0
      }

      const updated: FileSummaryStatus = {
        ...existing,
        status,
        lastAttempt: now
      }

      if (status === 'failed') {
        updated.errorMessage = error
        updated.retryCount = existing.retryCount + 1
      } else if (status === 'completed') {
        // Clear error state on success
        updated.errorMessage = undefined
        updated.retryCount = 0
      }

      statusMap.set(fileId, updated)
    }
  }

  /**
   * Get current summarization progress for a project
   */
  getSummarizationProgress(projectId: number): SummaryProgress | null {
    // Try to get active progress
    for (const [key, progress] of this.progressMap) {
      if (progress.projectId === projectId && progress.status === 'processing') {
        return progress
      }
    }

    // Return most recent completed progress
    let latestProgress: SummaryProgress | null = null
    for (const [key, progress] of this.progressMap) {
      if (progress.projectId === projectId) {
        if (!latestProgress || progress.startTime > latestProgress.startTime) {
          latestProgress = progress
        }
      }
    }

    return latestProgress
  }

  /**
   * Start tracking a new batch summarization
   */
  startBatchTracking(projectId: number, batchId: string, totalFiles: number, totalGroups: number): SummaryProgress {
    const progress: SummaryProgress = {
      projectId,
      batchId,
      status: 'initializing',
      totalFiles,
      processedFiles: 0,
      failedFiles: 0,
      skippedFiles: 0,
      totalGroups,
      processedGroups: 0,
      startTime: Date.now(),
      estimatedTokensUsed: 0
    }

    this.progressMap.set(batchId, progress)

    return progress
  }

  /**
   * Update batch progress
   */
  updateBatchProgress(batchId: string, updates: Partial<SummaryProgress>): SummaryProgress | null {
    const progress = this.progressMap.get(batchId)
    if (!progress) return null

    const updatedProgress = { ...progress, ...updates }
    this.progressMap.set(batchId, updatedProgress)

    return updatedProgress
  }

  /**
   * Complete batch tracking
   */
  completeBatchTracking(batchId: string, status: 'completed' | 'failed' | 'cancelled'): void {
    const progress = this.progressMap.get(batchId)
    if (!progress) return

    this.updateBatchProgress(batchId, {
      status,
      endTime: Date.now()
    })

    // Clean up old progress entries (keep last 10)
    if (this.progressMap.size > 10) {
      const entries = Array.from(this.progressMap.entries()).sort(
        (a, b) => (b[1].startTime || 0) - (a[1].startTime || 0)
      )

      // Keep only the 10 most recent
      this.progressMap.clear()
      entries.slice(0, 10).forEach(([key, value]) => {
        this.progressMap.set(key, value)
      })
    }
  }

  /**
   * Get summarization statistics for a project
   */
  async getSummarizationStats(projectId: number): Promise<FileSummarizationStats> {
    try {
      const allFiles = await getProjectFiles(projectId)
      if (!allFiles || allFiles.length === 0) {
        return {
          projectId,
          totalFiles: 0,
          summarizedFiles: 0,
          unsummarizedFiles: 0,
          staleFiles: 0,
          failedFiles: 0,
          averageTokensPerFile: 0,
          filesByStatus: {
            pending: 0,
            in_progress: 0,
            completed: 0,
            failed: 0,
            skipped: 0
          }
        }
      }

      const statusMap = this.fileStatusMap.get(`project-${projectId}`) || new Map()
      const staleThreshold = Date.now() - this.DEFAULT_STALE_THRESHOLD_MS

      let summarizedCount = 0
      let unsummarizedCount = 0
      let staleCount = 0
      let failedCount = 0
      let totalTokens = 0
      const statusCounts: Record<SummaryStatus, number> = {
        pending: 0,
        in_progress: 0,
        completed: 0,
        failed: 0,
        skipped: 0
      }

      for (const file of allFiles) {
        const status = statusMap.get(file.id)

        if (file.summary && file.summaryLastUpdated) {
          summarizedCount++

          // Estimate tokens from summary length
          totalTokens += Math.ceil(file.summary.length / 4)

          // Check if stale
          if (file.summaryLastUpdated < staleThreshold || (file.updated && file.updated > file.summaryLastUpdated)) {
            staleCount++
          }

          const key = status?.status || 'completed'
          if (key in statusCounts) {
            statusCounts[key as keyof typeof statusCounts]++
          }
        } else {
          unsummarizedCount++

          if (status?.status === 'failed') {
            failedCount++
          }

          const key2 = status?.status || 'pending'
          if (key2 in statusCounts) {
            statusCounts[key2 as keyof typeof statusCounts]++
          }
        }
      }

      // Get last batch run time
      let lastBatchRun: number | undefined
      for (const progress of this.progressMap.values()) {
        if (progress.projectId === projectId && progress.endTime) {
          if (!lastBatchRun || progress.endTime > lastBatchRun) {
            lastBatchRun = progress.endTime
          }
        }
      }

      return {
        projectId,
        totalFiles: allFiles.length,
        summarizedFiles: summarizedCount,
        unsummarizedFiles: unsummarizedCount,
        staleFiles: staleCount,
        failedFiles: failedCount,
        averageTokensPerFile: summarizedCount > 0 ? Math.round(totalTokens / summarizedCount) : 0,
        lastBatchRun,
        filesByStatus: statusCounts
      }
    } catch (error) {
      logger.error(`Failed to get summarization stats for project ${projectId}`, error)
      throw new ApiError(
        500,
        `Failed to get summarization stats: ${error instanceof Error ? error.message : String(error)}`,
        'GET_SUMMARIZATION_STATS_FAILED'
      )
    }
  }

  /**
   * Clear status tracking for a project
   */
  clearProjectStatus(projectId: number): void {
    const key = `project-${projectId}`
    this.fileStatusMap.delete(key)

    // Also clear related progress entries
    for (const [batchId, progress] of this.progressMap) {
      if (progress.projectId === projectId) {
        this.progressMap.delete(batchId)
      }
    }
  }

  /**
   * Get all active batch operations
   */
  getActiveBatches(): Array<{ batchId: string; progress: SummaryProgress }> {
    const active: Array<{ batchId: string; progress: SummaryProgress }> = []

    for (const [batchId, progress] of this.progressMap) {
      if (progress.status === 'initializing' || progress.status === 'grouping' || progress.status === 'processing') {
        active.push({ batchId, progress })
      }
    }

    return active
  }

  /**
   * Get unsummarized files sorted by importance score
   * Returns top N files ranked by importance for efficient summarization
   */
  async getUnsummarizedFilesWithImportance(
    projectId: number,
    topN: number = 20,
    options: TrackerOptions = {}
  ): Promise<Array<{ file: ProjectFile; score: number }>> {
    try {
      // Get all unsummarized files
      const unsummarizedFiles = await this.getUnsummarizedFiles(projectId, options)

      if (unsummarizedFiles.length === 0) {
        return []
      }

      // Calculate importance scores for each file
      const filesWithScores = unsummarizedFiles.map((file) => {
        const importance = getFileImportance(file)
        return {
          file,
          score: importance.score
        }
      })

      // Sort by importance score (descending) and take top N
      filesWithScores.sort((a, b) => b.score - a.score)

      return filesWithScores.slice(0, topN)
    } catch (error) {
      logger.error(`Failed to get unsummarized files with importance for project ${projectId}`, error)
      throw new ApiError(
        500,
        `Failed to get unsummarized files with importance: ${error instanceof Error ? error.message : String(error)}`,
        'GET_UNSUMMARIZED_WITH_IMPORTANCE_FAILED'
      )
    }
  }

  /**
   * Cancel a batch operation
   */
  cancelBatch(batchId: string): boolean {
    const progress = this.progressMap.get(batchId)
    if (!progress) return false

    if (progress.status === 'initializing' || progress.status === 'grouping' || progress.status === 'processing') {
      this.completeBatchTracking(batchId, 'cancelled')
      return true
    }

    return false
  }
}

// Export singleton instance
export const fileSummarizationTracker = new FileSummarizationTracker()
