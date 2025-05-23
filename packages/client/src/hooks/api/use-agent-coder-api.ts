import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query'
import { v4 as uuidv4 } from 'uuid'
import {
  postApiProjectsByProjectIdAgentCoderMutation,
  getApiProjectsByProjectIdFilesQueryKey,
  getApiAgentCoderProjectByProjectIdRunsOptions,
  getApiAgentCoderProjectByProjectIdRunsByAgentJobIdDataOptions,
  getApiAgentCoderProjectByProjectIdRunsByAgentJobIdDataQueryKey,
  getApiAgentCoderProjectByProjectIdRunsByAgentJobIdLogsOptions,
  getApiAgentCoderProjectByProjectIdRunsByAgentJobIdLogsQueryKey,
  deleteApiAgentCoderRunsByAgentJobIdMutation,
  postApiAgentCoderProjectByProjectIdRunsByAgentJobIdConfirmMutation
} from '../../generated/@tanstack/react-query.gen'
import { toast } from 'sonner'
import {
  type PostApiProjectsByProjectIdAgentCoderError,
  type PostApiProjectsByProjectIdAgentCoderData,
  type AgentCoderRunRequest as AgentCoderRunRequestBody,
  type ProjectFile,
  type GetApiProjectsByProjectIdFilesData,
  type ApiErrorResponse,
  type GetApiAgentCoderProjectByProjectIdRunsByAgentJobIdDataData,
  type GetApiAgentCoderProjectByProjectIdRunsByAgentJobIdLogsData,
  type PostApiAgentCoderProjectByProjectIdRunsByAgentJobIdConfirmData,
  type PostApiAgentCoderProjectByProjectIdRunsByAgentJobIdConfirmError,
  type PostApiAgentCoderProjectByProjectIdRunsByAgentJobIdConfirmResponse,
  type PostApiAgentCoderProjectByProjectIdRunsByAgentJobIdConfirmErrors,
  DeleteApiAgentCoderRunsByAgentJobIdResponse,
  DeleteApiAgentCoderRunsByAgentJobIdError,
  DeleteApiAgentCoderRunsByAgentJobIdData
} from '../../generated/types.gen'
import { type Options } from '../../generated/sdk.gen'
import { commonErrorHandler } from './common-mutation-error-handler'
import {
  type TaskPlan,
  AgentCoderRunSuccessDataSchema,
  type AgentCoderRunSuccessData
} from 'shared/src/schemas/agent-coder.schemas'

// Use the specific Zod-derived type for the data endpoint
export type AgentRunData = AgentCoderRunSuccessData

// Define the query key type explicitly for clarity
type AgentRunDataQueryKey = ReturnType<typeof getApiAgentCoderProjectByProjectIdRunsByAgentJobIdDataOptions>['queryKey']

// Corresponds to AgentCoderRunResponseSchema in agent-coder-routes.ts
type AgentCoderRunResponse = {
  success: boolean
  data?: AgentRunData & { agentJobId: string; taskPlan?: TaskPlan | null } // Combine types for the run response
  error?: ApiErrorResponse['error']
}

export const useRunAgentCoder = (projectId: string) => {
  const queryClient = useQueryClient()
  const mutationOptionsFn = postApiProjectsByProjectIdAgentCoderMutation()

  return useMutation<AgentCoderRunResponse, PostApiProjectsByProjectIdAgentCoderError, AgentCoderRunRequestBody>({
    mutationFn: async (variables: AgentCoderRunRequestBody) => {
      const options: Options<PostApiProjectsByProjectIdAgentCoderData> = {
        path: { projectId },
        body: variables
      }
      const mutationFn = mutationOptionsFn.mutationFn
      if (!mutationFn) {
        throw new Error('Generated mutation function is not available.')
      }
      // Cast the result to the more specific frontend type
      const result = (await mutationFn(options)) as AgentCoderRunResponse
      return result
    },
    onSuccess: (data: AgentCoderRunResponse, variables) => {
      // Check against the more specific AgentCoderRunResponse type
      if (data.success && data.data?.agentJobId) {
        toast.success(`Agent Coder job ${data.data.agentJobId} finished successfully!`)
      } else if (data.success) {
        toast.success('Agent Coder finished successfully!')
      } else {
        const errorMessage = data.error?.message || 'Agent Coder reported failure.'
        toast.error(`Agent Coder Failed: ${errorMessage}`)
      }

      const queryKey = getApiProjectsByProjectIdFilesQueryKey({
        path: { projectId }
      } as Options<GetApiProjectsByProjectIdFilesData>)
      queryClient.invalidateQueries({ queryKey })
      const runsListQueryKey = getApiAgentCoderProjectByProjectIdRunsOptions({ path: { projectId } }).queryKey
      queryClient.invalidateQueries({ queryKey: runsListQueryKey })

      // Invalidate specific run data/logs if the job ID is available
      if (data.success && data.data?.agentJobId) {
        const agentJobId = data.data.agentJobId
        const dataQueryKey = getApiAgentCoderProjectByProjectIdRunsByAgentJobIdDataOptions({
          path: { projectId, agentJobId }
        }).queryKey
        const logsQueryKey = getApiAgentCoderProjectByProjectIdRunsByAgentJobIdLogsOptions({
          path: { projectId, agentJobId }
        }).queryKey
        queryClient.invalidateQueries({ queryKey: dataQueryKey })
        queryClient.invalidateQueries({ queryKey: logsQueryKey })
      }
    },
    onError: (error) => commonErrorHandler(error as unknown as Error)
  })
}

