import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query'
// import { v4 as uuidv4 } from 'uuid' // uuid seems unused in the provided snippet
import {
    runAgentCoderApiProjectsProjectIdAgentCoderPostMutation, // Updated name
    getProjectFilesRouteProjectsProjectIdFilesGetQueryKey, // Updated name (from use-projects-api context)
    listProjectAgentRunsApiProjectsProjectIdAgentCoderRunsGetOptions, // Updated name
    getAgentRunDataApiProjectsProjectIdAgentCoderRunsAgentJobIdDataGetOptions, // Updated name
    getAgentRunDataApiProjectsProjectIdAgentCoderRunsAgentJobIdDataGetQueryKey, // Updated name
    getAgentRunLogsApiProjectsProjectIdAgentCoderRunsAgentJobIdLogsGetOptions, // Updated name
    getAgentRunLogsApiProjectsProjectIdAgentCoderRunsAgentJobIdLogsGetQueryKey, // Updated name
    deleteAgentRunApiProjectsProjectIdAgentCoderRunsAgentJobIdDeleteMutation, // Updated name
    confirmAgentRunChangesApiProjectsProjectIdAgentCoderRunsAgentJobIdConfirmPostMutation // Updated name
} from '../../generated-python/@tanstack/react-query.gen' // Ensure path
import { toast } from 'sonner'
import {
    type RunAgentCoderApiProjectsProjectIdAgentCoderPostError, // Updated name
    type RunAgentCoderApiProjectsProjectIdAgentCoderPostData, // Updated name
    type RunAgentCoderApiProjectsProjectIdAgentCoderPostResponse, // Added for clarity
    type AgentCoderRunRequest as AgentCoderRunRequestBody, // Keep alias if used, ensure AgentCoderRunRequest matches RunAgentCoderApiProjectsProjectIdAgentCoderPostData['body']
    type GetProjectFilesRouteProjectsProjectIdFilesGetData, // Updated name
    type GetAgentRunDataApiProjectsProjectIdAgentCoderRunsAgentJobIdDataGetData, // Updated name
    type GetAgentRunLogsApiProjectsProjectIdAgentCoderRunsAgentJobIdLogsGetData, // Updated name
    type ConfirmAgentRunChangesApiProjectsProjectIdAgentCoderRunsAgentJobIdConfirmPostData, // Updated name
    type ConfirmAgentRunChangesApiProjectsProjectIdAgentCoderRunsAgentJobIdConfirmPostError, // Updated name
    type ConfirmAgentRunChangesApiProjectsProjectIdAgentCoderRunsAgentJobIdConfirmPostResponse, // Updated name
    // type PostApiAgentCoderProjectByProjectIdRunsByAgentJobIdConfirmErrors, // This seems specific, check if still needed or mapped to Confirm...PostError
    type DeleteAgentRunApiProjectsProjectIdAgentCoderRunsAgentJobIdDeleteResponse, // Updated name
    type DeleteAgentRunApiProjectsProjectIdAgentCoderRunsAgentJobIdDeleteError, // Updated name
    type DeleteAgentRunApiProjectsProjectIdAgentCoderRunsAgentJobIdDeleteData // Updated name
} from '../../generated-python/types.gen' // Ensure path
import { type Options } from '../../generated-python/sdk.gen' // Ensure path
import { commonErrorHandler } from './common-mutation-error-handler'
import {
    type TaskPlan,
    //   AgentCoderRunSuccessDataSchema, // This schema seems to be from 'shared'
    type AgentCoderRunSuccessData // This also seems to be from 'shared'
} from 'shared/src/schemas/agent-coder.schemas'

// Use the specific Zod-derived type for the data endpoint
export type AgentRunData = AgentCoderRunSuccessData // This remains if AgentCoderRunSuccessData is the correct structure

// Define the query key type explicitly for clarity
// Using the specific generated query key function's return type
type AgentRunDataQueryKey = ReturnType<typeof getAgentRunDataApiProjectsProjectIdAgentCoderRunsAgentJobIdDataGetQueryKey>

