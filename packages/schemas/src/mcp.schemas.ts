import { z } from '@hono/zod-openapi'
import { unixTimestampSchema } from './unix-ts-utils'

// MCP Server Configuration Schema
export const MCPServerConfigSchema = z
  .object({
    id: z.number().int().positive().openapi({
      description: 'Unique identifier for the MCP server configuration',
      example: 1234567890
    }),
    projectId: z.number().int().positive().openapi({
      description: 'ID of the project this MCP server belongs to',
      example: 1234567890
    }),
    name: z.string().min(1).openapi({
      description: 'Display name for the MCP server',
      example: 'File System Tools'
    }),
    command: z.string().min(1).openapi({
      description: 'Command to start the MCP server',
      example: 'npx @modelcontextprotocol/server-filesystem'
    }),
    args: z.array(z.string()).default([]).openapi({
      description: 'Command line arguments for the server',
      example: ['--root', '/path/to/project']
    }),
    env: z.record(z.string()).default({}).openapi({
      description: 'Environment variables for the server',
      example: { NODE_ENV: 'production' }
    }),
    enabled: z.boolean().default(true).openapi({
      description: 'Whether the server is enabled',
      example: true
    }),
    autoStart: z.boolean().default(false).openapi({
      description: 'Whether to auto-start the server when project opens',
      example: false
    }),
    created: unixTimestampSchema,
    updated: unixTimestampSchema
  })
  .openapi('MCPServerConfig')

export type MCPServerConfig = z.infer<typeof MCPServerConfigSchema>

// MCP Server State Schema
export const MCPServerStateSchema = z
  .object({
    serverId: z.number().int().positive(),
    status: z.enum(['stopped', 'starting', 'running', 'error']).openapi({
      description: 'Current status of the MCP server',
      example: 'running'
    }),
    pid: z.number().int().positive().nullable().openapi({
      description: 'Process ID if server is running',
      example: 12345
    }),
    error: z.string().nullable().openapi({
      description: 'Error message if server failed to start',
      example: null
    }),
    startedAt: unixTimestampSchema.nullable(),
    lastHeartbeat: unixTimestampSchema.nullable()
  })
  .openapi('MCPServerState')

export type MCPServerState = z.infer<typeof MCPServerStateSchema>

// MCP Tool Parameter Schema
export const MCPToolParameterSchema = z
  .object({
    name: z.string(),
    type: z.string(),
    description: z.string().optional(),
    required: z.boolean().default(true),
    default: z.any().optional(),
    enum: z.array(z.any()).optional()
  })
  .openapi('MCPToolParameter')

export type MCPToolParameter = z.infer<typeof MCPToolParameterSchema>

// MCP Tool Schema
export const MCPToolSchema = z
  .object({
    id: z.string().openapi({
      description: 'Unique identifier for the tool',
      example: 'read_file'
    }),
    name: z.string().openapi({
      description: 'Display name for the tool',
      example: 'Read File'
    }),
    description: z.string().openapi({
      description: 'Description of what the tool does',
      example: 'Reads the contents of a file'
    }),
    parameters: z.array(MCPToolParameterSchema).default([]).openapi({
      description: 'Parameters required by the tool'
    }),
    inputSchema: z.record(z.any()).optional().openapi({
      description: 'JSON Schema for tool input validation',
      example: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to read' }
        },
        required: ['path']
      }
    }),
    serverId: z.number().int().positive().openapi({
      description: 'ID of the MCP server providing this tool'
    })
  })
  .openapi('MCPTool')

export type MCPTool = z.infer<typeof MCPToolSchema>

// MCP Resource Schema
export const MCPResourceSchema = z
  .object({
    uri: z.string().openapi({
      description: 'URI of the resource',
      example: 'file:///path/to/file.txt'
    }),
    name: z.string().openapi({
      description: 'Display name for the resource',
      example: 'file.txt'
    }),
    description: z.string().optional().openapi({
      description: 'Description of the resource'
    }),
    mimeType: z.string().optional().openapi({
      description: 'MIME type of the resource',
      example: 'text/plain'
    }),
    serverId: z.number().int().positive().openapi({
      description: 'ID of the MCP server providing this resource'
    })
  })
  .openapi('MCPResource')

export type MCPResource = z.infer<typeof MCPResourceSchema>

// MCP Tool Execution Request Schema
export const MCPToolExecutionRequestSchema = z
  .object({
    toolId: z.string().openapi({
      description: 'ID of the tool to execute',
      example: 'read_file'
    }),
    serverId: z.number().int().positive().openapi({
      description: 'ID of the MCP server to execute the tool on'
    }),
    parameters: z.record(z.any()).default({}).openapi({
      description: 'Parameters to pass to the tool',
      example: { path: '/path/to/file.txt' }
    })
  })
  .openapi('MCPToolExecutionRequest')

export type MCPToolExecutionRequest = z.infer<typeof MCPToolExecutionRequestSchema>

