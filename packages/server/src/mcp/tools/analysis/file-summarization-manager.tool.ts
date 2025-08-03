import { z } from '@hono/zod-openapi'
import type { MCPToolDefinition, MCPToolResponse } from '../../tools-registry'
import {
  createTrackedHandler,
  createMCPError,
  MCPError,
  MCPErrorCode,
  formatMCPErrorResponse,
  FileSummarizationManagerAction,
  FileSummarizationManagerSchema
} from '../shared'
import {
  fileSummarizationTracker,
  fileGroupingService,
  enhancedSummarizationService,
  getProjectFiles
} from '@promptliano/services'

export const fileSummarizationManagerTool: MCPToolDefinition = {
  name: 'file_summarization_manager',
  description:
    'Intelligent file summarization with grouping, batch processing, and progress tracking. Actions: identify_unsummarized (find files needing summaries), group_files (group related files by strategy), summarize_batch (batch summarize with token management), get_progress (track batch progress), cancel_batch (cancel ongoing operation), get_summary_stats (get project summarization statistics)',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'The action to perform',
        enum: Object.values(FileSummarizationManagerAction)
      },
      projectId: {
        type: 'number',
        description: 'The project ID (required for all actions)'
      },
      data: {
        type: 'object',
        description:
          'Action-specific data. For identify_unsummarized: { includeStale: true, staleThresholdDays: 30 }. For group_files: { strategy: "imports" | "directory" | "semantic" | "mixed", maxGroupSize: 10, priorityThreshold: 3 }. For summarize_batch: { strategy: "mixed", maxGroupSize: 10, maxTokensPerGroup: 10000, maxConcurrentGroups: 3, includeStaleFiles: true }. For cancel_batch: { batchId: "batch-123-456" }'
      }
    },
    required: ['action', 'projectId']
  },
  handler: createTrackedHandler(
    'file_summarization_manager',
    async (args: z.infer<typeof FileSummarizationManagerSchema>): Promise<MCPToolResponse> => {
      try {
        const { action, projectId, data } = args

        switch (action) {
          case FileSummarizationManagerAction.IDENTIFY_UNSUMMARIZED: {
            const options = data || {}
            const unsummarizedFiles = await fileSummarizationTracker.getUnsummarizedFiles(projectId, {
              includeSkipped: options.includeSkipped || false,
              includeEmpty: false
            })

            const staleFiles = options.includeStale
              ? await fileSummarizationTracker.getStaleFiles(
                  projectId,
                  (options.staleThresholdDays || 30) * 24 * 60 * 60 * 1000
                )
              : []

            // Combine and deduplicate
            const fileMap = new Map()
            const allFiles = [...unsummarizedFiles, ...staleFiles]
            allFiles.forEach((f) => fileMap.set(f.id, f))
            const totalFiles = fileMap.size

            return {
              content: [
                {
                  type: 'text',
                  text:
                    `Found ${totalFiles} files needing summarization:\n` +
                    `- Unsummarized: ${unsummarizedFiles.length}\n` +
                    `- Stale: ${staleFiles.length}\n\n` +
                    `Files:\n${Array.from(fileMap.values())
                      .slice(0, 20)
                      .map((f) => `- ${f.path} (${f.size ? `${(f.size / 1024).toFixed(1)}KB` : 'unknown size'})`)
                      .join('\n')}${totalFiles > 20 ? `\n... and ${totalFiles - 20} more` : ''}`
                }
              ]
            }
          }

          case FileSummarizationManagerAction.GROUP_FILES: {
            const options = data || {}
            const files = await getProjectFiles(projectId)
            if (!files || files.length === 0) {
              return {
                content: [{ type: 'text', text: 'No files found in project' }]
              }
            }

            const groups = fileGroupingService.groupFilesByStrategy(files, options.strategy || 'mixed', {
              maxGroupSize: options.maxGroupSize || 10,
              priorityThreshold: options.priorityThreshold || 3
            })

            return {
              content: [
                {
                  type: 'text',
                  text:
                    `Created ${groups.length} file groups using ${options.strategy || 'mixed'} strategy:\n\n` +
                    groups
                      .slice(0, 10)
                      .map(
                        (g) =>
                          `Group: ${g.name}\n` +
                          `- Files: ${g.fileIds.length}\n` +
                          `- Priority: ${g.priority.toFixed(2)}\n` +
                          `- Estimated tokens: ${g.estimatedTokens || 'unknown'}\n`
                      )
                      .join('\n') +
                    (groups.length > 10 ? `\n... and ${groups.length - 10} more groups` : '')
                }
              ]
            }
          }

          case FileSummarizationManagerAction.SUMMARIZE_BATCH: {
            const options = data || {}
            const batchOptions = {
              strategy: options.strategy || 'mixed',
              maxGroupSize: options.maxGroupSize || 10,
              maxTokensPerGroup: options.maxTokensPerGroup || 10000,
              maxConcurrentGroups: options.maxConcurrentGroups || 3,
              priorityThreshold: options.priorityThreshold || 3,
              includeStaleFiles: options.includeStaleFiles !== false,
              staleThresholdDays: options.staleThresholdDays || 30,
              retryFailedFiles: options.retryFailedFiles || false,
              maxRetries: options.maxRetries || 2
            }

            // Start async batch process
            const iterator = enhancedSummarizationService.batchSummarizeWithProgress(projectId, batchOptions)

            // Get first progress update
            const firstProgress = await iterator.next()
            if (firstProgress.done) {
              return {
                content: [{ type: 'text', text: 'No files to summarize' }]
              }
            }

            const progress = firstProgress.value
            return {
              content: [
                {
                  type: 'text',
                  text:
                    `Batch summarization started:\n` +
                    `- Batch ID: ${progress.batchId}\n` +
                    `- Total files: ${progress.totalFiles}\n` +
                    `- Total groups: ${progress.totalGroups}\n` +
                    `- Status: Processing...\n\n` +
                    `Use get_progress action with batchId to track progress`
                }
              ]
            }
          }

          case FileSummarizationManagerAction.GET_PROGRESS: {
            const activeBatches = fileSummarizationTracker.getActiveBatches()
            const projectProgress = fileSummarizationTracker.getSummarizationProgress(projectId)

            if (!projectProgress && activeBatches.length === 0) {
              return {
                content: [{ type: 'text', text: 'No active or recent batch operations found' }]
              }
            }

            let text = ''
            if (projectProgress) {
              const duration = projectProgress.endTime
                ? projectProgress.endTime - projectProgress.startTime
                : Date.now() - projectProgress.startTime

              text +=
                `Current batch progress:\n` +
                `- Batch ID: ${projectProgress.batchId}\n` +
                `- Status: ${projectProgress.status}\n` +
                `- Files: ${projectProgress.processedFiles}/${projectProgress.totalFiles} (${Math.round((projectProgress.processedFiles / projectProgress.totalFiles) * 100)}%)\n` +
                `- Groups: ${projectProgress.processedGroups}/${projectProgress.totalGroups}\n` +
                `- Duration: ${(duration / 1000).toFixed(1)}s\n` +
                `- Tokens used: ~${projectProgress.estimatedTokensUsed.toLocaleString()}\n`

              if (projectProgress.currentGroup) {
                text += `- Current group: ${projectProgress.currentGroup}\n`
              }

              if (projectProgress.errors && projectProgress.errors.length > 0) {
                text += `\nErrors:\n${projectProgress.errors.slice(0, 5).join('\n')}`
              }
            }

            if (activeBatches.length > 0) {
              text += `\n\nActive batches:\n`
              activeBatches.forEach(({ batchId, progress }) => {
                text += `- ${batchId}: ${progress.status} (${progress.processedFiles}/${progress.totalFiles} files)\n`
              })
            }

            return {
              content: [{ type: 'text', text }]
            }
          }

          case FileSummarizationManagerAction.CANCEL_BATCH: {
            const batchId = data?.batchId
            if (!batchId) {
              return {
                content: [{ type: 'text', text: 'Error: batchId is required in data' }]
              }
            }

            const cancelled = enhancedSummarizationService.cancelBatch(batchId)
            if (cancelled) {
              fileSummarizationTracker.cancelBatch(batchId)
              return {
                content: [{ type: 'text', text: `Batch ${batchId} cancelled successfully` }]
              }
            }

            return {
              content: [{ type: 'text', text: `Batch ${batchId} not found or already completed` }]
            }
          }

          case FileSummarizationManagerAction.GET_SUMMARY_STATS: {
            const stats = await fileSummarizationTracker.getSummarizationStats(projectId)

            return {
              content: [
                {
                  type: 'text',
                  text:
                    `File summarization statistics for project ${projectId}:\n\n` +
                    `Total files: ${stats.totalFiles}\n` +
                    `Summarized: ${stats.summarizedFiles} (${Math.round((stats.summarizedFiles / stats.totalFiles) * 100)}%)\n` +
                    `Unsummarized: ${stats.unsummarizedFiles}\n` +
                    `Stale: ${stats.staleFiles}\n` +
                    `Failed: ${stats.failedFiles}\n\n` +
                    `Average tokens per file: ${stats.averageTokensPerFile}\n` +
                    `Last batch run: ${stats.lastBatchRun ? new Date(stats.lastBatchRun).toLocaleString() : 'Never'}\n\n` +
                    `Files by status:\n` +
                    Object.entries(stats.filesByStatus)
                      .map(([status, count]) => `- ${status}: ${count}`)
                      .join('\n')
                }
              ]
            }
          }

          default:
            throw createMCPError(MCPErrorCode.UNKNOWN_ACTION, `Unknown action: ${action}`, {
              action,
              validActions: Object.values(FileSummarizationManagerAction)
            })
        }
      } catch (error) {
        const mcpError =
          error instanceof MCPError
            ? error
            : MCPError.fromError(error, {
                tool: 'file_summarization_manager',
                action: args.action
              })

        return formatMCPErrorResponse(mcpError)
      }
    }
  )
}
