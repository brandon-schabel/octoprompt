import { z } from 'zod'
import * as path from 'node:path'
import {
  ClaudeCodeSessionSchema,
  ClaudeCodeMessageSchema,
  type ClaudeCodeSession,
  type ClaudeCodeMessage
} from '@octoprompt/schemas'
import { BaseStorageString, type StorageOptions } from './core/base-storage-string'

// Storage schemas
export const ClaudeCodeSessionsStorageSchema = z.record(z.string(), ClaudeCodeSessionSchema)
export const ClaudeCodeMessagesStorageSchema = z.record(z.string(), ClaudeCodeMessageSchema)
export type ClaudeCodeSessionsStorage = z.infer<typeof ClaudeCodeSessionsStorageSchema>
export type ClaudeCodeMessagesStorage = z.infer<typeof ClaudeCodeMessagesStorageSchema>

/**
 * Enhanced Claude Code storage with session management and message search
 */
export class ClaudeCodeStorage extends BaseStorageString<ClaudeCodeSession, ClaudeCodeSessionsStorage> {
  private messageStorages: Map<string, ClaudeCodeMessageStorage> = new Map()

  constructor(options: StorageOptions = {}) {
    const dataDir = path.join('data', 'claude_code_storage')
    super(ClaudeCodeSessionsStorageSchema, ClaudeCodeSessionSchema, dataDir, options)
  }

  protected getIndexPath(): string {
    return path.join(this.basePath, this.dataDir, 'sessions.json')
  }

  protected getEntityPath(id: string): string | null {
    return path.join(this.basePath, this.dataDir, 'messages', `${id}.json`)
  }


  public async create(data: Omit<ClaudeCodeSession, 'id' | 'created' | 'updated'>): Promise<ClaudeCodeSession> {
    return super.create(data)
  }


  // Override delete to clean up message storage
  public async delete(id: string): Promise<boolean> {
    const result = await super.delete(id)
    if (result) {
      // Also delete message storage
      this.messageStorages.delete(id)
    }
    return result
  }

  // --- Session Management ---

  /**
   * Create a new session
   */
  public async createSession(data: Omit<ClaudeCodeSession, 'id' | 'created' | 'updated'>): Promise<ClaudeCodeSession> {
    return this.create(data)
  }

  /**
   * Get session by project path
   */
  public async getByProject(projectId: number): Promise<ClaudeCodeSession[]> {
    const projectPath = projectId.toString()
    const all = await this.list()
    return all
      .filter(session => session.projectPath === projectPath)
      .sort((a, b) => b.lastActivity - a.lastActivity)
  }

  /**
   * Get sessions by status
   */
  public async getByStatus(status: string): Promise<ClaudeCodeSession[]> {
    const all = await this.list()
    return all
      .filter(session => session.status === status)
      .sort((a, b) => b.lastActivity - a.lastActivity)
  }

  /**
   * Get recent sessions
   */
  public async getRecent(limit: number = 10): Promise<ClaudeCodeSession[]> {
    const sessions = await this.list()
    return sessions.sort((a, b) => b.lastActivity - a.lastActivity).slice(0, limit)
  }

  /**
   * Get active sessions
   */
  public async getActive(): Promise<ClaudeCodeSession[]> {
    return this.getByStatus('active')
  }

  /**
   * Search sessions by title or project path
   */
  public async searchByTitle(query: string): Promise<ClaudeCodeSession[]> {
    const sessions = await this.list()
    const searchTerm = query.toLowerCase()

    return sessions
      .filter(
        (session) =>
          (session.projectPath && session.projectPath.toLowerCase().includes(searchTerm)) ||
          (session.id && session.id.toLowerCase().includes(searchTerm))
      )
      .sort((a, b) => b.lastActivity - a.lastActivity)
  }

  /**
   * Update session activity
   */
  public async updateActivity(sessionId: string): Promise<void> {
    await this.update(sessionId, {
      lastActivity: Date.now(),
      status: 'active'
    })
  }

  // --- Message Management ---

  /**
   * Get message storage for a session
   */
  public getMessageStorage(sessionId: string): ClaudeCodeMessageStorage {
    if (!this.messageStorages.has(sessionId)) {
      this.messageStorages.set(
        sessionId,
        new ClaudeCodeMessageStorage(sessionId, this.basePath, this.dataDir, this.options)
      )
    }
    return this.messageStorages.get(sessionId)!
  }

  /**
   * Add message to session
   */
  public async addMessage(
    sessionId: string,
    messageData: Omit<ClaudeCodeMessage, 'id' | 'created'>
  ): Promise<ClaudeCodeMessage> {
    const messageStorage = this.getMessageStorage(sessionId)
    const message = await messageStorage.create(messageData)

    // Update session activity
    await this.updateActivity(sessionId)

    return message
  }

