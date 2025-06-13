import {
  claudeCodeAuditStorage,
  type ClaudeCodeAuditLog,
  type GetAuditLogsQuery,
  type AuditLogSummary
} from '@octoprompt/storage'
import { ApiError } from '@octoprompt/shared'
import { type SDKMessage } from '@anthropic-ai/claude-code'

export interface ClaudeCodeAuditService {
  logSessionStart(sessionId: string, projectId: number): Promise<void>
  logSessionComplete(sessionId: string, projectId: number): Promise<void>
  logFileChange(
    sessionId: string,
    projectId: number,
    action: 'created' | 'modified' | 'deleted',
    filePath: string
  ): Promise<void>
  logCommandExecution(
    sessionId: string,
    projectId: number,
    command: string,
    exitCode?: number,
    error?: string
  ): Promise<void>
  parseAndLogMessages(sessionId: string, projectId: number, messages: SDKMessage[]): Promise<void>
  getAuditLogs(query: GetAuditLogsQuery): Promise<ClaudeCodeAuditLog[]>
  getSessionSummary(sessionId: string): Promise<AuditLogSummary>
  cleanupOldLogs(daysToKeep?: number): Promise<number>
}

export function createClaudeCodeAuditService(): ClaudeCodeAuditService {
  async function logSessionStart(sessionId: string, projectId: number): Promise<void> {
    await claudeCodeAuditStorage.createAuditLog({
      sessionId,
      projectId,
      timestamp: Date.now(),
      action: 'session_started',
      details: {}
    })
  }

  async function logSessionComplete(sessionId: string, projectId: number): Promise<void> {
    await claudeCodeAuditStorage.createAuditLog({
      sessionId,
      projectId,
      timestamp: Date.now(),
      action: 'session_completed',
      details: {}
    })
  }

  async function logFileChange(
    sessionId: string,
    projectId: number,
    action: 'created' | 'modified' | 'deleted',
    filePath: string
  ): Promise<void> {
    await claudeCodeAuditStorage.createAuditLog({
      sessionId,
      projectId,
      timestamp: Date.now(),
      action: `file_${action}` as const,
      details: { filePath }
    })
  }

  async function logCommandExecution(
    sessionId: string,
    projectId: number,
    command: string,
    exitCode?: number,
    error?: string
  ): Promise<void> {
    await claudeCodeAuditStorage.createAuditLog({
      sessionId,
      projectId,
      timestamp: Date.now(),
      action: 'command_executed',
      details: { command, exitCode, error }
    })
  }

  /**
   * Parse Claude Code messages and extract audit events
   */
  async function parseAndLogMessages(sessionId: string, projectId: number, messages: SDKMessage[]): Promise<void> {
    for (const message of messages) {
      // Look for tool use messages that indicate file or command operations
      if (message.type === 'assistant' && message.message?.content) {
        const content = message.message.content

        // Check if content is an array of content blocks
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'tool_use') {
              await parseToolUse(sessionId, projectId, block)
            }
          }
        }
      }
    }
  }

  async function parseToolUse(sessionId: string, projectId: number, toolUse: any): Promise<void> {
    const { name, input } = toolUse

    switch (name) {
      case 'Write':
      case 'Edit':
      case 'MultiEdit':
        if (input?.file_path) {
          const action = name === 'Write' ? 'created' : 'modified'
          await logFileChange(sessionId, projectId, action, input.file_path)
        }
        break

      case 'Bash':
        if (input?.command) {
          await logCommandExecution(sessionId, projectId, input.command)
        }
        break

      // Add more tool parsers as needed
    }
  }

  async function getAuditLogs(query: GetAuditLogsQuery): Promise<ClaudeCodeAuditLog[]> {
    return claudeCodeAuditStorage.queryAuditLogs(query)
  }

  async function getSessionSummary(sessionId: string): Promise<AuditLogSummary> {
    const summary = await claudeCodeAuditStorage.getAuditLogSummary(sessionId)
    const logs = await claudeCodeAuditStorage.getAuditLogsBySession(sessionId)

    if (logs.length === 0) {
      throw new ApiError(404, 'No audit logs found for session', 'SESSION_NOT_FOUND')
    }

    const projectId = logs[0].projectId

    return {
      sessionId,
      projectId,
      totalActions: summary.totalActions,
      fileChanges: summary.fileChanges,
      commandsExecuted: summary.commandsExecuted,
      duration: summary.endTime && summary.startTime ? summary.endTime - summary.startTime : 0,
      startTime: summary.startTime || 0,
      endTime: summary.endTime || 0
    }
  }

  async function cleanupOldLogs(daysToKeep: number = 30): Promise<number> {
    return claudeCodeAuditStorage.cleanupOldAuditLogs(daysToKeep)
  }

  return {
    logSessionStart,
    logSessionComplete,
    logFileChange,
    logCommandExecution,
    parseAndLogMessages,
    getAuditLogs,
    getSessionSummary,
    cleanupOldLogs
  }
}

export const claudeCodeAuditService = createClaudeCodeAuditService()
