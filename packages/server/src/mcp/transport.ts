// Recent changes:
// - Fixed session ID handling by returning it in response headers
// - Implemented missing MCP methods (initialized, prompts/list, prompts/get, logging/setLevel, ping)
// - Connected tool/resource handlers to actual MCP client manager
// - Added proper JSON-RPC error codes (-32700, -32600, -32601, -32602, -32603)
// - Implemented notification handling for requests without id

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import type { Context } from 'hono'
import { ApiError } from '@promptliano/shared'
import {
  getMCPClientManager,
  getProjectFiles,
  getProjectById,
  suggestFiles,
  startMCPToolExecution,
  completeMCPToolExecution,
  ensureProjectServersInitialized,
  listProjects,
  getProjectCompactSummary
} from '@promptliano/services'
import { CONSOLIDATED_TOOLS, getConsolidatedToolByName } from './tools-registry'

// JSON-RPC 2.0 message types
interface JSONRPCRequest {
  jsonrpc: '2.0'
  id?: string | number
  method: string
  params?: any
}

interface JSONRPCResponse {
  jsonrpc: '2.0'
  id: string | number
  result?: any
  error?: {
    code: number
    message: string
    data?: any
  }
}

interface JSONRPCError {
  jsonrpc: '2.0'
  id: string | number | null
  error: {
    code: number
    message: string
    data?: any
  }
}

type JSONRPCMessage = JSONRPCRequest | JSONRPCResponse | JSONRPCError

// Standard JSON-RPC error codes
const JSON_RPC_ERRORS = {
  PARSE_ERROR: { code: -32700, message: 'Parse error' },
  INVALID_REQUEST: { code: -32600, message: 'Invalid Request' },
  METHOD_NOT_FOUND: { code: -32601, message: 'Method not found' },
  INVALID_PARAMS: { code: -32602, message: 'Invalid params' },
  INTERNAL_ERROR: { code: -32603, message: 'Internal error' },
  SERVER_ERROR: (code: number, message: string) => ({ code, message })
}

// Session management
interface MCPSession {
  id: string
  projectId?: number
  createdAt: number
  lastActivity: number
  capabilities: any
  clientInfo?: any
  clientCapabilities?: any
}

const sessions = new Map<string, MCPSession>()

