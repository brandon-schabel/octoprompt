import { DatabaseManager } from './database-manager'
import type { Database } from 'bun:sqlite'
import {
  type MCPToolExecution,
  type CreateMCPToolExecution,
  type UpdateMCPToolExecution,
  type MCPToolStatistics,
  type MCPExecutionQuery,
  type MCPAnalyticsRequest,
  type MCPToolSummary,
  type MCPExecutionTimeline,
  mcpToolExecutionSchema,
  mcpToolStatisticsSchema
} from '@promptliano/schemas'
import {
  toNumber,
  toString,
  ensureNumber,
  ensureString,
  fromJson,
  toJson
} from '@promptliano/shared/src/utils/sqlite-converters'
import { ApiError } from '@promptliano/shared'

export class MCPTrackingStorage {
  private db: Database
  private dbManager: DatabaseManager

  constructor() {
    this.dbManager = DatabaseManager.getInstance()
    this.db = this.dbManager.getDatabase()
  }

  // --- Tool Executions ---

  async createExecution(data: CreateMCPToolExecution): Promise<MCPToolExecution> {
    const id = this.dbManager.generateUniqueId('mcp_tool_executions_v2')
    const preliminary: Partial<MCPToolExecution> = {
      id: ensureNumber(id),
      toolName: ensureString(data.toolName),
      projectId: data.projectId ?? null,
      userId: data.userId ?? null,
      sessionId: data.sessionId ?? null,
      startedAt: ensureNumber(data.startedAt),
      completedAt: null,
      durationMs: null,
      status: data.status,
      errorMessage: null,
      errorCode: null,
      inputParams: data.inputParams ?? null,
      outputSize: null,
      metadata: data.metadata ?? null
    }

    const validation = await mcpToolExecutionSchema.safeParseAsync(preliminary)
    if (!validation.success) {
      throw new ApiError(400, 'Invalid MCP tool execution data', 'VALIDATION_ERROR')
    }
    const execution = validation.data

    const stmt = this.db.prepare(`
      INSERT INTO mcp_tool_executions_v2 (
        id, tool_name, project_id, user_id, session_id,
        started_at, completed_at, duration_ms, status,
        error_message, error_code, input_params, output_size, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      execution.id,
      execution.toolName,
      execution.projectId ?? null,
      execution.userId ?? null,
      execution.sessionId ?? null,
      execution.startedAt,
      execution.completedAt ?? null,
      execution.durationMs ?? null,
      execution.status,
      execution.errorMessage ?? null,
      execution.errorCode ?? null,
      execution.inputParams ?? null,
      execution.outputSize ?? null,
      execution.metadata ?? null
    )

    return execution
  }

  async updateExecution(id: number, data: UpdateMCPToolExecution): Promise<boolean> {
    const updates: string[] = []
    const values: any[] = []

    if (data.completedAt !== undefined) {
      updates.push('completed_at = ?')
      values.push(data.completedAt)
    }
    if (data.durationMs !== undefined) {
      updates.push('duration_ms = ?')
      values.push(data.durationMs)
    }
    if (data.status !== undefined) {
      updates.push('status = ?')
      values.push(data.status)
    }
    if (data.errorMessage !== undefined) {
      updates.push('error_message = ?')
      values.push(data.errorMessage)
    }
    if (data.errorCode !== undefined) {
      updates.push('error_code = ?')
      values.push(data.errorCode)
    }
    if (data.outputSize !== undefined) {
      updates.push('output_size = ?')
      values.push(data.outputSize)
    }
    if (data.metadata !== undefined) {
      updates.push('metadata = ?')
      values.push(data.metadata)
    }

    if (updates.length === 0) return false

    values.push(id)
    const stmt = this.db.prepare(`
      UPDATE mcp_tool_executions_v2
      SET ${updates.join(', ')}
      WHERE id = ?
    `)

    const result = stmt.run(...values)
    return result.changes > 0
  }

  async getExecution(id: number): Promise<MCPToolExecution | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM mcp_tool_executions_v2 WHERE id = ?
    `)

    const row = stmt.get(id) as any
    if (!row) return null

    return this.rowToExecution(row)
  }

