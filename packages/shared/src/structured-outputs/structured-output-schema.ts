import { z } from 'zod'

export const generateNameSchema = z.object({
  generatedName: z.string().min(1)
})

export const suggestedFilesSchema = z.array(
  z.object({
    fileName: z.string(),
    relevance: z.number().min(0).max(1)
  })
)

export const structuredOutputSchemas = {
  generateName: generateNameSchema,
  suggestedFiles: suggestedFilesSchema
} as const

export type StructuredOutputType = keyof typeof structuredOutputSchemas

export type InferStructuredOutput<T extends StructuredOutputType> = z.infer<(typeof structuredOutputSchemas)[T]>