// Generate unique session ID
function generateSessionId(): string {
  return `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Session cleanup (remove sessions older than 1 hour)
setInterval(
  () => {
    const now = Date.now()
    const oneHour = 60 * 60 * 1000

    for (const [sessionId, session] of sessions.entries()) {
      if (now - session.lastActivity > oneHour) {
        sessions.delete(sessionId)
        console.log(`[MCP] Cleaned up expired session: ${sessionId}`)
      }
    }
  },
  5 * 60 * 1000
) // Check every 5 minutes

// Create SSE response with session ID in headers
function createSSEResponse(messages: JSONRPCMessage[], sessionId?: string): Response {
  const stream = new ReadableStream({
    start(controller) {
      for (const message of messages) {
        const data = `data: ${JSON.stringify(message)}\n\n`
        controller.enqueue(new TextEncoder().encode(data))
      }
      controller.close()
    }
  })

  const headers: Record<string, string> = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Mcp-Session-Id',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  }

  if (sessionId) {
    headers['Mcp-Session-Id'] = sessionId
  }

  return new Response(stream, { headers })
}

// Handle JSON-RPC notifications (no response needed)
async function handleJSONRPCNotification(message: JSONRPCRequest): Promise<void> {
  if (process.env.MCP_DEBUG) {
    console.log('[MCP Notification]', JSON.stringify(message, null, 2))
  }

  switch (message.method) {
    case 'initialized':
      // Client has completed initialization - just log it
      console.log('[MCP] Client initialization completed')
      break
    case 'notifications/message':
      // Handle client notifications
      console.log('[MCP] Client notification:', message.params)
      break
    default:
      console.log(`[MCP] Unknown notification method: ${message.method}`)
  }
}

// Main JSON-RPC request handler
async function handleJSONRPCRequest(
  message: JSONRPCRequest,
  projectId?: string,
  sessionId?: string
): Promise<JSONRPCResponse | null> {
  const { id, method, params } = message

  // Handle notifications (no id means no response expected)
  if (id === undefined) {
    await handleJSONRPCNotification(message)
    return null
  }

  if (process.env.MCP_DEBUG) {
    console.log('[MCP Request]', JSON.stringify(message, null, 2))
  }

  try {
    let result: any

    switch (method) {
      case 'initialize':
        result = await handleInitialize(id, params, projectId)
        break
      case 'tools/list':
        result = await handleToolsList(id, params, projectId, sessionId)
        break
      case 'tools/call':
        result = await handleToolsCall(id, params, projectId, sessionId)
        break
      case 'resources/list':
        result = await handleResourcesList(id, params, projectId, sessionId)
        break
      case 'resources/read':
        result = await handleResourcesRead(id, params, projectId, sessionId)
        break
      case 'prompts/list':
        result = await handlePromptsList(id, params, projectId, sessionId)
        break
      case 'prompts/get':
        result = await handlePromptsGet(id, params, projectId, sessionId)
        break
      case 'logging/setLevel':
        result = await handleLoggingSetLevel(id, params, sessionId)
        break
      case 'ping':
        result = { jsonrpc: '2.0', id, result: {} }
        break
      default:
        return {
          jsonrpc: '2.0',
          id,
          error: {
            ...JSON_RPC_ERRORS.METHOD_NOT_FOUND,
            message: `Method not found: ${method}`
          }
        }
    }

    if (process.env.MCP_DEBUG) {
      console.log('[MCP Response]', JSON.stringify(result, null, 2))
    }

    return result
  } catch (error) {
    console.error(`[MCP] Error handling method ${method}:`, error)
    return {
      jsonrpc: '2.0',
      id,
      error: {
        ...JSON_RPC_ERRORS.INTERNAL_ERROR,
        data: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

// Initialize MCP session
async function handleInitialize(id: string | number, params: any, projectId?: string): Promise<JSONRPCResponse> {
  const { capabilities, clientInfo } = params || {}

  const sessionId = generateSessionId()

  // Initialize project-level MCP servers if project ID is provided
  if (projectId) {
    try {
      const projectIdNum = parseInt(projectId, 10)
      if (!isNaN(projectIdNum)) {
        await ensureProjectServersInitialized(projectIdNum)
        console.log(`[MCP] Initialized project servers for project ${projectIdNum}`)
      }
    } catch (error) {
      console.error('[MCP] Failed to initialize project servers:', error)
    }
  }

  // Validate client capabilities and create server capabilities
  const serverCapabilities = {
    tools: capabilities?.tools !== false,
    resources: capabilities?.resources !== false,
    prompts: capabilities?.prompts !== false,
    logging: capabilities?.logging !== false
  }

  const session: MCPSession = {
    id: sessionId,
    projectId: projectId ? parseInt(projectId) : undefined,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    capabilities: serverCapabilities,
    clientInfo,
    clientCapabilities: capabilities
  }

  sessions.set(sessionId, session)

  console.log(`[MCP] Initialized session ${sessionId} for project ${projectId || 'global'}`)

  return {
    jsonrpc: '2.0',
    id,
    result: {
      protocolVersion: '2024-11-05',
      capabilities: serverCapabilities,
      serverInfo: {
        name: 'promptliano-mcp',
        version: '0.8.1'
      },
      _meta: { sessionId } // Include session ID for client reference
    }
  }
}

// List available tools
async function handleToolsList(
  id: string | number,
  params: any,
  projectId?: string,
  sessionId?: string
): Promise<JSONRPCResponse> {
  try {
    // Return Promptliano's consolidated MCP tools
    const mcpTools = CONSOLIDATED_TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }))

    // If projectId is provided, add project-specific tools
    if (projectId) {
      try {
        // Also include any external MCP server tools if available
        const externalTools = await getMCPClientManager().listAllTools(parseInt(projectId))
        for (const tool of externalTools) {
          const externalTool = {
            name: `external_${tool.name}`,
            description: `[External] ${tool.description}`,
            inputSchema: tool.inputSchema || {
              type: 'object' as const,
              properties:
                tool.parameters?.reduce(
                  (acc, param) => {
                    acc[param.name] = {
                      type: param.type,
                      description: param.description,
                      ...(param.enum && { enum: param.enum }),
                      ...(param.default !== undefined && { default: param.default })
                    }
                    return acc
                  },
                  {} as Record<string, any>
                ) || {},
              required: tool.parameters?.filter((p) => p.required).map((p) => p.name) || []
            }
          }
          mcpTools.push(externalTool as any)
        }
      } catch (error) {
        console.warn('[MCP] Could not load external tools:', error)
      }
    }

    return {
      jsonrpc: '2.0',
      id,
      result: { tools: mcpTools }
    }
  } catch (error) {
    console.error('[MCP] Error listing tools:', error)
    return {
      jsonrpc: '2.0',
      id,
      error: {
        ...JSON_RPC_ERRORS.INTERNAL_ERROR,
        data: error instanceof Error ? error.message : 'Failed to list tools'
      }
    }
  }
}

// Execute a tool
async function handleToolsCall(
  id: string | number,
  params: any,
  projectId?: string,
  sessionId?: string
): Promise<JSONRPCResponse> {
  try {
    const { name, arguments: args } = params

    if (!name) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          ...JSON_RPC_ERRORS.INVALID_PARAMS,
          message: 'Tool name is required'
        }
      }
    }

    // Handle built-in Promptliano tools
    if (name.startsWith('external_')) {
      // Handle external MCP server tools
      if (!projectId) {
        return {
          jsonrpc: '2.0',
          id,
          error: {
            ...JSON_RPC_ERRORS.INVALID_PARAMS,
            message: 'Project ID is required for external tool execution'
          }
        }
      }

      const externalToolName = name.replace('external_', '')
      const tools = await getMCPClientManager().listAllTools(parseInt(projectId))
      const tool = tools.find((t) => t.name === externalToolName)

      if (!tool) {
        return {
          jsonrpc: '2.0',
          id,
          error: {
            ...JSON_RPC_ERRORS.INVALID_PARAMS,
            message: `External tool not found: ${externalToolName}`
          }
        }
      }

      // Start tracking for external tool
      const executionId = await startMCPToolExecution(
        `external_${externalToolName}`,
        parseInt(projectId),
        args,
        undefined,
        sessionId
      )

      try {
        const result = await getMCPClientManager().executeTool(tool.serverId, externalToolName, args || {})
        const content = Array.isArray(result)
          ? result
          : [
              {
                type: 'text',
                text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
              }
            ]

        // Complete tracking with success
        const outputSize = JSON.stringify(content).length
        await completeMCPToolExecution(executionId, 'success', outputSize)

        return {
          jsonrpc: '2.0',
          id,
          result: { content }
        }
      } catch (error) {
        // Complete tracking with error
        await completeMCPToolExecution(
          executionId,
          'error',
          undefined,
          error instanceof Error ? error.message : String(error)
        )
        throw error
      }
    }

    // Handle built-in tools using shared registry
    const tool = getConsolidatedToolByName(name)

    if (!tool) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          ...JSON_RPC_ERRORS.INVALID_PARAMS,
          message: `Unknown tool: ${name}`
        }
      }
    }

    let result: any = null
    let executionId: number | null = null

    try {
      // Track built-in tool execution
      console.log('[MCP] Starting tool tracking:', { sessionId, name, projectId })
      executionId = await startMCPToolExecution(
        name,
        projectId ? parseInt(projectId) : undefined,
        args || {},
        undefined,
        sessionId || 'unknown'
      )
      console.log('[MCP] Execution ID:', executionId)

      const toolResult = await tool.handler(args || {}, projectId ? parseInt(projectId) : undefined)
      result = toolResult.content

      // Calculate output size
      const outputSize = JSON.stringify(result).length

      // Complete tracking with success
      if (executionId) {
        console.log('[MCP] Completing tool tracking with success:', { executionId, outputSize })
        await completeMCPToolExecution(executionId, 'success', outputSize)
        console.log('[MCP] Tool tracking completed')
      }
    } catch (error) {
      result = [
        {
          type: 'text',
          text: `Error executing tool: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      ]

      // Complete tracking with error
      if (executionId) {
        const outputSize = JSON.stringify(result).length
        await completeMCPToolExecution(
          executionId,
          'error',
          outputSize,
          error instanceof Error ? error.message : 'Unknown error'
        )
      }
    }

    return {
      jsonrpc: '2.0',
      id,
      result: { content: result }
    }
  } catch (error) {
    console.error('[MCP] Error executing tool:', error)
    return {
      jsonrpc: '2.0',
      id,
      error: {
        ...JSON_RPC_ERRORS.INTERNAL_ERROR,
        data: error instanceof Error ? error.message : 'Tool execution failed'
      }
    }
  }
}

