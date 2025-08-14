import { DataResponseSchema } from '@promptliano/api-client'
import type { CreateProjectBody, UpdateProjectBody, Project, ProjectFile } from '@promptliano/schemas'

import type { CreateChatBody, UpdateChatBody, Chat, ChatMessage, AiChatStreamRequest } from '@promptliano/schemas'

import type { CreatePromptBody, UpdatePromptBody, Prompt, OptimizePromptRequest } from '@promptliano/schemas'

// packages/client/src/hooks/api/use-keys-api-v2.ts
import type { CreateProviderKeyBody, UpdateProviderKeyBody, ProviderKey } from '@promptliano/schemas'

import type { CreateClaudeAgentBody, UpdateClaudeAgentBody, ClaudeAgent } from '@promptliano/schemas'

import type {
  MarkdownImportRequest,
  MarkdownExportRequest,
  BatchExportRequest,
  BulkImportResponse,
  MarkdownExportResponse,
  MarkdownContentValidation
} from '@promptliano/schemas'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
import { useApiClient } from './api/use-api-client'
import { AGENT_KEYS } from './api/use-agents-api'
import { SERVER_HTTP_ENDPOINT } from '@/constants/server-constants'

// Query Keys - simplified
const CHAT_KEYS = {
  all: ['chats'] as const,
  list: () => [...CHAT_KEYS.all, 'list'] as const,
  detail: (chatId: number) => [...CHAT_KEYS.all, 'detail', chatId] as const,
  messages: (chatId: number) => [...CHAT_KEYS.all, 'messages', chatId] as const
}

// --- Query Hooks ---
export function useGetChats() {
  const client = useApiClient()

  return useQuery({
    queryKey: CHAT_KEYS.list(),
    enabled: !!client,
    queryFn: () => (client ? client.chats.listChats() : Promise.reject(new Error('Client not connected'))),
    staleTime: 5 * 60 * 1000 // 5 minutes
  })
}

export function useGetChat(chatId: number) {
  const client = useApiClient()

  return useQuery({
    queryKey: CHAT_KEYS.detail(chatId),
    queryFn: () => (client ? client.chats.getChat(chatId) : Promise.reject(new Error('Client not connected'))),
    enabled: !!client && !!chatId,
    staleTime: 5 * 60 * 1000
  })
}

export function useGetMessages(chatId: number) {
  const client = useApiClient()

  return useQuery({
    queryKey: CHAT_KEYS.messages(chatId),
    queryFn: () => (client ? client.chats.getMessages(chatId) : Promise.reject(new Error('Client not connected'))),
    enabled: !!client && !!chatId,
    staleTime: 30 * 1000 // 30 seconds for messages
  })
}

// --- Mutation Hooks ---
export function useCreateChat() {
  const client = useApiClient()

  const { invalidateAllChats } = useInvalidateChats()

  return useMutation({
    mutationFn: (data: CreateChatBody) => {
      if (!client) throw new Error('API client not initialized')
      return client.chats.createChat(data)
    },
    onSuccess: (newChat) => {
      invalidateAllChats()
      toast.success('Chat created successfully')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create chat')
    }
  })
}

export function useUpdateChat() {
  const client = useApiClient()

  const { invalidateAllChats, setChatDetail } = useInvalidateChats()

  return useMutation({
    mutationFn: ({ chatId, data }: { chatId: number; data: UpdateChatBody }) => {
      if (!client) throw new Error('API client not initialized')
      return client.chats.updateChat(chatId, data)
    },
    onSuccess: ({ data: updatedChat }: DataResponseSchema<Chat>) => {
      invalidateAllChats()
      setChatDetail(updatedChat)
      toast.success('Chat updated successfully')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update chat')
    }
  })
}

export function useDeleteChat() {
  const client = useApiClient()

  const { invalidateAllChats, removeChat } = useInvalidateChats()

  return useMutation({
    mutationFn: (chatId: number) => {
      if (!client) throw new Error('API client not initialized')
      return client.chats.deleteChat(chatId)
    },
    onSuccess: (_, chatId) => {
      invalidateAllChats()
      removeChat(chatId)
      toast.success('Chat deleted successfully')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete chat')
    }
  })
}

export function useForkChat() {
  const client = useApiClient()

  const { invalidateAllChats } = useInvalidateChats()

  return useMutation({
    mutationFn: ({ chatId, excludeMessageIds }: { chatId: number; excludeMessageIds?: number[] }) => {
      if (!client) throw new Error('API client not initialized')
      return client.chats.forkChat(chatId, { excludedMessageIds: excludeMessageIds || [] })
    },
    onSuccess: (newChat) => {
      invalidateAllChats()
      toast.success('Chat forked successfully')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to fork chat')
    }
  })
}

export function useForkChatFromMessage() {
  const client = useApiClient()

  const { invalidateAllChats } = useInvalidateChats()

  return useMutation({
    mutationFn: ({
      chatId,
      messageId,
      excludedMessageIds
    }: {
      chatId: number
      messageId: number
      excludedMessageIds?: number[]
    }) => {
      if (!client) throw new Error('API client not initialized')
      return client.chats.forkChatFromMessage(chatId, messageId, {
        excludedMessageIds: excludedMessageIds || []
      })
    },
    onSuccess: (newChat) => {
      invalidateAllChats()
      toast.success('Chat forked from message successfully')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to fork chat from message')
    }
  })
}

export function useDeleteMessage() {
  const client = useApiClient()

  const { invalidateChatMessages } = useInvalidateChats()

  return useMutation({
    mutationFn: ({ chatId, messageId }: { chatId: number; messageId: number }) => {
      if (!client) throw new Error('API client not initialized')
      return client.chats.deleteMessage(chatId, messageId)
    },
    onSuccess: (_, { chatId }) => {
      invalidateChatMessages(chatId)
      toast.success('Message deleted successfully')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete message')
    }
  })
}

