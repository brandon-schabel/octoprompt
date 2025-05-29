// packages/client/src/hooks/api/octoprompt-client-instance.ts
import { createOctoPromptClient, DataResponseSchema } from './octoprompt-client'
import { SERVER_HTTP_ENDPOINT } from '@/constants/server-constants'
import type {
    CreateProjectBody,
    UpdateProjectBody,
    Project,
    ProjectFile
} from 'shared/src/schemas/project.schemas'


import type {
    CreateChatBody,
    UpdateChatBody,
    Chat,
    ChatMessage,
    AiChatStreamRequest
} from 'shared/src/schemas/chat.schemas'

import type {
    CreatePromptBody,
    UpdatePromptBody,
    Prompt,
    OptimizePromptRequest
} from 'shared/src/schemas/prompt.schemas'

// packages/client/src/hooks/api/use-keys-api-v2.ts
import type {
    CreateProviderKeyBody,
    UpdateProviderKeyBody,
    ProviderKey
} from 'shared/src/schemas/provider-key.schemas'


import type {
    CreateTicketBody,
    UpdateTicketBody,
    CreateTaskBody,
    UpdateTaskBody,
    ReorderTasksBody,
    Ticket,
    TaskSchema
} from 'shared/src/schemas/ticket.schemas'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { z } from 'zod'

// Import the Task type properly
type Task = z.infer<typeof TaskSchema>

// Create a singleton client instance
export const octoClient = createOctoPromptClient({
    baseUrl: SERVER_HTTP_ENDPOINT,
    timeout: 30000
})

// Query Keys - simplified
const CHAT_KEYS = {
    all: ['chats'] as const,
    list: () => [...CHAT_KEYS.all, 'list'] as const,
    detail: (chatId: number) => [...CHAT_KEYS.all, 'detail', chatId] as const,
    messages: (chatId: number) => [...CHAT_KEYS.all, 'messages', chatId] as const,
}

// --- Query Hooks ---
export function useGetChats() {
    return useQuery({
        queryKey: CHAT_KEYS.list(),
        queryFn: () => octoClient.chats.listChats(),
        staleTime: 5 * 60 * 1000, // 5 minutes
    })
}

export function useGetChat(chatId: number) {
    return useQuery({
        queryKey: CHAT_KEYS.detail(chatId),
        queryFn: () => octoClient.chats.getChat(chatId),
        enabled: !!chatId,
        staleTime: 5 * 60 * 1000,
    })
}

export function useGetMessages(chatId: number) {
    return useQuery({
        queryKey: CHAT_KEYS.messages(chatId),
        queryFn: () => octoClient.chats.getMessages(chatId),
        enabled: !!chatId,
        staleTime: 30 * 1000, // 30 seconds for messages
    })
}

// --- Mutation Hooks ---
export function useCreateChat() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (data: CreateChatBody) => octoClient.chats.createChat(data),
        onSuccess: (newChat) => {
            queryClient.invalidateQueries({ queryKey: CHAT_KEYS.list() })
            toast.success('Chat created successfully')
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to create chat')
        },
    })
}

export function useUpdateChat() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ chatId, data }: { chatId: number; data: UpdateChatBody }) =>
            octoClient.chats.updateChat(chatId, data),
        onSuccess: ({ data: updatedChat }: DataResponseSchema<Chat>) => {
            queryClient.invalidateQueries({ queryKey: CHAT_KEYS.list() })
            queryClient.setQueryData(CHAT_KEYS.detail(updatedChat.id), updatedChat as Chat)
            toast.success('Chat updated successfully')
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to update chat')
        },
    })
}

export function useDeleteChat() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (chatId: number) => octoClient.chats.deleteChat(chatId),
        onSuccess: (_, chatId) => {
            queryClient.invalidateQueries({ queryKey: CHAT_KEYS.list() })
            queryClient.removeQueries({ queryKey: CHAT_KEYS.detail(chatId) })
            queryClient.removeQueries({ queryKey: CHAT_KEYS.messages(chatId) })
            toast.success('Chat deleted successfully')
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to delete chat')
        },
    })
}

export function useForkChat() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ chatId, excludeMessageIds }: { chatId: number; excludeMessageIds?: number[] }) =>
            octoClient.chats.forkChat(chatId, { excludedMessageIds: excludeMessageIds || [] }),
        onSuccess: (newChat) => {
            queryClient.invalidateQueries({ queryKey: CHAT_KEYS.list() })
            toast.success('Chat forked successfully')
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to fork chat')
        },
    })
}

