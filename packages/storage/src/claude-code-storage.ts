import { z, ZodError, type ZodTypeAny } from 'zod'
import path from 'node:path'
import fs from 'node:fs/promises'
import {
  ClaudeCodeSessionSchema,
  ClaudeCodeMessageSchema,
  ClaudeCodeAuditLogSchema,
  type ClaudeCodeSession,
  type ClaudeCodeMessage,
  type ClaudeCodeAuditLog,
  type GetAuditLogsQuery,
  type AuditLogSummary
} from '@octoprompt/schemas'
import { normalizeToUnixMs } from '@octoprompt/shared/src/utils/parse-timestamp'

// Define the base directory for storing Claude Code data
const DATA_DIR = path.resolve(process.cwd(), 'data', 'claude_code_storage')
const SESSIONS_SUBDIR = 'sessions'
const AUDIT_LOGS_DIR = path.join(DATA_DIR, 'audit_logs')

// --- Schemas for Storage ---
// Store sessions as a map keyed by sessionId
export const ClaudeCodeSessionsStorageSchema = z.record(z.string(), ClaudeCodeSessionSchema)
export type ClaudeCodeSessionsStorage = z.infer<typeof ClaudeCodeSessionsStorageSchema>

// Store messages within a session as an array
export const ClaudeCodeMessagesStorageSchema = z.array(ClaudeCodeMessageSchema)
export type ClaudeCodeMessagesStorage = z.infer<typeof ClaudeCodeMessagesStorageSchema>

// Store audit logs as a map keyed by log ID
export const ClaudeCodeAuditLogsStorageSchema = z.record(z.string(), ClaudeCodeAuditLogSchema)
export type ClaudeCodeAuditLogsStorage = z.infer<typeof ClaudeCodeAuditLogsStorageSchema>

// --- Path Helpers ---

/** Gets the absolute path to the main sessions index file. */
function getSessionsIndexPath(): string {
  return path.join(DATA_DIR, 'sessions.json')
}

/** Gets the absolute path to a specific session's data directory. */
function getSessionDataDir(sessionId: string): string {
  return path.join(DATA_DIR, SESSIONS_SUBDIR, sessionId)
}

/** Gets the absolute path to a specific session's messages file. */
function getSessionMessagesPath(sessionId: string): string {
  return path.join(getSessionDataDir(sessionId), 'messages.json')
}

/** Gets the absolute path to audit logs file. */
function getAuditLogsPath(): string {
  return path.join(AUDIT_LOGS_DIR, 'audit_logs.json')
}

// --- Core Read/Write Functions ---

/** Ensures the specified directory exists. */
async function ensureDirExists(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true })
  } catch (error: any) {
    if (error.code !== 'EEXIST') {
      console.error(`Error creating directory ${dirPath}:`, error)
      throw new Error(`Failed to ensure directory exists: ${dirPath}`)
    }
  }
}

/**
 * Reads and validates JSON data from a file.
 */
async function readValidatedJson<T extends ZodTypeAny>(
  filePath: string,
  schema: T,
  defaultValue: z.infer<T>
): Promise<z.infer<T>> {
  try {
    await ensureDirExists(path.dirname(filePath))
    const fileContent = await fs.readFile(filePath, 'utf-8')
    
    if (fileContent.trim() === '') {
      console.warn(`File is empty or contains only whitespace: ${filePath}. Returning default value.`)
      return defaultValue
    }

    const jsonData = JSON.parse(fileContent)
    const validationResult = await schema.safeParseAsync(jsonData)

    if (!validationResult.success) {
      console.error(`Zod validation failed reading ${filePath}:`, validationResult.error.errors)
      console.warn(`Returning default value due to validation failure for ${filePath}.`)
      return defaultValue
    }
    return validationResult.data
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return defaultValue
    }
    if (error instanceof SyntaxError) {
      console.error(`JSON Parse error in ${filePath}:`, error.message)
      console.warn(`Returning default value due to JSON parsing error for ${filePath}.`)
      return defaultValue
    }
    console.error(`Error reading or parsing JSON from ${filePath}:`, error)
    throw new Error(`Failed to read/parse JSON file at ${filePath}. Reason: ${error.message}`)
  }
}

/**
 * Validates data and writes it to a JSON file.
 */
