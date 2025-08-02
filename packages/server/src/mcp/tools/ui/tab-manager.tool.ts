import { z } from '@hono/zod-openapi'
import {
  validateRequiredParam,
  validateDataField,
  createTrackedHandler,
  MCPError,
  MCPErrorCode,
  createMCPError,
  formatMCPErrorResponse,
  type MCPToolDefinition,
  type MCPToolResponse
} from '../shared'
import {
  getActiveTab,
  setActiveTab,
  clearActiveTab,
  createTabNameGenerationService
} from '@promptliano/services'

export enum TabManagerAction {
  GET_ACTIVE = 'get_active',
  SET_ACTIVE = 'set_active',
  CLEAR_ACTIVE = 'clear_active',
  GENERATE_NAME = 'generate_name'
}

const TabManagerSchema = z.object({
  action: z.enum([
    TabManagerAction.GET_ACTIVE,
    TabManagerAction.SET_ACTIVE,
    TabManagerAction.CLEAR_ACTIVE,
    TabManagerAction.GENERATE_NAME
  ]),
  projectId: z.number(),
  data: z.any().optional()
})

export const tabManagerTool: MCPToolDefinition = {
  name: 'tab_manager',
  description: 'Manage active tabs for projects. Actions: get_active, set_active, clear_active',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'The action to perform',
        enum: Object.values(TabManagerAction)
      },
      projectId: {
        type: 'number',
        description: 'The project ID (required for all actions). Example: 1750564533014'
      },
      data: {
        type: 'object',
        description: 'Action-specific data. For set_active: { tabId: 0, clientId: "optional-client-id" }'
      }
    },
    required: ['action', 'projectId']
  },
  handler: createTrackedHandler(
    'tab_manager',
    async (args: z.infer<typeof TabManagerSchema>): Promise<MCPToolResponse> => {
      try {
        const { action, projectId, data } = args
        switch (action) {
          case TabManagerAction.GET_ACTIVE: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1750564533014')
            const clientId = data?.clientId as string | undefined
            const activeTab = await getActiveTab(validProjectId, clientId)
            if (!activeTab) {
              return {
                content: [{ type: 'text', text: `No active tab set for project ${validProjectId}` }]
              }
            }
            return {
              content: [
                {
                  type: 'text',
                  text:
                    `Active tab for project ${validProjectId}:\n` +
                    `Tab ID: ${activeTab.data.activeTabId}\n` +
                    `Last updated: ${new Date(activeTab.data.lastUpdated).toISOString()}\n` +
                    `Client ID: ${activeTab.data.clientId || 'not set'}`
                }
              ]
            }
          }
          case TabManagerAction.SET_ACTIVE: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1750564533014')
            const tabId = validateDataField<number>(data, 'tabId', 'number', '0')
            const clientId = data?.clientId as string | undefined
            const activeTab = await setActiveTab(validProjectId, tabId, clientId)
            return {
              content: [
                {
                  type: 'text',
                  text:
                    `Successfully set active tab for project ${validProjectId}:\n` +
                    `Tab ID: ${activeTab.data.activeTabId}\n` +
                    `Client ID: ${activeTab.data.clientId || 'not set'}`
                }
              ]
            }
          }
          case TabManagerAction.CLEAR_ACTIVE: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1750564533014')
            const clientId = data?.clientId as string | undefined
            const success = await clearActiveTab(validProjectId, clientId)
            return {
              content: [
                {
                  type: 'text',
                  text: success
                    ? `Active tab cleared for project ${validProjectId}`
                    : `No active tab found to clear for project ${validProjectId}`
                }
              ]
            }
          }
          case TabManagerAction.GENERATE_NAME: {
            const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1750564533014')
            const tabId = validateDataField<number>(data, 'tabId', 'number', '0')
            const tabData = data?.tabData || {}
            const existingNames = data?.existingNames || []
            const tabNameService = createTabNameGenerationService()
            const result = await tabNameService.generateUniqueTabName(validProjectId, tabData, existingNames)
            return {
              content: [
                {
                  type: 'text',
                  text: `Generated tab name: "${result.name}"\nStatus: ${result.status}\nGenerated at: ${result.generatedAt.toISOString()}`
                }
              ]
            }
          }
          default:
            throw createMCPError(MCPErrorCode.UNKNOWN_ACTION, `Unknown action: ${action}`, {
              action,
              validActions: Object.values(TabManagerAction)
            })
        }
      } catch (error) {
        // Convert to MCPError if not already
        const mcpError =
          error instanceof MCPError
            ? error
            : MCPError.fromError(error, {
                tool: 'tab_manager',
                action: args.action
              })
        // Return formatted error response with recovery suggestions
        return formatMCPErrorResponse(mcpError)
      }
    }
  )
}