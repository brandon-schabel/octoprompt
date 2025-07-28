import { z } from 'zod'

/**
 * MCP editor configuration schema
 */
export const McpEditorSchema = z.object({
  name: z.string(),
  icon: z.string().url(),
  displayName: z.string(),
  description: z.string(),
  setupUrl: z.string().url(),
  docsUrl: z.string().url().optional(),
  version: z.string().optional(),
  supported: z.boolean().default(true)
})

/**
 * MCP setup step schema
 */
export const McpSetupStepSchema = z.object({
  step: z.number().min(1),
  title: z.string(),
  description: z.string(),
  codeExample: z
    .object({
      language: z.enum(['bash', 'json', 'javascript', 'typescript', 'yaml']),
      code: z.string(),
      filename: z.string().optional()
    })
    .optional(),
  screenshot: z.string().url().optional(),
  notes: z.array(z.string()).optional()
})

/**
 * MCP tool schema
 */
export const McpToolSchema = z.object({
  name: z.string(),
  description: z.string(),
  category: z.enum(['project', 'file', 'ticket', 'git', 'ai', 'utility']),
  parameters: z.array(
    z.object({
      name: z.string(),
      type: z.string(),
      required: z.boolean(),
      description: z.string()
    })
  ),
  examples: z
    .array(
      z.object({
        title: z.string(),
        code: z.string()
      })
    )
    .optional()
})

/**
 * MCP integration data schema
 */
export const McpIntegrationSchema = z.object({
  overview: z.object({
    title: z.string(),
    description: z.string(),
    benefits: z.array(z.string())
  }),
  supportedEditors: z.array(McpEditorSchema),
  setupSteps: z.record(z.string(), z.array(McpSetupStepSchema)),
  tools: z.array(McpToolSchema),
  compatibility: z.object({
    minimumNodeVersion: z.string(),
    supportedPlatforms: z.array(z.enum(['windows', 'macos', 'linux'])),
    requiredDependencies: z.array(z.string())
  })
})

// Type exports
export type McpEditor = z.infer<typeof McpEditorSchema>
export type McpSetupStep = z.infer<typeof McpSetupStepSchema>
export type McpTool = z.infer<typeof McpToolSchema>
export type McpIntegration = z.infer<typeof McpIntegrationSchema>
