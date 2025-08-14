import { z } from '@hono/zod-openapi'
import * as path from 'path'
import * as os from 'os'
import {
  validateDataField,
  createTrackedHandler,
  MCPError,
  MCPErrorCode,
  createMCPError,
  formatMCPErrorResponse,
  type MCPToolDefinition,
  type MCPToolResponse
} from '../shared'

export enum MCPConfigGeneratorAction {
  GENERATE = 'generate',
  VALIDATE = 'validate',
  GET_TEMPLATES = 'get_templates'
}

const MCPConfigGeneratorSchema = z.object({
  action: z.enum([
    MCPConfigGeneratorAction.GENERATE,
    MCPConfigGeneratorAction.VALIDATE,
    MCPConfigGeneratorAction.GET_TEMPLATES
  ]),
  data: z.any().optional()
})

export const mcpConfigGeneratorTool: MCPToolDefinition = {
  name: 'mcp_config_generator',
  description:
    'Generate MCP configuration files for different editors and environments. Actions: generate (create mcp.json config), validate (validate existing config), get_templates (get available templates)',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'The action to perform',
        enum: Object.values(MCPConfigGeneratorAction)
      },
      data: {
        type: 'object',
        description:
          'Action-specific data. For generate: { editorType: "cursor" | "vscode" | "windsurf", projectPath: "/path/to/project", options: { serverName: "promptliano", enabledTools: ["project_manager", "git_manager"] } }. For validate: { config: {...} }. For get_templates: no data required'
      }
    },
    required: ['action']
  },
  handler: createTrackedHandler(
    'mcp_config_generator',
    async (args: z.infer<typeof MCPConfigGeneratorSchema>): Promise<MCPToolResponse> => {
      try {
        const { action, data } = args
        switch (action) {
          case MCPConfigGeneratorAction.GENERATE: {
            const editorType = validateDataField<string>(data, 'editorType', 'string', '"cursor"')
            const projectPath = validateDataField<string>(data, 'projectPath', 'string', '"/Users/john/myproject"')
            const options = data?.options || {}
            // Generate MCP configuration based on editor type
            const config = {
              mcpServers: {
                [options.serverName || 'promptliano']: {
                  command: 'node',
                  args: [path.join(projectPath, 'node_modules/@promptliano/server/dist/index.js')],
                  env: {
                    PROJECT_ID: options.projectId || '',
                    NODE_ENV: 'production'
                  }
                }
              }
            }
            // Add editor-specific configuration
            const serverName = options.serverName || 'promptliano'
            const serverConfig = config.mcpServers[serverName] as any
            if (serverConfig) {
              if (editorType === 'cursor') {
                serverConfig.disabled = false
              } else if (editorType === 'vscode') {
                // VSCode specific config
                serverConfig.workspaceFolder = projectPath
              }
            }
            return {
              content: [
                {
                  type: 'text',
                  text:
                    `Generated MCP configuration for ${editorType}:\n\n` +
                    '```json\n' +
                    JSON.stringify(config, null, 2) +
                    '\n```\n\n' +
                    `Save this configuration to:\n` +
                    `- Cursor: ${path.join(os.homedir(), '.cursor', 'mcp.json')}\n` +
                    `- VSCode: ${path.join(projectPath, '.vscode', 'mcp.json')}\n` +
                    `- Windsurf: ${path.join(os.homedir(), '.windsurf', 'mcp.json')}`
                }
              ]
            }
          }
          case MCPConfigGeneratorAction.VALIDATE: {
            const config = validateDataField<any>(data, 'config', 'object', '{ mcpServers: {...} }')
            // Validate configuration structure
            const errors: string[] = []
            if (!config.mcpServers) {
              errors.push('Missing required field: mcpServers')
            } else {
              for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
                const config = serverConfig as any
                if (!config?.command) {
                  errors.push(`Server ${serverName}: missing required field 'command'`)
                }
                if (!config?.args || !Array.isArray(config.args)) {
                  errors.push(`Server ${serverName}: 'args' must be an array`)
                }
              }
            }
            if (errors.length > 0) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Configuration validation failed:\n\n` + errors.map((e) => `- ${e}`).join('\n')
                  }
                ]
              }
            }
            return {
              content: [
                {
                  type: 'text',
                  text: 'Configuration is valid!'
                }
              ]
            }
          }
          case MCPConfigGeneratorAction.GET_TEMPLATES: {
            return {
              content: [
                {
                  type: 'text',
                  text:
                    'Available MCP configuration templates:\n\n' +
                    '1. **Basic Promptliano Setup**\n' +
                    '   - Single server configuration\n' +
                    '   - All tools enabled\n' +
                    '   - Default environment\n\n' +
                    '2. **Multi-Project Setup**\n' +
                    '   - Multiple Promptliano servers\n' +
                    '   - Project-specific configurations\n' +
                    '   - Environment isolation\n\n' +
                    '3. **Development Setup**\n' +
                    '   - Debug mode enabled\n' +
                    '   - Verbose logging\n' +
                    '   - Hot reload support\n\n' +
                    '4. **Production Setup**\n' +
                    '   - Optimized performance\n' +
                    '   - Error tracking\n' +
                    '   - Security hardening'
                }
              ]
            }
          }
          default:
            throw createMCPError(MCPErrorCode.UNKNOWN_ACTION, `Unknown action: ${action}`, {
              action,
              validActions: Object.values(MCPConfigGeneratorAction)
            })
        }
      } catch (error) {
        const mcpError =
          error instanceof MCPError
            ? error
            : MCPError.fromError(error, { tool: 'mcp_config_generator', action: args.action })
        return formatMCPErrorResponse(mcpError)
      }
    }
  )
}
