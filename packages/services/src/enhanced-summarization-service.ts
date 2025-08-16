import {
    type ProjectFile,
    type FileGroup,
    type GroupSummary,
    type EnhancedFileSummary,
    type BatchSummaryOptions,
    type BatchSummaryResult,
    type SummaryOptions,
    type SummaryProgress
} from '@promptliano/schemas'
import { z } from 'zod'
import { ApiError, promptsMap } from '@promptliano/shared'
import { generateStructuredData } from './gen-ai-services'
import { fileSummarizationTracker } from './file-summarization-tracker'
import { fileGroupingService } from './file-grouping-service'
import { logger } from './utils/logger'

// Define the schema for file summarization requests
const FileSummarizationRequestSchema = z.object({
    summary: z.string()
})

export interface BatchProgress {
    batchId: string
    currentGroup: string
    groupIndex: number
    totalGroups: number
    filesProcessed: number
    totalFiles: number
    tokensUsed: number
    errors: string[]
}

export interface GroupContext {
    groupName: string
    relatedFiles: Array<{ id: number; name: string; summary?: string }>
    relationships: Array<{ source: string; target: string; type: string }>
}

// Model configurations for different summary depths
const MODEL_CONFIGS = {
    minimal: {
        maxOutputTokens: 200,
        model: 'gemini-1.5-flash',
        temperature: 0.3
    },
    standard: {
        maxOutputTokens: 500,
        model: 'gemini-1.5-flash',
        temperature: 0.5
    },
    detailed: {
        maxOutputTokens: 1000,
        model: 'gemini-1.5-flash',
        temperature: 0.7
    }
}

export class EnhancedSummarizationService {
    private activeOperations = new Map<string, AbortController>()

    /**
     * Summarize a group of related files together
     */
    async summarizeFileGroup(group: FileGroup, files: ProjectFile[], options: SummaryOptions): Promise<GroupSummary> {
        const startTime = Date.now()
        const fileMap = new Map(files.map((f) => [f.id, f]))
        const groupFiles = group.fileIds.map((id) => fileMap.get(id)).filter((f) => f !== undefined) as ProjectFile[]

        if (groupFiles.length === 0) {
            throw new ApiError(400, 'No valid files in group', 'EMPTY_FILE_GROUP')
        }

        try {
            // Build group context
            const context = this.buildGroupContext(group, groupFiles, fileMap)

            // Generate enhanced summaries for each file
            const fileSummaries: EnhancedFileSummary[] = []
            let totalTokensUsed = 0

            for (const file of groupFiles) {
                try {
                    const summary = await this.generateEnhancedSummary(file, context, options)
                    fileSummaries.push(summary)

                    // Estimate tokens used
                    totalTokensUsed += Math.ceil((file.content?.length || 0) / 4)
                    totalTokensUsed += Math.ceil(summary.summary.length / 4)
                } catch (error) {
                    logger.error(`Failed to summarize file ${file.path} in group ${group.id}`, error)
                    // Continue with other files
                }
            }

            // Generate group overview
            const overviewSummary = await this.generateGroupOverview(group, fileSummaries, context, options)

            return {
                groupId: group.id,
                groupName: group.name,
                overviewSummary,
                fileSummaries,
                relationships: group.relationships || [],
                keyInsights: this.extractKeyInsights(fileSummaries),
                tokensUsed: totalTokensUsed,
                generatedAt: Date.now()
            }
        } catch (error) {
            logger.error(`Failed to summarize file group ${group.id}`, error)
            throw new ApiError(
                500,
                `Failed to summarize file group: ${error instanceof Error ? error.message : String(error)}`,
                'GROUP_SUMMARIZATION_FAILED'
            )
        }
    }