// List available resources
async function handleResourcesList(
  id: string | number,
  params: any,
  projectId?: string,
  sessionId?: string
): Promise<JSONRPCResponse> {
  try {
    const mcpResources = []

    // Add global resources (available without projectId)
    try {
      const projects = await listProjects()

      // Add all projects resource
      mcpResources.push({
        uri: 'promptliano://projects',
        name: 'All Projects',
        description: 'List of all available projects in Promptliano',
        mimeType: 'application/json'
      })

      // Add resources for each project
      for (const project of projects) {
        mcpResources.push({
          uri: `promptliano://projects/${project.id}/summary`,
          name: `${project.name} Summary`,
          description: `Compact summary of project "${project.name}"`,
          mimeType: 'text/plain'
        })

        mcpResources.push({
          uri: `promptliano://projects/${project.id}/files`,
          name: `${project.name} Files`,
          description: `List of files in project "${project.name}"`,
          mimeType: 'application/json'
        })
      }
    } catch (error) {
      console.warn('[MCP] Could not load global resources:', error)
    }

    // Add project-specific resources if projectId is provided
    if (projectId) {
      try {
        const project = await getProjectById(parseInt(projectId))
        const files = await getProjectFiles(parseInt(projectId))

        // Add file suggestion resource
        mcpResources.push({
          uri: `promptliano://projects/${projectId}/suggest-files`,
          name: 'File Suggestions',
          description: 'AI-powered file suggestions based on prompts',
          mimeType: 'application/json'
        })

        // Add individual file resources (limit to first 10 for performance)
        const fileResources = (files || []).slice(0, 10).map((file) => ({
          uri: `promptliano://projects/${projectId}/files/${file.id}`,
          name: file.name,
          description: `File: ${file.path} (${file.size} bytes)`,
          mimeType:
            file.extension === '.json'
              ? 'application/json'
              : file.extension === '.md'
                ? 'text/markdown'
                : file.extension.match(/\.(js|ts|jsx|tsx)$/)
                  ? 'text/javascript'
                  : 'text/plain'
        }))

        mcpResources.push(...fileResources)
      } catch (error) {
        console.warn('[MCP] Could not load project resources:', error)
      }
    }

    // Also include any external MCP server resources if available
    if (projectId) {
      try {
        const externalResources = await getMCPClientManager().listAllResources(parseInt(projectId))
        const externalMcpResources = externalResources.map((resource) => ({
          uri: `external://${resource.uri}`,
          name: `[External] ${resource.name}`,
          description: resource.description,
          mimeType: resource.mimeType
        }))

        mcpResources.push(...externalMcpResources)
      } catch (error) {
        console.warn('[MCP] Could not load external resources:', error)
      }
    }

    return {
      jsonrpc: '2.0',
      id,
      result: { resources: mcpResources }
    }
  } catch (error) {
    console.error('[MCP] Error listing resources:', error)
    return {
      jsonrpc: '2.0',
      id,
      error: {
        ...JSON_RPC_ERRORS.INTERNAL_ERROR,
        data: error instanceof Error ? error.message : 'Failed to list resources'
      }
    }
  }
}

