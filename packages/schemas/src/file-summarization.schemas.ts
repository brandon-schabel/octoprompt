import { z } from 'zod'
import { ProjectFileSchema } from './project.schemas'

// Grouping strategies for files
export const GroupingStrategyEnum = z.enum(['imports', 'directory', 'semantic', 'mixed'])
export type GroupingStrategy = z.infer<typeof GroupingStrategyEnum>

// File relationship types
export const FileRelationshipTypeEnum = z.enum(['imports', 'exports', 'sibling', 'parent', 'child', 'semantic'])
export type FileRelationshipType = z.infer<typeof FileRelationshipTypeEnum>

// File relationship schema
export const FileRelationshipSchema = z.object({
  sourceFileId: z.number(),
  targetFileId: z.number(),
  type: FileRelationshipTypeEnum,
  strength: z.number().min(0).max(1).describe('Relationship strength (0-1)'),
  metadata: z.record(z.any()).optional()
})
export type FileRelationship = z.infer<typeof FileRelationshipSchema>

// File group schema
export const FileGroupSchema = z.object({
  id: z.string(),
  name: z.string().describe('Human-readable group name'),
  strategy: GroupingStrategyEnum,
  fileIds: z.array(z.number()).min(1),
  relationships: z.array(FileRelationshipSchema).optional(),
  estimatedTokens: z.number().optional(),
  priority: z.number().min(0).max(10).default(5),
  metadata: z.object({
    directory: z.string().optional(),
    primaryFile: z.number().optional(),
    semanticCategory: z.string().optional()
  }).optional()
})
export type FileGroup = z.infer<typeof FileGroupSchema>

// Summary status for individual files
export const SummaryStatusEnum = z.enum(['pending', 'in_progress', 'completed', 'failed', 'skipped'])
export type SummaryStatus = z.infer<typeof SummaryStatusEnum>

// File summary status schema
export const FileSummaryStatusSchema = z.object({
  fileId: z.number(),
  status: SummaryStatusEnum,
  lastAttempt: z.number().optional(),
  errorMessage: z.string().optional(),
  retryCount: z.number().default(0)
})
export type FileSummaryStatus = z.infer<typeof FileSummaryStatusSchema>

// Batch summary options
export const BatchSummaryOptionsSchema = z.object({
  strategy: GroupingStrategyEnum.default('mixed'),
  maxGroupSize: z.number().min(1).max(50).default(10),
  maxTokensPerGroup: z.number().min(1000).max(50000).default(10000),
  maxConcurrentGroups: z.number().min(1).max(10).default(3),
  priorityThreshold: z.number().min(0).max(10).default(3),
  includeStaleFiles: z.boolean().default(true),
  staleThresholdDays: z.number().min(1).max(365).default(30),
  retryFailedFiles: z.boolean().default(false),
  maxRetries: z.number().min(0).max(5).default(2)
})
export type BatchSummaryOptions = z.infer<typeof BatchSummaryOptionsSchema>

// Progress tracking schema
export const SummaryProgressSchema = z.object({
  projectId: z.number(),
  batchId: z.string(),
  status: z.enum(['initializing', 'grouping', 'processing', 'completed', 'cancelled', 'failed']),
  totalFiles: z.number(),
  processedFiles: z.number(),
  failedFiles: z.number(),
  skippedFiles: z.number(),
  totalGroups: z.number(),
  processedGroups: z.number(),
  startTime: z.number(),
  endTime: z.number().optional(),
  currentGroup: z.string().optional(),
  estimatedTokensUsed: z.number().default(0),
  errors: z.array(z.string()).optional()
})
export type SummaryProgress = z.infer<typeof SummaryProgressSchema>

// Enhanced summary with relationships
export const EnhancedFileSummarySchema = z.object({
  fileId: z.number(),
  summary: z.string(),
  relationships: z.array(z.object({
    relatedFileId: z.number(),
    relationshipType: FileRelationshipTypeEnum,
    context: z.string().optional()
  })).optional(),
  groupContext: z.string().optional(),
  generatedAt: z.number()
})
export type EnhancedFileSummary = z.infer<typeof EnhancedFileSummarySchema>

// Group summary schema
export const GroupSummarySchema = z.object({
  groupId: z.string(),
  groupName: z.string(),
  overviewSummary: z.string().describe('High-level summary of the group'),
  fileSummaries: z.array(EnhancedFileSummarySchema),
  relationships: z.array(FileRelationshipSchema),
  keyInsights: z.array(z.string()).optional(),
  tokensUsed: z.number(),
  generatedAt: z.number()
})
export type GroupSummary = z.infer<typeof GroupSummarySchema>

// Batch result schema
export const BatchSummaryResultSchema = z.object({
  batchId: z.string(),
  projectId: z.number(),
  status: z.enum(['completed', 'partial', 'failed', 'cancelled']),
  groupSummaries: z.array(GroupSummarySchema),
  progress: SummaryProgressSchema,
  totalTokensUsed: z.number(),
  duration: z.number(),
  errors: z.array(z.object({
    fileId: z.number().optional(),
    groupId: z.string().optional(),
    error: z.string(),
    timestamp: z.number()
  })).optional()
})
export type BatchSummaryResult = z.infer<typeof BatchSummaryResultSchema>

// File summarization statistics
export const FileSummarizationStatsSchema = z.object({
  projectId: z.number(),
  totalFiles: z.number(),
  summarizedFiles: z.number(),
  unsummarizedFiles: z.number(),
  staleFiles: z.number(),
  failedFiles: z.number(),
  averageTokensPerFile: z.number(),
  lastBatchRun: z.number().optional(),
  filesByStatus: z.record(SummaryStatusEnum, z.number())
})
export type FileSummarizationStats = z.infer<typeof FileSummarizationStatsSchema>