export function useStreamChat() {
  const client = useApiClient()

  return useMutation({
    mutationFn: (data: AiChatStreamRequest) => {
      if (!client) throw new Error('API client not initialized')
      return client.chats.streamChat(data)
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to start chat stream')
    }
  })
}

// --- Enhanced AI Chat Hook ---
export function useAIChatV2({
  chatId,
  provider,
  model,
  systemMessage
}: {
  chatId: number
  provider: string
  model: string
  systemMessage?: string
}) {
  const { data: messages, refetch: refetchMessages } = useGetMessages(chatId)
  const streamChat = useStreamChat()

  const sendMessage = async (userMessage: string, options?: any) => {
    try {
      const stream = await streamChat.mutateAsync({
        chatId,
        userMessage,
        systemMessage,
        options: {
          provider,
          model,
          ...options
        }
      })

      // Return the stream for the UI to handle
      return stream
    } catch (error) {
      throw error
    }
  }

  return {
    messages: messages || [],
    sendMessage,
    isLoading: streamChat.isPending,
    error: streamChat.error,
    refetchMessages
  }
}

const PROJECT_KEYS = {
  all: ['projects'] as const,
  list: () => [...PROJECT_KEYS.all, 'list'] as const,
  detail: (projectId: number) => [...PROJECT_KEYS.all, 'detail', projectId] as const,
  files: (projectId: number) => [...PROJECT_KEYS.all, 'files', projectId] as const,
  filesWithoutContent: (projectId: number) => [...PROJECT_KEYS.all, 'filesWithoutContent', projectId] as const,
  summary: (projectId: number) => [...PROJECT_KEYS.all, 'summary', projectId] as const,
  statistics: (projectId: number) => [...PROJECT_KEYS.all, 'statistics', projectId] as const,
  fileVersions: (projectId: number, originalFileId: number) =>
    [...PROJECT_KEYS.all, 'fileVersions', projectId, originalFileId] as const,
  fileVersion: (projectId: number, originalFileId: number, version?: number) =>
    [...PROJECT_KEYS.all, 'fileVersion', projectId, originalFileId, version || 'latest'] as const
}

// --- Query Hooks ---
export function useGetProjects() {
  const client = useApiClient()

  return useQuery({
    queryKey: PROJECT_KEYS.list(),
    enabled: !!client,
    queryFn: () => (client ? client.projects.listProjects() : Promise.reject(new Error('Client not connected'))),
    staleTime: 5 * 60 * 1000
  })
}

export function useGetProject(projectId: number) {
  const client = useApiClient()

  return useQuery({
    queryKey: PROJECT_KEYS.detail(projectId),
    queryFn: () => (client ? client.projects.getProject(projectId) : Promise.reject(new Error('Client not connected'))),
    enabled: !!client && !!projectId && projectId !== -1,
    staleTime: 5 * 60 * 1000
  })
}

export function useGetProjectFiles(projectId: number) {
  const client = useApiClient()

  return useQuery({
    queryKey: PROJECT_KEYS.files(projectId),
    queryFn: () =>
      client ? client.projects.getProjectFiles(projectId) : Promise.reject(new Error('Client not connected')),
    enabled: !!client && !!projectId && projectId !== -1,
    staleTime: 2 * 60 * 1000, // 2 minutes for files
    refetchOnWindowFocus: true
  })
}

export function useGetProjectFilesWithoutContent(projectId: number) {
  const client = useApiClient()

  return useQuery({
    queryKey: PROJECT_KEYS.filesWithoutContent(projectId),
    queryFn: () =>
      client
        ? client.projects.getProjectFilesWithoutContent(projectId)
        : Promise.reject(new Error('Client not connected')),
    enabled: !!client && !!projectId && projectId !== -1,
    staleTime: 5 * 60 * 1000, // 5 minutes for file metadata
    refetchOnWindowFocus: true
  })
}

export function useGetProjectSummary(projectId: number) {
  const client = useApiClient()

  return useQuery({
    queryKey: PROJECT_KEYS.summary(projectId),
    queryFn: () =>
      client ? client.projects.getProjectSummary(projectId) : Promise.reject(new Error('Client not connected')),
    enabled: !!client && !!projectId && projectId !== -1,
    staleTime: 10 * 60 * 1000 // 10 minutes for summary
  })
}

export function useGetProjectStatistics(projectId: number) {
  const client = useApiClient()

  return useQuery({
    queryKey: PROJECT_KEYS.statistics(projectId),
    queryFn: () =>
      client ? client.projects.getProjectStatistics(projectId) : Promise.reject(new Error('Client not connected')),
    enabled: !!client && !!projectId && projectId !== -1,
    staleTime: 5 * 60 * 1000 // 5 minutes cache for statistics
  })
}

// --- Mutation Hooks ---
export function useCreateProject() {
  const client = useApiClient()

  const { invalidateAllProjects } = useInvalidateProjects()

  return useMutation({
    mutationFn: (data: CreateProjectBody) => {
      if (!client) throw new Error('API client not initialized')
      return client.projects.createProject(data)
    },
    onSuccess: (newProject) => {
      invalidateAllProjects()
      toast.success('Project created successfully')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create project')
    }
  })
}

export function useUpdateProject() {
  const client = useApiClient()

  const { invalidateAllProjects, setProjectDetail } = useInvalidateProjects()

  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: number; data: UpdateProjectBody }) => {
      if (!client) throw new Error('API client not initialized')
      return client.projects.updateProject(projectId, data)
    },
    onSuccess: ({ data: updatedProject }: DataResponseSchema<Project>) => {
      invalidateAllProjects()
      setProjectDetail(updatedProject)
      toast.success('Project updated successfully')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update project')
    }
  })
}

