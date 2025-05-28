import { z } from 'zod'
import { idSchemaSpec, unixTSArrayOptionalSchemaSpec, unixTSArraySchemaSpec, unixTSSchemaSpec } from './schema-utils'

// Fix the core issue: ensure suggestedFileIds is handled consistently across all schemas

export const suggestedFileIdsSchema = z.preprocess((val) => {
  if (val === undefined || val === null) return []
  if (Array.isArray(val)) return val
  if (typeof val === 'string') {
    if (val === '' || val.trim() === '') return []
    try {
      const parsed = JSON.parse(val)
      return Array.isArray(parsed) ? parsed : []
    } catch (e) {
      return []
    }
  }
  return []
}, z.array(z.number())).default([])

// Base schemas for storage/service layer
export const TicketCreateSchema = z.object({
  projectId: unixTSSchemaSpec,
  title: z.string(),
  overview: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  suggestedFileIds: suggestedFileIdsSchema
})

export const TicketReadSchema = z.object({
  projectId: unixTSSchemaSpec,
  id: unixTSSchemaSpec,
  title: z.string(),
  overview: z.string(),
  status: z.enum(['open', 'in_progress', 'done', 'closed']),
  priority: z.enum(['low', 'normal', 'high']),
  suggestedFileIds: suggestedFileIdsSchema,
  created: unixTSSchemaSpec,
  updated: unixTSSchemaSpec,
})

export const TicketUpdateSchema = z.object({
  title: z.string().optional(),
  overview: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  suggestedFileIds: suggestedFileIdsSchema
})

// Task schemas
export const TicketTaskCreateSchema = z.object({
  ticketId: unixTSSchemaSpec,
  content: z.string(),
  done: z.boolean().optional(),
  orderIndex: z.number().optional()
})

export const TicketTaskReadSchema = z.object({
  id: unixTSSchemaSpec,
  ticketId: unixTSSchemaSpec,
  content: z.string(),
  done: z.preprocess((val) => {
    if (typeof val === 'number') return val === 1
    if (typeof val === 'boolean') return val
    return false
  }, z.boolean()),
  orderIndex: z.number(),
  created: unixTSSchemaSpec,
  updated: unixTSSchemaSpec,
})

// File association schema
export const TicketFileReadSchema = z.object({
  ticketId: unixTSSchemaSpec,
  fileId: unixTSSchemaSpec,
})

// Task suggestions schema
export const TaskSuggestionsZodSchema = z.object({
  tasks: z.array(
    z.object({
      title: z.string(),
      description: z.string().optional(),
      files: z
        .array(
          z.object({
            fileId: unixTSSchemaSpec,
            fileName: z.string()
          })
        )
        .optional()
    })
  )
})
export type TaskSuggestions = z.infer<typeof TaskSuggestionsZodSchema>

export const createTicketSchema = z.object({
  projectId: idSchemaSpec.default(-1),
  title: z.string().min(1),
  overview: z.string().default(''),
  status: z.enum(['open', 'in_progress', 'closed']).default('open'),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
  suggestedFileIds: suggestedFileIdsSchema
})

export const updateTicketSchema = z.object({
  title: z.string().min(1).optional(),
  overview: z.string().optional(),
  status: z.enum(['open', 'in_progress', 'done', 'closed']).optional(),
  priority: z.enum(['low', 'normal', 'high']).optional(),
  suggestedFileIds: suggestedFileIdsSchema
})

// Other request schemas
export const linkFilesSchema = z.object({
  fileIds: unixTSArraySchemaSpec
})

export const suggestTasksSchema = z.object({
  userContext: z.string().optional()
})

export const createTaskSchema = z.object({
  content: z.string().min(1)
})

export const updateTaskSchema = z.object({
  content: z.string().optional(),
  done: z.boolean().optional()
})

export const reorderTasksSchema = z.object({
  tasks: z.array(
    z.object({
      taskId: unixTSSchemaSpec, // FIXED: Use unixTSSchemaSpec instead of z.number()
      orderIndex: z.number().min(0)
    })
  )
})

export const updateSuggestedFilesSchema = z.object({
  suggestedFileIds: suggestedFileIdsSchema
})

// Parameter schemas - FIXED: All ID parameters now use unixTSSchemaSpec
export const updateTicketParamsSchema = z.object({
  ticketId: unixTSSchemaSpec,
})

export const getOrDeleteTicketParamsSchema = z.object({
  ticketId: unixTSSchemaSpec,
})

export const linkFilesParamsSchema = z.object({
  ticketId: unixTSSchemaSpec,
})

export const suggestTasksParamsSchema = z.object({
  ticketId: unixTSSchemaSpec,
})

export const updateSuggestedFilesParamsSchema = z.object({
  ticketId: unixTSSchemaSpec,
})

export const createTaskParamsSchema = z.object({
  ticketId: unixTSSchemaSpec,
})

export const updateTaskParamsSchema = z.object({
  ticketId: unixTSSchemaSpec,
  taskId: unixTSSchemaSpec, // ADDED: Missing taskId parameter
})

export const deleteTaskParamsSchema = z.object({
  ticketId: unixTSSchemaSpec,
  taskId: unixTSSchemaSpec, // ADDED: Missing taskId parameter  
})

export const reorderTasksParamsSchema = z.object({
  ticketId: unixTSSchemaSpec,
})

// API response schemas - FIXED preprocessing to handle storage format properly
export const TicketSchema = z
  .object({
    id: unixTSSchemaSpec,
    projectId: unixTSSchemaSpec,
    title: z.string().openapi({ description: 'Ticket title' }),
    overview: z.string().openapi({ description: 'Ticket description' }),
    status: z.enum(['open', 'in_progress', 'done', 'closed']).openapi({ description: 'Current ticket status' }),
    priority: z.enum(['low', 'normal', 'high']),
    suggestedFileIds: suggestedFileIdsSchema,
    created: unixTSSchemaSpec,
    updated: unixTSSchemaSpec,
  })
  .openapi('Ticket')

