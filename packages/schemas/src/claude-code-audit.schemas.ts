import { z } from 'zod'

/**
 * Schema for Claude Code audit log entries
 */
export const ClaudeCodeAuditLogSchema = z.object({
  id: z.number(),
  sessionId: z.string(),
  projectId: z.number(),
  timestamp: z.number(),
  action: z.enum([
    'file_created',
    'file_modified',
    'file_deleted',
    'command_executed',
    'session_started',
    'session_completed'
  ]),
  details: z.object({
    filePath: z.string().optional(),
    command: z.string().optional(),
    exitCode: z.number().optional(),
    error: z.string().optional(),
    changes: z
      .object({
        additions: z.number().optional(),
        deletions: z.number().optional(),
        filesAffected: z.array(z.string()).optional()
      })
      .optional()
  }),
  userId: z.string().optional(),
  metadata: z.record(z.any()).optional()
})

export type ClaudeCodeAuditLog = z.infer<typeof ClaudeCodeAuditLogSchema>

/**
 * Schema for getting audit logs with filters
 */
export const GetAuditLogsQuerySchema = z.object({
  sessionId: z.string().optional(),
  projectId: z.coerce.number().optional(),
  startTime: z.coerce.number().optional(),
  endTime: z.coerce.number().optional(),
  action: z
    .enum(['file_created', 'file_modified', 'file_deleted', 'command_executed', 'session_started', 'session_completed'])
    .optional(),
  limit: z.coerce.number().default(100),
  offset: z.coerce.number().default(0)
})

export type GetAuditLogsQuery = z.infer<typeof GetAuditLogsQuerySchema>

/**
 * Schema for audit log summary
 */
export const AuditLogSummarySchema = z.object({
  sessionId: z.string(),
  projectId: z.number(),
  totalActions: z.number(),
  fileChanges: z.object({
    created: z.number(),
    modified: z.number(),
    deleted: z.number()
  }),
  commandsExecuted: z.number(),
  duration: z.number(),
  startTime: z.number(),
  endTime: z.number()
})

export type AuditLogSummary = z.infer<typeof AuditLogSummarySchema>
