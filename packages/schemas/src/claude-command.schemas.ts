import { z } from '@hono/zod-openapi'
import { unixTSSchemaSpec, unixTSOptionalSchemaSpec, entityIdSchema, entityIdOptionalSchema } from './schema-utils'

// Command scope enum
export const CommandScopeSchema = z.enum(['project', 'user']).openapi({
  example: 'project',
  description: 'Command scope - project-specific or user-global'
})

// Command frontmatter schema
export const ClaudeCommandFrontmatterSchema = z
  .object({
    'allowed-tools': z.string().optional().openapi({
      example: 'Edit, Read, Bash(git:*)',
      description: 'Comma-separated list of allowed tools'
    }),
    description: z.string().optional().openapi({
      example: 'Performs comprehensive code review',
      description: 'Brief description of the command'
    }),
    'argument-hint': z.string().optional().openapi({
      example: '[file-path]',
      description: 'Hint for expected arguments'
    }),
    model: z.string().optional().openapi({
      example: 'claude-3-5-sonnet-20241022',
      description: 'Preferred model for command execution'
    }),
    'max-turns': z.number().int().positive().optional().openapi({
      example: 10,
      description: 'Maximum conversation turns'
    }),
    'output-format': z.enum(['text', 'json']).optional().openapi({
      example: 'json',
      description: 'Preferred output format'
    })
  })
  .openapi('ClaudeCommandFrontmatter')

// Main Claude Command schema
export const ClaudeCommandSchema = z
  .object({
    id: entityIdSchema,
    name: z.string().min(1).openapi({
      example: 'security-audit',
      description: 'Command name (derived from filename)'
    }),
    namespace: z.string().optional().openapi({
      example: 'frontend',
      description: 'Command namespace (from subdirectory)'
    }),
    scope: CommandScopeSchema,
    description: z.string().optional().openapi({
      example: 'Comprehensive security audit for the codebase',
      description: 'Command description from frontmatter'
    }),
    filePath: z.string().openapi({
      example: '.claude/commands/security-audit.md',
      description: 'Relative path to command file'
    }),
    content: z.string().openapi({
      example: '# Security Audit\n\nPerform comprehensive analysis...',
      description: 'Command markdown content (without frontmatter)'
    }),
    frontmatter: ClaudeCommandFrontmatterSchema,
    created: unixTSSchemaSpec,
    updated: unixTSSchemaSpec
  })
  .openapi('ClaudeCommand')

// Create command request schema
export const CreateClaudeCommandBodySchema = z
  .object({
    name: z
      .string()
      .min(1)
      .regex(/^[a-z0-9-]+$/)
      .openapi({
        example: 'code-review',
        description: 'Command name (lowercase, alphanumeric with hyphens)'
      }),
    namespace: z
      .string()
      .regex(/^[a-z0-9-\/]*$/)
      .optional()
      .openapi({
        example: 'analysis',
        description: 'Optional namespace/subdirectory'
      }),
    scope: CommandScopeSchema.optional().default('project'),
    content: z.string().min(1).openapi({
      example: 'Analyze code for: $ARGUMENTS\n\n## Steps\n1. Check syntax...',
      description: 'Command content with optional $ARGUMENTS placeholder'
    }),
    frontmatter: ClaudeCommandFrontmatterSchema.optional()
  })
  .openapi('CreateClaudeCommandBody')

// Update command request schema
export const UpdateClaudeCommandBodySchema = z
  .object({
    content: z.string().min(1).optional().openapi({
      example: 'Updated command content...',
      description: 'New command content'
    }),
    frontmatter: ClaudeCommandFrontmatterSchema.optional(),
    namespace: z
      .string()
      .regex(/^[a-z0-9-\/]*$/)
      .optional()
      .openapi({
        example: 'utilities',
        description: 'Move command to different namespace'
      })
  })
  .refine((data) => data.content || data.frontmatter || data.namespace, {
    message: 'At least one field must be provided for update'
  })
  .openapi('UpdateClaudeCommandBody')

