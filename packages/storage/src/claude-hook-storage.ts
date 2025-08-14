import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { existsSync } from 'fs'
import { z } from 'zod'
import {
  HooksConfigurationSchema,
  HookEventSchema,
  MatcherGroupSchema,
  HookConfigSchema,
  HookConfigurationLevelSchema,
  type HooksConfiguration,
  type HookConfig,
  type HookEvent
} from '@promptliano/schemas'
import { ApiError } from '@promptliano/shared'
import { ensureString } from '@promptliano/shared/src/utils/sqlite-converters'

// Storage schema for settings.json files
// Claude Code format: { "hooks": { "EventName": [...] } }
const SettingsSchema = z
  .object({
    hooks: z.record(HookEventSchema, z.array(MatcherGroupSchema)).optional()
  })
  .passthrough() // Allow other settings to pass through

export type ConfigLevel = z.infer<typeof HookConfigurationLevelSchema>

interface HookWithMetadata {
  config: HookConfig
  level: ConfigLevel
  filePath: string
  eventName: HookEvent
  matcher: string
  matcherIndex: number
}

export class ClaudeHookStorage {
  private readonly platform = process.platform

  /**
   * Get Claude configuration directory based on platform
   */
  private getClaudeConfigDir(): string {
    const home = os.homedir()

    switch (this.platform) {
      case 'darwin':
        return path.join(home, '.claude')
      case 'linux':
        // Check new location first, fall back to legacy
        const newPath = path.join(home, '.config', 'claude')
        const legacyPath = path.join(home, '.claude')
        return existsSync(newPath) ? newPath : legacyPath
      case 'win32':
        return path.join(process.env.APPDATA || home, 'Claude')
      default:
        return path.join(home, '.claude')
    }
  }

  /**
   * Get user-level hooks configuration path
   */
  getUserHooksPath(): string {
    return path.join(this.getClaudeConfigDir(), 'settings.json')
  }

  /**
   * Get project-level hooks configuration path
   */
  getProjectHooksPath(projectPath: string): string {
    return path.join(projectPath, '.claude', 'settings.json')
  }

  /**
   * Get local override hooks configuration path
   */
  getLocalHooksPath(projectPath: string): string {
    return path.join(projectPath, '.claude', 'settings.local.json')
  }

