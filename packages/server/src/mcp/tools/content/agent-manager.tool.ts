import { z } from '@hono/zod-openapi'
import type { MCPToolDefinition, MCPToolResponse } from '../../tools-registry'
import {
  createTrackedHandler,
  validateRequiredParam,
  validateDataField,
  createMCPError,
  MCPError,
  MCPErrorCode,
  formatMCPErrorResponse,
  AgentManagerAction,
  AgentManagerSchema
} from '../shared'
import {
  listAgents,
  getAgentById,
  createAgent,
  updateAgent,
  deleteAgent,
  getAgentsByProjectId,
  suggestAgents
} from '@promptliano/services'

export const agentManagerTool: MCPToolDefinition = {
  name: 'agent_manager',
  description:
    'Manage agents dynamically loaded from .claude/agents directory. Actions: list, get, create, update, delete, list_by_project, suggest_agents',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'The action to perform',
        enum: Object.values(AgentManagerAction)
      },
      agentId: {
        type: 'string',
        description: 'The agent ID (required for: get, update, delete). Example: "code-reviewer" or "test-writer"'
      },
      projectId: {
        type: 'number',
        description:
          'The project ID (required for: list_by_project, associate_with_project, suggest_agents). Example: 1754111018844'
      },
      data: {
        type: 'object',
        description:
          'Action-specific data. For create: { name: "Code Reviewer", description: "Expert in code review", content: "# Code Reviewer\\n\\nYou are an expert...", color: "blue", filePath: "code-reviewer.md" }. For update: { name: "Updated Name", description: "New description", content: "Updated content", color: "green" }. For suggest_agents: { context: "help me with testing", limit: 5 (optional) }'
      }
    },
    required: ['action']
  },
  handler: createTrackedHandler(
    'agent_manager',
    async (args: z.infer<typeof AgentManagerSchema>): Promise<MCPToolResponse> => {
      try {
        const { action, agentId, projectId, data } = args
        switch (action) {
          case AgentManagerAction.LIST: {
            const agents = await listAgents(process.cwd())
            const agentList = agents
              .map(
                (a) =>
                  `${a.id}: ${a.name} - ${a.description.substring(0, 100)}${a.description.length > 100 ? '...' : ''}`
              )
              .join('\n')
            return {
              content: [{ type: 'text', text: agentList || 'No agents found' }]
            }
          }
          case AgentManagerAction.GET: {
            const validAgentId = validateRequiredParam(agentId, 'agentId', 'string', '"code-reviewer"')
            const agent = await getAgentById(process.cwd(), validAgentId)
            const details = `Name: ${agent.name}\nID: ${agent.id}\nDescription: ${agent.description}\nColor: ${agent.color}\nFile Path: ${agent.filePath}\nContent Preview:\n${agent.content.substring(0, 500)}${agent.content.length > 500 ? '...' : ''}\n\nCreated: ${new Date(agent.created).toLocaleString()}\nUpdated: ${new Date(agent.updated).toLocaleString()}`
            return {
              content: [{ type: 'text', text: details }]
            }
          }
          case AgentManagerAction.CREATE: {
            const name = validateDataField<string>(data, 'name', 'string', '"Code Reviewer"')
            const description = validateDataField<string>(
              data,
              'description',
              'string',
              '"Expert in code review and best practices"'
            )
            const content = validateDataField<string>(
              data,
              'content',
              'string',
              '"# Code Reviewer\\n\\nYou are an expert code reviewer..."'
            )
            const color = data?.color || 'blue'
            const agent = await createAgent(process.cwd(), {
              name,
              description,
              content,
              color,
              filePath: data.filePath
            })
            return {
              content: [{ type: 'text', text: `Agent created successfully: ${agent.name} (ID: ${agent.id})` }]
            }
          }
          case AgentManagerAction.UPDATE: {
            const validAgentId = validateRequiredParam(agentId, 'agentId', 'string', '"code-reviewer"')
            const updateData: any = {}
            if (data.name !== undefined) updateData.name = data.name
            if (data.description !== undefined) updateData.description = data.description
            if (data.content !== undefined) updateData.content = data.content
            if (data.color !== undefined) updateData.color = data.color
            const agent = await updateAgent(process.cwd(), validAgentId, updateData)
            return {
              content: [{ type: 'text', text: `Agent updated successfully: ${agent.name} (ID: ${agent.id})` }]
            }
          }
          case AgentManagerAction.DELETE: {
            const validAgentId = validateRequiredParam(agentId, 'agentId', 'string', '"code-reviewer"')
            const success = await deleteAgent(process.cwd(), validAgentId)
            return {
              content: [
                {
                  type: 'text',
                  text: success
                    ? `Agent ${validAgentId} deleted successfully`
                    : `Failed to delete agent ${validAgentId}`
                }
              ]
            }
          }
          case AgentManagerAction.LIST_BY_PROJECT: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1754111018844')
            const agents = await getAgentsByProjectId(process.cwd(), validProjectId)
            const agentList = agents
              .map(
                (a) =>
                  `${a.id}: ${a.name} - ${a.description.substring(0, 100)}${a.description.length > 100 ? '...' : ''}`
              )
              .join('\n')
            return {
              content: [{ type: 'text', text: agentList || `No agents found for project ${validProjectId}` }]
            }
          }
          case AgentManagerAction.ASSOCIATE_WITH_PROJECT: {
            // This action is deprecated as agents are now file-based and don't need project associations
            return {
              content: [
                {
                  type: 'text',
                  text: "Agent-project associations are deprecated. Agents are now dynamically loaded from the project's .claude/agents directory."
                }
              ]
            }
          }
          case AgentManagerAction.SUGGEST_AGENTS: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1754111018844')
            const context = data?.context || ''
            const limit = data?.limit || 5
            const suggestions = await suggestAgents(validProjectId, context, limit)
            const agentList = suggestions.agents
              .map(
                (a) =>
                  `${a.id}: ${a.name}\n   Description: ${a.description}\n   Relevance: ${a.relevanceScore}/10\n   Reason: ${a.relevanceReason}`
              )
              .join('\n\n')
            return {
              content: [{ type: 'text', text: agentList || 'No agent suggestions found' }]
            }
          }
          default:
            throw createMCPError(MCPErrorCode.UNKNOWN_ACTION, `Unknown action: ${action}`, {
              action,
              validActions: Object.values(AgentManagerAction)
            })
        }
      } catch (error) {
        // Convert to MCPError if not already
        const mcpError =
          error instanceof MCPError
            ? error
            : MCPError.fromError(error, {
                tool: 'agent_manager',
                action: args.action,
                projectId: args.projectId
              })
        // Return formatted error response with recovery suggestions
        return await formatMCPErrorResponse(mcpError)
      }
    }
  )
}