export const useListAgentCoderRuns = (projectId: string) => {
  return useQuery(getApiAgentCoderProjectByProjectIdRunsOptions({ path: { projectId } }))
}

export const useGetAgentCoderRunLogs = (
  options: { enabled?: boolean; isAgentRunning: boolean; projectId: string; agentJobId: string } = {
    enabled: false,
    isAgentRunning: false,
    projectId: '',
    agentJobId: ''
  }
) => {
  const pathParams: Options<GetApiAgentCoderProjectByProjectIdRunsByAgentJobIdLogsData>['path'] = {
    agentJobId: options.agentJobId ?? '',
    projectId: options.projectId ?? ''
  }

  return useQuery({
    ...getApiAgentCoderProjectByProjectIdRunsByAgentJobIdLogsOptions({
      path: pathParams
    }),
    // Ensure enabled respects both agentJobId presence and the passed option
    enabled: !!options.agentJobId && (options.enabled ?? true),
    refetchOnWindowFocus: false,
    refetchOnMount: true, // Refetch when component mounts or enabled state changes
    refetchInterval: options.isAgentRunning ? 250 : false
  })
}

export const useGetAgentCoderRuns = (projectId: string) => {
  return useQuery(getApiAgentCoderProjectByProjectIdRunsOptions({ path: { projectId } }))
}

export const useGetAgentCoderRunData = ({
  agentJobId,
  enabled = true,
  isAgentRunning = false,
  projectId
}: {
  agentJobId: string
  enabled?: boolean
  isAgentRunning?: boolean
  projectId: string
}) => {
  // Use the specific query key type here
  const queryOptions = getApiAgentCoderProjectByProjectIdRunsByAgentJobIdDataOptions({
    path: { projectId, agentJobId }
  }) as UseQueryOptions<AgentRunData, Error, AgentRunData, AgentRunDataQueryKey>

  return useQuery<AgentRunData, Error, AgentRunData, AgentRunDataQueryKey>({
    // Specify the type parameters including the query key
    ...queryOptions,
    refetchInterval: isAgentRunning ? 250 : false,
    enabled: !!agentJobId && enabled // Ensure job ID exists and enabled is true
  })
}