  /**
   * Safely read and parse a settings file
   */
  private async readSettingsFile(filePath: string): Promise<any> {
    try {
      await fs.access(filePath)
      const content = ensureString(await fs.readFile(filePath, 'utf-8'))

      if (!content.trim()) {
        return {}
      }

      const parsed = JSON.parse(content)
      const validated = SettingsSchema.safeParse(parsed)

      if (validated.success) {
        return validated.data
      } else {
        console.warn(`Invalid settings format in ${filePath}:`, validated.error)
        return {}
      }
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        // File doesn't exist, return empty config
        return {}
      }
      console.error(`Error reading settings file ${filePath}:`, error)
      throw new ApiError(500, `Failed to read hooks configuration from ${filePath}`)
    }
  }

  /**
   * Safely write settings to a file
   */
  private async writeSettingsFile(filePath: string, settings: any): Promise<void> {
    try {
      // Ensure directory exists
      const dir = path.dirname(filePath)
      await fs.mkdir(dir, { recursive: true })

      // Write with proper formatting
      const content = JSON.stringify(settings, null, 2)
      await fs.writeFile(filePath, content, 'utf-8')

      // Settings written successfully
    } catch (error) {
      console.error(`Error writing settings file ${filePath}:`, error)
      throw new ApiError(500, `Failed to write hooks configuration to ${filePath}`)
    }
  }

  /**
   * Read hooks from a specific configuration level
   */
  async readHooks(level: ConfigLevel, projectPath?: string): Promise<HooksConfiguration> {
    let filePath: string

    switch (level) {
      case 'user':
        filePath = this.getUserHooksPath()
        break
      case 'project':
        if (!projectPath) {
          throw new ApiError(400, 'Project path is required for project-level hooks')
        }
        filePath = this.getProjectHooksPath(projectPath)
        break
      case 'local':
        if (!projectPath) {
          throw new ApiError(400, 'Project path is required for local-level hooks')
        }
        filePath = this.getLocalHooksPath(projectPath)
        break
      default:
        throw new ApiError(400, `Invalid configuration level: ${level}`)
    }

    const settings = await this.readSettingsFile(filePath)
    // Return the hooks directly from settings, or empty hooks object
    return { hooks: settings.hooks || {} }
  }

  /**
   * Write hooks to a specific configuration level
   */
  async writeHooks(level: ConfigLevel, hooks: HooksConfiguration, projectPath?: string): Promise<void> {
    let filePath: string

    switch (level) {
      case 'user':
        filePath = this.getUserHooksPath()
        break
      case 'project':
        if (!projectPath) {
          throw new ApiError(400, 'Project path is required for project-level hooks')
        }
        filePath = this.getProjectHooksPath(projectPath)
        break
      case 'local':
        if (!projectPath) {
          throw new ApiError(400, 'Project path is required for local-level hooks')
        }
        filePath = this.getLocalHooksPath(projectPath)
        break
      default:
        throw new ApiError(400, `Invalid configuration level: ${level}`)
    }

    // Read existing settings to preserve other configurations
    const existingSettings = await this.readSettingsFile(filePath)

    // Update hooks while preserving other settings
    const updatedSettings = {
      ...existingSettings,
      hooks
    }

    // Validate the hooks configuration
    const validated = HooksConfigurationSchema.safeParse(hooks)
    if (!validated.success) {
      console.error('Invalid hooks configuration:', validated.error)
      throw new ApiError(400, 'Invalid hooks configuration format')
    }

    await this.writeSettingsFile(filePath, updatedSettings)
  }

  /**
   * Get merged hooks from all levels with metadata about their source
   */
  async getAllHooks(projectPath: string): Promise<{
    merged: HooksConfiguration
    levels: {
      user: HooksConfiguration
      project: HooksConfiguration
      local: HooksConfiguration
    }
  }> {
    const [userHooks, projectHooks, localHooks] = await Promise.all([
      this.readHooks('user'),
      this.readHooks('project', projectPath),
      this.readHooks('local', projectPath)
    ])

    // Merge hooks with local overriding project overriding user
    const merged: HooksConfiguration = { hooks: {} }

    // Start with user-level hooks
    for (const [eventName, matchers] of Object.entries(userHooks.hooks || {})) {
      merged.hooks[eventName as HookEvent] = [...matchers]
    }

    // Add/override with project-level hooks
    for (const [eventName, matchers] of Object.entries(projectHooks.hooks || {})) {
      merged.hooks[eventName as HookEvent] = [...(merged.hooks[eventName as HookEvent] || []), ...matchers]
    }

    // Add/override with local-level hooks
    for (const [eventName, matchers] of Object.entries(localHooks.hooks || {})) {
      merged.hooks[eventName as HookEvent] = [...(merged.hooks[eventName as HookEvent] || []), ...matchers]
    }

    return {
      merged,
      levels: {
        user: userHooks,
        project: projectHooks,
        local: localHooks
      }
    }
  }

  /**
   * Delete a specific hook by event name and matcher index
   */
  async deleteHook(
    level: ConfigLevel,
    eventName: HookEvent,
    matcherIndex: number,
    projectPath?: string
  ): Promise<void> {
    const hooks = await this.readHooks(level, projectPath)

    const matchers = hooks.hooks[eventName]
    if (!matchers || matcherIndex < 0 || matcherIndex >= matchers.length) {
      throw new ApiError(404, `Hook not found at ${level} level for event ${eventName} at index ${matcherIndex}`)
    }

    // Remove the matcher at the specified index
    matchers.splice(matcherIndex, 1)

    // If no matchers left for this event, remove the event
    if (matchers.length === 0) {
      delete hooks.hooks[eventName]
    }

    await this.writeHooks(level, hooks, projectPath)

    // Hook deleted successfully
  }

  /**
   * Update a specific hook by event name and matcher index
   */
  async updateHook(
    level: ConfigLevel,
    eventName: HookEvent,
    matcherIndex: number,
    hookData: { matcher?: string; hookConfig?: HookConfig },
    projectPath?: string
  ): Promise<void> {
    const hooks = await this.readHooks(level, projectPath)

    const matchers = hooks.hooks[eventName]
    if (!matchers || matcherIndex < 0 || matcherIndex >= matchers.length) {
      throw new ApiError(404, `Hook not found at ${level} level for event ${eventName} at index ${matcherIndex}`)
    }

    const matcherGroup = matchers[matcherIndex]
    if (!matcherGroup) {
      throw new ApiError(404, 'Matcher group not found')
    }

    // Update matcher pattern if provided
    if (hookData.matcher !== undefined) {
      matcherGroup.matcher = hookData.matcher
    }

    // Update hook config if provided
    if (hookData.hookConfig !== undefined) {
      // Validate the hook config
      const validated = HookConfigSchema.safeParse(hookData.hookConfig)
      if (!validated.success) {
        throw new ApiError(400, 'Invalid hook configuration format')
      }

      // For simplicity, assume single hook per matcher group
      // In a more complex implementation, you might need to specify which hook in the group
      if (matcherGroup.hooks && matcherGroup.hooks.length > 0) {
        matcherGroup.hooks[0] = validated.data
      } else {
        matcherGroup.hooks = [validated.data]
      }
    }

    await this.writeHooks(level, hooks, projectPath)

    // Hook updated successfully
  }

  /**
   * Add a new hook to a specific configuration level
   */
  async addHook(
    level: ConfigLevel,
    eventName: HookEvent,
    matcher: string,
    hookConfig: HookConfig,
    projectPath?: string
  ): Promise<void> {
    // Validate inputs
    const eventValidation = HookEventSchema.safeParse(eventName)
    if (!eventValidation.success) {
      throw new ApiError(400, `Invalid event name: ${eventName}`)
    }

    const hookValidation = HookConfigSchema.safeParse(hookConfig)
    if (!hookValidation.success) {
      throw new ApiError(400, 'Invalid hook configuration format')
    }

    const hooks = await this.readHooks(level, projectPath)

    // Initialize event hooks array if it doesn't exist
    if (!hooks.hooks[eventName]) {
      hooks.hooks[eventName] = []
    }

    // Add the new matcher group
    hooks.hooks[eventName].push({
      matcher,
      hooks: [hookConfig]
    })

    await this.writeHooks(level, hooks, projectPath)

    // Hook added successfully
  }

  /**
   * Check if hooks exist at any level for a project
   */
  async hasHooks(projectPath: string): Promise<{
    user: boolean
    project: boolean
    local: boolean
    any: boolean
  }> {
    const [userHooks, projectHooks, localHooks] = await Promise.all([
      this.readHooks('user').catch(() => ({ hooks: {} })),
      this.readHooks('project', projectPath).catch(() => ({ hooks: {} })),
      this.readHooks('local', projectPath).catch(() => ({ hooks: {} }))
    ])

    const hasUserHooks = Object.keys(userHooks.hooks || {}).length > 0
    const hasProjectHooks = Object.keys(projectHooks.hooks || {}).length > 0
    const hasLocalHooks = Object.keys(localHooks.hooks || {}).length > 0

    return {
      user: hasUserHooks,
      project: hasProjectHooks,
      local: hasLocalHooks,
      any: hasUserHooks || hasProjectHooks || hasLocalHooks
    }
  }

  /**
   * Get all hooks with their metadata flattened for easier processing
   */
  async getAllHooksFlattened(projectPath: string): Promise<HookWithMetadata[]> {
    const { levels } = await this.getAllHooks(projectPath)
    const flattened: HookWithMetadata[] = []

    // Process each level
    for (const [levelName, config] of Object.entries(levels) as [ConfigLevel, HooksConfiguration][]) {
      let filePath: string

      switch (levelName) {
        case 'user':
          filePath = this.getUserHooksPath()
          break
        case 'project':
          filePath = this.getProjectHooksPath(projectPath)
          break
        case 'local':
          filePath = this.getLocalHooksPath(projectPath)
          break
        default:
          continue
      }

      // Process each event in this level
      for (const [eventName, matchers] of Object.entries(config.hooks || {})) {
        matchers.forEach((matcherGroup, matcherIndex) => {
          matcherGroup.hooks.forEach((hookConfig) => {
            flattened.push({
              config: hookConfig,
              level: levelName,
              filePath,
              eventName: eventName as HookEvent,
              matcher: matcherGroup.matcher,
              matcherIndex
            })
          })
        })
      }
    }

    return flattened
  }
}

// Create singleton instance
export const claudeHookStorage = new ClaudeHookStorage()

// Export factory function for consistency
export function createClaudeHookStorage(): ClaudeHookStorage {
  return claudeHookStorage
}
