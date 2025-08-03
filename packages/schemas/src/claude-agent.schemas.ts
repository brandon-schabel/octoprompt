import { z } from '@hono/zod-openapi'

// Color enum for agent identification
export const AgentColorSchema = z.enum(['blue', 'green', 'red', 'yellow', 'purple', 'cyan', 'orange', 'pink']).openapi({
  example: 'blue',
  description: 'Color identifier for visual agent differentiation'
})

// Main Claude Agent schema
export const ClaudeAgentSchema = z
  .object({
    id: z.string().openapi({
      example: 'frontend-expert',
      description: 'Agent ID (filename without .md extension)'
    }),
    name: z.string().min(1).openapi({
      example: 'Frontend Expert',
      description: 'Descriptive name for the agent'
    }),
    description: z.string().openapi({
      example: 'Specializes in React, TypeScript, and modern frontend development',
      description: 'Brief description of agent capabilities and specialization'
    }),
    color: AgentColorSchema,
    filePath: z.string().openapi({
      example: 'agents/frontend-expert.md',
      description: 'Relative path to the agent markdown file'
    }),
    content: z.string().openapi({
      example: '# Frontend Expert Agent\n\nSpecialized instructions for frontend development...',
      description: 'Full markdown content of the agent definition'
    }),
    projectId: z.number().optional().openapi({
      description: 'Optional project association for project-specific agents'
    }),
    created: z.number().openapi({
      description: 'Creation timestamp'
    }),
    updated: z.number().openapi({
      description: 'Last update timestamp'
    })
  })
  .openapi('ClaudeAgent')

// Create agent request schema
export const CreateClaudeAgentBodySchema = z
  .object({
    name: z.string().min(1).openapi({
      example: 'Backend Architect',
      description: 'Agent name (required)'
    }),
    description: z.string().min(1).openapi({
      example: 'Expert in API design, database architecture, and backend systems',
      description: 'Agent description (required)'
    }),
    color: AgentColorSchema,
    filePath: z.string().optional().openapi({
      example: 'agents/backend-architect.md',
      description: 'Optional custom file path (will be auto-generated if not provided)'
    }),
    content: z.string().min(1).openapi({
      example: '# Backend Architect\n\nYou are an expert backend developer...',
      description: 'Initial agent markdown content'
    }),
    projectId: z.number().optional().openapi({
      description: 'Optional project ID for project-specific agent'
    })
  })
  .openapi('CreateClaudeAgentBody')

// Update agent request schema
export const UpdateClaudeAgentBodySchema = z
  .object({
    name: z.string().min(1).optional().openapi({
      example: 'Updated Agent Name',
      description: 'New agent name'
    }),
    description: z.string().min(1).optional().openapi({
      example: 'Updated agent description with new capabilities',
      description: 'New agent description'
    }),
    color: AgentColorSchema.optional(),
    filePath: z.string().optional().openapi({
      example: 'agents/updated-path.md',
      description: 'New file path (will move the file if changed)'
    }),
    content: z.string().min(1).optional().openapi({
      example: '# Updated Agent Content\n\nNew instructions...',
      description: 'Updated markdown content'
    })
  })
  .refine((data) => data.name || data.description || data.color || data.filePath || data.content, {
    message: 'At least one field must be provided for update'
  })
  .openapi('UpdateClaudeAgentBody')

// Agent suggestions schema for AI-powered recommendations
export const AgentSuggestionsSchema = z
  .object({
    agents: z.array(
      z.object({
        name: z.string().openapi({
          example: 'Testing Specialist',
          description: 'Suggested agent name'
        }),
        description: z.string().openapi({
          example: 'Expert in unit testing, integration testing, and TDD',
          description: 'Suggested agent description'
        }),
        color: AgentColorSchema,
        suggestedContent: z.string().openapi({
          example: '# Testing Specialist\n\nYou are an expert in testing...',
          description: 'AI-generated agent content suggestion'
        }),
        relevanceScore: z.number().min(0).max(1).openapi({
          example: 0.85,
          description: 'Relevance score based on project context (0-1)'
        }),
        rationale: z.string().openapi({
          example: 'Based on the presence of test files and testing frameworks in the project',
          description: 'Explanation for why this agent is suggested'
        })
      })
    )
  })
  .openapi('AgentSuggestions')

// Request schemas for agent suggestions
export const SuggestAgentsRequestSchema = z
  .object({
    projectId: z.number().openapi({
      description: 'Project ID to analyze for agent suggestions'
    }),
    userContext: z.string().optional().openapi({
      example: 'I need help with performance optimization and database queries',
      description: 'Optional user context to guide suggestions'
    }),
    limit: z.number().int().positive().max(10).optional().default(5).openapi({
      example: 5,
      description: 'Maximum number of agents to suggest (default: 5, max: 10)'
    })
  })
  .openapi('SuggestAgentsRequest')

