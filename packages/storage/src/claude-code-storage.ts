import { z } from 'zod'
import * as path from 'node:path'
import { ClaudeCodeSessionSchema, ClaudeCodeMessageSchema, type ClaudeCodeSession, type ClaudeCodeMessage } from '@octoprompt/schemas'
import { BaseStorageString, type StorageOptions } from './core/base-storage-string'
import { IndexManager, type IndexConfig } from './core/index-manager'

// Storage schemas
export const ClaudeCodeSessionsStorageSchema = z.record(z.string(), ClaudeCodeSessionSchema)
export const ClaudeCodeMessagesStorageSchema = z.record(z.string(), ClaudeCodeMessageSchema)
export type ClaudeCodeSessionsStorage = z.infer<typeof ClaudeCodeSessionsStorageSchema>
export type ClaudeCodeMessagesStorage = z.infer<typeof ClaudeCodeMessagesStorageSchema>

/**
 * Enhanced Claude Code storage with session management and message search
 */
export class ClaudeCodeStorage extends BaseStorageString<ClaudeCodeSession, ClaudeCodeSessionsStorage> {
  private indexManager: IndexManager
  private messageStorages: Map<string, ClaudeCodeMessageStorage> = new Map()

  constructor(options: StorageOptions = {}) {
    const dataDir = path.join('data', 'claude_code_storage')
    super(ClaudeCodeSessionsStorageSchema, ClaudeCodeSessionSchema, dataDir, options)
    
    this.indexManager = new IndexManager(this.basePath, this.dataDir)
    
    // Initialize indexes
    this.initializeIndexes()
  }

  protected getIndexPath(): string {
    return path.join(this.basePath, this.dataDir, 'sessions.json')
  }

  protected getEntityPath(id: string): string | null {
    return path.join(this.basePath, this.dataDir, 'messages', `${id}.json`)
  }

  protected async initializeIndexes(): Promise<void> {
    const indexes: IndexConfig[] = [
      {
        name: 'sessions_by_projectPath',
        type: 'hash',
        fields: ['projectPath']
      },
      {
        name: 'sessions_by_status',
        type: 'hash',
        fields: ['status']
      },
      {
        name: 'sessions_by_lastActivity',
        type: 'btree',
        fields: ['lastActivity']
      },
      {
        name: 'sessions_by_created',
        type: 'btree',
        fields: ['created']
      }
    ]

    for (const indexConfig of indexes) {
      try {
        await this.indexManager.createIndex(indexConfig)
      } catch (error: any) {
        if (!error.message.includes('already exists')) {
          console.error(`Failed to create index ${indexConfig.name}:`, error)
        }
      }
    }
  }

  // Override create to handle indexes
  public async create(data: Omit<ClaudeCodeSession, 'id' | 'created' | 'updated'>): Promise<ClaudeCodeSession> {
    const session = await super.create(data)
    
    // Update indexes
    await this.updateSessionIndexes(session)
    
    return session
  }

  // Override update to maintain indexes
  public async update(id: string, data: Partial<Omit<ClaudeCodeSession, 'id' | 'created' | 'updated'>>): Promise<ClaudeCodeSession | null> {
    // Remove from indexes before update
    await this.removeSessionFromIndexes(id)

    const updated = await super.update(id, data)
    if (!updated) return null

    // Re-add to indexes
    await this.updateSessionIndexes(updated)

    return updated
  }