// Corresponds to AgentCoderRunResponseSchema in agent-coder-routes.ts
// This type should align with RunAgentCoderApiProjectsProjectIdAgentCoderPostResponse
type AgentCoderRunFrontendResponse = RunAgentCoderApiProjectsProjectIdAgentCoderPostResponse & {
    // Frontend might expect additional properties or slightly different structure than raw API
    // For now, let's assume RunAgentCoderApiProjectsProjectIdAgentCoderPostResponse is sufficient
    // If `data.data.agentJobId` was used, it means the response has a nested structure.
    // The generated RunAgentCoderApiProjectsProjectIdAgentCoderPostResponse type should reflect the actual API response.
};


export const useRunAgentCoder = (projectId: string) => {
    const queryClient = useQueryClient()
    const mutationOptionsFn = runAgentCoderApiProjectsProjectIdAgentCoderPostMutation() // Updated name

    return useMutation<RunAgentCoderApiProjectsProjectIdAgentCoderPostResponse, RunAgentCoderApiProjectsProjectIdAgentCoderPostError, AgentCoderRunRequestBody>({ // Updated types
        mutationFn: async (variables: AgentCoderRunRequestBody) => {
            const options: Options<RunAgentCoderApiProjectsProjectIdAgentCoderPostData> = { // Updated type
                path: { project_id: projectId },
                body: variables // Assuming AgentCoderRunRequestBody matches the body type
            }
            const mutationFn = mutationOptionsFn.mutationFn
            if (!mutationFn) {
                throw new Error('Generated mutation function is not available.')
            }
            const result = await mutationFn(options)
            return result // Type is RunAgentCoderApiProjectsProjectIdAgentCoderPostResponse
        },
        onSuccess: (response: RunAgentCoderApiProjectsProjectIdAgentCoderPostResponse, variables) => { // Updated type
            // Adjust access to agentJobId based on the actual structure of RunAgentCoderApiProjectsProjectIdAgentCoderPostResponse
            // If it's flat like { success: boolean, agentJobId?: string, ... }
            // Or if it's { success: boolean, data: { agentJobId?: string, ... } }
            // Let's assume it's flat for now or directly accessible for simplicity.
            // The original code used `data.data.agentJobId` for a differently typed `data` object.
            // Now `response` is the direct response object.
            // We need to know the exact structure of RunAgentCoderApiProjectsProjectIdAgentCoderPostResponse.
            // For example, if RunAgentCoderApiProjectsProjectIdAgentCoderPostResponse is { success: boolean, agentJobId?: string, ... }
            // or { success: boolean, details?: { agentJobId?: string } ... }
            // The example `react-query.gen.ts` shows `return data` from `await sdkFunction(...)`, so the `response` here is the content.
            // Assuming response is like: { success: boolean, agentJobId?: string, taskPlan?: TaskPlan | null, error?: { message: string } }

            if (response.success && (response as any).agentJobId) { // Cast to any if agentJobId is not directly on the type but expected
                toast.success(`Agent Coder job ${(response as any).agentJobId} finished successfully!`)
            } else if (response.success) {
                toast.success('Agent Coder finished successfully!')
            } else {
                const errorMessage = (response as any).error?.message || 'Agent Coder reported failure.' // Adjust error access
                toast.error(`Agent Coder Failed: ${errorMessage}`)
            }

            const filesQueryKey = getProjectFilesRouteProjectsProjectIdFilesGetQueryKey({ // Updated name
                path: { project_id: projectId }
            } as Options<GetProjectFilesRouteProjectsProjectIdFilesGetData>) // Updated type
            queryClient.invalidateQueries({ queryKey: filesQueryKey })

            const runsListQueryKey = listProjectAgentRunsApiProjectsProjectIdAgentCoderRunsGetOptions({ path: { project_id: projectId } }).queryKey // Updated name
            queryClient.invalidateQueries({ queryKey: runsListQueryKey })

            if (response.success && (response as any).agentJobId) {
                const agentJobId = (response as any).agentJobId
                const dataQueryKey = getAgentRunDataApiProjectsProjectIdAgentCoderRunsAgentJobIdDataGetOptions({ // Updated name
                    path: { project_id: projectId, agent_job_id: agentJobId }
                }).queryKey
                const logsQueryKey = getAgentRunLogsApiProjectsProjectIdAgentCoderRunsAgentJobIdLogsGetOptions({ // Updated name
                    path: { project_id: projectId, agent_job_id: agentJobId }
                }).queryKey
                queryClient.invalidateQueries({ queryKey: dataQueryKey })
                queryClient.invalidateQueries({ queryKey: logsQueryKey })
            }
        },
        onError: (error) => commonErrorHandler(error as unknown as Error)
    })
}

