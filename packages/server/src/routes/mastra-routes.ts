// Recent changes:
// 1. Fixed import and response schema issues for proper Hono OpenAPI compatibility
// 2. Updated route paths to use /api/mastra prefix consistently
// 3. Aligned error response schemas with existing codebase patterns
// 4. Fixed type compatibility issues with response handlers
// 5. Added proper error handling for validation and runtime errors

import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { z } from 'zod'

import { ApiError } from '@octoprompt/shared'
import { ApiErrorResponseSchema } from '@octoprompt/schemas'
import { 
  executeMastraCodeChange, 
  batchSummarizeWithMastra, 
  summarizeFileWithMastra,
  generateTaskSuggestionsWithMastra,
  suggestFilesForTicketWithMastra,
  optimizePromptWithMastra,
  analyzePromptWithMastra,
  generateTextWithMastra,
  generateStructuredDataWithMastra,
  streamTextWithMastra
} from '@octoprompt/ai'
import {
  AiGenerateTextRequestSchema,
  AiGenerateTextResponseSchema,
  AiGenerateStructuredRequestSchema,
  AiGenerateStructuredResponseSchema,
  StructuredDataSchemaConfig
} from '@octoprompt/schemas'
import { stream } from 'hono/streaming'

// Request/Response Schemas
const MastraCodeChangeRequestSchema = z.object({
  userRequest: z.string().min(1).max(5000).describe('The coding request or task description'),
  selectedFileIds: z.array(z.number().int().positive()).min(1).max(20).describe('Array of file IDs to modify'),
  options: z
    .object({
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().int().positive().optional()
    })
    .optional()
})

const MastraCodeChangeResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    agentJobId: z.number(),
    updatedFiles: z.array(
      z.object({
        id: z.number(),
        path: z.string(),
        content: z.string(),
        explanation: z.string()
      })
    ),
    summary: z.string()
  })
})

const MastraSummarizeRequestSchema = z.object({
  fileIds: z.array(z.number().int().positive()).min(1).max(50),
  focusArea: z.string().optional().describe('Specific area to focus on in the summary')
})

const MastraSummarizeResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    included: z.number(),
    skipped: z.number(),
    summaries: z.array(
      z.object({
        fileId: z.number(),
        path: z.string(),
        summary: z.string()
      })
    )
  })
})

// Schema for prompt optimization requests
const MastraPromptOptimizationRequestSchema = z.object({
  prompt: z.string().min(1).max(10000).describe('The prompt to optimize'),
  optimizationGoals: z.array(z.string()).optional().describe('Specific optimization goals'),
  context: z.string().optional().describe('Additional context for optimization')
})

const MastraPromptOptimizationResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    optimizedPrompt: z.string(),
    improvements: z.array(z.object({
      category: z.string(),
      description: z.string(),
      impact: z.string()
    })),
    qualityScore: z.object({
      original: z.number(),
      optimized: z.number()
    }),
    reasoning: z.string(),
    suggestions: z.array(z.string())
  })
})

// Schema for task generation requests  
const MastraTaskGenerationRequestSchema = z.object({
  ticketId: z.number().int().positive(),
  userContext: z.string().optional().describe('Additional context for task generation')
})

const MastraTaskGenerationResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    tasks: z.array(z.object({
      title: z.string(),
      description: z.string(),
      priority: z.string(),
      estimatedTime: z.string(),
      dependencies: z.array(z.string()),
      tags: z.array(z.string())
    })),
    reasoning: z.string()
  })
})

// Schema for file suggestion requests
const MastraFileSuggestionRequestSchema = z.object({
  ticketId: z.number().int().positive(),
  maxSuggestions: z.number().int().min(1).max(20).optional().default(5)
})

const MastraFileSuggestionResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    recommendedFileIds: z.array(z.number()),
    reasoning: z.string(),
    confidenceScore: z.number()
  })
})

// Route Definitions
const mastraCodeChangeRoute = createRoute({
  method: 'post',
  path: '/api/mastra/code-change',
  tags: ['AI', 'Mastra'],
  summary: 'Generate code changes using Mastra workflow',
  description: 'Use Mastra agents and workflows to analyze, plan, and execute code changes',
  request: {
    body: {
      content: {
        'application/json': {
          schema: MastraCodeChangeRequestSchema.extend({
            projectId: z.number().int().positive()
          })
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: MastraCodeChangeResponseSchema
        }
      },
      description: 'Code changes generated successfully'
    },
    400: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Invalid request parameters'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Project or files not found'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal server error'
    }
  }
})