export function useDeleteProject() {
  const client = useApiClient()

  const { invalidateAllProjects, removeProject } = useInvalidateProjects()
  const { removeProjectPrompts } = useInvalidatePrompts()

  return useMutation({
    mutationFn: (projectId: number) => {
      if (!client) throw new Error('API client not initialized')
      return client.projects.deleteProject(projectId)
    },
    onSuccess: (_, projectId) => {
      invalidateAllProjects()
      removeProject(projectId)
      removeProjectPrompts(projectId)
      toast.success('Project deleted successfully')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete project')
    }
  })
}

export function useSyncProject() {
  const client = useApiClient()

  const { invalidateProjectFiles, invalidateProject } = useInvalidateProjects()

  return useMutation({
    mutationFn: (projectId: number) => {
      if (!client) throw new Error('API client not initialized')
      return client.projects.syncProject(projectId)
    },
    onSuccess: (_, projectId) => {
      invalidateProjectFiles(projectId)
      invalidateProject(projectId)
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to sync project')
    },
    // Add retry configuration for sync operations
    retry: 2, // Retry up to 2 times on failure
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000) // Exponential backoff with max 10s
  })
}

// New SSE-based sync hook with progress tracking
export function useSyncProjectWithProgress() {
  const { invalidateProjectFiles, invalidateProject } = useInvalidateProjects()
  const eventSourceRef = useRef<EventSource | null>(null)

  // Cleanup function to close EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [])

  const syncWithProgress = useCallback(
    (
      projectId: number, 
      onProgress?: (event: import('@promptliano/schemas').SyncProgressEvent) => void,
      abortSignal?: AbortSignal
    ) => {
      return new Promise<{ created: number; updated: number; deleted: number; skipped: number }>(
        (resolve, reject) => {
          // Clean up any existing connection
          if (eventSourceRef.current) {
            eventSourceRef.current.close()
          }

          const eventSource = new EventSource(`${SERVER_HTTP_ENDPOINT}/api/projects/${projectId}/sync-stream`)
          eventSourceRef.current = eventSource

          // Handle abort signal for cancellation
          if (abortSignal) {
            abortSignal.addEventListener('abort', () => {
              eventSource.close()
              eventSourceRef.current = null
              reject(new Error('Sync cancelled'))
            })
          }

          let retryCount = 0
          const maxRetries = 3

          eventSource.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data)

              if (data.type === 'progress' && onProgress) {
                onProgress(data.data)
              } else if (data.type === 'complete') {
                eventSource.close()
                eventSourceRef.current = null
                invalidateProjectFiles(projectId)
                invalidateProject(projectId)
                resolve(data.data)
              } else if (data.type === 'error') {
                eventSource.close()
                eventSourceRef.current = null
                reject(new Error(data.data.message || 'Sync failed'))
              }
            } catch (error) {
              console.error('Error parsing SSE data:', error)
            }
          }

          eventSource.onerror = (error) => {
            console.error('SSE error:', error)
            
            // Implement retry logic with exponential backoff
            if (retryCount < maxRetries) {
              retryCount++
              const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 5000)
              console.log(`Retrying SSE connection in ${retryDelay}ms (attempt ${retryCount}/${maxRetries})`)
              
              setTimeout(() => {
                // Check if not aborted
                if (abortSignal?.aborted) {
                  return
                }
                
                // Close old connection and create new one
                eventSource.close()
                const newEventSource = new EventSource(`${SERVER_HTTP_ENDPOINT}/api/projects/${projectId}/sync-stream`)
                eventSourceRef.current = newEventSource
                
                // Reattach event handlers
                newEventSource.onmessage = eventSource.onmessage
                newEventSource.onerror = eventSource.onerror
              }, retryDelay)
            } else {
              eventSource.close()
              eventSourceRef.current = null
              reject(new Error('Connection to sync stream failed after retries'))
            }
          }
        }
      )
    },
    [invalidateProjectFiles, invalidateProject]
  )

  return { syncWithProgress }
}

export function useRefreshProject() {
  const client = useApiClient()

  const { invalidateProjectFiles } = useInvalidateProjects()

  return useMutation({
    mutationFn: ({ projectId, folder }: { projectId: number; folder?: string }) => {
      if (!client) throw new Error('API client not initialized')
      return client.projects.refreshProject(projectId, folder ? { folder } : undefined)
    },
    onSuccess: (_, { projectId }) => {
      invalidateProjectFiles(projectId)
      toast.success('Project refreshed successfully')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to refresh project')
    }
  })
}

export function useUpdateFileContent() {
  const client = useApiClient()

  const { invalidateProjectFiles } = useInvalidateProjects()

  return useMutation({
    mutationFn: async ({ projectId, fileId, content }: { projectId: number; fileId: number; content: string }) => {
      if (!client) throw new Error('API client not initialized')

      // Update the file content
      const result = await client.projects.updateFileContent(projectId, fileId, content)

      // Sync the project to ensure file system and data store are synchronized
      await client.projects.syncProject(projectId)

      return result
    },
    onSuccess: (_, { projectId }) => {
      invalidateProjectFiles(projectId)
      toast.success('File updated successfully')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update file')
    }
  })
}

export function useSuggestFiles() {
  const client = useApiClient()

  return useMutation({
    mutationFn: async ({ projectId, prompt, limit = 10 }: { projectId: number; prompt: string; limit?: number }) => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.projects.suggestFiles(projectId, { prompt, limit })
      return response.data
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to suggest files')
    }
  })
}

export function useSummarizeProjectFiles() {
  const client = useApiClient()

  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      projectId,
      fileIds,
      force = false
    }: {
      projectId: number
      fileIds: number[]
      force?: boolean
    }) => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.projects.summarizeFiles(projectId, { fileIds, force })
      return response.data
    },
    onSuccess: (data, variables) => {
      // Invalidate project files to refresh summaries
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.files(variables.projectId) })
      toast.success(`Summarized ${data.included} files`)
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to summarize files')
    }
  })
}

