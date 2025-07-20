import { z } from 'zod'
import { idSchemaSpec, idArraySchemaSpec, unixTSSchemaSpec } from './schema-utils'

export const selectedFilesDataSchema = z.object({
  projectId: idSchemaSpec,
  tabId: z.number().optional(),
  fileIds: idArraySchemaSpec.default([]),
  promptIds: idArraySchemaSpec.default([]),
  userPrompt: z.string().default(''),
  updatedAt: unixTSSchemaSpec
})

export const selectedFilesSchema = z.object({
  id: idSchemaSpec,
  data: selectedFilesDataSchema,
  created: unixTSSchemaSpec,
  updated: unixTSSchemaSpec
})

export type SelectedFilesData = z.infer<typeof selectedFilesDataSchema>
export type SelectedFiles = z.infer<typeof selectedFilesSchema>