  /**
   * Get messages for session
   */
  public async getMessages(sessionId: string): Promise<ClaudeCodeMessage[]> {
    const messageStorage = this.getMessageStorage(sessionId)
    return messageStorage.list()
  }

  /**
   * Search messages across all sessions
   */
  public async searchMessages(query: string, sessionId?: string): Promise<ClaudeCodeMessage[]> {
    if (sessionId) {
      const messageStorage = this.getMessageStorage(sessionId)
      return messageStorage.search(query)
    }

    // Search across all sessions
    const sessions = await this.list()
    const allMessages: ClaudeCodeMessage[] = []

    for (const session of sessions) {
      const messageStorage = this.getMessageStorage(session.id)
      const sessionMessages = await messageStorage.search(query)
      allMessages.push(...sessionMessages)
    }

    return allMessages.sort((a, b) => b.updated - a.updated)
  }

  // --- Legacy API Compatibility ---

  /**
   * Get all Claude Code sessions (legacy API)
   */
  public async getAllClaudeCodeSessions(): Promise<ClaudeCodeSession[]> {
    return this.list()
  }

  /**
   * Get Claude Code session messages (legacy API)
   */
  public async getClaudeCodeSessionMessages(sessionId: string): Promise<ClaudeCodeMessage[]> {
    return this.getMessages(sessionId)
  }

  /**
   * Get all sessions
   */
  public async getAllSessions(): Promise<ClaudeCodeSession[]> {
    return this.list()
  }

}

/**
 * Message storage for Claude Code sessions
 */
export class ClaudeCodeMessageStorage extends BaseStorageString<ClaudeCodeMessage, ClaudeCodeMessagesStorage> {
  private sessionId: string

  constructor(sessionId: string, basePath: string, dataDir: string, options: StorageOptions = {}) {
    const messageDataDir = path.join(dataDir, 'messages')
    super(ClaudeCodeMessagesStorageSchema, ClaudeCodeMessageSchema, messageDataDir, { ...options, basePath })

    this.sessionId = sessionId
  }

  protected getIndexPath(): string {
    return path.join(this.basePath, this.dataDir, `${this.sessionId}.json`)
  }

  protected getEntityPath(id: string): string | null {
    // Messages don't have separate entity paths
    return null
  }


  // Override create to handle timestamps
  public async create(data: Omit<ClaudeCodeMessage, 'id' | 'created' | 'updated'>): Promise<ClaudeCodeMessage> {
    const now = Date.now()
    return super.create({
      ...data,
      session_id: data.session_id || this.sessionId,
      timestamp: data.timestamp || now
    })
  }

  /**
   * Search messages by content
   */
  public async search(query: string): Promise<ClaudeCodeMessage[]> {
    const all = await this.list()
    const lowercaseQuery = query.toLowerCase()
    return all
      .filter(msg => msg.content.toLowerCase().includes(lowercaseQuery))
      .sort((a, b) => b.updated - a.updated)
  }

  /**
   * Get messages by type
   */
  public async getByType(type: string): Promise<ClaudeCodeMessage[]> {
    const all = await this.list()
    return all
      .filter(msg => msg.type === type)
      .sort((a, b) => a.updated - b.updated)
  }

}

// Create singleton instance
const claudeCodeStorageInstance = new ClaudeCodeStorage()

// Types for audit logging
export interface ClaudeCodeAuditLog {
  id: string
  sessionId: string
  projectId: number
  timestamp: number
  action:
    | 'session_started'
    | 'session_completed'
    | 'file_created'
    | 'file_modified'
    | 'file_deleted'
    | 'command_executed'
  details: Record<string, any>
  created: number
}

export interface GetAuditLogsQuery {
  sessionId?: string
  projectId?: number
  startTime?: number
  endTime?: number
  action?: string
  limit?: number
  offset?: number
}

export interface AuditLogSummary {
  sessionId: string
  projectId: number
  totalActions: number
  fileChanges: number
  commandsExecuted: number
  duration: number
  startTime: number
  endTime: number
}

