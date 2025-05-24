import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { commonErrorHandler } from './common-mutation-error-handler'
import {
    listAllPromptsEndpointApiPromptsGetOptions, // Updated name
    listAllPromptsEndpointApiPromptsGetQueryKey, // Updated name
    getPromptByIdEndpointApiPromptsPromptIdGetOptions, // Updated name
    getPromptByIdEndpointApiPromptsPromptIdGetQueryKey, // Updated name
    listProjectPromptsEndpointApiProjectsProjectIdPromptsGetOptions, // Updated name
    listProjectPromptsEndpointApiProjectsProjectIdPromptsGetQueryKey, // Updated name
    createPromptEndpointApiPromptsPostMutation, // Updated name
    updatePromptEndpointApiPromptsPromptIdPatchMutation, // Updated name
    deletePromptEndpointApiPromptsPromptIdDeleteMutation, // Updated name
    addPromptToProjectEndpointApiProjectsProjectIdPromptsPromptIdPostMutation, // Updated name
    removePromptFromProjectEndpointApiProjectsProjectIdPromptsPromptIdDeleteMutation // Updated name
    // postApiPromptOptimizeMutation, // This was unused
} from '../../generated-python/@tanstack/react-query.gen' // Ensure path
import type {
    ListAllPromptsEndpointApiPromptsGetData, // Updated name
    GetPromptByIdEndpointApiPromptsPromptIdGetData, // Updated name
    ListProjectPromptsEndpointApiProjectsProjectIdPromptsGetData, // Updated name
    CreatePromptEndpointApiPromptsPostData, // Updated name
    CreatePromptEndpointApiPromptsPostError, // Updated name
    CreatePromptEndpointApiPromptsPostResponse, // Updated name
    UpdatePromptEndpointApiPromptsPromptIdPatchData, // Updated name
    UpdatePromptEndpointApiPromptsPromptIdPatchError, // Updated name
    UpdatePromptEndpointApiPromptsPromptIdPatchResponse, // Updated name
    DeletePromptEndpointApiPromptsPromptIdDeleteData, // Updated name
    DeletePromptEndpointApiPromptsPromptIdDeleteError, // Updated name
    DeletePromptEndpointApiPromptsPromptIdDeleteResponse, // Updated name
    AddPromptToProjectEndpointApiProjectsProjectIdPromptsPromptIdPostData, // Updated name
    AddPromptToProjectEndpointApiProjectsProjectIdPromptsPromptIdPostError, // Updated name
    AddPromptToProjectEndpointApiProjectsProjectIdPromptsPromptIdPostResponse, // Updated name
    RemovePromptFromProjectEndpointApiProjectsProjectIdPromptsPromptIdDeleteData, // Updated name
    RemovePromptFromProjectEndpointApiProjectsProjectIdPromptsPromptIdDeleteError, // Updated name
    RemovePromptFromProjectEndpointApiProjectsProjectIdPromptsPromptIdDeleteResponse, // Updated name
} from '../../generated-python/types.gen' // Ensure path
import { Options } from '../../generated-python/sdk.gen' // Ensure path

export type CreatePromptInput = CreatePromptEndpointApiPromptsPostData['body']
export type UpdatePromptInput = UpdatePromptEndpointApiPromptsPromptIdPatchData['body']

export function useGetAllPrompts(options?: Partial<ListAllPromptsEndpointApiPromptsGetData['query']>) { // Updated type
    const queryOptions = listAllPromptsEndpointApiPromptsGetOptions(options ? ({ query: options } as Options<ListAllPromptsEndpointApiPromptsGetData>) : undefined) // Updated name
    return useQuery(queryOptions)
}

export function useGetPrompt(id: string) {
    const queryOptions = getPromptByIdEndpointApiPromptsPromptIdGetOptions({ // Updated name
        path: { promptId: id }
    } as Options<GetPromptByIdEndpointApiPromptsPromptIdGetData>) // Updated type
    return useQuery({
        ...queryOptions,
        enabled: !!id
    })
}

export function useGetProjectPrompts(projectId: number) {
    const queryOptions = listProjectPromptsEndpointApiProjectsProjectIdPromptsGetOptions({ // Updated name
        path: { projectId }
    } as Options<ListProjectPromptsEndpointApiProjectsProjectIdPromptsGetData>) // Updated type
    return useQuery({
        ...queryOptions,
        enabled: !!projectId
    })
}

export function useCreatePrompt(projectId?: number) {
    const queryClient = useQueryClient()
    const mutationOptions = createPromptEndpointApiPromptsPostMutation() // Updated name

    return useMutation<CreatePromptEndpointApiPromptsPostResponse, CreatePromptEndpointApiPromptsPostError, Options<CreatePromptEndpointApiPromptsPostData>>({ // Updated types
        mutationFn: mutationOptions.mutationFn!, // Options<CreatePromptEndpointApiPromptsPostData> includes body
        onSuccess: (data, variables, context) => {
            queryClient.invalidateQueries({ queryKey: listAllPromptsEndpointApiPromptsGetQueryKey() }) // Updated name
            if (projectId) { // projectId is available from the closure
                queryClient.invalidateQueries({ queryKey: listProjectPromptsEndpointApiProjectsProjectIdPromptsGetQueryKey({ path: { projectId } } as Options<ListProjectPromptsEndpointApiProjectsProjectIdPromptsGetData>) }) // Updated name
            }
        },
        onError: (error) => commonErrorHandler(error as unknown as Error)
    })
}

