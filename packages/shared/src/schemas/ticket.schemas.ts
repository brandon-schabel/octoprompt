import { z } from 'zod'

// Zod schemas for the 'tickets' table
export const TicketCreateSchema = z.object({
  projectId: z.number().int().openapi({ description: 'Project this ticket belongs to' }),
  title: z.string(),
  overview: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  suggestedFileIds: z.array(z.number()).optional()
})

export const TicketReadSchema = z.object({
  projectId: z.number().int().openapi({ description: 'Project this ticket belongs to' }),
  id: z.number().int().openapi({ description: 'Unique ticket identifier' }),
  title: z.string(),
  overview: z.string(),
  status: z.string(),
  priority: z.string(),
  suggestedFileIds: z.array(z.number()).optional(),
  created: z.number().int().openapi({ description: 'Creation timestamp (unix timestamp in milliseconds)' }),
  updated: z.number().int().openapi({ description: 'Last update timestamp (unix timestamp in milliseconds)' })
})

export const TicketUpdateSchema = z.object({
  title: z.string().optional(),
  overview: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  suggestedFileIds: z.number().array().optional()
})

export const TicketFileReadSchema = z.object({
  ticketId: z.number().int().openapi({ description: 'Ticket this file belongs to' }),
  fileId: z.number().int().openapi({ description: 'File this ticket belongs to' })
})

// Zod schemas for the 'ticket_tasks' table
export const TicketTaskCreateSchema = z.object({
  ticketId: z.number().int().openapi({ description: 'Ticket this task belongs to' }),
  content: z.string(),
  done: z.boolean().optional(),
  orderIndex: z.number().optional()
})

export const TicketTaskReadSchema = z.object({
  id: z.number().int().openapi({ description: 'Unique task identifier' }),
  ticketId: z.number().int().openapi({ description: 'Ticket this task belongs to' }),
  content: z.string(),
  done: z.preprocess((val) => {
    if (typeof val === 'number') return val === 1
    if (typeof val === 'boolean') return val
    return false
  }, z.boolean()),
  orderIndex: z.number(),
  created: z.number().int().openapi({ description: 'Creation timestamp (unix timestamp in milliseconds)' }),
  updated: z.number().int().openapi({ description: 'Last update timestamp (unix timestamp in milliseconds)' })
})

export const TaskSuggestionsZodSchema = z.object({
  tasks: z.array(
    z.object({
      title: z.string(),

      // Additioanl fields that aren't being used yet
      description: z.string().optional(),
      files: z
        .array(
          z.object({
            fileId: z.number().int().openapi({ description: 'Unique file identifier' }),
            fileName: z.string()
          })
        )
        .optional()
    })
  )
})
export type TaskSuggestions = z.infer<typeof TaskSuggestionsZodSchema>

export const createTicketSchema = z.object({
  projectId: z.number().int().openapi({ description: 'Project this ticket belongs to' }),
  title: z.string().min(1),
  overview: z.string().default(''),
  status: z.enum(['open', 'in_progress', 'closed']).default('open'),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
  suggestedFileIds: z.array(z.number()).optional()
})

export const updateTicketSchema = z.object({
  title: z.string().min(1).optional(),
  overview: z.string().optional(),
  status: z.enum(['open', 'in_progress', 'closed']).optional(),
  priority: z.enum(['low', 'normal', 'high']).optional(),
  suggestedFileIds: z.array(z.number()).optional()
})

export const linkFilesSchema = z.object({
  fileIds: z.array(z.number().int()).nonempty()
})

export const suggestTasksSchema = z.object({
  // e.g. user might pass some instructions or acceptance criteria
  userContext: z.string().optional()
})

/** TASK-related validations below **/
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
      taskId: z.number(),
      orderIndex: z.number().min(0)
    })
  )
})

export const updateSuggestedFilesSchema = z.object({
  suggestedFileIds: z.array(z.number().int()).nonempty()
})




export const updateTicketParamsSchema = z.object({
  ticketId: z.number().int().openapi({ description: 'Ticket this task belongs to' })
})

export const getOrDeleteTicketParamsSchema = z.object({
  ticketId: z.number().int().openapi({ description: 'Ticket this task belongs to' })
})