async function writeValidatedJson<T extends ZodTypeAny>(
  filePath: string,
  data: unknown,
  schema: T
): Promise<z.infer<T>> {
  try {
    const validationResult = await schema.safeParseAsync(data)
    if (!validationResult.success) {
      console.error(`Zod validation failed before writing to ${filePath}:`, validationResult.error.errors)
      throw new ZodError(validationResult.error.errors)
    }
    const validatedData = validationResult.data

    await ensureDirExists(path.dirname(filePath))
    const jsonString = JSON.stringify(validatedData, null, 2)
    await fs.writeFile(filePath, jsonString, 'utf-8')
    return validatedData
  } catch (error: any) {
    console.error(`Error writing JSON to ${filePath}:`, error)
    if (error instanceof ZodError) {
      throw error
    }
    throw new Error(`Failed to write JSON file at ${filePath}. Reason: ${error.message}`)
  }
}

// --- Claude Code Session Storage ---

/** Reads all Claude Code sessions. */
async function getAllClaudeCodeSessions(): Promise<ClaudeCodeSession[]> {
  const sessions = await readValidatedJson(getSessionsIndexPath(), ClaudeCodeSessionsStorageSchema, {})
  return Object.values(sessions)
}

/** Gets a specific Claude Code session by ID. */
async function getClaudeCodeSession(sessionId: string): Promise<ClaudeCodeSession | null> {
  const sessions = await readValidatedJson(getSessionsIndexPath(), ClaudeCodeSessionsStorageSchema, {})
  return sessions[sessionId] || null
}

/** Saves or updates a Claude Code session. */
async function saveClaudeCodeSession(session: ClaudeCodeSession): Promise<ClaudeCodeSession> {
  const sessions = await readValidatedJson(getSessionsIndexPath(), ClaudeCodeSessionsStorageSchema, {})
  
  // Ensure updated timestamp
  const sessionToSave = {
    ...session,
    updated: Date.now()
  }
  
  sessions[session.id] = sessionToSave
  await writeValidatedJson(getSessionsIndexPath(), sessions, ClaudeCodeSessionsStorageSchema)
  return sessionToSave
}

/** Deletes a Claude Code session and its associated data. */
async function deleteClaudeCodeSession(sessionId: string): Promise<boolean> {
  const sessions = await readValidatedJson(getSessionsIndexPath(), ClaudeCodeSessionsStorageSchema, {})
  
  if (!sessions[sessionId]) {
    return false
  }
  
  delete sessions[sessionId]
  await writeValidatedJson(getSessionsIndexPath(), sessions, ClaudeCodeSessionsStorageSchema)
  
  // Delete session data directory
  const sessionDir = getSessionDataDir(sessionId)
  try {
    await fs.access(sessionDir)
    await fs.rm(sessionDir, { recursive: true, force: true })
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      console.error(`Error deleting session data directory ${sessionDir}:`, error)
    }
  }
  
  return true
}

/** Cleans up old Claude Code sessions. */
async function cleanupOldClaudeCodeSessions(daysToKeep: number = 7): Promise<number> {
  const sessions = await readValidatedJson(getSessionsIndexPath(), ClaudeCodeSessionsStorageSchema, {})
  const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000)
  let deletedCount = 0
  
  for (const [sessionId, session] of Object.entries(sessions)) {
    if (session.lastActivity < cutoffTime) {
      await deleteClaudeCodeSession(sessionId)
      deletedCount++
    }
  }
  
  return deletedCount
}

// --- Claude Code Session Messages Storage ---

/** Gets messages for a specific Claude Code session. */
async function getClaudeCodeSessionMessages(sessionId: string): Promise<ClaudeCodeMessage[]> {
  return readValidatedJson(getSessionMessagesPath(sessionId), ClaudeCodeMessagesStorageSchema, [])
}

/** Saves messages for a specific Claude Code session. */
async function saveClaudeCodeSessionMessages(sessionId: string, messages: ClaudeCodeMessage[]): Promise<void> {
  await writeValidatedJson(getSessionMessagesPath(sessionId), messages, ClaudeCodeMessagesStorageSchema)
}

// --- Claude Code Audit Storage ---

