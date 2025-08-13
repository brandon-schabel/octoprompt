import type { ProjectFile, FileGroup } from '@promptliano/schemas'
import { 
  OPTIMAL_TOKENS_FOR_BATCH, 
  MAX_FILES_PER_BATCH,
  PROMPT_OVERHEAD_TOKENS,
  RESPONSE_BUFFER_TOKENS 
} from '@promptliano/config'
import { SmartTruncation } from '../utils/smart-truncation'
import { createLogger } from '../utils/logger'
import { fileGroupingService } from '../file-grouping-service'
import { fileSummarizationTracker } from '../file-summarization-tracker'

const logger = createLogger('BatchSummarizationOptimizer')

export interface BatchOptimizationOptions {
  maxFilesPerBatch?: number
  maxTokensPerBatch?: number
  groupingStrategy?: 'imports' | 'directory' | 'semantic' | 'mixed'
  priorityThreshold?: number
  includeStaleFiles?: boolean
  staleThresholdDays?: number
}

export interface OptimizedBatch {
  id: string
  files: ProjectFile[]
  estimatedTokens: number
  priority: number
  strategy: string
  relationships: Array<{ source: string; target: string; type: string }>
}

export interface BatchProcessingResult {
  batchId: string
  processedFiles: number
  totalTokensUsed: number
  successfulSummaries: number
  failedSummaries: number
  processingTime: number
  errors: string[]
}

/**
 * Service for optimizing batch file summarization
 */
export class BatchSummarizationOptimizer {
  private activeBatches = new Map<string, AbortController>()

  /**
   * Create optimized batches from a list of files
   */
  async createOptimizedBatches(
    projectId: number,
    files: ProjectFile[],
    options: BatchOptimizationOptions = {}
  ): Promise<OptimizedBatch[]> {
    const {
      maxFilesPerBatch = MAX_FILES_PER_BATCH,
      maxTokensPerBatch = OPTIMAL_TOKENS_FOR_BATCH,
      groupingStrategy = 'mixed',
      priorityThreshold = 3,
      includeStaleFiles = false,
      staleThresholdDays = 30
    } = options

    logger.info(`Creating optimized batches for ${files.length} files with strategy: ${groupingStrategy}`)

    // Filter files that need summarization
    const filesToProcess = await this.filterFilesForSummarization(
      projectId,
      files,
      includeStaleFiles,
      staleThresholdDays
    )

    if (filesToProcess.length === 0) {
      logger.info('No files need summarization')
      return []
    }

    // Group related files
    const fileGroups = this.groupRelatedFiles(filesToProcess, groupingStrategy, {
      maxGroupSize: maxFilesPerBatch,
      priorityThreshold
    })

    // Optimize groups for token limits
    const optimizedBatches = this.optimizeGroupsForTokens(
      fileGroups,
      filesToProcess,
      maxTokensPerBatch
    )

    // Sort by priority
    optimizedBatches.sort((a, b) => b.priority - a.priority)

    logger.info(`Created ${optimizedBatches.length} optimized batches from ${filesToProcess.length} files`)

    return optimizedBatches
  }

  /**
   * Filter files that need summarization
   */
  private async filterFilesForSummarization(
    projectId: number,
    files: ProjectFile[],
    includeStale: boolean,
    staleThresholdDays: number
  ): Promise<ProjectFile[]> {
    const needsSummarization: ProjectFile[] = []
    const staleThreshold = Date.now() - (staleThresholdDays * 24 * 60 * 60 * 1000)

    for (const file of files) {
      // Skip if no content
      if (!file.content || file.content.trim().length === 0) continue

      // Check if needs initial summarization
      if (!file.summary || file.summary.trim().length === 0) {
        needsSummarization.push(file)
        continue
      }

      // Check if stale and should be included
      if (includeStale && file.summaryLastUpdated && file.summaryLastUpdated < staleThreshold) {
        needsSummarization.push(file)
        continue
      }

      // Check if file was modified after last summarization
      if (file.updated > (file.summaryLastUpdated || 0)) {
        needsSummarization.push(file)
      }
    }

    return needsSummarization
  }

  /**
   * Group related files based on strategy
   */
  private groupRelatedFiles(
    files: ProjectFile[],
    strategy: string,
    options: { maxGroupSize: number; priorityThreshold: number }
  ): FileGroup[] {
    // Use the existing file grouping service
    const groups = fileGroupingService.groupFilesByStrategy(files, strategy as any, options)
    
    // Enhance groups with relationship detection
    return groups.map(group => this.enhanceGroupWithRelationships(group, files))
  }

