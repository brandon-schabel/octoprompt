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
import { useApiClient } from './use-api-client'

// Get MCP tool executions
export function useGetMCPExecutions(projectId: number | undefined, query?: MCPExecutionQuery) {
  const client = useApiClient()
  // Client null check removed - handled by React Query

  return useQuery({
    queryKey: ['mcp-executions', projectId, query],
    queryFn: async () => {
      if (!projectId) return null
      const response = await client.mcpAnalytics.getExecutions(projectId, query)
      return response.data
    },
    enabled: !!client && !!projectId
  })
}

// Get MCP analytics overview
export function useGetMCPAnalyticsOverview(projectId: number | undefined, request?: MCPAnalyticsRequest) {
  const client = useApiClient()
  // Client null check removed - handled by React Query

  return useQuery({
    queryKey: ['mcp-analytics-overview', projectId, request],
    queryFn: async () => {
      if (!projectId) return null
      const response = await client.mcpAnalytics.getOverview(projectId, request)
      return response.data
    },
    enabled: !!client && !!projectId,
    refetchInterval: 30000 // Refresh every 30 seconds
  })
}

// Get MCP tool statistics
export function useGetMCPToolStatistics(projectId: number | undefined, request?: MCPAnalyticsRequest) {
  const client = useApiClient()
  // Client null check removed - handled by React Query

  return useQuery({
    queryKey: ['mcp-tool-statistics', projectId, request],
    queryFn: async () => {
      if (!projectId) return null
      const response = await client.mcpAnalytics.getStatistics(projectId, request)
      return response.data
    },
    enabled: !!client && !!projectId
  })
}

// Get MCP execution timeline
export function useGetMCPExecutionTimeline(projectId: number | undefined, request?: MCPAnalyticsRequest) {
  const client = useApiClient()
  // Client null check removed - handled by React Query

  return useQuery({
    queryKey: ['mcp-execution-timeline', projectId, request],
    queryFn: async () => {
      if (!projectId) return null
      const response = await client.mcpAnalytics.getTimeline(projectId, request)
      return response.data
    },
    enabled: !!client && !!projectId
  })
}

// Get MCP error patterns
export function useGetMCPErrorPatterns(projectId: number | undefined, request?: MCPAnalyticsRequest) {
  const client = useApiClient()
  // Client null check removed - handled by React Query

  return useQuery({
    queryKey: ['mcp-error-patterns', projectId, request],
    queryFn: async () => {
      if (!projectId) return null
      const response = await client.mcpAnalytics.getErrorPatterns(projectId, request)
      return response.data
    },
    enabled: !!client && !!projectId
  })
}