// Audit storage for Claude Code
export const claudeCodeAuditStorage = {
  auditLogs: new Map<string, ClaudeCodeAuditLog>(),

  async createAuditLog(data: Omit<ClaudeCodeAuditLog, 'id' | 'created'>): Promise<ClaudeCodeAuditLog> {
    const id = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const auditLog: ClaudeCodeAuditLog = {
      ...data,
      id,
      created: Date.now()
    }
    this.auditLogs.set(id, auditLog)
    return auditLog
  },

  async queryAuditLogs(query: GetAuditLogsQuery): Promise<ClaudeCodeAuditLog[]> {
    let logs = Array.from(this.auditLogs.values())

    if (query.sessionId) {
      logs = logs.filter((log) => log.sessionId === query.sessionId)
    }
    if (query.projectId) {
      logs = logs.filter((log) => log.projectId === query.projectId)
    }
    if (query.startTime) {
      logs = logs.filter((log) => log.timestamp >= query.startTime)
    }
    if (query.endTime) {
      logs = logs.filter((log) => log.timestamp <= query.endTime)
    }
    if (query.action) {
      logs = logs.filter((log) => log.action === query.action)
    }

    // Sort by timestamp descending
    logs.sort((a, b) => b.timestamp - a.timestamp)

    // Apply pagination
    const offset = query.offset || 0
    const limit = query.limit || 100
    return logs.slice(offset, offset + limit)
  },

  async getAuditLogsBySession(sessionId: string): Promise<ClaudeCodeAuditLog[]> {
    return this.queryAuditLogs({ sessionId })
  },

  async getAuditLogSummary(sessionId: string): Promise<Partial<AuditLogSummary>> {
    const logs = await this.getAuditLogsBySession(sessionId)

    const summary: Partial<AuditLogSummary> = {
      totalActions: logs.length,
      fileChanges: 0,
      commandsExecuted: 0,
      startTime: 0,
      endTime: 0
    }

    for (const log of logs) {
      if (log.action === 'session_started') {
        summary.startTime = log.timestamp
      }
      if (log.action === 'session_completed') {
        summary.endTime = log.timestamp
      }
      if (log.action.startsWith('file_')) {
        summary.fileChanges = (summary.fileChanges || 0) + 1
      }
      if (log.action === 'command_executed') {
        summary.commandsExecuted = (summary.commandsExecuted || 0) + 1
      }
    }

    return summary
  },

  async cleanupOldAuditLogs(daysToKeep: number): Promise<number> {
    const cutoffTime = Date.now() - daysToKeep * 24 * 60 * 60 * 1000
    let deletedCount = 0

    for (const [id, log] of this.auditLogs.entries()) {
      if (log.timestamp < cutoffTime) {
        this.auditLogs.delete(id)
        deletedCount++
      }
    }

    return deletedCount
  }
}

/**
 * Compatibility wrapper for the old claudeCodeStorage API using ClaudeCodeStorage
 * This maintains backward compatibility while leveraging the enhanced storage
 */
