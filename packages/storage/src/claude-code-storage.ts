import { z, ZodError } from 'zod'
import path from 'node:path'
import fs from 'node:fs/promises'
import {
  ClaudeCodeSessionSchema,
  ClaudeCodeMessageSchema,
  type ClaudeCodeSession,
  type ClaudeCodeMessage
} from '@octoprompt/schemas'
import { normalizeToUnixMs } from '@octoprompt/shared/src/utils/parse-timestamp'

// Define the base directory for storing Claude Code data
const DATA_DIR = path.resolve(process.cwd(), 'data', 'claude_code_storage')
const SESSION_DATA_SUBDIR = 'session_data'

// --- Schemas for Storage ---
// Store all sessions (metadata) as a map (Record) keyed by sessionId
export const ClaudeCodeSessionsStorageSchema = z.record(z.string(), ClaudeCodeSessionSchema)
export type ClaudeCodeSessionsStorage = z.infer<typeof ClaudeCodeSessionsStorageSchema>

// Store messages within a specific session as an array
export const ClaudeCodeMessagesStorageSchema = z.array(ClaudeCodeMessageSchema)
export type ClaudeCodeMessagesStorage = z.infer<typeof ClaudeCodeMessagesStorageSchema>

// --- Path Helpers ---

/** Gets the absolute path to the main sessions index file. */
function getSessionsIndexPath(): string {
  return path.join(DATA_DIR, 'sessions.json')
}

/** Gets the absolute path to a specific session's data directory. */
function getSessionDataDir(sessionId: string): string {
  return path.join(DATA_DIR, SESSION_DATA_SUBDIR, sessionId)
}

/** Gets the absolute path to a specific session's messages file. */
function getSessionMessagesPath(sessionId: string): string {
  return path.join(getSessionDataDir(sessionId), 'messages.json')
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

/** Reads and parses a JSON file with the specified Zod schema. */
async function readJsonFile<T>(filePath: string, schema: z.ZodType<T>): Promise<T | null> {
  try {
    const fileContent = await fs.readFile(filePath, 'utf8')
    const data = JSON.parse(fileContent)
    return schema.parse(data)
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return null
    }
    if (error instanceof ZodError) {
      console.error(`Validation error reading ${filePath}:`, error.errors)
      throw new Error(`Invalid data format in ${filePath}`)
    }
    console.error(`Error reading ${filePath}:`, error)
    throw new Error(`Failed to read ${filePath}`)
  }
}

/** Writes data to a JSON file, ensuring the directory exists first. */
async function writeJsonFile<T>(filePath: string, data: T): Promise<void> {
  const dirPath = path.dirname(filePath)
  await ensureDirExists(dirPath)

  try {
    const jsonContent = JSON.stringify(data, null, 2)
    await fs.writeFile(filePath, jsonContent, 'utf8')
  } catch (error: any) {
    console.error(`Error writing to ${filePath}:`, error)
    throw new Error(`Failed to write to ${filePath}`)
  }
}

// --- Session Management Functions ---

/** Initializes the storage by ensuring directories exist and creating empty index if needed. */
export async function initializeClaudeCodeStorage(): Promise<void> {
  await ensureDirExists(DATA_DIR)
  await ensureDirExists(path.join(DATA_DIR, SESSION_DATA_SUBDIR))

  const sessionsPath = getSessionsIndexPath()
  const existingSessions = await readJsonFile(sessionsPath, ClaudeCodeSessionsStorageSchema)

  if (!existingSessions) {
    await writeJsonFile(sessionsPath, {} as ClaudeCodeSessionsStorage)
  }
}

/** Gets all Claude Code sessions. */
export async function getAllClaudeCodeSessions(): Promise<ClaudeCodeSession[]> {
  const sessionsPath = getSessionsIndexPath()
  const sessions = await readJsonFile(sessionsPath, ClaudeCodeSessionsStorageSchema)

  if (!sessions) {
    return []
  }

  return Object.values(sessions).sort((a, b) => b.lastActivity - a.lastActivity)
}

