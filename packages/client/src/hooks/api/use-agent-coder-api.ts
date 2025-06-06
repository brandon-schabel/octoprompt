import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { octoClient } from '../api-hooks'
import type {
  AgentCoderRunRequest,
  AgentCoderRunResponse,
  AgentDataLog
} from '@octoprompt/schemas'

const AGENT_CODER_KEYS = {
  all: ['agentCoder'] as const,
  projectRuns: (projectId: number) => [...AGENT_CODER_KEYS.all, 'projectRuns', projectId] as const,
  runData: (projectId: number, agentJobId: number) => [...AGENT_CODER_KEYS.all, 'runData', projectId, agentJobId] as const,
  runLogs: (projectId: number, agentJobId: number) => [...AGENT_CODER_KEYS.all, 'runLogs', projectId, agentJobId] as const,
}

export const useRunAgentCoder = (projectId: number) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: AgentCoderRunRequest) => octoClient.agentCoder.runAgentCoder(projectId, data),
    onSuccess: (data: AgentCoderRunResponse) => {
      if (data.success && data.data?.agentJobId) {
        toast.success(`Agent Coder job ${data.data.agentJobId} finished successfully!`)
      } else if (data.success) {
        toast.success('Agent Coder finished successfully!')
      } else {
        toast.error('Agent Coder reported failure.')
      }

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['projects', 'files', projectId] })
      queryClient.invalidateQueries({ queryKey: AGENT_CODER_KEYS.projectRuns(projectId) })

      // Invalidate specific run data/logs if available
      if (data.success && data.data?.agentJobId) {
        const agentJobId = data.data.agentJobId
        queryClient.invalidateQueries({ queryKey: AGENT_CODER_KEYS.runData(projectId, agentJobId) })
        queryClient.invalidateQueries({ queryKey: AGENT_CODER_KEYS.runLogs(projectId, agentJobId) })
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Agent Coder failed')
    }
  })
}

export const useListAgentCoderRuns = (projectId: number) => {
  return useQuery({
    queryKey: AGENT_CODER_KEYS.projectRuns(projectId),
    queryFn: () => octoClient.agentCoder.listAgentRuns(projectId),
    enabled: !!projectId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

export const useGetAgentCoderRunLogs = (
  projectId: number,
  agentJobId: number,
  options: { enabled?: boolean; isAgentRunning?: boolean } = {}
) => {
  return useQuery({
    queryKey: AGENT_CODER_KEYS.runLogs(projectId, agentJobId),
    queryFn: () => octoClient.agentCoder.getAgentRunLogs(projectId, agentJobId),
    enabled: !!projectId && !!agentJobId && (options.enabled ?? true),
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchInterval: options.isAgentRunning ? 250 : false
  })
}

export const useGetAgentCoderRuns = (projectId: number) => {
  return useQuery({
    queryKey: AGENT_CODER_KEYS.projectRuns(projectId),
    queryFn: () => octoClient.agentCoder.listAgentRuns(projectId),
    enabled: !!projectId,
    staleTime: 2 * 60 * 1000,
  })
}

export const useGetAgentCoderRunData = ({
  agentJobId,
  enabled = true,
  isAgentRunning = false,
  projectId
}: {
  agentJobId: number
  enabled?: boolean
  isAgentRunning?: boolean
  projectId: number
}) => {
  return useQuery({
    queryKey: AGENT_CODER_KEYS.runData(projectId, agentJobId),
    queryFn: () => octoClient.agentCoder.getAgentRunData(projectId, agentJobId),
    refetchInterval: isAgentRunning ? 250 : false,
    enabled: !!agentJobId && !!projectId && enabled,
    staleTime: 30 * 1000, // 30 seconds
  })
}

export const useConfirmAgentRunChanges = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ agentJobId, projectId }: { agentJobId: number; projectId: number }) =>
      octoClient.agentCoder.confirmAgentRun(projectId, agentJobId),
    onSuccess: (data, variables) => {
      if (data.success) {
        toast.success(data.message || `Agent run ${variables.agentJobId} changes confirmed and applied!`)

        // Invalidate project files to reflect changes
        queryClient.invalidateQueries({ queryKey: ['projects', 'files', variables.projectId] })

        // Invalidate run data
        queryClient.invalidateQueries({
          queryKey: AGENT_CODER_KEYS.runData(variables.projectId, variables.agentJobId)
        })

        // Invalidate runs list
        queryClient.invalidateQueries({
          queryKey: AGENT_CODER_KEYS.projectRuns(variables.projectId)
        })
      } else {
        toast.error('Failed to confirm agent run changes.')
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to confirm agent run changes')
    }
  })
}

export const useDeleteAgentCoderRun = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ agentJobId, projectId }: { agentJobId: number; projectId: number }) =>
      octoClient.agentCoder.deleteAgentRun(agentJobId),
    onSuccess: (data, variables) => {
      if (data.success) {
        toast.success(data.message || `Agent run ${variables.agentJobId} deleted successfully!`)

        // Invalidate the list of agent runs
        queryClient.invalidateQueries({
          queryKey: AGENT_CODER_KEYS.projectRuns(variables.projectId)
        })

        // Remove specific run data/logs from cache
        queryClient.removeQueries({
          queryKey: AGENT_CODER_KEYS.runData(variables.projectId, variables.agentJobId)
        })
        queryClient.removeQueries({
          queryKey: AGENT_CODER_KEYS.runLogs(variables.projectId, variables.agentJobId)
        })
      } else {
        toast.error('Failed to delete agent run.')
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete agent run')
    }
  })
}