// Read a resource
async function handleResourcesRead(
  id: string | number,
  params: any,
  projectId?: string,
  sessionId?: string
): Promise<JSONRPCResponse> {
  try {
    const { uri } = params

    if (!uri) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          ...JSON_RPC_ERRORS.INVALID_PARAMS,
          message: 'Resource URI is required'
        }
      }
    }

    // Handle external resources
    if (uri.startsWith('external://')) {
      if (!projectId) {
        return {
          jsonrpc: '2.0',
          id,
          error: {
            ...JSON_RPC_ERRORS.INVALID_PARAMS,
            message: 'Project ID is required for external resource access'
          }
        }
      }

      const externalUri = uri.replace('external://', '')
      const resources = await getMCPClientManager().listAllResources(parseInt(projectId))
      const resource = resources.find((r) => r.uri === externalUri)

      if (!resource) {
        return {
          jsonrpc: '2.0',
          id,
          error: {
            ...JSON_RPC_ERRORS.INVALID_PARAMS,
            message: `External resource not found: ${externalUri}`
          }
        }
      }

      const content = await getMCPClientManager().readResource(resource.serverId, externalUri)
      return {
        jsonrpc: '2.0',
        id,
        result: {
          contents: Array.isArray(content)
            ? content
            : [
                {
                  uri,
                  mimeType: resource.mimeType || 'text/plain',
                  text: typeof content === 'string' ? content : JSON.stringify(content, null, 2)
                }
              ]
        }
      }
    }

    // Handle built-in Promptliano resources
    if (uri.startsWith('promptliano://')) {
      const urlParts = uri.replace('promptliano://', '').split('/')

      // Handle global projects list
      if (uri === 'promptliano://projects') {
        const projects = await listProjects()
        return {
          jsonrpc: '2.0',
          id,
          result: {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(projects, null, 2)
              }
            ]
          }
        }
      }

      // Handle project-specific resources
      if (urlParts[0] === 'projects' && urlParts[1]) {
        const resourceProjectId = urlParts[1]

        if (urlParts[2] === 'summary') {
          // Project summary resource - use compact summary
          const summary = await getProjectCompactSummary(parseInt(resourceProjectId))

          return {
            jsonrpc: '2.0',
            id,
            result: {
              contents: [
                {
                  uri,
                  mimeType: 'text/plain',
                  text: summary
                }
              ]
            }
          }
        } else if (urlParts[2] === 'files' && !urlParts[3]) {
          // Project files list
          const files = await getProjectFiles(parseInt(resourceProjectId))
          return {
            jsonrpc: '2.0',
            id,
            result: {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(files || [], null, 2)
                }
              ]
            }
          }
        } else if (urlParts[2] === 'suggest-files') {
          // File suggestions resource (requires prompt parameter)
          return {
            jsonrpc: '2.0',
            id,
            result: {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(
                    {
                      message: 'This resource requires a prompt parameter. Use the suggest_files tool instead.',
                      example: {
                        tool: 'suggest_files',
                        arguments: {
                          prompt: 'components for user authentication',
                          limit: 10
                        }
                      }
                    },
                    null,
                    2
                  )
                }
              ]
            }
          }
        } else if (urlParts[2] === 'files' && urlParts[3]) {
          // Individual file resource
          const fileId = parseInt(urlParts[3])
          
          // Ensure projectId is valid before parsing
          if (!projectId) {
            return {
              jsonrpc: '2.0',
              id,
              error: {
                ...JSON_RPC_ERRORS.INVALID_PARAMS,
                message: 'Project ID is required for file resources'
              }
            }
          }
          
          const files = await getProjectFiles(parseInt(projectId))
          const file = files?.find((f) => f.id === fileId)

          if (!file) {
            return {
              jsonrpc: '2.0',
              id,
              error: {
                ...JSON_RPC_ERRORS.INVALID_PARAMS,
                message: `File not found with ID: ${fileId}`
              }
            }
          }

          return {
            jsonrpc: '2.0',
            id,
            result: {
              contents: [
                {
                  uri,
                  mimeType:
                    file.extension === '.json'
                      ? 'application/json'
                      : file.extension === '.md'
                        ? 'text/markdown'
                        : file.extension.match(/\.(js|ts|jsx|tsx)$/)
                          ? 'text/javascript'
                          : 'text/plain',
                  text: file.content
                }
              ]
            }
          }
        }
      }
    }

    return {
      jsonrpc: '2.0',
      id,
      error: {
        ...JSON_RPC_ERRORS.INVALID_PARAMS,
        message: `Unknown resource URI: ${uri}`
      }
    }
  } catch (error) {
    console.error('[MCP] Error reading resource:', error)
    return {
      jsonrpc: '2.0',
      id,
      error: {
        ...JSON_RPC_ERRORS.INTERNAL_ERROR,
        data: error instanceof Error ? error.message : 'Resource read failed'
      }
    }
  }
}

