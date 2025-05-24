import { z } from 'zod'

// Zod schemas for the 'tickets' table
export const TicketCreateSchema = z.object({
  projectId: z.number().int().openapi({ description: 'Project this ticket belongs to' }),
  title: z.string(),
  overview: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  suggestedFileIds: z.string().optional()
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


export type CreateTicketBody = z.infer<typeof createTicketSchema>
export type UpdateTicketBody = z.infer<typeof updateTicketSchema>
export type CreateTaskBody = z.infer<typeof createTaskSchema>
export type UpdateTaskBody = z.infer<typeof updateTaskSchema>
export type ReorderTasksBody = z.infer<typeof reorderTasksSchema>

// Define types based on Zod schemas
export type Ticket = z.infer<typeof TicketReadSchema>
export type TicketTask = z.infer<typeof TicketTaskReadSchema>
export type TicketFile = z.infer<typeof TicketFileReadSchema>