const mastraSummarizeRoute = createRoute({
  method: 'post',
  path: '/api/mastra/summarize',
  tags: ['AI', 'Mastra'],
  summary: 'Summarize files using Mastra agent',
  description: 'Generate intelligent summaries of code files using Mastra AI agents',
  request: {
    body: {
      content: {
        'application/json': {
          schema: MastraSummarizeRequestSchema.extend({
            projectId: z.number().int().positive()
          })
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: MastraSummarizeResponseSchema
        }
      },
      description: 'Files summarized successfully'
    },
    400: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Invalid request parameters'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Project or files not found'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal server error'
    }
  }
})

const mastraSingleSummarizeRoute = createRoute({
  method: 'post',
  path: '/api/mastra/summarize/file',
  tags: ['AI', 'Mastra'],
  summary: 'Summarize a single file using Mastra',
  description: 'Generate an intelligent summary of a single code file',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            projectId: z.number().int().positive(),
            fileId: z.number().int().positive(),
            focusArea: z.string().optional()
          })
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.object({
              summary: z.string(),
              fileId: z.number(),
              path: z.string()
            })
          })
        }
      },
      description: 'File summarized successfully'
    },
    400: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Invalid request parameters'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Project or file not found'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal server error'
    }
  }
})

// Prompt optimization route
const mastraPromptOptimizationRoute = createRoute({
  method: 'post',
  path: '/api/mastra/optimize-prompt',
  tags: ['AI', 'Mastra'],
  summary: 'Optimize a prompt using Mastra',
  description: 'Improve prompt quality and effectiveness using AI analysis',
  request: {
    body: {
      content: {
        'application/json': {
          schema: MastraPromptOptimizationRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: MastraPromptOptimizationResponseSchema
        }
      },
      description: 'Prompt optimized successfully'
    },
    400: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Invalid request parameters'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal server error'
    }
  }
})

// Task generation route
const mastraTaskGenerationRoute = createRoute({
  method: 'post',
  path: '/api/mastra/generate-tasks',
  tags: ['AI', 'Mastra'],
  summary: 'Generate tasks for a ticket using Mastra',
  description: 'AI-powered task generation based on ticket requirements',
  request: {
    body: {
      content: {
        'application/json': {
          schema: MastraTaskGenerationRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: MastraTaskGenerationResponseSchema
        }
      },
      description: 'Tasks generated successfully'
    },
    400: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Invalid request parameters'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Ticket not found'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal server error'
    }
  }
})

// File suggestion route
const mastraFileSuggestionRoute = createRoute({
  method: 'post',
  path: '/api/mastra/suggest-files',
  tags: ['AI', 'Mastra'],
  summary: 'Suggest relevant files for a ticket using Mastra',
  description: 'AI-powered file suggestion based on ticket context',
  request: {
    body: {
      content: {
        'application/json': {
          schema: MastraFileSuggestionRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: MastraFileSuggestionResponseSchema
        }
      },
      description: 'Files suggested successfully'
    },
    400: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Invalid request parameters'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Ticket not found'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal server error'
    }
  }
})