// Command execution request schema
export const ExecuteClaudeCommandBodySchema = z
  .object({
    arguments: z.string().optional().openapi({
      example: 'src/auth',
      description: 'Arguments to substitute for $ARGUMENTS'
    }),
    options: z
      .object({
        maxTurns: z.number().int().positive().optional(),
        outputFormat: z.enum(['text', 'json']).optional(),
        model: z.string().optional()
      })
      .optional()
  })
  .openapi('ExecuteClaudeCommandBody')

// Command suggestions schema
export const CommandSuggestionsSchema = z
  .object({
    commands: z.array(
      z.object({
        name: z.string().openapi({
          example: 'performance-audit',
          description: 'Suggested command name'
        }),
        namespace: z.string().optional().openapi({
          example: 'analysis',
          description: 'Suggested namespace'
        }),
        description: z.string().openapi({
          example: 'Analyze performance bottlenecks',
          description: 'Command description'
        }),
        suggestedContent: z.string().openapi({
          example: 'Analyze performance for: $ARGUMENTS\n\n...',
          description: 'AI-generated command content'
        }),
        suggestedFrontmatter: ClaudeCommandFrontmatterSchema.optional(),
        relevanceScore: z.number().min(0).max(1).openapi({
          example: 0.92,
          description: 'Relevance score based on context'
        }),
        rationale: z.string().openapi({
          example: 'Based on the performance-critical nature of the project',
          description: 'Explanation for suggestion'
        })
      })
    )
  })
  .openapi('CommandSuggestions')

// Search commands query schema
export const SearchCommandsQuerySchema = z
  .object({
    query: z.string().optional().openapi({
      example: 'security',
      description: 'Search query for command name, description, or content'
    }),
    scope: CommandScopeSchema.optional().openapi({
      description: 'Filter by command scope'
    }),
    namespace: z.string().optional().openapi({
      example: 'frontend',
      description: 'Filter by namespace'
    }),
    includeGlobal: z.boolean().optional().default(true).openapi({
      example: true,
      description: 'Include user-global commands in results'
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
  .openapi('SearchCommandsQuery')

// Response schemas
export const ClaudeCommandResponseSchema = z
  .object({
    success: z.literal(true),
    data: ClaudeCommandSchema
  })
  .openapi('ClaudeCommandResponse')

export const ClaudeCommandListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(ClaudeCommandSchema)
  })
  .openapi('ClaudeCommandListResponse')

export const CommandSuggestionsResponseSchema = z
  .object({
    success: z.literal(true),
    data: CommandSuggestionsSchema
  })
  .openapi('CommandSuggestionsResponse')

export const CommandExecutionResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      result: z.string(),
      usage: z
        .object({
          inputTokens: z.number(),
          outputTokens: z.number(),
          totalTokens: z.number()
        })
        .optional(),
      model: z.string().optional(),
      sessionId: z.string().optional()
    })
  })
  .openapi('CommandExecutionResponse')