  async queryExecutions(query: MCPExecutionQuery): Promise<{
    executions: MCPToolExecution[]
    total: number
  }> {
    const conditions: string[] = []
    const values: any[] = []

    if (query.projectId !== undefined) {
      conditions.push('project_id = ?')
      values.push(query.projectId)
    }
    if (query.toolName) {
      conditions.push('tool_name = ?')
      values.push(query.toolName)
    }
    if (query.status) {
      conditions.push('status = ?')
      values.push(query.status)
    }
    if (query.userId) {
      conditions.push('user_id = ?')
      values.push(query.userId)
    }
    if (query.sessionId) {
      conditions.push('session_id = ?')
      values.push(query.sessionId)
    }
    if (query.startDate !== undefined) {
      conditions.push('started_at >= ?')
      values.push(query.startDate)
    }
    if (query.endDate !== undefined) {
      conditions.push('started_at <= ?')
      values.push(query.endDate)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Get total count
    const countStmt = this.db.prepare(`
      SELECT COUNT(*) as total FROM mcp_tool_executions_v2 ${whereClause}
    `)
    const countResult = countStmt.get(...values) as { total: number }
    const total = countResult.total

    // Get paginated results
    const sortColumn =
      query.sortBy === 'duration' ? 'duration_ms' : query.sortBy === 'toolName' ? 'tool_name' : 'started_at'
    const sortOrder = query.sortOrder === 'asc' ? 'ASC' : 'DESC'

    const stmt = this.db.prepare(`
      SELECT * FROM mcp_tool_executions_v2
      ${whereClause}
      ORDER BY ${sortColumn} ${sortOrder}
      LIMIT ? OFFSET ?
    `)

    const rows = stmt.all(...values, query.limit, query.offset) as any[]
    const executions = rows.map((row) => this.rowToExecution(row))

    return { executions, total }
  }

  // --- Tool Statistics ---

  async upsertStatistics(stats: Omit<MCPToolStatistics, 'id'>): Promise<MCPToolStatistics> {
    // Try to find existing statistics entry
    const existingStmt = this.db.prepare(`
      SELECT id FROM mcp_tool_statistics
      WHERE tool_name = ? AND project_id IS ? AND period_start = ? AND period_type = ?
    `)

    const existing = existingStmt.get(stats.toolName, stats.projectId ?? null, stats.periodStart, stats.periodType) as
      | { id: number }
      | undefined

    if (existing) {
      // Update existing
      const updateStmt = this.db.prepare(`
        UPDATE mcp_tool_statistics SET
          period_end = ?, execution_count = ?, success_count = ?,
          error_count = ?, timeout_count = ?, total_duration_ms = ?,
          avg_duration_ms = ?, min_duration_ms = ?, max_duration_ms = ?,
          total_output_size = ?, metadata = ?
        WHERE id = ?
      `)

      updateStmt.run(
        stats.periodEnd,
        stats.executionCount,
        stats.successCount,
        stats.errorCount,
        stats.timeoutCount,
        stats.totalDurationMs,
        stats.avgDurationMs,
        stats.minDurationMs ?? null,
        stats.maxDurationMs ?? null,
        stats.totalOutputSize,
        stats.metadata ?? null,
        existing.id
      )

      const preliminary: Partial<MCPToolStatistics> = { ...stats, id: existing.id }
      const validation = await mcpToolStatisticsSchema.safeParseAsync(preliminary)
      if (!validation.success) {
        throw new ApiError(400, 'Invalid MCP tool statistics data', 'VALIDATION_ERROR')
      }
      return validation.data
    } else {
      // Insert new
      const id = this.dbManager.generateUniqueId('mcp_tool_statistics')
      const insertStmt = this.db.prepare(`
        INSERT INTO mcp_tool_statistics (
          id, tool_name, project_id, period_start, period_end, period_type,
          execution_count, success_count, error_count, timeout_count,
          total_duration_ms, avg_duration_ms, min_duration_ms, max_duration_ms,
          total_output_size, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      insertStmt.run(
        id,
        stats.toolName,
        stats.projectId ?? null,
        stats.periodStart,
        stats.periodEnd,
        stats.periodType,
        stats.executionCount,
        stats.successCount,
        stats.errorCount,
        stats.timeoutCount,
        stats.totalDurationMs,
        stats.avgDurationMs,
        stats.minDurationMs ?? null,
        stats.maxDurationMs ?? null,
        stats.totalOutputSize,
        stats.metadata ?? null
      )

      const preliminary: Partial<MCPToolStatistics> = { ...stats, id }
      const validation = await mcpToolStatisticsSchema.safeParseAsync(preliminary)
      if (!validation.success) {
        throw new ApiError(400, 'Invalid MCP tool statistics data', 'VALIDATION_ERROR')
      }
      return validation.data
    }
  }

  async getStatistics(request: MCPAnalyticsRequest): Promise<MCPToolStatistics[]> {
    // Build query and parameters dynamically to avoid parameter binding issues
    let query = `SELECT * FROM mcp_tool_statistics`
    
    const conditions: string[] = []
    const values: any[] = []

    if (request.projectId !== undefined) {
      conditions.push('project_id = ?')
      values.push(request.projectId)
    }
    if (request.toolNames && request.toolNames.length > 0) {
      const placeholders = request.toolNames.map(() => '?').join(',')
      conditions.push(`tool_name IN (${placeholders})`)
      values.push(...request.toolNames)
    }
    if (request.period) {
      conditions.push('period_type = ?')
      values.push(request.period)
    }
    if (request.startDate !== undefined) {
      conditions.push('period_start >= ?')
      values.push(request.startDate)
    }
    if (request.endDate !== undefined) {
      conditions.push('period_end <= ?')
      values.push(request.endDate)
    }

    // Add WHERE clause if there are conditions
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`
    }

    // Add ORDER BY
    query += ` ORDER BY period_start DESC`

    const stmt = this.db.prepare(query)
    const rows = stmt.all(...values) as any[]
    return rows.map((row) => this.rowToStatistics(row))
  }

  // --- Analytics Aggregations ---

  async getToolSummaries(projectId?: number, limit: number = 10): Promise<MCPToolSummary[]> {
    // Build query and parameters dynamically to avoid parameter binding issues
    let query = `
      SELECT 
        tool_name,
        COUNT(*) as total_executions,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count,
        SUM(CASE WHEN status = 'timeout' THEN 1 ELSE 0 END) as timeout_count,
        COALESCE(AVG(duration_ms), 0) as avg_duration_ms,
        MIN(duration_ms) as min_duration_ms,
        MAX(duration_ms) as max_duration_ms,
        COALESCE(SUM(output_size), 0) as total_output_size,
        MAX(completed_at) as last_executed_at
      FROM mcp_tool_executions_v2`
    
    const values: any[] = []
    
    // Add WHERE clause if projectId is provided
    if (projectId !== undefined) {
      query += ' WHERE project_id = ?'
      values.push(projectId)
    }
    
    // Add GROUP BY, ORDER BY, and LIMIT
    query += `
      GROUP BY tool_name
      ORDER BY total_executions DESC
      LIMIT ?`
    
    values.push(limit)

    const stmt = this.db.prepare(query)
    const rows = stmt.all(...values) as any[]

    return rows.map((row) => ({
      toolName: row.tool_name,
      totalExecutions: row.total_executions,
      successRate: row.total_executions > 0 ? row.success_count / row.total_executions : 0,
      errorRate: row.total_executions > 0 ? row.error_count / row.total_executions : 0,
      timeoutRate: row.total_executions > 0 ? row.timeout_count / row.total_executions : 0,
      avgDurationMs: row.avg_duration_ms || 0,
      minDurationMs: row.min_duration_ms,
      maxDurationMs: row.max_duration_ms,
      totalOutputSize: row.total_output_size || 0,
      lastExecutedAt: row.last_executed_at
    }))
  }

  async getExecutionTimeline(
    projectId?: number,
    period: 'hour' | 'day' | 'week' | 'month' = 'day',
    startDate?: number,
    endDate?: number
  ): Promise<MCPExecutionTimeline[]> {
    // Calculate time bucket based on period
    const bucketSize = {
      hour: 3600000, // 1 hour in ms
      day: 86400000, // 1 day in ms
      week: 604800000, // 1 week in ms
      month: 2592000000 // 30 days in ms
    }[period]

    // Build query and parameters dynamically to avoid parameter binding issues
    let query = `
      SELECT 
        (started_at / ?) * ? as time_bucket,
        tool_name,
        COUNT(*) as count,
        COALESCE(AVG(duration_ms), 0) as avg_duration,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count
      FROM mcp_tool_executions_v2`

    const conditions: string[] = []
    const values: any[] = []

    // Add bucket size parameters first (for the SELECT clause placeholders)
    values.push(bucketSize, bucketSize)

    if (projectId !== undefined) {
      conditions.push('project_id = ?')
      values.push(projectId)
    }
    if (startDate !== undefined) {
      conditions.push('started_at >= ?')
      values.push(startDate)
    }
    if (endDate !== undefined) {
      conditions.push('started_at <= ?')
      values.push(endDate)
    }

    // Add WHERE clause if there are conditions
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`
    }

    // Add GROUP BY and ORDER BY
    query += `
      GROUP BY time_bucket, tool_name
      ORDER BY time_bucket DESC`

    const stmt = this.db.prepare(query)
    const rows = stmt.all(...values) as any[]

    // Group by time bucket
    const timelineMap = new Map<number, MCPExecutionTimeline>()

    for (const row of rows) {
      const timestamp = row.time_bucket

      if (!timelineMap.has(timestamp)) {
        timelineMap.set(timestamp, {
          timestamp,
          toolCounts: {},
          totalCount: 0,
          avgDuration: 0,
          successCount: 0,
          errorCount: 0
        })
      }

      const timeline = timelineMap.get(timestamp)!
      timeline.toolCounts[row.tool_name] = row.count
      timeline.totalCount += row.count
      timeline.successCount += row.success_count
      timeline.errorCount += row.error_count

      // Update average duration (weighted average)
      const currentTotal = timeline.totalCount - row.count
      timeline.avgDuration =
        currentTotal > 0
          ? (timeline.avgDuration * currentTotal + row.avg_duration * row.count) / timeline.totalCount
          : row.avg_duration
    }

    return Array.from(timelineMap.values()).sort((a, b) => b.timestamp - a.timestamp)
  }

  // --- Utility Methods ---

  private rowToExecution(row: any): MCPToolExecution {
    const preliminary: Partial<MCPToolExecution> = {
      id: toNumber(row.id),
      toolName: toString(row.tool_name),
      projectId: row.project_id,
      userId: row.user_id,
      sessionId: row.session_id,
      startedAt: toNumber(row.started_at),
      completedAt: row.completed_at ?? null,
      durationMs: row.duration_ms ?? null,
      status: row.status,
      errorMessage: row.error_message ?? null,
      errorCode: row.error_code ?? null,
      inputParams: row.input_params ?? null,
      outputSize: row.output_size ?? null,
      metadata: row.metadata ?? null
    }
    const parsed = mcpToolExecutionSchema.safeParse(preliminary)
    if (!parsed.success) {
      throw new ApiError(500, 'Failed to parse MCP tool execution row', 'DB_PARSE_ERROR')
    }
    return parsed.data
  }

  private rowToStatistics(row: any): MCPToolStatistics {
    const preliminary: Partial<MCPToolStatistics> = {
      id: toNumber(row.id),
      toolName: toString(row.tool_name),
      projectId: row.project_id,
      periodStart: toNumber(row.period_start),
      periodEnd: toNumber(row.period_end),
      periodType: row.period_type,
      executionCount: toNumber(row.execution_count),
      successCount: toNumber(row.success_count),
      errorCount: toNumber(row.error_count),
      timeoutCount: toNumber(row.timeout_count),
      totalDurationMs: toNumber(row.total_duration_ms),
      avgDurationMs: toNumber(row.avg_duration_ms),
      minDurationMs: row.min_duration_ms ?? null,
      maxDurationMs: row.max_duration_ms ?? null,
      totalOutputSize: toNumber(row.total_output_size),
      metadata: row.metadata ?? null
    }
    const parsed = mcpToolStatisticsSchema.safeParse(preliminary)
    if (!parsed.success) {
      throw new ApiError(500, 'Failed to parse MCP tool statistics row', 'DB_PARSE_ERROR')
    }
    return parsed.data
  }

  // --- Chain Tracking ---

  async createChain(
    chainId: string,
    executionId: number,
    parentExecutionId?: number,
    position: number = 0
  ): Promise<void> {
    const id = this.dbManager.generateUniqueId('mcp_tool_chains')
    const stmt = this.db.prepare(`
      INSERT INTO mcp_tool_chains (id, chain_id, execution_id, parent_execution_id, position, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    stmt.run(id, chainId, executionId, parentExecutionId ?? null, position, Date.now())
  }

  async getChainExecutions(chainId: string): Promise<MCPToolExecution[]> {
    const stmt = this.db.prepare(`
      SELECT e.* FROM mcp_tool_executions_v2 e
      JOIN mcp_tool_chains c ON e.id = c.execution_id
      WHERE c.chain_id = ?
      ORDER BY c.position
    `)

    const rows = stmt.all(chainId) as any[]
    return rows.map((row) => this.rowToExecution(row))
  }

  // --- Pattern Analysis ---

  async recordPattern(
    projectId: number | null,
    patternType: 'sequence' | 'frequency' | 'error',
    patternData: any
  ): Promise<void> {
    const patternKey = JSON.stringify(patternData)

    // Check if pattern exists
    const existingStmt = this.db.prepare(`
      SELECT id, occurrence_count FROM mcp_tool_patterns
      WHERE project_id IS ? AND pattern_type = ? AND pattern_data = ?
    `)

    const existing = existingStmt.get(projectId, patternType, patternKey) as
      | { id: number; occurrence_count: number }
      | undefined

    if (existing) {
      // Update existing pattern
      const updateStmt = this.db.prepare(`
        UPDATE mcp_tool_patterns
        SET occurrence_count = ?, last_seen = ?
        WHERE id = ?
      `)
      updateStmt.run(existing.occurrence_count + 1, Date.now(), existing.id)
    } else {
      // Create new pattern
      const id = this.dbManager.generateUniqueId('mcp_tool_patterns')
      const insertStmt = this.db.prepare(`
        INSERT INTO mcp_tool_patterns (
          id, project_id, pattern_type, pattern_data,
          occurrence_count, first_seen, last_seen
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `)

      const now = Date.now()
      insertStmt.run(id, projectId, patternType, patternKey, 1, now, now)
    }
  }

  async getTopPatterns(
    projectId?: number,
    patternType?: 'sequence' | 'frequency' | 'error',
    limit: number = 10
  ): Promise<Array<{ pattern: any; count: number; lastSeen: number }>> {
    // Build query and parameters dynamically to avoid parameter binding issues
    let query = `
      SELECT pattern_data, occurrence_count, last_seen
      FROM mcp_tool_patterns`
    
    const conditions: string[] = []
    const values: any[] = []

    if (projectId !== undefined) {
      conditions.push('project_id = ?')
      values.push(projectId)
    }
    if (patternType) {
      conditions.push('pattern_type = ?')
      values.push(patternType)
    }

    // Add WHERE clause if there are conditions
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`
    }

    // Add ORDER BY and LIMIT
    query += `
      ORDER BY occurrence_count DESC
      LIMIT ?`
    
    values.push(limit)

    const stmt = this.db.prepare(query)
    const rows = stmt.all(...values) as any[]

    return rows.map((row) => ({
      pattern: JSON.parse(row.pattern_data),
      count: row.occurrence_count,
      lastSeen: row.last_seen
    }))
  }
}

// Export singleton instance
export const mcpTrackingStorage = new MCPTrackingStorage()
