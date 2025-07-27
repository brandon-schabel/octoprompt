import { z } from '@hono/zod-openapi'

// Relevance scoring weight configuration
export const RelevanceWeightsSchema = z
  .object({
    keyword: z.number().min(0).max(1).default(0.4).openapi({
      description: 'Weight for keyword matching score',
      example: 0.4
    }),
    path: z.number().min(0).max(1).default(0.2).openapi({
      description: 'Weight for file path relevance',
      example: 0.2
    }),
    type: z.number().min(0).max(1).default(0.15).openapi({
      description: 'Weight for file type relevance',
      example: 0.15
    }),
    recency: z.number().min(0).max(1).default(0.15).openapi({
      description: 'Weight for file recency (recent modifications)',
      example: 0.15
    }),
    import: z.number().min(0).max(1).default(0.1).openapi({
      description: 'Weight for import relationships',
      example: 0.1
    })
  })
  .openapi('RelevanceWeights')

// File relevance configuration
export const RelevanceConfigSchema = z
  .object({
    weights: RelevanceWeightsSchema,
    maxFiles: z.number().int().positive().default(100).openapi({
      description: 'Maximum number of files to analyze',
      example: 100
    }),
    minScore: z.number().min(0).max(1).default(0.1).openapi({
      description: 'Minimum relevance score threshold',
      example: 0.1
    })
  })
  .openapi('RelevanceConfig')

// Individual file relevance score
export const RelevanceScoreSchema = z
  .object({
    fileId: z.number().openapi({
      description: 'File ID',
      example: 1234567890
    }),
    totalScore: z.number().min(0).max(1).openapi({
      description: 'Combined relevance score',
      example: 0.85
    }),
    keywordScore: z.number().min(0).max(1).openapi({
      description: 'Keyword matching score',
      example: 0.9
    }),
    pathScore: z.number().min(0).max(1).openapi({
      description: 'File path relevance score',
      example: 0.7
    }),
    typeScore: z.number().min(0).max(1).openapi({
      description: 'File type relevance score',
      example: 0.8
    }),
    recencyScore: z.number().min(0).max(1).openapi({
      description: 'File recency score',
      example: 0.6
    }),
    importScore: z.number().min(0).max(1).openapi({
      description: 'Import relationship score',
      example: 0.5
    })
  })
  .openapi('RelevanceScore')

// Compact file representation levels
export const CompactLevelEnum = z.enum(['ultra', 'compact', 'standard']).openapi({
  description: 'Compactness level for file representation',
  example: 'compact'
})

// Compact file representation
export const CompactFileRepresentationSchema = z
  .object({
    i: z.number().openapi({
      description: 'File ID',
      example: 1234567890
    }),
    p: z.string().openapi({
      description: 'File path (truncated)',
      example: 'src/.../component.tsx'
    }),
    s: z.string().optional().openapi({
      description: 'Summary snippet',
      example: 'React component for user profile...'
    }),
    t: z.string().optional().openapi({
      description: 'File type/extension',
      example: 'tsx'
    }),
    m: z.number().optional().openapi({
      description: 'Modified timestamp',
      example: 1234567890123
    })
  })
  .openapi('CompactFileRepresentation')

// Compact project summary
export const CompactProjectSummarySchema = z
  .object({
    files: z.array(CompactFileRepresentationSchema),
    total: z.number().openapi({
      description: 'Total number of files',
      example: 150
    }),
    format: CompactLevelEnum
  })
  .openapi('CompactProjectSummary')

// File suggestion strategy
export const FileSuggestionStrategyEnum = z.enum(['fast', 'balanced', 'thorough']).openapi({
  description: 'Strategy for file suggestions',
  example: 'balanced'
})

// File suggestion request
export const FileSuggestionRequestSchema = z
  .object({
    projectId: z.number().openapi({
      description: 'Project ID',
      example: 1234567890
    }),
    ticketId: z.number().optional().openapi({
      description: 'Ticket ID for context',
      example: 456
    }),
    query: z.string().optional().openapi({
      description: 'Search query text',
      example: 'authentication service'
    }),
    strategy: FileSuggestionStrategyEnum.default('balanced'),
    maxResults: z.number().int().positive().max(50).default(10).openapi({
      description: 'Maximum number of file suggestions',
      example: 10
    }),
    includeScores: z.boolean().default(false).openapi({
      description: 'Include relevance scores in response',
      example: false
    }),
    config: RelevanceConfigSchema.optional()
  })
  .openapi('FileSuggestionRequest')

// File suggestion response
export const FileSuggestionResponseSchema = z
  .object({
    suggestions: z.array(z.number()).openapi({
      description: 'Suggested file IDs ordered by relevance',
      example: [123, 456, 789]
    }),
    scores: z.array(RelevanceScoreSchema).optional().openapi({
      description: 'Detailed relevance scores (if requested)'
    }),
    metadata: z.object({
      totalFiles: z.number(),
      analyzedFiles: z.number(),
      strategy: FileSuggestionStrategyEnum,
      processingTime: z.number().openapi({
        description: 'Processing time in milliseconds',
        example: 45
      }),
      tokensSaved: z.number().optional().openapi({
        description: 'Estimated tokens saved compared to full summary',
        example: 15000
      })
    })
  })
  .openapi('FileSuggestionResponse')

// Suggestion cache entry
export const SuggestionCacheEntrySchema = z
  .object({
    id: z.string().openapi({
      description: 'Cache entry ID',
      example: 'proj123_ticket456_abc123'
    }),
    projectId: z.number(),
    ticketId: z.number().optional(),
    query: z.string().optional(),
    suggestions: z.array(z.number()),
    scores: z.array(RelevanceScoreSchema).optional(),
    strategy: FileSuggestionStrategyEnum,
    createdAt: z.number(),
    expiresAt: z.number(),
    hitCount: z.number().default(0)
  })
  .openapi('SuggestionCacheEntry')

// Batch file suggestion request
export const BatchFileSuggestionRequestSchema = z
  .object({
    projectId: z.number(),
    tickets: z
      .array(
        z.object({
          ticketId: z.number(),
          includeTaskContext: z.boolean().default(false)
        })
      )
      .max(20)
      .openapi({
        description: 'Batch of tickets to get suggestions for (max 20)'
      }),
    strategy: FileSuggestionStrategyEnum.default('fast'),
    maxResultsPerTicket: z.number().int().positive().max(20).default(5)
  })
  .openapi('BatchFileSuggestionRequest')

// Types
export type RelevanceWeights = z.infer<typeof RelevanceWeightsSchema>
export type RelevanceConfig = z.infer<typeof RelevanceConfigSchema>
export type RelevanceScore = z.infer<typeof RelevanceScoreSchema>
export type CompactLevel = z.infer<typeof CompactLevelEnum>
export type CompactFileRepresentation = z.infer<typeof CompactFileRepresentationSchema>
export type CompactProjectSummary = z.infer<typeof CompactProjectSummarySchema>
export type FileSuggestionStrategy = z.infer<typeof FileSuggestionStrategyEnum>
export type FileSuggestionRequest = z.infer<typeof FileSuggestionRequestSchema>
export type FileSuggestionResponse = z.infer<typeof FileSuggestionResponseSchema>
export type SuggestionCacheEntry = z.infer<typeof SuggestionCacheEntrySchema>
export type BatchFileSuggestionRequest = z.infer<typeof BatchFileSuggestionRequestSchema>