export function useForkChatFromMessage() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({
            chatId,
            messageId,
            excludedMessageIds
        }: {
            chatId: number;
            messageId: number;
            excludedMessageIds?: number[]
        }) => octoClient.chats.forkChatFromMessage(chatId, messageId, {
            excludedMessageIds: excludedMessageIds || []
        }),
        onSuccess: (newChat) => {
            queryClient.invalidateQueries({ queryKey: CHAT_KEYS.list() })
            toast.success('Chat forked from message successfully')
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to fork chat from message')
        },
    })
}

export function useDeleteMessage() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ chatId, messageId }: { chatId: number; messageId: number }) =>
            octoClient.chats.deleteMessage(chatId, messageId),
        onSuccess: (_, { chatId }) => {
            queryClient.invalidateQueries({ queryKey: CHAT_KEYS.messages(chatId) })
            toast.success('Message deleted successfully')
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to delete message')
        },
    })
}

export function useStreamChat() {
    return useMutation({
        mutationFn: (data: AiChatStreamRequest) => octoClient.chats.streamChat(data),
        onError: (error) => {
            toast.error(error.message || 'Failed to start chat stream')
        },
    })
}

// --- Enhanced AI Chat Hook ---
export function useAIChatV2({ chatId, provider, model, systemMessage }: {
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
        refetchMessages,
    }
}

// --- Migration Examples ---

// OLD WAY (Generated Types):
/*
export function useGetProjects() {
  const queryOptions = getApiProjectsOptions({
    baseUrl: SERVER_HTTP_ENDPOINT
  })
  return useQuery(queryOptions)
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  const mutationOptions = postApiProjectsMutation()

  return useMutation<PostApiProjectsResponse, PostApiProjectsError, CreateProjectInput>({
    mutationFn: (body: CreateProjectInput) => {
      const opts: Options<PostApiProjectsData> = { body }
      return mutationOptions.mutationFn!(opts)
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.lists() })
    },
    onError: (error) => commonErrorHandler(error as unknown as Error)
  })
}
*/

// NEW WAY (Client-Based):
/*
export function useGetProjects() {
  return useQuery({
    queryKey: PROJECT_KEYS.list(),
    queryFn: () => octoClient.projects.listProjects(),
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (data: CreateProjectBody) => octoClient.projects.createProject(data),
    onSuccess: (newProject: Project) => {
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.list() })
      toast.success('Project created successfully')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create project')
    },
  })
}
*/

// --- Usage Examples in Components ---

/*
// Example: Project List Component
function ProjectList() {
  const { data: projects, isLoading, error } = useGetProjects()
  const createProject = useCreateProject()
  const deleteProject = useDeleteProject()
  
  const handleCreate = async (formData: CreateProjectBody) => {
    try {
      await createProject.mutateAsync(formData)
      // Success toast already handled in hook
    } catch (error) {
      // Error toast already handled in hook  
    }
  }
  
  const handleDelete = async (projectId: number) => {
    if (confirm('Delete project?')) {
      await deleteProject.mutateAsync(projectId)
    }
  }

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>
  
  return (
    <div>
      {projects?.map(project => (
        <div key={project.id}>
          <h3>{project.name}</h3>
          <button onClick={() => handleDelete(project.id)}>
            Delete
          </button>
        </div>
      ))}
    </div>
  )
}

// Example: Chat Component  
function ChatInterface({ chatId }: { chatId: number }) {
  const {
    messages,
    sendMessage,
    isLoading,
    error
  } = useAIChatV2({
    chatId,
    provider: 'openai',
    model: 'gpt-4',
    systemMessage: 'You are a helpful assistant'
  })
  
  const handleSend = async (message: string) => {
    try {
      const stream = await sendMessage(message)
      // Handle stream response
      const reader = stream.getReader()
      // ... stream handling logic
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }
  
  return (
    <div>
      <div>
        {messages.map(msg => (
          <div key={msg.id}>{msg.content}</div>
        ))}
      </div>
      <MessageInput onSend={handleSend} disabled={isLoading} />
    </div>
  )
}
*/



const PROJECT_KEYS = {
    all: ['projects'] as const,
    list: () => [...PROJECT_KEYS.all, 'list'] as const,
    detail: (projectId: number) => [...PROJECT_KEYS.all, 'detail', projectId] as const,
    files: (projectId: number) => [...PROJECT_KEYS.all, 'files', projectId] as const,
    summary: (projectId: number) => [...PROJECT_KEYS.all, 'summary', projectId] as const,
}

