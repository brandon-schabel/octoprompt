import { DataResponseSchema } from '@promptliano/api-client'
import type { CreateProjectBody, UpdateProjectBody, Project, ProjectFile } from '@promptliano/schemas'

import type { CreateChatBody, UpdateChatBody, Chat, ChatMessage, AiChatStreamRequest } from '@promptliano/schemas'

import type { CreatePromptBody, UpdatePromptBody, Prompt, OptimizePromptRequest } from '@promptliano/schemas'

// packages/client/src/hooks/api/use-keys-api-v2.ts
import type { CreateProviderKeyBody, UpdateProviderKeyBody, ProviderKey } from '@promptliano/schemas'

import type { CreateClaudeAgentBody, UpdateClaudeAgentBody, ClaudeAgent } from '@promptliano/schemas'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { z } from 'zod'
import { promptlianoClient } from './promptliano-client'
import { AGENT_KEYS } from './api/use-agents-api'

// Query Keys - simplified
const CHAT_KEYS = {
  all: ['chats'] as const,
  list: () => [...CHAT_KEYS.all, 'list'] as const,
  detail: (chatId: number) => [...CHAT_KEYS.all, 'detail', chatId] as const,
  messages: (chatId: number) => [...CHAT_KEYS.all, 'messages', chatId] as const
}

// --- Query Hooks ---
export function useGetChats() {
  return useQuery({
    queryKey: CHAT_KEYS.list(),
    queryFn: () => promptlianoClient.chats.listChats(),
    staleTime: 5 * 60 * 1000 // 5 minutes
  })
}

export function useGetChat(chatId: number) {
  return useQuery({
    queryKey: CHAT_KEYS.detail(chatId),
    queryFn: () => promptlianoClient.chats.getChat(chatId),
    enabled: !!chatId,
    staleTime: 5 * 60 * 1000
  })
}

export function useGetMessages(chatId: number) {
  return useQuery({
    queryKey: CHAT_KEYS.messages(chatId),
    queryFn: () => promptlianoClient.chats.getMessages(chatId),
    enabled: !!chatId,
    staleTime: 30 * 1000 // 30 seconds for messages
  })
}