// Basic text generation routes (migrated from gen-ai-routes)
const generateTextRoute = createRoute({
  method: 'post',
  path: '/api/gen-ai/text',
  tags: ['AI', 'Mastra'],
  summary: 'Generate text using Mastra',
  request: {
    body: {
      content: { 'application/json': { schema: AiGenerateTextRequestSchema } },
      required: true
    }
  },
  responses: {
    200: {
      content: { 'application/json': { schema: AiGenerateTextResponseSchema } },
      description: 'Successfully generated text'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

const generateStreamRoute = createRoute({
  method: 'post',
  path: '/api/gen-ai/stream',
  tags: ['AI', 'Mastra'],
  summary: 'Generate streaming text using Mastra',
  request: {
    body: {
      content: { 'application/json': { schema: AiGenerateTextRequestSchema } },
      required: true
    }
  },
  responses: {
    200: {
      content: {
        'text/event-stream': {
          schema: z.string().openapi({ description: 'Stream of response tokens' })
        }
      },
      description: 'Successfully initiated AI response stream'
    }
  }
})

const generateStructuredRoute = createRoute({
  method: 'post',
  path: '/api/gen-ai/structured',
  tags: ['AI', 'Mastra'],
  summary: 'Generate structured data using Mastra',
  request: {
    body: {
      content: { 'application/json': { schema: AiGenerateStructuredRequestSchema } },
      required: true
    }
  },
  responses: {
    200: {
      content: { 'application/json': { schema: AiGenerateStructuredResponseSchema } },
      description: 'Successfully generated structured data'
    },
    400: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Invalid schema key'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

// Define structured data schemas for compatibility
const structuredDataSchemas: Record<string, StructuredDataSchemaConfig<any>> = {
  filenameSuggestion: {
    name: 'Filename Suggestion',
    description: "Suggests 5 suitable filenames based on a description of the file's content.",
    promptTemplate:
      'Based on the following file description, suggest 5 suitable and conventional filenames. File Description: {userInput}',
    systemPrompt:
      'You are an expert programmer specializing in clear code organization and naming conventions. Provide concise filename suggestions.',
    modelSettings: {
      model: 'gpt-4o',
      temperature: 0.5
    },
    schema: z.object({
      suggestions: z.array(z.string()).length(5),
      reasoning: z.string().optional()
    }).openapi('FilenameSuggestionOutput')
  },
  basicSummary: {
    name: 'Basic Summary',
    description: 'Generates a short summary of the input text.',
    promptTemplate: 'Summarize the following text concisely: {userInput}',
    systemPrompt: 'You are a summarization expert.',
    modelSettings: { model: 'gpt-4o', temperature: 0.6, maxTokens: 150 },
    schema: z.object({
      summary: z.string().openapi({ description: 'The generated summary.' })
    }).openapi('BasicSummaryOutput')
  }
}

// File editing route (replaces ai-file-change functionality)
const mastraFileEditRoute = createRoute({
  method: 'post',
  path: '/api/mastra/edit-file',
  tags: ['AI', 'Mastra'],
  summary: 'Edit a single file using Mastra agent',
  description: 'AI-powered file editing that combines previous ai-file-change with agent coder functionality',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            projectId: z.number().int().positive(),
            fileId: z.number().int().positive(),
            prompt: z.string().min(1).max(5000).describe('Description of the changes to make to this file'),
            options: z
              .object({
                temperature: z.number().min(0).max(2).optional(),
                maxTokens: z.number().int().positive().optional()
              })
              .optional()
          })
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.object({
              agentJobId: z.number(),
              updatedFiles: z.array(
                z.object({
                  id: z.number(),
                  path: z.string(),
                  content: z.string(),
                  explanation: z.string()
                })
              ),
              summary: z.string()
            })
          })
        }
      },
      description: 'File edited successfully'
    },
    400: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Invalid request parameters'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Project or file not found'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal server error'
    }
  }
})