  // Override delete to maintain indexes
  public async delete(id: string): Promise<boolean> {
    const result = await super.delete(id)
    if (result) {
      // Remove from indexes
      await this.removeSessionFromIndexes(id)
      
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
    const ids = await this.indexManager.query('sessions_by_projectPath', projectPath)
    const sessions: ClaudeCodeSession[] = []
    
    for (const id of ids) {
      const session = await this.getById(id)
      if (session && session.projectPath === projectPath) {
        sessions.push(session)
      }
    }
    
    return sessions.sort((a, b) => b.lastActivity - a.lastActivity)
  }

  /**
   * Get sessions by status
   */
  public async getByStatus(status: string): Promise<ClaudeCodeSession[]> {
    const ids = await this.indexManager.query('sessions_by_status', status)
    const sessions: ClaudeCodeSession[] = []
    
    for (const id of ids) {
      const session = await this.getById(id)
      if (session) sessions.push(session)
    }
    
    return sessions.sort((a, b) => b.lastActivity - a.lastActivity)
  }

  /**
   * Get recent sessions
   */
  public async getRecent(limit: number = 10): Promise<ClaudeCodeSession[]> {
    const sessions = await this.list()
    return sessions
      .sort((a, b) => b.lastActivity - a.lastActivity)
      .slice(0, limit)
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
      .filter(session => 
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
      this.messageStorages.set(sessionId, new ClaudeCodeMessageStorage(sessionId, this.basePath, this.dataDir, this.options))
    }
    return this.messageStorages.get(sessionId)!
  }

  /**
   * Add message to session
   */
  public async addMessage(sessionId: string, messageData: Omit<ClaudeCodeMessage, 'id' | 'created'>): Promise<ClaudeCodeMessage> {
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

  // --- Index Management ---

  private async updateSessionIndexes(session: ClaudeCodeSession): Promise<void> {
    await this.indexManager.addToIndex('sessions_by_projectPath', session.id, session)
    await this.indexManager.addToIndex('sessions_by_status', session.id, session)
    await this.indexManager.addToIndex('sessions_by_lastActivity', session.id, session)
    await this.indexManager.addToIndex('sessions_by_created', session.id, session)
  }

  private async removeSessionFromIndexes(sessionId: string): Promise<void> {
    const indexNames = [
      'sessions_by_projectPath',
      'sessions_by_status',
      'sessions_by_lastActivity',
      'sessions_by_created'
    ]
    
    for (const indexName of indexNames) {
      await this.indexManager.removeFromIndex(indexName, sessionId)
    }
  }

  public async rebuildIndexes(): Promise<void> {
    const sessions = await this.list()
    
    const indexNames = [
      'sessions_by_projectPath',
      'sessions_by_status', 
      'sessions_by_lastActivity',
      'sessions_by_created'
    ]
    
    for (const indexName of indexNames) {
      await this.indexManager.rebuildIndex(indexName, sessions)
    }
  }
}

/**
 * Message storage for Claude Code sessions
 */
export class ClaudeCodeMessageStorage extends BaseStorageString<ClaudeCodeMessage, ClaudeCodeMessagesStorage> {
  private indexManager: IndexManager
  private sessionId: string

  constructor(sessionId: string, basePath: string, dataDir: string, options: StorageOptions = {}) {
    const messageDataDir = path.join(dataDir, 'messages')
    super(ClaudeCodeMessagesStorageSchema, ClaudeCodeMessageSchema, messageDataDir, { ...options, basePath })
    
    this.sessionId = sessionId
    this.indexManager = new IndexManager(basePath, messageDataDir)
    
    // Initialize indexes
    this.initializeIndexes()
  }

  protected getIndexPath(): string {
    return path.join(this.basePath, this.dataDir, `${this.sessionId}.json`)
  }

  protected getEntityPath(id: string): string | null {
    // Messages don't have separate entity paths
    return null
  }

  protected async initializeIndexes(): Promise<void> {
    const indexes: IndexConfig[] = [
      {
        name: `messages_${this.sessionId}_by_type`,
        type: 'hash',
        fields: ['type']
      },
      {
        name: `messages_${this.sessionId}_by_session_id`,
        type: 'hash',
        fields: ['session_id']
      },
      {
        name: `messages_${this.sessionId}_by_created`,
        type: 'btree',
        fields: ['created']
      },
      {
        name: `messages_${this.sessionId}_by_content`,
        type: 'inverted',
        fields: ['content']
      }
    ]

    for (const indexConfig of indexes) {
      try {
        await this.indexManager.createIndex(indexConfig)
      } catch (error: any) {
        if (!error.message.includes('already exists')) {
          console.error(`Failed to create index ${indexConfig.name}:`, error)
        }
      }
    }
  }

  // Override create to handle indexes and timestamps
  public async create(data: Omit<ClaudeCodeMessage, 'id' | 'created' | 'updated'>): Promise<ClaudeCodeMessage> {
    const now = Date.now()
    const message = await super.create({
      ...data,
      session_id: data.session_id || this.sessionId,
      timestamp: data.timestamp || now
    })
    
    // Update indexes
    await this.updateMessageIndexes(message)
    
    return message
  }

  /**
   * Search messages by content
   */
  public async search(query: string): Promise<ClaudeCodeMessage[]> {
    const contentIds = await this.indexManager.searchText(`messages_${this.sessionId}_by_content`, query)
    const messages: ClaudeCodeMessage[] = []
    
    for (const id of contentIds) {
      const message = await this.getById(id)
      if (message) messages.push(message)
    }
    
    return messages.sort((a, b) => b.updated - a.updated)
  }

  /**
   * Get messages by type
   */
  public async getByType(type: string): Promise<ClaudeCodeMessage[]> {
    const ids = await this.indexManager.query(`messages_${this.sessionId}_by_type`, type)
    const messages: ClaudeCodeMessage[] = []
    
    for (const id of ids) {
      const message = await this.getById(id)
      if (message) messages.push(message)
    }
    
    return messages.sort((a, b) => a.updated - b.updated)
  }

  private async updateMessageIndexes(message: ClaudeCodeMessage): Promise<void> {
    await this.indexManager.addToIndex(`messages_${this.sessionId}_by_type`, message.id, message)
    await this.indexManager.addToIndex(`messages_${this.sessionId}_by_session_id`, message.id, message)
    await this.indexManager.addToIndex(`messages_${this.sessionId}_by_created`, message.id, message)
    await this.indexManager.addToIndex(`messages_${this.sessionId}_by_content`, message.id, message)
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
  action: 'session_started' | 'session_completed' | 'file_created' | 'file_modified' | 'file_deleted' | 'command_executed'
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
      logs = logs.filter(log => log.sessionId === query.sessionId)
    }
    if (query.projectId) {
      logs = logs.filter(log => log.projectId === query.projectId)
    }
    if (query.startTime) {
      logs = logs.filter(log => log.timestamp >= query.startTime)
    }
    if (query.endTime) {
      logs = logs.filter(log => log.timestamp <= query.endTime)
    }
    if (query.action) {
      logs = logs.filter(log => log.action === query.action)
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
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000)
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

  async updateSession(sessionId: string, data: Partial<Omit<ClaudeCodeSession, 'id' | 'created' | 'updated'>>): Promise<ClaudeCodeSession | null> {
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

  async addSessionMessage(sessionId: string, message: Omit<ClaudeCodeMessage, 'id' | 'created'>): Promise<ClaudeCodeMessage> {
    const messageStorage = claudeCodeStorageInstance.getMessageStorage(sessionId)
    return messageStorage.create(message)
  },

  async getSessionMessage(sessionId: string, messageId: string): Promise<ClaudeCodeMessage | null> {
    const messageStorage = claudeCodeStorageInstance.getMessageStorage(sessionId)
    return messageStorage.getById(messageId)
  },

  async updateSessionMessage(sessionId: string, messageId: string, data: Partial<Omit<ClaudeCodeMessage, 'id' | 'created'>>): Promise<ClaudeCodeMessage | null> {
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
  const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000)
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