// List available prompts
async function handlePromptsList(
  id: string | number,
  params: any,
  projectId?: string,
  sessionId?: string
): Promise<JSONRPCResponse> {
  try {
    // For now, return empty prompts - this can be extended later
    return {
      jsonrpc: '2.0',
      id,
      result: { prompts: [] }
    }
  } catch (error) {
    console.error('[MCP] Error listing prompts:', error)
    return {
      jsonrpc: '2.0',
      id,
      error: {
        ...JSON_RPC_ERRORS.INTERNAL_ERROR,
        data: error instanceof Error ? error.message : 'Failed to list prompts'
      }
    }
  }
}

// Get a specific prompt
async function handlePromptsGet(
  id: string | number,
  params: any,
  projectId?: string,
  sessionId?: string
): Promise<JSONRPCResponse> {
  try {
    const { name } = params

    if (!name) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          ...JSON_RPC_ERRORS.INVALID_PARAMS,
          message: 'Prompt name is required'
        }
      }
    }

    // For now, return not found - this can be extended later
    return {
      jsonrpc: '2.0',
      id,
      error: {
        ...JSON_RPC_ERRORS.INVALID_PARAMS,
        message: `Prompt not found: ${name}`
      }
    }
  } catch (error) {
    console.error('[MCP] Error getting prompt:', error)
    return {
      jsonrpc: '2.0',
      id,
      error: {
        ...JSON_RPC_ERRORS.INTERNAL_ERROR,
        data: error instanceof Error ? error.message : 'Failed to get prompt'
      }
    }
  }
}

