import { z } from '@hono/zod-openapi'

// Core hook event types supported by Claude Code
export const HookEventSchema = z
  .enum([
    'PreToolUse',
    'PostToolUse',
    'UserPromptSubmit',
    'Notification',
    'Stop',
    'SubagentStop',
    'SessionStart',
    'PreCompact'
  ])
  .openapi({
    example: 'PreToolUse',
    description: 'Hook event type that triggers the hook execution'
  })

export type HookEvent = z.infer<typeof HookEventSchema>

// Individual hook configuration matching Claude Code's exact format
export const ClaudeHookConfigSchema = z
  .object({
    type: z.literal('command').openapi({
      example: 'command',
      description: 'Type of hook (currently only command is supported)'
    }),
    command: z.string().min(1).openapi({
      example: 'echo "Tool executed: $TOOL_NAME"',
      description: 'Command to execute'
    }),
    timeout: z.number().min(1).default(60).openapi({
      example: 60,
      description: 'Timeout in seconds (default: 60)'
    }),
    run_in_background: z.boolean().default(false).openapi({
      example: false,
      description: 'Run command in background (default: false)'
    })
  })
  .openapi({
    example: {
      type: 'command',
      command: 'npm test',
      timeout: 30
    }
  })

export type ClaudeHookConfig = z.infer<typeof ClaudeHookConfigSchema>

// Matcher group - contains matcher pattern and array of hooks
export const ClaudeMatcherGroupSchema = z
  .object({
    matcher: z.string().openapi({
      example: 'Edit|Write',
      description: 'Pattern to match tool names (supports regex)'
    }),
    hooks: z.array(ClaudeHookConfigSchema).openapi({
      description: 'Array of hooks to execute for this matcher'
    })
  })
  .openapi({
    example: {
      matcher: 'Edit|Write',
      hooks: [
        {
          type: 'command',
          command: 'echo "File modified"'
        }
      ]
    }
  })

export type ClaudeMatcherGroup = z.infer<typeof ClaudeMatcherGroupSchema>

// Complete Claude Code hooks configuration - matches official format exactly
export const ClaudeHooksSettingsSchema = z
  .object({
    hooks: z.record(HookEventSchema, z.array(ClaudeMatcherGroupSchema)).openapi({
      description: 'Hook configurations organized by event type'
    })
  })
  .openapi({
    example: {
      hooks: {
        PostToolUse: [
          {
            matcher: 'Edit|Write',
            hooks: [
              {
                type: 'command',
                command: 'npm run lint'
              }
            ]
          }
        ]
      }
    }
  })

export type ClaudeHooksSettings = z.infer<typeof ClaudeHooksSettingsSchema>

// Simplified schemas for Promptliano's UI needs
// These help with API requests but don't affect Claude Code format

// Create hook request
export const CreateHookRequestSchema = z
  .object({
    event: HookEventSchema,
    matcher: z.string().min(1).openapi({
      example: 'Edit|Write',
      description: 'Pattern to match tool names'
    }),
    command: z.string().min(1),
    timeout: z.number().optional()
  })
  .openapi({
    example: {
      event: 'PostToolUse',
      matcher: 'Edit',
      command: 'npm test',
      timeout: 30
    }
  })

export type CreateHookRequest = z.infer<typeof CreateHookRequestSchema>

// Update hook request
export const UpdateHookRequestSchema = z
  .object({
    event: HookEventSchema,
    matcherIndex: z.number().int().min(0),
    matcher: z.string().min(1).optional(),
    command: z.string().min(1).optional(),
    timeout: z.number().optional()
  })
  .openapi({
    example: {
      event: 'PostToolUse',
      matcherIndex: 0,
      command: 'npm run test:watch'
    }
  })

export type UpdateHookRequest = z.infer<typeof UpdateHookRequestSchema>

// Delete hook request
export const DeleteHookRequestSchema = z
  .object({
    event: HookEventSchema,
    matcherIndex: z.number().int().min(0)
  })
  .openapi({
    example: {
      event: 'PostToolUse',
      matcherIndex: 0
    }
  })

export type DeleteHookRequest = z.infer<typeof DeleteHookRequestSchema>

