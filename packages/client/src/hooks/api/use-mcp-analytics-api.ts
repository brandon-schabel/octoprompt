import { useQuery } from '@tanstack/react-query'
import type {
  MCPExecutionQuery,
  MCPAnalyticsRequest,
  MCPAnalyticsOverview,
  MCPToolExecution,
  MCPToolStatistics,
  MCPExecutionTimeline,
  MCPToolPattern
} from '@promptliano/schemas'
import { promptlianoClient } from '../promptliano-client'

// Get MCP tool executions
export function useGetMCPExecutions(projectId: number | undefined, query?: MCPExecutionQuery) {
  return useQuery({
    queryKey: ['mcp-executions', projectId, query],
    queryFn: async () => {
      if (!projectId) return null
      const response = await promptlianoClient.mcpAnalytics.getExecutions(projectId, query)
      return response.data
    },
    enabled: !!projectId
  })
}

// Get MCP analytics overview
export function useGetMCPAnalyticsOverview(projectId: number | undefined, request?: MCPAnalyticsRequest) {
  return useQuery({
    queryKey: ['mcp-analytics-overview', projectId, request],
    queryFn: async () => {
      if (!projectId) return null
      const response = await promptlianoClient.mcpAnalytics.getOverview(projectId, request)
      return response.data
    },
    enabled: !!projectId,
    refetchInterval: 30000 // Refresh every 30 seconds
  })
}

// Get MCP tool statistics
export function useGetMCPToolStatistics(projectId: number | undefined, request?: MCPAnalyticsRequest) {
  return useQuery({
    queryKey: ['mcp-tool-statistics', projectId, request],
    queryFn: async () => {
      if (!projectId) return null
      const response = await promptlianoClient.mcpAnalytics.getStatistics(projectId, request)
      return response.data
    },
    enabled: !!projectId
  })
}

// Get MCP execution timeline
export function useGetMCPExecutionTimeline(projectId: number | undefined, request?: MCPAnalyticsRequest) {
  return useQuery({
    queryKey: ['mcp-execution-timeline', projectId, request],
    queryFn: async () => {
      if (!projectId) return null
      const response = await promptlianoClient.mcpAnalytics.getTimeline(projectId, request)
      return response.data
    },
    enabled: !!projectId
  })
}

// Get MCP error patterns
export function useGetMCPErrorPatterns(projectId: number | undefined, request?: MCPAnalyticsRequest) {
  return useQuery({
    queryKey: ['mcp-error-patterns', projectId, request],
    queryFn: async () => {
      if (!projectId) return null
      const response = await promptlianoClient.mcpAnalytics.getErrorPatterns(projectId, request)
      return response.data
    },
    enabled: !!projectId
  })
}