// Response schemas
export const ClaudeAgentResponseSchema = z
  .object({
    success: z.literal(true),
    data: ClaudeAgentSchema
  })
  .openapi('ClaudeAgentResponse')

export const ClaudeAgentListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(ClaudeAgentSchema)
  })
  .openapi('ClaudeAgentListResponse')

export const AgentSuggestionsResponseSchema = z
  .object({
    success: z.literal(true),
    data: AgentSuggestionsSchema
  })
  .openapi('AgentSuggestionsResponse')

// Parameter schemas
export const AgentIdParamsSchema = z
  .object({
    agentId: z.string().openapi({
      param: { name: 'agentId', in: 'path' },
      example: 'code-reviewer',
      description: 'Agent ID (filename without .md extension)'
    })
  })
  .openapi('AgentIdParams')

// Search/filter schemas
export const SearchAgentsQuerySchema = z
  .object({
    projectId: z.number().optional().openapi({
      description: 'Filter agents by project association'
    }),
    query: z.string().optional().openapi({
      example: 'frontend',
      description: 'Search query for agent name, description, or content'
    }),
    colors: z
      .array(AgentColorSchema)
      .optional()
      .openapi({
        example: ['blue', 'green'],
        description: 'Filter by agent colors'
      }),
    limit: z.number().int().positive().max(100).optional().default(20).openapi({
      example: 20,
      description: 'Maximum results to return'
    }),
    offset: z.number().int().min(0).optional().default(0).openapi({
      example: 0,
      description: 'Pagination offset'
    })
  })
  .openapi('SearchAgentsQuery')

// Batch operation schemas
export const BatchCreateAgentsBodySchema = z
  .object({
    agents: z.array(CreateClaudeAgentBodySchema).min(1).max(10).openapi({
      description: 'Array of agents to create (max 10)'
    })
  })
  .openapi('BatchCreateAgentsBody')

export const BatchUpdateAgentsBodySchema = z
  .object({
    updates: z
      .array(
        z.object({
          agentId: z.string().openapi({
            example: 'code-reviewer',
            description: 'Agent ID (filename without .md extension)'
          }),
          data: UpdateClaudeAgentBodySchema
        })
      )
      .min(1)
      .max(10)
      .openapi({
        description: 'Array of agent updates (max 10)'
      })
  })
  .openapi('BatchUpdateAgentsBody')

export const BatchDeleteAgentsBodySchema = z
  .object({
    agentIds: z
      .array(z.string())
      .min(1)
      .max(10)
      .openapi({
        description: 'Array of agent IDs to delete (max 10)',
        example: ['code-reviewer', 'frontend-expert']
      })
  })
  .openapi('BatchDeleteAgentsBody')

// Type exports
export type ClaudeAgent = z.infer<typeof ClaudeAgentSchema>
export type CreateClaudeAgentBody = z.infer<typeof CreateClaudeAgentBodySchema>
export type UpdateClaudeAgentBody = z.infer<typeof UpdateClaudeAgentBodySchema>
export type AgentSuggestions = z.infer<typeof AgentSuggestionsSchema>
export type SuggestAgentsRequest = z.infer<typeof SuggestAgentsRequestSchema>
export type ClaudeAgentResponse = z.infer<typeof ClaudeAgentResponseSchema>
export type ClaudeAgentListResponse = z.infer<typeof ClaudeAgentListResponseSchema>
export type AgentSuggestionsResponse = z.infer<typeof AgentSuggestionsResponseSchema>
export type AgentIdParams = z.infer<typeof AgentIdParamsSchema>
export type SearchAgentsQuery = z.infer<typeof SearchAgentsQuerySchema>
export type BatchCreateAgentsBody = z.infer<typeof BatchCreateAgentsBodySchema>
export type BatchUpdateAgentsBody = z.infer<typeof BatchUpdateAgentsBodySchema>
export type BatchDeleteAgentsBody = z.infer<typeof BatchDeleteAgentsBodySchema>
export type AgentColor = z.infer<typeof AgentColorSchema>

// API validation schemas (following ticket pattern)
export const agentsApiValidation = {
  create: {
    body: CreateClaudeAgentBodySchema
  },
  update: {
    body: UpdateClaudeAgentBodySchema,
    params: AgentIdParamsSchema
  },
  get: {
    params: AgentIdParamsSchema
  },
  delete: {
    params: AgentIdParamsSchema
  },
  search: {
    query: SearchAgentsQuerySchema
  },
  suggestAgents: {
    body: SuggestAgentsRequestSchema
  },
  batchCreate: {
    body: BatchCreateAgentsBodySchema
  },
  batchUpdate: {
    body: BatchUpdateAgentsBodySchema
  },
  batchDelete: {
    body: BatchDeleteAgentsBodySchema
  }
}