export const useListAgentCoderRuns = (projectId: string) => {
    return useQuery(listProjectAgentRunsApiProjectsProjectIdAgentCoderRunsGetOptions({ path: { project_id: projectId } })) // Updated name
}

export const useGetAgentCoderRunLogs = (
    options: { enabled?: boolean; isAgentRunning: boolean; projectId: string; agentJobId: string } = {
        enabled: false,
        isAgentRunning: false,
        projectId: '',
        agentJobId: ''
    }
) => {
    const pathParams: Options<GetAgentRunLogsApiProjectsProjectIdAgentCoderRunsAgentJobIdLogsGetData>['path'] = { // Updated type
        agent_job_id: options.agentJobId ?? '',
        project_id: options.projectId ?? ''
    }

    return useQuery({
        ...getAgentRunLogsApiProjectsProjectIdAgentCoderRunsAgentJobIdLogsGetOptions({ // Updated name
            path: pathParams
        }),
        enabled: !!options.agentJobId && (options.enabled ?? true),
        refetchOnWindowFocus: false,
        refetchOnMount: true,
        refetchInterval: options.isAgentRunning ? 250 : false
    })
}

// This seems duplicative of useListAgentCoderRuns, verify if needed. If so, update name.
export const useGetAgentCoderRuns = (projectId: string) => {
    return useQuery(listProjectAgentRunsApiProjectsProjectIdAgentCoderRunsGetOptions({ path: { project_id: projectId } })) // Updated name
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
    // Assuming AgentRunData (AgentCoderRunSuccessData) is the correct type for GetAgentRunDataApiProjectsProjectIdAgentCoderRunsAgentJobIdDataGetData
    const queryOptions = getAgentRunDataApiProjectsProjectIdAgentCoderRunsAgentJobIdDataGetOptions({ // Updated name
        path: { project_id: projectId, agent_job_id: agentJobId }
    }) as UseQueryOptions<AgentRunData, Error, AgentRunData, AgentRunDataQueryKey> // AgentRunDataQueryKey is already updated

    return useQuery<AgentRunData, Error, AgentRunData, AgentRunDataQueryKey>({
        ...queryOptions,
        refetchInterval: isAgentRunning ? 250 : false,
        enabled: !!agentJobId && enabled
    })
}

