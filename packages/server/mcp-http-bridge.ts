#!/usr/bin/env bun
/**
 * HTTP-to-stdio bridge for MCP
 * This allows Claude Desktop (which only supports stdio) to connect to our HTTP MCP server
 * providing platform-independent configuration
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js'

// Configuration
const MCP_HTTP_URL = process.env.MCP_HTTP_URL || 'http://localhost:3147/api/mcp'
const PROJECT_ID = process.env.PROMPTLIANO_PROJECT_ID
const DEBUG = process.env.MCP_DEBUG === 'true'

// Create the stdio server
const server = new Server(
  {
    name: 'promptliano-http-bridge',
    version: '0.8.1'
  },
  {
    capabilities: {
      tools: {},
      resources: {}
    }
  }
)

// Helper to make HTTP requests to the actual MCP server
async function callHTTPMCP(method: string, params: any = {}): Promise<any> {
  const url = PROJECT_ID ? MCP_HTTP_URL.replace('/api/mcp', `/api/projects/${PROJECT_ID}/mcp`) : MCP_HTTP_URL

  const request = {
    jsonrpc: '2.0',
    id: Date.now(),
    method,
    params
  }

  if (DEBUG) {
    console.error('[Bridge] Calling HTTP MCP:', { url, method, params })
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Promptliano-HTTP-Bridge/1.0'
      },
      body: JSON.stringify(request)
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const result = await response.json()

    if (DEBUG) {
      console.error('[Bridge] HTTP MCP response:', result)
    }

    if (result.error) {
      throw new Error(result.error.message || 'Unknown error')
    }

    return result.result
  } catch (error) {
    console.error('[Bridge] HTTP MCP error:', error)
    throw error
  }
}

// Initialize handler
server.setRequestHandler('initialize', async (request) => {
  try {
    const result = await callHTTPMCP('initialize', request.params)
    return result
  } catch (error) {
    console.error('[Bridge] Initialize error:', error)
    throw error
  }
})

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  try {
    const result = await callHTTPMCP('tools/list')
    return result
  } catch (error) {
    console.error('[Bridge] List tools error:', error)
    return { tools: [] }
  }
})

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const result = await callHTTPMCP('tools/call', request.params)
    return result
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      ],
      isError: true
    }
  }
})

// List resources handler
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  try {
    const result = await callHTTPMCP('resources/list')
    return result
  } catch (error) {
    console.error('[Bridge] List resources error:', error)
    return { resources: [] }
  }
})

// Read resource handler
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  try {
    const result = await callHTTPMCP('resources/read', request.params)
    return result
  } catch (error) {
    throw new Error(`Resource read failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
})

// Start the stdio transport
async function main() {
  console.error(`[Bridge] Starting HTTP-to-stdio bridge for ${MCP_HTTP_URL}`)
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[Bridge] Connected and ready')
}

main().catch((error) => {
  console.error('[Bridge] Failed to start:', error)
  process.exit(1)
})
