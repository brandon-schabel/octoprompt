import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { commonErrorHandler } from './common-mutation-error-handler'
import {
    listProjectsRouteProjectsGetOptions, // Updated name
    listProjectsRouteProjectsGetQueryKey, // Updated name
    getProjectByIdRouteProjectsProjectIdGetOptions, // Updated name
    getProjectByIdRouteProjectsProjectIdGetQueryKey, // Updated name
    getProjectFilesRouteProjectsProjectIdFilesGetOptions, // Updated name
    getProjectFilesRouteProjectsProjectIdFilesGetQueryKey, // Updated name
    createProjectRouteProjectsPostMutation, // Updated name
    getProjectSummaryRouteProjectsProjectIdSummaryGetOptions, // Updated name
    getProjectSummaryRouteProjectsProjectIdSummaryGetQueryKey, // Updated name
    updateProjectRouteProjectsProjectIdPatchMutation, // Updated name
    deleteProjectRouteProjectsProjectIdDeleteMutation, // Updated name
    syncProjectFilesRouteProjectsProjectIdSyncPostMutation, // Updated name
    removeSummariesRouteProjectsProjectIdRemoveSummariesPostMutation, // Updated name
    suggestFilesRouteProjectsProjectIdSuggestFilesPostMutation, // Updated name
    refreshProjectRouteProjectsProjectIdRefreshPostMutation, // Updated name
    summarizeProjectFilesRouteProjectsProjectIdSummarizePostMutation, // Updated name
    optimizeUserInputRoutePromptOptimizePostMutation, // Updated name
} from '../../generated-python/@tanstack/react-query.gen' // Ensure path
import type {
    CreateProjectRouteProjectsPostData, // Updated name
    CreateProjectRouteProjectsPostError, // Updated name
    CreateProjectRouteProjectsPostResponse, // Updated name
    GetProjectByIdRouteProjectsProjectIdGetData, // Updated name
    UpdateProjectRouteProjectsProjectIdPatchData, // Updated name
    UpdateProjectRouteProjectsProjectIdPatchError, // Updated name
    UpdateProjectRouteProjectsProjectIdPatchResponse, // Updated name
    DeleteProjectRouteProjectsProjectIdDeleteData, // Updated name
    DeleteProjectRouteProjectsProjectIdDeleteError, // Updated name
    DeleteProjectRouteProjectsProjectIdDeleteResponse, // Updated name
    GetProjectFilesRouteProjectsProjectIdFilesGetData, // Updated name
    SyncProjectFilesRouteProjectsProjectIdSyncPostData, // Updated name
    SyncProjectFilesRouteProjectsProjectIdSyncPostError, // Updated name
    SyncProjectFilesRouteProjectsProjectIdSyncPostResponse, // Updated name
    SummarizeProjectFilesRouteProjectsProjectIdSummarizePostData, // Updated name
    RemoveSummariesRouteProjectsProjectIdRemoveSummariesPostData, // Updated name
    RemoveSummariesRouteProjectsProjectIdRemoveSummariesPostError, // Updated name
    RemoveSummariesRouteProjectsProjectIdRemoveSummariesPostResponse, // Updated name
    SuggestFilesRouteProjectsProjectIdSuggestFilesPostData, // Updated name
    SuggestFilesRouteProjectsProjectIdSuggestFilesPostError, // Updated name
    SuggestFilesRouteProjectsProjectIdSuggestFilesPostResponse, // Updated name
    RefreshProjectRouteProjectsProjectIdRefreshPostData, // Updated name
    RefreshProjectRouteProjectsProjectIdRefreshPostError, // Updated name
    RefreshProjectRouteProjectsProjectIdRefreshPostResponse, // Updated name
    SummarizeProjectFilesRouteProjectsProjectIdSummarizePostError, // Updated name
    SummarizeProjectFilesRouteProjectsProjectIdSummarizePostResponse, // Updated name
    // SuggestFilesRequestBody, // This should match SuggestFilesRouteProjectsProjectIdSuggestFilesPostData['body']
    OptimizeUserInputRoutePromptOptimizePostData, // Updated name
    OptimizeUserInputRoutePromptOptimizePostResponse, // Updated name
    OptimizeUserInputRoutePromptOptimizePostError, // Updated name
    GetProjectSummaryRouteProjectsProjectIdSummaryGetData, // Updated name
} from '../../generated-python/types.gen' // Ensure path
// Remove direct sdk.gen import if suggestFiles is refactored
// import { Options, postApiProjectsByProjectIdSuggestFiles } from '../../generated/sdk.gen'
import { Options } from '../../generated-python/sdk.gen' // Ensure path for Options
import { SERVER_HTTP_ENDPOINT } from '@/constants/server-constants' // Keep if used

