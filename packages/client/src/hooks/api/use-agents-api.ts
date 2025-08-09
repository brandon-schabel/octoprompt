import { DataResponseSchema } from '@promptliano/api-client'
import type { CreateClaudeAgentBody, UpdateClaudeAgentBody, ClaudeAgent } from '@promptliano/schemas'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useApiClient } from './use-api-client'

// Query Keys
export const AGENT_KEYS = {
  all: ['agents'] as const,
  list: () => [...AGENT_KEYS.all, 'list'] as const,
  detail: (agentId: string) => [...AGENT_KEYS.all, 'detail', agentId] as const,
  projectAgents: (projectId: number) => [...AGENT_KEYS.all, 'project', projectId] as const
}

// --- Query Hooks ---
export function useGetAllAgents(projectId?: number) {
  const client = useApiClient()
  // Client null check removed - handled by React Query

  return useQuery({
    queryKey: projectId ? [...AGENT_KEYS.list(), projectId] : AGENT_KEYS.list(),
    enabled: !!client,
    queryFn: () => client.agents.listAgents(projectId),
    staleTime: 5 * 60 * 1000 // 5 minutes
  })
}

export function useGetAgent(agentId: string, projectId?: number) {
  const client = useApiClient()
  // Client null check removed - handled by React Query

  return useQuery({
    queryKey: projectId ? [...AGENT_KEYS.detail(agentId), projectId] : AGENT_KEYS.detail(agentId),
    queryFn: () => client.agents.getAgent(agentId, projectId),
    enabled: !!client && !!agentId,
    staleTime: 5 * 60 * 1000
  })
}

export function useGetProjectAgents(projectId: number) {
  const client = useApiClient()
  // Client null check removed - handled by React Query

  return useQuery({
    queryKey: AGENT_KEYS.projectAgents(projectId),
    queryFn: () => client.agents.listProjectAgents(projectId),
    enabled: !!client && !!projectId,
    staleTime: 5 * 60 * 1000
  })
}

// --- Mutation Hooks ---
export function useCreateAgent(projectId?: number) {
  const client = useApiClient()

  const { invalidateAllAgents } = useInvalidateAgents()

  return useMutation({
    mutationFn: (data: CreateClaudeAgentBody) => client!.agents.createAgent(data, projectId),
    onSuccess: (newAgent) => {
      invalidateAllAgents()
      toast.success('Agent created successfully')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create agent')
    }
  })
}

export function useUpdateAgent(projectId?: number) {
  const client = useApiClient()
  // Client null check removed - handled by React Query

  const { invalidateAllAgents, setAgentDetail } = useInvalidateAgents()

  return useMutation({
    mutationFn: ({ agentId, data }: { agentId: string; data: UpdateClaudeAgentBody }) =>
      client.agents.updateAgent(agentId, data, projectId),
    onSuccess: ({ data: updatedAgent }: DataResponseSchema<ClaudeAgent>) => {
      invalidateAllAgents()
      setAgentDetail(updatedAgent)
      toast.success('Agent updated successfully')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update agent')
    }
  })
}

export function useDeleteAgent(projectId?: number) {
  const client = useApiClient()

  const { invalidateAllAgents, removeAgent } = useInvalidateAgents()

  return useMutation({
    mutationFn: (agentId: string) => client!.agents.deleteAgent(agentId, projectId),
    onSuccess: (_, agentId) => {
      invalidateAllAgents()
      removeAgent(agentId)
      toast.success('Agent deleted successfully')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete agent')
    }
  })
}

// --- Project Association Hooks ---
export function useAddAgentToProject() {
  const client = useApiClient()
  // Client null check removed - handled by React Query

  const { invalidateProjectAgents } = useInvalidateAgents()

  return useMutation({
    mutationFn: ({ projectId, agentId }: { projectId: number; agentId: string }) =>
      client.agents.addAgentToProject(projectId, agentId),
    onSuccess: (_, { projectId }) => {
      invalidateProjectAgents(projectId)
      toast.success('Agent added to project')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to add agent to project')
    }
  })
}

export function useRemoveAgentFromProject() {
  const client = useApiClient()
  // Client null check removed - handled by React Query

  const { invalidateProjectAgents } = useInvalidateAgents()

  return useMutation({
    mutationFn: ({ projectId, agentId }: { projectId: number; agentId: string }) =>
      client.agents.removeAgentFromProject(projectId, agentId),
    onSuccess: (_, { projectId }) => {
      invalidateProjectAgents(projectId)
      toast.success('Agent removed from project')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to remove agent from project')
    }
  })
}

// --- AI Suggestions Hook ---
export function useSuggestAgents() {
  const client = useApiClient()
  // Client null check removed - handled by React Query

  return useMutation({
    mutationFn: ({ projectId, userInput, limit }: { projectId: number; userInput: string; limit?: number }) =>
      client.agents.suggestAgents(projectId, userInput, limit),
    onError: (error) => {
      toast.error(error.message || 'Failed to get agent suggestions')
    }
  })
}

// --- Invalidation Utilities ---
export function useInvalidateAgents() {
  const queryClient = useQueryClient()

  return {
    invalidateAllAgents: () => {
      queryClient.invalidateQueries({ queryKey: AGENT_KEYS.all })
    },
    invalidateAgent: (agentId: string) => {
      queryClient.invalidateQueries({ queryKey: AGENT_KEYS.detail(agentId) })
    },
    invalidateProjectAgents: (projectId: number) => {
      queryClient.invalidateQueries({ queryKey: AGENT_KEYS.projectAgents(projectId) })
    },
    removeAgent: (agentId: string) => {
      queryClient.removeQueries({ queryKey: AGENT_KEYS.detail(agentId) })
    },
    removeProjectAgents: (projectId: number) => {
      queryClient.removeQueries({ queryKey: AGENT_KEYS.projectAgents(projectId) })
    },
    setAgentDetail: (agent: ClaudeAgent) => {
      queryClient.setQueryData(AGENT_KEYS.detail(agent.id), { success: true, data: agent })
    },
    invalidateAllAgentsAndProjects: (projectId?: number) => {
      queryClient.invalidateQueries({ queryKey: AGENT_KEYS.all })
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: AGENT_KEYS.projectAgents(projectId) })
      }
    }
  }
}