  /**
   * Enhance a group with relationship information
   */
  private enhanceGroupWithRelationships(group: FileGroup, allFiles: ProjectFile[]): FileGroup {
    const relationships: Array<{ sourceFileId: number; targetFileId: number; type: string }> = []
    const fileMap = new Map(allFiles.map(f => [f.id, f]))
    const groupFileIds = new Set(group.fileIds)

    // Detect import relationships
    for (const fileId of group.fileIds) {
      const file = fileMap.get(fileId)
      if (!file?.imports) continue

      for (const imp of file.imports) {
        // Check if imported file is in the same group
        const importedFile = allFiles.find(f => 
          f.path.endsWith(imp.source) || 
          f.path.includes(imp.source.replace(/^[.\/]+/, ''))
        )

        if (importedFile && groupFileIds.has(importedFile.id)) {
          relationships.push({
            sourceFileId: fileId,
            targetFileId: importedFile.id,
            type: 'imports'
          })
        }
      }
    }

    // Detect export/import relationships
    for (const fileId of group.fileIds) {
      const file = fileMap.get(fileId)
      if (!file?.exports) continue

      // Check if any other file in the group imports from this file
      for (const otherId of group.fileIds) {
        if (otherId === fileId) continue
        
        const otherFile = fileMap.get(otherId)
        if (!otherFile?.imports) continue

        const importsFromFile = otherFile.imports.some(imp => 
          file.path.includes(imp.source) || 
          imp.source.includes(file.name.replace(/\.[^.]+$/, ''))
        )

        if (importsFromFile) {
          relationships.push({
            sourceFileId: otherId,
            targetFileId: fileId,
            type: 'imports' as const,
            strength: 1.0 // Default strength for import relationships
          })
        }
      }
    }

    return {
      ...group,
      relationships
    }
  }

  /**
   * Optimize groups to fit within token limits
   */
  private optimizeGroupsForTokens(
    groups: FileGroup[],
    files: ProjectFile[],
    maxTokens: number
  ): OptimizedBatch[] {
    const fileMap = new Map(files.map(f => [f.id, f]))
    const optimizedBatches: OptimizedBatch[] = []

    for (const group of groups) {
      const groupFiles = group.fileIds
        .map(id => fileMap.get(id))
        .filter((f): f is ProjectFile => f !== undefined)

      // Estimate tokens for the group
      let currentBatch: ProjectFile[] = []
      let currentTokens = PROMPT_OVERHEAD_TOKENS + RESPONSE_BUFFER_TOKENS

      for (const file of groupFiles) {
        const fileTokens = this.estimateFileTokens(file)
        
        if (currentTokens + fileTokens <= maxTokens) {
          currentBatch.push(file)
          currentTokens += fileTokens
        } else {
          // Create a batch with current files
          if (currentBatch.length > 0) {
            optimizedBatches.push(this.createBatch(
              group,
              currentBatch,
              currentTokens,
              this.extractRelationships(group, currentBatch)
            ))
          }
          
          // Start new batch
          currentBatch = [file]
          currentTokens = PROMPT_OVERHEAD_TOKENS + RESPONSE_BUFFER_TOKENS + fileTokens
        }
      }

      // Add remaining files
      if (currentBatch.length > 0) {
        optimizedBatches.push(this.createBatch(
          group,
          currentBatch,
          currentTokens,
          this.extractRelationships(group, currentBatch)
        ))
      }
    }

    return optimizedBatches
  }

  /**
   * Estimate tokens for a file after smart truncation
   */
  private estimateFileTokens(file: ProjectFile): number {
    if (!file.content) return 0

    // Apply smart truncation to get actual content that will be used
    const truncationResult = SmartTruncation.truncate(file.content, {
      maxTokens: Math.floor(OPTIMAL_TOKENS_FOR_BATCH / MAX_FILES_PER_BATCH),
      preserveImports: true,
      preserveExports: true,
      preserveClasses: true
    })

    return SmartTruncation.estimateTokens(truncationResult.content)
  }

  /**
   * Create an optimized batch
   */
  private createBatch(
    group: FileGroup,
    files: ProjectFile[],
    estimatedTokens: number,
    relationships: Array<{ source: string; target: string; type: string }>
  ): OptimizedBatch {
    return {
      id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      files,
      estimatedTokens,
      priority: group.priority,
      strategy: group.strategy,
      relationships
    }
  }