// MCP Tool Execution Result Schema
export const MCPToolExecutionResultSchema = z
  .object({
    id: z.string().openapi({
      description: 'Unique ID for this execution',
      example: 'exec_123456'
    }),
    toolId: z.string(),
    serverId: z.number().int().positive(),
    status: z.enum(['pending', 'running', 'success', 'error']).openapi({
      description: 'Status of the execution',
      example: 'success'
    }),
    result: z.any().nullable().openapi({
      description: 'Result from the tool execution'
    }),
    error: z.string().nullable().openapi({
      description: 'Error message if execution failed'
    }),
    startedAt: unixTimestampSchema,
    completedAt: unixTimestampSchema.nullable()
  })
  .openapi('MCPToolExecutionResult')

export type MCPToolExecutionResult = z.infer<typeof MCPToolExecutionResultSchema>

// MCP Server Capabilities Schema
export const MCPServerCapabilitiesSchema = z
  .object({
    tools: z.boolean().default(false).openapi({
      description: 'Whether the server provides tools'
    }),
    resources: z.boolean().default(false).openapi({
      description: 'Whether the server provides resources'
    }),
    prompts: z.boolean().default(false).openapi({
      description: 'Whether the server provides prompts'
    }),
    sampling: z.boolean().default(false).openapi({
      description: 'Whether the server supports sampling'
    })
  })
  .openapi('MCPServerCapabilities')

export type MCPServerCapabilities = z.infer<typeof MCPServerCapabilitiesSchema>

// MCP Connection Info Schema
export const MCPConnectionInfoSchema = z
  .object({
    serverId: z.number().int().positive(),
    transport: z.enum(['websocket', 'http']).default('http').openapi({
      description: 'Transport protocol used for communication',
      example: 'http'
    }),
    endpoint: z.string().optional().openapi({
      description: 'Connection endpoint (for websocket/http transports)',
      example: 'ws://localhost:8080'
    }),
    capabilities: MCPServerCapabilitiesSchema.optional()
  })
  .openapi('MCPConnectionInfo')

export type MCPConnectionInfo = z.infer<typeof MCPConnectionInfoSchema>

// MCP Protocol Message Schema
export const MCPProtocolMessageSchema = z
  .object({
    jsonrpc: z.literal('2.0'),
    id: z.union([z.string(), z.number()]).optional(),
    method: z.string().optional(),
    params: z.any().optional(),
    result: z.any().optional(),
    error: z
      .object({
        code: z.number(),
        message: z.string(),
        data: z.any().optional()
      })
      .optional()
  })
  .openapi('MCPProtocolMessage')

export type MCPProtocolMessage = z.infer<typeof MCPProtocolMessageSchema>

// API Request/Response Schemas
export const CreateMCPServerConfigBodySchema = MCPServerConfigSchema.omit({
  id: true,
  created: true,
  updated: true
}).openapi('CreateMCPServerConfigBody')

export type CreateMCPServerConfigBody = z.infer<typeof CreateMCPServerConfigBodySchema>

export const UpdateMCPServerConfigBodySchema = CreateMCPServerConfigBodySchema.partial().openapi('UpdateMCPServerConfigBody')

export type UpdateMCPServerConfigBody = z.infer<typeof UpdateMCPServerConfigBodySchema>

// Response schemas
export const MCPServerConfigResponseSchema = z
  .object({
    success: z.boolean(),
    data: MCPServerConfigSchema
  })
  .openapi('MCPServerConfigResponse')

export type MCPServerConfigResponse = z.infer<typeof MCPServerConfigResponseSchema>

export const MCPServerConfigListResponseSchema = z
  .object({
    success: z.boolean(),
    data: z.array(MCPServerConfigSchema)
  })
  .openapi('MCPServerConfigListResponse')

export type MCPServerConfigListResponse = z.infer<typeof MCPServerConfigListResponseSchema>

export const MCPToolListResponseSchema = z
  .object({
    success: z.boolean(),
    data: z.array(MCPToolSchema)
  })
  .openapi('MCPToolListResponse')

export type MCPToolListResponse = z.infer<typeof MCPToolListResponseSchema>

export const MCPResourceListResponseSchema = z
  .object({
    success: z.boolean(),
    data: z.array(MCPResourceSchema)
  })
  .openapi('MCPResourceListResponse')

export type MCPResourceListResponse = z.infer<typeof MCPResourceListResponseSchema>

export const MCPToolExecutionResultResponseSchema = z
  .object({
    success: z.boolean(),
    data: MCPToolExecutionResultSchema
  })
  .openapi('MCPToolExecutionResultResponse')

export type MCPToolExecutionResultResponse = z.infer<typeof MCPToolExecutionResultResponseSchema>

export const MCPServerStateResponseSchema = z
  .object({
    success: z.boolean(),
    data: MCPServerStateSchema
  })
  .openapi('MCPServerStateResponse')

export type MCPServerStateResponse = z.infer<typeof MCPServerStateResponseSchema>

export const MCPConnectionInfoResponseSchema = z
  .object({
    success: z.boolean(),
    data: MCPConnectionInfoSchema
  })
  .openapi('MCPConnectionInfoResponse')

export type MCPConnectionInfoResponse = z.infer<typeof MCPConnectionInfoResponseSchema>
