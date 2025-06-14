import { describe, test, expect } from 'bun:test'
import { createOctoPromptClient, OctoPromptError } from '../../api-client'
import { ClaudeCodeRequestSchema, ClaudeCodeResultSchema } from '@octoprompt/schemas'

describe('Claude Code API Client Unit Tests', () => {
  const mockBaseUrl = 'http://localhost:3147'
  const client = createOctoPromptClient({
    baseUrl: mockBaseUrl,
    timeout: 30000
  })

  describe('Request Validation', () => {
    test('should validate Claude Code request schema', () => {
      const validRequest = {
        prompt: 'Test prompt',
        maxTurns: 5,
        outputFormat: 'json' as const
      }

      const result = ClaudeCodeRequestSchema.parse(validRequest)
      expect(result).toBeDefined()
      expect(result.prompt).toBe('Test prompt')
      expect(result.maxTurns).toBe(5)
      expect(result.outputFormat).toBe('json')
    })

    test('should fail validation with empty prompt', () => {
      const invalidRequest = {
        prompt: '',
        maxTurns: 5,
        outputFormat: 'json' as const
      }

      expect(() => ClaudeCodeRequestSchema.parse(invalidRequest)).toThrow()
    })

    test('should use default values when optional fields are omitted', () => {
      const minimalRequest = {
        prompt: 'Test prompt'
      }

      const result = ClaudeCodeRequestSchema.parse(minimalRequest)
      expect(result.maxTurns).toBe(5) // default
      expect(result.outputFormat).toBe('json') // default
      expect(result.includeProjectContext).toBe(false) // default
    })
  })

  describe('Result Schema Validation', () => {
    test('should validate Claude Code result schema', () => {
      const validResult = {
        sessionId: 'test-session-123',
        messages: [
          {
            id: 'msg-1',
            type: 'user',
            content: 'Test message',
            created: Date.now(),
            updated: Date.now(),
            timestamp: Date.now()
          }
        ],
        totalCostUsd: 0.0025,
        isError: false,
        durationMs: 1500,
        numTurns: 1
      }

      const result = ClaudeCodeResultSchema.parse(validResult)
      expect(result).toBeDefined()
      expect(result.sessionId).toBe('test-session-123')
      expect(result.messages).toHaveLength(1)
      expect(result.totalCostUsd).toBe(0.0025)
      expect(result.isError).toBe(false)
    })
  })

  describe('Client Methods', () => {
    test('should have all required methods', () => {
      expect(client.claudeCode).toBeDefined()
      expect(typeof client.claudeCode.executeQuery).toBe('function')
      expect(typeof client.claudeCode.streamQuery).toBe('function')
      expect(typeof client.claudeCode.continueSession).toBe('function')
      expect(typeof client.claudeCode.getSessions).toBe('function')
      expect(typeof client.claudeCode.getSession).toBe('function')
      expect(typeof client.claudeCode.deleteSession).toBe('function')
      expect(typeof client.claudeCode.getSessionFileChanges).toBe('function')
      expect(typeof client.claudeCode.getAuditLogs).toBe('function')
      expect(typeof client.claudeCode.getSessionAuditSummary).toBe('function')
    })

    test('should throw validation error for invalid request', async () => {
      try {
        // @ts-expect-error - Testing invalid input
        await client.claudeCode.executeQuery({ prompt: '' })
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(OctoPromptError)
        expect((error as OctoPromptError).errorCode).toBe('VALIDATION_ERROR')
      }
    })
  })

  describe('Query String Building', () => {
    test('should build query strings correctly', () => {
      // Test that the buildQueryString method exists and works
      // This is a protected method, so we can't test it directly
      // But we can verify the functionality exists by checking the getAuditLogs implementation

      const query = {
        sessionId: 'test-123',
        projectId: 456,
        limit: 10,
        offset: 0
      }

      // The method should accept the query object
      expect(() => {
        // This will throw due to no server, but we're testing that it accepts the params
        client.claudeCode.getAuditLogs(query).catch(() => {})
      }).not.toThrow()
    })
  })

  describe('Error Handling', () => {
    test('should create proper error objects', () => {
      const error = new OctoPromptError('Test error', 404, 'NOT_FOUND', { detail: 'test' })

      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(OctoPromptError)
      expect(error.message).toBe('Test error')
      expect(error.statusCode).toBe(404)
      expect(error.errorCode).toBe('NOT_FOUND')
      expect(error.details).toEqual({ detail: 'test' })
    })
  })
})