export type CreateProjectInput = CreateProjectRouteProjectsPostData['body']
export type UpdateProjectInput = UpdateProjectRouteProjectsProjectIdPatchData['body']
export type SummarizeFilesInput = SummarizeProjectFilesRouteProjectsProjectIdSummarizePostData['body']
export type RemoveSummariesInput = RemoveSummariesRouteProjectsProjectIdRemoveSummariesPostData['body']
export type SuggestFilesInput = SuggestFilesRouteProjectsProjectIdSuggestFilesPostData['body']
export type SuggestFilesRequestBody = SuggestFilesInput; // Alias for existing usage

const PROJECT_KEYS = {
    all: () => listProjectsRouteProjectsGetQueryKey(), // Updated name
    lists: () => listProjectsRouteProjectsGetQueryKey(), // Updated name
    details: () => [...listProjectsRouteProjectsGetQueryKey(), 'detail'] as const,
    detail: (projectId: string) =>
        getProjectByIdRouteProjectsProjectIdGetQueryKey({ path: { project_id: projectId } } as Options<GetProjectByIdRouteProjectsProjectIdGetData>) // Updated name
} as const

const PROJECT_FILES_KEYS = {
    all: ['project-files'] as const,
    lists: () => [...PROJECT_FILES_KEYS.all, 'list'] as const,
    list: (projectId: string) =>
        getProjectFilesRouteProjectsProjectIdFilesGetQueryKey({ path: { project_id: projectId } } as Options<GetProjectFilesRouteProjectsProjectIdFilesGetData>) // Updated name
} as const

export const useGetProjects = () => {
    const queryOptions = listProjectsRouteProjectsGetOptions({ // Updated name
        baseUrl: SERVER_HTTP_ENDPOINT // Keep if baseUrl override is intended
    })
    return useQuery(queryOptions)
}

export const useGetProject = (projectId: string) => {
    const queryOptions = getProjectByIdRouteProjectsProjectIdGetOptions({ // Updated name
        path: { project_id: projectId }
    } as Options<GetProjectByIdRouteProjectsProjectIdGetData>)
    return useQuery({
        ...queryOptions,
        enabled: !!projectId
    })
}

export const useGetProjectFiles = (projectId: string) => {
    const queryOptions = getProjectFilesRouteProjectsProjectIdFilesGetOptions({ // Updated name
        path: { project_id: projectId }
    } as Options<GetProjectFilesRouteProjectsProjectIdFilesGetData>)
    return useQuery({
        ...queryOptions,
        enabled: !!projectId,
        refetchOnWindowFocus: true,
        refetchOnMount: true
    })
}

export const useCreateProject = () => {
    const queryClient = useQueryClient()
    const mutationOptions = createProjectRouteProjectsPostMutation() // Updated name

    return useMutation<CreateProjectRouteProjectsPostResponse, CreateProjectRouteProjectsPostError, CreateProjectInput>({ // Updated types
        mutationFn: (body: CreateProjectInput) => {
            const opts: Options<CreateProjectRouteProjectsPostData> = { body } // Updated type
            return mutationOptions.mutationFn!(opts)
        },
        onSuccess: (data, variables, context) => {
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.lists() })
            // Assuming CreateProjectRouteProjectsPostResponse might have warning/error fields
            if (data && (typeof data === 'object') && ('warning' in data || 'error' in data)) {
                console.warn(`Project creation completed with issues: Warning: ${(data as any).warning}, Error: ${(data as any).error}`)
            }
        },
        onError: (error) => commonErrorHandler(error as unknown as Error)
    })
}

