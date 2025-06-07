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


export const ProjectFileSchema = z.object({
  id: unixTSSchemaSpec,
  projectId: unixTSSchemaSpec,
  name: z.string(),
  path: z.string(),
  extension: z.string(),
  size: z.number(),
  content: z.string(),
  summary: z.string().nullable(),
  summaryLastUpdated: unixTSSchemaSpec.nullable(),
  meta: z.string(),
  checksum: z.string().nullable(),
  created: unixTSSchemaSpec,
  updated: unixTSSchemaSpec,
  
  // New versioning fields
  version: z.number().int().positive().default(1), // Version number starting from 1
  prevId: unixTSSchemaSpec.nullable().default(null), // Points to previous version
  nextId: unixTSSchemaSpec.nullable().default(null), // Points to next version (null for latest)
  isLatest: z.boolean().default(true), // Flag to quickly identify latest version
  originalFileId: unixTSSchemaSpec.nullable().default(null) // Points to the first version of this file
}).openapi('ProjectFile')


// Additional schemas for versioning operations
export const FileVersionSchema = z.object({
  fileId: unixTSSchemaSpec,
  version: z.number().int().positive(),
  created: unixTSSchemaSpec,
  updated: unixTSSchemaSpec,
  isLatest: z.boolean()
}).openapi('FileVersion')

export const FileVersionListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(FileVersionSchema)
}).openapi('FileVersionListResponse')

export const GetFileVersionParams = z.object({
  version: z.string().optional()
}).openapi('GetFileVersionBody')

export const RevertToVersionBodySchema = z.object({
  version: z.number().int().positive()
}).openapi('RevertToVersionBody')


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
    fileIds: unixTSArraySchemaSpec,
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

// Define ProjectSummaryResponseSchema for the project summary route
export const ProjectSummaryResponseSchema = z
  .object({
    success: z.literal(true),
    summary: z.string()
  })
  .openapi('ProjectSummaryResponse')

// Define schemas for file maps
export const ProjectFileMapSchema = z
  .map(z.number(), ProjectFileSchema)
  .describe('A map where keys are ProjectFile IDs and values are the corresponding ProjectFile objects.')
  .openapi('ProjectFileMap')

export const ProjectFileWithoutContentSchema = ProjectFileSchema.omit({ content: true }).openapi('ProjectFileWithoutContent')

export const ProjectFileMapWithoutContentSchema = z
  .map(z.number(), ProjectFileWithoutContentSchema)
  .describe('A map where keys are ProjectFile IDs and values are the corresponding ProjectFile objects without content.')
  .openapi('ProjectFileMapWithoutContent')



export type FileVersion = z.infer<typeof FileVersionSchema>
export type FileVersionListResponse = z.infer<typeof FileVersionListResponseSchema>
export type GetFileVersionBody = z.infer<typeof GetFileVersionParams>
export type RevertToVersionBody = z.infer<typeof RevertToVersionBodySchema>
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
export type ProjectSummaryResponse = z.infer<typeof ProjectSummaryResponseSchema>