export function useRemoveSummariesFromFiles() {
  const client = useApiClient()

  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ projectId, fileIds }: { projectId: number; fileIds: number[] }) => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.projects.removeSummariesFromFiles(projectId, { fileIds })
      return response.data
    },
    onSuccess: (data, variables) => {
      // Invalidate project files to refresh summaries
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.files(variables.projectId) })
      toast.success(`Removed summaries from ${data.removedCount} files`)
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to remove summaries')
    }
  })
}

const PROMPT_KEYS = {
  all: ['prompts'] as const,
  list: () => [...PROMPT_KEYS.all, 'list'] as const,
  detail: (promptId: number) => [...PROMPT_KEYS.all, 'detail', promptId] as const,
  projectPrompts: (projectId: number) => [...PROMPT_KEYS.all, 'project', projectId] as const
}

// --- Query Hooks ---
export function useGetAllPrompts() {
  const client = useApiClient()

  return useQuery({
    queryKey: PROMPT_KEYS.list(),
    enabled: !!client,
    queryFn: () => (client ? client.prompts.listPrompts() : Promise.reject(new Error('Client not connected'))),
    staleTime: 5 * 60 * 1000
  })
}

export function useGetPrompt(promptId: number) {
  const client = useApiClient()

  return useQuery({
    queryKey: PROMPT_KEYS.detail(promptId),
    queryFn: () => (client ? client.prompts.getPrompt(promptId) : Promise.reject(new Error('Client not connected'))),
    enabled: !!client && !!promptId,
    staleTime: 5 * 60 * 1000
  })
}

export function useGetProjectPrompts(projectId: number) {
  const client = useApiClient()

  return useQuery({
    queryKey: PROMPT_KEYS.projectPrompts(projectId),
    queryFn: () =>
      client ? client.prompts.listProjectPrompts(projectId) : Promise.reject(new Error('Client not connected')),
    enabled: !!client && !!projectId && projectId !== -1,
    staleTime: 5 * 60 * 1000
  })
}

// --- Mutation Hooks ---
export function useCreatePrompt() {
  const client = useApiClient()

  const { invalidateAllPrompts } = useInvalidatePrompts()

  return useMutation({
    mutationFn: (data: CreatePromptBody) => {
      if (!client) throw new Error('API client not initialized')
      return client.prompts.createPrompt(data)
    },
    onSuccess: (newPrompt) => {
      invalidateAllPrompts()
      toast.success('Prompt created successfully')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create prompt')
    }
  })
}

export function useUpdatePrompt() {
  const client = useApiClient()

  const { invalidateAllPrompts, setPromptDetail } = useInvalidatePrompts()

  return useMutation({
    mutationFn: ({ promptId, data }: { promptId: number; data: UpdatePromptBody }) => {
      if (!client) throw new Error('API client not initialized')
      return client.prompts.updatePrompt(promptId, data)
    },
    onSuccess: ({ data: updatedPrompt }: DataResponseSchema<Prompt>) => {
      invalidateAllPrompts()
      setPromptDetail(updatedPrompt)
      toast.success('Prompt updated successfully')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update prompt')
    }
  })
}

export function useDeletePrompt() {
  const client = useApiClient()

  const invalidatePrompts = useInvalidatePrompts()

  return useMutation({
    mutationFn: ({ promptId }: { promptId: number }) => {
      if (!client) throw new Error('API client not initialized')
      return client.prompts.deletePrompt(promptId)
    },
    onSuccess: (_, { promptId }) => {
      // Invalidate all prompt-related queries including project prompts
      invalidatePrompts.invalidateAllPrompts()
      invalidatePrompts.removePrompt(promptId)
      toast.success('Prompt deleted successfully')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete prompt')
    }
  })
}

export function useAddPromptToProject() {
  const client = useApiClient()

  const invalidatePrompts = useInvalidatePrompts()

  return useMutation({
    mutationFn: ({ projectId, promptId }: { projectId: number; promptId: number }) => {
      if (!client) throw new Error('API client not initialized')
      return client.prompts.addPromptToProject(projectId, promptId)
    },
    onSuccess: (_, { projectId }) => {
      // Invalidate both project-specific prompts and all prompts list
      invalidatePrompts.invalidateProjectPrompts(projectId)
      invalidatePrompts.invalidateAllPrompts()
      toast.success('Prompt added to project successfully')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to add prompt to project')
    }
  })
}

export function useRemovePromptFromProject() {
  const client = useApiClient()

  const invalidatePrompts = useInvalidatePrompts()

  return useMutation({
    mutationFn: ({ projectId, promptId }: { projectId: number; promptId: number }) => {
      if (!client) throw new Error('API client not initialized')
      return client.prompts.removePromptFromProject(projectId, promptId)
    },
    onSuccess: (_, { projectId }) => {
      // Invalidate both project-specific prompts and all prompts list
      invalidatePrompts.invalidateProjectPrompts(projectId)
      invalidatePrompts.invalidateAllPrompts()
      toast.success('Prompt removed from project successfully')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to remove prompt from project')
    }
  })
}

export function useOptimizeUserInput() {
  const client = useApiClient()

  return useMutation({
    mutationFn: (data: OptimizePromptRequest) => {
      if (!client) throw new Error('API client not initialized')
      return client.prompts.optimizeUserInput(data)
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to optimize user input')
    }
  })
}

export function useSuggestPrompts() {
  const client = useApiClient()

  return useMutation({
    mutationFn: async ({
      projectId,
      userInput,
      limit = 5
    }: {
      projectId: number
      userInput: string
      limit?: number
    }) => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.prompts.suggestPrompts(projectId, { userInput, limit })
      return response.data.prompts
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to suggest prompts')
    }
  })
}

// --- Markdown Import/Export Hooks ---

/**
 * Hook to import markdown files containing prompts
 * Supports bulk import with progress tracking
 */
