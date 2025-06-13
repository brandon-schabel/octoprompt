import { query, type SDKMessage, type ClaudeCodeOptions } from '@anthropic-ai/claude-code'
import { ApiError } from '@octoprompt/shared'
import path from 'path'
import { getFullProjectSummary } from './utils/get-full-project-summary'
import { buildClaudeCodeContext } from './utils/claude-code-context-builder'
import { claudeCodeFileTracker } from './utils/claude-code-file-tracker'
import { getProject } from './project-service'
import { syncProjectFiles } from './file-services/file-sync-service-unified'
import { claudeCodeAuditService } from './claude-code-audit-service'
import {
  getAllClaudeCodeSessions,
  getClaudeCodeSession,
  saveClaudeCodeSession,
  deleteClaudeCodeSession,
  saveClaudeCodeSessionMessages,
  getClaudeCodeSessionMessages,
  cleanupOldClaudeCodeSessions
} from '@octoprompt/storage'

export interface ClaudeCodeSession {
  id: string
  created: number
  projectPath?: string
  status: 'idle' | 'running' | 'error'
  lastActivity: number
}

export interface ClaudeCodeRequest {
  prompt: string
  sessionId?: string
  maxTurns?: number
  projectPath?: string
  projectId?: number
  includeProjectContext?: boolean
  allowedTools?: string[]
  systemPrompt?: string
  outputFormat?: 'text' | 'json' | 'stream-json'
}

export interface ClaudeCodeResult {
  sessionId: string
  messages: SDKMessage[]
  totalCostUsd: number
  isError: boolean
  durationMs: number
  numTurns: number
}

/**
 * Service for managing Claude Code SDK interactions
 */
