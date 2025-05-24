import { z } from '@hono/zod-openapi'
import { unixTimestampSchema } from '../utils/unix-ts-utils'

// Base schema - Represents the API structure
export const ProjectSchema = z
  .object({
    id: unixTimestampSchema.openapi({ example: 1716537600000, description: 'Project ID (Unix MS Timestamp)' }),
    name: z.string(),
    description: z.string(),
    path: z.string(),
    created: unixTimestampSchema.openapi({ example: 1678442400000, description: 'Creation timestamp (Unix MS)' }),
    updated: unixTimestampSchema.openapi({ example: 1678442700000, description: 'Last update timestamp (Unix MS)' })
  })
  .openapi('Project')

export const ProjectFileSchema = z
  .object({
    id: unixTimestampSchema.openapi({ example: 1716537600000, description: 'File ID (Unix MS Timestamp)' }),
    projectId: unixTimestampSchema.openapi({ example: 1716537600000, description: 'Project ID (Unix MS Timestamp)' }),
    name: z.string(),
    path: z.string(),
    extension: z.string(),
    size: z.number(),
    content: z.string().nullable(),
    summary: z.string().nullable(),
    summaryLastUpdated: unixTimestampSchema.nullable().openapi({ example: 1678442800000, description: 'Summary last update timestamp (Unix MS), or null' }),
    meta: z.string().nullable(),
    checksum: z.string().nullable(),
    created: unixTimestampSchema.openapi({ example: 1678442400000, description: 'Creation timestamp (Unix MS)' }),
    updated: unixTimestampSchema.openapi({ example: 1678442700000, description: 'Last update timestamp (Unix MS)' })
  })
  .openapi('ProjectFile')

// Request Parameter Schemas
export const ProjectIdParamsSchema = z
  .object({
    projectId: unixTimestampSchema
      .openapi({
        param: { name: 'projectId', in: 'path' },
        example: 1716537600000,
        description: 'The ID of the project (Unix MS Timestamp)'
      })
  })
  .openapi('ProjectIdParams')

// Request Body Schemas
export const CreateProjectBodySchema = z
  .object({
    name: z.string().min(1).openapi({ example: 'My Awesome Project' }),
    path: z.string().min(1).openapi({ example: '/path/to/project' }),
    description: z.string().optional().openapi({ example: 'Optional project description' })
  })
  .openapi('CreateProjectRequestBody')

export const UpdateProjectBodySchema = z
  .object({
    name: z.string().min(1).optional().openapi({ example: 'Updated Project Name' }),
    path: z.string().min(1).optional().openapi({ example: '/new/path/to/project' }),
    description: z.string().optional().openapi({ example: 'Updated description' })
  })
  .refine((data) => data.name || data.path || data.description, {
    message: 'At least one field (name, path, description) must be provided for update'
  })
  .openapi('UpdateProjectRequestBody')

export const SummarizeFilesBodySchema = z
  .object({
    // file ids are unix timestamp in milliseconds
    fileIds: z
      .array(unixTimestampSchema)
      .min(1)
      .openapi({ example: [1716537600000, 1716537600001], description: 'Array of File IDs (Unix MS Timestamps)' }),
    force: z
      .boolean()
      .optional()
      .default(false)
      .openapi({ example: false, description: 'Force re-summarization even if summary exists' })
  })
  .openapi('SummarizeFilesRequestBody')

export const RemoveSummariesBodySchema = z
  .object({
    fileIds: z
      .array(unixTimestampSchema)
      .min(1)
      .openapi({ example: [1716537600000, 1716537600001], description: 'Array of File IDs (Unix MS Timestamps)' })
  })
  .openapi('RemoveSummariesRequestBody')

export const SuggestFilesBodySchema = z
  .object({
    userInput: z.string().min(1).openapi({ example: 'Implement authentication using JWT' })
  })
  .openapi('SuggestFilesRequestBody')

// Request Query Schemas
export const RefreshQuerySchema = z
  .object({
    folder: z
      .string()
      .optional()
      .openapi({
        param: { name: 'folder', in: 'query' },
        example: 'src/components',
        description: 'Optional folder path to limit the refresh scope'
      })
  })
  .openapi('RefreshQuery')

// Response Schemas
export const ProjectResponseSchema = z
  .object({
    success: z.literal(true),
    data: ProjectSchema
  })
  .openapi('ProjectResponse')

export const ProjectResponseMultiStatusSchema = ProjectResponseSchema.extend({
  warning: z.string().optional(),
  error: z.string().optional()
}).openapi('ProjectResponseMultiStatus')

export const ProjectListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(ProjectSchema)
  })
  .openapi('ProjectListResponse')

export const FileListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(ProjectFileSchema)
  })
  .openapi('FileListResponse')

// Type exports
export type Project = z.infer<typeof ProjectSchema>
export type ProjectFile = z.infer<typeof ProjectFileSchema>
export type CreateProjectBody = z.infer<typeof CreateProjectBodySchema>
export type UpdateProjectBody = z.infer<typeof UpdateProjectBodySchema>

// Define ProjectSummaryResponseSchema for the project summary route
export const ProjectSummaryResponseSchema = z
  .object({
    success: z.literal(true),
    summary: z.string()
  })
  .openapi('ProjectSummaryResponse')

// Define ProjectFileMapSchema using z.map
export const ProjectFileMapSchema = z
  .map(z.number(), ProjectFileSchema)
  .describe('A map where keys are ProjectFile IDs and values are the corresponding ProjectFile objects.')
  .openapi('ProjectFileMap')

// a key/value map by id of all project object (content, file name, path, extension, etc)
export type ProjectFileMap = z.infer<typeof ProjectFileMapSchema>
