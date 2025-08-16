import { DataResponseSchema } from '@promptliano/api-client'
import type {
  CreateClaudeCommandBody,
  UpdateClaudeCommandBody,
  ClaudeCommand,
  SearchCommandsQuery,
  CommandSuggestions,
  CommandGenerationRequest
} from '@promptliano/schemas'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useApiClient } from './use-api-client'

// Query Keys
export const COMMAND_KEYS = {
  all: ['commands'] as const,
  list: (projectId: number) => [...COMMAND_KEYS.all, 'list', projectId] as const,
  detail: (projectId: number, commandName: string, namespace?: string) =>
    namespace
      ? ([...COMMAND_KEYS.all, 'detail', projectId, commandName, namespace] as const)
      : ([...COMMAND_KEYS.all, 'detail', projectId, commandName] as const),
  search: (projectId: number, query: SearchCommandsQuery) => [...COMMAND_KEYS.all, 'search', projectId, query] as const,
  suggestions: (projectId: number) => [...COMMAND_KEYS.all, 'suggestions', projectId] as const
}

// --- Query Hooks ---
export function useGetProjectCommands(projectId: number, query?: SearchCommandsQuery) {
  const client = useApiClient()
  // Client null check removed - handled by React Query

  return useQuery({
    queryKey: query ? COMMAND_KEYS.search(projectId, query) : COMMAND_KEYS.list(projectId),
    queryFn: () => {
      if (!client) throw new Error('API client not initialized')
      return client.commands.listCommands(projectId, query)
    },
    enabled: !!client && !!projectId,
    staleTime: 5 * 60 * 1000 // 5 minutes
  })
}

export function useGetCommand(projectId: number, commandName: string, namespace?: string) {
  const client = useApiClient()
  // Client null check removed - handled by React Query

  return useQuery({
    queryKey: COMMAND_KEYS.detail(projectId, commandName, namespace),
    queryFn: () => {
      if (!client) throw new Error('API client not initialized')
      return client.commands.getCommand(projectId, commandName, namespace)
    },
    enabled: !!client && !!projectId && !!commandName,
    staleTime: 5 * 60 * 1000
  })
}

// --- Mutation Hooks ---
export function useCreateCommand(projectId: number) {
  const client = useApiClient()

  const { invalidateProjectCommands } = useInvalidateCommands()

  return useMutation({
    mutationFn: (data: CreateClaudeCommandBody) => {
      if (!client) throw new Error('API client not initialized')
      return client.commands.createCommand(projectId, data)
    },
    onSuccess: ({ data: newCommand }: DataResponseSchema<ClaudeCommand>) => {
      invalidateProjectCommands(projectId)
      toast.success(`Command '${newCommand.name}' created successfully`)
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create command')
    }
  })
}

export function useUpdateCommand(projectId: number) {
  const client = useApiClient()
  // Client null check removed - handled by React Query

  const { invalidateProjectCommands, setCommandDetail } = useInvalidateCommands()

  return useMutation({
    mutationFn: ({
      commandName,
      data,
      namespace
    }: {
      commandName: string
      data: UpdateClaudeCommandBody
      namespace?: string
    }) => {
      if (!client) throw new Error('API client not initialized')
      return client.commands.updateCommand(projectId, commandName, data, namespace)
    },
    onSuccess: ({ data: updatedCommand }: DataResponseSchema<ClaudeCommand>) => {
      invalidateProjectCommands(projectId)
      setCommandDetail(projectId, updatedCommand)
      toast.success(`Command '${updatedCommand.name}' updated successfully`)
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update command')
    }
  })
}

export function useDeleteCommand(projectId: number) {
  const client = useApiClient()
  // Client null check removed - handled by React Query

  const { invalidateProjectCommands, removeCommand } = useInvalidateCommands()

  return useMutation({
    mutationFn: ({ commandName, namespace }: { commandName: string; namespace?: string }) => {
      if (!client) throw new Error('API client not initialized')
      return client.commands.deleteCommand(projectId, commandName, namespace)
    },
    onSuccess: (_, { commandName, namespace }) => {
      invalidateProjectCommands(projectId)
      removeCommand(projectId, commandName, namespace)
      toast.success(`Command '${commandName}' deleted successfully`)
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete command')
    }
  })
}

export function useExecuteCommand(projectId: number) {
  const client = useApiClient()
  // Client null check removed - handled by React Query

  return useMutation({
    mutationFn: ({ commandName, args, namespace }: { commandName: string; args?: string; namespace?: string }) => {
      if (!client) throw new Error('API client not initialized')
      return client.commands.executeCommand(projectId, commandName, args, namespace)
    },
    onSuccess: (result, { commandName }) => {
      toast.success(`Command '${commandName}' executed successfully`)
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to execute command')
    }
  })
}

export function useSuggestCommands(projectId: number) {
  const client = useApiClient()
  // Client null check removed - handled by React Query

  return useMutation({
    mutationFn: ({ context, limit }: { context?: string; limit?: number }) => {
      if (!client) throw new Error('API client not initialized')
      return client.commands.suggestCommands(projectId, context, limit)
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to get command suggestions')
    }
  })
}

export function useGenerateCommand(projectId: number) {
  const client = useApiClient()

  return useMutation({
    mutationFn: (data: CommandGenerationRequest) => {
      if (!client) throw new Error('API client not initialized')
      return client.commands.generateCommand(projectId, data)
    },
    onSuccess: (result) => {
      const typedResult = result as any
      toast.success(`Command '${typedResult.data.name}' generated successfully`)
    },
    onError: (error: any) => {
      // Check if it's a timeout error
      if (error.errorCode === 'TIMEOUT' || error.message?.includes('timeout')) {
        toast.error(
          'Command generation timed out. This can happen with complex requests. Please try again with simpler requirements or contact support if the issue persists.'
        )
      } else {
        toast.error(error.message || 'Failed to generate command')
      }
    }
  })
}

// --- Invalidation Utilities ---
export function useInvalidateCommands() {
  const queryClient = useQueryClient()

  return {
    invalidateAllCommands: () => {
      queryClient.invalidateQueries({ queryKey: COMMAND_KEYS.all })
    },
    invalidateProjectCommands: (projectId: number) => {
      queryClient.invalidateQueries({ queryKey: COMMAND_KEYS.list(projectId) })
      // Also invalidate search queries for this project
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey
          return Array.isArray(key) && key[0] === 'commands' && key[1] === 'search' && key[2] === projectId
        }
      })
    },
    invalidateCommand: (projectId: number, commandName: string, namespace?: string) => {
      queryClient.invalidateQueries({
        queryKey: COMMAND_KEYS.detail(projectId, commandName, namespace)
      })
    },
    removeCommand: (projectId: number, commandName: string, namespace?: string) => {
      queryClient.removeQueries({
        queryKey: COMMAND_KEYS.detail(projectId, commandName, namespace)
      })
    },
    setCommandDetail: (projectId: number, command: ClaudeCommand) => {
      queryClient.setQueryData(COMMAND_KEYS.detail(projectId, command.name, command.namespace), {
        success: true,
        data: command
      })
    }
  }
}
