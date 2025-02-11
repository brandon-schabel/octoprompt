import { z } from "zod";

// Define the generator request schema based on the service definition
export const uiGeneratorRequestSchema = z.object({
    designContract: z.string().default(""),
    componentName: z.string().default("GenericComponent"),
    generateData: z.boolean().default(false),
    dataSchema: z.string().optional(),
    seedId: z.string().optional(),
    styleDirectives: z.string().optional(),
});

export const uiGenerationApiValidation = {
    generate: {
        body: uiGeneratorRequestSchema
    },
    undoRedo: {
        body: z.object({
            seedId: z.string()
        })
    },
    lock: {
        body: z.object({
            seedId: z.string()
        })
    },
    getSnapshot: {
        params: z.object({
            seedId: z.string()
        })
    }
} as const;

// Export types for use in routes and services
export type GenerateUIBody = z.infer<typeof uiGenerationApiValidation.generate.body>;
export type UndoRedoUIBody = z.infer<typeof uiGenerationApiValidation.undoRedo.body>;
export type LockUIBody = z.infer<typeof uiGenerationApiValidation.lock.body>;
export type GetSnapshotParams = z.infer<typeof uiGenerationApiValidation.getSnapshot.params>; 