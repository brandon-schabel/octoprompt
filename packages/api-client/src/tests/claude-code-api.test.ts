import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { createOctoPromptClient, type OctoPromptClient } from '../../api-client'
import { ClaudeCodeRequestSchema, ClaudeCodeResultSchema, ClaudeCodeSessionSchema } from '@octoprompt/schemas'
import { TEST_API_URL } from './test-config'

describe('Claude Code API Tests', () => {
  let apiClient: OctoPromptClient
  let testSessionId: string | null = null
  let testProjectId: number | null = null

  beforeAll(async () => {
    apiClient = createOctoPromptClient({
      baseUrl: TEST_API_URL,
      timeout: 60000 // Claude Code operations can take longer
    })

    // Create a test project for Claude Code testing
    const projectResponse = await apiClient.projects.createProject({
      name: `Claude Code Test Project - ${Date.now()}`,
      path: './test-project',
      description: 'Test project for Claude Code API testing'
    })
    testProjectId = projectResponse.data.id
  })

  afterAll(async () => {
    // Clean up test session if created
    if (testSessionId) {
      try {
        await apiClient.claudeCode.deleteSession(testSessionId)
      } catch (error) {
        console.warn('Failed to clean up test session:', error)
      }
    }

    // Clean up test project
    if (testProjectId) {
      try {
        await apiClient.projects.deleteProject(testProjectId)
      } catch (error) {
        console.warn('Failed to clean up test project:', error)
      }
    }
  })

  describe('Session Management', () => {
    test('should list Claude Code sessions', async () => {
      const sessions = await apiClient.claudeCode.getSessions()

      expect(sessions).toBeDefined()
      expect(sessions.sessions).toBeInstanceOf(Array)
    })

    test('should execute a Claude Code query', async () => {
      const request = {
        prompt: 'List the files in the current directory',
        maxTurns: 1,
        projectId: testProjectId!,
        includeProjectContext: false,
        outputFormat: 'json' as const
      }

      // Validate request matches schema
      const validatedRequest = ClaudeCodeRequestSchema.parse(request)
      expect(validatedRequest).toBeDefined()

      const result = await apiClient.claudeCode.executeQuery(request)

      // Validate result matches schema
      const validatedResult = ClaudeCodeResultSchema.parse(result)
      expect(validatedResult).toBeDefined()

      expect(result).toBeDefined()
      expect(result.sessionId).toBeDefined()
      expect(typeof result.sessionId).toBe('string')
      expect(result.messages).toBeInstanceOf(Array)
      expect(typeof result.totalCostUsd).toBe('number')
      expect(typeof result.isError).toBe('boolean')
      expect(typeof result.durationMs).toBe('number')
      expect(typeof result.numTurns).toBe('number')

      // Save session ID for cleanup
      testSessionId = result.sessionId
    })

    test('should get a specific session', async () => {
      if (!testSessionId) {
        // Create a session first
        const result = await apiClient.claudeCode.executeQuery({
          prompt: 'echo "test"',
          maxTurns: 1,
          outputFormat: 'json' as const
        })
        testSessionId = result.sessionId
      }

      const session = await apiClient.claudeCode.getSession(testSessionId)

      // Validate session matches schema
      const validatedSession = ClaudeCodeSessionSchema.parse(session)
      expect(validatedSession).toBeDefined()

      expect(session).toBeDefined()
      expect(session.id).toBe(testSessionId)
      expect(typeof session.created).toBe('number')
      expect(typeof session.lastActivity).toBe('number')
      expect(['idle', 'running', 'error', 'active']).toContain(session.status)
    })

    test('should continue an existing session', async () => {
      if (!testSessionId) {
        // Create a session first
        const result = await apiClient.claudeCode.executeQuery({
          prompt: 'echo "initial"',
          maxTurns: 1,
          outputFormat: 'json' as const
        })
        testSessionId = result.sessionId
      }

      const continuedResult = await apiClient.claudeCode.continueSession(testSessionId, 'echo "continued"')

      expect(continuedResult).toBeDefined()
      expect(continuedResult.sessionId).toBe(testSessionId)
      expect(continuedResult.messages).toBeInstanceOf(Array)
    })

    test('should delete a session', async () => {
      // Create a new session to delete
      const result = await apiClient.claudeCode.executeQuery({
        prompt: 'echo "to be deleted"',
        maxTurns: 1,
        outputFormat: 'json' as const
      })
      const tempSessionId = result.sessionId

      // Delete the session
      const deleteResult = await apiClient.claudeCode.deleteSession(tempSessionId)
      expect(deleteResult).toBe(true)

      // Verify session is deleted
      try {
        await apiClient.claudeCode.getSession(tempSessionId)
        expect(true).toBe(false) // Should not reach here
      } catch (error: any) {
        expect(error.statusCode).toBe(404)
      }
    })
  })

  describe('Streaming', () => {
    test('should stream Claude Code execution', async () => {
      const request = {
        prompt: 'echo "streaming test"',
        maxTurns: 1,
        outputFormat: 'stream-json' as const
      }

      const stream = await apiClient.claudeCode.streamQuery(request)
      expect(stream).toBeDefined()
      expect(stream).toBeInstanceOf(ReadableStream)

      // Read from stream
      const reader = stream.getReader()
      const decoder = new TextDecoder()
      let messages = []

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const text = decoder.decode(value, { stream: true })
          const lines = text.split('\n').filter((line) => line.trim())

          for (const line of lines) {
            try {
              const message = JSON.parse(line)
              messages.push(message)
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      } finally {
        reader.releaseLock()
      }

      expect(messages.length).toBeGreaterThan(0)
    })
  })

  describe('Audit and File Tracking', () => {
    test('should get session file changes', async () => {
      if (!testSessionId) {
        const result = await apiClient.claudeCode.executeQuery({
          prompt: 'echo "test" > test.txt',
          maxTurns: 1,
          projectId: testProjectId!,
          outputFormat: 'json' as const
        })
        testSessionId = result.sessionId
      }

      const fileChanges = await apiClient.claudeCode.getSessionFileChanges(testSessionId)
      expect(fileChanges).toBeDefined()
      expect(fileChanges).toBeInstanceOf(Array)
    })

    test('should get audit logs', async () => {
      const logs = await apiClient.claudeCode.getAuditLogs({
        limit: 10,
        offset: 0
      })

      expect(logs).toBeDefined()
      expect(logs).toBeInstanceOf(Array)
    })

    test('should get session audit summary', async () => {
      if (!testSessionId) {
        const result = await apiClient.claudeCode.executeQuery({
          prompt: 'echo "audit test"',
          maxTurns: 1,
          projectId: testProjectId!,
          outputFormat: 'json' as const
        })
        testSessionId = result.sessionId
      }

      try {
        const summary = await apiClient.claudeCode.getSessionAuditSummary(testSessionId)
        expect(summary).toBeDefined()
        expect(summary.sessionId).toBe(testSessionId)
        expect(typeof summary.totalActions).toBe('number')
      } catch (error: any) {
        // Audit logs might not be available for new sessions
        if (error.statusCode !== 404) {
          throw error
        }
      }
    })
  })

  describe('Error Handling', () => {
    test('should handle invalid session ID', async () => {
      try {
        await apiClient.claudeCode.getSession('invalid-session-id')
        expect(true).toBe(false) // Should not reach here
      } catch (error: any) {
        expect(error.statusCode).toBe(404)
      }
    })

    test('should handle invalid request', async () => {
      try {
        await apiClient.claudeCode.executeQuery({
          prompt: '', // Empty prompt should fail
          maxTurns: 1,
          outputFormat: 'json' as const
        })
        expect(true).toBe(false) // Should not reach here
      } catch (error: any) {
        expect(error).toBeDefined()
      }
    })

    test('should handle continuation of non-existent session', async () => {
      try {
        await apiClient.claudeCode.continueSession('non-existent-session', 'test')
        expect(true).toBe(false) // Should not reach here
      } catch (error: any) {
        expect(error.statusCode).toBe(404)
      }
    })
  })

  describe('Project Context Integration', () => {
    test('should execute with project context', async () => {
      const result = await apiClient.claudeCode.executeQuery({
        prompt: 'List the project files',
        maxTurns: 1,
        projectId: testProjectId!,
        includeProjectContext: true,
        outputFormat: 'json' as const
      })

      expect(result).toBeDefined()
      expect(result.sessionId).toBeDefined()
      expect(result.messages).toBeInstanceOf(Array)
    })

    test('should execute with custom system prompt', async () => {
      const result = await apiClient.claudeCode.executeQuery({
        prompt: 'Say hello',
        maxTurns: 1,
        systemPrompt: 'You are a helpful assistant. Always respond politely.',
        outputFormat: 'json' as const
      })

      expect(result).toBeDefined()
      expect(result.sessionId).toBeDefined()
    })

    test('should execute with allowed tools restriction', async () => {
      const result = await apiClient.claudeCode.executeQuery({
        prompt: 'List files using only the LS tool',
        maxTurns: 1,
        allowedTools: ['LS'],
        outputFormat: 'json' as const
      })

      expect(result).toBeDefined()
      expect(result.sessionId).toBeDefined()
    })
  })
})
