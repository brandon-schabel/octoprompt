import { BaseApiClient } from '../base-client'
import type { 
  MCPAnalyticsOverview,
  MCPAnalyticsRequest,
  MCPExecutionQuery,
  MCPExecutionTimeline,
  MCPToolStatistics,
  MCPToolPattern,
  MCPToolExecution,
  MCPExecutionListResponse,
  DataResponseSchema
} from '../types'

/**
 * MCP Analytics API client for analytics and statistics operations
 */
export class MCPAnalyticsClient extends BaseApiClient {
  
  /**
   * Get MCP analytics overview for a project
   */
  async getOverview(projectId: number, request?: MCPAnalyticsRequest): Promise<DataResponseSchema<MCPAnalyticsOverview>> {
    const params: Record<string, any> = {}
    
    if (request?.period) {
      params.period = request.period
    }
    if (request?.toolNames?.length) {
      params.toolNames = request.toolNames.join(',')
    }
    
    const result = await this.request('GET', `/projects/${projectId}/mcp/analytics/overview`, {
      params
    })
    return result as DataResponseSchema<MCPAnalyticsOverview>
  }

  /**
   * Get MCP tool usage statistics
   */
  async getStatistics(projectId: number, request?: MCPAnalyticsRequest): Promise<DataResponseSchema<MCPToolStatistics[]>> {
    const params: Record<string, any> = {}
    
    if (request?.period) {
      params.period = request.period
    }
    if (request?.toolNames?.length) {
      params.toolNames = request.toolNames.join(',')
    }
    
    const result = await this.request('GET', `/projects/${projectId}/mcp/analytics/statistics`, {
      params
    })
    return result as DataResponseSchema<MCPToolStatistics[]>
  }

  /**
   * Get MCP execution timeline
   */
  async getTimeline(projectId: number, request?: MCPAnalyticsRequest): Promise<DataResponseSchema<MCPExecutionTimeline[]>> {
    const params: Record<string, any> = {}
    
    if (request?.period) {
      params.period = request.period
    }
    if (request?.toolNames?.length) {
      params.toolNames = request.toolNames.join(',')
    }
    
    const result = await this.request('GET', `/projects/${projectId}/mcp/analytics/timeline`, {
      params
    })
    return result as DataResponseSchema<MCPExecutionTimeline[]>
  }

  /**
   * Get MCP error patterns
   */
  async getErrorPatterns(projectId: number, request?: MCPAnalyticsRequest): Promise<DataResponseSchema<MCPToolPattern[]>> {
    const params: Record<string, any> = {}
    
    if (request?.period) {
      params.period = request.period
    }
    if (request?.toolNames?.length) {
      params.toolNames = request.toolNames.join(',')
    }
    
    const result = await this.request('GET', `/projects/${projectId}/mcp/analytics/error-patterns`, {
      params
    })
    return result as DataResponseSchema<MCPToolPattern[]>
  }

  /**
   * Get MCP tool executions
   */
  async getExecutions(projectId: number, query?: MCPExecutionQuery): Promise<DataResponseSchema<MCPExecutionListResponse>> {
    const params: Record<string, any> = {}
    
    if (query?.toolName) {
      params.toolName = query.toolName
    }
    if (query?.status) {
      params.status = query.status
    }
    if (query?.startDate) {
      params.startDate = query.startDate
    }
    if (query?.endDate) {
      params.endDate = query.endDate
    }
    if (query?.limit) {
      params.limit = query.limit
    }
    if (query?.offset) {
      params.offset = query.offset
    }
    
    const result = await this.request('GET', `/projects/${projectId}/mcp/analytics/executions`, {
      params
    })
    return result as DataResponseSchema<MCPExecutionListResponse>
  }
}