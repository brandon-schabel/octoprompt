import { createRoute } from '@hono/zod-openapi'
import { z } from '@hono/zod-openapi'
import { OpenAPIHono } from '@hono/zod-openapi'
import * as activeTabService from '@promptliano/services'
import { updateActiveTabSchema, ApiErrorResponseSchema, OperationSuccessResponseSchema } from '@promptliano/schemas'
import { createStandardResponses, standardResponses, successResponse, operationSuccessResponse } from '../utils/route-helpers'

export const activeTabRoutes = new OpenAPIHono()

// Define reusable schemas
const ActiveTabDataSchema = z
  .object({
    activeTabId: z.number(),
    lastUpdated: z.number(),
    clientId: z.string().optional(),
    tabMetadata: z
      .object({
        displayName: z.string().optional(),
        selectedFiles: z.array(z.number()).optional(),
        selectedPrompts: z.array(z.number()).optional(),
        userPrompt: z.string().optional(),
        fileSearch: z.string().optional(),
        contextLimit: z.number().optional(),
        preferredEditor: z.enum(['vscode', 'cursor', 'webstorm']).optional(),
        suggestedFileIds: z.array(z.number()).optional(),
        ticketSearch: z.string().optional(),
        ticketSort: z.enum(['created_asc', 'created_desc', 'status', 'priority']).optional(),
        ticketStatusFilter: z.enum(['all', 'open', 'in_progress', 'closed', 'non_closed']).optional()
      })
      .optional()
  })
  .nullable()
  .openapi('ActiveTabData')

const ActiveTabResponseSchema = z
  .object({
    success: z.literal(true),
    data: ActiveTabDataSchema
  })
  .openapi('ActiveTabResponse')

const ActiveTabResponseSchemaRequired = z
  .object({
    success: z.literal(true),
    data: ActiveTabDataSchema.unwrap() // Remove nullable for set/update responses
  })
  .openapi('ActiveTabResponseRequired')

// Get active tab for a project
const getActiveTabRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/active-tab',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    query: z.object({
      clientId: z.string().optional()
    })
  },
  responses: createStandardResponses(ActiveTabResponseSchema)
})

activeTabRoutes.openapi(getActiveTabRoute, async (c) => {
  const { projectId } = c.req.valid('param')
  const { clientId } = c.req.valid('query')

  const activeTab = await activeTabService.getActiveTab(projectId, clientId)

  return c.json(successResponse(
    activeTab
      ? {
          activeTabId: activeTab.data.activeTabId,
          lastUpdated: activeTab.data.lastUpdated,
          clientId: activeTab.data.clientId,
          tabMetadata: activeTab.data.tabMetadata
        }
      : null
  ))
})

// Set active tab for a project
const setActiveTabRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/active-tab',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    body: {
      content: {
        'application/json': {
          schema: updateActiveTabSchema
        }
      }
    }
  },
  responses: createStandardResponses(ActiveTabResponseSchemaRequired)
})

activeTabRoutes.openapi(setActiveTabRoute, async (c) => {
  const { projectId } = c.req.valid('param')
  const body = c.req.valid('json')

  const activeTab = await activeTabService.updateActiveTab(projectId, body)

  return c.json(successResponse({
    activeTabId: activeTab.data.activeTabId,
    lastUpdated: activeTab.data.lastUpdated,
    clientId: activeTab.data.clientId,
    tabMetadata: activeTab.data.tabMetadata
  }))
})

// Clear active tab for a project
const clearActiveTabRoute = createRoute({
  method: 'delete',
  path: '/api/projects/{projectId}/active-tab',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    query: z.object({
      clientId: z.string().optional()
    })
  },
  responses: createStandardResponses(OperationSuccessResponseSchema)
})

activeTabRoutes.openapi(clearActiveTabRoute, async (c) => {
  const { projectId } = c.req.valid('param')
  const { clientId } = c.req.valid('query')

  const success = await activeTabService.clearActiveTab(projectId, clientId)

  return c.json(operationSuccessResponse(
    success ? 'Active tab cleared' : 'No active tab found'
  ))
})