// --- NEW Hook: Confirm Agent Run Changes ---
export const useConfirmAgentRunChanges = () => {
  const queryClient = useQueryClient()
  const mutationOptionsFn = postApiAgentCoderProjectByProjectIdRunsByAgentJobIdConfirmMutation()

  return useMutation<
    PostApiAgentCoderProjectByProjectIdRunsByAgentJobIdConfirmResponse,
    PostApiAgentCoderProjectByProjectIdRunsByAgentJobIdConfirmError,
    { agentJobId: string; projectId: string }
  >({
    mutationFn: async ({ agentJobId, projectId }) => {
      const options: Options<PostApiAgentCoderProjectByProjectIdRunsByAgentJobIdConfirmData> = {
        path: { projectId, agentJobId }
      }
      const mutationFn = mutationOptionsFn.mutationFn
      if (!mutationFn) {
        throw new Error('Generated confirmation mutation function is not available.')
      }
      const result = await mutationFn(options)
      // The generated type PostApiAgentCoderRunsByAgentJobIdConfirmResponse should be correct
      return result as PostApiAgentCoderProjectByProjectIdRunsByAgentJobIdConfirmResponse
    },
    onSuccess: (data, variables) => {
      if (data.success) {
        toast.success(data.message || `Agent run ${variables.agentJobId} changes confirmed and applied!`)

        // Invalidate project files to reflect changes
        queryClient.invalidateQueries({ queryKey: ['getApiProjectsByProjectIdFiles'] }) // Invalidate based on query key prefix

        // Optionally, refetch the specific run data to show it no longer needs confirmation (if applicable)
        const dataQueryKey = getApiAgentCoderProjectByProjectIdRunsByAgentJobIdDataOptions({
          path: { projectId: variables.projectId, agentJobId: variables.agentJobId }
        }).queryKey
        queryClient.invalidateQueries({ queryKey: dataQueryKey })

        // Invalidate runs list in case status changes (though less likely needed here)
        const runsListQueryKey = getApiAgentCoderProjectByProjectIdRunsOptions({
          path: { projectId: variables.projectId }
        }).queryKey
        queryClient.invalidateQueries({ queryKey: runsListQueryKey })
      } else {
        const errorMessage = (data as any)?.error?.message || 'Failed to confirm agent run changes.'
        toast.error(`Confirmation Failed: ${errorMessage}`)
        console.error('Confirm Agent Run Failure:', data)
      }
    },
    onError: (error) => commonErrorHandler(error as unknown as Error)
  })
}

// --- NEW Hook: Delete Agent Run ---
export const useDeleteAgentCoderRun = () => {
  const queryClient = useQueryClient()
  // Get the options generator function from the generated code
  const mutationOptionsFn = deleteApiAgentCoderRunsByAgentJobIdMutation()

  return useMutation<
    DeleteApiAgentCoderRunsByAgentJobIdResponse, // Success response type
    DeleteApiAgentCoderRunsByAgentJobIdError, // Error type
    { agentJobId: string; projectId: string } // Variables type ({ agentJobId })
  >({
    mutationFn: async ({ agentJobId, projectId }) => {
      const options: Options<DeleteApiAgentCoderRunsByAgentJobIdData> = {
        // Use the correct Options type
        path: { projectId, agentJobId }
      }
      const mutationFn = mutationOptionsFn.mutationFn
      if (!mutationFn) {
        throw new Error('Generated delete mutation function is not available.')
      }
      // The result type should align with DeleteApiAgentCoderRunsByAgentJobIdResponse
      const result = await mutationFn(options)
      return result as DeleteApiAgentCoderRunsByAgentJobIdResponse // Cast for certainty
    },
    onSuccess: (data, variables) => {
      // Check the structure of 'data' based on your actual response schema (DeleteAgentRunResponseSchema)
      if (data.success) {
        toast.success(data.message || `Agent run ${variables.agentJobId} deleted successfully!`)

        // --- IMPORTANT: Invalidate the list of agent runs ---
        const runsListQueryKey = getApiAgentCoderProjectByProjectIdRunsOptions({
          path: { projectId: variables.projectId }
        }).queryKey
        queryClient.invalidateQueries({ queryKey: runsListQueryKey })

        // Optionally invalidate specific run data/logs if they were cached, though they shouldn't exist anymore
        const dataQueryKey = getApiAgentCoderProjectByProjectIdRunsByAgentJobIdDataOptions({
          path: { projectId: variables.projectId, agentJobId: variables.agentJobId }
        }).queryKey
        const logsQueryKey = getApiAgentCoderProjectByProjectIdRunsByAgentJobIdLogsOptions({
          path: { projectId: variables.projectId, agentJobId: variables.agentJobId }
        }).queryKey
        queryClient.removeQueries({ queryKey: dataQueryKey }) // Remove cached data/logs for the deleted run
        queryClient.removeQueries({ queryKey: logsQueryKey })
      } else {
        // Handle cases where the backend might return success: false in a 200 (should ideally be a 4xx/5xx)
        const errorMessage = (data as any)?.error?.message || 'Failed to delete agent run.'
        toast.error(`Deletion Failed: ${errorMessage}`)
        console.error('Delete Agent Run Failure Response:', data)
      }
    },
    onError: (error) => {
      // Use the specific error type if available for better handling
      const apiError = error as DeleteApiAgentCoderRunsByAgentJobIdError
      const message = apiError?.error?.message || 'An unknown error occurred during deletion.'
      toast.error(`Deletion Failed: ${message}`)
      commonErrorHandler(error as unknown as Error) // Use common handler for logging etc.
    }
  })
}
