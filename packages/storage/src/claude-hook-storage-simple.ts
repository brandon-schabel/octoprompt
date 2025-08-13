import * as fs from 'fs/promises'
import * as path from 'path'
import { z } from 'zod'
import {
  HookEventSchema,
  ClaudeMatcherGroupSchema,
  ClaudeHooksSettingsSchema,
  type ClaudeHooksSettings,
  type HookEvent,
  type HookListItem
} from '@promptliano/schemas'
import { ApiError } from '@promptliano/shared'
import { ensureString, ensureNumber } from '@promptliano/shared/src/utils/sqlite-converters'

/**
 * Simplified Claude Hook Storage that matches Claude Code's exact format
 * Only handles project-level .claude/settings.json files
 */
export class ClaudeHookStorageSimple {
  /**
   * Get the path to the project's Claude settings file
   */
  private getSettingsPath(projectPath: string): string {
    return path.join(projectPath, '.claude', 'settings.json')
  }

  /**
   * Read the Claude settings file
   */
  async readSettings(projectPath: string): Promise<ClaudeHooksSettings> {
    const filePath = this.getSettingsPath(projectPath)

    try {
      await fs.access(filePath)
  const content = ensureString(await fs.readFile(filePath, 'utf-8'))

      if (!content.trim()) {
        return { hooks: {} }
      }

      const parsed = JSON.parse(content)
      const validated = ClaudeHooksSettingsSchema.safeParse(parsed)

      if (validated.success) {
        return validated.data
      } else {
        console.warn(`Invalid settings format in ${filePath}:`, validated.error)
        // Return empty hooks if invalid
        return { hooks: {} }
      }
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        // File doesn't exist, return empty settings
        return { hooks: {} }
      }
      throw new ApiError(500, `Failed to read Claude settings: ${error}`)
    }
  }

  /**
   * Write the Claude settings file
   */
  async writeSettings(projectPath: string, settings: ClaudeHooksSettings): Promise<void> {
    const filePath = this.getSettingsPath(projectPath)

    try {
      // Ensure .claude directory exists
      const dir = path.dirname(filePath)
      await fs.mkdir(dir, { recursive: true })

      // Validate before writing
      const validated = ClaudeHooksSettingsSchema.safeParse(settings)
      if (!validated.success) {
        throw new ApiError(400, 'Invalid hooks configuration format')
      }

      // Write with proper formatting
      const content = JSON.stringify(settings, null, 2)
      await fs.writeFile(filePath, content, 'utf-8')
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(500, `Failed to write Claude settings: ${error}`)
    }
  }

  /**
   * List all hooks as a flat array for UI display
   */
  async listHooks(projectPath: string): Promise<HookListItem[]> {
    const settings = await this.readSettings(projectPath)
    const items: HookListItem[] = []

    for (const [eventName, matchers] of Object.entries(settings.hooks)) {
      matchers.forEach((matcherGroup, matcherIndex) => {
        // For simplicity, we'll only show the first hook in each matcher group
        const firstHook = matcherGroup.hooks[0]
        if (firstHook) {
          items.push({
            event: eventName as HookEvent,
            matcherIndex,
            matcher: matcherGroup.matcher,
            command: firstHook.command,
            timeout: firstHook.timeout
          })
        }
      })
    }

    return items
  }

  /**
   * Get a specific hook
   */
  async getHook(projectPath: string, event: HookEvent, matcherIndex: number): Promise<HookListItem | null> {
    const settings = await this.readSettings(projectPath)
    const matchers = settings.hooks[event]

    if (!matchers || matcherIndex >= matchers.length) {
      return null
    }

    const matcherGroup = matchers[matcherIndex]
    if (!matcherGroup) {
      return null
    }

    const firstHook = matcherGroup.hooks[0]

    if (!firstHook) {
      return null
    }

    return {
      event,
      matcherIndex,
      matcher: matcherGroup.matcher,
      command: firstHook.command,
      timeout: firstHook.timeout
    }
  }

  /**
   * Create a new hook
   */
  async createHook(
    projectPath: string,
    event: HookEvent,
    matcher: string,
    command: string,
    timeout?: number
  ): Promise<HookListItem> {
    const settings = await this.readSettings(projectPath)

    // Initialize event array if it doesn't exist
    if (!settings.hooks[event]) {
      settings.hooks[event] = []
    }

    // Add new matcher group
    const newMatcher = {
      matcher,
      hooks: [
        {
          type: 'command' as const,
          command,
          run_in_background: false,
          timeout: timeout ?? 60
        }
      ]
    }

    settings.hooks[event].push(newMatcher)
    await this.writeSettings(projectPath, settings)

    return {
      event,
      matcherIndex: settings.hooks[event].length - 1,
      matcher,
      command,
      timeout
    }
  }

  /**
   * Update an existing hook
   */
  async updateHook(
    projectPath: string,
    event: HookEvent,
    matcherIndex: number,
    updates: {
      matcher?: string
      command?: string
      timeout?: number
    }
  ): Promise<HookListItem | null> {
    const settings = await this.readSettings(projectPath)
    const matchers = settings.hooks[event]

    if (!matchers || matcherIndex >= matchers.length) {
      return null
    }

    const matcherGroup = matchers[matcherIndex]
    if (!matcherGroup) {
      return null
    }

    const firstHook = matcherGroup.hooks[0]

    if (!firstHook) {
      return null
    }

    // Update matcher if provided
    if (updates.matcher !== undefined) {
      matcherGroup.matcher = updates.matcher
    }

    // Update hook command and timeout
    if (updates.command !== undefined) {
      firstHook.command = updates.command
    }

    if (updates.timeout !== undefined) {
  firstHook.timeout = ensureNumber(updates.timeout, 60)
    } else if (updates.timeout === null) {
  firstHook.timeout = 60 // Use default timeout
    }

    await this.writeSettings(projectPath, settings)

    return {
      event,
      matcherIndex,
      matcher: matcherGroup.matcher,
      command: firstHook.command,
      timeout: firstHook.timeout
    }
  }

  /**
   * Delete a hook
   */
  async deleteHook(projectPath: string, event: HookEvent, matcherIndex: number): Promise<boolean> {
    const settings = await this.readSettings(projectPath)
    const matchers = settings.hooks[event]

    if (!matchers || matcherIndex >= matchers.length) {
      return false
    }

    // Remove the matcher at the specified index
    matchers.splice(matcherIndex, 1)

    // If no matchers left for this event, remove the event key
    if (matchers.length === 0) {
      delete settings.hooks[event]
    }

    await this.writeSettings(projectPath, settings)
    return true
  }

  /**
   * Check if Claude Code is installed by checking for .claude directory
   */
  async isClaudeCodeInstalled(projectPath: string): Promise<boolean> {
    try {
      const claudeDir = path.join(projectPath, '.claude')
      await fs.access(claudeDir)
      return true
    } catch {
      return false
    }
  }
}

// Export singleton instance
export const claudeHookStorageSimple = new ClaudeHookStorageSimple()
