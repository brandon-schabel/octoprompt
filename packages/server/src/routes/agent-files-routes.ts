// Recent changes:
// - Initial implementation of agent files API routes
// - Added endpoints for detection, update, and status checking
// - Integrated with agent instruction and detection services
// - Added proper error handling and validation
// - Included project-specific context for instructions

import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  agentInstructionService,
  agentFileDetectionService,
  getProjectById,
  type AgentFileInfo,
  type DetectedAgentFile
} from '@promptliano/services'
import { ApiError } from '@promptliano/shared'
import { createStandardResponses, successResponse } from '../utils/route-helpers'

// Schemas
const DetectedAgentFileResponseSchema = z.object({
  type: z.string(),
  name: z.string(),
  path: z.string(),
  scope: z.enum(['global', 'project']),
  exists: z.boolean(),
  writable: z.boolean(),
  hasInstructions: z.boolean().optional(),
  instructionVersion: z.string().optional(),
  metadata: z.record(z.any()).optional()
})

const AgentFilesDetectionResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    projectFiles: z.array(DetectedAgentFileResponseSchema),
    globalFiles: z.array(DetectedAgentFileResponseSchema),
    suggestedFiles: z.array(
      z.object({
        type: z.string(),
        name: z.string(),
        suggestedPath: z.string()
      })
    )
  })
})

const AgentFileUpdateResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    message: z.string(),
    backedUp: z.boolean().optional(),
    filePath: z.string()
  })
})

const AgentFileRemoveResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    message: z.string()
  })
})

const AgentFileStatusResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    currentVersion: z.string(),
    files: z.array(
      z.object({
        path: z.string(),
        exists: z.boolean(),
        hasInstructions: z.boolean(),
        instructionVersion: z.string().optional(),
        isOutdated: z.boolean()
      })
    )
  })
})

const AgentFileCreateResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    message: z.string(),
    filePath: z.string()
  })
})

const UpdateAgentFileBodySchema = z.object({
  filePath: z.string(),
  includeExamples: z.boolean().optional(),
  customInstructions: z.string().optional()
})

const CreateAgentFileBodySchema = z.object({
  type: z.string(),
  includeExamples: z.boolean().optional(),
  customInstructions: z.string().optional()
})

// Routes
const detectAgentFilesRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/agent-files/detect',
  request: {
    params: z.object({
      projectId: z.coerce.number().int().positive()
    })
  },
  responses: createStandardResponses(AgentFilesDetectionResponseSchema),
  tags: ['Agent Files'],
  description: 'Detect agent instruction files for a project'
})

const updateAgentFileRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/agent-files/update',
  request: {
    params: z.object({
      projectId: z.coerce.number().int().positive()
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdateAgentFileBodySchema
        }
      }
    }
  },
  responses: createStandardResponses(AgentFileUpdateResponseSchema),
  tags: ['Agent Files'],
  description: 'Update an agent file with Promptliano instructions'
})

const removeInstructionsRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/agent-files/remove-instructions',
  request: {
    params: z.object({
      projectId: z.coerce.number().int().positive()
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            filePath: z.string()
          })
        }
      }
    }
  },
  responses: createStandardResponses(AgentFileRemoveResponseSchema),
  tags: ['Agent Files'],
  description: 'Remove Promptliano instructions from an agent file'
})

const getAgentFileStatusRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/agent-files/status',
  request: {
    params: z.object({
      projectId: z.coerce.number().int().positive()
    })
  },
  responses: createStandardResponses(AgentFileStatusResponseSchema),
  tags: ['Agent Files'],
  description: 'Check status of agent files and instruction versions'
})

const createAgentFileRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/agent-files/create',
  request: {
    params: z.object({
      projectId: z.coerce.number().int().positive()
    }),
    body: {
      content: {
        'application/json': {
          schema: CreateAgentFileBodySchema
        }
      }
    }
  },
  responses: createStandardResponses(AgentFileCreateResponseSchema),
  tags: ['Agent Files'],
  description: 'Create a new agent file with instructions'
})

