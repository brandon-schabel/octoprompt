import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  ApiErrorResponseSchema,
  OperationSuccessResponseSchema,
  HookConfigResponseSchema,
  HookConfigListResponseSchema,
  CreateHookConfigBodySchema,
  UpdateHookConfigBodySchema,
  HookConfigurationLevelSchema,
  HookEventSchema,
  HookRegistryEntrySchema
} from '@promptliano/schemas'
import { claudeHookService } from '@promptliano/services'
import { ApiError } from '@promptliano/shared'

// Parameter schemas
const ProjectPathParamsSchema = z
  .object({
    projectPath: z.string().openapi({
      param: { name: 'projectPath', in: 'path' },
      description: 'Project directory path (URL encoded)'
    })
  })
  .openapi('ProjectPathParams')

const HookParamsSchema = z
  .object({
    projectPath: z.string().openapi({
      param: { name: 'projectPath', in: 'path' },
      description: 'Project directory path (URL encoded)'
    }),
    level: HookConfigurationLevelSchema.openapi({
      param: { name: 'level', in: 'path' },
      description: 'Hook configuration level'
    }),
    eventName: HookEventSchema.openapi({
      param: { name: 'eventName', in: 'path' },
      description: 'Hook event name'
    }),
    matcherIndex: z.coerce
      .number()
      .int()
      .min(0)
      .openapi({
        param: { name: 'matcherIndex', in: 'path' },
        description: 'Index of the matcher group'
      })
  })
  .openapi('HookParams')

// Query schemas
const SearchQuerySchema = z
  .object({
    q: z
      .string()
      .optional()
      .openapi({
        param: { name: 'q', in: 'query' },
        description: 'Search query for hooks'
      })
  })
  .openapi('SearchQuery')

// Request body schemas
const GenerateHookBodySchema = z
  .object({
    description: z.string().min(1).openapi({
      example: 'Run tests after editing any file',
      description: 'Description of what the hook should do'
    }),
    context: z
      .object({
        suggestedEvent: HookEventSchema.optional(),
        examples: z.array(z.string()).optional()
      })
      .optional()
      .openapi({
        description: 'Additional context for hook generation'
      })
  })
  .openapi('GenerateHookBody')

const TestHookBodySchema = z
  .object({
    hookConfig: z.object({
      type: z.literal('command'),
      command: z.string(),
      timeout: z.number().optional(),
      run_in_background: z.boolean().optional()
    }),
    samplePayload: z.record(z.any()).optional()
  })
  .openapi('TestHookBody')

// Response schemas
const HookGenerationResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      event: HookEventSchema,
      matcher: z.string(),
      hookConfig: z.object({
        type: z.literal('command'),
        command: z.string(),
        timeout: z.number(),
        run_in_background: z.boolean()
      }),
      configLevel: HookConfigurationLevelSchema,
      description: z.string(),
      security_warnings: z.array(z.string()).optional()
    })
  })
  .openapi('HookGenerationResponse')

const HookTestResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      testSuccess: z.boolean(),
      output: z.string().optional(),
      error: z.string().optional(),
      executionTime: z.number().optional()
    })
  })
  .openapi('HookTestResponse')

// Helper function to decode project path
const decodeProjectPath = (encodedPath: string): string => {
  try {
    return decodeURIComponent(encodedPath)
  } catch (error) {
    throw new ApiError(400, 'Invalid project path encoding')
  }
}

// Helper function to format hook with metadata
const formatHookWithMetadata = (hook: any) => {
  return {
    id: `${hook.level}_${hook.eventName}_${hook.matcher}`,
    configLevel: hook.level,
    event: hook.eventName,
    matcher: hook.matcher,
    hookConfig: hook.config,
    filePath: hook.filePath,
    enabled: true,
    created: Date.now(),
    lastExecuted: undefined,
    executionCount: 0
  }
}

