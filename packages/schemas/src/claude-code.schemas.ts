import { z } from '@hono/zod-openapi'

// Claude Code message content types
export const ClaudeTextContentSchema = z.object({
  type: z.literal('text'),
  text: z.string()
})

export const ClaudeImageContentSchema = z.object({
  type: z.literal('image'),
  source: z.object({
    type: z.literal('base64'),
    media_type: z.string(),
    data: z.string()
  })
})

export const ClaudeToolResultContentSchema = z.object({
  type: z.literal('tool_result'),
  tool_use_id: z.string(),
  content: z.string()
})

export const ClaudeToolUseContentSchema = z.object({
  type: z.literal('tool_use'),
  id: z.string(),
  name: z.string(),
  input: z.any()
})

export const ClaudeContentSchema = z.union([
  ClaudeTextContentSchema,
  ClaudeImageContentSchema,
  ClaudeToolResultContentSchema,
  ClaudeToolUseContentSchema,
  z.string() // For simple string content
])

// Token usage breakdown
export const TokenUsageSchema = z.object({
  input_tokens: z.number().optional(),
  cache_creation_input_tokens: z.number().optional(),
  cache_read_input_tokens: z.number().optional(),
  output_tokens: z.number().optional(),
  service_tier: z.string().optional()
})

// Tool use result (for todo tracking etc)
export const ToolUseResultSchema = z.object({
  oldTodos: z.array(z.any()).optional(),
  newTodos: z.array(z.any()).optional()
}).passthrough() // Allow additional fields

// Claude Code message schema (from JSONL files)
export const ClaudeMessageSchema = z.object({
  type: z.enum(['user', 'assistant', 'result']),
  message: z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.union([
      z.string(),
      z.array(ClaudeContentSchema)
    ]),
    id: z.string().optional(), // Message ID (for assistant messages)
    model: z.string().optional(), // Model used (for assistant messages)
    stop_reason: z.string().nullable().optional(),
    stop_sequence: z.string().nullable().optional(),
    usage: TokenUsageSchema.optional() // Token usage breakdown
  }),
  timestamp: z.string(), // ISO 8601 format
  sessionId: z.string(),
  uuid: z.string().optional(), // Unique message identifier (optional for backward compatibility)
  parentUuid: z.string().optional(), // Parent message UUID for threading
  requestId: z.string().optional(), // Request tracking ID
  userType: z.string().optional(), // "external" or other types
  isSidechain: z.boolean().optional(), // Sidechain flag
  cwd: z.string().optional(), // Working directory
  version: z.string().optional(), // Claude Code version
  gitBranch: z.string().optional(), // Git branch at message time
  toolUseResult: ToolUseResultSchema.optional(), // Tool use results (todos, etc)
  // Legacy fields (kept for backward compatibility)
  tokensUsed: z.number().optional(),
  costUsd: z.number().optional(),
  durationMs: z.number().optional(),
  model: z.string().optional()
})

export type ClaudeMessage = z.infer<typeof ClaudeMessageSchema>
export type TokenUsage = z.infer<typeof TokenUsageSchema>
export type ToolUseResult = z.infer<typeof ToolUseResultSchema>

// Session metadata derived from messages
export const ClaudeSessionSchema = z.object({
  sessionId: z.string(),
  projectPath: z.string(),
  startTime: z.string(),
  lastUpdate: z.string(),
  messageCount: z.number(),
  gitBranch: z.string().optional(),
  cwd: z.string().optional(),
  // Token breakdown totals
  tokenUsage: z.object({
    totalInputTokens: z.number(),
    totalCacheCreationTokens: z.number(),
    totalCacheReadTokens: z.number(),
    totalOutputTokens: z.number(),
    totalTokens: z.number() // Sum of all token types
  }).optional(),
  serviceTiers: z.array(z.string()).optional(), // All service tiers used
  // Legacy fields
  totalTokensUsed: z.number().optional(),
  totalCostUsd: z.number().optional()
})

export type ClaudeSession = z.infer<typeof ClaudeSessionSchema>

// Project data extracted from Claude files
export const ClaudeProjectDataSchema = z.object({
  projectPath: z.string(),
  encodedPath: z.string(), // The encoded directory name
  sessions: z.array(ClaudeSessionSchema),
  totalMessages: z.number(),
  firstMessageTime: z.string().optional(),
  lastMessageTime: z.string().optional(),
  branches: z.array(z.string()), // All git branches seen in messages
  workingDirectories: z.array(z.string()) // All cwds seen
})

export type ClaudeProjectData = z.infer<typeof ClaudeProjectDataSchema>

// API Response schemas
export const ClaudeSessionsResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(ClaudeSessionSchema)
}).openapi('ClaudeSessionsResponse')

export const ClaudeMessagesResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(ClaudeMessageSchema)
}).openapi('ClaudeMessagesResponse')

export const ClaudeProjectDataResponseSchema = z.object({
  success: z.literal(true),
  data: ClaudeProjectDataSchema
}).openapi('ClaudeProjectDataResponse')

// Query parameter schemas
export const ClaudeSessionQuerySchema = z.object({
  search: z.string().optional(),
  branch: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.number().int().positive().optional().default(50),
  offset: z.number().int().min(0).optional().default(0)
}).openapi('ClaudeSessionQuery')

export const ClaudeMessageQuerySchema = z.object({
  search: z.string().optional(),
  role: z.enum(['user', 'assistant', 'all']).optional().default('all'),
  limit: z.number().int().positive().optional().default(100),
  offset: z.number().int().min(0).optional().default(0)
}).openapi('ClaudeMessageQuery')