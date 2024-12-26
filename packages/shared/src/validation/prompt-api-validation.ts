import { z } from "zod";


export const promptApiValidation = {
    create: {
        body: z.object({
            projectId: z.string(),
            name: z.string().min(1),
            content: z.string().min(1),
        })
    },
    list: {
        params: z.object({
            projectId: z.string(),
        })
    },
    getOrDelete: {
        params: z.object({
            promptId: z.string(),
        })
    },
    update: {
        params: z.object({
            promptId: z.string(),
        }),
        body: z.object({
            name: z.string().min(1).optional(),
            content: z.string().min(1).optional(),
        }).refine(data => data.name || data.content, {
            message: "At least one of name or content must be provided"
        })
    }
} as const;

export type CreatePromptBody = z.infer<typeof promptApiValidation.create.body>;
export type ListPromptsParams = z.infer<typeof promptApiValidation.list.params>;
export type GetOrDeletePromptParams = z.infer<typeof promptApiValidation.getOrDelete.params>;
export type UpdatePromptParams = z.infer<typeof promptApiValidation.update.params>;
export type UpdatePromptBody = z.infer<typeof promptApiValidation.update.body>;