// --- Query Hooks ---
export function useGetProjects() {
    return useQuery({
        queryKey: PROJECT_KEYS.list(),
        queryFn: () => octoClient.projects.listProjects(),
        staleTime: 5 * 60 * 1000,
    })
}

export function useGetProject(projectId: number) {
    return useQuery({
        queryKey: PROJECT_KEYS.detail(projectId),
        queryFn: () => octoClient.projects.getProject(projectId),
        enabled: !!projectId,
        staleTime: 5 * 60 * 1000,
    })
}

export function useGetProjectFiles(projectId: number) {
    return useQuery({
        queryKey: PROJECT_KEYS.files(projectId),
        queryFn: () => octoClient.projects.getProjectFiles(projectId),
        enabled: !!projectId,
        staleTime: 2 * 60 * 1000, // 2 minutes for files
        refetchOnWindowFocus: true,
    })
}

export function useGetProjectSummary(projectId: number) {
    return useQuery({
        queryKey: PROJECT_KEYS.summary(projectId),
        queryFn: () => octoClient.projects.getProjectSummary(projectId),
        enabled: !!projectId,
        staleTime: 10 * 60 * 1000, // 10 minutes for summary
    })
}

// --- Mutation Hooks ---
export function useCreateProject() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (data: CreateProjectBody) => octoClient.projects.createProject(data),
        onSuccess: (newProject) => {
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.list() })
            toast.success('Project created successfully')
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to create project')
        },
    })
}

export function useUpdateProject() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ projectId, data }: { projectId: number; data: UpdateProjectBody }) =>
            octoClient.projects.updateProject(projectId, data),
        onSuccess: ({ data: updatedProject }: DataResponseSchema<Project>) => {
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.list() })
            queryClient.setQueryData(PROJECT_KEYS.detail(updatedProject.id), updatedProject)
            toast.success('Project updated successfully')
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to update project')
        },
    })
}

export function useDeleteProject() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (projectId: number) => octoClient.projects.deleteProject(projectId),
        onSuccess: (_, projectId) => {
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.list() })
            queryClient.removeQueries({ queryKey: PROJECT_KEYS.detail(projectId) })
            queryClient.removeQueries({ queryKey: PROJECT_KEYS.files(projectId) })
            queryClient.removeQueries({ queryKey: PROJECT_KEYS.summary(projectId) })
            toast.success('Project deleted successfully')
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to delete project')
        },
    })
}

export function useSyncProject() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (projectId: number) => octoClient.projects.syncProject(projectId),
        onSuccess: (_, projectId) => {
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.files(projectId) })
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.detail(projectId) })
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to sync project')
        },

    })
}

export function useRefreshProject() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ projectId, folder }: { projectId: number; folder?: string }) =>
            octoClient.projects.refreshProject(projectId, folder ? { folder } : undefined),
        onSuccess: (_, { projectId }) => {
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.files(projectId) })
            toast.success('Project refreshed successfully')
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to refresh project')
        },
    })
}

export function useSuggestFiles() {
    return useMutation({
        mutationFn: ({ projectId, userInput }: { projectId: number; userInput: string }) =>
            octoClient.projects.suggestFiles(projectId, { userInput }),
        onError: (error) => {
            toast.error(error.message || 'Failed to suggest files')
        },
    })
}

export function useSummarizeProjectFiles() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ projectId, fileIds, force = false }: { projectId: number; fileIds: number[]; force?: boolean }) =>
            octoClient.projects.summarizeFiles(projectId, { fileIds, force }),
        onSuccess: (_, { projectId }) => {
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.files(projectId) })
            toast.success('Files summarized successfully')
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to summarize files')
        },
    })
}

export function useRemoveSummaries() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ projectId, fileIds }: { projectId: number; fileIds: number[] }) =>
            octoClient.projects.removeSummaries(projectId, { fileIds }),
        onSuccess: (_, { projectId }) => {
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.files(projectId) })
            toast.success('Summaries removed successfully')
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to remove summaries')
        },
    })
}


const PROMPT_KEYS = {
    all: ['prompts'] as const,
    list: () => [...PROMPT_KEYS.all, 'list'] as const,
    detail: (promptId: number) => [...PROMPT_KEYS.all, 'detail', promptId] as const,
    projectPrompts: (projectId: number) => [...PROMPT_KEYS.all, 'project', projectId] as const,
}

