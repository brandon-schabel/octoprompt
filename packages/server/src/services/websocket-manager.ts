import type { ServerWebSocket } from 'bun'
import { EventEmitter } from 'node:events'
import type { JobEvent } from '@promptliano/schemas'

interface WebSocketData {
  clientId: string
  projectId?: number
  subscriptions?: Set<string>
}

export class WebSocketManager extends EventEmitter {
  private clients = new Map<string, ServerWebSocket<WebSocketData>>()

  // Add a new client
  addClient(ws: ServerWebSocket<WebSocketData>): void {
    const { clientId } = ws.data
    this.clients.set(clientId, ws)
    console.log(`[WebSocket] Client connected: ${clientId}`)
  }

  // Remove a client
  removeClient(clientId: string): void {
    this.clients.delete(clientId)
    console.log(`[WebSocket] Client disconnected: ${clientId}`)
  }

  // Send message to a specific client
  sendToClient(clientId: string, message: any): boolean {
    const ws = this.clients.get(clientId)
    if (ws && ws.readyState === 1) {
      // 1 = OPEN
      ws.send(JSON.stringify(message))
      return true
    }
    return false
  }

  // Broadcast message to all clients
  broadcast(message: any): void {
    const messageStr = JSON.stringify(message)
    let sent = 0

    for (const [clientId, ws] of this.clients) {
      if (ws.readyState === 1) {
        // 1 = OPEN
        ws.send(messageStr)
        sent++
      } else {
        // Clean up disconnected clients
        this.clients.delete(clientId)
      }
    }

    if (sent > 0) {
      console.log(`[WebSocket] Broadcasted message to ${sent} clients`)
    }
  }

  // Broadcast to clients subscribed to a specific project
  broadcastToProject(projectId: number, message: any): void {
    const messageStr = JSON.stringify(message)
    let sent = 0

    for (const [clientId, ws] of this.clients) {
      if (ws.data.projectId === projectId && ws.readyState === 1) {
        ws.send(messageStr)
        sent++
      }
    }

    if (sent > 0) {
      console.log(`[WebSocket] Broadcasted to ${sent} clients for project ${projectId}`)
    }
  }

  // Send job event
  sendJobEvent(event: JobEvent): void {
    const message = {
      type: 'job.event',
      data: event
    }

    // If job has projectId, send to project subscribers
    if (event.job.projectId) {
      this.broadcastToProject(event.job.projectId, message)
    } else {
      // Otherwise broadcast to all
      this.broadcast(message)
    }
  }

  // Handle incoming message from client
  handleMessage(ws: ServerWebSocket<WebSocketData>, message: string): void {
    try {
      const data = JSON.parse(message)

      switch (data.type) {
        case 'subscribe.project':
          if (data.projectId) {
            ws.data.projectId = data.projectId
            console.log(`[WebSocket] Client ${ws.data.clientId} subscribed to project ${data.projectId}`)
          }
          break

        case 'unsubscribe.project':
          ws.data.projectId = undefined
          console.log(`[WebSocket] Client ${ws.data.clientId} unsubscribed from project`)
          break

        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }))
          break

        default:
          console.log(`[WebSocket] Unknown message type: ${data.type}`)
      }
    } catch (error) {
      console.error('[WebSocket] Error handling message:', error)
    }
  }

  // Get connected client count
  getClientCount(): number {
    return this.clients.size
  }

  // Get clients by project
  getProjectClients(projectId: number): string[] {
    const clients: string[] = []
    for (const [clientId, ws] of this.clients) {
      if (ws.data.projectId === projectId) {
        clients.push(clientId)
      }
    }
    return clients
  }
}

// Singleton instance
let wsManagerInstance: WebSocketManager | null = null

export function getWebSocketManager(): WebSocketManager {
  if (!wsManagerInstance) {
    wsManagerInstance = new WebSocketManager()
  }
  return wsManagerInstance
}