// Route Handlers
export const mastraRoutes = new OpenAPIHono()
  // Basic AI generation routes
  .openapi(generateTextRoute, async (c) => {
    const body = c.req.valid('json')

    const generatedText = await generateTextWithMastra({
      prompt: body.prompt,
      ...(body.options && {
        options: body.options
      }),
      systemMessage: body.systemMessage
    })

    return c.json(
      {
        success: true,
        data: { text: generatedText }
      } satisfies z.infer<typeof AiGenerateTextResponseSchema>,
      200
    )
  })

  .openapi(generateStreamRoute, async (c) => {
    const body = c.req.valid('json')
    const { prompt, options, systemMessage } = body

    const aiSDKStream = await streamTextWithMastra({
      prompt,
      ...(options && {
        options: options
      }),
      systemMessage
    })

    return stream(c, async (streamInstance) => {
      await streamInstance.pipe(aiSDKStream.toDataStream())
    })
  })

  .openapi(generateStructuredRoute, async (c) => {
    const body = c.req.valid('json')
    const { schemaKey, userInput, options } = body

    const config: StructuredDataSchemaConfig<z.ZodTypeAny> =
      structuredDataSchemas[schemaKey as keyof typeof structuredDataSchemas]
    if (!config) {
      throw new ApiError(
        400,
        `Invalid schemaKey provided: ${schemaKey}. Valid keys are: ${Object.keys(structuredDataSchemas).join(', ')}`,
        'INVALID_SCHEMA_KEY'
      )
    }

    const finalPrompt = config?.promptTemplate?.replace('{userInput}', userInput)
    const finalModel = options?.model ?? config?.modelSettings?.model ?? 'gpt-4o'
    const finalOptions = { ...config.modelSettings, ...options, model: finalModel }
    const finalSystemPrompt = config.systemPrompt

    const result = await generateStructuredDataWithMastra({
      prompt: finalPrompt ?? '',
      schema: config.schema,
      options: finalOptions,
      systemMessage: finalSystemPrompt
    })

    return c.json(
      {
        success: true,
        data: { output: result.object }
      } satisfies z.infer<typeof AiGenerateStructuredResponseSchema>,
      200
    )
  })

  // File editing route (combines ai-file-change with agent coder)
  .openapi(mastraFileEditRoute, async (c) => {
    try {
      const { projectId, fileId, prompt, options } = c.req.valid('json')

      console.log(`[MastraRoutes] File edit request for project ${projectId}, file ${fileId}`)
      console.log(`[MastraRoutes] Prompt: ${prompt.substring(0, 100)}...`)

      // Use the same Mastra code change functionality but with a single file
      const result = await executeMastraCodeChange({
        projectId,
        userRequest: prompt,
        selectedFileIds: [fileId]
      })

      if (!result.success) {
        throw new ApiError(500, result.error || 'File edit failed', 'MASTRA_FILE_EDIT_FAILED')
      }

      return c.json(
        {
          success: true as const,
          data: {
            agentJobId: result.agentJobId,
            updatedFiles: result.updatedFiles,
            summary: result.summary
          }
        },
        200
      )
    } catch (error) {
      console.error('[MastraRoutes] File edit error:', error)
      throw error instanceof ApiError ? error : new ApiError(500, 'Internal server error', 'INTERNAL_ERROR')
    }
  })

  // Specialized Mastra routes
  .openapi(mastraCodeChangeRoute, async (c) => {
    try {
      const { projectId, userRequest, selectedFileIds, options } = c.req.valid('json')

      console.log(`[MastraRoutes] Code change request for project ${projectId}`)
      console.log(`[MastraRoutes] Request: ${userRequest.substring(0, 100)}...`)
      console.log(`[MastraRoutes] Files: ${selectedFileIds.length}`)

      const result = await executeMastraCodeChange({
        projectId,
        userRequest,
        selectedFileIds
      })

      if (!result.success) {
        throw new ApiError(500, result.error || 'Code generation failed', 'MASTRA_CODE_CHANGE_FAILED')
      }

      return c.json(
        {
          success: true as const,
          data: {
            agentJobId: result.agentJobId,
            updatedFiles: result.updatedFiles,
            summary: result.summary
          }
        },
        200
      )
    } catch (error) {
      console.error('[MastraRoutes] Code change error:', error)
      throw error instanceof ApiError ? error : new ApiError(500, 'Internal server error', 'INTERNAL_ERROR')
    }
  })

  .openapi(mastraSummarizeRoute, async (c) => {
    try {
      const { projectId, fileIds, focusArea } = c.req.valid('json')

      console.log(`[MastraRoutes] Batch summarize request for project ${projectId}, files: ${fileIds.length}`)

      const result = await batchSummarizeWithMastra(projectId, fileIds)

      return c.json(
        {
          success: true as const,
          data: result
        },
        200
      )
    } catch (error) {
      console.error('[MastraRoutes] Batch summarize error:', error)
      throw error instanceof ApiError ? error : new ApiError(500, 'Internal server error', 'BATCH_SUMMARIZE_ERROR')
    }
  })

  .openapi(mastraSingleSummarizeRoute, async (c) => {
    try {
      const { projectId, fileId, focusArea } = c.req.valid('json')

      console.log(`[MastraRoutes] Single file summarize: project ${projectId}, file ${fileId}`)

      const result = await summarizeFileWithMastra(projectId, fileId, focusArea)

      return c.json(
        {
          success: true as const,
          data: {
            summary: result.summary,
            fileId,
            path: result.updatedFile.path
          }
        },
        200
      )
    } catch (error) {
      console.error('[MastraRoutes] Single summarize error:', error)
      throw error instanceof ApiError ? error : new ApiError(500, 'Internal server error', 'FILE_SUMMARIZE_ERROR')
    }
  })

  .openapi(mastraPromptOptimizationRoute, async (c) => {
    try {
      const { prompt, optimizationGoals, context } = c.req.valid('json')

      console.log(`[MastraRoutes] Prompt optimization request: ${prompt.substring(0, 100)}...`)

      const result = await optimizePromptWithMastra(prompt, optimizationGoals, context)

      return c.json(
        {
          success: true as const,
          data: result
        },
        200
      )
    } catch (error) {
      console.error('[MastraRoutes] Prompt optimization error:', error)
      throw error instanceof ApiError ? error : new ApiError(500, 'Internal server error', 'PROMPT_OPTIMIZATION_ERROR')
    }
  })

  .openapi(mastraTaskGenerationRoute, async (c) => {
    try {
      const { ticketId, userContext } = c.req.valid('json')

      console.log(`[MastraRoutes] Task generation request for ticket ${ticketId}`)

      // First get the ticket
      const { ticketStorage } = await import('@octoprompt/storage')
      const allTickets = await ticketStorage.readTickets()
      const ticket = allTickets[ticketId.toString()]
      
      if (!ticket) {
        throw new ApiError(404, `Ticket not found: ${ticketId}`, 'TICKET_NOT_FOUND')
      }

      const result = await generateTaskSuggestionsWithMastra(ticket, userContext)

      return c.json(
        {
          success: true as const,
          data: result
        },
        200
      )
    } catch (error) {
      console.error('[MastraRoutes] Task generation error:', error)
      throw error instanceof ApiError ? error : new ApiError(500, 'Internal server error', 'TASK_GENERATION_ERROR')
    }
  })

  .openapi(mastraFileSuggestionRoute, async (c) => {
    try {
      const { ticketId, maxSuggestions } = c.req.valid('json')

      console.log(`[MastraRoutes] File suggestion request for ticket ${ticketId}`)

      // First get the ticket
      const { ticketStorage } = await import('@octoprompt/storage')
      const allTickets = await ticketStorage.readTickets()
      const ticket = allTickets[ticketId.toString()]
      
      if (!ticket) {
        throw new ApiError(404, `Ticket not found: ${ticketId}`, 'TICKET_NOT_FOUND')
      }

      const result = await suggestFilesForTicketWithMastra(ticket, maxSuggestions)

      return c.json(
        {
          success: true as const,
          data: result
        },
        200
      )
    } catch (error) {
      console.error('[MastraRoutes] File suggestion error:', error)
      throw error instanceof ApiError ? error : new ApiError(500, 'Internal server error', 'FILE_SUGGESTION_ERROR')
    }
  })