// Routes
const listHooksRoute = createRoute({
  method: 'get',
  path: '/api/claude-hooks/{projectPath}',
  tags: ['Claude Hooks'],
  summary: 'List all hooks for a project',
  description: 'Retrieves all Claude Code hooks configured for the specified project path',
  request: {
    params: ProjectPathParamsSchema
  },
  responses: {
    200: {
      content: { 'application/json': { schema: HookConfigListResponseSchema } },
      description: 'Successfully retrieved hooks'
    },
    400: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Invalid project path'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

const getHookRoute = createRoute({
  method: 'get',
  path: '/api/claude-hooks/{projectPath}/{level}/{eventName}/{matcherIndex}',
  tags: ['Claude Hooks'],
  summary: 'Get specific hook configuration',
  description: 'Retrieves a specific hook by its configuration level, event name, and matcher index',
  request: {
    params: HookParamsSchema
  },
  responses: {
    200: {
      content: { 'application/json': { schema: HookConfigResponseSchema } },
      description: 'Successfully retrieved hook'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Hook not found'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

const createHookRoute = createRoute({
  method: 'post',
  path: '/api/claude-hooks/{projectPath}',
  tags: ['Claude Hooks'],
  summary: 'Create new hook',
  description: 'Creates a new Claude Code hook configuration',
  request: {
    params: ProjectPathParamsSchema,
    body: { content: { 'application/json': { schema: CreateHookConfigBodySchema } } }
  },
  responses: {
    201: {
      content: { 'application/json': { schema: HookConfigResponseSchema } },
      description: 'Hook created successfully'
    },
    400: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Validation Error'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

const updateHookRoute = createRoute({
  method: 'put',
  path: '/api/claude-hooks/{projectPath}/{level}/{eventName}/{matcherIndex}',
  tags: ['Claude Hooks'],
  summary: 'Update hook configuration',
  description: 'Updates an existing Claude Code hook configuration',
  request: {
    params: HookParamsSchema,
    body: { content: { 'application/json': { schema: UpdateHookConfigBodySchema } } }
  },
  responses: {
    200: {
      content: { 'application/json': { schema: HookConfigResponseSchema } },
      description: 'Hook updated successfully'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Hook not found'
    },
    400: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Validation Error'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

const deleteHookRoute = createRoute({
  method: 'delete',
  path: '/api/claude-hooks/{projectPath}/{level}/{eventName}/{matcherIndex}',
  tags: ['Claude Hooks'],
  summary: 'Delete hook configuration',
  description: 'Deletes an existing Claude Code hook configuration',
  request: {
    params: HookParamsSchema
  },
  responses: {
    200: {
      content: { 'application/json': { schema: OperationSuccessResponseSchema } },
      description: 'Hook deleted successfully'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Hook not found'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

const generateHookRoute = createRoute({
  method: 'post',
  path: '/api/claude-hooks/{projectPath}/generate',
  tags: ['Claude Hooks', 'AI'],
  summary: 'Generate hook from description',
  description: 'Uses AI to generate a hook configuration from a natural language description',
  request: {
    params: ProjectPathParamsSchema,
    body: { content: { 'application/json': { schema: GenerateHookBodySchema } } }
  },
  responses: {
    200: {
      content: { 'application/json': { schema: HookGenerationResponseSchema } },
      description: 'Hook generated successfully'
    },
    400: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Validation Error'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

const testHookRoute = createRoute({
  method: 'post',
  path: '/api/claude-hooks/{projectPath}/test',
  tags: ['Claude Hooks'],
  summary: 'Test hook execution',
  description: 'Tests hook execution with optional sample payload to validate configuration',
  request: {
    params: ProjectPathParamsSchema,
    body: { content: { 'application/json': { schema: TestHookBodySchema } } }
  },
  responses: {
    200: {
      content: { 'application/json': { schema: HookTestResponseSchema } },
      description: 'Hook test completed'
    },
    400: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Validation Error'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

const searchHooksRoute = createRoute({
  method: 'get',
  path: '/api/claude-hooks/{projectPath}/search',
  tags: ['Claude Hooks'],
  summary: 'Search hooks',
  description: 'Searches hooks by command, matcher, event name, or description',
  request: {
    params: ProjectPathParamsSchema,
    query: SearchQuerySchema
  },
  responses: {
    200: {
      content: { 'application/json': { schema: HookConfigListResponseSchema } },
      description: 'Search completed successfully'
    },
    400: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Invalid search parameters'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

export const claudeHookRoutes = new OpenAPIHono()
  .openapi(listHooksRoute, async (c) => {
    const { projectPath } = c.req.valid('param')
    const decodedPath = decodeProjectPath(projectPath)

    try {
      const hooks = await claudeHookService.listHooks(decodedPath)
      const formattedHooks = hooks.map(formatHookWithMetadata)

      return c.json(
        {
          success: true,
          data: formattedHooks
        } satisfies z.infer<typeof HookConfigListResponseSchema>,
        200
      )
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(
        500,
        `Failed to list hooks: ${error instanceof Error ? error.message : String(error)}`,
        'LIST_HOOKS_FAILED'
      )
    }
  })
  .openapi(getHookRoute, async (c) => {
    const { projectPath, level, eventName, matcherIndex } = c.req.valid('param')
    const decodedPath = decodeProjectPath(projectPath)

    try {
      const hook = await claudeHookService.getHook(decodedPath, level, eventName, matcherIndex)

      if (!hook) {
        throw new ApiError(404, `Hook not found at ${level} level for event ${eventName} at index ${matcherIndex}`)
      }

      const formattedHook = formatHookWithMetadata(hook)

      return c.json(
        {
          success: true,
          data: formattedHook
        } satisfies z.infer<typeof HookConfigResponseSchema>,
        200
      )
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(
        500,
        `Failed to get hook: ${error instanceof Error ? error.message : String(error)}`,
        'GET_HOOK_FAILED'
      )
    }
  })
  .openapi(createHookRoute, async (c) => {
    const { projectPath } = c.req.valid('param')
    const body = c.req.valid('json')
    const decodedPath = decodeProjectPath(projectPath)

    try {
      const hook = await claudeHookService.createHook(decodedPath, body.configLevel || 'project', body)
      const formattedHook = formatHookWithMetadata(hook)

      return c.json(
        {
          success: true,
          data: formattedHook
        } satisfies z.infer<typeof HookConfigResponseSchema>,
        201
      )
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(
        500,
        `Failed to create hook: ${error instanceof Error ? error.message : String(error)}`,
        'CREATE_HOOK_FAILED'
      )
    }
  })
  .openapi(updateHookRoute, async (c) => {
    const { projectPath, level, eventName, matcherIndex } = c.req.valid('param')
    const body = c.req.valid('json')
    const decodedPath = decodeProjectPath(projectPath)

    try {
      const hook = await claudeHookService.updateHook(decodedPath, level, eventName, matcherIndex, body)
      const formattedHook = formatHookWithMetadata(hook)

      return c.json(
        {
          success: true,
          data: formattedHook
        } satisfies z.infer<typeof HookConfigResponseSchema>,
        200
      )
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(
        500,
        `Failed to update hook: ${error instanceof Error ? error.message : String(error)}`,
        'UPDATE_HOOK_FAILED'
      )
    }
  })
  .openapi(deleteHookRoute, async (c) => {
    const { projectPath, level, eventName, matcherIndex } = c.req.valid('param')
    const decodedPath = decodeProjectPath(projectPath)

    try {
      const deleted = await claudeHookService.deleteHook(decodedPath, level, eventName, matcherIndex)

      if (!deleted) {
        throw new ApiError(404, `Hook not found at ${level} level for event ${eventName} at index ${matcherIndex}`)
      }

      return c.json(
        {
          success: true,
          message: 'Hook deleted successfully'
        } satisfies z.infer<typeof OperationSuccessResponseSchema>,
        200
      )
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(
        500,
        `Failed to delete hook: ${error instanceof Error ? error.message : String(error)}`,
        'DELETE_HOOK_FAILED'
      )
    }
  })
  .openapi(generateHookRoute, async (c) => {
    const { projectPath } = c.req.valid('param')
    const { description, context } = c.req.valid('json')
    const decodedPath = decodeProjectPath(projectPath)

    try {
      const generatedHook = await claudeHookService.generateHookFromDescription(description, {
        projectPath: decodedPath,
        ...context
      })

      return c.json(
        {
          success: true,
          data: generatedHook
        } satisfies z.infer<typeof HookGenerationResponseSchema>,
        200
      )
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(
        500,
        `Failed to generate hook: ${error instanceof Error ? error.message : String(error)}`,
        'GENERATE_HOOK_FAILED'
      )
    }
  })
  .openapi(testHookRoute, async (c) => {
    const { projectPath } = c.req.valid('param')
    const { hookConfig, samplePayload } = c.req.valid('json')
    const decodedPath = decodeProjectPath(projectPath)

    try {
      const testResult = await claudeHookService.testHook(decodedPath, hookConfig, samplePayload)

      return c.json(
        {
          success: true,
          data: {
            testSuccess: testResult.success,
            output: testResult.output,
            error: testResult.error,
            executionTime: testResult.executionTime
          }
        } satisfies z.infer<typeof HookTestResponseSchema>,
        200
      )
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(
        500,
        `Failed to test hook: ${error instanceof Error ? error.message : String(error)}`,
        'TEST_HOOK_FAILED'
      )
    }
  })
  .openapi(searchHooksRoute, async (c) => {
    const { projectPath } = c.req.valid('param')
    const { q } = c.req.valid('query')
    const decodedPath = decodeProjectPath(projectPath)

    try {
      const hooks = await claudeHookService.searchHooks(decodedPath, q || '')
      const formattedHooks = hooks.map(formatHookWithMetadata)

      return c.json(
        {
          success: true,
          data: formattedHooks
        } satisfies z.infer<typeof HookConfigListResponseSchema>,
        200
      )
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(
        500,
        `Failed to search hooks: ${error instanceof Error ? error.message : String(error)}`,
        'SEARCH_HOOKS_FAILED'
      )
    }
  })

export type ClaudeHookRouteTypes = typeof claudeHookRoutes