// --- Query Hooks ---
export function useGetAllPrompts() {
    return useQuery({
        queryKey: PROMPT_KEYS.list(),
        queryFn: () => octoClient.prompts.listPrompts(),
        staleTime: 5 * 60 * 1000,
    })
}

export function useGetPrompt(promptId: number) {
    return useQuery({
        queryKey: PROMPT_KEYS.detail(promptId),
        queryFn: () => octoClient.prompts.getPrompt(promptId),
        enabled: !!promptId,
        staleTime: 5 * 60 * 1000,
    })
}

export function useGetProjectPrompts(projectId: number) {
    return useQuery({
        queryKey: PROMPT_KEYS.projectPrompts(projectId),
        queryFn: () => octoClient.prompts.listProjectPrompts(projectId),
        enabled: !!projectId,
        staleTime: 5 * 60 * 1000,
    })
}

// --- Mutation Hooks ---
export function useCreatePrompt() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (data: CreatePromptBody) => octoClient.prompts.createPrompt(data),
        onSuccess: (newPrompt) => {
            queryClient.invalidateQueries({ queryKey: PROMPT_KEYS.list() })
            toast.success('Prompt created successfully')
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to create prompt')
        },
    })
}

export function useUpdatePrompt() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ promptId, data }: { promptId: number; data: UpdatePromptBody }) =>
            octoClient.prompts.updatePrompt(promptId, data),
        onSuccess: ({ data: updatedPrompt }: DataResponseSchema<Prompt>) => {
            queryClient.invalidateQueries({ queryKey: PROMPT_KEYS.list() })
            queryClient.setQueryData(PROMPT_KEYS.detail(updatedPrompt.id), updatedPrompt)
            toast.success('Prompt updated successfully')
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to update prompt')
        },
    })
}

export function useDeletePrompt() {
    const queryClient = useQueryClient()



    return useMutation({
        mutationFn: ({ promptId }: { promptId: number },) => octoClient.prompts.deletePrompt(promptId),
        onSuccess: (_, { promptId },) => {
            queryClient.invalidateQueries({ queryKey: PROMPT_KEYS.list() })
            queryClient.removeQueries({ queryKey: PROMPT_KEYS.detail(promptId) })
            //  TODO : invalidate all project prompts?
            toast.success('Prompt deleted successfully')
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to delete prompt')
        },
    })
}

export function useAddPromptToProject() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ projectId, promptId }: { projectId: number; promptId: number }) =>
            octoClient.prompts.addPromptToProject(projectId, promptId),
        onSuccess: (_, { projectId }) => {
            queryClient.invalidateQueries({ queryKey: PROMPT_KEYS.projectPrompts(projectId) })
            toast.success('Prompt added to project successfully')
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to add prompt to project')
        },
    })
}

export function useRemovePromptFromProject() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ projectId, promptId }: { projectId: number; promptId: number }) =>
            octoClient.prompts.removePromptFromProject(projectId, promptId),
        onSuccess: (_, { projectId }) => {
            queryClient.invalidateQueries({ queryKey: PROMPT_KEYS.projectPrompts(projectId) })
            toast.success('Prompt removed from project successfully')
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to remove prompt from project')
        },
    })
}

export function useOptimizeUserInput() {
    return useMutation({
        mutationFn: (data: OptimizePromptRequest) => octoClient.prompts.optimizeUserInput(data),
        onError: (error) => {
            toast.error(error.message || 'Failed to optimize user input')
        },
    })
}



const KEY_KEYS = {
    all: ['keys'] as const,
    list: () => [...KEY_KEYS.all, 'list'] as const,
    detail: (keyId: number) => [...KEY_KEYS.all, 'detail', keyId] as const,
}

// --- Query Hooks ---
export function useGetKeys() {
    return useQuery({
        queryKey: KEY_KEYS.list(),
        queryFn: () => octoClient.keys.listKeys(),
        staleTime: 10 * 60 * 1000, // 10 minutes for keys
    })
}

export function useGetKey(keyId: number) {
    return useQuery({
        queryKey: KEY_KEYS.detail(keyId),
        queryFn: () => octoClient.keys.getKey(keyId),
        enabled: !!keyId,
        staleTime: 10 * 60 * 1000,
    })
}

// --- Mutation Hooks ---
export function useCreateKey() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (data: CreateProviderKeyBody) => octoClient.keys.createKey(data),
        onSuccess: (newKey) => {
            queryClient.invalidateQueries({ queryKey: KEY_KEYS.list() })
            toast.success('API key created successfully')
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to create API key')
        },
    })
}

