import type {
  Ticket,
  ProjectFile,
  FileSuggestionStrategy,
  RelevanceConfig,
  FileSuggestionResponse,
  RelevanceScore
} from '@promptliano/schemas'
import { ApiError } from '@promptliano/shared'
import { fileSearchService } from './file-search-service'
import { fileRelevanceService } from './file-relevance-service'
import { CompactFileFormatter } from './utils/compact-file-formatter'
import { generateStructuredData } from './gen-ai-services'
import { HIGH_MODEL_CONFIG, MEDIUM_MODEL_CONFIG } from '@promptliano/config'
import { z } from 'zod'

export interface StrategyConfig {
  maxPreFilterFiles: number
  maxAIFiles: number
  useAI: boolean
  aiModel: 'high' | 'medium'
  compactLevel: 'ultra' | 'compact' | 'standard'
}

const STRATEGY_CONFIGS: Record<FileSuggestionStrategy, StrategyConfig> = {
  fast: {
    maxPreFilterFiles: 30,
    maxAIFiles: 0,
    useAI: false,
    aiModel: 'medium',
    compactLevel: 'ultra'
  },
  balanced: {
    maxPreFilterFiles: 50,
    maxAIFiles: 50,
    useAI: true,
    aiModel: 'medium',
    compactLevel: 'compact'
  },
  thorough: {
    maxPreFilterFiles: 100,
    maxAIFiles: 100,
    useAI: true,
    aiModel: 'high',
    compactLevel: 'standard'
  }
}

export class FileSuggestionStrategyService {
  async suggestFiles(
    ticket: Ticket,
    strategy: FileSuggestionStrategy = 'balanced',
    maxResults: number = 10,
    userContext?: string,
    customConfig?: Partial<RelevanceConfig>
  ): Promise<FileSuggestionResponse> {
    const startTime = Date.now()
    const strategyConfig = STRATEGY_CONFIGS[strategy]

    try {
      // Step 1: Pre-filter files using relevance scoring
      const relevanceScores = await this.preFilterFiles(
        ticket,
        strategyConfig.maxPreFilterFiles,
        userContext,
        customConfig
      )

      let finalSuggestions: number[]
      let scores: RelevanceScore[] | undefined

      if (strategyConfig.useAI && relevanceScores.length > 0) {
        // Step 2: Use AI to refine suggestions from pre-filtered set
        const candidateFiles = await this.getFilesByScores(
          ticket.projectId,
          relevanceScores.slice(0, strategyConfig.maxAIFiles)
        )

        finalSuggestions = await this.aiRefineSuggestions(
          ticket,
          candidateFiles,
          maxResults,
          strategyConfig,
          userContext
        )

        // Map AI suggestions back to relevance scores
        scores = finalSuggestions.map(fileId => {
          const score = relevanceScores.find(s => s.fileId === fileId)
          return score || this.createDefaultScore(fileId)
        })
      } else {
        // Fast mode: Use only pre-filtering results
        finalSuggestions = relevanceScores
          .slice(0, maxResults)
          .map(score => score.fileId)
        scores = relevanceScores.slice(0, maxResults)
      }

      // Calculate token savings
      const tokensSaved = await this.calculateTokenSavings(
        ticket.projectId,
        strategyConfig.maxAIFiles
      )

      return {
        suggestions: finalSuggestions,
        scores,
        metadata: {
          totalFiles: await this.getTotalFileCount(ticket.projectId),
          analyzedFiles: relevanceScores.length,
          strategy,
          processingTime: Date.now() - startTime,
          tokensSaved
        }
      }
    } catch (error) {
      throw new ApiError(
        500,
        `File suggestion failed: ${error instanceof Error ? error.message : String(error)}`,
        'FILE_SUGGESTION_FAILED'
      )
    }
  }

  private async preFilterFiles(
    ticket: Ticket,
    maxFiles: number,
    userContext?: string,
    customConfig?: Partial<RelevanceConfig>
  ): Promise<RelevanceScore[]> {
    // Update config if custom settings provided
    if (customConfig) {
      fileRelevanceService.updateConfig(customConfig)
    }

    // Get relevance scores for all files
    const scores = await fileRelevanceService.scoreFilesForTicket(
      ticket,
      ticket.projectId,
      userContext
    )

    // Return top scored files
    return scores.slice(0, maxFiles)
  }

  private async getFilesByScores(
    projectId: number,
    scores: RelevanceScore[]
  ): Promise<ProjectFile[]> {
    const { getProjectFiles } = await import('./project-service')
    const allFiles = await getProjectFiles(projectId)

    // Handle case where project doesn't exist or has no files
    if (!allFiles) {
      console.warn(`[FileSuggestionStrategy] Project ${projectId} not found or has no files`)
      return []
    }

    const fileMap = new Map(allFiles.map(f => [f.id, f]))
    return scores
      .map(score => fileMap.get(score.fileId))
      .filter((file): file is ProjectFile => file !== undefined)
  }