    /**
     * Batch summarize files with progress tracking
     */
    async *batchSummarizeWithProgress(projectId: number, options: BatchSummaryOptions): AsyncIterator<BatchProgress> {
        const batchId = `batch-${projectId}-${Date.now()}`
        const abortController = new AbortController()
        this.activeOperations.set(batchId, abortController)

        try {
            // Get files needing summarization
            const unsummarizedFiles = await fileSummarizationTracker.getUnsummarizedFiles(projectId, {
                includeSkipped: options.retryFailedFiles,
                includeEmpty: false
            })

            const staleFiles = options.includeStaleFiles
                ? await fileSummarizationTracker.getStaleFiles(projectId, options.staleThresholdDays * 24 * 60 * 60 * 1000)
                : []

            // Combine and deduplicate
            const fileMap = new Map<number, ProjectFile>()
            const allFiles = [...unsummarizedFiles, ...staleFiles]
            allFiles.forEach((f) => fileMap.set(f.id, f))
            const filesToProcess = Array.from(fileMap.values())

            if (filesToProcess.length === 0) {
                yield {
                    batchId,
                    currentGroup: 'No files to process',
                    groupIndex: 0,
                    totalGroups: 0,
                    filesProcessed: 0,
                    totalFiles: 0,
                    tokensUsed: 0,
                    errors: []
                }
                return
            }

            // Group files
            const groups = fileGroupingService.groupFilesByStrategy(filesToProcess, options.strategy, {
                maxGroupSize: options.maxGroupSize,
                priorityThreshold: options.priorityThreshold
            })

            // Optimize groups for token limits
            const optimizedGroups = fileGroupingService.optimizeGroupsForTokenLimit(
                groups,
                filesToProcess,
                options.maxTokensPerGroup
            )

            // Sort groups by priority
            optimizedGroups.sort((a, b) => b.priority - a.priority)

            // Start tracking
            const progress = fileSummarizationTracker.startBatchTracking(
                projectId,
                batchId,
                filesToProcess.length,
                optimizedGroups.length
            )

            // Process groups
            const errors: string[] = []
            let totalTokensUsed = 0
            let filesProcessed = 0

            for (let i = 0; i < optimizedGroups.length; i++) {
                if (abortController.signal.aborted) {
                    fileSummarizationTracker.completeBatchTracking(batchId, 'cancelled')
                    break
                }

                const group = optimizedGroups[i]

                // Update progress
                fileSummarizationTracker.updateBatchProgress(batchId, {
                    status: 'processing',
                    currentGroup: group.name,
                    processedGroups: i
                })

                yield {
                    batchId,
                    currentGroup: group.name,
                    groupIndex: i + 1,
                    totalGroups: optimizedGroups.length,
                    filesProcessed,
                    totalFiles: filesToProcess.length,
                    tokensUsed: totalTokensUsed,
                    errors
                }

                try {
                    // Process group with concurrency limit
                    const summary = await this.processGroupWithConcurrency(group, filesToProcess, options, abortController.signal)

                    filesProcessed += group.fileIds.length
                    totalTokensUsed += summary.tokensUsed

                    // Update file statuses
                    fileSummarizationTracker.updateSummarizationStatus(
                        projectId,
                        group.fileIds.map((id) => ({ fileId: id, status: 'completed' }))
                    )
                } catch (error) {
                    const errorMsg = `Failed to process group ${group.name}: ${error instanceof Error ? error.message : String(error)}`
                    errors.push(errorMsg)
                    logger.error(errorMsg, error)

                    // Mark files as failed
                    fileSummarizationTracker.updateSummarizationStatus(
                        projectId,
                        group.fileIds.map((id) => ({
                            fileId: id,
                            status: 'failed',
                            error: errorMsg
                        }))
                    )
                }

                // Update progress
                fileSummarizationTracker.updateBatchProgress(batchId, {
                    processedFiles: filesProcessed,
                    processedGroups: i + 1,
                    estimatedTokensUsed: totalTokensUsed,
                    errors: errors.length > 0 ? errors : undefined
                })
            }

            // Complete tracking
            const finalStatus = abortController.signal.aborted ? 'cancelled' : errors.length > 0 ? 'partial' : 'completed'

            fileSummarizationTracker.completeBatchTracking(batchId, finalStatus === 'partial' ? 'completed' : finalStatus)

            // Final yield
            yield {
                batchId,
                currentGroup: 'Completed',
                groupIndex: optimizedGroups.length,
                totalGroups: optimizedGroups.length,
                filesProcessed,
                totalFiles: filesToProcess.length,
                tokensUsed: totalTokensUsed,
                errors
            }
        } finally {
            this.activeOperations.delete(batchId)
        }
    }