export function useUpdateKey() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ keyId, data }: { keyId: number; data: UpdateProviderKeyBody }) =>
            octoClient.keys.updateKey(keyId, data),
        onSuccess: ({ data: updatedKey }: DataResponseSchema<ProviderKey>) => {
            queryClient.invalidateQueries({ queryKey: KEY_KEYS.list() })
            queryClient.setQueryData(KEY_KEYS.detail(updatedKey.id), updatedKey as ProviderKey)
            toast.success('API key updated successfully')
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to update API key')
        },
    })
}

export function useDeleteKey() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (keyId: number) => octoClient.keys.deleteKey(keyId),
        onSuccess: (_, keyId) => {
            queryClient.invalidateQueries({ queryKey: KEY_KEYS.list() })
            queryClient.removeQueries({ queryKey: KEY_KEYS.detail(keyId) })
            toast.success('API key deleted successfully')
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to delete API key')
        },
    })
}


const TICKET_KEYS = {
    all: ['tickets'] as const,
    projectTickets: (projectId: number) => [...TICKET_KEYS.all, 'project', projectId] as const,
    detail: (ticketId: number) => [...TICKET_KEYS.all, 'detail', ticketId] as const,
    tasks: (ticketId: number) => [...TICKET_KEYS.all, 'tasks', ticketId] as const,
}

// --- Query Hooks ---
export function useGetProjectTickets(projectId: number, status?: string) {
    return useQuery({
        queryKey: [...TICKET_KEYS.projectTickets(projectId), status || 'all'],
        queryFn: () => octoClient.tickets.listProjectTickets(projectId, status),
        enabled: !!projectId,
        staleTime: 2 * 60 * 1000, // 2 minutes
    })
}

export function useGetTicket(ticketId: number) {
    return useQuery({
        queryKey: TICKET_KEYS.detail(ticketId),
        queryFn: () => octoClient.tickets.getTicket(ticketId),
        enabled: !!ticketId,
        staleTime: 2 * 60 * 1000,
    })
}

export function useGetTasks(ticketId: number) {
    return useQuery({
        queryKey: TICKET_KEYS.tasks(ticketId),
        queryFn: () => octoClient.tickets.getTasks(ticketId),
        enabled: !!ticketId,
        staleTime: 30 * 1000, // 30 seconds for tasks
    })
}

// --- Mutation Hooks ---
export function useCreateTicket() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (data: CreateTicketBody) => octoClient.tickets.createTicket(data),
        onSuccess: ({ ticket: newTicket }) => {
            queryClient.invalidateQueries({
                queryKey: TICKET_KEYS.projectTickets(newTicket.projectId)
            })
            toast.success('Ticket created successfully')
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to create ticket')
        },
    })
}

export function useUpdateTicket() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ ticketId, data }: { ticketId: number; data: UpdateTicketBody }) =>
            octoClient.tickets.updateTicket(ticketId, data),
        onSuccess: ({ ticket: updatedTicket }) => {
            queryClient.invalidateQueries({
                queryKey: TICKET_KEYS.projectTickets(updatedTicket.projectId)
            })
            queryClient.setQueryData(TICKET_KEYS.detail(updatedTicket.id), updatedTicket)
            toast.success('Ticket updated successfully')
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to update ticket')
        },
    })
}

export function useDeleteTicket() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (ticketId: number) => octoClient.tickets.deleteTicket(ticketId),
        onSuccess: (_, ticketId) => {
            queryClient.invalidateQueries({ queryKey: TICKET_KEYS.all })
            queryClient.removeQueries({ queryKey: TICKET_KEYS.detail(ticketId) })
            queryClient.removeQueries({ queryKey: TICKET_KEYS.tasks(ticketId) })
            toast.success('Ticket deleted successfully')
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to delete ticket')
        },
    })
}

export function useCreateTask() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ ticketId, content }: { ticketId: number; content: string }) =>
            octoClient.tickets.createTask(ticketId, content),
        onSuccess: (newTask, { ticketId }) => {
            queryClient.invalidateQueries({ queryKey: TICKET_KEYS.tasks(ticketId) })
            toast.success('Task created successfully')
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to create task')
        },
    })
}

export function useUpdateTask() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({
            ticketId,
            taskId,
            data
        }: {
            ticketId: number;
            taskId: number;
            data: UpdateTaskBody
        }) => octoClient.tickets.updateTask(ticketId, taskId, data),
        onSuccess: (updatedTask, { ticketId }) => {
            queryClient.invalidateQueries({ queryKey: TICKET_KEYS.tasks(ticketId) })
            toast.success('Task updated successfully')
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to update task')
        },
    })
}

