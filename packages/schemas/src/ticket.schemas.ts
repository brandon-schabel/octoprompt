import { z } from "zod";


// Zod schemas for the 'tickets' table
export const TicketCreateSchema = z.object({
    projectId: z.string(),
    title: z.string(),
    overview: z.string().optional(),
    status: z.string().optional(),
    priority: z.string().optional(),
    suggestedFileIds: z.string().optional(),
});

export const TicketReadSchema = z.object({
    id: z.string(),
    projectId: z.string(),
    title: z.string(),
    overview: z.string(),
    status: z.string(),
    priority: z.string(),
    suggestedFileIds: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
});

export const TicketUpdateSchema = z.object({
    title: z.string().optional(),
    overview: z.string().optional(),
    status: z.string().optional(),
    priority: z.string().optional(),
    suggestedFileIds: z.string().optional(),
});

export const TicketFileReadSchema = z.object({
    ticketId: z.string(),
    fileId: z.string(),
});

// Zod schemas for the 'ticket_tasks' table
export const TicketTaskCreateSchema = z.object({
    ticketId: z.string(),
    content: z.string(),
    done: z.boolean().optional(),
    orderIndex: z.number().optional(),
});

export const TicketTaskReadSchema = z.object({
    id: z.string(),
    ticketId: z.string(),
    content: z.string(),
    done: z.preprocess((val) => {
        if (typeof val === 'number') return val === 1;
        if (typeof val === 'boolean') return val;
        return false;
    }, z.boolean()),
    orderIndex: z.number(),
    createdAt: z.date(),
    updatedAt: z.date(),
});

export const TaskSuggestionsZodSchema = z.object({
    tasks: z.array(z.object({
        title: z.string(),

        // Additioanl fields that aren't being used yet
        description: z.string().optional(),
        files: z.array(z.object({
            fileId: z.string(),
            fileName: z.string(),
        })).optional(),
    }))
});
export type TaskSuggestions = z.infer<typeof TaskSuggestionsZodSchema>;

export const createTicketSchema = z.object({
    projectId: z.string().min(1),
    title: z.string().min(1),
    overview: z.string().default(""),
    status: z.enum(["open", "in_progress", "closed"]).default("open"),
    priority: z.enum(["low", "normal", "high"]).default("normal"),
    suggestedFileIds: z.array(z.string()).optional(),
});

export const updateTicketSchema = z.object({
    title: z.string().min(1).optional(),
    overview: z.string().optional(),
    status: z.enum(["open", "in_progress", "closed"]).optional(),
    priority: z.enum(["low", "normal", "high"]).optional(),
    suggestedFileIds: z.array(z.string()).optional(),
});

export const linkFilesSchema = z.object({
    fileIds: z.array(z.string()).nonempty(),
});

export const suggestTasksSchema = z.object({
    // e.g. user might pass some instructions or acceptance criteria
    userContext: z.string().optional(),
});

/** TASK-related validations below **/
export const createTaskSchema = z.object({
    content: z.string().min(1),
});

export const updateTaskSchema = z.object({
    content: z.string().optional(),
    done: z.boolean().optional(),
});

export const reorderTasksSchema = z.object({
    tasks: z.array(
        z.object({
            taskId: z.string(),
            orderIndex: z.number().min(0),
        })
    ),
});

export const updateSuggestedFilesSchema = z.object({
    suggestedFileIds: z.array(z.string()).nonempty(),
});

export const ticketsApiValidation = {
    create: {
        body: createTicketSchema
    },
    update: {
        body: updateTicketSchema,
        params: z.object({
            ticketId: z.string(),
        })
    },
    getOrDelete: {
        params: z.object({
            ticketId: z.string(),
        })
    },
    linkFiles: {
        body: linkFilesSchema,
        params: z.object({
            ticketId: z.string(),
        })
    },
    suggestTasks: {
        body: suggestTasksSchema,
        params: z.object({
            ticketId: z.string(),
        })
    },
    updateSuggestedFiles: {
        body: updateSuggestedFilesSchema,
        params: z.object({
            ticketId: z.string(),
        })
    },
    /** Tasks **/
    createTask: {
        body: createTaskSchema,
        params: z.object({
            ticketId: z.string(),
        }),
    },
    updateTask: {
        body: updateTaskSchema,
        params: z.object({
            ticketId: z.string(),
            taskId: z.string(),
        }),
    },
    deleteTask: {
        params: z.object({
            ticketId: z.string(),
            taskId: z.string(),
        }),
    },
    reorderTasks: {
        body: reorderTasksSchema,
        params: z.object({
            ticketId: z.string(),
        }),
    },
};

export type CreateTicketBody = z.infer<typeof createTicketSchema>;
export type UpdateTicketBody = z.infer<typeof updateTicketSchema>;
export type CreateTaskBody = z.infer<typeof createTaskSchema>;
export type UpdateTaskBody = z.infer<typeof updateTaskSchema>;
export type ReorderTasksBody = z.infer<typeof reorderTasksSchema>;

// Define types based on Zod schemas
export type Ticket = z.infer<typeof TicketReadSchema>;
export type TicketTask = z.infer<typeof TicketTaskReadSchema>;
export type TicketFile = z.infer<typeof TicketFileReadSchema>;