/** Gets a specific Claude Code session by ID. */
export async function getClaudeCodeSession(sessionId: string): Promise<ClaudeCodeSession | null> {
  const sessionsPath = getSessionsIndexPath()
  const sessions = await readJsonFile(sessionsPath, ClaudeCodeSessionsStorageSchema)

  if (!sessions || !sessions[sessionId]) {
    return null
  }

  return sessions[sessionId]
}

/** Creates or updates a Claude Code session. */
export async function saveClaudeCodeSession(session: ClaudeCodeSession): Promise<ClaudeCodeSession> {
  const sessionsPath = getSessionsIndexPath()
  const sessions = (await readJsonFile(sessionsPath, ClaudeCodeSessionsStorageSchema)) || {}

  // Validate the session
  const validatedSession = ClaudeCodeSessionSchema.parse(session)

  // Update the sessions index
  sessions[validatedSession.id] = validatedSession
  await writeJsonFile(sessionsPath, sessions)

  // Ensure session data directory exists
  await ensureDirExists(getSessionDataDir(validatedSession.id))

  return validatedSession
}

/** Deletes a Claude Code session and all its messages. */
export async function deleteClaudeCodeSession(sessionId: string): Promise<boolean> {
  const sessionsPath = getSessionsIndexPath()
  const sessions = await readJsonFile(sessionsPath, ClaudeCodeSessionsStorageSchema)

  if (!sessions || !sessions[sessionId]) {
    return false
  }

  // Remove from index
  delete sessions[sessionId]
  await writeJsonFile(sessionsPath, sessions)

  // Delete session data directory
  const sessionDir = getSessionDataDir(sessionId)
  try {
    await fs.rm(sessionDir, { recursive: true, force: true })
  } catch (error) {
    console.error(`Error deleting session directory ${sessionDir}:`, error)
  }

  return true
}

// --- Message Management Functions ---

/** Gets all messages for a specific session. */
export async function getClaudeCodeSessionMessages(sessionId: string): Promise<ClaudeCodeMessage[]> {
  const messagesPath = getSessionMessagesPath(sessionId)
  const messages = await readJsonFile(messagesPath, ClaudeCodeMessagesStorageSchema)

  return messages || []
}

/** Saves messages for a specific session. */
export async function saveClaudeCodeSessionMessages(sessionId: string, messages: ClaudeCodeMessage[]): Promise<void> {
  const messagesPath = getSessionMessagesPath(sessionId)

  // Validate all messages
  const validatedMessages = ClaudeCodeMessagesStorageSchema.parse(messages)

  await writeJsonFile(messagesPath, validatedMessages)
}

/** Appends a single message to a session. */
export async function appendClaudeCodeSessionMessage(sessionId: string, message: ClaudeCodeMessage): Promise<void> {
  const existingMessages = await getClaudeCodeSessionMessages(sessionId)
  const validatedMessage = ClaudeCodeMessageSchema.parse(message)

  existingMessages.push(validatedMessage)
  await saveClaudeCodeSessionMessages(sessionId, existingMessages)
}

// --- Cleanup Functions ---

/** Cleans up old sessions (older than specified days). */
export async function cleanupOldClaudeCodeSessions(daysToKeep: number = 30): Promise<number> {
  const sessions = await getAllClaudeCodeSessions()
  const cutoffTime = Date.now() - daysToKeep * 24 * 60 * 60 * 1000
  let deletedCount = 0

  for (const session of sessions) {
    if (session.lastActivity < cutoffTime) {
      const deleted = await deleteClaudeCodeSession(session.id)
      if (deleted) {
        deletedCount++
      }
    }
  }

  return deletedCount
}

// --- Search Functions ---

/** Searches sessions by project path. */
export async function getClaudeCodeSessionsByProject(projectPath: string): Promise<ClaudeCodeSession[]> {
  const sessions = await getAllClaudeCodeSessions()
  return sessions.filter((session) => session.projectPath === projectPath)
}

/** Gets sessions with a specific status. */
export async function getClaudeCodeSessionsByStatus(
  status: 'idle' | 'running' | 'error'
): Promise<ClaudeCodeSession[]> {
  const sessions = await getAllClaudeCodeSessions()
  return sessions.filter((session) => session.status === status)
}

// Initialize storage on module load
initializeClaudeCodeStorage().catch((error) => {
  console.error('Failed to initialize Claude Code storage:', error)
})
