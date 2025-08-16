import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { ClaudeHookStorage } from './claude-hook-storage'
import type { HooksConfiguration, HookConfig } from '@promptliano/schemas'

describe('ClaudeHookStorage', () => {
  let storage: ClaudeHookStorage
  let tempDir: string
  let projectPath: string

  beforeEach(async () => {
    storage = new ClaudeHookStorage()
    // Create temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-hook-test-'))
    projectPath = path.join(tempDir, 'test-project')
    await fs.mkdir(projectPath, { recursive: true })
  })

  afterEach(async () => {
    // Clean up temporary directory
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })

  test('should get correct file paths', () => {
    const userPath = storage.getUserHooksPath()
    const projectPath = storage.getProjectHooksPath('/test/project')
    const localPath = storage.getLocalHooksPath('/test/project')

    expect(userPath).toContain('.claude')
    expect(userPath).toContain('settings.json')
    expect(projectPath).toContain('.claude')
    expect(projectPath).toContain('settings.json')
    expect(localPath).toContain('settings.local.json')
  })

  test('should read empty hooks configuration when files do not exist', async () => {
    const hooks = await storage.readHooks('project', projectPath)
    expect(hooks).toEqual({ hooks: {} })
  })

  test('should write and read hooks configuration', async () => {
    const hooksConfig: HooksConfiguration = {
      hooks: {
        PreToolUse: [
          {
            matcher: 'Edit|Write',
            hooks: [
              {
                type: 'command',
                command: 'git add .',
                timeout: 30,
                run_in_background: false
              }
            ]
          }
        ]
      }
    }

    await storage.writeHooks('project', hooksConfig, projectPath)
    const readHooks = await storage.readHooks('project', projectPath)

    expect(readHooks).toEqual(hooksConfig)
  })

  test('should merge hooks from different levels', async () => {
    // Mock reading from different levels by creating test files
    const projectHooksConfig: HooksConfiguration = {
      hooks: {
        PreToolUse: [
          {
            matcher: 'Edit',
            hooks: [
              {
                type: 'command',
                command: 'project-command',
                timeout: 30,
                run_in_background: false
              }
            ]
          }
        ]
      }
    }

    const localHooksConfig: HooksConfiguration = {
      hooks: {
        PostToolUse: [
          {
            matcher: 'Write',
            hooks: [
              {
                type: 'command',
                command: 'local-command',
                timeout: 60,
                run_in_background: true
              }
            ]
          }
        ]
      }
    }

    await storage.writeHooks('project', projectHooksConfig, projectPath)
    await storage.writeHooks('local', localHooksConfig, projectPath)

    const allHooks = await storage.getAllHooks(projectPath)

    expect(Object.keys(allHooks.merged.hooks)).toContain('PreToolUse')
    expect(Object.keys(allHooks.merged.hooks)).toContain('PostToolUse')
    expect(allHooks.levels.project).toEqual(projectHooksConfig)
    expect(allHooks.levels.local).toEqual(localHooksConfig)
  })

  test('should add a new hook', async () => {
    const hookConfig: HookConfig = {
      type: 'command',
      command: 'npm test',
      timeout: 120,
      run_in_background: false
    }

    await storage.addHook('project', 'PreToolUse', 'Edit|Write', hookConfig, projectPath)

    const hooks = await storage.readHooks('project', projectPath)
    expect(hooks.hooks.PreToolUse).toBeDefined()
    expect(hooks.hooks.PreToolUse).toHaveLength(1)
    expect(hooks.hooks.PreToolUse?.[0]?.matcher).toBe('Edit|Write')
    expect(hooks.hooks.PreToolUse?.[0]?.hooks?.[0]).toEqual(hookConfig)
  })

  test('should delete a hook', async () => {
    // First add a hook
    const hookConfig: HookConfig = {
      type: 'command',
      command: 'npm test',
      timeout: 120,
      run_in_background: false
    }

    await storage.addHook('project', 'PreToolUse', 'Edit|Write', hookConfig, projectPath)

    // Verify it exists
    let hooks = await storage.readHooks('project', projectPath)
    expect(hooks.hooks.PreToolUse).toHaveLength(1)

    // Delete it
    await storage.deleteHook('project', 'PreToolUse', 0, projectPath)

    // Verify it's gone
    hooks = await storage.readHooks('project', projectPath)
    expect(hooks.hooks.PreToolUse).toBeUndefined()
  })

  test('should update a hook', async () => {
    // First add a hook
    const originalHookConfig: HookConfig = {
      type: 'command',
      command: 'npm test',
      timeout: 120,
      run_in_background: false
    }

    await storage.addHook('project', 'PreToolUse', 'Edit|Write', originalHookConfig, projectPath)

    // Update it
    const updatedHookConfig: HookConfig = {
      type: 'command',
      command: 'npm run test:updated',
      timeout: 60,
      run_in_background: true
    }

    await storage.updateHook('project', 'PreToolUse', 0, { hookConfig: updatedHookConfig }, projectPath)

    // Verify the update
    const hooks = await storage.readHooks('project', projectPath)
    expect(hooks.hooks.PreToolUse?.[0]?.hooks?.[0]).toEqual(updatedHookConfig)
  })

  test('should check if hooks exist', async () => {
    // Initially no hooks
    let hasHooks = await storage.hasHooks(projectPath)
    expect(hasHooks.any).toBe(false)
    expect(hasHooks.project).toBe(false)
    expect(hasHooks.local).toBe(false)

    // Add a project hook
    await storage.addHook(
      'project',
      'PreToolUse',
      'Edit',
      {
        type: 'command',
        command: 'test',
        timeout: 30,
        run_in_background: false
      },
      projectPath
    )

    hasHooks = await storage.hasHooks(projectPath)
    expect(hasHooks.any).toBe(true)
    expect(hasHooks.project).toBe(true)
    expect(hasHooks.local).toBe(false)
  })

  test('should handle invalid hook configuration', async () => {
    expect(async () => {
      await storage.addHook(
        'project',
        'InvalidEvent' as any,
        'Edit',
        {
          type: 'command',
          command: 'test',
          timeout: 30,
          run_in_background: false
        },
        projectPath
      )
    }).toThrow()
  })

  test('should preserve other settings when writing hooks', async () => {
    // Create a settings file with other properties
    const settingsPath = storage.getProjectHooksPath(projectPath)
    await fs.mkdir(path.dirname(settingsPath), { recursive: true })
    await fs.writeFile(
      settingsPath,
      JSON.stringify(
        {
          otherSetting: 'value',
          anotherSetting: { nested: true }
        },
        null,
        2
      )
    )

    // Write hooks
    const hooksConfig: HooksConfiguration = {
      hooks: {
        PreToolUse: [
          {
            matcher: 'Edit',
            hooks: [
              {
                type: 'command',
                command: 'test',
                timeout: 30,
                run_in_background: false
              }
            ]
          }
        ]
      }
    }

    await storage.writeHooks('project', hooksConfig, projectPath)

    // Read the file and verify other settings are preserved
    const content = await fs.readFile(settingsPath, 'utf-8')
    const parsed = JSON.parse(content)

    expect(parsed.otherSetting).toBe('value')
    expect(parsed.anotherSetting.nested).toBe(true)
    expect(parsed.hooks).toEqual(hooksConfig)
  })
})
