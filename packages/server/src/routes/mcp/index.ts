/**
 * MCP Routes Consolidation
 * Combines all MCP-related routes into a single export
 */

import { OpenAPIHono } from '@hono/zod-openapi'
import { mcpConfigRoutes } from './config-routes'
import { mcpExecutionRoutes } from './execution-routes'
import { mcpAnalyticsRoutes } from './analytics-routes'
import { mcpTestRoutes } from './test-routes'
import { mcpSessionRoutes } from './session-routes'

// Create consolidated MCP routes
export const mcpRoutes = new OpenAPIHono()
  .route('/', mcpConfigRoutes)
  .route('/', mcpExecutionRoutes)
  .route('/', mcpAnalyticsRoutes)
  .route('/', mcpTestRoutes)
  .route('/', mcpSessionRoutes)

export type MCPRoutesType = typeof mcpRoutes

// Re-export individual route types for specific imports
export type { MCPConfigRouteTypes } from './config-routes'
export type { MCPExecutionRouteTypes } from './execution-routes'
export type { MCPAnalyticsRouteTypes } from './analytics-routes'
export type { MCPTestRouteTypes } from './test-routes'
export type { MCPSessionRouteTypes } from './session-routes'