    /**
     * Generate enhanced summary for a single file with group context
     */
    async generateEnhancedSummary(
        file: ProjectFile,
        context: GroupContext,
        options: SummaryOptions
    ): Promise<EnhancedFileSummary> {
        // Check if file needs summarization
        if (!file.content || file.content.trim().length === 0) {
            return {
                fileId: file.id,
                summary: 'Empty file',
                generatedAt: Date.now()
            }
        }

        try {
            const modelConfig = MODEL_CONFIGS[options.depth || 'standard']

            // Build context-aware prompt
            const systemPrompt = options.groupAware ? this.buildGroupAwareSystemPrompt(options) : promptsMap.summarizationSteps

            const userPrompt = this.buildEnhancedUserPrompt(file, context, options)

            const result = await generateStructuredData({
                prompt: userPrompt,
                schema: FileSummarizationRequestSchema,
                systemMessage: systemPrompt,
                options: modelConfig
            })

            // Extract relationships from the summary
            const relationships = options.includeRelationships
                ? this.extractRelationships(file, context, result.object.summary)
                : undefined

            return {
                fileId: file.id,
                summary: result.object.summary,
                relationships,
                groupContext: options.groupAware ? context.groupName : undefined,
                generatedAt: Date.now()
            }
        } catch (error) {
            logger.error(`Failed to generate enhanced summary for file ${file.path}`, error)
            throw error
        }
    }

    /**
     * Build group context for summarization
     */
    private buildGroupContext(
        group: FileGroup,
        groupFiles: ProjectFile[],
        allFilesMap: Map<number, ProjectFile>
    ): GroupContext {
        const relatedFiles = groupFiles.map((f) => ({
            id: f.id,
            name: f.name,
            summary: f.summary ?? undefined
        }))

        const relationships = (group.relationships || []).map((rel) => {
            const sourceFile = allFilesMap.get(rel.sourceFileId)
            const targetFile = allFilesMap.get(rel.targetFileId)

            return {
                source: sourceFile?.name || `File ${rel.sourceFileId}`,
                target: targetFile?.name || `File ${rel.targetFileId}`,
                type: rel.type
            }
        })

        return {
            groupName: group.name,
            relatedFiles,
            relationships
        }
    }

    /**
     * Generate overview summary for a group
     */
    private async generateGroupOverview(
        group: FileGroup,
        fileSummaries: EnhancedFileSummary[],
        context: GroupContext,
        options: SummaryOptions
    ): Promise<string> {
        if (fileSummaries.length === 0) {
            return 'No files were successfully summarized in this group.'
        }

        const prompt = `
Generate a high-level overview summary for this group of related files:

Group: ${group.name}
Strategy: ${group.strategy}
Number of files: ${fileSummaries.length}

File summaries:
${fileSummaries.map((s) => `- ${s.summary}`).join('\n')}

${context.relationships.length > 0
                ? `
Relationships:
${context.relationships.map((r) => `- ${r.source} ${r.type} ${r.target}`).join('\n')}
`
                : ''
            }

Provide a concise overview that captures:
1. The overall purpose and functionality of this file group
2. How the files work together
3. Key patterns or architectural decisions
4. Important dependencies or interactions
`

        try {
            const result = await generateStructuredData({
                prompt,
                schema: FileSummarizationRequestSchema,
                systemMessage: 'You are an expert code analyst. Provide clear, concise summaries.',
                options: MODEL_CONFIGS[options.depth || 'standard']
            })

            return result.object.summary
        } catch (error) {
            logger.error('Failed to generate group overview', error)
            return 'Failed to generate group overview.'
        }
    }