  private async aiRefineSuggestions(
    ticket: Ticket,
    candidateFiles: ProjectFile[],
    maxResults: number,
    config: StrategyConfig,
    userContext?: string
  ): Promise<number[]> {
    // Format files in compact representation
    const compactSummary = CompactFileFormatter.format(candidateFiles, config.compactLevel)

    const systemPrompt = `You are a code assistant that selects the most relevant files for a ticket.
Given a ticket and a pre-filtered list of potentially relevant files, select the ${maxResults} most relevant files.

Consider:
1. Files directly related to the ticket's functionality
2. Test files that need to be updated
3. Configuration files that might need changes
4. Related components or modules

Return only file IDs as numbers in order of relevance.`

    const userPrompt = `Ticket: ${ticket.title}
Overview: ${ticket.overview || 'No overview'}
${userContext ? `Context: ${userContext}` : ''}

Pre-filtered files (${compactSummary.total} files):
${CompactFileFormatter.toAIPrompt(candidateFiles, config.compactLevel)}

Select the ${maxResults} most relevant file IDs from the above list.`

    const FileSuggestionsSchema = z.object({
      fileIds: z.array(z.number()).max(maxResults)
    })

    const modelConfig = config.aiModel === 'high' ? HIGH_MODEL_CONFIG : MEDIUM_MODEL_CONFIG

    const result = await generateStructuredData({
      prompt: userPrompt,
      systemMessage: systemPrompt,
      schema: FileSuggestionsSchema,
      options: modelConfig
    })

    return result.object.fileIds
  }

  private createDefaultScore(fileId: number): RelevanceScore {
    return {
      fileId,
      totalScore: 0.5,
      keywordScore: 0,
      pathScore: 0,
      typeScore: 0,
      recencyScore: 0,
      importScore: 0
    }
  }

  private async getTotalFileCount(projectId: number): Promise<number> {
    const { getProjectFiles } = await import('./project-service')
    const files = await getProjectFiles(projectId)
    return files?.length || 0
  }

  private async calculateTokenSavings(
    projectId: number,
    analyzedFiles: number
  ): Promise<number> {
    const { getProjectFiles } = await import('./project-service')
    const allFiles = await getProjectFiles(projectId)

    // Handle case where project doesn't exist or has no files
    if (!allFiles) {
      return 0
    }

    // Estimate tokens for full project summary (XML format)
    const fullSummaryChars = allFiles.length * 500 // ~500 chars per file in XML
    const fullSummaryTokens = Math.ceil(fullSummaryChars / 4)

    // Estimate tokens for compact format
    const compactSummaryChars = analyzedFiles * 100 // ~100 chars per file in compact JSON
    const compactSummaryTokens = Math.ceil(compactSummaryChars / 4)

    return Math.max(0, fullSummaryTokens - compactSummaryTokens)
  }

  /**
   * Get suggested strategy based on project size
   */
  static async recommendStrategy(projectId: number): Promise<FileSuggestionStrategy> {
    const { getProjectFiles } = await import('./project-service')
    const files = await getProjectFiles(projectId)

    // Default to balanced strategy if project doesn't exist
    if (!files) {
      console.warn(`[FileSuggestionStrategy] Project ${projectId} not found, using balanced strategy`)
      return 'balanced'
    }

    const fileCount = files.length

    if (fileCount < 50) return 'thorough'
    if (fileCount < 200) return 'balanced'
    return 'fast'
  }

  /**
   * Batch suggest files for multiple tickets
   */
  async batchSuggestFiles(
    tickets: Ticket[],
    strategy: FileSuggestionStrategy = 'fast',
    maxResultsPerTicket: number = 5
  ): Promise<Map<number, FileSuggestionResponse>> {
    const results = new Map<number, FileSuggestionResponse>()

    // Process tickets in parallel with concurrency limit
    const BATCH_SIZE = 5
    for (let i = 0; i < tickets.length; i += BATCH_SIZE) {
      const batch = tickets.slice(i, i + BATCH_SIZE)
      const batchResults = await Promise.all(
        batch.map(ticket =>
          this.suggestFiles(ticket, strategy, maxResultsPerTicket)
            .then(result => ({ ticketId: ticket.id, result }))
            .catch(error => ({
              ticketId: ticket.id,
              result: this.createErrorResponse(error, strategy)
            }))
        )
      )

      for (const { ticketId, result } of batchResults) {
        results.set(ticketId, result)
      }
    }

    return results
  }

  private createErrorResponse(
    error: any,
    strategy: FileSuggestionStrategy
  ): FileSuggestionResponse {
    return {
      suggestions: [],
      metadata: {
        totalFiles: 0,
        analyzedFiles: 0,
        strategy,
        processingTime: 0,
        tokensSaved: 0
      }
    }
  }
}

// Export singleton instance
export const fileSuggestionStrategyService = new FileSuggestionStrategyService()