import { z } from '@hono/zod-openapi'
import { validateDataField, createTrackedHandler, type MCPToolDefinition, type MCPToolResponse } from '../shared'
import { optimizeUserInput, getCompactProjectSummary, getProjectSummaryWithOptions } from '@promptliano/services'
import { SummaryOptionsSchema } from '@promptliano/schemas'

export enum AIAssistantAction {
  OPTIMIZE_PROMPT = 'optimize_prompt',
  GET_COMPACT_SUMMARY = 'get_compact_summary',
  GET_COMPACT_SUMMARY_WITH_OPTIONS = 'get_compact_summary_with_options'
}

const AIAssistantSchema = z.object({
  action: z.enum([
    AIAssistantAction.OPTIMIZE_PROMPT,
    AIAssistantAction.GET_COMPACT_SUMMARY,
    AIAssistantAction.GET_COMPACT_SUMMARY_WITH_OPTIONS
  ]),
  projectId: z.number(),
  data: z.any().optional()
})

export const aiAssistantTool: MCPToolDefinition = {
  name: 'ai_assistant',
  description:
    'AI-powered utilities for prompt optimization and project insights. Actions: optimize_prompt, get_compact_summary, get_compact_summary_with_options (supports depth/format/strategy options)',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'The action to perform',
        enum: Object.values(AIAssistantAction)
      },
      projectId: {
        type: 'number',
        description: 'The project ID (required for all actions). Example: 1754111018844'
      },
      data: {
        type: 'object',
        description:
          'Action-specific data. For optimize_prompt: { prompt: "help me fix the authentication" }. For get_compact_summary_with_options: { depth: "minimal" | "standard" | "detailed", format: "xml" | "json" | "markdown", strategy: "fast" | "balanced" | "thorough", includeMetrics: true }'
      }
    },
    required: ['action', 'projectId']
  },
  handler: createTrackedHandler(
    'ai_assistant',
    async (args: z.infer<typeof AIAssistantSchema>): Promise<MCPToolResponse> => {
      try {
        const { action, projectId, data } = args
        switch (action) {
          case AIAssistantAction.OPTIMIZE_PROMPT: {
            const prompt = validateDataField<string>(data, 'prompt', 'string', '"help me fix the authentication flow"')
            const optimizedPrompt = await optimizeUserInput(projectId, prompt)
            return {
              content: [{ type: 'text', text: optimizedPrompt }]
            }
          }
          case AIAssistantAction.GET_COMPACT_SUMMARY: {
            const summary = await getCompactProjectSummary(projectId)
            return {
              content: [{ type: 'text', text: summary }]
            }
          }
          case AIAssistantAction.GET_COMPACT_SUMMARY_WITH_OPTIONS: {
            // Parse and validate options, setting defaults for compact summary
            const options = SummaryOptionsSchema.parse({
              ...data,
              strategy: data?.strategy || 'balanced' // Default to balanced for AI summaries
            })
            const result = await getProjectSummaryWithOptions(projectId, options)
            // Format response based on whether metrics were requested
            if (options.includeMetrics && result.metrics) {
              const metricsText = `
Compact Summary Metrics:
- Generation Time: ${result.metrics.generationTime}ms
- Files Processed: ${result.metrics.filesProcessed}
- Compression Ratio: ${(result.metrics.compressionRatio * 100).toFixed(1)}%
- Tokens Saved: ~${result.metrics.tokensSaved}
Summary:
${result.summary}`
              return {
                content: [{ type: 'text', text: metricsText }]
              }
            }
            return {
              content: [{ type: 'text', text: result.summary }]
            }
          }
          default:
            throw new Error(`Unknown action: ${action}`)
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        }
      }
    }
  )
}
