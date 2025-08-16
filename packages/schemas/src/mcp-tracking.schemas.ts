import { z } from 'zod'
import { unixTSSchemaSpec } from './schema-utils'

// --- Enums ---

export const mcpExecutionStatusSchema = z.enum(['success', 'error', 'timeout'])
export type MCPExecutionStatus = z.infer<typeof mcpExecutionStatusSchema>

export const mcpStatisticsPeriodSchema = z.enum(['hour', 'day', 'week', 'month'])
export type MCPStatisticsPeriod = z.infer<typeof mcpStatisticsPeriodSchema>

export const mcpPatternTypeSchema = z.enum(['sequence', 'frequency', 'error'])
export type MCPPatternType = z.infer<typeof mcpPatternTypeSchema>

// --- Core Schemas ---

/**
 * Schema for MCP tool execution records
 */
export const mcpToolExecutionSchema = z.object({
  id: z.number(),
  toolName: z.string(),
  projectId: z.number().nullable().optional(),
  userId: z.string().nullable().optional(),
  sessionId: z.string().nullable().optional(),
  startedAt: unixTSSchemaSpec,
  completedAt: unixTSSchemaSpec.nullable().optional(),
  durationMs: z.number().nullable().optional(),
  status: mcpExecutionStatusSchema,
  errorMessage: z.string().nullable().optional(),
  errorCode: z.string().nullable().optional(),
  inputParams: z.string().nullable().optional(), // JSON string
  outputSize: z.number().nullable().optional(),
  metadata: z.string().nullable().optional() // JSON string
})

export type MCPToolExecution = z.infer<typeof mcpToolExecutionSchema>

/**
 * Schema for creating a new MCP tool execution
 */
export const createMCPToolExecutionSchema = mcpToolExecutionSchema
  .omit({
    id: true,
    completedAt: true,
    durationMs: true,
    status: true,
    errorMessage: true,
    errorCode: true,
    outputSize: true
  })
  .extend({
    status: mcpExecutionStatusSchema.default('success')
  })

export type CreateMCPToolExecution = z.infer<typeof createMCPToolExecutionSchema>

/**
 * Schema for updating an MCP tool execution
 */
export const updateMCPToolExecutionSchema = mcpToolExecutionSchema.partial().omit({
  id: true,
  toolName: true,
  projectId: true,
  startedAt: true
})

export type UpdateMCPToolExecution = z.infer<typeof updateMCPToolExecutionSchema>

/**
 * Schema for MCP tool statistics
 */
export const mcpToolStatisticsSchema = z.object({
  id: z.number(),
  toolName: z.string(),
  projectId: z.number().nullable().optional(),
  periodStart: unixTSSchemaSpec,
  periodEnd: unixTSSchemaSpec,
  periodType: mcpStatisticsPeriodSchema,
  executionCount: z.number().default(0),
  successCount: z.number().default(0),
  errorCount: z.number().default(0),
  timeoutCount: z.number().default(0),
  totalDurationMs: z.number().default(0),
  avgDurationMs: z.number().default(0),
  minDurationMs: z.number().nullable().optional(),
  maxDurationMs: z.number().nullable().optional(),
  totalOutputSize: z.number().default(0),
  metadata: z.string().nullable().optional() // JSON string
})

export type MCPToolStatistics = z.infer<typeof mcpToolStatisticsSchema>

/**
 * Schema for MCP tool execution chains
 */
export const mcpToolChainSchema = z.object({
  id: z.number(),
  chainId: z.string(),
  executionId: z.number(),
  parentExecutionId: z.number().nullable().optional(),
  position: z.number(),
  createdAt: unixTSSchemaSpec
})

export type MCPToolChain = z.infer<typeof mcpToolChainSchema>

/**
 * Schema for MCP tool usage patterns
 */
export const mcpToolPatternSchema = z.object({
  id: z.number(),
  projectId: z.number().nullable().optional(),
  patternType: mcpPatternTypeSchema,
  patternData: z.string(), // JSON string
  occurrenceCount: z.number().default(1),
  firstSeen: unixTSSchemaSpec,
  lastSeen: unixTSSchemaSpec,
  metadata: z.string().nullable().optional() // JSON string
})

export type MCPToolPattern = z.infer<typeof mcpToolPatternSchema>

// --- Query Schemas ---

/**
 * Schema for querying MCP tool executions
 */
