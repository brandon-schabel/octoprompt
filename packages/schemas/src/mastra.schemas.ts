// packages/schemas/src/mastra.schemas.ts
// Recent changes:
// 1. Initial creation of Mastra API schemas
// 2. Defined request and response schemas for code change
// 3. Defined request and response schemas for batch summarization
// 4. Defined request and response schemas for single file summarization
// 5. Added OpenAPI metadata and exported Zod inferred types

import { z } from '@hono/zod-openapi'

// --- Mastra Code Change Schemas ---
const MastraCodeChangeRequestBodySchema = z.object({
  userRequest: z.string().min(1).max(5000).openapi({ description: 'The coding request or task description' }),
  selectedFileIds: z
    .array(z.number().int().positive())
    .min(1)
    .max(20)
    .openapi({ description: 'Array of file IDs to modify' }),
  options: z
    .object({
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().int().positive().optional()
    })
    .optional()
    .openapi({ description: 'Optional AI model parameters' })
})

export const MastraCodeChangeRequestSchema = MastraCodeChangeRequestBodySchema.extend({
  projectId: z.number().int().positive().openapi({ description: 'ID of the project' })
}).openapi('MastraCodeChangeRequest')

export const MastraCodeChangeResponseDataSchema = z.object({
  agentJobId: z.number().openapi({ description: 'ID of the agent job' }),
  updatedFiles: z
    .array(
      z.object({
        id: z.number().openapi({ description: 'ID of the updated file' }),
        path: z.string().openapi({ description: 'Path of the updated file' }),
        content: z.string().openapi({ description: 'New content of the file' }),
        explanation: z.string().openapi({ description: 'Explanation of changes made to the file' })
      })
    )
    .openapi({ description: 'Array of files that were updated' }),
  summary: z.string().openapi({ description: 'Summary of the code change operation' })
})

export const MastraCodeChangeResponseSchema = z
  .object({
    success: z.literal(true),
    data: MastraCodeChangeResponseDataSchema
  })
  .openapi('MastraCodeChangeResponse')

// --- Mastra Batch Summarize Schemas ---
const MastraSummarizeRequestBodySchema = z.object({
  fileIds: z
    .array(z.number().int().positive())
    .min(1)
    .max(50)
    .openapi({ description: 'Array of file IDs to summarize' }),
  focusArea: z.string().optional().openapi({ description: 'Specific area to focus on in the summary' })
})

export const MastraSummarizeRequestSchema = MastraSummarizeRequestBodySchema.extend({
  projectId: z.number().int().positive().openapi({ description: 'ID of the project' })
}).openapi('MastraSummarizeRequest')

export const MastraSummarizeResponseDataSchema = z.object({
  included: z.number().openapi({ description: 'Number of files successfully summarized' }),
  skipped: z.number().openapi({ description: 'Number of files skipped during summarization' }),
  summaries: z
    .array(
      z.object({
        fileId: z.number().openapi({ description: 'ID of the summarized file' }),
        path: z.string().openapi({ description: 'Path of the summarized file' }),
        summary: z.string().openapi({ description: 'Generated summary for the file' })
      })
    )
    .openapi({ description: 'Array of generated summaries' })
})

export const MastraSummarizeResponseSchema = z
  .object({
    success: z.literal(true),
    data: MastraSummarizeResponseDataSchema
  })
  .openapi('MastraSummarizeResponse')

// --- Mastra Single File Summarize Schemas ---
export const MastraSingleSummarizeRequestSchema = z
  .object({
    projectId: z.number().int().positive().openapi({ description: 'ID of the project' }),
    fileId: z.number().int().positive().openapi({ description: 'ID of the file to summarize' }),
    focusArea: z.string().optional().openapi({ description: 'Specific area to focus on in the summary' })
  })
  .openapi('MastraSingleSummarizeRequest')

export const MastraSingleSummarizeResponseDataSchema = z.object({
  summary: z.string().openapi({ description: 'Generated summary for the file' }),
  fileId: z.number().openapi({ description: 'ID of the summarized file' }),
  path: z.string().openapi({ description: 'Path of the summarized file' })
})

export const MastraSingleSummarizeResponseSchema = z
  .object({
    success: z.literal(true),
    data: MastraSingleSummarizeResponseDataSchema
  })
  .openapi('MastraSingleSummarizeResponse')

// --- Export Types ---
export type MastraCodeChangeRequest = z.infer<typeof MastraCodeChangeRequestSchema>
export type MastraCodeChangeResponse = z.infer<typeof MastraCodeChangeResponseSchema>
export type MastraSummarizeRequest = z.infer<typeof MastraSummarizeRequestSchema>
export type MastraSummarizeResponse = z.infer<typeof MastraSummarizeResponseSchema>
export type MastraSingleSummarizeRequest = z.infer<typeof MastraSingleSummarizeRequestSchema>
export type MastraSingleSummarizeResponse = z.infer<typeof MastraSingleSummarizeResponseSchema>