export const linkFilesParamsSchema = z.object({
  ticketId: z.number().int().openapi({ description: 'Ticket this task belongs to' })
})

export const suggestTasksParamsSchema = z.object({
  ticketId: z.number().int().openapi({ description: 'Ticket this task belongs to' })
})

export const updateSuggestedFilesParamsSchema = z.object({
  ticketId: z.number().int().openapi({ description: 'Ticket this task belongs to' })
})

export const createTaskParamsSchema = z.object({
  ticketId: z.number().int().openapi({ description: 'Ticket this task belongs to' })
})

export const updateTaskParamsSchema = z.object({
  ticketId: z.number().int().openapi({ description: 'Ticket this task belongs to' })
})

export const deleteTaskParamsSchema = z.object({
  ticketId: z.number().int().openapi({ description: 'Ticket this task belongs to' })
})

export const reorderTasksParamsSchema = z.object({
  ticketId: z.number().int().openapi({ description: 'Ticket this task belongs to' })
})


export const TicketSchema = z
  .object({
    id: z.number().openapi({ description: 'Unique ticket identifier' }),
    projectId: z.number().openapi({ description: 'Project this ticket belongs to' }),
    title: z.string().openapi({ description: 'Ticket title' }),
    overview: z.string().openapi({ description: 'Ticket description' }),
    status: z.enum(['open', 'in_progress', 'closed']).openapi({ description: 'Current ticket status' }),
    priority: z.enum(['low', 'normal', 'high']).openapi({ description: 'Ticket priority' }),
    suggestedFileIds: z.array(z.number()).openapi({ description: 'JSON string of suggested file IDs' }),
    created: z.number().int().openapi({ description: 'Creation timestamp (unix timestamp in milliseconds)' }),
    updated: z.number().int().openapi({ description: 'Last update timestamp (unix timestamp in milliseconds)' })
  })
  .openapi('Ticket')

export const TaskSchema = z
  .object({
    id: z.number().openapi({ description: 'Unique task identifier' }),
    ticketId: z.number().openapi({ description: 'Ticket this task belongs to' }),
    content: z.string().openapi({ description: 'Task content/description' }),
    done: z.boolean().openapi({ description: 'Whether the task is completed' }),
    orderIndex: z.number().openapi({ description: 'Task order within the ticket' }),
    created: z.number().int().openapi({ description: 'Creation timestamp (unix timestamp in milliseconds)' }),
    updated: z.number().int().openapi({ description: 'Last update timestamp (unix timestamp in milliseconds)' })
  })
  .openapi('Task')

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
        ticketId: z.string(),
        fileId: z.string()
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
    recommendedFileIds: z.array(z.number()),
    combinedSummaries: z.string().optional(),
    message: z.string().optional()
  })
  .openapi('SuggestedFilesResponse')

export const TicketWithTaskCountSchema = z
  .object({
    ticket: TicketSchema,
    taskCount: z.number(),
    completedTaskCount: z.number()
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

export const CreateTicketBodySchema = createTicketSchema.openapi('CreateTicketBody')
export const UpdateTicketBodySchema = updateTicketSchema.openapi('UpdateTicketBody')
export const TicketIdParamsSchema = z
  .object({
    ticketId: z.number().openapi({
      param: { name: 'ticketId', in: 'path' },
      description: 'Ticket identifier'
    })
  })
  .openapi('TicketIdParams')

export const ProjectIdParamsSchema = z
  .object({
    projectId: z.number().openapi({
      param: { name: 'projectId', in: 'path' },
      description: 'Project identifier'
    })
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



export type CreateTicketBody = z.infer<typeof createTicketSchema>
export type UpdateTicketBody = z.infer<typeof updateTicketSchema>
export type CreateTaskBody = z.infer<typeof createTaskSchema>
export type UpdateTaskBody = z.infer<typeof updateTaskSchema>
export type ReorderTasksBody = z.infer<typeof reorderTasksSchema>

// Define types based on Zod schemas
export type Ticket = z.infer<typeof TicketReadSchema>
export type TicketTask = z.infer<typeof TicketTaskReadSchema>
export type TicketFile = z.infer<typeof TicketFileReadSchema>


