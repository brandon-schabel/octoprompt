import { z } from '@hono/zod-openapi'
import {
  unixTSArraySchemaSpec,
  unixTSSchemaSpec,
  entityIdSchema,
  entityIdArraySchema,
  entityIdCoercibleSchema
} from './schema-utils'

// Base schema - Represents the API structure
export const ProjectSchema = z
  .object({
    id: entityIdSchema,
    name: z.string(),
    description: z.string(),
    path: z.string(),
    created: unixTSSchemaSpec,
    updated: unixTSSchemaSpec
  })
  .openapi('Project')

// Import and Export info schemas
export const ImportInfoSchema = z
  .object({
    source: z.string(),
    specifiers: z.array(
      z.object({
        type: z.enum(['default', 'named', 'namespace']),
        imported: z.string().optional(),
        local: z.string()
      })
    )
  })
  .openapi('ImportInfo')

export const ExportInfoSchema = z
  .object({
    type: z.enum(['default', 'named', 'all']),
    source: z.string().optional(),
    specifiers: z
      .array(
        z.object({
          exported: z.string(),
          local: z.string().optional()
        })
      )
      .optional()
  })
  .openapi('ExportInfo')

export const ProjectFileSchema = z
  .object({
    id: entityIdSchema,
    projectId: entityIdSchema,
    name: z.string(),
    path: z.string(),
    extension: z.string(),
    size: z.number(),
    content: z.string().nullable(),
    summary: z.string().nullable(),
    summaryLastUpdated: unixTSSchemaSpec.nullable(),
    meta: z.string().nullable(),
    checksum: z.string().nullable(),
    imports: z.array(ImportInfoSchema).nullable().default(null),
    exports: z.array(ExportInfoSchema).nullable().default(null),
    created: unixTSSchemaSpec,
    updated: unixTSSchemaSpec
  })
  .openapi('ProjectFile')

// Request Parameter Schemas
export const ProjectIdParamsSchema = z
  .object({
    projectId: entityIdCoercibleSchema.openapi({ param: { name: 'projectId', in: 'path' } })
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
    // file ids
    fileIds: entityIdArraySchema,
    force: z
      .boolean()
      .optional()
      .default(false)
      .openapi({ example: false, description: 'Force re-summarization even if summary exists' })
  })
  .openapi('SummarizeFilesRequestBody')

export const RemoveSummariesBodySchema = z
  .object({
    fileIds: entityIdArraySchema
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

// Project Statistics Schemas
export const ProjectStatisticsSchema = z
  .object({
    fileStats: z.object({
      totalFiles: z.number(),
      totalSize: z.number(),
      filesByType: z.record(z.string(), z.number()),
      sizeByType: z.record(z.string(), z.number()),
      filesByCategory: z.object({
        source: z.number(),
        tests: z.number(),
        docs: z.number(),
        config: z.number(),
        other: z.number()
      }),
      filesWithSummaries: z.number(),
      averageSummaryLength: z.number()
    }),
    ticketStats: z.object({
      totalTickets: z.number(),
      ticketsByStatus: z.object({
        open: z.number(),
        in_progress: z.number(),
        closed: z.number()
      }),
      ticketsByPriority: z.object({
        low: z.number(),
        normal: z.number(),
        high: z.number()
      }),
      averageTasksPerTicket: z.number()
    }),
    taskStats: z.object({
      totalTasks: z.number(),
      completedTasks: z.number(),
      completionRate: z.number(),
      tasksByTicket: z.array(
        z.object({
          ticketId: z.number(),
          ticketTitle: z.string(),
          totalTasks: z.number(),
          completedTasks: z.number()
        })
      )
    }),
    promptStats: z.object({
      totalPrompts: z.number(),
      totalTokens: z.number(),
      averagePromptLength: z.number(),
      promptTypes: z.record(z.string(), z.number())
    }),
    activityStats: z.object({
      recentUpdates: z.number(),
      lastUpdateTime: z.number(),
      creationTrend: z.array(
        z.object({
          date: z.string(),
          files: z.number(),
          tickets: z.number(),
          tasks: z.number()
        })
      )
    })
  })
  .openapi('ProjectStatistics')

export const ProjectStatisticsResponseSchema = z
  .object({
    success: z.literal(true),
    data: ProjectStatisticsSchema
  })
  .openapi('ProjectStatisticsResponse')

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
export type ImportInfo = z.infer<typeof ImportInfoSchema>
export type ExportInfo = z.infer<typeof ExportInfoSchema>

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
export type ProjectStatistics = z.infer<typeof ProjectStatisticsSchema>
export type ProjectStatisticsResponse = z.infer<typeof ProjectStatisticsResponseSchema>
export type ProjectSummaryResponse = z.infer<typeof ProjectSummaryResponseSchema>