export const mcpExecutionQuerySchema = z.object({
  projectId: z.number().optional(),
  toolName: z.string().optional(),
  status: mcpExecutionStatusSchema.optional(),
  startDate: unixTSSchemaSpec.optional(),
  endDate: unixTSSchemaSpec.optional(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  limit: z.number().min(1).max(1000).default(100),
  offset: z.number().min(0).default(0),
  sortBy: z.enum(['startedAt', 'duration', 'toolName']).default('startedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
})

export type MCPExecutionQuery = z.infer<typeof mcpExecutionQuerySchema>

/**
 * Schema for MCP execution query from HTTP request (with string to number transforms)
 */
export const mcpExecutionQueryRequestSchema = z.object({
  projectId: z
    .string()
    .transform((val) => parseInt(val, 10))
    .optional(),
  toolName: z.string().optional(),
  status: mcpExecutionStatusSchema.optional(),
  startDate: z
    .string()
    .transform((val) => parseInt(val, 10))
    .optional(),
  endDate: z
    .string()
    .transform((val) => parseInt(val, 10))
    .optional(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  limit: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().min(1).max(1000))
    .optional()
    .default('100'),
  offset: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().min(0))
    .optional()
    .default('0'),
  sortBy: z.enum(['startedAt', 'duration', 'toolName']).optional().default('startedAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc')
})

/**
 * Schema for analytics aggregation request
 */
export const mcpAnalyticsRequestSchema = z.object({
  projectId: z.number().optional(),
  toolNames: z.array(z.string()).optional(),
  period: mcpStatisticsPeriodSchema.optional(),
  startDate: unixTSSchemaSpec.optional(),
  endDate: unixTSSchemaSpec.optional(),
  groupBy: z.array(z.enum(['tool', 'project', 'status', 'day', 'hour'])).optional()
})

export type MCPAnalyticsRequest = z.infer<typeof mcpAnalyticsRequestSchema>

// --- Response Schemas ---

/**
 * Schema for tool execution summary
 */
export const mcpToolSummarySchema = z.object({
  toolName: z.string(),
  totalExecutions: z.number(),
  successRate: z.number(),
  errorRate: z.number(),
  timeoutRate: z.number(),
  avgDurationMs: z.number(),
  minDurationMs: z.number().nullable(),
  maxDurationMs: z.number().nullable(),
  totalOutputSize: z.number(),
  lastExecutedAt: unixTSSchemaSpec.nullable()
})

export type MCPToolSummary = z.infer<typeof mcpToolSummarySchema>

/**
 * Schema for analytics overview
 */
export const mcpAnalyticsOverviewSchema = z.object({
  totalExecutions: z.number(),
  uniqueTools: z.number(),
  overallSuccessRate: z.number(),
  avgExecutionTime: z.number(),
  topTools: z.array(mcpToolSummarySchema),
  recentErrors: z.array(mcpToolExecutionSchema),
  executionTrend: z.array(
    z.object({
      timestamp: unixTSSchemaSpec,
      count: z.number(),
      avgDuration: z.number()
    })
  )
})

export type MCPAnalyticsOverview = z.infer<typeof mcpAnalyticsOverviewSchema>

/**
 * Schema for execution timeline data
 */
export const mcpExecutionTimelineSchema = z.object({
  timestamp: unixTSSchemaSpec,
  toolCounts: z.record(z.string(), z.number()),
  totalCount: z.number(),
  avgDuration: z.number(),
  successCount: z.number(),
  errorCount: z.number()
})

export type MCPExecutionTimeline = z.infer<typeof mcpExecutionTimelineSchema>

/**
 * Schema for paginated execution results
 */
export const mcpExecutionListResponseSchema = z.object({
  executions: z.array(mcpToolExecutionSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number()
})

export type MCPExecutionListResponse = z.infer<typeof mcpExecutionListResponseSchema>

// --- Export all schemas ---

export const mcpTrackingSchemas = {
  // Core schemas
  mcpToolExecution: mcpToolExecutionSchema,
  createMCPToolExecution: createMCPToolExecutionSchema,
  updateMCPToolExecution: updateMCPToolExecutionSchema,
  mcpToolStatistics: mcpToolStatisticsSchema,
  mcpToolChain: mcpToolChainSchema,
  mcpToolPattern: mcpToolPatternSchema,

  // Query schemas
  mcpExecutionQuery: mcpExecutionQuerySchema,
  mcpExecutionQueryRequest: mcpExecutionQueryRequestSchema,
  mcpAnalyticsRequest: mcpAnalyticsRequestSchema,

  // Response schemas
  mcpToolSummary: mcpToolSummarySchema,
  mcpAnalyticsOverview: mcpAnalyticsOverviewSchema,
  mcpExecutionTimeline: mcpExecutionTimelineSchema,
  mcpExecutionListResponse: mcpExecutionListResponseSchema,

  // Enums
  mcpExecutionStatus: mcpExecutionStatusSchema,
  mcpStatisticsPeriod: mcpStatisticsPeriodSchema,
  mcpPatternType: mcpPatternTypeSchema
}
