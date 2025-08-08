import { describe, expect, it, beforeEach } from 'bun:test'
import { WebSocketManager } from './websocket-manager'

describe('WebSocketManager', () => {
  let wsManager: WebSocketManager

  beforeEach(() => {
    wsManager = new WebSocketManager()
  })

  describe('Client Management', () => {
    it('should add a client', () => {
      const mockWs = {
        data: { clientId: 'test-client-123' },
        readyState: 1,
        send: () => {}
      } as any

      wsManager.addClient(mockWs)
      // Test client was added by trying to send a message
      const sent = wsManager.sendToClient('test-client-123', { test: true })
      expect(sent).toBe(true)
    })

    it('should remove a client', () => {
      const mockWs = {
        data: { clientId: 'test-client-456' },
        readyState: 1,
        send: () => {}
      } as any

      wsManager.addClient(mockWs)
      wsManager.removeClient('test-client-456')

      // Test client was removed
      const sent = wsManager.sendToClient('test-client-456', { test: true })
      expect(sent).toBe(false)
    })
  })

  describe('Message Broadcasting', () => {
    it('should broadcast to all connected clients', () => {
      let messagesSent = 0
      const createMockWs = (id: string) =>
        ({
          data: { clientId: id },
          readyState: 1,
          send: () => {
            messagesSent++
          }
        }) as any

      wsManager.addClient(createMockWs('client1'))
      wsManager.addClient(createMockWs('client2'))
      wsManager.addClient(createMockWs('client3'))

      wsManager.broadcast({ type: 'test', data: 'broadcast' })
      expect(messagesSent).toBe(3)
    })

    it('should broadcast to specific project', () => {
      let messagesSent = 0
      const createMockWs = (id: string, projectId?: number) =>
        ({
          data: { clientId: id, projectId },
          readyState: 1,
          send: () => {
            messagesSent++
          }
        }) as any

      wsManager.addClient(createMockWs('client1', 1))
      wsManager.addClient(createMockWs('client2', 2))
      wsManager.addClient(createMockWs('client3', 1))

      wsManager.broadcastToProject(1, { type: 'project-update' })
      expect(messagesSent).toBe(2) // Only clients with projectId 1
    })
  })

  describe('Job Events', () => {
    it('should send job events', () => {
      let messageReceived: any = null
      const mockWs = {
        data: { clientId: 'test-client', projectId: 1 },
        readyState: 1,
        send: (msg: string) => {
          messageReceived = JSON.parse(msg)
        }
      } as any

      wsManager.addClient(mockWs)

      const jobEvent = {
        type: 'job.started' as const,
        job: {
          id: 1,
          type: 'test-job',
          projectId: 1,
          status: 'running' as const,
          input: {},
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      }

      wsManager.sendJobEvent(jobEvent)
      expect(messageReceived).toEqual({
        type: 'job.event',
        data: jobEvent
      })
    })
  })

  describe('Message Handling', () => {
    it('should handle project subscription', () => {
      const mockWs = {
        data: { clientId: 'test-client' },
        readyState: 1,
        send: () => {}
      } as any

      wsManager.addClient(mockWs)
      wsManager.handleMessage(
        mockWs,
        JSON.stringify({
          type: 'subscribe.project',
          projectId: 123
        })
      )

      expect(mockWs.data.projectId).toBe(123)
    })

    it('should handle invalid JSON gracefully', () => {
      const mockWs = {
        data: { clientId: 'test-client' },
        readyState: 1,
        send: () => {}
      } as any

      wsManager.addClient(mockWs)

      // Should not throw
      expect(() => {
        wsManager.handleMessage(mockWs, 'invalid json{')
      }).not.toThrow()
    })
  })
})
