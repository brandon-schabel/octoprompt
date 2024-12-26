import { z } from "zod";

export const providerKeyApiValidation = {
    create: {
        body: z.object({
            provider: z.string().min(1),
            key: z.string().min(1),
        })
    },
    update: {
        params: z.object({
            keyId: z.string(),
        }),
        body: z.object({
            provider: z.string().min(1).optional(),
            key: z.string().min(1).optional(),
        })
    },
    getOrDelete: {
        params: z.object({
            keyId: z.string(),
        })
    }
} as const;

export type CreateProviderKeyBody = z.infer<typeof providerKeyApiValidation.create.body>;
export type UpdateProviderKeyParams = z.infer<typeof providerKeyApiValidation.update.params>;
export type UpdateProviderKeyBody = z.infer<typeof providerKeyApiValidation.update.body>;
export type GetOrDeleteProviderKeyParams = z.infer<typeof providerKeyApiValidation.getOrDelete.params>;