// Set logging level
async function handleLoggingSetLevel(id: string | number, params: any, sessionId?: string): Promise<JSONRPCResponse> {
  try {
    const { level } = params

    if (!level || !['error', 'warn', 'info', 'debug'].includes(level)) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          ...JSON_RPC_ERRORS.INVALID_PARAMS,
          message: 'Valid logging level is required (error, warn, info, debug)'
        }
      }
    }

    // Set the logging level (you can implement actual logging level change here)
    console.log(`[MCP] Logging level set to: ${level}`)

    return {
      jsonrpc: '2.0',
      id,
      result: {}
    }
  } catch (error) {
    console.error('[MCP] Error setting logging level:', error)
    return {
      jsonrpc: '2.0',
      id,
      error: {
        ...JSON_RPC_ERRORS.INTERNAL_ERROR,
        data: error instanceof Error ? error.message : 'Failed to set logging level'
      }
    }
  }
}

// Handle POST requests (JSON-RPC messages)
async function handlePOSTRequest(c: Context): Promise<Response> {
  try {
    const projectId = c.req.param('projectId')
    const sessionId = c.req.header('Mcp-Session-Id')

    // Update session activity if session exists
    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId)!
      session.lastActivity = Date.now()
    }

    const body = await c.req.text()
    let messages: JSONRPCMessage[]

    try {
      const parsed = JSON.parse(body)
      messages = Array.isArray(parsed) ? parsed : [parsed]
    } catch {
      return Response.json(
        {
          jsonrpc: '2.0',
          id: null,
          error: JSON_RPC_ERRORS.PARSE_ERROR
        },
        { status: 400 }
      )
    }

    const responses: JSONRPCResponse[] = []

    for (const message of messages) {
      if (!message || typeof message !== 'object' || message.jsonrpc !== '2.0') {
        responses.push({
          jsonrpc: '2.0',
          id: (message as any)?.id || null,
          error: JSON_RPC_ERRORS.INVALID_REQUEST
        })
        continue
      }

      const response = await handleJSONRPCRequest(message as JSONRPCRequest, projectId, sessionId)
      if (response) {
        responses.push(response)
      }
    }

    // Return single response or batch response
    const result = responses.length === 1 ? responses[0] : responses

    // Get session ID from initialize response if available
    let responseSessionId = sessionId

    // Check if this was an initialize response with a new session
    const firstResponse = responses[0]
    if (responses.length === 1 && firstResponse?.result?._meta?.sessionId) {
      responseSessionId = firstResponse.result._meta.sessionId
      // Remove _meta from the actual response
      if (firstResponse.result._meta) {
        delete firstResponse.result._meta
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Mcp-Session-Id',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    }

    if (responseSessionId) {
      headers['Mcp-Session-Id'] = responseSessionId
    }

    return new Response(JSON.stringify(result), { headers })
  } catch (error) {
    console.error('[MCP] POST request error:', error)
    return Response.json(
      {
        jsonrpc: '2.0',
        id: null,
        error: {
          ...JSON_RPC_ERRORS.INTERNAL_ERROR,
          data: error instanceof Error ? error.message : 'Unknown error'
        }
      },
      { status: 500 }
    )
  }
}

