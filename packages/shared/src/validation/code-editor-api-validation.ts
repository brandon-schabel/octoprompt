import { z } from 'zod';

export const codeEditorApiValidation = {
    edit: {
        params: z.object({
            projectId: z.string(),
            fileId: z.string()
        }),
        body: z.object({
            instructions: z.string().min(1),
            provider: z.enum(['openai', 'anthropic', 'gemini', 'ollama', 'openrouter', 'xai']).optional()
        })
    }
} as const;

export type EditFileParams = z.infer<typeof codeEditorApiValidation.edit.params>;
export type EditFileBody = z.infer<typeof codeEditorApiValidation.edit.body>; 