export const useConfirmAgentRunChanges = () => {
    const queryClient = useQueryClient()
    const mutationOptionsFn = confirmAgentRunChangesApiProjectsProjectIdAgentCoderRunsAgentJobIdConfirmPostMutation() // Updated name

    return useMutation<
        ConfirmAgentRunChangesApiProjectsProjectIdAgentCoderRunsAgentJobIdConfirmPostResponse, // Updated name
        ConfirmAgentRunChangesApiProjectsProjectIdAgentCoderRunsAgentJobIdConfirmPostError, // Updated name
        { agentJobId: string; projectId: string }
    >({
        mutationFn: async ({ agentJobId, projectId }) => {
            const options: Options<ConfirmAgentRunChangesApiProjectsProjectIdAgentCoderRunsAgentJobIdConfirmPostData> = { // Updated name
                path: { project_id: projectId, agent_job_id: agentJobId }
            }
            const mutationFn = mutationOptionsFn.mutationFn
            if (!mutationFn) {
                throw new Error('Generated confirmation mutation function is not available.')
            }
            const result = await mutationFn(options)
            return result as ConfirmAgentRunChangesApiProjectsProjectIdAgentCoderRunsAgentJobIdConfirmPostResponse // Updated name
        },
        onSuccess: (data, variables) => {
            if (data.success) { // Assuming Confirm...Response has a 'success' and 'message' field
                toast.success((data as any).message || `Agent run ${variables.agentJobId} changes confirmed and applied!`)

                // The query key for project files needs to be accurate
                // It might be getProjectFilesRouteProjectsProjectIdFilesGetQueryKey({ path: { projectId: variables.projectId }})
                queryClient.invalidateQueries({ queryKey: getProjectFilesRouteProjectsProjectIdFilesGetQueryKey({ path: { project_id: variables.projectId } } as Options<GetProjectFilesRouteProjectsProjectIdFilesGetData>) })

                const dataQueryKey = getAgentRunDataApiProjectsProjectIdAgentCoderRunsAgentJobIdDataGetOptions({ // Updated name
                    path: { project_id: variables.projectId, agent_job_id: variables.agentJobId }
                }).queryKey
                queryClient.invalidateQueries({ queryKey: dataQueryKey })

                const runsListQueryKey = listProjectAgentRunsApiProjectsProjectIdAgentCoderRunsGetOptions({ // Updated name
                    path: { project_id: variables.projectId }
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

export const useDeleteAgentCoderRun = () => {
    const queryClient = useQueryClient()
    const mutationOptionsFn = deleteAgentRunApiProjectsProjectIdAgentCoderRunsAgentJobIdDeleteMutation() // Updated name

    return useMutation<
        DeleteAgentRunApiProjectsProjectIdAgentCoderRunsAgentJobIdDeleteResponse, // Updated name
        DeleteAgentRunApiProjectsProjectIdAgentCoderRunsAgentJobIdDeleteError, // Updated name
        { agentJobId: string; projectId: string }
    >({
        mutationFn: async ({ agentJobId, projectId }) => {
            const options: Options<DeleteAgentRunApiProjectsProjectIdAgentCoderRunsAgentJobIdDeleteData> = { // Updated name
                path: { projectId, agentJobId }
            }
            const mutationFn = mutationOptionsFn.mutationFn
            if (!mutationFn) {
                throw new Error('Generated delete mutation function is not available.')
            }
            const result = await mutationFn(options)
            return result as DeleteAgentRunApiProjectsProjectIdAgentCoderRunsAgentJobIdDeleteResponse // Updated name
        },
        onSuccess: (data, variables) => {
            if (data.success) { // Assuming Delete...Response has 'success' and 'message'
                toast.success((data as any).message || `Agent run ${variables.agentJobId} deleted successfully!`)

                const runsListQueryKey = listProjectAgentRunsApiProjectsProjectIdAgentCoderRunsGetOptions({ // Updated name
                    path: { project_id: variables.projectId }
                }).queryKey
                queryClient.invalidateQueries({ queryKey: runsListQueryKey })

                const dataQueryKey = getAgentRunDataApiProjectsProjectIdAgentCoderRunsAgentJobIdDataGetOptions({ // Updated name
                    path: { project_id: variables.projectId, agent_job_id: variables.agentJobId }
                }).queryKey
                const logsQueryKey = getAgentRunLogsApiProjectsProjectIdAgentCoderRunsAgentJobIdLogsGetOptions({ // Updated name
                    path: { project_id: variables.projectId, agent_job_id: variables.agentJobId }
                }).queryKey
                queryClient.removeQueries({ queryKey: dataQueryKey })
                queryClient.removeQueries({ queryKey: logsQueryKey })
            } else {
                const errorMessage = (data as any)?.error?.message || 'Failed to delete agent run.'
                toast.error(`Deletion Failed: ${errorMessage}`)
                console.error('Delete Agent Run Failure Response:', data)
            }
        },
        onError: (error) => {
            const apiError = error as DeleteAgentRunApiProjectsProjectIdAgentCoderRunsAgentJobIdDeleteError // Updated type
            const message = apiError?.error?.message || 'An unknown error occurred during deletion.'
            toast.error(`Deletion Failed: ${message}`)
            commonErrorHandler(error as unknown as Error)
        }
    })
}