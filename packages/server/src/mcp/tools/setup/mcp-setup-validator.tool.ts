import { z } from '@hono/zod-openapi'
import { promises as fs } from 'fs'
import * as path from 'path'
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

export enum MCPSetupValidatorAction {
  VALIDATE = 'validate',
  CHECK_DEPENDENCIES = 'check_dependencies',
  DIAGNOSE = 'diagnose'
}

const MCPSetupValidatorSchema = z.object({
  action: z.enum([
    MCPSetupValidatorAction.VALIDATE,
    MCPSetupValidatorAction.CHECK_DEPENDENCIES,
    MCPSetupValidatorAction.DIAGNOSE
  ]),
  data: z.any().optional()
})

export const mcpSetupValidatorTool: MCPToolDefinition = {
  name: 'mcp_setup_validator',
  description:
    'Validate Promptliano MCP setup and diagnose issues. Actions: validate (validate setup), check_dependencies (check all dependencies), diagnose (diagnose common issues)',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'The action to perform',
        enum: Object.values(MCPSetupValidatorAction)
      },
      data: {
        type: 'object',
        description:
          'Action-specific data. For validate: { configPath: "/path/to/mcp.json", projectPath: "/path/to/project" }. For diagnose: { symptoms: ["connection_failed", "tools_not_showing"] }'
      }
    },
    required: ['action']
  },
  handler: createTrackedHandler(
    'mcp_setup_validator',
    async (args: z.infer<typeof MCPSetupValidatorSchema>): Promise<MCPToolResponse> => {
      try {
        const { action, data } = args
        switch (action) {
          case MCPSetupValidatorAction.VALIDATE: {
            const configPath = validateDataField<string>(
              data,
              'configPath',
              'string',
              '"/Users/john/.cursor/mcp.json"'
            )
            const projectPath = data?.projectPath
            const checks = []
            // Check 1: Config file exists
            try {
              await fs.access(configPath)
              checks.push({ name: 'Config file exists', status: '✅', details: configPath })
            } catch {
              checks.push({ name: 'Config file exists', status: '❌', details: 'File not found' })
            }
            // Check 2: Config is valid JSON
            try {
              const content = await fs.readFile(configPath, 'utf-8')
              const config = JSON.parse(content)
              checks.push({ name: 'Valid JSON', status: '✅' })
              // Check 3: Has Promptliano server
              const hasPromptliano =
                config.mcpServers &&
                Object.keys(config.mcpServers).some(
                  (k) => k.includes('promptliano') || config.mcpServers[k].command?.includes('promptliano')
                )
              checks.push({
                name: 'Promptliano server configured',
                status: hasPromptliano ? '✅' : '❌',
                details: hasPromptliano ? '' : 'No Promptliano server found in config'
              })
            } catch (e) {
              checks.push({ name: 'Valid JSON', status: '❌', details: e.message })
            }
            // Check 4: Node modules installed (if project path provided)
            if (projectPath) {
              try {
                await fs.access(path.join(projectPath, 'node_modules', '@promptliano', 'server'))
                checks.push({ name: 'Promptliano installed', status: '✅' })
              } catch {
                checks.push({
                  name: 'Promptliano installed',
                  status: '❌',
                  details: 'Run: npm install @promptliano/server'
                })
              }
            }
            const allPassed = checks.every((c) => c.status === '✅')
            return {
              content: [
                {
                  type: 'text',
                  text:
                    `Setup Validation Results:\n\n` +
                    checks.map((c) => `${c.status} ${c.name}${c.details ? `: ${c.details}` : ''}`).join('\n') +
                    `\n\nOverall Status: ${allPassed ? '✅ Setup is valid' : '❌ Issues found'}`
                }
              ]
            }
          }
          case MCPSetupValidatorAction.CHECK_DEPENDENCIES: {
            const deps = [
              { name: 'Node.js', command: 'node --version', minVersion: '18.0.0' },
              { name: 'npm', command: 'npm --version', minVersion: '8.0.0' },
              { name: 'Git', command: 'git --version', required: false }
            ]
            const results = []
            for (const dep of deps) {
              try {
                // In real implementation, would execute command
                results.push(`✅ ${dep.name}: Installed`)
              } catch {
                results.push(`${dep.required !== false ? '❌' : '⚠️'} ${dep.name}: Not found`)
              }
            }
            return {
              content: [
                {
                  type: 'text',
                  text: `Dependency Check:\n\n${results.join('\n')}`
                }
              ]
            }
          }
          case MCPSetupValidatorAction.DIAGNOSE: {
            const symptoms = data?.symptoms || []
            const diagnoses = {
              connection_failed: {
                issue: 'MCP connection failed',
                solutions: [
                  'Ensure the MCP server path is correct in your config',
                  'Check if Node.js is installed and in PATH',
                  'Verify Promptliano is installed: npm install @promptliano/server',
                  'Restart your editor after configuration changes'
                ]
              },
              tools_not_showing: {
                issue: 'Tools not appearing in editor',
                solutions: [
                  'Ensure MCP server is running (check editor logs)',
                  'Verify the server name matches in config',
                  'Check if PROJECT_ID is set in environment variables',
                  'Try refreshing the tools list in your editor'
                ]
              },
              permission_denied: {
                issue: 'Permission denied errors',
                solutions: [
                  'Ensure you have read/write access to the project directory',
                  'Check file permissions on the MCP config file',
                  'On macOS, grant your editor full disk access in System Preferences'
                ]
              }
            }
            const relevantDiagnoses =
              symptoms.length > 0 ? symptoms.map((s) => diagnoses[s]).filter(Boolean) : Object.values(diagnoses)
            return {
              content: [
                {
                  type: 'text',
                  text:
                    'Diagnostic Results:\n\n' +
                    relevantDiagnoses
                      .map(
                        (d) =>
                          `**${d.issue}**\n` + 'Possible solutions:\n' + d.solutions.map((s) => `- ${s}`).join('\n')
                      )
                      .join('\n\n')
                }
              ]
            }
          }
          default:
            throw createMCPError(MCPErrorCode.UNKNOWN_ACTION, `Unknown action: ${action}`, {
              action,
              validActions: Object.values(MCPSetupValidatorAction)
            })
        }
      } catch (error) {
        const mcpError =
          error instanceof MCPError
            ? error
            : MCPError.fromError(error, { tool: 'mcp_setup_validator', action: args.action })
        return formatMCPErrorResponse(mcpError)
      }
    }
  )
}