// Hook generation request for AI feature
export const HookGenerationRequestSchema = z
  .object({
    description: z.string().min(1).openapi({
      example: 'Run tests after editing source files',
      description: 'Natural language description of what the hook should do'
    }),
    context: z
      .object({
        suggestedEvent: HookEventSchema.optional(),
        examples: z.array(z.string()).optional()
      })
      .optional()
  })
  .openapi('HookGenerationRequest')

export type HookGenerationRequest = z.infer<typeof HookGenerationRequestSchema>

// Hook test request
export const HookTestRequestSchema = z
  .object({
    event: HookEventSchema,
    matcher: z.string(),
    command: z.string(),
    timeout: z.number().optional(),
    sampleToolName: z.string().optional()
  })
  .openapi('HookTestRequest')

export type HookTestRequest = z.infer<typeof HookTestRequestSchema>

// Hook list item for UI display (flattened view)
export const HookListItemSchema = z
  .object({
    event: HookEventSchema,
    matcherIndex: z.number(),
    matcher: z.string(),
    command: z.string(),
    timeout: z.number().optional()
  })
  .openapi('HookListItem')

export type HookListItem = z.infer<typeof HookListItemSchema>

// API Response schemas
export const HookApiResponseSchema = z
  .object({
    success: z.literal(true),
    data: HookListItemSchema
  })
  .openapi('HookResponse')

export const HookListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(HookListItemSchema)
  })
  .openapi('HookListResponse')

export const HookGenerationResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      event: HookEventSchema,
      matcher: z.string(),
      command: z.string(),
      timeout: z.number().optional(),
      description: z.string(),
      security_warnings: z.array(z.string()).optional()
    })
  })
  .openapi('HookGenerationResponse')

export const HookTestResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      message: z.string().openapi({
        example: 'Hook testing is not implemented. Claude Code handles hook execution.'
      })
    })
  })
  .openapi('HookTestResponse')

// Export legacy names for backward compatibility (will be removed)
export const HookConfigSchema = ClaudeHookConfigSchema
export const MatcherGroupSchema = ClaudeMatcherGroupSchema
export const HooksConfigurationSchema = ClaudeHooksSettingsSchema
export type HookConfig = ClaudeHookConfig
export type MatcherGroup = ClaudeMatcherGroup
export type HooksConfiguration = ClaudeHooksSettings

// These are being removed as they don't exist in Claude Code
export type HookConfigurationLevel = 'project' // Only project level in Claude Code
export type HookRegistryEntry = HookListItem // Simplified
export type CreateHookConfigBody = CreateHookRequest
export type UpdateHookConfigBody = UpdateHookRequest

// Additional schemas for compatibility with tests
export const HookConfigurationLevelSchema = z.enum(['user', 'project', 'local'])
export const HookMatcherGroupSchema = ClaudeMatcherGroupSchema
export const HookPayloadSchema = z.object({
  session_id: z.string(),
  transcript_path: z.string(),
  cwd: z.string(),
  hook_event_name: HookEventSchema,
  tool_name: z.string().optional(),
  tool_input: z.record(z.any()).optional(),
  user_prompt: z.string().optional()
})

// Hook execution response (what the test expects as HookResponseSchema)
export const HookExecutionResponseSchema = z.object({
  continue: z.boolean().default(true),
  stopReason: z.string().optional(),
  suppressOutput: z.boolean().default(false)
})

export const HookExecutionResultSchema = z.object({
  hookId: z.string(),
  command: z.string(),
  exitCode: z.number(),
  stdout: z.string().optional(),
  stderr: z.string().optional(),
  duration: z.number(),
  timedOut: z.boolean().optional(),
  runInBackground: z.boolean().optional(),
  timestamp: z.number().optional(),
  success: z.boolean().optional(),
  error: z.string().optional()
})
export const HookRegistryEntrySchema = HookListItemSchema

// Test-compatible schemas
export const CreateHookConfigBodySchema = z.object({
  event: HookEventSchema,
  matcher: z.string().min(1),
  hookConfig: ClaudeHookConfigSchema,
  configLevel: HookConfigurationLevelSchema.default('project')
})

export const UpdateHookConfigBodySchema = z
  .object({
    matcher: z.string().optional(),
    hookConfig: ClaudeHookConfigSchema.partial().optional(),
    enabled: z.boolean().optional()
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update'
  })

export const HookResponseSchema = HookExecutionResponseSchema // Alias for test compatibility
