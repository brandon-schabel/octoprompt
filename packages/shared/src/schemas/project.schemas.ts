import { z } from '@hono/zod-openapi';

// Base schema - Represents the API structure
export const ProjectSchema = z.object({
    id: z.string().openapi({ example: 'proj_1a2b3c4d' }),
    name: z.string(),
    description: z.string(),
    path: z.string(),
    createdAt: z.string().datetime().openapi({ example: '2024-03-10T10:00:00.000Z' }),
    updatedAt: z.string().datetime().openapi({ example: '2024-03-10T10:05:00.000Z' }),
}).openapi('Project');

export const ProjectFileSchema = z.object({
    id: z.string(),
    projectId: z.string(),
    name: z.string(),
    path: z.string(),
    extension: z.string(),
    size: z.number(),
    content: z.string().nullable(),
    summary: z.string().nullable(),
    summaryLastUpdatedAt: z.string().datetime().nullable(),
    meta: z.string().nullable(),
    checksum: z.string().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
}).openapi('ProjectFile');

// Request Parameter Schemas
export const ProjectIdParamsSchema = z.object({
    projectId: z.string().min(1).openapi({
        param: { name: 'projectId', in: 'path' },
        example: 'proj_1a2b3c4d',
        description: 'The ID of the project'
    })
}).openapi('ProjectIdParams');

// Request Body Schemas
export const CreateProjectBodySchema = z.object({
    name: z.string().min(1).openapi({ example: 'My Awesome Project' }),
    path: z.string().min(1).openapi({ example: '/path/to/project' }),
    description: z.string().optional().openapi({ example: 'Optional project description' }),
}).openapi('CreateProjectRequestBody');

export const UpdateProjectBodySchema = z.object({
    name: z.string().min(1).optional().openapi({ example: 'Updated Project Name' }),
    path: z.string().min(1).optional().openapi({ example: '/new/path/to/project' }),
    description: z.string().optional().openapi({ example: 'Updated description' }),
}).refine(data => data.name || data.path || data.description, {
    message: "At least one field (name, path, description) must be provided for update"
}).openapi('UpdateProjectRequestBody');

export const SummarizeFilesBodySchema = z.object({
    fileIds: z.array(z.string().min(1)).min(1).openapi({ example: ['file_1a2b3c4d', 'file_e5f6g7h8'] }),
    force: z.boolean().optional().default(false).openapi({ example: false, description: 'Force re-summarization even if summary exists' })
}).openapi('SummarizeFilesRequestBody');

export const RemoveSummariesBodySchema = z.object({
    fileIds: z.array(z.string().min(1)).min(1).openapi({ example: ['file_1a2b3c4d', 'file_e5f6g7h8'] })
}).openapi('RemoveSummariesRequestBody');

export const SuggestFilesBodySchema = z.object({
    userInput: z.string().min(1).openapi({ example: 'Implement authentication using JWT' })
}).openapi('SuggestFilesRequestBody');

// Request Query Schemas
export const RefreshQuerySchema = z.object({
    folder: z.string().optional().openapi({
        param: { name: 'folder', in: 'query' },
        example: 'src/components',
        description: 'Optional folder path to limit the refresh scope'
    })
}).openapi('RefreshQuery');

export const GetFileSummariesQuerySchema = z.object({
    fileIds: z.string().optional().openapi({
        param: { name: 'fileIds', in: 'query' },
        example: 'file_1a2b3c4d,file_e5f6g7h8',
        description: 'Optional comma-separated list of file IDs to retrieve summaries for'
    })
}).openapi('GetFileSummariesQuery');

// Response Schemas
export const ProjectResponseSchema = z.object({
    success: z.literal(true),
    data: ProjectSchema
}).openapi('ProjectResponse');

export const ProjectResponseMultiStatusSchema = ProjectResponseSchema.extend({
    warning: z.string().optional(),
    error: z.string().optional()
}).openapi('ProjectResponseMultiStatus');

export const ProjectListResponseSchema = z.object({
    success: z.literal(true),
    data: z.array(ProjectSchema)
}).openapi('ProjectListResponse');

export const FileListResponseSchema = z.object({
    success: z.literal(true),
    data: z.array(ProjectFileSchema)
}).openapi('FileListResponse');

// Type exports
export type Project = z.infer<typeof ProjectSchema>;
export type ProjectFile = z.infer<typeof ProjectFileSchema>;
export type CreateProjectBody = z.infer<typeof CreateProjectBodySchema>;
export type UpdateProjectBody = z.infer<typeof UpdateProjectBodySchema>;

// Define ProjectSummaryResponseSchema for the project summary route
export const ProjectSummaryResponseSchema = z.object({
    success: z.literal(true),
    summary: z.string()
}).openapi('ProjectSummaryResponse');

// Define ProjectFileMapSchema using z.map
export const ProjectFileMapSchema = z.map(z.string(), ProjectFileSchema)
    .describe("A map where keys are ProjectFile IDs and values are the corresponding ProjectFile objects.")
    .openapi('ProjectFileMap');

export const projectsApiValidation = {
    create: { body: CreateProjectBodySchema },
    getOrDelete: { params: ProjectIdParamsSchema },
    update: { params: ProjectIdParamsSchema, body: UpdateProjectBodySchema },
    sync: { params: ProjectIdParamsSchema },
    refresh: { params: ProjectIdParamsSchema, query: RefreshQuerySchema },
    getFiles: { params: ProjectIdParamsSchema },
    getFileSummaries: { params: ProjectIdParamsSchema, query: GetFileSummariesQuerySchema },
    summarizeFiles: { params: ProjectIdParamsSchema, body: SummarizeFilesBodySchema },
    resummarizeAll: { params: ProjectIdParamsSchema },
    removeSummaries: { params: ProjectIdParamsSchema, body: RemoveSummariesBodySchema },
    suggestFiles: { params: ProjectIdParamsSchema, body: SuggestFilesBodySchema }
} as const;


// a key/value map by id of all project object (content, file name, path, extension, etc)
export type ProjectFileMap = z.infer<typeof ProjectFileMapSchema>;