// Handlers
export const agentFilesRoutes = new OpenAPIHono()
  .openapi(detectAgentFilesRoute, async (c) => {
    const { projectId } = c.req.valid('param')

    try {
      const project = await getProjectById(projectId)
      if (!project) {
        throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND')
      }

      // Detect files
      const projectFiles = await agentFileDetectionService.detectProjectFiles(project.path)
      const globalFiles = await agentFileDetectionService.detectGlobalFiles()

      // Convert to response format with instruction status
      const enhancedProjectFiles = await Promise.all(
        projectFiles.map(async (file) => {
          const hasInstructions = file.exists && file.content ? file.content.includes('PROMPTLIANO_MCP_INSTRUCTIONS_START') : false
          const versionMatch = file.content?.match(/PROMPTLIANO_MCP_INSTRUCTIONS_START v([\d.]+)/)
          
          // Only include properties defined in the schema
          return {
            type: file.type,
            name: file.name,
            path: file.path,
            scope: file.scope,
            exists: file.exists,
            writable: file.writable,
            hasInstructions,
            instructionVersion: versionMatch ? versionMatch[1] : undefined,
            metadata: file.metadata
          }
        })
      )

      // Convert global files to match schema
      const enhancedGlobalFiles = globalFiles.map(file => ({
        type: file.type,
        name: file.name,
        path: file.path,
        scope: file.scope,
        exists: file.exists,
        writable: file.writable,
        hasInstructions: file.exists && file.content ? file.content.includes('PROMPTLIANO_MCP_INSTRUCTIONS_START') : false,
        instructionVersion: file.content?.match(/PROMPTLIANO_MCP_INSTRUCTIONS_START v([\d.]+)/)?.[1],
        metadata: file.metadata
      }))

      // Get suggested files
      const suggestedFilesRaw = agentFileDetectionService.getSuggestedFiles(project.path, projectFiles)
      const suggestedFiles = suggestedFilesRaw.map(pattern => ({
        type: pattern.type,
        name: pattern.name,
        suggestedPath: pattern.suggestedPath || ''
      }))

      return c.json(successResponse({
        projectFiles: enhancedProjectFiles,
        globalFiles: enhancedGlobalFiles,
        suggestedFiles
      }))
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(500, `Failed to detect agent files: ${error}`)
    }
  })
  .openapi(updateAgentFileRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const { filePath, includeExamples, customInstructions } = c.req.valid('json')

    try {
      const project = await getProjectById(projectId)
      if (!project) {
        throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND')
      }

      const result = await agentInstructionService.updateAgentFile(filePath, {
        projectId,
        projectName: project.name,
        projectPath: project.path,
        includeExamples,
        customInstructions
      })

      if (!result.success) {
        throw new ApiError(500, result.message, 'UPDATE_FAILED')
      }

      return c.json(successResponse({
        message: result.message,
        backedUp: result.backedUp,
        filePath
      }))
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(500, `Failed to update agent file: ${error}`)
    }
  })
  .openapi(removeInstructionsRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const { filePath } = c.req.valid('json')

    try {
      const project = await getProjectById(projectId)
      if (!project) {
        throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND')
      }

      const result = await agentInstructionService.removeInstructions(filePath)

      if (!result.success) {
        throw new ApiError(500, result.message, 'REMOVE_FAILED')
      }

      return c.json(successResponse({
        message: result.message
      }))
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(500, `Failed to remove instructions: ${error}`)
    }
  })
  .openapi(getAgentFileStatusRoute, async (c) => {
    const { projectId } = c.req.valid('param')

    try {
      const project = await getProjectById(projectId)
      if (!project) {
        throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND')
      }

      const currentVersion = agentInstructionService.getCurrentVersion()
      const agentFiles = await agentInstructionService.detectAgentFiles(project.path)

      const fileStatuses = agentFiles.map((file) => ({
        path: file.path,
        exists: file.exists,
        hasInstructions: file.hasInstructions,
        instructionVersion: file.instructionVersion,
        isOutdated: file.hasInstructions && agentInstructionService.isOutdated(file.instructionVersion)
      }))

      return c.json(successResponse({
        currentVersion,
        files: fileStatuses
      }))
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(500, `Failed to get agent file status: ${error}`)
    }
  })
  .openapi(createAgentFileRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const { type, includeExamples, customInstructions } = c.req.valid('json')

    try {
      const project = await getProjectById(projectId)
      if (!project) {
        throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND')
      }

      // Get file pattern for the type
      const fileTypeInfo = agentFileDetectionService.getFileTypeInfo(type)
      if (!fileTypeInfo) {
        throw new ApiError(400, 'Invalid agent file type', 'INVALID_TYPE')
      }

      // Use the first project pattern
      const relativePath = fileTypeInfo.patterns.project[0]
      const filePath = require('path').join(project.path, relativePath)

      // Create the file
      const createResult = await agentFileDetectionService.createAgentFile(filePath, '')
      if (!createResult.success) {
        throw new ApiError(500, createResult.message, 'CREATE_FAILED')
      }

      // Add instructions
      const updateResult = await agentInstructionService.updateAgentFile(filePath, {
        projectId,
        projectName: project.name,
        projectPath: project.path,
        includeExamples,
        customInstructions
      })

      if (!updateResult.success) {
        throw new ApiError(500, updateResult.message, 'UPDATE_FAILED')
      }

      return c.json(successResponse({
        message: 'Successfully created agent file with instructions',
        filePath
      }))
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(500, `Failed to create agent file: ${error}`)
    }
  })