export function useImportMarkdownPrompts() {
  const client = useApiClient()
  const { invalidateAllPrompts, invalidateAllPromptsAndProjects } = useInvalidatePrompts()

  return useMutation({
    mutationFn: async ({ files, options = {} }: { files: File[]; options?: Partial<MarkdownImportRequest> }) => {
      if (!client) throw new Error('Client not connected')

      // Create FormData for multipart upload
      const formData = new FormData()
      files.forEach((file) => formData.append('files', file))
      if (options.projectId) formData.append('projectId', options.projectId.toString())
      if (options.overwriteExisting) formData.append('overwriteExisting', 'true')

      const response = await fetch('/api/prompts/import', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to import prompts')
      }

      return response.json()
    },
    onSuccess: (result: any, variables) => {
      // Invalidate all prompts and optionally project prompts
      invalidateAllPromptsAndProjects(variables.options?.projectId)

      // Access the summary from result.data
      const successCount = result.data?.summary?.created || 0
      const updatedCount = result.data?.summary?.updated || 0
      const errorCount = result.data?.summary?.failed || 0
      const totalSuccessful = successCount + updatedCount

      if (totalSuccessful > 0 && errorCount === 0) {
        toast.success(`Successfully imported ${totalSuccessful} prompt${totalSuccessful > 1 ? 's' : ''}`)
      } else if (totalSuccessful > 0 && errorCount > 0) {
        toast.warning(`Imported ${totalSuccessful} prompt${totalSuccessful > 1 ? 's' : ''}, ${errorCount} failed`)
      } else {
        toast.error('Failed to import any prompts')
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to import markdown prompts')
    }
  })
}

/**
 * Hook to export a single prompt as markdown
 * Returns markdown text and triggers download
 */
export function useExportPromptAsMarkdown() {
  const client = useApiClient()

  return useMutation({
    mutationFn: async ({
      promptId,
      options = {},
      filename
    }: {
      promptId: number
      options?: Partial<MarkdownExportRequest>
      filename?: string
    }) => {
      if (!client) throw new Error('Client not connected')

      const response = await fetch(`/api/prompts/${promptId}/export`, {
        method: 'GET'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to export prompt')
      }

      const markdown = await response.text()
      return { markdown, filename: filename || `prompt-${promptId}.md` }
    },
    onSuccess: ({ markdown, filename }) => {
      // Create blob and trigger download
      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success('Prompt exported successfully')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to export prompt')
    }
  })
}

/**
 * Hook to export multiple prompts as markdown
 * Supports batch export with optional zip packaging
 */
export function useExportPromptsAsMarkdown() {
  const client = useApiClient()

  return useMutation({
    mutationFn: async ({ promptIds, options = {} }: { promptIds: number[]; options?: Partial<BatchExportRequest> }) => {
      if (!client) throw new Error('Client not connected')

      const response = await fetch('/api/prompts/export-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promptIds, ...options })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to export prompts')
      }

      return response.json()
    },
    onSuccess: (result: any, variables) => {
      const exportData = result.data

      if (exportData?.format === 'multi-file' && exportData?.files) {
        // Handle multiple file downloads
        exportData.files.forEach((file: any) => {
          const blob = new Blob([file.content], { type: 'text/markdown;charset=utf-8' })
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = file.filename
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          URL.revokeObjectURL(url)
        })
      } else if (exportData?.content) {
        // Single file export
        const blob = new Blob([exportData.content], { type: 'text/markdown;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = 'prompts-export.md'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }

      toast.success(`Exported ${variables.promptIds.length} prompt${variables.promptIds.length > 1 ? 's' : ''}`)
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to export prompts')
    }
  })
}

/**
 * Hook to validate markdown files before import
 * Useful for pre-validation and showing warnings to users
 */
export function useValidateMarkdownFile() {
  const client = useApiClient()

  return useMutation({
    mutationFn: async (file: File): Promise<MarkdownContentValidation & { isValid: boolean; metadata?: any }> => {
      if (!client) throw new Error('Client not connected')

      const content = await file.text()

      // Parse frontmatter and validate structure
      const validation: MarkdownContentValidation = {
        hasValidFrontmatter: false,
        hasRequiredFields: false,
        contentLength: content.length,
        estimatedPrompts: 0,
        warnings: [],
        errors: []
      }

      try {
        // Check for frontmatter
        if (!content.startsWith('---')) {
          validation.errors.push({ message: 'Missing frontmatter', path: [] } as any)
          return { isValid: false, ...validation }
        }

        const frontmatterEnd = content.indexOf('---', 3)
        if (frontmatterEnd === -1) {
          validation.errors.push({ message: 'Invalid frontmatter format', path: [] } as any)
          return { isValid: false, ...validation }
        }

        validation.hasValidFrontmatter = true

        // Extract frontmatter
        const frontmatterContent = content.substring(3, frontmatterEnd).trim()

        // Parse frontmatter as YAML-like structure
        let metadata: any = {}
        const lines = frontmatterContent.split('\n')
        for (const line of lines) {
          const colonIndex = line.indexOf(':')
          if (colonIndex > 0) {
            const key = line.substring(0, colonIndex).trim()
            const value = line.substring(colonIndex + 1).trim()
            metadata[key] = value
          }
        }

        // Check for required 'name' field
        if (!metadata.name) {
          validation.errors.push({ message: 'Missing required field: name', path: ['name'] } as any)
          validation.hasRequiredFields = false
        } else {
          validation.hasRequiredFields = true
          validation.estimatedPrompts = 1
        }

        // Check content after frontmatter
        const promptContent = content.substring(frontmatterEnd + 3).trim()
        if (promptContent.length === 0) {
          validation.warnings.push('Prompt content is empty')
        }

        validation.contentLength = promptContent.length

        return {
          isValid: validation.errors.length === 0,
          metadata,
          ...validation
        }
      } catch (error: any) {
        validation.errors.push({ message: error.message || 'Failed to validate file', path: [] } as any)
        return {
          isValid: false,
          ...validation
        }
      }
    },
    onSuccess: (validation: any) => {
      if (validation.isValid && validation.warnings.length === 0) {
        toast.success('Markdown file is valid')
      } else if (validation.isValid && validation.warnings.length > 0) {
        toast.warning(
          `File is valid but has ${validation.warnings.length} warning${validation.warnings.length > 1 ? 's' : ''}`
        )
      } else {
        toast.error(`Validation failed: ${validation.errors[0]?.message || 'Unknown error'}`)
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to validate markdown file')
    }
  })
}

/**
 * Hook to import markdown prompts for a specific project
 * Convenience wrapper for project-specific imports
 */
export function useImportProjectMarkdownPrompts() {
  const client = useApiClient()
  const { invalidateAllPromptsAndProjects } = useInvalidatePrompts()

  return useMutation({
    mutationFn: async ({
      projectId,
      files,
      options = {}
    }: {
      projectId: number
      files: File[]
      options?: Partial<Omit<MarkdownImportRequest, 'projectId'>>
    }) => {
      if (!client) throw new Error('Client not connected')

      // Create FormData for multipart upload
      const formData = new FormData()
      files.forEach((file) => formData.append('files', file))
      if (options.overwriteExisting) formData.append('overwriteExisting', 'true')

      const response = await fetch(`/api/projects/${projectId}/prompts/import`, {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to import prompts to project')
      }

      return response.json()
    },
    onSuccess: (result: any, variables) => {
      // Invalidate project-specific prompts
      invalidateAllPromptsAndProjects(variables.projectId)

      // Access the summary from result.data
      const successCount = result.data?.summary?.created || 0
      const updatedCount = result.data?.summary?.updated || 0
      const errorCount = result.data?.summary?.failed || 0
      const totalSuccessful = successCount + updatedCount

      if (totalSuccessful > 0 && errorCount === 0) {
        toast.success(`Successfully imported ${totalSuccessful} prompt${totalSuccessful > 1 ? 's' : ''} to project`)
      } else if (totalSuccessful > 0 && errorCount > 0) {
        toast.warning(
          `Imported ${totalSuccessful} prompt${totalSuccessful > 1 ? 's' : ''} to project, ${errorCount} failed`
        )
      } else {
        toast.error('Failed to import any prompts to project')
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to import markdown prompts to project')
    }
  })
}

/**
 * Hook to export all prompts from a project as markdown
 * Exports all prompts associated with a specific project
 */
export function useExportProjectPromptsAsMarkdown() {
  const client = useApiClient()

  return useMutation({
    mutationFn: async ({
      projectId,
      options = {}
    }: {
      projectId: number
      options?: Partial<Omit<MarkdownExportRequest, 'projectId'>>
    }) => {
      if (!client) throw new Error('Client not connected')

      const queryParams = new URLSearchParams()
      if (options.format) queryParams.append('format', options.format)
      if (options.sortBy) queryParams.append('sortBy', options.sortBy)
      if (options.sortOrder) queryParams.append('sortOrder', options.sortOrder)

      const response = await fetch(`/api/projects/${projectId}/prompts/export?${queryParams}`, {
        method: 'GET'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to export project prompts')
      }

      return response.json()
    },
    onSuccess: (result: any, variables) => {
      const exportData = result.data

      if (exportData?.format === 'multi-file' && exportData?.files) {
        // Handle multiple file downloads
        exportData.files.forEach((file: any) => {
          const blob = new Blob([file.content], { type: 'text/markdown;charset=utf-8' })
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = file.filename
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          URL.revokeObjectURL(url)
        })
      } else if (exportData?.content) {
        // Single file export
        const blob = new Blob([exportData.content], { type: 'text/markdown;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `project-${variables.projectId}-prompts.md`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }

      toast.success(`Exported all prompts from project`)
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to export project prompts')
    }
  })
}

// --- File Versioning Hooks ---
// TODO: Uncomment when file versioning is implemented in the API
// export function useGetFileVersions(projectId: number, originalFileId: number) {
//   return useQuery({
//     queryKey: PROJECT_KEYS.fileVersions(projectId, originalFileId),
//     queryFn: () => client ? client.projects.getFileVersions(projectId : Promise.reject(new Error('Client not connected')), originalFileId),
//     enabled: !!client && projectId > 0 && originalFileId > 0,
//     staleTime: 5 * 60 * 1000
//   })
// }

// export function useGetFileVersion(projectId: number, originalFileId: number, version?: number) {
//   return useQuery({
//     queryKey: PROJECT_KEYS.fileVersion(projectId, originalFileId, version),
//     queryFn: () => client ? client.projects.getFileVersion(projectId : Promise.reject(new Error('Client not connected')), originalFileId, version),
//     enabled: !!client && projectId > 0 && originalFileId > 0,
//     staleTime: 5 * 60 * 1000
//   })
// }

// export function useRevertFileToVersion() {
//   const { invalidateProjectFiles } = useInvalidateProjects()
//   const queryClient = useQueryClient()

//   return useMutation({
//     mutationFn: ({ projectId, fileId, targetVersion }: { projectId: number; fileId: number; targetVersion: number }) =>
//       client.projects.revertFileToVersion(projectId, fileId, targetVersion),
//     onSuccess: (_, { projectId }) => {
//       invalidateProjectFiles(projectId)
//       // Invalidate all version-related queries
//       queryClient.invalidateQueries({
//         queryKey: ['projects', 'fileVersions', projectId],
//         type: 'active'
//       })
//       queryClient.invalidateQueries({
//         queryKey: ['projects', 'fileVersion', projectId],
//         type: 'active'
//       })
//       toast.success('File reverted successfully')
//     },
//     onError: (error) => {
//       toast.error(error.message || 'Failed to revert file')
//     }
//   })
// }

const KEY_KEYS = {
  all: ['keys'] as const,
  list: () => [...KEY_KEYS.all, 'list'] as const,
  detail: (keyId: number) => [...KEY_KEYS.all, 'detail', keyId] as const
}

// --- Query Hooks ---
export function useGetKeys() {
  const client = useApiClient()

  return useQuery({
    queryKey: KEY_KEYS.list(),
    enabled: !!client,
    queryFn: () => (client ? client.keys.listKeys() : Promise.reject(new Error('Client not connected'))),
    staleTime: 10 * 60 * 1000 // 10 minutes for keys
  })
}

export function useGetKey(keyId: number) {
  const client = useApiClient()

  return useQuery({
    queryKey: KEY_KEYS.detail(keyId),
    queryFn: () => (client ? client.keys.getKey(keyId) : Promise.reject(new Error('Client not connected'))),
    enabled: !!client && !!keyId,
    staleTime: 10 * 60 * 1000
  })
}

// --- Mutation Hooks ---
export function useCreateKey() {
  const client = useApiClient()

  const { invalidateAllKeys } = useInvalidateKeys()

  return useMutation({
    mutationFn: (data: CreateProviderKeyBody) => {
      if (!client) throw new Error('API client not initialized')
      return client.keys.createKey(data)
    },
    onSuccess: (newKey) => {
      invalidateAllKeys()
      toast.success('API key created successfully')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create API key')
    }
  })
}

export function useUpdateKey() {
  const client = useApiClient()

  const { invalidateAllKeys, setKeyDetail } = useInvalidateKeys()

  return useMutation({
    mutationFn: ({ keyId, data }: { keyId: number; data: UpdateProviderKeyBody }) => {
      if (!client) throw new Error('API client not initialized')
      return client.keys.updateKey(keyId, data)
    },
    onSuccess: ({ data: updatedKey }: DataResponseSchema<ProviderKey>) => {
      invalidateAllKeys()
      setKeyDetail(updatedKey)
      toast.success('API key updated successfully')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update API key')
    }
  })
}

export function useDeleteKey() {
  const client = useApiClient()

  const { invalidateAllKeys, removeKey } = useInvalidateKeys()

  return useMutation({
    mutationFn: (keyId: number) => {
      if (!client) throw new Error('API client not initialized')
      return client.keys.deleteKey(keyId)
    },
    onSuccess: (_, keyId) => {
      invalidateAllKeys()
      removeKey(keyId)
      toast.success('API key deleted successfully')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete API key')
    }
  })
}

const TICKET_KEYS = {
  all: ['tickets'] as const,
  projectTickets: (projectId: number) => [...TICKET_KEYS.all, 'project', projectId] as const,
  detail: (ticketId: number) => [...TICKET_KEYS.all, 'detail', ticketId] as const,
  tasks: (ticketId: number) => [...TICKET_KEYS.all, 'tasks', ticketId] as const
}

// --- Utility Hooks for Complex Operations ---

// packages/client/src/hooks/api/use-promptliano-utils.ts
export function useInvalidateProject(projectId: number) {
  const queryClient = useQueryClient()

  return () => {
    queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.detail(projectId) })
    queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.files(projectId) })
    queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.summary(projectId) })
  }
}

export function useInvalidateChat(chatId: number) {
  const queryClient = useQueryClient()

  return () => {
    queryClient.invalidateQueries({ queryKey: CHAT_KEYS.detail(chatId) })
    queryClient.invalidateQueries({ queryKey: CHAT_KEYS.messages(chatId) })
  }
}

// --- Prompt Invalidation Utilities ---
export function useInvalidatePrompts() {
  const queryClient = useQueryClient()

  return {
    invalidateAllPrompts: () => {
      queryClient.invalidateQueries({ queryKey: PROMPT_KEYS.all })
    },
    invalidatePrompt: (promptId: number) => {
      queryClient.invalidateQueries({ queryKey: PROMPT_KEYS.detail(promptId) })
    },
    invalidateProjectPrompts: (projectId: number) => {
      queryClient.invalidateQueries({ queryKey: PROMPT_KEYS.projectPrompts(projectId) })
    },
    removePrompt: (promptId: number) => {
      queryClient.removeQueries({ queryKey: PROMPT_KEYS.detail(promptId) })
    },
    /** NEW: Removes queries for all prompts associated with a specific project. */
    removeProjectPrompts: (projectId: number) => {
      queryClient.removeQueries({ queryKey: PROMPT_KEYS.projectPrompts(projectId) })
    },
    /** NEW: Sets specific prompt detail in the cache. */
    setPromptDetail: (prompt: Prompt) => {
      queryClient.setQueryData(PROMPT_KEYS.detail(prompt.id), prompt)
    },
    invalidateAllPromptsAndProjects: (projectId?: number) => {
      queryClient.invalidateQueries({ queryKey: PROMPT_KEYS.all })
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: PROMPT_KEYS.projectPrompts(projectId) })
      }
    }
  }
}

// --- Project Invalidation Utilities ---
export function useInvalidateProjects() {
  const queryClient = useQueryClient()

  return {
    invalidateAllProjects: () => {
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.all })
    },
    invalidateProject: (projectId: number) => {
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.detail(projectId) })
    },
    invalidateProjectFiles: (projectId: number) => {
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.files(projectId) })
    },
    invalidateProjectSummary: (projectId: number) => {
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.summary(projectId) })
    },
    removeProject: (projectId: number) => {
      queryClient.removeQueries({ queryKey: PROJECT_KEYS.detail(projectId) })
      queryClient.removeQueries({ queryKey: PROJECT_KEYS.files(projectId) })
      queryClient.removeQueries({ queryKey: PROJECT_KEYS.summary(projectId) })
    },
    /** NEW: Sets specific project detail in the cache. */
    setProjectDetail: (project: Project) => {
      queryClient.setQueryData(PROJECT_KEYS.detail(project.id), project)
    },
    /** MODIFIED/CLARIFIED: Invalidate all data related to a project (including related entities by invalidation) */
    invalidateProjectData: (projectId: number) => {
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.detail(projectId) })
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.files(projectId) })
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.summary(projectId) })
      queryClient.invalidateQueries({ queryKey: PROMPT_KEYS.projectPrompts(projectId) })
      queryClient.invalidateQueries({ queryKey: TICKET_KEYS.projectTickets(projectId) })
      queryClient.invalidateQueries({ queryKey: AGENT_KEYS.projectAgents(projectId) })
    }
  }
}