// Comparison utility route (for testing both implementations)
const comparisonRoute = createRoute({
  method: 'post',
  path: '/api/mastra/compare',
  tags: ['AI', 'Development'],
  summary: 'Compare Mastra vs Original implementation',
  description: 'Development endpoint to compare results between Mastra and original agent implementations',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            projectId: z.number().int().positive(),
            userRequest: z.string(),
            selectedFileIds: z.array(z.number()),
            runBoth: z.boolean().default(false)
          })
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.object({
              comparison: z.object({
                mastraTime: z.number(),
                mastraSuccess: z.boolean(),
                originalTime: z.number().optional(),
                originalSuccess: z.boolean().optional()
              }),
              mastraResult: z.any().optional(),
              originalResult: z.any().optional()
            })
          })
        }
      },
      description: 'Comparison results'
    },
    500: {
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      },
      description: 'Internal server error'
    }
  }
})

export const comparisonRoutes = new OpenAPIHono().openapi(comparisonRoute, async (c) => {
  try {
    const { projectId, userRequest, selectedFileIds, runBoth } = c.req.valid('json')

    // Run Mastra implementation
    const mastraStart = Date.now()
    const mastraResult = await executeMastraCodeChange({
      projectId,
      userRequest,
      selectedFileIds
    })
    const mastraTime = Date.now() - mastraStart

    let originalResult: any
    let originalTime: number | undefined

    if (runBoth) {
      // Optionally run original implementation for comparison
      // const originalStart = Date.now();
      // originalResult = await originalImplementation(...);
      // originalTime = Date.now() - originalStart;
    }

    return c.json(
      {
        success: true as const,
        data: {
          comparison: {
            mastraTime,
            originalTime,
            mastraSuccess: mastraResult.success,
            originalSuccess: originalResult?.success
          },
          mastraResult,
          originalResult
        }
      },
      200
    )
  } catch (error) {
    console.error('[MastraRoutes] Comparison error:', error)
    throw error instanceof ApiError ? error : new ApiError(500, 'Comparison failed', 'COMPARISON_FAILED')
  }
})
