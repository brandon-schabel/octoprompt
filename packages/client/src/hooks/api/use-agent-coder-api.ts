import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { octoClient } from '@/hooks/octo-client'
import { toast } from 'sonner'
import type { RunAgentCoderBody, AgentCoderRunSuccessData } from '@octoprompt/schemas'

export function useRunAgentCoder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ projectId, ...body }: { projectId: number } & RunAgentCoderBody) => {
      return octoClient.agentCoder.runAgentCoder(projectId, body)
    },
    onSuccess: (data, variables) => {
      if (data.success && data.data?.agentJobId) {
        toast.success(`Agent Coder job ${data.data.agentJobId} started successfully!`)
      } else if (!data.success) {
        toast.error('Agent Coder failed')
      }

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['agent-coder-runs', variables.projectId] })
      queryClient.invalidateQueries({ queryKey: ['project-files', variables.projectId] })
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to run Agent Coder')
    }
  })
}

export function useGetAgentCoderRuns(projectId: number) {
  return useQuery({
    queryKey: ['agent-coder-runs', projectId],
    queryFn: () => octoClient.agentCoder.listRuns(projectId),
    enabled: projectId > 0, // Only enable if valid projectId
    select: (data) => data.data || []
  })
}

export function useGetAgentCoderLogs(projectId: number, agentJobId: number | null) {
  return useQuery({
    queryKey: ['agent-coder-logs', projectId, agentJobId],
    queryFn: () => {
      if (!agentJobId) throw new Error('No agent job ID')
      return octoClient.agentCoder.getLogs(projectId, agentJobId)
    },
    enabled: projectId > 0 && !!agentJobId, // Check both projectId and agentJobId
    select: (data) => data.data || []
  })
}

export function useGetAgentCoderData(projectId: number, agentJobId: number | null) {
  return useQuery({
    queryKey: ['agent-coder-data', projectId, agentJobId],
    queryFn: () => {
      if (!agentJobId) throw new Error('No agent job ID')
      return octoClient.agentCoder.getData(projectId, agentJobId)
    },
    enabled: projectId > 0 && !!agentJobId, // Check both projectId and agentJobId
    select: (data) => data.data as AgentCoderRunSuccessData | null
  })
}

export function useConfirmAgentCoderChanges() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ projectId, agentJobId }: { projectId: number; agentJobId: number }) => {
      return octoClient.agentCoder.confirmChanges(projectId, agentJobId)
    },
    onSuccess: (data, variables) => {
      if (data.success) {
        toast.success(data.message || 'Changes confirmed and applied!')

        // Invalidate related queries
        queryClient.invalidateQueries({ queryKey: ['project-files', variables.projectId] })
        queryClient.invalidateQueries({ queryKey: ['agent-coder-data', variables.projectId, variables.agentJobId] })
        queryClient.invalidateQueries({ queryKey: ['agent-coder-runs', variables.projectId] })
      } else {
        toast.error('Failed to confirm changes')
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to confirm changes')
    }
  })
}

export function useDeleteAgentCoderRun() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ agentJobId }: { agentJobId: number }) => {
      return octoClient.agentCoder.deleteRun(agentJobId)
    },
    onSuccess: (data, variables) => {
      if (data.success) {
        toast.success(data.message || 'Agent run deleted successfully!')

        // Invalidate and remove related queries
        queryClient.invalidateQueries({ queryKey: ['agent-coder-runs'] })
        queryClient.removeQueries({ queryKey: ['agent-coder-data', variables.agentJobId] })
        queryClient.removeQueries({ queryKey: ['agent-coder-logs', variables.agentJobId] })
      } else {
        toast.error('Failed to delete agent run')
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete agent run')
    }
  })
}
