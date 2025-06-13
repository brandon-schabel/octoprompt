import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

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

export interface ClaudeCodeSession {
  id: string
  created: number
  projectPath?: string
  status: 'idle' | 'running' | 'error'
  lastActivity: number
}

export interface ClaudeCodeResult {
  sessionId: string
  messages: any[]
  totalCostUsd: number
  isError: boolean
  durationMs: number
  numTurns: number
}

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
      const response = await fetch('/api/claude-code/sessions')
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      const data = await response.json()
      return data.sessions as ClaudeCodeSession[]
    },
    staleTime: 30 * 1000 // 30 seconds
  })
}

export function useGetClaudeCodeSession(sessionId: string) {
  return useQuery({
    queryKey: CLAUDE_CODE_KEYS.session(sessionId),
    queryFn: async () => {
      const response = await fetch(`/api/claude-code/sessions/${sessionId}`)
      if (!response.ok) {
        if (response.status === 404) {
          return null
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      return response.json() as Promise<ClaudeCodeSession>
    },
    enabled: !!sessionId,
    staleTime: 30 * 1000 // 30 seconds
  })
}

export function useExecuteClaudeCode() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (request: ClaudeCodeRequest): Promise<ClaudeCodeResult> => {
      const response = await fetch('/api/claude-code/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      return response.json()
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
      const response = await fetch(`/api/claude-code/sessions/${sessionId}/continue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      return response.json()
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
      const response = await fetch(`/api/claude-code/sessions/${sessionId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`)
      }
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
      const response = await fetch('/api/claude-code/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body reader')
      }

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