    /**
     * Extract key insights from file summaries
     */
    private extractKeyInsights(summaries: EnhancedFileSummary[]): string[] {
        const insights: string[] = []

        // Look for patterns in summaries
        const commonTerms = new Map<string, number>()
        const techStack = new Set<string>()

        for (const summary of summaries) {
            // Extract technology mentions
            const techPatterns = [
                /\b(React|Vue|Angular|Svelte)\b/gi,
                /\b(TypeScript|JavaScript|Python|Go|Rust)\b/gi,
                /\b(REST|GraphQL|gRPC|WebSocket)\b/gi,
                /\b(PostgreSQL|MySQL|MongoDB|Redis|SQLite)\b/gi
            ]

            for (const pattern of techPatterns) {
                const matches = summary.summary.match(pattern)
                if (matches) {
                    matches.forEach((match) => techStack.add(match))
                }
            }

            // Extract common architectural terms
            const archTerms = summary.summary.match(/\b(service|component|hook|utility|helper|controller|model|schema)\b/gi)
            if (archTerms) {
                archTerms.forEach((term) => {
                    const lower = term.toLowerCase()
                    commonTerms.set(lower, (commonTerms.get(lower) || 0) + 1)
                })
            }
        }

        // Generate insights
        if (techStack.size > 0) {
            insights.push(`Technologies used: ${Array.from(techStack).join(', ')}`)
        }

        const topTerms = Array.from(commonTerms.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([term]) => term)

        if (topTerms.length > 0) {
            insights.push(`Common patterns: ${topTerms.join(', ')}`)
        }

        // Add relationship insights
        const relationshipTypes = new Set<string>()
        summaries.forEach((s) => {
            s.relationships?.forEach((r) => relationshipTypes.add(r.relationshipType))
        })

        if (relationshipTypes.size > 0) {
            insights.push(`Relationship types: ${Array.from(relationshipTypes).join(', ')}`)
        }

        return insights
    }

    /**
     * Process a group with concurrency control
     */
    private async processGroupWithConcurrency(
        group: FileGroup,
        allFiles: ProjectFile[],
        options: BatchSummaryOptions,
        signal: AbortSignal
    ): Promise<GroupSummary> {
        const summaryOptions: SummaryOptions = {
            depth: 'standard',
            format: 'xml',
            strategy: 'balanced',
            includeImports: true,
            includeExports: true,
            progressive: false,
            includeMetrics: false,
            contextWindow: 3,
            groupAware: true,
            includeRelationships: true
        }

        // Use semaphore pattern for concurrency control
        const maxConcurrent = options.maxConcurrentGroups || 3
        let running = 0

        const waitForSlot = async () => {
            while (running >= maxConcurrent) {
                if (signal.aborted) throw new Error('Operation cancelled')
                await new Promise((resolve) => setTimeout(resolve, 100))
            }
        }

        await waitForSlot()
        running++

        try {
            return await this.summarizeFileGroup(group, allFiles, summaryOptions)
        } finally {
            running--
        }
    }

    /**
     * Build group-aware system prompt
     */
    private buildGroupAwareSystemPrompt(options: SummaryOptions): string {
        return `You are an expert code analyst with deep understanding of software architecture and design patterns.

When summarizing code files, consider:
1. The file's role within its group/module
2. Key dependencies and relationships with other files
3. Important patterns, abstractions, or architectural decisions
4. The file's public API (exports) and dependencies (imports)

Provide summaries that are:
- ${options.depth === 'minimal'
                ? 'Very concise (1-2 sentences)'
                : options.depth === 'detailed'
                    ? 'Comprehensive with implementation details'
                    : 'Clear and informative (3-5 sentences)'
            }
- Focused on purpose and functionality over implementation details
- Aware of the broader context when group information is provided
- Technical but accessible to developers unfamiliar with the codebase`
    }

