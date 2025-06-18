import { z } from '@hono/zod-openapi'
import { unixTSArraySchemaSpec, unixTSSchemaSpec } from './schema-utils'

// Base schema - Represents the API structure
export const ProjectSchema = z
  .object({
    id: unixTSSchemaSpec,
    name: z.string(),
    description: z.string(),
    path: z.string(),
    created: unixTSSchemaSpec,
    updated: unixTSSchemaSpec
  })
  .openapi('Project')

export const ProjectFileSchema = z
  .object({
    id: unixTSSchemaSpec,
    projectId: unixTSSchemaSpec,
    name: z.string(),
    path: z.string(),
    extension: z.string(),
    size: z.number(),
    content: z.string().nullable(),
    summary: z.string().nullable(),
    summaryLastUpdated: unixTSSchemaSpec.nullable(),
    meta: z.string().nullable(),
    checksum: z.string().nullable(),
    created: unixTSSchemaSpec,
    updated: unixTSSchemaSpec
  })
  .openapi('ProjectFile')

// Request Parameter Schemas
export const ProjectIdParamsSchema = z
  .object({
    projectId: unixTSSchemaSpec.openapi({ param: { name: 'projectId', in: 'path' } })
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
    fileIds: unixTSArraySchemaSpec,
    force: z
      .boolean()
      .optional()
      .default(false)
      .openapi({ example: false, description: 'Force re-summarization even if summary exists' })
  })
  .openapi('SummarizeFilesRequestBody')

export const RemoveSummariesBodySchema = z
  .object({
    fileIds: unixTSArraySchemaSpec
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

// Define ProjectFileWithoutContentSchema first (before using it in other schemas)
export const ProjectFileWithoutContentSchema = ProjectFileSchema.omit({ content: true }).openapi(
  'ProjectFileWithoutContent'
)

// Response schema for files without content
export const ProjectFileWithoutContentListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(ProjectFileWithoutContentSchema)
  })
  .openapi('ProjectFileWithoutContentListResponse')

// Response schema for single file operations
export const FileResponseSchema = z
  .object({
    success: z.literal(true),
    data: ProjectFileSchema
  })
  .openapi('FileResponse')

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

export const ProjectFileMapWithoutContentSchema = z
  .map(z.number(), ProjectFileWithoutContentSchema)
  .describe(
    'A map where keys are ProjectFile IDs and values are the corresponding ProjectFile objects without content.'
  )
  .openapi('ProjectFileMapWithoutContent')

export type Project = z.infer<typeof ProjectSchema>
export type ProjectFile = z.infer<typeof ProjectFileSchema>
export type ProjectFileWithoutContent = z.infer<typeof ProjectFileWithoutContentSchema>
export type CreateProjectBody = z.infer<typeof CreateProjectBodySchema>
export type UpdateProjectBody = z.infer<typeof UpdateProjectBodySchema>

// a key/value map by id of all project object (content, file name, path, extension, etc)
export type ProjectFileMap = z.infer<typeof ProjectFileMapSchema>
export type ProjectFileMapWithoutContent = z.infer<typeof ProjectFileMapWithoutContentSchema>
export type CreateProjectRequestBody = z.infer<typeof CreateProjectBodySchema>
export type UpdateProjectRequestBody = z.infer<typeof UpdateProjectBodySchema>
export type ProjectResponse = z.infer<typeof ProjectResponseSchema>
export type ProjectListResponse = z.infer<typeof ProjectListResponseSchema>
export type FileListResponse = z.infer<typeof FileListResponseSchema>
export type ProjectFileWithoutContentListResponse = z.infer<typeof ProjectFileWithoutContentListResponseSchema>
export type FileResponse = z.infer<typeof FileResponseSchema>
export type ProjectSummaryResponse = z.infer<typeof ProjectSummaryResponseSchema>
