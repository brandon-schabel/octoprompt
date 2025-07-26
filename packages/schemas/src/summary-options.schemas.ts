import { z } from 'zod'

// Define summary depth levels
export const SummaryDepthEnum = z.enum(['minimal', 'standard', 'detailed'])
export type SummaryDepth = z.infer<typeof SummaryDepthEnum>

// Define summary formats
export const SummaryFormatEnum = z.enum(['xml', 'json', 'markdown'])
export type SummaryFormat = z.infer<typeof SummaryFormatEnum>

// Define summary strategies
export const SummaryStrategyEnum = z.enum(['fast', 'balanced', 'thorough'])
export type SummaryStrategy = z.infer<typeof SummaryStrategyEnum>

// Main summary options schema
export const SummaryOptionsSchema = z.object({
  depth: SummaryDepthEnum.default('standard').describe('Level of detail in the summary'),
  focus: z.array(z.string()).optional().describe('Specific areas to focus on (e.g., ["api", "frontend", "database"])'),
  includeImports: z.boolean().default(true).describe('Include import statements in file summaries'),
  includeExports: z.boolean().default(true).describe('Include export statements in file summaries'),
  maxTokens: z.number().min(100).max(100000).optional().describe('Maximum tokens for the summary'),
  format: SummaryFormatEnum.default('xml').describe('Output format for the summary'),
  progressive: z.boolean().default(false).describe('Enable progressive disclosure of information'),
  expand: z.array(z.string()).optional().describe('Paths to expand in progressive mode'),
  strategy: SummaryStrategyEnum.default('balanced').describe('Strategy for generating summaries'),
  includeMetrics: z.boolean().default(false).describe('Include generation metrics in response'),
  // Group-aware options
  groupAware: z.boolean().default(false).describe('Enable group-aware summarization'),
  includeRelationships: z.boolean().default(true).describe('Include file relationships in summaries'),
  contextWindow: z.number().min(1).max(10).default(3).describe('Number of related files to include in context')
})

export type SummaryOptions = z.infer<typeof SummaryOptionsSchema>

// Summary version tracking schema
export const SummaryVersionSchema = z.object({
  version: z.enum(['1.0', '2.0']).default('2.0').describe('Summary format version'),
  generated: z.number().describe('Timestamp when summary was generated'),
  model: z.string().describe('Model used to generate the summary'),
  options: SummaryOptionsSchema.describe('Options used for generation'),
  tokenCount: z.number().optional().describe('Number of tokens in the summary')
})

export type SummaryVersion = z.infer<typeof SummaryVersionSchema>

// Summary metrics schema
export const SummaryMetricsSchema = z.object({
  generationTime: z.number().describe('Time taken to generate summary in ms'),
  originalSize: z.number().describe('Original size in characters'),
  compressedSize: z.number().describe('Compressed size in characters'),
  compressionRatio: z.number().describe('Compression ratio (0-1)'),
  tokensSaved: z.number().describe('Estimated tokens saved'),
  filesProcessed: z.number().describe('Number of files processed'),
  cacheHit: z.boolean().describe('Whether cache was used'),
  truncated: z.boolean().describe('Whether content was truncated')
})

export type SummaryMetrics = z.infer<typeof SummaryMetricsSchema>

// Enhanced project summary response schema
export const EnhancedProjectSummaryResponseSchema = z.object({
  success: z.literal(true),
  summary: z.string().describe('The generated summary'),
  version: SummaryVersionSchema.describe('Version information'),
  metrics: SummaryMetricsSchema.optional().describe('Generation metrics if requested')
})

export type EnhancedProjectSummaryResponse = z.infer<typeof EnhancedProjectSummaryResponseSchema>

// File importance schema for scoring
export const FileImportanceSchema = z.object({
  fileId: z.string(),
  score: z.number().min(0).max(10),
  factors: z.object({
    type: z.number().describe('Score based on file type'),
    location: z.number().describe('Score based on file location'),
    imports: z.number().describe('Score based on import count'),
    exports: z.number().describe('Score based on export count'),
    size: z.number().describe('Score based on file size'),
    recency: z.number().describe('Score based on recent modifications')
  })
})

export type FileImportance = z.infer<typeof FileImportanceSchema>