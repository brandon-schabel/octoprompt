import { z } from 'zod'
import { idSchemaSpec, unixTSSchemaSpec } from './schema-utils'

/**
 * Schema for tracking the currently active tab for a project
 */
export const activeTabDataSchema = z.object({
  projectId: idSchemaSpec,
  activeTabId: z.number().min(0).default(0),
  clientId: z.string().optional(), // Optional: for tracking per-client if needed
  lastUpdated: unixTSSchemaSpec,
  // New: Include essential tab metadata for richer context
  tabMetadata: z
    .object({
      displayName: z.string().optional(),
      selectedFiles: z.array(z.number()).optional(),
      selectedPrompts: z.array(z.number()).optional(),
      userPrompt: z.string().optional(),
      fileSearch: z.string().optional(),
      contextLimit: z.number().optional(),
      preferredEditor: z.enum(['vscode', 'cursor', 'webstorm']).optional(),
      suggestedFileIds: z.array(z.number()).optional(),
      ticketSearch: z.string().optional(),
      ticketSort: z.enum(['created_asc', 'created_desc', 'status', 'priority']).optional(),
      ticketStatusFilter: z.enum(['all', 'open', 'in_progress', 'closed']).optional()
    })
    .optional()
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
  clientId: z.string().optional(),
  // Include tab metadata in the update request
  tabMetadata: activeTabDataSchema.shape.tabMetadata.optional()
})

export type UpdateActiveTabBody = z.infer<typeof updateActiveTabSchema>