// --- Mutation Hooks ---
export function useCreateChat() {
  const { invalidateAllChats } = useInvalidateChats()

  return useMutation({
    mutationFn: (data: CreateChatBody) => promptlianoClient.chats.createChat(data),
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
  const { invalidateAllChats, setChatDetail } = useInvalidateChats()

  return useMutation({
    mutationFn: ({ chatId, data }: { chatId: number; data: UpdateChatBody }) =>
      promptlianoClient.chats.updateChat(chatId, data),
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
  const { invalidateAllChats, removeChat } = useInvalidateChats()

  return useMutation({
    mutationFn: (chatId: number) => promptlianoClient.chats.deleteChat(chatId),
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
  const { invalidateAllChats } = useInvalidateChats()

  return useMutation({
    mutationFn: ({ chatId, excludeMessageIds }: { chatId: number; excludeMessageIds?: number[] }) =>
      promptlianoClient.chats.forkChat(chatId, { excludedMessageIds: excludeMessageIds || [] }),
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
    }) =>
      promptlianoClient.chats.forkChatFromMessage(chatId, messageId, {
        excludedMessageIds: excludedMessageIds || []
      }),
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
  const { invalidateChatMessages } = useInvalidateChats()

  return useMutation({
    mutationFn: ({ chatId, messageId }: { chatId: number; messageId: number }) =>
      promptlianoClient.chats.deleteMessage(chatId, messageId),
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
  return useMutation({
    mutationFn: (data: AiChatStreamRequest) => promptlianoClient.chats.streamChat(data),
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
  return useQuery({
    queryKey: PROJECT_KEYS.list(),
    queryFn: () => promptlianoClient.projects.listProjects(),
    staleTime: 5 * 60 * 1000
  })
}

export function useGetProject(projectId: number) {
  return useQuery({
    queryKey: PROJECT_KEYS.detail(projectId),
    queryFn: () => promptlianoClient.projects.getProject(projectId),
    enabled: !!projectId && projectId !== -1,
    staleTime: 5 * 60 * 1000
  })
}

export function useGetProjectFiles(projectId: number) {
  return useQuery({
    queryKey: PROJECT_KEYS.files(projectId),
    queryFn: () => promptlianoClient.projects.getProjectFiles(projectId),
    enabled: !!projectId && projectId !== -1,
    staleTime: 2 * 60 * 1000, // 2 minutes for files
    refetchOnWindowFocus: true
  })
}

export function useGetProjectFilesWithoutContent(projectId: number) {
  return useQuery({
    queryKey: PROJECT_KEYS.filesWithoutContent(projectId),
    queryFn: () => promptlianoClient.projects.getProjectFilesWithoutContent(projectId),
    enabled: !!projectId && projectId !== -1,
    staleTime: 5 * 60 * 1000, // 5 minutes for file metadata
    refetchOnWindowFocus: true
  })
}

export function useGetProjectSummary(projectId: number) {
  return useQuery({
    queryKey: PROJECT_KEYS.summary(projectId),
    queryFn: () => promptlianoClient.projects.getProjectSummary(projectId),
    enabled: !!projectId && projectId !== -1,
    staleTime: 10 * 60 * 1000 // 10 minutes for summary
  })
}

export function useGetProjectStatistics(projectId: number) {
  return useQuery({
    queryKey: PROJECT_KEYS.statistics(projectId),
    queryFn: () => promptlianoClient.projects.getProjectStatistics(projectId),
    enabled: !!projectId && projectId !== -1,
    staleTime: 5 * 60 * 1000 // 5 minutes cache for statistics
  })
}

// --- Mutation Hooks ---
export function useCreateProject() {
  const { invalidateAllProjects } = useInvalidateProjects()

  return useMutation({
    mutationFn: (data: CreateProjectBody) => promptlianoClient.projects.createProject(data),
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
  const { invalidateAllProjects, setProjectDetail } = useInvalidateProjects()

  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: number; data: UpdateProjectBody }) =>
      promptlianoClient.projects.updateProject(projectId, data),
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
  const { invalidateAllProjects, removeProject } = useInvalidateProjects()
  const { removeProjectPrompts } = useInvalidatePrompts()

  return useMutation({
    mutationFn: (projectId: number) => promptlianoClient.projects.deleteProject(projectId),
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
  const { invalidateProjectFiles, invalidateProject } = useInvalidateProjects()

  return useMutation({
    mutationFn: (projectId: number) => promptlianoClient.projects.syncProject(projectId),
    onSuccess: (_, projectId) => {
      invalidateProjectFiles(projectId)
      invalidateProject(projectId)
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to sync project')
    }
  })
}

export function useRefreshProject() {
  const { invalidateProjectFiles } = useInvalidateProjects()

  return useMutation({
    mutationFn: ({ projectId, folder }: { projectId: number; folder?: string }) =>
      promptlianoClient.projects.refreshProject(projectId, folder ? { folder } : undefined),
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
  const { invalidateProjectFiles } = useInvalidateProjects()

  return useMutation({
    mutationFn: async ({ projectId, fileId, content }: { projectId: number; fileId: number; content: string }) => {
      // Update the file content
      const result = await promptlianoClient.projects.updateFileContent(projectId, fileId, content)

      // Sync the project to ensure file system and data store are synchronized
      await promptlianoClient.projects.syncProject(projectId)

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
  return useMutation({
    mutationFn: async ({ projectId, prompt, limit = 10 }: { projectId: number; prompt: string; limit?: number }) => {
      const response = await promptlianoClient.projects.suggestFiles(projectId, { prompt, limit })
      return response.data
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to suggest files')
    }
  })
}

export function useSummarizeProjectFiles() {
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
      const response = await promptlianoClient.projects.summarizeFiles(projectId, { fileIds, force })
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
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ projectId, fileIds }: { projectId: number; fileIds: number[] }) => {
      const response = await promptlianoClient.projects.removeSummariesFromFiles(projectId, { fileIds })
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
  return useQuery({
    queryKey: PROMPT_KEYS.list(),
    queryFn: () => promptlianoClient.prompts.listPrompts(),
    staleTime: 5 * 60 * 1000
  })
}

export function useGetPrompt(promptId: number) {
  return useQuery({
    queryKey: PROMPT_KEYS.detail(promptId),
    queryFn: () => promptlianoClient.prompts.getPrompt(promptId),
    enabled: !!promptId,
    staleTime: 5 * 60 * 1000
  })
}

export function useGetProjectPrompts(projectId: number) {
  return useQuery({
    queryKey: PROMPT_KEYS.projectPrompts(projectId),
    queryFn: () => promptlianoClient.prompts.listProjectPrompts(projectId),
    enabled: !!projectId && projectId !== -1,
    staleTime: 5 * 60 * 1000
  })
}

// --- Mutation Hooks ---
export function useCreatePrompt() {
  const { invalidateAllPrompts } = useInvalidatePrompts()

  return useMutation({
    mutationFn: (data: CreatePromptBody) => promptlianoClient.prompts.createPrompt(data),
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
  const { invalidateAllPrompts, setPromptDetail } = useInvalidatePrompts()

  return useMutation({
    mutationFn: ({ promptId, data }: { promptId: number; data: UpdatePromptBody }) =>
      promptlianoClient.prompts.updatePrompt(promptId, data),
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
  const invalidatePrompts = useInvalidatePrompts()

  return useMutation({
    mutationFn: ({ promptId }: { promptId: number }) => promptlianoClient.prompts.deletePrompt(promptId),
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
  const invalidatePrompts = useInvalidatePrompts()

  return useMutation({
    mutationFn: ({ projectId, promptId }: { projectId: number; promptId: number }) =>
      promptlianoClient.prompts.addPromptToProject(projectId, promptId),
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
  const invalidatePrompts = useInvalidatePrompts()

  return useMutation({
    mutationFn: ({ projectId, promptId }: { projectId: number; promptId: number }) =>
      promptlianoClient.prompts.removePromptFromProject(projectId, promptId),
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
  return useMutation({
    mutationFn: (data: OptimizePromptRequest) => promptlianoClient.prompts.optimizeUserInput(data),
    onError: (error) => {
      toast.error(error.message || 'Failed to optimize user input')
    }
  })
}

export function useSuggestPrompts() {
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
      const response = await promptlianoClient.prompts.suggestPrompts(projectId, { userInput, limit })
      return response.data.prompts
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to suggest prompts')
    }
  })
}

// --- File Versioning Hooks ---
// TODO: Uncomment when file versioning is implemented in the API
// export function useGetFileVersions(projectId: number, originalFileId: number) {
//   return useQuery({
//     queryKey: PROJECT_KEYS.fileVersions(projectId, originalFileId),
//     queryFn: () => promptlianoClient.projects.getFileVersions(projectId, originalFileId),
//     enabled: projectId > 0 && originalFileId > 0,
//     staleTime: 5 * 60 * 1000
//   })
// }

// export function useGetFileVersion(projectId: number, originalFileId: number, version?: number) {
//   return useQuery({
//     queryKey: PROJECT_KEYS.fileVersion(projectId, originalFileId, version),
//     queryFn: () => promptlianoClient.projects.getFileVersion(projectId, originalFileId, version),
//     enabled: projectId > 0 && originalFileId > 0,
//     staleTime: 5 * 60 * 1000
//   })
// }

// export function useRevertFileToVersion() {
//   const { invalidateProjectFiles } = useInvalidateProjects()
//   const queryClient = useQueryClient()

//   return useMutation({
//     mutationFn: ({ projectId, fileId, targetVersion }: { projectId: number; fileId: number; targetVersion: number }) =>
//       promptlianoClient.projects.revertFileToVersion(projectId, fileId, targetVersion),
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
  return useQuery({
    queryKey: KEY_KEYS.list(),
    queryFn: () => promptlianoClient.keys.listKeys(),
    staleTime: 10 * 60 * 1000 // 10 minutes for keys
  })
}

export function useGetKey(keyId: number) {
  return useQuery({
    queryKey: KEY_KEYS.detail(keyId),
    queryFn: () => promptlianoClient.keys.getKey(keyId),
    enabled: !!keyId,
    staleTime: 10 * 60 * 1000
  })
}

// --- Mutation Hooks ---
export function useCreateKey() {
  const { invalidateAllKeys } = useInvalidateKeys()

  return useMutation({
    mutationFn: (data: CreateProviderKeyBody) => promptlianoClient.keys.createKey(data),
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
  const { invalidateAllKeys, setKeyDetail } = useInvalidateKeys()

  return useMutation({
    mutationFn: ({ keyId, data }: { keyId: number; data: UpdateProviderKeyBody }) =>
      promptlianoClient.keys.updateKey(keyId, data),
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
  const { invalidateAllKeys, removeKey } = useInvalidateKeys()

  return useMutation({
    mutationFn: (keyId: number) => promptlianoClient.keys.deleteKey(keyId),
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
  const queryClient = useQueryClient()

  return {
    invalidateAllProjects: () => {
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.all })
    },

    prefetchProject: (projectId: number) => {
      queryClient.prefetchQuery({
        queryKey: PROJECT_KEYS.detail(projectId),
        queryFn: () => promptlianoClient.projects.getProject(projectId),
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
  const queryClient = useQueryClient()

  return {
    // Preload related data
    preloadRelatedProject: async (projectId: number) => {
      await Promise.all([
        queryClient.prefetchQuery({
          queryKey: PROJECT_KEYS.files(projectId),
          queryFn: () => promptlianoClient.projects.getProjectFiles(projectId)
        }),
        queryClient.prefetchQuery({
          queryKey: PROMPT_KEYS.projectPrompts(projectId),
          queryFn: () => promptlianoClient.prompts.listProjectPrompts(projectId)
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