export const useUpdateProject = () => {
    const queryClient = useQueryClient()
    const mutationOptions = updateProjectRouteProjectsProjectIdPatchMutation() // Updated name

    return useMutation<
        UpdateProjectRouteProjectsProjectIdPatchResponse, // Updated name
        UpdateProjectRouteProjectsProjectIdPatchError, // Updated name
        { projectId: string; data: UpdateProjectInput }
    >({
        mutationFn: (vars: { projectId: string; data: UpdateProjectInput }) => {
            const opts: Options<UpdateProjectRouteProjectsProjectIdPatchData> = { path: { project_id: vars.projectId }, body: vars.data } // Updated type
            return mutationOptions.mutationFn!(opts)
        },
        onSuccess: (data, variables, context) => {
            const projectId = variables.projectId
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.detail(projectId) })
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.lists() })
        },
        onError: (error) => commonErrorHandler(error as unknown as Error)
    })
}

export const useDeleteProject = () => {
    const queryClient = useQueryClient()
    const mutationOptions = deleteProjectRouteProjectsProjectIdDeleteMutation() // Updated name

    return useMutation<DeleteProjectRouteProjectsProjectIdDeleteResponse, DeleteProjectRouteProjectsProjectIdDeleteError, string>({ // Updated types
        mutationFn: (projectId: string) => {
            const opts: Options<DeleteProjectRouteProjectsProjectIdDeleteData> = { path: { project_id: projectId } } // Updated type
            return mutationOptions.mutationFn!(opts)
        },
        onSuccess: (data, projectId, context) => { // variables is projectId
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.lists() })
            queryClient.removeQueries({ queryKey: PROJECT_KEYS.detail(projectId) })
            queryClient.removeQueries({ queryKey: PROJECT_FILES_KEYS.list(projectId) })
        },
        onError: (error) => commonErrorHandler(error as unknown as Error)
    })
}

export const useSyncProject = (projectId: string) => {
    const queryClient = useQueryClient()
    const mutationOptions = syncProjectFilesRouteProjectsProjectIdSyncPostMutation() // Updated name

    return useMutation<SyncProjectFilesRouteProjectsProjectIdSyncPostResponse, SyncProjectFilesRouteProjectsProjectIdSyncPostError, void>({ // Updated types
        mutationFn: () => {
            const opts: Options<SyncProjectFilesRouteProjectsProjectIdSyncPostData> = { path: { project_id: projectId } } // Updated type
            return mutationOptions.mutationFn!(opts)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.detail(projectId) })
            queryClient.invalidateQueries({ queryKey: PROJECT_FILES_KEYS.list(projectId) })
        },
        onError: (error) => commonErrorHandler(error as unknown as Error)
    })
}

// useFindSuggestedFiles is similar to useSuggestFiles, assuming one is preferred or an alias
export const useFindSuggestedFiles = (projectId: string) => {
    const mutationOptions = suggestFilesRouteProjectsProjectIdSuggestFilesPostMutation() // Updated name

    return useMutation<
        SuggestFilesRouteProjectsProjectIdSuggestFilesPostResponse, // Updated name
        SuggestFilesRouteProjectsProjectIdSuggestFilesPostError, // Updated name
        string // userInput string
    >({
        mutationFn: async (userInput: string) => {
            const body: SuggestFilesInput = { userInput }
            const opts: Options<SuggestFilesRouteProjectsProjectIdSuggestFilesPostData> = { path: { project_id: projectId }, body } // Updated type
            return mutationOptions.mutationFn!(opts)
        },
        onError: (error) => commonErrorHandler(error as unknown as Error)
    })
}

export const useRemoveSummariesFromFiles = (projectId: string) => {
    const queryClient = useQueryClient()
    const mutationOptions = removeSummariesRouteProjectsProjectIdRemoveSummariesPostMutation() // Updated name

    return useMutation<
        RemoveSummariesRouteProjectsProjectIdRemoveSummariesPostResponse, // Updated name
        RemoveSummariesRouteProjectsProjectIdRemoveSummariesPostError, // Updated name
        string[] // fileIds
    >({
        mutationFn: (fileIds: string[]) => {
            const body: RemoveSummariesInput = { fileIds }
            const opts: Options<RemoveSummariesRouteProjectsProjectIdRemoveSummariesPostData> = { path: { project_id: projectId }, body } // Updated type
            return mutationOptions.mutationFn!(opts)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PROJECT_FILES_KEYS.list(projectId) })
        },
        onError: (error) => commonErrorHandler(error as unknown as Error)
    })
}