export const claudeCodeAuditStorage = {
  /** Creates a new audit log entry. */
  async createAuditLog(logData: Omit<ClaudeCodeAuditLog, 'id'>): Promise<ClaudeCodeAuditLog> {
    const logs = await readValidatedJson(getAuditLogsPath(), ClaudeCodeAuditLogsStorageSchema, {})
    
    const newLog: ClaudeCodeAuditLog = {
      ...logData,
      id: Date.now()
    }
    
    logs[newLog.id.toString()] = newLog
    await writeValidatedJson(getAuditLogsPath(), logs, ClaudeCodeAuditLogsStorageSchema)
    return newLog
  },

  /** Query audit logs with filters. */
  async queryAuditLogs(query: GetAuditLogsQuery): Promise<ClaudeCodeAuditLog[]> {
    const logs = await readValidatedJson(getAuditLogsPath(), ClaudeCodeAuditLogsStorageSchema, {})
    let results = Object.values(logs)
    
    // Apply filters
    if (query.sessionId) {
      results = results.filter(log => log.sessionId === query.sessionId)
    }
    if (query.projectId !== undefined) {
      results = results.filter(log => log.projectId === query.projectId)
    }
    if (query.action) {
      results = results.filter(log => log.action === query.action)
    }
    if (query.startTime !== undefined) {
      results = results.filter(log => log.timestamp >= query.startTime!)
    }
    if (query.endTime !== undefined) {
      results = results.filter(log => log.timestamp <= query.endTime!)
    }
    
    // Sort by timestamp descending
    results.sort((a, b) => b.timestamp - a.timestamp)
    
    // Apply pagination
    const start = query.offset || 0
    const limit = query.limit || 100
    return results.slice(start, start + limit)
  },

  /** Get all audit logs for a specific session. */
  async getAuditLogsBySession(sessionId: string): Promise<ClaudeCodeAuditLog[]> {
    const logs = await readValidatedJson(getAuditLogsPath(), ClaudeCodeAuditLogsStorageSchema, {})
    return Object.values(logs)
      .filter(log => log.sessionId === sessionId)
      .sort((a, b) => a.timestamp - b.timestamp)
  },

  /** Get audit log summary for a session. */
  async getAuditLogSummary(sessionId: string): Promise<Partial<AuditLogSummary>> {
    const sessionLogs = await this.getAuditLogsBySession(sessionId)
    
    const summary: Partial<AuditLogSummary> = {
      totalActions: sessionLogs.length,
      fileChanges: {
        created: 0,
        modified: 0,
        deleted: 0
      },
      commandsExecuted: 0,
      startTime: sessionLogs.length > 0 ? sessionLogs[0].timestamp : undefined,
      endTime: sessionLogs.length > 0 ? sessionLogs[sessionLogs.length - 1].timestamp : undefined
    }
    
    for (const log of sessionLogs) {
      switch (log.action) {
        case 'file_created':
          summary.fileChanges!.created++
          break
        case 'file_modified':
          summary.fileChanges!.modified++
          break
        case 'file_deleted':
          summary.fileChanges!.deleted++
          break
        case 'command_executed':
          summary.commandsExecuted!++
          break
      }
    }
    
    return summary
  },

  /** Clean up old audit logs. */
  async cleanupOldAuditLogs(daysToKeep: number = 30): Promise<number> {
    const logs = await readValidatedJson(getAuditLogsPath(), ClaudeCodeAuditLogsStorageSchema, {})
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000)
    let deletedCount = 0
    
    for (const [logId, log] of Object.entries(logs)) {
      if (log.timestamp < cutoffTime) {
        delete logs[logId]
        deletedCount++
      }
    }
    
    if (deletedCount > 0) {
      await writeValidatedJson(getAuditLogsPath(), logs, ClaudeCodeAuditLogsStorageSchema)
    }
    
    return deletedCount
  }
}

// Create main storage object
export const claudeCodeStorage = {
  // Session functions
  getAllSessions: getAllClaudeCodeSessions,
  getSession: getClaudeCodeSession,
  saveSession: saveClaudeCodeSession,
  deleteSession: deleteClaudeCodeSession,
  cleanupOldSessions: cleanupOldClaudeCodeSessions,
  
  // Message functions
  getSessionMessages: getClaudeCodeSessionMessages,
  saveSessionMessages: saveClaudeCodeSessionMessages,
  
  // Generate ID
  generateId: (): number => {
    return normalizeToUnixMs(new Date())
  }
}

// Export all functions
export {
  getAllClaudeCodeSessions,
  getClaudeCodeSession,
  saveClaudeCodeSession,
  deleteClaudeCodeSession,
  cleanupOldClaudeCodeSessions,
  getClaudeCodeSessionMessages,
  saveClaudeCodeSessionMessages
}