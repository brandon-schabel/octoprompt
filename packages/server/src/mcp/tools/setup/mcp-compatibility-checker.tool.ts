import { z } from '@hono/zod-openapi'
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

export enum MCPCompatibilityCheckerAction {
  CHECK = 'check',
  GET_REQUIREMENTS = 'get_requirements',
  CHECK_BATCH = 'check_batch'
}

const MCPCompatibilityCheckerSchema = z.object({
  action: z.enum([
    MCPCompatibilityCheckerAction.CHECK,
    MCPCompatibilityCheckerAction.GET_REQUIREMENTS,
    MCPCompatibilityCheckerAction.CHECK_BATCH
  ]),
  data: z.any().optional()
})

export const mcpCompatibilityCheckerTool: MCPToolDefinition = {
  name: 'mcp_compatibility_checker',
  description:
    'Check if user environment is compatible with Promptliano MCP. Actions: check (check single environment), get_requirements (get all requirements), check_batch (check multiple environments)',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'The action to perform',
        enum: Object.values(MCPCompatibilityCheckerAction)
      },
      data: {
        type: 'object',
        description:
          'Action-specific data. For check: { editor: "cursor", version: "0.42.3", os: "darwin" | "win32" | "linux", nodeVersion: "20.11.0" }. For check_batch: { environments: [{editor, version, os}] }'
      }
    },
    required: ['action']
  },
  handler: createTrackedHandler(
    'mcp_compatibility_checker',
    async (args: z.infer<typeof MCPCompatibilityCheckerSchema>): Promise<MCPToolResponse> => {
      try {
        const { action, data } = args
        // Define compatibility requirements
        const requirements = {
          cursor: { minVersion: '0.40.0', mcpSupport: true },
          vscode: { minVersion: '1.85.0', mcpSupport: false, extension: 'promptliano.mcp' },
          windsurf: { minVersion: '0.1.0', mcpSupport: true },
          node: { minVersion: '18.0.0' },
          os: ['darwin', 'win32', 'linux']
        }
        switch (action) {
          case MCPCompatibilityCheckerAction.CHECK: {
            const editor = validateDataField<string>(data, 'editor', 'string', '"cursor"')
            const version = validateDataField<string>(data, 'version', 'string', '"0.42.3"')
            const os = validateDataField<string>(data, 'os', 'string', '"darwin"')
            const nodeVersion = data?.nodeVersion
            const issues: string[] = []
            const warnings: string[] = []
            // Check editor compatibility
            const editorReq = requirements[editor.toLowerCase() as keyof typeof requirements]
            
            // Type guard to ensure we have a valid editor requirement object
            const isValidEditorReq = (req: unknown): req is { minVersion: string; mcpSupport: boolean; extension?: string } => {
              return typeof req === 'object' && req !== null && 'minVersion' in req && 'mcpSupport' in req
            }
            
            if (!editorReq || !isValidEditorReq(editorReq)) {
              issues.push(`Editor '${editor}' is not supported`)
            } else {
              if (!editorReq.mcpSupport) {
                if (editorReq.extension) {
                  warnings.push(`${editor} requires the ${editorReq.extension} extension for MCP support`)
                } else {
                  issues.push(`${editor} does not support MCP protocol`)
                }
              }
              // Version comparison (simplified)
              if (version < editorReq.minVersion) {
                issues.push(`${editor} version ${version} is below minimum required ${editorReq.minVersion}`)
              }
            }
            // Check OS compatibility
            if (!requirements.os.includes(os)) {
              issues.push(`Operating system '${os}' is not supported`)
            }
            // Check Node.js version if provided
            if (nodeVersion && nodeVersion < requirements.node.minVersion) {
              issues.push(`Node.js version ${nodeVersion} is below minimum required ${requirements.node.minVersion}`)
            }
            const compatible = issues.length === 0
            return {
              content: [
                {
                  type: 'text',
                  text:
                    `Compatibility Check Results:\n\n` +
                    `Editor: ${editor} v${version}\n` +
                    `OS: ${os}\n` +
                    (nodeVersion ? `Node.js: v${nodeVersion}\n` : '') +
                    `\nStatus: ${compatible ? '✅ Compatible' : '❌ Not Compatible'}\n\n` +
                    (issues.length > 0 ? `Issues:\n${issues.map((i) => `- ${i}`).join('\n')}\n\n` : '') +
                    (warnings.length > 0 ? `Warnings:\n${warnings.map((w) => `- ${w}`).join('\n')}` : '')
                }
              ]
            }
          }
          case MCPCompatibilityCheckerAction.GET_REQUIREMENTS: {
            return {
              content: [
                {
                  type: 'text',
                  text:
                    'Promptliano MCP Requirements:\n\n' +
                    '**Supported Editors:**\n' +
                    '- Cursor: v0.40.0+ (Native MCP support)\n' +
                    '- Windsurf: v0.1.0+ (Native MCP support)\n' +
                    '- VSCode: v1.85.0+ (Requires extension)\n\n' +
                    '**System Requirements:**\n' +
                    '- Node.js: v18.0.0 or higher\n' +
                    '- Operating Systems: macOS, Windows, Linux\n' +
                    '- Memory: 512MB minimum\n' +
                    '- Disk Space: 100MB for installation\n\n' +
                    '**Network Requirements:**\n' +
                    '- Local network access (for MCP server)\n' +
                    '- Internet access for installation only'
                }
              ]
            }
          }
          case MCPCompatibilityCheckerAction.CHECK_BATCH: {
            const environments = validateDataField<any[]>(
              data,
              'environments',
              'array',
              '[{editor: "cursor", version: "0.42.3", os: "darwin"}]'
            )
            const results = environments.map((env: { editor: string; version: string; os: string }) => {
              const editorReq = requirements[env.editor?.toLowerCase() as keyof typeof requirements]
              
              // Type guard to ensure we have a valid editor requirement object
              const isValidEditorReq = (req: unknown): req is { minVersion: string; mcpSupport: boolean; extension?: string } => {
                return typeof req === 'object' && req !== null && 'minVersion' in req && 'mcpSupport' in req
              }
              
              const compatible = editorReq && isValidEditorReq(editorReq) ? env.version >= editorReq.minVersion : false
              return `${env.editor} v${env.version} on ${env.os}: ${compatible ? '✅' : '❌'}`
            })
            return {
              content: [
                {
                  type: 'text',
                  text: `Batch Compatibility Check:\n\n${results.join('\n')}`
                }
              ]
            }
          }
          default:
            throw createMCPError(MCPErrorCode.UNKNOWN_ACTION, `Unknown action: ${action}`, {
              action,
              validActions: Object.values(MCPCompatibilityCheckerAction)
            })
        }
      } catch (error) {
        const mcpError =
          error instanceof MCPError
            ? error
            : MCPError.fromError(error, { tool: 'mcp_compatibility_checker', action: args.action })
        return formatMCPErrorResponse(mcpError)
      }
    }
  )
}