export function useDeleteTask() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ ticketId, taskId }: { ticketId: number; taskId: number }) =>
            octoClient.tickets.deleteTask(ticketId, taskId),
        onSuccess: (_, { ticketId }) => {
            queryClient.invalidateQueries({ queryKey: TICKET_KEYS.tasks(ticketId) })
            toast.success('Task deleted successfully')
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to delete task')
        },
    })
}

export function useReorderTasks() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ ticketId, data }: { ticketId: number; data: ReorderTasksBody }) =>
            octoClient.tickets.reorderTasks(ticketId, data),
        onSuccess: (reorderedTasks, { ticketId }) => {
            queryClient.setQueryData(TICKET_KEYS.tasks(ticketId), reorderedTasks)
            toast.success('Tasks reordered successfully')
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to reorder tasks')
        },
    })
}

export function useLinkFilesToTicket() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ ticketId, fileIds }: { ticketId: number; fileIds: number[] }) =>
            octoClient.tickets.linkFilesToTicket(ticketId, fileIds),
        onSuccess: (linkedFiles, { ticketId }) => {
            queryClient.invalidateQueries({ queryKey: TICKET_KEYS.detail(ticketId) })
            toast.success('Files linked to ticket successfully')
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to link files to ticket')
        },
    })
}

export function useSuggestTasksForTicket() {
    return useMutation({
        mutationFn: ({ ticketId, userContext }: { ticketId: number; userContext?: string }) =>
            octoClient.tickets.suggestTasksForTicket(ticketId, userContext),
        onError: (error) => {
            toast.error(error.message || 'Failed to suggest tasks')
        },
    })
}

export function useSuggestFilesForTicket() {
    return useMutation({
        mutationFn: ({ ticketId, extraUserInput }: { ticketId: number; extraUserInput?: string }) =>
            octoClient.tickets.suggestFilesForTicket(ticketId, extraUserInput),
        onError: (error) => {
            toast.error(error.message || 'Failed to suggest files')
        },
    })
}

// --- Bulk Operations ---
export function useGetTasksForTickets(ticketIds: number[]) {
    return useQuery({
        queryKey: ['bulk-tasks', ...ticketIds.sort()],
        queryFn: () => octoClient.tickets.getTasksForTickets(ticketIds),
        enabled: ticketIds.length > 0,
        staleTime: 2 * 60 * 1000,
    })
}

export function useListTicketsWithTaskCount(projectId: number, status?: string) {
    return useQuery({
        queryKey: ['tickets-with-count', projectId, status || 'all'],
        queryFn: () => octoClient.tickets.listTicketsWithTaskCount(projectId, status),
        enabled: !!projectId,
        staleTime: 2 * 60 * 1000,
    })
}

export function useListTicketsWithTasks(projectId: number, status?: string) {
    return useQuery({
        queryKey: ['tickets-with-tasks', projectId, status || 'all'],
        queryFn: () => octoClient.tickets.listTicketsWithTasks(projectId, status),
        enabled: !!projectId,
        staleTime: 2 * 60 * 1000,
    })
}

// --- Utility Hooks for Complex Operations ---

// packages/client/src/hooks/api/use-octoprompt-utils.ts
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

// Batch operations
export function useBatchProjectOperations() {
    const queryClient = useQueryClient()

    return {
        invalidateAllProjects: () => {
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.all })
        },

        prefetchProject: (projectId: number) => {
            queryClient.prefetchQuery({
                queryKey: PROJECT_KEYS.detail(projectId),
                queryFn: () => octoClient.projects.getProject(projectId),
                staleTime: 5 * 60 * 1000,
            })
        },

        setProjectOptimistically: (project: Project) => {
            queryClient.setQueryData(PROJECT_KEYS.detail(project.id), project)
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
                    queryFn: () => octoClient.projects.getProjectFiles(projectId),
                }),
                queryClient.prefetchQuery({
                    queryKey: PROMPT_KEYS.projectPrompts(projectId),
                    queryFn: () => octoClient.prompts.listProjectPrompts(projectId),
                }),
                queryClient.prefetchQuery({
                    queryKey: TICKET_KEYS.projectTickets(projectId),
                    queryFn: () => octoClient.tickets.listProjectTickets(projectId),
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
            queryKeys.forEach(queryKey => {
                queryClient.invalidateQueries({ queryKey, refetchType: 'none' })
            })
        }
    }
}