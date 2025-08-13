import { claudeHookStorageSimple } from '@promptliano/storage'
import {
  type CreateHookRequest,
  type UpdateHookRequest,
  type HookEvent,
  type HookListItem,
  type HookGenerationRequest,
  HookGenerationResponseSchema,
  HookEventSchema,
  CreateHookRequestSchema,
  UpdateHookRequestSchema
} from '@promptliano/schemas'

import { ApiError } from '@promptliano/shared'
import { z } from 'zod'
import { generateStructuredData } from './gen-ai-services'

// Schema for AI-generated hook data
const GeneratedHookConfigSchema = z.object({
  event: HookEventSchema,
  matcher: z.string().describe('Pattern to match tool names (e.g., "Edit|Write" or ".*" for all tools)'),
  command: z.string().describe('Safe shell command to execute'),
  description: z.string().describe('Human-readable description of what this hook does'),
  timeout: z.number().optional().describe('Timeout in seconds (default: 60)'),
  security_warnings: z.array(z.string()).optional().describe('Any security concerns with the generated command')
})

/**
 * Claude Hook Service - Simplified to match Claude Code's format exactly
 * Only manages project-level hooks in .claude/settings.json
 */
class ClaudeHookService {
  /**
   * List all hooks for a project
   */
  async listHooks(projectPath: string): Promise<HookListItem[]> {
    try {
      return await claudeHookStorageSimple.listHooks(projectPath)
    } catch (error) {
      throw new ApiError(
        500,
        `Failed to list hooks: ${error instanceof Error ? error.message : String(error)}`,
        'LIST_HOOKS_FAILED'
      )
    }
  }

  /**
   * Get a specific hook
   */
  async getHook(projectPath: string, event: HookEvent, matcherIndex: number): Promise<HookListItem | null> {
    try {
      return await claudeHookStorageSimple.getHook(projectPath, event, matcherIndex)
    } catch (error) {
      throw new ApiError(
        500,
        `Failed to get hook: ${error instanceof Error ? error.message : String(error)}`,
        'GET_HOOK_FAILED'
      )
    }
  }

