import { z } from '@hono/zod-openapi'
import {
  unixTSSchemaSpec,
  unixTSOptionalSchemaSpec,
  entityIdSchema,
  entityIdOptionalSchema,
  entityIdNullableOptionalSchema,
  entityIdArraySchema
} from './schema-utils'
import { createEntitySchemas } from './schema-factories'

// Ticket schemas using factory pattern
const ticketSchemas = createEntitySchemas('Ticket', {
  projectId: entityIdSchema,
  title: z.string().min(1),
  overview: z.string().optional(),
  status: z.enum(['open', 'in_progress', 'closed']).optional(),
  priority: z.enum(['low', 'normal', 'high']).optional(),
  suggestedFileIds: z.array(z.string()).optional(),
  suggestedAgentIds: z.array(z.string()).optional(),
  suggestedPromptIds: z.array(entityIdSchema).optional(),
  // Queue integration fields (unified flow system)
  queueId: entityIdNullableOptionalSchema,
  queuePosition: z.number().nullable().optional(),
  queueStatus: z.enum(['queued', 'in_progress', 'completed', 'failed', 'cancelled']).nullable().optional(),
  queuePriority: z.number().optional(),
  queuedAt: unixTSOptionalSchemaSpec,
  queueStartedAt: unixTSOptionalSchemaSpec,
  queueCompletedAt: unixTSOptionalSchemaSpec,
  queueAgentId: z.string().nullable().optional(),
  queueErrorMessage: z.string().nullable().optional(),
  estimatedProcessingTime: z.number().nullable().optional(),
  actualProcessingTime: z.number().nullable().optional()
})

export const TicketSchema = ticketSchemas.base

// Enhanced Task schema - keeping original definition to maintain compatibility
export const TicketTaskSchema = z
  .object({
    id: entityIdSchema,
    ticketId: entityIdSchema,
    content: z.string().min(1), // Keep as task title/summary
    description: z.string().optional(), // NEW: Detailed task breakdown
    suggestedFileIds: z.array(z.string()).optional(), // NEW: File associations
    done: z.boolean().default(false),
    orderIndex: z.number().min(0),
    estimatedHours: z.number().nullable().optional(), // NEW: Time estimation
    dependencies: z.array(entityIdSchema).optional(), // NEW: Task dependencies
    tags: z.array(z.string()).optional(), // NEW: Tags for categorization
    agentId: z.string().nullable().optional(), // NEW: Assigned agent for this task
    suggestedPromptIds: z.array(entityIdSchema).optional(), // NEW: Suggested prompts
    // Queue integration fields (unified flow system)
    queueId: entityIdNullableOptionalSchema,
    queuePosition: z.number().nullable().optional(),
    queueStatus: z.enum(['queued', 'in_progress', 'completed', 'failed', 'cancelled']).nullable().optional(),
    queuePriority: z.number().optional(),
    queuedAt: unixTSOptionalSchemaSpec,
    queueStartedAt: unixTSOptionalSchemaSpec,
    queueCompletedAt: unixTSOptionalSchemaSpec,
    queueAgentId: z.string().nullable().optional(),
    queueErrorMessage: z.string().nullable().optional(),
    estimatedProcessingTime: z.number().nullable().optional(),
    actualProcessingTime: z.number().nullable().optional(),
    created: unixTSSchemaSpec,
    updated: unixTSSchemaSpec
  })
  .openapi('TicketTask')

// Create schemas - manually define to avoid complex omit operations
export const CreateTicketBodySchema = z
  .object({
    projectId: entityIdSchema,
    title: z.string().min(1),
    overview: z.string().default(''),
    status: z.enum(['open', 'in_progress', 'closed']).default('open'),
    priority: z.enum(['low', 'normal', 'high']).default('normal'),
    suggestedFileIds: z.array(z.string()).optional(),
    suggestedAgentIds: z.array(z.string()).optional(),
    suggestedPromptIds: z.array(entityIdSchema).optional()
  })
  .openapi('CreateTicketBody')

export const UpdateTicketBodySchema = z
  .object({
    title: z.string().min(1).optional(),
    overview: z.string().optional(),
    status: z.enum(['open', 'in_progress', 'closed']).optional(),
    priority: z.enum(['low', 'normal', 'high']).optional(),
    suggestedFileIds: z.array(z.string()).optional(),
    suggestedAgentIds: z.array(z.string()).optional(),
    suggestedPromptIds: z.array(entityIdSchema).optional()
  })
  .openapi('UpdateTicketBody')

