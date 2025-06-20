import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { getMCPServer } from './server'
import type { Context } from 'hono'
import { ApiError } from '@octoprompt/shared'

// Session management
interface MCPSession {
  id: string
  transport: SSEServerTransport
  server: Server
  projectId?: number
  createdAt: number
  lastActivity: number
}

const sessions = new Map<string, MCPSession>()

// Cleanup inactive sessions after 30 minutes
const SESSION_TIMEOUT = 30 * 60 * 1000

/**
 * Clean up inactive sessions
 */
export function cleanupInactiveSessions() {
  const now = Date.now()
  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.lastActivity > SESSION_TIMEOUT) {
      console.log(`Cleaning up inactive MCP session: ${sessionId}`)
      session.transport.close()
      sessions.delete(sessionId)
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupInactiveSessions, 5 * 60 * 1000)

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Handle HTTP transport for Cursor and other HTTP-based clients
 * Note: SSE transport support is temporarily disabled pending proper Hono integration
 */
export async function handleHTTPTransport(c: Context): Promise<Response> {
  const projectId = c.req.param('projectId')
  
  // Validate project ID if provided
  if (projectId && isNaN(parseInt(projectId))) {
    throw new ApiError(400, 'Invalid project ID', 'INVALID_PROJECT_ID')
  }

  // For now, return information about the MCP server
  // SSE transport will be implemented once we have proper Node.js response access
  return c.json({
    success: true,
    data: {
      name: 'octoprompt-mcp',
      version: '1.0.0',
      description: 'OctoPrompt MCP Server',
      transports: ['stdio'],
      note: 'HTTP/SSE transport coming soon. Use stdio transport for now.',
      stdio_command: 'bun run mcp:stdio'
    }
  })
}

/**
 * Get session information
 */
export function getSession(sessionId: string): MCPSession | undefined {
  const session = sessions.get(sessionId)
  if (session) {
    session.lastActivity = Date.now()
  }
  return session
}

/**
 * Close a specific session
 */
export function closeSession(sessionId: string): boolean {
  const session = sessions.get(sessionId)
  if (session) {
    session.transport.close()
    sessions.delete(sessionId)
    console.log(`MCP session closed: ${sessionId}`)
    return true
  }
  return false
}

/**
 * Get all active sessions
 */
export function getActiveSessions(): Array<{
  id: string
  projectId?: number
  createdAt: number
  lastActivity: number
}> {
  return Array.from(sessions.entries()).map(([id, session]) => ({
    id,
    projectId: session.projectId,
    createdAt: session.createdAt,
    lastActivity: session.lastActivity
  }))
}

/**
 * Start stdio transport for Claude Desktop
 * This should be called when the server is started with --mcp-stdio flag
 */
export async function startStdioTransport() {
  const server = getMCPServer()
  const transport = new StdioServerTransport()
  
  await server.connect(transport)
  
  // Keep the process alive
  process.stdin.resume()
}