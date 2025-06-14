import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { octoClient } from '../api-hooks'
import type {
  ClaudeCodeRequest,
  ClaudeCodeResult,
  ClaudeCodeSession,
  ClaudeCodeSessionList,
  GetAuditLogsQuery,
  ClaudeCodeAuditLog,
  AuditLogSummary
} from '@octoprompt/schemas'

// Query Keys
const CLAUDE_CODE_KEYS = {
  all: ['claude-code'] as const,
  sessions: () => [...CLAUDE_CODE_KEYS.all, 'sessions'] as const,
  session: (sessionId: string) => [...CLAUDE_CODE_KEYS.all, 'session', sessionId] as const
}

// Hooks
export function useGetClaudeCodeSessions() {
  return useQuery({
    queryKey: CLAUDE_CODE_KEYS.sessions(),
    queryFn: async () => {
      const response = await octoClient.claudeCode.getSessions()
      return response.sessions
    },
    staleTime: 30 * 1000 // 30 seconds
  })
}

export function useGetClaudeCodeSession(sessionId: string) {
  return useQuery({
    queryKey: CLAUDE_CODE_KEYS.session(sessionId),
    queryFn: async () => {
      try {
        return await octoClient.claudeCode.getSession(sessionId)
      } catch (error: any) {
        if (error.statusCode === 404) {
          return null
        }
        throw error
      }
    },
    enabled: !!sessionId,
    staleTime: 30 * 1000 // 30 seconds
  })
}

export function useExecuteClaudeCode() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (request: ClaudeCodeRequest): Promise<ClaudeCodeResult> => {
      return await octoClient.claudeCode.executeQuery(request)
    },
    onSuccess: (data) => {
      // Invalidate sessions to refresh the list
      queryClient.invalidateQueries({ queryKey: CLAUDE_CODE_KEYS.sessions() })

      // Update the specific session if we have one
      if (data.sessionId) {
        queryClient.invalidateQueries({ queryKey: CLAUDE_CODE_KEYS.session(data.sessionId) })
      }

      toast.success(`Completed - Cost: $${data.totalCostUsd.toFixed(4)}`)
    },
    onError: (error: Error) => {
      console.error('Claude Code execution failed:', error)
      toast.error(`Execution failed: ${error.message}`)
    }
  })
}

export function useContinueClaudeCodeSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ sessionId, prompt }: { sessionId: string; prompt: string }): Promise<ClaudeCodeResult> => {
      return await octoClient.claudeCode.continueSession(sessionId, prompt)
    },
    onSuccess: (data, variables) => {
      // Invalidate sessions to refresh the list
      queryClient.invalidateQueries({ queryKey: CLAUDE_CODE_KEYS.sessions() })

      // Update the specific session
      queryClient.invalidateQueries({ queryKey: CLAUDE_CODE_KEYS.session(variables.sessionId) })

      toast.success(`Session continued - Cost: $${data.totalCostUsd.toFixed(4)}`)
    },
    onError: (error: Error) => {
      console.error('Session continuation failed:', error)
      toast.error(`Failed to continue session: ${error.message}`)
    }
  })
}

export function useDeleteClaudeCodeSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (sessionId: string): Promise<void> => {
      await octoClient.claudeCode.deleteSession(sessionId)
    },
    onSuccess: (_, sessionId) => {
      // Remove the session from the cache
      queryClient.removeQueries({ queryKey: CLAUDE_CODE_KEYS.session(sessionId) })

      // Invalidate sessions list to refresh
      queryClient.invalidateQueries({ queryKey: CLAUDE_CODE_KEYS.sessions() })

      toast.success('Session deleted')
    },
    onError: (error: Error) => {
      console.error('Session deletion failed:', error)
      toast.error(`Failed to delete session: ${error.message}`)
    }
  })
}

// Streaming hook for real-time execution
export function useClaudeCodeStream() {
  return {
    executeStream: async function* (
      request: ClaudeCodeRequest,
      onMessage?: (message: any) => void
    ): AsyncGenerator<any, void, unknown> {
      const stream = await octoClient.claudeCode.streamQuery(request)

      const reader = stream.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.trim()) {
              try {
                const message = JSON.parse(line)
                onMessage?.(message)
                yield message
              } catch (e) {
                console.warn('Failed to parse stream message:', line)
              }
            }
          }
        }
      } finally {
        reader.releaseLock()
      }
    }
  }
}

export function useInvalidateClaudeCodeSessions() {
  const queryClient = useQueryClient()

  return () => {
    queryClient.invalidateQueries({ queryKey: CLAUDE_CODE_KEYS.sessions() })
  }
}

// Hook for getting file changes
export function useGetSessionFileChanges(sessionId: string) {
  return useQuery({
    queryKey: [...CLAUDE_CODE_KEYS.all, 'file-changes', sessionId],
    queryFn: () => octoClient.claudeCode.getSessionFileChanges(sessionId),
    enabled: !!sessionId,
    staleTime: 30 * 1000
  })
}

// Hook for getting audit logs
export function useGetClaudeCodeAuditLogs(query?: GetAuditLogsQuery) {
  return useQuery({
    queryKey: [...CLAUDE_CODE_KEYS.all, 'audit-logs', query],
    queryFn: () => octoClient.claudeCode.getAuditLogs(query),
    staleTime: 60 * 1000 // 1 minute
  })
}

// Hook for getting session audit summary
export function useGetSessionAuditSummary(sessionId: string) {
  return useQuery({
    queryKey: [...CLAUDE_CODE_KEYS.all, 'audit-summary', sessionId],
    queryFn: () => octoClient.claudeCode.getSessionAuditSummary(sessionId),
    enabled: !!sessionId,
    staleTime: 60 * 1000
  })
}
