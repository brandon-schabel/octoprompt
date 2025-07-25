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
export const projectViewSchema = z.enum([
  'context',
  'stats', 
  'tickets',
  'summarization',
  'assets',
  'git',
  'git-history',
  'mcp-analytics'
]).catch('context').optional()

// Route-specific search schemas
export const projectsSearchSchema = tabSearchSchema.merge(projectIdSearchSchema).extend({
  activeView: projectViewSchema
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

// Type exports for easier usage
export type ProjectsSearch = z.infer<typeof projectsSearchSchema>
export type ProjectView = z.infer<typeof projectViewSchema>
export type ChatSearch = z.infer<typeof chatSearchSchema>
export type TicketsSearch = z.infer<typeof ticketsSearchSchema>
export type AssetsSearch = z.infer<typeof assetsSearchSchema>

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
