import { z, ZodError, type ZodTypeAny } from 'zod'
import path from 'node:path'
import fs from 'node:fs/promises'
import { type ClaudeCodeAuditLog, ClaudeCodeAuditLogSchema } from '@octoprompt/schemas'
import { normalizeToUnixMs } from '@octoprompt/shared/src/utils/parse-timestamp'

// Define the base directory for storing audit data
const DATA_DIR = path.resolve(process.cwd(), 'data', 'claude_code_audit')
const CLAUDE_CODE_AUDIT_FILE = 'claude-code-audit.json'

// Define the schema for the storage structure
const ClaudeCodeAuditStorageSchema = z.record(z.coerce.number(), ClaudeCodeAuditLogSchema)
type ClaudeCodeAuditStorage = z.infer<typeof ClaudeCodeAuditStorageSchema>

// --- Path Helpers ---

/** Gets the absolute path to the audit log file. */
function getAuditLogPath(): string {
  return path.join(DATA_DIR, CLAUDE_CODE_AUDIT_FILE)
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

// --- Audit Storage Functions ---

export const claudeCodeAuditStorage = {
  /** Reads the audit log data. */
  async read(): Promise<ClaudeCodeAuditStorage> {
    return readValidatedJson(getAuditLogPath(), ClaudeCodeAuditStorageSchema, {})
  },

  /** Writes the audit log data. */
  async write(data: ClaudeCodeAuditStorage): Promise<ClaudeCodeAuditStorage> {
    return writeValidatedJson(getAuditLogPath(), data, ClaudeCodeAuditStorageSchema)
  },

  /** Generates a unique ID for audit logs. */
  generateId(): number {
    return normalizeToUnixMs(new Date())
  },

  /** Creates a new audit log entry. */
  async createAuditLog(log: Omit<ClaudeCodeAuditLog, 'id'>): Promise<ClaudeCodeAuditLog> {
    const data = await this.read()
    let id = this.generateId()

    // Handle potential ID collisions
    while (data[id]) {
      id++
    }

    const newLog: ClaudeCodeAuditLog = { ...log, id }
    data[id] = newLog
    await this.write(data)

    return newLog
  },

  /** Gets a specific audit log by ID. */
  async getAuditLog(id: number): Promise<ClaudeCodeAuditLog | null> {
    const data = await this.read()
    return data[id] || null
  },

  /** Gets all audit logs for a specific session. */
  async getAuditLogsBySession(sessionId: string): Promise<ClaudeCodeAuditLog[]> {
    const data = await this.read()
    return Object.values(data).filter((log) => log.sessionId === sessionId)
  },

  /** Gets all audit logs for a specific project. */
  async getAuditLogsByProject(projectId: number): Promise<ClaudeCodeAuditLog[]> {
    const data = await this.read()
    return Object.values(data).filter((log) => log.projectId === projectId)
  },

  /** Gets audit logs within a time range. */
  async getAuditLogsInRange(startTime: number, endTime: number): Promise<ClaudeCodeAuditLog[]> {
    const data = await this.read()
    return Object.values(data).filter((log) => log.timestamp >= startTime && log.timestamp <= endTime)
  },

  /** Queries audit logs with various filters. */
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
  },

  /** Gets a summary of audit logs for a session. */
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
  },

  /** Cleans up old audit logs. */
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