    /**
     * Build enhanced user prompt for summarization
     */
    private buildEnhancedUserPrompt(file: ProjectFile, context: GroupContext, options: SummaryOptions): string {
        let prompt = `Summarize this ${file.extension || 'code'} file:\n\n`
        prompt += `File: ${file.path}\n`

        if (options.groupAware && context.relatedFiles.length > 1) {
            prompt += `\nThis file is part of a group: ${context.groupName}\n`
            prompt += `Related files in group:\n`
            context.relatedFiles
                .filter((f) => f.id !== file.id)
                .slice(0, options.contextWindow || 3)
                .forEach((f) => {
                    prompt += `- ${f.name}${f.summary ? `: ${f.summary.slice(0, 100)}...` : ''}\n`
                })
        }

        if (options.includeImports && file.imports && file.imports.length > 0) {
            prompt += `\nImports:\n`
            file.imports.slice(0, 10).forEach((imp) => {
                prompt += `- ${imp.source}: ${imp.specifiers.join(', ')}\n`
            })
        }

        if (options.includeExports && file.exports && file.exports.length > 0) {
            prompt += `\nExports:\n`
            file.exports.slice(0, 10).forEach((exp) => {
                if (exp.type === 'named' && exp.specifiers && exp.specifiers.length > 0) {
                    exp.specifiers.forEach((spec) => {
                        const name = spec.exported || spec.local || 'unknown'
                        prompt += `- ${name} (named)\n`
                    })
                } else {
                    prompt += `- ${exp.type} export\n`
                }
            })
        }

        // Use simple content preview
        const contentPreview = file.content ? file.content.slice(0, 5000) : ''
        prompt += `\nCode content:\n${contentPreview}\n`

        prompt += `\nProvide a ${options.depth || 'standard'} summary focusing on purpose and functionality.`

        return prompt
    }

    /**
     * Extract relationships from summary context
     */
    private extractRelationships(
        file: ProjectFile,
        context: GroupContext,
        summary: string
    ): Array<{ relatedFileId: number; relationshipType: any; context?: string }> {
        const relationships: Array<{ relatedFileId: number; relationshipType: any; context?: string }> = []

        // Add import relationships
        if (file.imports) {
            context.relatedFiles.forEach((related) => {
                if (related.id === file.id) return

                const hasImport = file.imports!.some(
                    (imp) => related.name.includes(imp.source) || imp.source.includes(related.name.replace(/\.[^.]+$/, ''))
                )

                if (hasImport) {
                    relationships.push({
                        relatedFileId: related.id,
                        relationshipType: 'imports',
                        context: 'Direct import dependency'
                    })
                }
            })
        }

        // Add semantic relationships based on summary
        const summaryLower = summary.toLowerCase()
        context.relatedFiles.forEach((related) => {
            if (related.id === file.id) return

            if (summaryLower.includes(related.name.toLowerCase())) {
                relationships.push({
                    relatedFileId: related.id,
                    relationshipType: 'semantic',
                    context: 'Mentioned in summary'
                })
            }
        })

        return relationships
    }

    /**
     * Cancel an active batch operation
     */
    cancelBatch(batchId: string): boolean {
        const controller = this.activeOperations.get(batchId)
        if (controller) {
            controller.abort()
            return true
        }
        return false
    }

    /**
     * Get all active batch operations
     */
    getActiveBatches(): string[] {
        return Array.from(this.activeOperations.keys())
    }
}

// Export singleton instance
export const enhancedSummarizationService = new EnhancedSummarizationService()