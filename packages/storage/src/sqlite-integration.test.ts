import { describe, it, expect, beforeEach } from 'bun:test'
import { mcpServerConfigStorage, mcpServerStateStorage } from './mcp-server-storage'

describe('SQLite Storage Integration Tests', () => {
  describe('MCP Storage Integration', () => {
    const projectId = 12345

    beforeEach(async () => {
      // Clean up any existing data
      // This would ideally clear test data
    })

    it('should handle MCP server configurations', async () => {
      // Create a test configuration
      const config = {
        id: mcpServerConfigStorage.generateId(),
        name: 'Test MCP Server',
        projectId,
        command: 'node',
        args: ['server.js'],
        created: Date.now(),
        updated: Date.now()
      }

      // Save the configuration
      await mcpServerConfigStorage.save(config)

      // Verify the configuration was saved
      expect(config.name).toBe('Test MCP Server')
      expect(config.projectId).toBe(projectId)

      // Retrieve the saved configuration
      const saved = await mcpServerConfigStorage.get(String(config.id))
      expect(saved).toBeDefined()
      expect(saved?.name).toBe('Test MCP Server')
    })

    it('should track MCP server states', async () => {
      // Create a test server state
      const serverId = mcpServerStateStorage.generateId()
      const state = {
        id: mcpServerStateStorage.generateId(),
        serverId,
        status: 'running' as const,
        pid: 1234,
        startedAt: Date.now(),
        updated: Date.now()
      }

      // Save the initial state
      await mcpServerStateStorage.save(state)

      // Update the state to stopped
      const updatedState = await mcpServerStateStorage.update(String(state.id), {
        status: 'stopped' as const,
        stoppedAt: Date.now()
      })

      // Verify update
      expect(updatedState?.status).toBe('stopped')
    })
  })
})