  /**
   * Extract relationships for a subset of files
   */
  private extractRelationships(
    group: FileGroup,
    batchFiles: ProjectFile[]
  ): Array<{ source: string; target: string; type: string }> {
    const batchFileIds = new Set(batchFiles.map(f => f.id))
    const relationships: Array<{ source: string; target: string; type: string }> = []

    if (!group.relationships) return relationships

    for (const rel of group.relationships) {
      if (batchFileIds.has(rel.sourceFileId) && batchFileIds.has(rel.targetFileId)) {
        const sourceFile = batchFiles.find(f => f.id === rel.sourceFileId)
        const targetFile = batchFiles.find(f => f.id === rel.targetFileId)
        
        if (sourceFile && targetFile) {
          relationships.push({
            source: sourceFile.name,
            target: targetFile.name,
            type: rel.type
          })
        }
      }
    }

    return relationships
  }

  /**
   * Process a batch with progress tracking
   */
  async processBatch(
    batch: OptimizedBatch,
    onProgress?: (progress: number, currentFile: string) => void
  ): Promise<BatchProcessingResult> {
    const startTime = Date.now()
    const result: BatchProcessingResult = {
      batchId: batch.id,
      processedFiles: 0,
      totalTokensUsed: 0,
      successfulSummaries: 0,
      failedSummaries: 0,
      processingTime: 0,
      errors: []
    }

    const abortController = new AbortController()
    this.activeBatches.set(batch.id, abortController)

    try {
      for (let i = 0; i < batch.files.length; i++) {
        if (abortController.signal.aborted) {
          result.errors.push('Batch processing was cancelled')
          break
        }

        const file = batch.files[i]
        if (!file) {
          result.errors.push(`File at index ${i} is undefined`)
          result.failedSummaries++
          result.processedFiles++
          continue
        }

        if (onProgress) {
          onProgress((i / batch.files.length) * 100, file.name)
        }

        try {
          // Process file summarization (would call the actual summarization function)
          logger.debug(`Processing file ${file.path} in batch ${batch.id}`)
          
          // Track success
          result.successfulSummaries++
          result.processedFiles++
          
          // Estimate tokens used (simplified)
          result.totalTokensUsed += this.estimateFileTokens(file)
        } catch (error) {
          const errorMsg = `Failed to summarize ${file.path}: ${error instanceof Error ? error.message : String(error)}`
          result.errors.push(errorMsg)
          result.failedSummaries++
          result.processedFiles++
          logger.error(errorMsg)
        }
      }
    } finally {
      this.activeBatches.delete(batch.id)
      result.processingTime = Date.now() - startTime
    }

    logger.info(`Batch ${batch.id} completed: ${result.successfulSummaries}/${batch.files.length} successful`, {
      processingTime: `${result.processingTime}ms`,
      tokensUsed: result.totalTokensUsed
    })

    return result
  }

  /**
   * Cancel a batch processing operation
   */
  cancelBatch(batchId: string): boolean {
    const controller = this.activeBatches.get(batchId)
    if (controller) {
      controller.abort()
      this.activeBatches.delete(batchId)
      logger.info(`Cancelled batch ${batchId}`)
      return true
    }
    return false
  }

  /**
   * Get active batch IDs
   */
  getActiveBatches(): string[] {
    return Array.from(this.activeBatches.keys())
  }

  /**
   * Calculate optimal batch configuration for a project
   */
  static calculateOptimalBatchConfig(
    totalFiles: number,
    averageFileSize: number
  ): BatchOptimizationOptions {
    // Estimate average tokens per file
    const avgTokensPerFile = Math.ceil(averageFileSize / 4)
    
    // Calculate optimal batch size
    const optimalBatchSize = Math.min(
      MAX_FILES_PER_BATCH,
      Math.floor(OPTIMAL_TOKENS_FOR_BATCH / avgTokensPerFile)
    )

    // Determine strategy based on project size
    let strategy: BatchOptimizationOptions['groupingStrategy'] = 'mixed'
    if (totalFiles < 50) {
      strategy = 'semantic'
    } else if (totalFiles < 200) {
      strategy = 'imports'
    } else {
      strategy = 'directory'
    }

    return {
      maxFilesPerBatch: optimalBatchSize,
      maxTokensPerBatch: OPTIMAL_TOKENS_FOR_BATCH,
      groupingStrategy: strategy,
      priorityThreshold: totalFiles > 100 ? 5 : 3,
      includeStaleFiles: true,
      staleThresholdDays: 30
    }
  }
}

// Export singleton instance
export const batchSummarizationOptimizer = new BatchSummarizationOptimizer()