  /**
   * Create a new hook
   */
  async createHook(projectPath: string, request: CreateHookRequest): Promise<HookListItem> {
    try {
      // Validate request
      const validated = CreateHookRequestSchema.parse(request)

      return await claudeHookStorageSimple.createHook(
        projectPath,
        validated.event,
        validated.matcher,
        validated.command,
        validated.timeout
      )
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ApiError(400, 'Invalid hook configuration', 'VALIDATION_ERROR', {
          errors: error.errors
        })
      }
      throw new ApiError(
        500,
        `Failed to create hook: ${error instanceof Error ? error.message : String(error)}`,
        'CREATE_HOOK_FAILED'
      )
    }
  }

  /**
   * Update an existing hook
   */
  async updateHook(
    projectPath: string,
    event: HookEvent,
    matcherIndex: number,
    request: Partial<UpdateHookRequest>
  ): Promise<HookListItem | null> {
    try {
      // Validate request
      const validated = UpdateHookRequestSchema.partial().parse(request)

      const result = await claudeHookStorageSimple.updateHook(projectPath, event, matcherIndex, {
        matcher: validated.matcher,
        command: validated.command,
        timeout: validated.timeout
      })

      if (!result) {
        throw new ApiError(404, 'Hook not found', 'HOOK_NOT_FOUND')
      }

      return result
    } catch (error) {
      if (error instanceof ApiError) throw error
      if (error instanceof z.ZodError) {
        throw new ApiError(400, 'Invalid hook configuration', 'VALIDATION_ERROR', {
          errors: error.errors
        })
      }
      throw new ApiError(
        500,
        `Failed to update hook: ${error instanceof Error ? error.message : String(error)}`,
        'UPDATE_HOOK_FAILED'
      )
    }
  }

  /**
   * Delete a hook
   */
  async deleteHook(projectPath: string, event: HookEvent, matcherIndex: number): Promise<boolean> {
    try {
      const deleted = await claudeHookStorageSimple.deleteHook(projectPath, event, matcherIndex)

      if (!deleted) {
        throw new ApiError(404, 'Hook not found', 'HOOK_NOT_FOUND')
      }

      return deleted
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(
        500,
        `Failed to delete hook: ${error instanceof Error ? error.message : String(error)}`,
        'DELETE_HOOK_FAILED'
      )
    }
  }

  /**
   * Search hooks by pattern
   */
  async searchHooks(projectPath: string, query: string): Promise<HookListItem[]> {
    try {
      const allHooks = await this.listHooks(projectPath)

      if (!query) return allHooks

      const lowerQuery = query.toLowerCase()
      return allHooks.filter(
        (hook) =>
          hook.event.toLowerCase().includes(lowerQuery) ||
          hook.matcher.toLowerCase().includes(lowerQuery) ||
          hook.command.toLowerCase().includes(lowerQuery)
      )
    } catch (error) {
      throw new ApiError(
        500,
        `Failed to search hooks: ${error instanceof Error ? error.message : String(error)}`,
        'SEARCH_HOOKS_FAILED'
      )
    }
  }

  /**
   * Generate hook configuration from natural language description
   */
  async generateHookFromDescription(
    description: string,
    context?: {
      projectPath?: string
      suggestedEvent?: HookEvent
      examples?: string[]
    }
  ): Promise<z.infer<typeof HookGenerationResponseSchema>['data']> {
    try {
      const systemPrompt = `You are a Claude Code hook configuration generator. Generate safe, useful hook configurations based on user descriptions.

IMPORTANT SECURITY RULES:
- NEVER generate commands that could delete files or directories
- NEVER generate commands that could expose sensitive information
- NEVER generate commands that could modify system files
- ALWAYS validate user input and sanitize file paths
- PREFER read-only operations where possible

Available hook events:
- PreToolUse: Runs before a tool is executed
- PostToolUse: Runs after a tool completes
- UserPromptSubmit: Runs when user submits a prompt
- Notification: Runs on notifications
- Stop: Runs when stopping
- SubagentStop: Runs when subagent stops
- SessionStart: Runs at session start
- PreCompact: Runs before context compaction

Common tool names for matchers:
- Edit, Write, Read, MultiEdit (file operations)
- Bash (shell commands)
- WebFetch (web requests)
- Task (subagent tasks)

Environment variables available:
- $CLAUDE_PROJECT_DIR: Absolute path to project root
- $TOOL_NAME: Name of the tool being executed
- $TOOL_INPUT: JSON input to the tool (parse with jq)

${context?.examples ? `Examples:\n${context.examples.join('\n')}` : ''}`

      const userPrompt = `Generate a hook configuration for: "${description}"
      ${context?.suggestedEvent ? `Suggested event: ${context.suggestedEvent}` : ''}
      
Return a safe, practical hook configuration.`

      const result = await generateStructuredData({
        prompt: userPrompt,
        systemMessage: systemPrompt,
        schema: GeneratedHookConfigSchema,
        options: { provider: 'openai' }
      })

      return {
        event: result.object.event,
        matcher: result.object.matcher,
        command: result.object.command,
        timeout: result.object.timeout,
        description: result.object.description,
        security_warnings: result.object.security_warnings
      }
    } catch (error) {
      throw new ApiError(
        500,
        `Failed to generate hook: ${error instanceof Error ? error.message : String(error)}`,
        'GENERATE_HOOK_FAILED'
      )
    }
  }

  /**
   * Test hook - Note: Claude Code handles actual execution
   */
  async testHook(
    projectPath: string,
    event: HookEvent,
    matcher: string,
    command: string,
    timeout?: number,
    sampleToolName?: string
  ): Promise<{ message: string }> {
    // Claude Code handles hook execution, we just return a message
    return {
      message: 'Hook testing is not implemented. Claude Code handles hook execution directly.'
    }
  }

  /**
   * Check if Claude Code is installed in the project
   */
  async isClaudeCodeInstalled(projectPath: string): Promise<boolean> {
    try {
      return await claudeHookStorageSimple.isClaudeCodeInstalled(projectPath)
    } catch {
      return false
    }
  }
}

// Export singleton instance
export const claudeHookService = new ClaudeHookService()