// --- Chat Invalidation Utilities ---
export function useInvalidateChats() {
  const queryClient = useQueryClient()

  return {
    // Invalidate all chat-related queries
    invalidateAllChats: () => {
      queryClient.invalidateQueries({ queryKey: CHAT_KEYS.all })
    },

    // Invalidate specific chat detail
    invalidateChat: (chatId: number) => {
      queryClient.invalidateQueries({ queryKey: CHAT_KEYS.detail(chatId) })
    },

    // Invalidate chat messages
    invalidateChatMessages: (chatId: number) => {
      queryClient.invalidateQueries({ queryKey: CHAT_KEYS.messages(chatId) })
    },

    // Remove chat from cache completely
    removeChat: (chatId: number) => {
      queryClient.removeQueries({ queryKey: CHAT_KEYS.detail(chatId) })
      queryClient.removeQueries({ queryKey: CHAT_KEYS.messages(chatId) })
    },

    /** NEW: Sets specific chat detail in the cache. */
    setChatDetail: (chat: Chat) => {
      queryClient.setQueryData(CHAT_KEYS.detail(chat.id), chat)
    },

    // Invalidate all data related to a chat
    invalidateChatData: (chatId: number) => {
      queryClient.invalidateQueries({ queryKey: CHAT_KEYS.detail(chatId) })
      queryClient.invalidateQueries({ queryKey: CHAT_KEYS.messages(chatId) })
    }
  }
}