// Handle GET requests (SSE stream)
async function handleGETRequest(c: Context): Promise<Response> {
  const projectId = c.req.param('projectId')

  // Return SSE stream with connection info
  const welcomeMessage: JSONRPCMessage = {
    jsonrpc: '2.0',
    id: 'welcome',
    result: {
      message: 'Promptliano MCP Server - Streamable HTTP Transport',
      projectId: projectId || null,
      timestamp: Date.now(),
      protocolVersion: '2024-11-05'
    }
  }

  return createSSEResponse([welcomeMessage])
}

// Main HTTP transport handler
export async function handleHTTPTransport(c: Context): Promise<Response> {
  const method = c.req.method

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Mcp-Session-Id',
        'Access-Control-Max-Age': '86400'
      }
    })
  }

  try {
    if (method === 'POST') {
      return await handlePOSTRequest(c)
    } else if (method === 'GET') {
      return await handleGETRequest(c)
    } else {
      return new Response('Method not allowed', { status: 405 })
    }
  } catch (error) {
    console.error('[MCP] Transport error:', error)
    return new Response('Internal server error', { status: 500 })
  }
}

// Session management exports
export function getActiveSessions() {
  return Array.from(sessions.values()).map((session) => ({
    id: session.id,
    projectId: session.projectId,
    createdAt: session.createdAt,
    lastActivity: session.lastActivity
  }))
}

export function closeSession(sessionId: string): boolean {
  return sessions.delete(sessionId)
}