export function createClaudeCodeService() {
  /**
   * Execute a Claude Code query
   */
  async function executeQuery(request: ClaudeCodeRequest): Promise<ClaudeCodeResult> {
    const {
      prompt,
      sessionId,
      maxTurns = 5,
      projectPath,
      projectId,
      includeProjectContext = false,
      allowedTools,
      systemPrompt,
      outputFormat = 'json'
    } = request

    if (!prompt) {
      throw new ApiError(400, 'Prompt is required', 'PROMPT_REQUIRED')
    }

    try {
      // If projectId is provided, use project's folder path
      let workingDirectory = projectPath ? path.resolve(projectPath) : process.cwd()
      let enhancedSystemPrompt = systemPrompt || ''

      if (projectId) {
        const project = await getProject(projectId)
        if (project) {
          workingDirectory = path.resolve(project.folderPath)

          // Include project context if requested
          if (includeProjectContext) {
            try {
              // Use intelligent context builder for better relevance
              const context = await buildClaudeCodeContext(projectId, prompt)

              const contextSections = [enhancedSystemPrompt, '\n## Project Context', context.projectSummary]

              if (context.suggestedFiles.length > 0) {
                contextSections.push('\n## Suggested Files for This Task', context.suggestedFiles.join(', '))
              }

              enhancedSystemPrompt = contextSections.filter(Boolean).join('\n').trim()
            } catch (error) {
              console.warn('[ClaudeCodeService] Failed to load project context:', error)
              // Fallback to basic project summary
              try {
                const projectSummary = await getFullProjectSummary(projectId)
                enhancedSystemPrompt = `${enhancedSystemPrompt}\n\nProject Context:\n${projectSummary}`.trim()
              } catch (fallbackError) {
                console.warn('[ClaudeCodeService] Fallback context also failed:', fallbackError)
              }
            }
          }
        }
      }

      const options: ClaudeCodeOptions = {
        maxTurns,
        outputFormat,
        cwd: workingDirectory
      }

      if (allowedTools && allowedTools.length > 0) {
        options.allowedTools = allowedTools
      }

      if (enhancedSystemPrompt) {
        options.systemPrompt = enhancedSystemPrompt
      }

      if (sessionId) {
        options.sessionId = sessionId
      }

      const messages: SDKMessage[] = []
      let finalResult: any = null

      const abortController = new AbortController()

      // Set a timeout to prevent infinite loops
      const timeout = setTimeout(() => {
        abortController.abort()
      }, 300000) // 5 minutes

      try {
        for await (const message of query({
          prompt,
          abortController,
          options
        })) {
          messages.push(message)

          if (message.type === 'result') {
            finalResult = message
            break
          }
        }
      } finally {
        clearTimeout(timeout)
      }

      if (!finalResult) {
        throw new Error('No result message received from Claude Code')
      }

      // Update or create session
      const currentSessionId = finalResult.session_id
      const now = Date.now()

      const existingSession = await getClaudeCodeSession(currentSessionId)
      const sessionToSave: ClaudeCodeSession = existingSession
        ? {
            ...existingSession,
            lastActivity: now,
            status: finalResult.is_error ? 'error' : 'idle'
          }
        : {
            id: currentSessionId,
            created: now,
            projectPath: workingDirectory,
            status: finalResult.is_error ? 'error' : 'idle',
            lastActivity: now
          }

      await saveClaudeCodeSession(sessionToSave)

      // Start file tracking and audit logging for this project if we have a projectId
      if (projectId && !finalResult.is_error) {
        try {
          await claudeCodeFileTracker.startTracking(currentSessionId, projectId)

          // Log session start if this is a new session
          if (!existingSession) {
            await claudeCodeAuditService.logSessionStart(currentSessionId, projectId)
          }

          // Parse messages for audit events
          await claudeCodeAuditService.parseAndLogMessages(currentSessionId, projectId, messages)
        } catch (error) {
          console.warn('[ClaudeCodeService] Failed to start tracking/auditing:', error)
        }
      }

      // Save messages to storage
      const messagesToSave = messages.map((msg) => ({
        ...msg,
        timestamp: msg.timestamp || Date.now()
      }))
      await saveClaudeCodeSessionMessages(currentSessionId, messagesToSave)

      // Sync project files after Claude Code execution if we have a project
      if (projectId) {
        try {
          const project = await getProject(projectId)
          if (project) {
            console.log('[ClaudeCodeService] Syncing project files after execution')
            await syncProjectFiles(project)
          }

          // Log session completion
          if (!finalResult.is_error) {
            await claudeCodeAuditService.logSessionComplete(currentSessionId, projectId)
          }
        } catch (error) {
          console.warn('[ClaudeCodeService] Failed to sync project files:', error)
        }
      }

      return {
        sessionId: currentSessionId,
        messages,
        totalCostUsd: finalResult.total_cost_usd || 0,
        isError: finalResult.is_error || false,
        durationMs: finalResult.duration_ms || 0,
        numTurns: finalResult.num_turns || 0
      }
    } catch (error: any) {
      console.error('[ClaudeCodeService] Error executing query:', error)

      if (error.name === 'AbortError') {
        throw new ApiError(408, 'Claude Code query timed out', 'QUERY_TIMEOUT')
      }

      throw new ApiError(500, `Failed to execute Claude Code query: ${error.message}`, 'CLAUDE_CODE_ERROR', {
        originalError: error.message
      })
    }
  }

  /**
   * Continue an existing session
   */
  async function continueSession(sessionId: string, prompt: string): Promise<ClaudeCodeResult> {
    const session = await getClaudeCodeSession(sessionId)

    if (!session) {
      throw new ApiError(404, 'Session not found', 'SESSION_NOT_FOUND')
    }

    return executeQuery({
      prompt,
      sessionId,
      projectPath: session.projectPath
    })
  }

  /**
   * Get session information
   */
  async function getSession(sessionId: string): Promise<ClaudeCodeSession | null> {
    return getClaudeCodeSession(sessionId)
  }

  /**
   * List all active sessions
   */
  async function listSessions(): Promise<ClaudeCodeSession[]> {
    return getAllClaudeCodeSessions()
  }

  /**
   * Clean up old sessions (older than specified days)
   */
  async function cleanupSessions(daysToKeep: number = 7): Promise<number> {
    return cleanupOldClaudeCodeSessions(daysToKeep)
  }

  /**
   * Delete a specific session
   */
  async function deleteSession(sessionId: string): Promise<boolean> {
    return deleteClaudeCodeSession(sessionId)
  }

  /**
   * Get file changes made during a Claude Code session
   */
  async function getSessionFileChanges(sessionId: string) {
    return claudeCodeFileTracker.getSessionChanges(sessionId)
  }

  /**
   * Get a summary of file changes for a session
   */
  async function getSessionChangesSummary(sessionId: string) {
    return claudeCodeFileTracker.getChangesSummary(sessionId)
  }

  /**
   * Get audit logs for queries
   */
  async function getAuditLogs(query: Parameters<typeof claudeCodeAuditService.getAuditLogs>[0]) {
    return claudeCodeAuditService.getAuditLogs(query)
  }

  /**
   * Get audit summary for a session
   */
  async function getSessionAuditSummary(sessionId: string) {
    return claudeCodeAuditService.getSessionSummary(sessionId)
  }

  /**
   * Stream execution for real-time updates
   */
  async function* executeQueryStream(request: ClaudeCodeRequest): AsyncGenerator<SDKMessage, void, unknown> {
    const {
      prompt,
      sessionId,
      maxTurns = 5,
      projectPath,
      projectId,
      includeProjectContext = false,
      allowedTools,
      systemPrompt
    } = request

    if (!prompt) {
      throw new ApiError(400, 'Prompt is required', 'PROMPT_REQUIRED')
    }

    try {
      // If projectId is provided, use project's folder path
      let workingDirectory = projectPath ? path.resolve(projectPath) : process.cwd()
      let enhancedSystemPrompt = systemPrompt || ''

      if (projectId) {
        const project = await getProject(projectId)
        if (project) {
          workingDirectory = path.resolve(project.folderPath)

          // Include project context if requested
          if (includeProjectContext) {
            try {
              // Use intelligent context builder for better relevance
              const context = await buildClaudeCodeContext(projectId, prompt)

              const contextSections = [enhancedSystemPrompt, '\n## Project Context', context.projectSummary]

              if (context.suggestedFiles.length > 0) {
                contextSections.push('\n## Suggested Files for This Task', context.suggestedFiles.join(', '))
              }

              enhancedSystemPrompt = contextSections.filter(Boolean).join('\n').trim()
            } catch (error) {
              console.warn('[ClaudeCodeService] Failed to load project context:', error)
              // Fallback to basic project summary
              try {
                const projectSummary = await getFullProjectSummary(projectId)
                enhancedSystemPrompt = `${enhancedSystemPrompt}\n\nProject Context:\n${projectSummary}`.trim()
              } catch (fallbackError) {
                console.warn('[ClaudeCodeService] Fallback context also failed:', fallbackError)
              }
            }
          }
        }
      }

      const options: ClaudeCodeOptions = {
        maxTurns,
        outputFormat: 'stream-json',
        cwd: workingDirectory
      }

      if (allowedTools && allowedTools.length > 0) {
        options.allowedTools = allowedTools
      }

      if (enhancedSystemPrompt) {
        options.systemPrompt = enhancedSystemPrompt
      }

      if (sessionId) {
        options.sessionId = sessionId
      }

      const abortController = new AbortController()

      // Set a timeout to prevent infinite loops
      const timeout = setTimeout(() => {
        abortController.abort()
      }, 300000) // 5 minutes

      try {
        for await (const message of query({
          prompt,
          abortController,
          options
        })) {
          yield message

          if (message.type === 'result') {
            // Update session on completion
            const now = Date.now()
            const currentSessionId = message.session_id

            const existingSession = await getClaudeCodeSession(currentSessionId)
            const sessionToSave: ClaudeCodeSession = existingSession
              ? {
                  ...existingSession,
                  lastActivity: now,
                  status: message.is_error ? 'error' : 'idle'
                }
              : {
                  id: currentSessionId,
                  created: now,
                  projectPath: workingDirectory,
                  status: message.is_error ? 'error' : 'idle',
                  lastActivity: now
                }

            await saveClaudeCodeSession(sessionToSave)

            // Start file tracking and sync files for streaming execution too
            if (projectId && !message.is_error) {
              try {
                await claudeCodeFileTracker.startTracking(currentSessionId, projectId)
                const project = await getProject(projectId)
                if (project) {
                  await syncProjectFiles(project)
                }
              } catch (error) {
                console.warn('[ClaudeCodeService] Failed to track/sync files in stream:', error)
              }
            }

            break
          }
        }
      } finally {
        clearTimeout(timeout)
      }
    } catch (error: any) {
      console.error('[ClaudeCodeService] Error in stream execution:', error)

      if (error.name === 'AbortError') {
        throw new ApiError(408, 'Claude Code query timed out', 'QUERY_TIMEOUT')
      }

      throw new ApiError(500, `Failed to execute Claude Code stream: ${error.message}`, 'CLAUDE_CODE_STREAM_ERROR', {
        originalError: error.message
      })
    }
  }

  // Auto-cleanup sessions every day
  setInterval(
    () => {
      cleanupSessions(7).catch((error) => {
        console.error('[ClaudeCodeService] Error cleaning up sessions:', error)
      })
    },
    24 * 60 * 60 * 1000
  )

  return {
    executeQuery,
    continueSession,
    getSession,
    listSessions,
    cleanupSessions,
    deleteSession,
    executeQueryStream,
    getSessionFileChanges,
    getSessionChangesSummary,
    getAuditLogs,
    getSessionAuditSummary
  }
}

export type ClaudeCodeService = ReturnType<typeof createClaudeCodeService>