export function useUpdatePrompt(projectId?: number) { // projectId from closure for invalidation
    const queryClient = useQueryClient()
    const mutationOptions = updatePromptEndpointApiPromptsPromptIdPatchMutation() // Updated name

    return useMutation<
        UpdatePromptEndpointApiPromptsPromptIdPatchResponse, // Updated name
        UpdatePromptEndpointApiPromptsPromptIdPatchError, // Updated name
        { promptId: number; data: UpdatePromptInput }
    >({
        mutationFn: (vars: { promptId: number; data: UpdatePromptInput }) => {
            const opts: Options<UpdatePromptEndpointApiPromptsPromptIdPatchData> = { path: { promptId: vars.promptId }, body: vars.data } // Updated type
            return mutationOptions.mutationFn!(opts)
        },
        onSuccess: (data, variables, context) => {
            const { promptId } = variables
            if (projectId) {
                queryClient.invalidateQueries({ queryKey: listProjectPromptsEndpointApiProjectsProjectIdPromptsGetQueryKey({ path: { projectId } } as Options<ListProjectPromptsEndpointApiProjectsProjectIdPromptsGetData>) }) // Updated name
            }
            queryClient.invalidateQueries({ queryKey: getPromptByIdEndpointApiPromptsPromptIdGetQueryKey({ path: { promptId } } as Options<GetPromptByIdEndpointApiPromptsPromptIdGetData>) }) // Updated name
            queryClient.invalidateQueries({ queryKey: listAllPromptsEndpointApiPromptsGetQueryKey() }) // Updated name
        },
        onError: (error) => commonErrorHandler(error as unknown as Error)
    })
}

export function useDeletePrompt(projectId?: number) { // projectId from closure for invalidation
    const queryClient = useQueryClient()
    const mutationOptions = deletePromptEndpointApiPromptsPromptIdDeleteMutation() // Updated name

    return useMutation<DeletePromptEndpointApiPromptsPromptIdDeleteResponse, DeletePromptEndpointApiPromptsPromptIdDeleteError, { promptId: number }>({ // Updated types
        mutationFn: (vars) => {
            const opts: Options<DeletePromptEndpointApiPromptsPromptIdDeleteData> = { path: { promptId: vars.promptId } } // Updated type
            return mutationOptions.mutationFn!(opts)
        },
        onSuccess: (data, variables, context) => {
            const { promptId } = variables
            if (projectId) {
                queryClient.invalidateQueries({ queryKey: listProjectPromptsEndpointApiProjectsProjectIdPromptsGetQueryKey({ path: { projectId } } as Options<ListProjectPromptsEndpointApiProjectsProjectIdPromptsGetData>) }) // Updated name
            }
            queryClient.invalidateQueries({ queryKey: getPromptByIdEndpointApiPromptsPromptIdGetQueryKey({ path: { promptId } } as Options<GetPromptByIdEndpointApiPromptsPromptIdGetData>) }) // Updated name
            queryClient.invalidateQueries({ queryKey: listAllPromptsEndpointApiPromptsGetQueryKey() }) // Updated name
        },
        onError: (error) => commonErrorHandler(error as unknown as Error)
    })
}

export function useAddPromptToProject() {
    const queryClient = useQueryClient()
    const mutationOptions = addPromptToProjectEndpointApiProjectsProjectIdPromptsPromptIdPostMutation() // Updated name

    return useMutation<
        AddPromptToProjectEndpointApiProjectsProjectIdPromptsPromptIdPostResponse, // Updated name
        AddPromptToProjectEndpointApiProjectsProjectIdPromptsPromptIdPostError, // Updated name
        { promptId: number; projectId: number }
    >({
        mutationFn: (vars: { promptId: number; projectId: number }) => {
            const opts: Options<AddPromptToProjectEndpointApiProjectsProjectIdPromptsPromptIdPostData> = { // Updated type
                path: { promptId: vars.promptId, projectId: vars.projectId }
            }
            return mutationOptions.mutationFn!(opts)
        },
        onSuccess: (data, variables, context) => {
            const { projectId } = variables
            queryClient.invalidateQueries({ queryKey: listProjectPromptsEndpointApiProjectsProjectIdPromptsGetQueryKey({ path: { projectId } } as Options<ListProjectPromptsEndpointApiProjectsProjectIdPromptsGetData>) }) // Updated name
        },
        onError: (error) => commonErrorHandler(error as unknown as Error)
    })
}

export function useRemovePromptFromProject() {
    const queryClient = useQueryClient()
    const mutationOptions = removePromptFromProjectEndpointApiProjectsProjectIdPromptsPromptIdDeleteMutation() // Updated name

    return useMutation<
        RemovePromptFromProjectEndpointApiProjectsProjectIdPromptsPromptIdDeleteResponse, // Updated name
        RemovePromptFromProjectEndpointApiProjectsProjectIdPromptsPromptIdDeleteError, // Updated name
        { promptId: number; projectId: number }
    >({
        mutationFn: (vars: { promptId: number; projectId: number }) => {
            const opts: Options<RemovePromptFromProjectEndpointApiProjectsProjectIdPromptsPromptIdDeleteData> = { // Updated type
                path: { promptId: vars.promptId, projectId: vars.projectId }
            }
            return mutationOptions.mutationFn!(opts)
        },
        onSuccess: (data, variables, context) => {
            const { projectId } = variables
            queryClient.invalidateQueries({ queryKey: listProjectPromptsEndpointApiProjectsProjectIdPromptsGetQueryKey({ path: { projectId } } as Options<ListProjectPromptsEndpointApiProjectsProjectIdPromptsGetData>) }) // Updated name
        },
        onError: (error) => commonErrorHandler(error as unknown as Error)
    })
}