export const claudeCodeStorage = {
  // Session methods
  async readSessions(): Promise<Record<string, ClaudeCodeSession>> {
    const sessionsList = await claudeCodeStorageInstance.list()
    const sessionsObject: Record<string, ClaudeCodeSession> = {}

    for (const session of sessionsList) {
      sessionsObject[session.id] = session
    }

    return sessionsObject
  },

  async writeSessions(sessions: Record<string, ClaudeCodeSession>): Promise<Record<string, ClaudeCodeSession>> {
    // Convert object to Map for storage
    const sessionsMap: Record<string, ClaudeCodeSession> = {}

    for (const [id, session] of Object.entries(sessions)) {
      sessionsMap[id] = session
    }

    await claudeCodeStorageInstance.writeAll(sessionsMap)
    return sessions
  },

  async readSession(sessionId: string): Promise<ClaudeCodeSession | null> {
    return claudeCodeStorageInstance.getById(sessionId)
  },

  async createSession(data: Omit<ClaudeCodeSession, 'id' | 'created' | 'updated'>): Promise<ClaudeCodeSession> {
    return claudeCodeStorageInstance.create(data)
  },

  async updateSession(
    sessionId: string,
    data: Partial<Omit<ClaudeCodeSession, 'id' | 'created' | 'updated'>>
  ): Promise<ClaudeCodeSession | null> {
    return claudeCodeStorageInstance.update(sessionId, data)
  },

  async deleteSession(sessionId: string): Promise<boolean> {
    return claudeCodeStorageInstance.delete(sessionId)
  },

  // Message methods
  async readSessionMessages(sessionId: string): Promise<ClaudeCodeMessage[]> {
    const messageStorage = claudeCodeStorageInstance.getMessageStorage(sessionId)
    return messageStorage.list()
  },

  async writeSessionMessages(sessionId: string, messages: ClaudeCodeMessage[]): Promise<ClaudeCodeMessage[]> {
    const messageStorage = claudeCodeStorageInstance.getMessageStorage(sessionId)

    // Clear existing messages and write new ones
    await messageStorage.deleteAll()

    for (const message of messages) {
      await messageStorage.create(message)
    }

    return messages
  },

  async addSessionMessage(
    sessionId: string,
    message: Omit<ClaudeCodeMessage, 'id' | 'created'>
  ): Promise<ClaudeCodeMessage> {
    const messageStorage = claudeCodeStorageInstance.getMessageStorage(sessionId)
    return messageStorage.create(message)
  },

  async getSessionMessage(sessionId: string, messageId: string): Promise<ClaudeCodeMessage | null> {
    const messageStorage = claudeCodeStorageInstance.getMessageStorage(sessionId)
    return messageStorage.getById(messageId)
  },

  async updateSessionMessage(
    sessionId: string,
    messageId: string,
    data: Partial<Omit<ClaudeCodeMessage, 'id' | 'created'>>
  ): Promise<ClaudeCodeMessage | null> {
    const messageStorage = claudeCodeStorageInstance.getMessageStorage(sessionId)
    return messageStorage.update(messageId, data)
  },

  async deleteSessionMessage(sessionId: string, messageId: string): Promise<boolean> {
    const messageStorage = claudeCodeStorageInstance.getMessageStorage(sessionId)
    return messageStorage.delete(messageId)
  },

  async deleteSessionData(sessionId: string): Promise<void> {
    // Delete all messages first
    const messageStorage = claudeCodeStorageInstance.getMessageStorage(sessionId)
    await messageStorage.deleteAll()

    // Then delete the session
    await claudeCodeStorageInstance.delete(sessionId)
  },

  // Search methods
  async searchSessions(query: string): Promise<ClaudeCodeSession[]> {
    return claudeCodeStorageInstance.searchByTitle(query)
  },

  async getSessionsByProject(projectId: number): Promise<ClaudeCodeSession[]> {
    return claudeCodeStorageInstance.getByProject(projectId)
  },

  async getRecentSessions(limit: number = 10): Promise<ClaudeCodeSession[]> {
    return claudeCodeStorageInstance.getRecent(limit)
  },

  async getActiveSessions(): Promise<ClaudeCodeSession[]> {
    return claudeCodeStorageInstance.getActive()
  },

  // Legacy API methods
  async getAllClaudeCodeSessions(): Promise<ClaudeCodeSession[]> {
    return claudeCodeStorageInstance.list()
  },

  async getClaudeCodeSessionMessages(sessionId: string): Promise<ClaudeCodeMessage[]> {
    return claudeCodeStorageInstance.getMessages(sessionId)
  },

  async getClaudeCodeSession(sessionId: string): Promise<ClaudeCodeSession | null> {
    return claudeCodeStorageInstance.getById(sessionId)
  },

  // Utility methods
  generateId(): string {
    // Generate a UUID-like string ID for compatibility
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substr(2, 9)
    return `claude_${timestamp}_${random}`
  },

  generateMessageId(): string {
    // Generate a UUID-like string ID for messages
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substr(2, 9)
    return `msg_${timestamp}_${random}`
  }
}

// Add the missing cleanup function
export async function cleanupOldClaudeCodeSessions(daysToKeep: number = 30): Promise<number> {
  const cutoffTime = Date.now() - daysToKeep * 24 * 60 * 60 * 1000
  const sessions = await claudeCodeStorageInstance.list()
  let deletedCount = 0

  for (const session of sessions) {
    if (session.lastActivity < cutoffTime) {
      const deleted = await claudeCodeStorageInstance.delete(session.id)
      if (deleted) {
        deletedCount++
      }
    }
  }

  return deletedCount
}

// Add the missing getClaudeCodeSession standalone function
export async function getClaudeCodeSession(sessionId: string): Promise<ClaudeCodeSession | null> {
  return claudeCodeStorageInstance.getById(sessionId)
}

// Add the missing saveClaudeCodeSessionMessages function
export async function saveClaudeCodeSessionMessages(sessionId: string, messages: ClaudeCodeMessage[]): Promise<void> {
  const messageStorage = claudeCodeStorageInstance.getMessageStorage(sessionId)

  // Clear existing messages and write new ones
  await messageStorage.deleteAll()

  for (const message of messages) {
    await messageStorage.create(message)
  }
}

// Add the missing saveClaudeCodeSession function
export async function saveClaudeCodeSession(session: ClaudeCodeSession): Promise<ClaudeCodeSession> {
  const existingSession = await claudeCodeStorageInstance.getById(session.id)

  if (existingSession) {
    const updated = await claudeCodeStorageInstance.update(session.id, session)
    return updated || session
  } else {
    return claudeCodeStorageInstance.create(session)
  }
}

// Add the missing deleteClaudeCodeSession function
export async function deleteClaudeCodeSession(sessionId: string): Promise<boolean> {
  return claudeCodeStorageInstance.delete(sessionId)
}

// Add the missing getAllClaudeCodeSessions function
export async function getAllClaudeCodeSessions(): Promise<ClaudeCodeSession[]> {
  return claudeCodeStorageInstance.list()
}
