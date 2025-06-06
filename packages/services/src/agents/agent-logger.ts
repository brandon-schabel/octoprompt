import { type BunFile, file, write } from 'bun'
import { mkdir, readdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'

export const AGENT_LOGS_DIR = './data/agent-logs'
const ORCHESTRATOR_LOG_FILENAME = 'orchestrator-log.jsonl'
const AGENT_DATA_FILENAME = 'agent-data.json'

export async function getOrchestratorLogFilePaths(projectId: number, agentJobId: number) {
  const jobLogDir = join(AGENT_LOGS_DIR, 'projects', projectId.toString(), 'jobs', agentJobId.toString())
  console.log({
    ORCHESTRATOR_LOG_PATH: join(
      AGENT_LOGS_DIR,
      'projects',
      projectId.toString(),
      'jobs',
      agentJobId.toString(),
      ORCHESTRATOR_LOG_FILENAME
    )
  })
  await ensureLogDirExists(jobLogDir)
  const filePath = join(jobLogDir, ORCHESTRATOR_LOG_FILENAME)
  return { jobLogDir, filePath, agentJobId }
}

export async function getAgentDataLogFilePath(projectId: number, agentJobId: number): Promise<string> {
  const jobLogDir = join(AGENT_LOGS_DIR, 'projects', projectId.toString(), 'jobs', agentJobId.toString())
  console.log({
    DATA_LOG_PATH: join(
      AGENT_LOGS_DIR,
      'projects',
      projectId.toString(),
      'jobs',
      agentJobId.toString(),
      AGENT_DATA_FILENAME
    )
  })
  await ensureLogDirExists(jobLogDir)
  return join(jobLogDir, AGENT_DATA_FILENAME)
}

async function ensureLogDirExists(dirPath: string) {
  try {
    await mkdir(dirPath, { recursive: true })
  } catch (error) {
    console.error(`Failed to create or access log directory: ${dirPath}`, error)
    throw error // Re-throw to signal failure upstream
  }
}

let logFile: BunFile | null = null
let fileWriter: ReturnType<BunFile['writer']> | null = null
let loggerInitialized = false
let currentLogFilePath: string | null = null // Store the current orchestrator log file path

export async function initializeLogger(orchestratorLogFilePath: string) {
  if (loggerInitialized && orchestratorLogFilePath === currentLogFilePath) {
    return
  }
  if (fileWriter) {
    // If switching files, ensure the previous one is flushed/closed
    try {
      await fileWriter.end() //
      console.log(`Closed previous logger for: ${currentLogFilePath}`)
    } catch (e) {
      console.error(`Error closing previous logger: ${currentLogFilePath}`, e)
    }
    fileWriter = null // Reset
  }

  try {
    // Ensure the directory for *this specific file* exists right before creating it.
    await ensureLogDirExists(dirname(orchestratorLogFilePath))

    logFile = file(orchestratorLogFilePath)
    fileWriter = logFile.writer()
    currentLogFilePath = orchestratorLogFilePath

    const startLog = JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: '--- Orchestrator Log Start ---'
    })
    fileWriter.write(startLog + '\n')
    await fileWriter.flush()

    console.log(`Logging initialized. Orchestrator logs in ${orchestratorLogFilePath}`)
    loggerInitialized = true

    // No need to return file info, path is known by caller
  } catch (error) {
    console.error(`FATAL: Failed to initialize file logger for ${orchestratorLogFilePath}:`, error)
    logFile = null
    fileWriter = null
    currentLogFilePath = null
    loggerInitialized = false
    throw error // Re-throw critical failure
  }
}

type LogLevel = 'info' | 'verbose' | 'warn' | 'error'

export async function log(message: string, level: LogLevel = 'info', data?: Record<string, any>): Promise<void> {
  if (!loggerInitialized || !fileWriter) {
    console.warn('[Logger not initialized/writer error] Log attempt:', level, message, data ? JSON.stringify(data) : '')
    // Fallback console logging for non-verbose
    if (level !== 'verbose') {
      const consoleMsg = data ? `${message} ${JSON.stringify(data)}` : message
      if (level === 'info') console.log(consoleMsg)
      else if (level === 'warn') console.warn(consoleMsg)
      else if (level === 'error') console.error(consoleMsg)
    }
    return
  }

  const timestamp = new Date().toISOString()
  const logEntry: Record<string, any> = { timestamp, level, message }
  if (data) logEntry.data = data
  const jsonLogLine = JSON.stringify(logEntry)

  try {
    fileWriter.write(jsonLogLine + '\n')

    await fileWriter.flush()
  } catch (error) {
    console.error(`[Logger File Write Error] ${error instanceof Error ? error.message : String(error)}`)
    const fallbackMsg = data ? `${message} ${JSON.stringify(data)}` : message
    // Log to console on file write failure, including verbose ones
    if (level === 'info') console.info(`[File Log Failed] ${fallbackMsg}`)
    else if (level === 'verbose') console.log(`[File Log Failed - Verbose] ${fallbackMsg}`)
    else if (level === 'warn') console.warn(`[File Log Failed] ${fallbackMsg}`)
    else if (level === 'error') console.error(`[File Log Failed] ${fallbackMsg}`)
  }

  // Console logging (skip verbose)
  if (level !== 'verbose') {
    if (level === 'info') console.log(message)
    else if (level === 'warn') console.warn(message)
    else if (level === 'error') console.error(message)
  }
}

export async function writeAgentDataLog(projectId: number, agentJobId: number, data: any): Promise<void> {
  const filePath = await getAgentDataLogFilePath(projectId, agentJobId)
  console.log({
    DATA_LOG_PATH: filePath
  })

  try {
    await ensureLogDirExists(dirname(filePath))
    await write(filePath, JSON.stringify(data, null, 2))
    console.log(`Agent data log written to: ${filePath}`)
  } catch (error) {
    console.error(`Failed to write agent data log to ${filePath}:`, error)
  }
}

export async function closeLogger() {
  if (fileWriter) {
    try {
      await fileWriter.end()
      console.log(`Logger closed for: ${currentLogFilePath}`)
    } catch (e) {
      console.error(`Error closing logger for ${currentLogFilePath}:`, e)
    } finally {
      loggerInitialized = false
      logFile = null
      fileWriter = null
      currentLogFilePath = null
    }
  }
}

export async function listAgentJobs(projectId: number): Promise<number[]> {
  try {
    const entries = await readdir(join(AGENT_LOGS_DIR, 'projects', projectId.toString()), { withFileTypes: true })
    const jobIds = entries.filter((entry) => entry.isDirectory()).map((entry) => Number(entry.name))
    console.log(`[Agent Logger] Found ${jobIds.length} agent job directories in ${AGENT_LOGS_DIR}`)
    return jobIds
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.warn(`[Agent Logger] Root log directory not found during listing: ${AGENT_LOGS_DIR}`)
      return [] // Return empty array if root directory doesn't exist
    }
    console.error(`[Agent Logger] Error listing agent job directories in ${AGENT_LOGS_DIR}:`, error)
    throw new Error('Failed to list agent job IDs.') // Re-throw for handling in the route
  }
}