// --- Key Invalidation Utilities ---
export function useInvalidateKeys() {
  const queryClient = useQueryClient()

  return {
    // Invalidate all key-related queries
    invalidateAllKeys: () => {
      queryClient.invalidateQueries({ queryKey: KEY_KEYS.all })
    },

    // Invalidate specific key detail
    invalidateKey: (keyId: number) => {
      queryClient.invalidateQueries({ queryKey: KEY_KEYS.detail(keyId) })
    },

    // Remove key from cache completely
    removeKey: (keyId: number) => {
      queryClient.removeQueries({ queryKey: KEY_KEYS.detail(keyId) })
    },

    /** NEW: Sets specific key detail in the cache. */
    setKeyDetail: (key: ProviderKey) => {
      queryClient.setQueryData(KEY_KEYS.detail(key.id), key)
    }
  }
}

// --- Enhanced Batch Operations ---
export function useBatchProjectOperations() {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return {
    invalidateAllProjects: () => {
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.all })
    },

    prefetchProject: (projectId: number) => {
      queryClient.prefetchQuery({
        queryKey: PROJECT_KEYS.detail(projectId),
        queryFn: () =>
          client ? client.projects.getProject(projectId) : Promise.reject(new Error('Client not connected')),
        staleTime: 5 * 60 * 1000
      })
    },

    setProjectOptimistically: (project: Project) => {
      queryClient.setQueryData(PROJECT_KEYS.detail(project.id), project)
    },

    // Invalidate all data related to a project
    invalidateProjectData: (projectId: number) => {
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.detail(projectId) })
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.files(projectId) })
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.summary(projectId) })
      queryClient.invalidateQueries({ queryKey: PROMPT_KEYS.projectPrompts(projectId) })
      queryClient.invalidateQueries({ queryKey: TICKET_KEYS.projectTickets(projectId) })
      queryClient.invalidateQueries({ queryKey: AGENT_KEYS.projectAgents(projectId) })
    }
  }
}