export const CreateTaskBodySchema = z
  .object({
    content: z.string().min(1),
    description: z.string().optional(),
    suggestedFileIds: z.array(z.string()).optional(),
    estimatedHours: z.number().nullable().optional(),
    dependencies: z.array(entityIdSchema).optional(),
    tags: z.array(z.string()).optional(),
    agentId: z.string().optional(),
    suggestedPromptIds: z.array(entityIdSchema).optional()
  })
  .openapi('CreateTaskBody')

export const UpdateTaskBodySchema = z
  .object({
    content: z.string().min(1).optional(),
    description: z.string().optional(),
    suggestedFileIds: z.array(z.string()).optional(),
    done: z.boolean().optional(),
    estimatedHours: z.number().nullable().optional(),
    dependencies: z.array(entityIdSchema).optional(),
    tags: z.array(z.string()).optional(),
    agentId: z.string().optional(),
    suggestedPromptIds: z.array(entityIdSchema).optional()
  })
  .openapi('UpdateTaskBody')

export const ReorderTasksBodySchema = z
  .object({
    tasks: z.array(
      z.object({
        taskId: entityIdSchema,
        orderIndex: z.number().min(0)
      })
    )
  })
  .openapi('ReorderTasksBody')

// AI-related schemas
export const TaskSuggestionsSchema = z
  .object({
    tasks: z.array(
      z.object({
        title: z.string(),
        description: z.string().optional(),
        suggestedFileIds: z.array(z.string()).default([]), // NEW: Direct file IDs
        estimatedHours: z.number().nullable().optional(), // NEW
        tags: z.array(z.string()).default([]), // NEW
        suggestedAgentId: z.string().optional(), // NEW: Suggested agent for this task
        files: z
          .array(
            z.object({
              fileId: z.string(),
              fileName: z.string()
            })
          )
          .optional() // Keep for backward compatibility
      })
    )
  })
  .openapi('TaskSuggestions')

export const SuggestTasksBodySchema = z
  .object({
    userContext: z.string().optional()
  })
  .openapi('SuggestTasksBody')

export const TicketSuggestFilesBodySchema = z
  .object({
    extraUserInput: z.string().optional()
  })
  .openapi('TicketSuggestFilesBody')

// Combined schemas
export const TicketWithTasksSchema = z
  .object({
    ticket: TicketSchema,
    tasks: z.array(TicketTaskSchema)
  })
  .openapi('TicketWithTasks')

export const TicketWithTaskCountSchema = z
  .object({
    ticket: TicketSchema,
    taskCount: z.number(),
    completedTaskCount: z.number()
  })
  .openapi('TicketWithTaskCount')

// Type exports
export type Ticket = z.infer<typeof TicketSchema>
export type TicketTask = z.infer<typeof TicketTaskSchema>
export type CreateTicketBody = z.infer<typeof CreateTicketBodySchema>
export type UpdateTicketBody = z.infer<typeof UpdateTicketBodySchema>
export type CreateTaskBody = z.infer<typeof CreateTaskBodySchema>
export type UpdateTaskBody = z.infer<typeof UpdateTaskBodySchema>
export type ReorderTasksBody = z.infer<typeof ReorderTasksBodySchema>
export type TaskSuggestions = z.infer<typeof TaskSuggestionsSchema>
export type TicketWithTasks = z.infer<typeof TicketWithTasksSchema>
export type TicketWithTaskCount = z.infer<typeof TicketWithTaskCountSchema>

// API validation schemas
export const ticketsApiValidation = {
  create: {
    body: CreateTicketBodySchema
  },
  update: {
    body: UpdateTicketBodySchema,
    params: z.object({
      ticketId: z.string()
    })
  },
  getOrDelete: {
    params: z.object({
      ticketId: z.string()
    })
  },
  suggestTasks: {
    body: SuggestTasksBodySchema,
    params: z.object({
      ticketId: z.string()
    })
  },
  suggestFiles: {
    body: TicketSuggestFilesBodySchema,
    params: z.object({
      ticketId: z.string()
    })
  },
  createTask: {
    body: CreateTaskBodySchema,
    params: z.object({
      ticketId: z.string()
    })
  },
  updateTask: {
    body: UpdateTaskBodySchema,
    params: z.object({
      ticketId: z.string(),
      taskId: z.string()
    })
  },
  deleteTask: {
    params: z.object({
      ticketId: z.string(),
      taskId: z.string()
    })
  },
  reorderTasks: {
    body: ReorderTasksBodySchema,
    params: z.object({
      ticketId: z.string()
    })
  },
  linkFiles: {
    body: z.object({
      fileIds: z.array(z.string())
    }),
    params: z.object({
      ticketId: z.string()
    })
  }
}
