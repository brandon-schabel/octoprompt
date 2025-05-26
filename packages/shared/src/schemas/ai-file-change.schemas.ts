import { z } from 'zod';
import { unixTSSchemaSpec } from './schema-utils';

export const AIFileChangeStatusSchema = z.enum(['pending', 'confirmed', 'rejected']);
export type AIFileChangeStatus = z.infer<typeof AIFileChangeStatusSchema>;

export const AIFileChangeRecordSchema = z.object({
    id: unixTSSchemaSpec,
    projectId: unixTSSchemaSpec,
    filePath: z.string().openapi({ description: 'Path to the file that was modified', example: 'src/components/Button.tsx' }),
    originalContent: z.string().openapi({ description: 'The original content of the file before changes.' }),
    suggestedContent: z.string().openapi({ description: 'The AI suggested content for the file.' }),
    diff: z.string().nullable().openapi({ description: 'The diff between original and suggested content, or an explanation.' }),
    prompt: z.string().nullable().openapi({ description: 'The user prompt that initiated this change.' }),
    status: AIFileChangeStatusSchema.openapi({ description: 'Status of the file change.' }),
    created: unixTSSchemaSpec,
    updated: unixTSSchemaSpec,
    explanation: z.string().nullable().openapi({ description: 'Explanation from the AI about the change.' }),
}).openapi('AIFileChangeRecord');

export type AIFileChangeRecord = z.infer<typeof AIFileChangeRecordSchema>;

// Schema for storing AI file changes in a project's storage
export const AIFileChangesStorageSchema = z.record(z.string(), AIFileChangeRecordSchema);
export type AIFileChangesStorage = z.infer<typeof AIFileChangesStorageSchema>;

export const GenerateChangeBodySchema = z
    .object({
        projectId: unixTSSchemaSpec,
        filePath: z
            .string()
            .min(1)
            .openapi({ example: 'src/components/Button.tsx', description: 'Path to the file to modify' }),
        prompt: z
            .string()
            .min(1)
            .openapi({ example: 'Add hover effects to the button', description: 'Instruction for the AI to follow' })
    })
    .openapi('GenerateAIChangeBody');
export type GenerateChangeBody = z.infer<typeof GenerateChangeBodySchema>;


export const FileChangeIdParamsSchema = z
    .object({
        projectId: unixTSSchemaSpec,
        aiFileChangeId: unixTSSchemaSpec.openapi({ param: { name: 'aiFileChangeId', in: 'path' } })
    })
    .openapi('AIFileChangeIdParams');
export type FileChangeIdParams = z.infer<typeof FileChangeIdParamsSchema>; 