export const TaskSchema = z
  .object({
    id: unixTSSchemaSpec,
    ticketId: unixTSSchemaSpec,
    content: z.string().openapi({ description: 'Task content/description' }),
    done: z.boolean().openapi({ description: 'Whether the task is completed' }),
    orderIndex: z.number().openapi({ description: 'Task order within the ticket' }),
    created: unixTSSchemaSpec,
    updated: unixTSSchemaSpec,
  })
  .openapi('Task')

// Response wrapper schemas
export const TicketResponseSchema = z
  .object({
    success: z.literal(true),
    ticket: TicketSchema
  })
  .openapi('TicketResponse')

export const TicketListResponseSchema = z
  .object({
    success: z.literal(true),
    tickets: z.array(TicketSchema)
  })
  .openapi('TicketListResponse')

export const TaskResponseSchema = z
  .object({
    success: z.literal(true),
    task: TaskSchema
  })
  .openapi('TaskResponse')

export const TaskListResponseSchema = z
  .object({
    success: z.literal(true),
    tasks: z.array(TaskSchema)
  })
  .openapi('TaskListResponse')

export const LinkedFilesResponseSchema = z
  .object({
    success: z.literal(true),
    linkedFiles: z.array(
      z.object({
        ticketId: unixTSSchemaSpec,
        fileId: unixTSSchemaSpec,
      })
    )
  })
  .openapi('LinkedFilesResponse')

export const SuggestedTasksResponseSchema = z
  .object({
    success: z.literal(true),
    suggestedTasks: z.array(z.string())
  })
  .openapi('SuggestedTasksResponse')

export const SuggestedFilesResponseSchema = z
  .object({
    success: z.literal(true),
    recommendedFileIds: unixTSArraySchemaSpec,
    combinedSummaries: z.string().optional(),
    message: z.string().optional()
  })
  .openapi('SuggestedFilesResponse')

export const TicketWithTaskCountSchema = z
  .object({
    ticket: TicketSchema,
    taskCount: z.number(),
    completedTaskCount: z.number(),
  })
  .openapi('TicketWithTaskCount')

export const TicketWithTaskCountListResponseSchema = z
  .object({
    success: z.literal(true),
    ticketsWithCount: z.array(TicketWithTaskCountSchema)
  })
  .openapi('TicketWithTaskCountListResponse')

export const TicketWithTasksSchema = z
  .object({
    ticket: TicketSchema,
    tasks: z.array(TaskSchema)
  })
  .openapi('TicketWithTasks')

export const TicketWithTasksListResponseSchema = z
  .object({
    success: z.literal(true),
    ticketsWithTasks: z.array(TicketWithTasksSchema)
  })
  .openapi('TicketWithTasksListResponse')

export const BulkTasksResponseSchema = z
  .object({
    success: z.literal(true),
    tasks: z.record(z.string(), z.array(TaskSchema))
  })
  .openapi('BulkTasksResponse')

// OpenAPI body schemas
export const CreateTicketBodySchema = createTicketSchema.openapi('CreateTicketBody')
export const UpdateTicketBodySchema = updateTicketSchema.openapi('UpdateTicketBody')

// Parameter schemas for OpenAPI - FIXED: Use proper unixTSSchemaSpec for all IDs
export const TicketIdParamsSchema = z
  .object({
    ticketId: unixTSSchemaSpec.openapi({
      param: { name: 'ticketId', in: 'path' },
      description: 'Ticket identifier'
    }),
  })
  .openapi('TicketIdParams')

export const TaskIdParamsSchema = z
  .object({
    taskId: unixTSSchemaSpec.openapi({
      param: { name: 'taskId', in: 'path' },
      description: 'Task identifier'
    }),
  })
  .openapi('TaskIdParams')

export const TicketTaskIdParamsSchema = z
  .object({
    ticketId: unixTSSchemaSpec.openapi({
      param: { name: 'ticketId', in: 'path' },
      description: 'Ticket identifier'
    }),
    taskId: unixTSSchemaSpec.openapi({
      param: { name: 'taskId', in: 'path' },
      description: 'Task identifier'
    }),
  })
  .openapi('TicketTaskIdParams')

export const ProjectIdParamsSchema = z
  .object({
    projectId: unixTSSchemaSpec.openapi({
      param: { name: 'projectId', in: 'path' },
      description: 'Project identifier'
    }),
  })
  .openapi('ProjectIdParams')

export const StatusQuerySchema = z
  .object({
    status: z
      .string()
      .optional()
      .openapi({
        param: { name: 'status', in: 'query' },
        description: 'Filter tickets by status'
      })
  })
  .openapi('StatusQuery')

// Type exports
export type CreateTicketBody = z.infer<typeof createTicketSchema>
export type UpdateTicketBody = z.infer<typeof updateTicketSchema>
export type CreateTaskBody = z.infer<typeof createTaskSchema>
export type UpdateTaskBody = z.infer<typeof updateTaskSchema>
export type ReorderTasksBody = z.infer<typeof reorderTasksSchema>

// Define types based on Zod schemas
export type Ticket = z.infer<typeof TicketReadSchema>
export type TicketTask = z.infer<typeof TicketTaskReadSchema>
export type TicketFile = z.infer<typeof TicketFileReadSchema>

export type TicketWithTaskCount = z.infer<typeof TicketWithTaskCountSchema>
export type TicketWithTasks = z.infer<typeof TicketWithTasksSchema>