// Command generation schemas
export const CommandGenerationRequestSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .regex(/^[a-z0-9-]+$/)
      .openapi({
        example: 'test-runner',
        description: 'Command name (lowercase, alphanumeric with hyphens)'
      }),
    description: z.string().min(1).max(500).openapi({
      example: 'Run all tests for the current file or directory',
      description: 'Brief description of what the command should do'
    }),
    userIntent: z.string().min(1).max(1000).openapi({
      example:
        'I want a command that runs tests for the current file, shows coverage, and fails if coverage is below 80%',
      description: 'Detailed explanation of what the user wants the command to accomplish'
    }),
    namespace: z
      .string()
      .regex(/^[a-z0-9-\/]*$/)
      .optional()
      .openapi({
        example: 'testing',
        description: 'Optional namespace/subdirectory for the command'
      }),
    scope: CommandScopeSchema.optional().default('project'),
    context: z
      .object({
        includeProjectSummary: z.boolean().optional().default(true).openapi({
          description: 'Include project structure and tech stack in generation context'
        }),
        includeFileStructure: z.boolean().optional().default(true).openapi({
          description: 'Include file tree structure in generation context'
        }),
        includeTechStack: z.boolean().optional().default(true).openapi({
          description: 'Include detected technologies in generation context'
        }),
        selectedFiles: z
          .array(z.string())
          .optional()
          .openapi({
            example: ['src/test-utils.ts', 'jest.config.js'],
            description: 'Specific files to consider when generating the command'
          }),
        additionalContext: z.string().optional().openapi({
          example: 'We use Jest for testing and have custom test utilities in src/test-utils.ts',
          description: 'Additional context to help generate a better command'
        })
      })
      .optional()
      .openapi({
        description: 'Context options for command generation'
      })
  })
  .openapi('CommandGenerationRequest')

export const CommandGenerationResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      name: z.string().openapi({
        example: 'test-runner',
        description: 'Generated command name'
      }),
      namespace: z.string().optional().openapi({
        example: 'testing',
        description: 'Suggested namespace'
      }),
      content: z.string().openapi({
        example: 'Run tests for: $ARGUMENTS\n\n1. Detect test framework...\n2. Run tests with coverage...',
        description: 'Generated command content with instructions'
      }),
      frontmatter: ClaudeCommandFrontmatterSchema.openapi({
        description: 'Generated frontmatter configuration'
      }),
      description: z.string().openapi({
        example: 'Runs tests with coverage reporting and threshold checking',
        description: 'Generated command description'
      }),
      rationale: z.string().openapi({
        example: 'Based on Jest configuration found in the project, included coverage flags...',
        description: 'Explanation of design choices made during generation'
      }),
      suggestedVariations: z
        .array(
          z.object({
            name: z.string().openapi({ example: 'test-watch' }),
            description: z.string().openapi({ example: 'Run tests in watch mode' }),
            changes: z.string().openapi({ example: 'Add --watch flag and interactive mode' })
          })
        )
        .optional()
        .openapi({
          description: 'Alternative command variations the user might want'
        })
    })
  })
  .openapi('CommandGenerationResponse')

// Parameter schemas
export const CommandNameParamsSchema = z
  .object({
    commandName: z.string().openapi({ param: { name: 'commandName', in: 'path' } })
  })
  .openapi('CommandNameParams')

// Type exports
export type ClaudeCommand = z.infer<typeof ClaudeCommandSchema>
export type ClaudeCommandFrontmatter = z.infer<typeof ClaudeCommandFrontmatterSchema>
export type CreateClaudeCommandBody = z.infer<typeof CreateClaudeCommandBodySchema>
export type UpdateClaudeCommandBody = z.infer<typeof UpdateClaudeCommandBodySchema>
export type ExecuteClaudeCommandBody = z.infer<typeof ExecuteClaudeCommandBodySchema>
export type CommandSuggestions = z.infer<typeof CommandSuggestionsSchema>
export type SearchCommandsQuery = z.infer<typeof SearchCommandsQuerySchema>
export type CommandScope = z.infer<typeof CommandScopeSchema>
export type CommandGenerationRequest = z.infer<typeof CommandGenerationRequestSchema>
export type CommandGenerationResponse = z.infer<typeof CommandGenerationResponseSchema>

// API validation schemas
export const commandsApiValidation = {
  create: {
    body: CreateClaudeCommandBodySchema
  },
  update: {
    body: UpdateClaudeCommandBodySchema,
    params: CommandNameParamsSchema
  },
  get: {
    params: CommandNameParamsSchema
  },
  delete: {
    params: CommandNameParamsSchema
  },
  search: {
    query: SearchCommandsQuerySchema
  },
  execute: {
    body: ExecuteClaudeCommandBodySchema,
    params: CommandNameParamsSchema
  }
}
