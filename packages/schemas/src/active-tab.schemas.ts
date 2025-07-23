import { z } from 'zod'
import { idSchemaSpec, unixTSSchemaSpec } from './schema-utils'

/**
 * Schema for tracking the currently active tab for a project
 */
export const activeTabDataSchema = z.object({
  projectId: idSchemaSpec,
  activeTabId: z.number().min(0).default(0),
  clientId: z.string().optional(), // Optional: for tracking per-client if needed
  lastUpdated: unixTSSchemaSpec
})

export const activeTabSchema = z.object({
  id: idSchemaSpec,
  data: activeTabDataSchema,
  created: unixTSSchemaSpec,
  updated: unixTSSchemaSpec
})

export type ActiveTabData = z.infer<typeof activeTabDataSchema>
export type ActiveTab = z.infer<typeof activeTabSchema>

// Request/Response schemas for API
export const updateActiveTabSchema = z.object({
  tabId: z.number().min(0),
  clientId: z.string().optional()
})

export type UpdateActiveTabBody = z.infer<typeof updateActiveTabSchema>