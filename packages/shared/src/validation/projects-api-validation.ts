import { z } from "zod";

export const projectsApiValidation = {
    create: {
        body: z.object({
            name: z.string().min(1),
            description: z.string().optional(),
            path: z.string().min(1),
        })
    },
    update: {
        params: z.object({
            projectId: z.string(),
        }),
        body: z.object({
            name: z.string().min(1).optional(),
            description: z.string().optional(),
            path: z.string().min(1).optional(),
        })
    },
    getOrDelete: {
        params: z.object({
            projectId: z.string(),
        })
    },
    getFiles: {
        params: z.object({
            projectId: z.string(),
        })
    },
    sync: {
        params: z.object({
            projectId: z.string(),
        })
    }
} as const;

export type CreateProjectBody = z.infer<typeof projectsApiValidation.create.body>;
export type UpdateProjectParams = z.infer<typeof projectsApiValidation.update.params>;
export type UpdateProjectBody = z.infer<typeof projectsApiValidation.update.body>;
export type GetOrDeleteProjectParams = z.infer<typeof projectsApiValidation.getOrDelete.params>;
export type GetProjectFilesParams = z.infer<typeof projectsApiValidation.getFiles.params>;
export type SyncProjectParams = z.infer<typeof projectsApiValidation.sync.params>;