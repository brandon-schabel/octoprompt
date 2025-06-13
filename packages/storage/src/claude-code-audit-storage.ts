import { BaseStorage } from './utils/base-storage'
import { type ClaudeCodeAuditLog, ClaudeCodeAuditLogSchema } from '@octoprompt/schemas'
import { z } from 'zod'

const CLAUDE_CODE_AUDIT_FILE = 'claude-code-audit.json'

// Define the schema for the storage structure
const ClaudeCodeAuditStorageSchema = z.record(z.coerce.number(), ClaudeCodeAuditLogSchema)
type ClaudeCodeAuditStorage = z.infer<typeof ClaudeCodeAuditStorageSchema>

class ClaudeCodeAuditStorageClass extends BaseStorage<ClaudeCodeAuditStorage> {
  protected getFilePath(): string {
    return this.buildPath(CLAUDE_CODE_AUDIT_FILE)
  }

  protected getDefaultData(): ClaudeCodeAuditStorage {
    return {}
  }

  protected getSchema() {
    return ClaudeCodeAuditStorageSchema
  }

  async createAuditLog(log: Omit<ClaudeCodeAuditLog, 'id'>): Promise<ClaudeCodeAuditLog> {
    const data = await this.read()
    const id = this.generateId()
    const newLog: ClaudeCodeAuditLog = { ...log, id }

    data[id] = newLog
    await this.write(data)

    return newLog
  }

  async getAuditLog(id: number): Promise<ClaudeCodeAuditLog | null> {
    const data = await this.read()
    return data[id] || null
  }

  async getAuditLogsBySession(sessionId: string): Promise<ClaudeCodeAuditLog[]> {
    const data = await this.read()
    return Object.values(data).filter((log) => log.sessionId === sessionId)
  }

  async getAuditLogsByProject(projectId: number): Promise<ClaudeCodeAuditLog[]> {
    const data = await this.read()
    return Object.values(data).filter((log) => log.projectId === projectId)
  }

  async getAuditLogsInRange(startTime: number, endTime: number): Promise<ClaudeCodeAuditLog[]> {
    const data = await this.read()
    return Object.values(data).filter((log) => log.timestamp >= startTime && log.timestamp <= endTime)
  }

  async queryAuditLogs(filters: {
    sessionId?: string
    projectId?: number
    startTime?: number
    endTime?: number
    action?: ClaudeCodeAuditLog['action']
    limit?: number
    offset?: number
  }): Promise<ClaudeCodeAuditLog[]> {
    const data = await this.read()
    let logs = Object.values(data)

    // Apply filters
    if (filters.sessionId) {
      logs = logs.filter((log) => log.sessionId === filters.sessionId)
    }
    if (filters.projectId !== undefined) {
      logs = logs.filter((log) => log.projectId === filters.projectId)
    }
    if (filters.startTime !== undefined && filters.endTime !== undefined) {
      logs = logs.filter((log) => log.timestamp >= filters.startTime! && log.timestamp <= filters.endTime!)
    }
    if (filters.action) {
      logs = logs.filter((log) => log.action === filters.action)
    }

    // Sort by timestamp descending
    logs.sort((a, b) => b.timestamp - a.timestamp)

    // Apply pagination
    const offset = filters.offset || 0
    const limit = filters.limit || 100
    return logs.slice(offset, offset + limit)
  }

  async getAuditLogSummary(sessionId: string): Promise<{
    totalActions: number
    fileChanges: { created: number; modified: number; deleted: number }
    commandsExecuted: number
    startTime: number | null
    endTime: number | null
  }> {
    const logs = await this.getAuditLogsBySession(sessionId)

    const summary = {
      totalActions: logs.length,
      fileChanges: { created: 0, modified: 0, deleted: 0 },
      commandsExecuted: 0,
      startTime: logs.length > 0 ? Math.min(...logs.map((l) => l.timestamp)) : null,
      endTime: logs.length > 0 ? Math.max(...logs.map((l) => l.timestamp)) : null
    }

    for (const log of logs) {
      switch (log.action) {
        case 'file_created':
          summary.fileChanges.created++
          break
        case 'file_modified':
          summary.fileChanges.modified++
          break
        case 'file_deleted':
          summary.fileChanges.deleted++
          break
        case 'command_executed':
          summary.commandsExecuted++
          break
      }
    }

    return summary
  }

  async cleanupOldAuditLogs(daysToKeep: number): Promise<number> {
    const data = await this.read()
    const cutoffTime = Date.now() - daysToKeep * 24 * 60 * 60 * 1000

    const idsToDelete = Object.keys(data)
      .map((id) => parseInt(id))
      .filter((id) => data[id].timestamp < cutoffTime)

    for (const id of idsToDelete) {
      delete data[id]
    }

    await this.write(data)
    return idsToDelete.length
  }
}

export const claudeCodeAuditStorage = new ClaudeCodeAuditStorageClass()