// Error recovery utilities
export function useRetryFailedOperations() {
  const queryClient = useQueryClient()

  return {
    retryAllFailedQueries: () => {
      queryClient.refetchQueries({
        type: 'active',
        stale: true
      })
    },

    clearErrorState: (queryKey: any[]) => {
      queryClient.resetQueries({ queryKey })
    }
  }
}

// --- Advanced Caching Strategies ---
export function useSmartCaching() {
  const client = useApiClient()
  const queryClient = useQueryClient()

  return {
    // Preload related data
    preloadRelatedProject: async (projectId: number) => {
      await Promise.all([
        queryClient.prefetchQuery({
          queryKey: PROJECT_KEYS.files(projectId),
          queryFn: () =>
            client ? client.projects.getProjectFiles(projectId) : Promise.reject(new Error('Client not connected'))
        }),
        queryClient.prefetchQuery({
          queryKey: PROMPT_KEYS.projectPrompts(projectId),
          queryFn: () =>
            client ? client.prompts.listProjectPrompts(projectId) : Promise.reject(new Error('Client not connected'))
        })
      ])
    },

    // Optimistic updates for better UX
    optimisticProjectUpdate: (projectId: number, updates: Partial<Project>) => {
      queryClient.setQueryData(PROJECT_KEYS.detail(projectId), (old: Project | undefined) =>
        old ? { ...old, ...updates, updated: Date.now() } : undefined
      )
    },

    // Background refresh for stale data
    backgroundRefresh: (queryKeys: any[][]) => {
      queryKeys.forEach((queryKey) => {
        queryClient.invalidateQueries({ queryKey, refetchType: 'none' })
      })
    }
  }
}

// Export agent hooks
export * from './api/use-agents-api'

// Export command hooks
export * from './api/use-commands-api'

// Export Claude Code hooks
export * from './api/use-claude-hooks'