export function useRefreshProject(projectId: string) {
    const queryClient = useQueryClient()
    const mutationOptions = refreshProjectRouteProjectsProjectIdRefreshPostMutation() // Updated name

    return useMutation<
        RefreshProjectRouteProjectsProjectIdRefreshPostResponse, // Updated name
        RefreshProjectRouteProjectsProjectIdRefreshPostError, // Updated name
        { folder?: string }
    >({
        mutationFn: async (vars: { folder?: string }) => {
            const opts: Options<RefreshProjectRouteProjectsProjectIdRefreshPostData> = { path: { project_id: projectId } } // Updated type
            if (vars.folder) {
                opts.query = { folder: vars.folder }
            }
            return mutationOptions.mutationFn!(opts)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PROJECT_FILES_KEYS.list(projectId) })
        },
        onError: (error) => commonErrorHandler(error as unknown as Error)
    })
}

export const useSuggestFiles = (projectId: string) => { // Refactored from direct SDK call
    const mutationHookOptions = suggestFilesRouteProjectsProjectIdSuggestFilesPostMutation() // Updated name

    return useMutation<
        SuggestFilesRouteProjectsProjectIdSuggestFilesPostResponse, // Updated name
        SuggestFilesRouteProjectsProjectIdSuggestFilesPostError, // Updated name
        SuggestFilesRequestBody // Input type for the mutation
    >({
        mutationFn: async (requestBody: SuggestFilesRequestBody) => {
            const opts: Options<SuggestFilesRouteProjectsProjectIdSuggestFilesPostData> = { // Updated type
                path: { project_id: projectId },
                body: { userInput: requestBody.userInput } // Assuming SuggestFilesRequestBody structure matches
            }
            if (!mutationHookOptions.mutationFn) {
                throw new Error("Mutation function is not available on suggestFilesRouteProjectsProjectIdSuggestFilesPostMutation");
            }
            return mutationHookOptions.mutationFn(opts);
        },
        onError: (error) => commonErrorHandler(error as unknown as Error) // Added error handler
    })
}


export const useSummarizeProjectFiles = (projectId: string) => {
    const mutationOptions = summarizeProjectFilesRouteProjectsProjectIdSummarizePostMutation() // Updated name
    const queryClient = useQueryClient()

    return useMutation<
        SummarizeProjectFilesRouteProjectsProjectIdSummarizePostResponse, // Updated name
        SummarizeProjectFilesRouteProjectsProjectIdSummarizePostError, // Updated name
        SummarizeFilesInput
    >({
        mutationFn: (body: SummarizeFilesInput) => {
            const opts: Options<SummarizeProjectFilesRouteProjectsProjectIdSummarizePostData> = { path: { project_id: projectId }, body } // Updated type
            return mutationOptions.mutationFn!(opts)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: PROJECT_FILES_KEYS.list(projectId) })
            queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.detail(projectId) })
            // queryClient.invalidateQueries({ queryKey: getProjectSummaryRouteProjectsProjectIdSummaryGetQueryKey({ path: { projectId } } as Options<GetProjectSummaryRouteProjectsProjectIdSummaryGetData>) }); // If summary changes
        },
        onError: (error) => commonErrorHandler(error as unknown as Error)
    })
}

export const useOptimzeUserInput = () => { // Corrected spelling: useOptimizeUserInput
    const mutationOptions = optimizeUserInputRoutePromptOptimizePostMutation() // Updated name
    return useMutation<OptimizeUserInputRoutePromptOptimizePostResponse, OptimizeUserInputRoutePromptOptimizePostError, { userContext: string; projectId: string }>({ // Updated types
        mutationFn: (vars: { userContext: string; projectId: string }) => {
            const opts: Options<OptimizeUserInputRoutePromptOptimizePostData> = { body: { userContext: vars.userContext, projectId: vars.projectId } } // Updated type
            return mutationOptions.mutationFn!(opts)
        },
        onError: (error) => commonErrorHandler(error as unknown as Error)
    })
}

export const useGetProjectSummary = (projectId: string) => {
    const queryOptions = getProjectSummaryRouteProjectsProjectIdSummaryGetOptions({ // Updated name
        path: { project_id: projectId }
    } as Options<GetProjectSummaryRouteProjectsProjectIdSummaryGetData>)
    return useQuery({
        ...queryOptions,
        enabled: !!projectId
    })
}