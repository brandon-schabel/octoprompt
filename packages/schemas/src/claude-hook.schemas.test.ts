import { describe, test, expect } from 'bun:test'
import {
  HookEventSchema,
  HookConfigurationLevelSchema,
  HookConfigSchema,
  HookMatcherGroupSchema,
  HooksConfigurationSchema,
  HookPayloadSchema,
  HookResponseSchema,
  HookExecutionResultSchema,
  HookRegistryEntrySchema,
  CreateHookConfigBodySchema,
  UpdateHookConfigBodySchema
} from './claude-hook.schemas'

describe('Claude Hook Schemas', () => {
  describe('HookEventSchema', () => {
    test('should validate all supported hook events', () => {
      const events = [
        'PreToolUse',
        'PostToolUse',
        'UserPromptSubmit',
        'Notification',
        'Stop',
        'SubagentStop',
        'SessionStart',
        'PreCompact'
      ]

      events.forEach((event) => {
        expect(() => HookEventSchema.parse(event)).not.toThrow()
      })
    })

    test('should reject invalid hook events', () => {
      expect(() => HookEventSchema.parse('InvalidEvent')).toThrow()
      expect(() => HookEventSchema.parse('')).toThrow()
      expect(() => HookEventSchema.parse(null)).toThrow()
    })
  })

  describe('HookConfigurationLevelSchema', () => {
    test('should validate configuration levels', () => {
      const levels = ['user', 'project', 'local']
      levels.forEach((level) => {
        expect(() => HookConfigurationLevelSchema.parse(level)).not.toThrow()
      })
    })

    test('should reject invalid configuration levels', () => {
      expect(() => HookConfigurationLevelSchema.parse('global')).toThrow()
      expect(() => HookConfigurationLevelSchema.parse('')).toThrow()
    })
  })

  describe('HookConfigSchema', () => {
    test('should validate basic hook config', () => {
      const config = {
        type: 'command',
        command: 'npm run test'
      }

      const result = HookConfigSchema.parse(config)
      expect(result.type).toBe('command')
      expect(result.command).toBe('npm run test')
      expect(result.timeout).toBe(60) // default
      expect(result.run_in_background).toBe(false) // default
    })

    test('should validate hook config with all fields', () => {
      const config = {
        type: 'command' as const,
        command: 'git add .',
        timeout: 30,
        run_in_background: true
      }

      const result = HookConfigSchema.parse(config)
      expect(result).toEqual(config)
    })

    test('should reject invalid hook config', () => {
      expect(() =>
        HookConfigSchema.parse({
          type: 'invalid',
          command: 'test'
        })
      ).toThrow()

      expect(() =>
        HookConfigSchema.parse({
          type: 'command',
          command: ''
        })
      ).toThrow()

      expect(() =>
        HookConfigSchema.parse({
          type: 'command',
          command: 'test',
          timeout: -1
        })
      ).toThrow()
    })
  })

  describe('HooksConfigurationSchema', () => {
    test('should validate complete hooks configuration', () => {
      const config = {
        hooks: {
          PreToolUse: [
            {
              matcher: 'Edit|Write',
              hooks: [
                {
                  type: 'command' as const,
                  command: 'git add .',
                  timeout: 30,
                  run_in_background: false
                }
              ]
            }
          ],
          PostToolUse: [
            {
              matcher: 'Write',
              hooks: [
                {
                  type: 'command' as const,
                  command: 'npm run format',
                  timeout: 60,
                  run_in_background: true
                }
              ]
            }
          ]
        }
      }

      const result = HooksConfigurationSchema.parse(config)
      expect(result.hooks.PreToolUse).toHaveLength(1)
      expect(result.hooks.PostToolUse).toHaveLength(1)
      expect(result.hooks.PreToolUse?.[0]?.hooks[0]?.command).toBe('git add .')
    })

    test('should validate empty hooks configuration', () => {
      const config = { hooks: {} }
      const result = HooksConfigurationSchema.parse(config)
      expect(result.hooks).toEqual({})
    })
  })

  describe('HookPayloadSchema', () => {
    test('should validate basic hook payload', () => {
      const payload = {
        session_id: 'abc123',
        transcript_path: '/path/to/transcript.jsonl',
        cwd: '/working/directory',
        hook_event_name: 'PreToolUse' as const
      }

      const result = HookPayloadSchema.parse(payload)
      expect(result.session_id).toBe('abc123')
      expect(result.hook_event_name).toBe('PreToolUse')
    })

    test('should validate hook payload with tool data', () => {
      const payload = {
        session_id: 'abc123',
        transcript_path: '/path/to/transcript.jsonl',
        cwd: '/working/directory',
        hook_event_name: 'PreToolUse' as const,
        tool_name: 'Write',
        tool_input: {
          file_path: '/path/to/file.ts',
          content: 'console.log("hello")'
        }
      }

      const result = HookPayloadSchema.parse(payload)
      expect(result.tool_name).toBe('Write')
      expect(result.tool_input?.file_path).toBe('/path/to/file.ts')
    })

    test('should validate hook payload with user prompt', () => {
      const payload = {
        session_id: 'abc123',
        transcript_path: '/path/to/transcript.jsonl',
        cwd: '/working/directory',
        hook_event_name: 'UserPromptSubmit' as const,
        user_prompt: 'Please add a new feature'
      }

      const result = HookPayloadSchema.parse(payload)
      expect(result.user_prompt).toBe('Please add a new feature')
    })
  })

  describe('HookResponseSchema', () => {
    test('should validate hook response with defaults', () => {
      const response = {}
      const result = HookResponseSchema.parse(response)

      expect(result.continue).toBe(true)
      expect(result.suppressOutput).toBe(false)
      expect(result.stopReason).toBeUndefined()
    })

    test('should validate hook response with all fields', () => {
      const response = {
        continue: false,
        stopReason: 'Security issue detected',
        suppressOutput: true
      }

      const result = HookResponseSchema.parse(response)
      expect(result).toEqual(response)
    })
  })

  describe('HookExecutionResultSchema', () => {
    test('should validate hook execution result', () => {
      const result = {
        hookId: 'PreToolUse_Edit_0',
        command: 'npm run test',
        exitCode: 0,
        stdout: 'All tests passed!',
        stderr: '',
        duration: 1234,
        timedOut: false,
        runInBackground: false,
        timestamp: Date.now()
      }

      const parsed = HookExecutionResultSchema.parse(result)
      expect(parsed.hookId).toBe('PreToolUse_Edit_0')
      expect(parsed.exitCode).toBe(0)
      expect(parsed.duration).toBe(1234)
    })
  })

  describe('CreateHookConfigBodySchema', () => {
    test('should validate create hook request', () => {
      const body = {
        event: 'PreToolUse' as const,
        matcher: 'Edit|Write',
        hookConfig: {
          type: 'command' as const,
          command: 'git add .',
          timeout: 30
        },
        configLevel: 'project' as const
      }

      const result = CreateHookConfigBodySchema.parse(body)
      expect(result.event).toBe('PreToolUse')
      expect(result.configLevel).toBe('project')
    })

    test('should use default config level', () => {
      const body = {
        event: 'PreToolUse' as const,
        matcher: 'Edit|Write',
        hookConfig: {
          type: 'command' as const,
          command: 'git add .'
        }
      }

      const result = CreateHookConfigBodySchema.parse(body)
      expect(result.configLevel).toBe('project') // default
    })
  })

  describe('UpdateHookConfigBodySchema', () => {
    test('should validate update with single field', () => {
      const body = { enabled: false }
      const result = UpdateHookConfigBodySchema.parse(body)
      expect(result.enabled).toBe(false)
    })

    test('should validate update with multiple fields', () => {
      const body = {
        matcher: 'Edit|Write|Read',
        hookConfig: {
          type: 'command' as const,
          command: 'npm run lint',
          timeout: 45
        },
        enabled: true
      }

      const result = UpdateHookConfigBodySchema.parse(body)
      expect(result.matcher).toBe('Edit|Write|Read')
      expect(result.hookConfig?.command).toBe('npm run lint')
      expect(result.enabled).toBe(true)
    })

    test('should reject empty update', () => {
      expect(() => UpdateHookConfigBodySchema.parse({})).toThrow()
    })
  })

  describe('Type safety', () => {
    test('should have correct type inference', () => {
      const config = HookConfigSchema.parse({
        type: 'command',
        command: 'test'
      })

      // TypeScript should infer the correct types
      expect(typeof config.type).toBe('string')
      expect(typeof config.command).toBe('string')
      expect(typeof config.timeout).toBe('number')
      expect(typeof config.run_in_background).toBe('boolean')
    })
  })
})
