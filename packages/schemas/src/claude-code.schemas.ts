import { z } from 'zod'

export const ClaudeCodeSessionStatusEnum = z.enum(['idle', 'running', 'error', 'active'])

export const ClaudeCodeSessionSchema = z.object({
  id: z.string(),
  created: z.number(),
  updated: z.number(),
  projectPath: z.string().optional(),
  status: ClaudeCodeSessionStatusEnum,
  lastActivity: z.number()
})

export const ClaudeCodeRequestSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  sessionId: z.string().optional(),
  maxTurns: z.number().int().min(1).max(20).default(5),
  projectPath: z.string().optional(),
  projectId: z.number().optional(),
  includeProjectContext: z.boolean().optional().default(false),
  allowedTools: z.array(z.string()).optional(),
  systemPrompt: z.string().optional(),
  outputFormat: z.enum(['text', 'json', 'stream-json']).default('json')
})

export const ClaudeCodeContinueRequestSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required')
})

export const ClaudeCodeMessageSchema = z.object({
  id: z.string(),
  type: z.enum(['user', 'assistant', 'system', 'result']),
  content: z.string().optional(),
  created: z.number(),
  updated: z.number(),
  timestamp: z.number(), // Keep for backward compatibility
  // Additional fields for different message types
  session_id: z.string().optional(),
  is_error: z.boolean().optional(),
  total_cost_usd: z.number().optional(),
  duration_ms: z.number().optional(),
  num_turns: z.number().optional(),
  result: z.string().optional(),
  message: z.any().optional() // For assistant messages with complex structure
})

export const ClaudeCodeResultSchema = z.object({
  sessionId: z.string(),
  messages: z.array(ClaudeCodeMessageSchema),
  totalCostUsd: z.number(),
  isError: z.boolean(),
  durationMs: z.number(),
  numTurns: z.number()
})

export const ClaudeCodeSessionListSchema = z.object({
  sessions: z.array(ClaudeCodeSessionSchema)
})

// Response schemas for API endpoints
export const ClaudeCodeSessionResponseSchema = z.object({
  success: z.boolean(),
  data: ClaudeCodeSessionSchema
})

export const ClaudeCodeSessionListResponseSchema = z.object({
  success: z.boolean(),
  data: ClaudeCodeSessionListSchema
})

export const ClaudeCodeResultResponseSchema = z.object({
  success: z.boolean(),
  data: ClaudeCodeResultSchema
})

// Type exports
export type ClaudeCodeSession = z.infer<typeof ClaudeCodeSessionSchema>
export type ClaudeCodeRequest = z.infer<typeof ClaudeCodeRequestSchema>
export type ClaudeCodeContinueRequest = z.infer<typeof ClaudeCodeContinueRequestSchema>
export type ClaudeCodeMessage = z.infer<typeof ClaudeCodeMessageSchema>
export type ClaudeCodeResult = z.infer<typeof ClaudeCodeResultSchema>
export type ClaudeCodeSessionList = z.infer<typeof ClaudeCodeSessionListSchema>

// Additional utility schemas
export const ClaudeCodeToolSchema = z.enum([
  'Read',
  'Write',
  'Edit',
  'MultiEdit',
  'Bash',
  'Grep',
  'Glob',
  'LS',
  'Task',
  'TodoRead',
  'TodoWrite',
  'WebFetch',
  'WebSearch',
  'NotebookRead',
  'NotebookEdit'
])

export const ClaudeCodeExecutionOptionsSchema = z.object({
  maxTurns: z.number().int().min(1).max(20).default(5),
  allowedTools: z.array(ClaudeCodeToolSchema).optional(),
  systemPrompt: z.string().optional(),
  projectPath: z.string().optional(),
  projectId: z.number().optional(),
  includeProjectContext: z.boolean().optional().default(false),
  timeoutMs: z.number().int().min(1000).max(600000).default(300000) // 5 minutes default
})

export type ClaudeCodeTool = z.infer<typeof ClaudeCodeToolSchema>
export type ClaudeCodeExecutionOptions = z.infer<typeof ClaudeCodeExecutionOptionsSchema>
