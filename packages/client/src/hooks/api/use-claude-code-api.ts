import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  ClaudeSession,
  ClaudeMessage,
  ClaudeProjectData,
  ClaudeSessionQuerySchema,
  ClaudeMessageQuerySchema
} from '@promptliano/schemas'
import { z } from 'zod'
import { useApiClient } from './use-api-client'
import { toast } from 'sonner'
import { useCallback, useEffect, useRef } from 'react'

// Query keys
const CLAUDE_CODE_KEYS = {
  all: ['claude-code'] as const,
  sessions: (projectId: number) => [...CLAUDE_CODE_KEYS.all, 'sessions', projectId] as const,
  sessionsWithQuery: (projectId: number, query?: z.infer<typeof ClaudeSessionQuerySchema>) =>
    [...CLAUDE_CODE_KEYS.sessions(projectId), query] as const,
  messages: (projectId: number, sessionId: string) =>
    [...CLAUDE_CODE_KEYS.all, 'messages', projectId, sessionId] as const,
  messagesWithQuery: (projectId: number, sessionId: string, query?: z.infer<typeof ClaudeMessageQuerySchema>) =>
    [...CLAUDE_CODE_KEYS.messages(projectId, sessionId), query] as const,
  projectData: (projectId: number) => [...CLAUDE_CODE_KEYS.all, 'project-data', projectId] as const
}

/**
 * Hook to get Claude Code sessions for a project
 */
export function useClaudeSessions(
  projectId: number | undefined,
  query?: z.infer<typeof ClaudeSessionQuerySchema>,
  options?: {
    enabled?: boolean
    refetchInterval?: number | false
  }
) {
  const client = useApiClient()
  // Client null check removed - handled by React Query

  return useQuery({
    queryKey: CLAUDE_CODE_KEYS.sessionsWithQuery(projectId ?? 0, query),
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID is required')
      const response = await client.claudeCode.getSessions(projectId, query)
      return response.data
    },
    enabled: !!client && options?.enabled !== false && !!projectId,
    refetchInterval: options?.refetchInterval
  })
}

/**
 * Hook to get messages for a specific Claude Code session
 */
export function useClaudeMessages(
  projectId: number | undefined,
  sessionId: string | undefined,
  query?: z.infer<typeof ClaudeMessageQuerySchema>,
  options?: {
    enabled?: boolean
    refetchInterval?: number | false
  }
) {
  const client = useApiClient()
  // Client null check removed - handled by React Query

  return useQuery({
    queryKey: CLAUDE_CODE_KEYS.messagesWithQuery(projectId ?? 0, sessionId ?? '', query),
    queryFn: async () => {
      if (!projectId || !sessionId) throw new Error('Project ID and Session ID are required')
      const response = await client.claudeCode.getSessionMessages(projectId, sessionId, query)
      return response.data
    },
    enabled: !!client && options?.enabled !== false && !!projectId && !!sessionId,
    refetchInterval: options?.refetchInterval
  })
}

/**
 * Hook to get Claude Code project data
 */
export function useClaudeProjectData(
  projectId: number | undefined,
  options?: {
    enabled?: boolean
    refetchInterval?: number | false
  }
) {
  const client = useApiClient()
  // Client null check removed - handled by React Query

  return useQuery({
    queryKey: CLAUDE_CODE_KEYS.projectData(projectId ?? 0),
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID is required')
      const response = await client.claudeCode.getProjectData(projectId)
      return response.data
    },
    enabled: !!client && options?.enabled !== false && !!projectId,
    refetchInterval: options?.refetchInterval
  })
}

/**
 * Hook to watch Claude Code sessions for real-time updates
 * Note: This requires implementing WebSocket or SSE support on the backend
 */
export function useWatchClaudeSessions(
  projectId: number | undefined,
  options?: {
    enabled?: boolean
    onUpdate?: (sessions: ClaudeSession[]) => void
  }
) {
  const queryClient = useQueryClient()
  const cleanupRef = useRef<(() => void) | null>(null)
  const client = useApiClient()
  // Client null check removed - handled by React Query

  useEffect(() => {
    if (!projectId || options?.enabled === false) return

    // TODO: Implement WebSocket/SSE connection for real-time updates
    // For now, we'll use polling as a fallback
    const interval = setInterval(async () => {
      try {
        const response = await client.claudeCode.getSessions(projectId)
        const sessions = response.data

        // Update cache
        queryClient.setQueryData(CLAUDE_CODE_KEYS.sessions(projectId), sessions)

        // Call callback if provided
        options?.onUpdate?.(sessions)
      } catch (error) {
        console.error('Failed to fetch Claude sessions:', error)
      }
    }, 5000) // Poll every 5 seconds

    cleanupRef.current = () => clearInterval(interval)

    return () => {
      cleanupRef.current?.()
    }
  }, [projectId, options?.enabled, queryClient, options?.onUpdate, client])

  return {
    stop: useCallback(() => {
      cleanupRef.current?.()
    }, [])
  }
}

/**
 * Hook to copy text to clipboard with toast feedback
 */
export function useCopyToClipboard() {
  return useMutation({
    mutationFn: async (text: string) => {
      await navigator.clipboard.writeText(text)
      return text
    },
    onSuccess: () => {
      toast.success('Copied to clipboard')
    },
    onError: () => {
      toast.error('Failed to copy. Please try again.')
    }
  })
}

/**
 * Hook to format Claude message content
 */
export function useFormatClaudeMessage() {
  return useCallback((content: string | Array<any>) => {
    if (typeof content === 'string') {
      return content
    }

    return content
      .map((item) => {
        if (typeof item === 'string') return item
        if (item.type === 'text') return item.text
        if (item.type === 'image') return '[Image]'
        return ''
      })
      .join('')
  }, [])
}

/**
 * Hook to get session duration
 */
export function useSessionDuration(startTime: string, endTime: string) {
  const start = new Date(startTime).getTime()
  const end = new Date(endTime).getTime()
  const duration = end - start

  const hours = Math.floor(duration / (1000 * 60 * 60))
  const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((duration % (1000 * 60)) / 1000)

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  } else {
    return `${seconds}s`
  }
}
