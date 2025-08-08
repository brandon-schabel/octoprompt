import { z } from 'zod'

/**
 * Common search parameter schemas for TanStack Router
 * Using .catch() for graceful error handling and better UX
 */

// Base schemas for common parameters
export const projectIdSearchSchema = z.object({
  projectId: z.coerce.number().optional().catch(undefined)
})

export const tabSearchSchema = z.object({
  tab: z.string().catch('').optional()
})

// Project view tabs enum
export const projectViewSchema = z
  .enum(['context', 'flow', 'git', 'manage', 'assets', 'claude-code'])
  .catch('context')
  .optional()

// Git view sub-tabs enum
export const gitViewSchema = z
  .enum(['changes', 'history', 'branches', 'stashes', 'worktrees'])
  .catch('changes')
  .optional()

// Flow view sub-tabs enum (combines tickets, tasks, and queues)
export const flowViewSchema = z
  .enum(['queues', 'tickets', 'kanban', 'analytics', 'overview', 'items', 'timeline'])
  .catch('queues')
  .optional()

// Asset view sub-tabs enum
export const assetViewSchema = z
  .enum(['project-docs', 'architecture', 'api-docs', 'database-schema', 'user-guides', 'diagrams', 'recent'])
  .catch('project-docs')
  .optional()

// Claude Code view sub-tabs enum
export const claudeCodeViewSchema = z
  .enum(['agents', 'commands', 'mcp', 'sessions', 'chats', 'hooks', 'settings'])
  .catch('agents')
  .optional()

// Manage view sub-tabs enum
export const manageViewSchema = z
  .enum(['statistics', 'mcp-analytics', 'summarization', 'project-settings'])
  .catch('statistics')
  .optional()

// Deprecated - kept for backward compatibility, will be removed later
export const ticketViewSchema = flowViewSchema
export const queueViewSchema = flowViewSchema

// Route-specific search schemas
export const projectsSearchSchema = tabSearchSchema.merge(projectIdSearchSchema).extend({
  activeView: projectViewSchema,
  gitView: gitViewSchema,
  flowView: flowViewSchema,
  ticketView: flowViewSchema, // Deprecated - mapped to flowView for backward compatibility
  assetView: assetViewSchema,
  claudeCodeView: claudeCodeViewSchema,
  manageView: manageViewSchema,
  queueView: flowViewSchema, // Deprecated - mapped to flowView for backward compatibility
  selectedTicketId: z.coerce.number().optional().catch(undefined),
  selectedQueueId: z.coerce.number().optional().catch(undefined),
  gitBranch: z.string().optional().catch(undefined),
  section: z.string().optional().catch(undefined),
  sessionId: z.string().optional().catch(undefined)
})

export const chatSearchSchema = z.object({
  prefill: z.boolean().catch(false).optional(),
  projectId: z.coerce.number().optional().catch(undefined)
})

export const ticketsSearchSchema = z.object({
  ticketId: z.coerce.number().optional().catch(undefined),
  status: z.enum(['open', 'in_progress', 'closed']).catch('open').optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).catch('normal').optional()
})

export const assetsSearchSchema = z.object({
  type: z.enum(['image', 'svg', 'icon']).catch('image').optional(),
  projectId: z.coerce.number().optional().catch(undefined)
})

// Settings page search schema
export const settingsTabSchema = z.enum(['general', 'local-providers', 'global-mcp']).catch('general').optional()

export const settingsSearchSchema = z.object({
  tab: settingsTabSchema
})

// Queue dashboard search schema
export const queueDashboardSearchSchema = z.object({
  projectId: z.coerce.number().optional().catch(undefined)
})

// Type exports for easier usage
export type ProjectsSearch = z.infer<typeof projectsSearchSchema>
export type ProjectView = z.infer<typeof projectViewSchema>
export type GitView = z.infer<typeof gitViewSchema>
export type FlowView = z.infer<typeof flowViewSchema>
export type TicketView = z.infer<typeof ticketViewSchema> // Deprecated
export type AssetView = z.infer<typeof assetViewSchema>
export type ClaudeCodeView = z.infer<typeof claudeCodeViewSchema>
export type ManageView = z.infer<typeof manageViewSchema>
export type QueueView = z.infer<typeof queueViewSchema> // Deprecated
export type ChatSearch = z.infer<typeof chatSearchSchema>
export type TicketsSearch = z.infer<typeof ticketsSearchSchema>
export type AssetsSearch = z.infer<typeof assetsSearchSchema>
export type SettingsSearch = z.infer<typeof settingsSearchSchema>
export type SettingsTab = z.infer<typeof settingsTabSchema>
export type QueueDashboardSearch = z.infer<typeof queueDashboardSearchSchema>

// Utility function to merge search schemas
export function mergeSearchSchemas<T extends z.ZodObject<any>, U extends z.ZodObject<any>>(
  schema1: T,
  schema2: U
): z.ZodObject<T['shape'] & U['shape']> {
  return schema1.merge(schema2) as any
}

// Default search params to strip from URLs (when they match these values)
export const defaultSearchParams = {
  tab: '',
  projectId: undefined,
  prefill: false,
  status: 'open',
  priority: 'normal',
  type: 'image'
} as const
