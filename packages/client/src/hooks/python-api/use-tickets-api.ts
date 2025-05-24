import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { commonErrorHandler } from './common-mutation-error-handler'
import {
    createTicketRouteTicketsPostMutation, // Updated name
    updateTicketRouteTicketsTicketIdPatchMutation, // Updated name
    deleteTicketRouteTicketsTicketIdDeleteMutation, // Updated name
    getTicketRouteTicketsTicketIdGetQueryKey, // Updated name
    listTicketsByProjectRouteProjectsProjectIdTicketsGetOptions, // Updated name
    listTicketsByProjectRouteProjectsProjectIdTicketsGetQueryKey, // Updated name
    listTicketsWithCountRouteProjectsProjectIdTicketsWithCountGetOptions, // Updated name
    listTicketsWithCountRouteProjectsProjectIdTicketsWithCountGetQueryKey, // Updated name
    getTasksRouteTicketsTicketIdTasksGetOptions, // Updated name
    getTasksRouteTicketsTicketIdTasksGetQueryKey, // Updated name
    createTaskRouteTicketsTicketIdTasksPostMutation, // Updated name
    deleteTaskRouteTicketsTicketIdTasksTaskIdDeleteMutation, // Updated name
    updateTaskRouteTicketsTicketIdTasksTaskIdPatchMutation, // Updated name
    reorderTasksRouteTicketsTicketIdTasksReorderPatchMutation, // Updated name
    autoGenerateTasksRouteTicketsTicketIdAutoGenerateTasksPostMutation, // Updated name
    getTasksForTicketsRouteTicketsBulkTasksGetOptions, // Updated name
    getTasksForTicketsRouteTicketsBulkTasksGetQueryKey, // Updated name
    listTicketsWithTasksRouteProjectsProjectIdTicketsWithTasksGetOptions, // Updated name
    listTicketsWithTasksRouteProjectsProjectIdTicketsWithTasksGetQueryKey, // Updated name
    linkFilesRouteTicketsTicketIdLinkFilesPostMutation, // Updated name
    suggestFilesRouteTicketsTicketIdSuggestFilesPostMutation, // Updated name
    suggestTasksRouteTicketsTicketIdSuggestTasksPostMutation // Updated name
} from '../../generated-python/@tanstack/react-query.gen' // Ensure path
import type {
    // CreateTicketBody, // Should match CreateTicketRouteTicketsPostData['body']
    // UpdateTicketBody, // Should match UpdateTicketRouteTicketsTicketIdPatchData['body']
    CreateTicketRouteTicketsPostData, // Updated name
    CreateTicketRouteTicketsPostError, // Updated name
    CreateTicketRouteTicketsPostResponse, // Added for clarity
    UpdateTicketRouteTicketsTicketIdPatchData, // Updated name
    UpdateTicketRouteTicketsTicketIdPatchError, // Updated name
    UpdateTicketRouteTicketsTicketIdPatchResponse, // Added for clarity
    DeleteTicketRouteTicketsTicketIdDeleteData, // Updated name
    DeleteTicketRouteTicketsTicketIdDeleteError, // Updated name
    DeleteTicketRouteTicketsTicketIdDeleteResponse, // Added for clarity
    GetTicketRouteTicketsTicketIdGetData, // Updated name
    ListTicketsByProjectRouteProjectsProjectIdTicketsGetData, // Updated name
    ListTicketsWithCountRouteProjectsProjectIdTicketsWithCountGetData, // Updated name
    GetTasksRouteTicketsTicketIdTasksGetData, // Updated name
    CreateTaskRouteTicketsTicketIdTasksPostData, // Updated name
    CreateTaskRouteTicketsTicketIdTasksPostError, // Updated name
    CreateTaskRouteTicketsTicketIdTasksPostResponse, // Added for clarity
    DeleteTaskRouteTicketsTicketIdTasksTaskIdDeleteData, // Updated name
    DeleteTaskRouteTicketsTicketIdTasksTaskIdDeleteError, // Updated name
    DeleteTaskRouteTicketsTicketIdTasksTaskIdDeleteResponse, // Added for clarity
    UpdateTaskRouteTicketsTicketIdTasksTaskIdPatchData, // Updated name
    UpdateTaskRouteTicketsTicketIdTasksTaskIdPatchError, // Updated name
    UpdateTaskRouteTicketsTicketIdTasksTaskIdPatchResponse, // Added for clarity
    ReorderTasksRouteTicketsTicketIdTasksReorderPatchData, // Updated name
    ReorderTasksRouteTicketsTicketIdTasksReorderPatchError, // Updated name
    ReorderTasksRouteTicketsTicketIdTasksReorderPatchResponse, // Added for clarity
    AutoGenerateTasksRouteTicketsTicketIdAutoGenerateTasksPostData, // Updated name
    AutoGenerateTasksRouteTicketsTicketIdAutoGenerateTasksPostError, // Updated name
    AutoGenerateTasksRouteTicketsTicketIdAutoGenerateTasksPostResponse, // Added for clarity
    GetTasksForTicketsRouteTicketsBulkTasksGetData, // Updated name
    ListTicketsWithTasksRouteProjectsProjectIdTicketsWithTasksGetData, // Updated name
    LinkFilesRouteTicketsTicketIdLinkFilesPostData, // Updated name
    LinkFilesRouteTicketsTicketIdLinkFilesPostError, // Updated name
    LinkFilesRouteTicketsTicketIdLinkFilesPostResponse, // Added for clarity
    SuggestFilesRouteTicketsTicketIdSuggestFilesPostData, // Updated name
    SuggestFilesRouteTicketsTicketIdSuggestFilesPostError, // Updated name
    SuggestFilesRouteTicketsTicketIdSuggestFilesPostResponse, // Updated name
    // SuggestedFilesResponse, // Should match SuggestFilesRouteTicketsTicketIdSuggestFilesPostResponse
    SuggestTasksRouteTicketsTicketIdSuggestTasksPostData, // Updated name
    SuggestTasksRouteTicketsTicketIdSuggestTasksPostError, // Updated name
    SuggestTasksRouteTicketsTicketIdSuggestTasksPostResponse, // Added for clarity
} from '../../generated-python/types.gen' // Ensure path
import { Options } from '../../generated-python/sdk.gen' // Ensure path

export type CreateTicketBody = CreateTicketRouteTicketsPostData['body'];
export type UpdateTicketBody = UpdateTicketRouteTicketsTicketIdPatchData['body'];
export type SuggestedFilesResponse = SuggestFilesRouteTicketsTicketIdSuggestFilesPostResponse;


const TICKET_KEYS = {
    all: ['tickets'] as const, // This can be a generic prefix
    listByProject: (projectId: number) =>
        listTicketsByProjectRouteProjectsProjectIdTicketsGetQueryKey({ path: { projectId } } as Options<ListTicketsByProjectRouteProjectsProjectIdTicketsGetData>), // Updated names
    listWithCount: (projectId: number, status?: string) =>
        listTicketsWithCountRouteProjectsProjectIdTicketsWithCountGetQueryKey({ // Updated name
            path: { projectId },
            query: status && status !== 'all' ? { status } : undefined
        } as Options<ListTicketsWithCountRouteProjectsProjectIdTicketsWithCountGetData>),
    detail: (ticketId: string) =>
        getTicketRouteTicketsTicketIdGetQueryKey({ path: { ticketId } } as Options<GetTicketRouteTicketsTicketIdGetData>), // Updated name
    tasks: (ticketId: string) =>
        getTasksRouteTicketsTicketIdTasksGetQueryKey({ path: { ticketId } } as Options<GetTasksRouteTicketsTicketIdTasksGetData>), // Updated name
    bulkTasks: (ticketIds: string[]) =>
        getTasksForTicketsRouteTicketsBulkTasksGetQueryKey({ query: { ticket_ids: ticketIds } } as Options<GetTasksForTicketsRouteTicketsBulkTasksGetData>), // query param might be ticket_ids
    listWithTasks: (projectId: number, status?: string) =>
        listTicketsWithTasksRouteProjectsProjectIdTicketsWithTasksGetQueryKey({ // Updated name
            path: { projectId },
            query: status && status !== 'all' ? { status } : undefined
        } as Options<ListTicketsWithTasksRouteProjectsProjectIdTicketsWithTasksGetData>)
}

export function useListTickets(projectId: number, status?: string) {
    const queryOptions = listTicketsByProjectRouteProjectsProjectIdTicketsGetOptions({ // Updated name
        path: { projectId },
        query: status ? { status } : undefined
    } as Options<ListTicketsByProjectRouteProjectsProjectIdTicketsGetData>)

    return useQuery({
        ...queryOptions,
        enabled: !!projectId
    })
}

export function useListTicketsWithCount(projectId: number, status?: string) {
    const queryOptions = listTicketsWithCountRouteProjectsProjectIdTicketsWithCountGetOptions({ // Updated name
        path: { projectId },
        query: status && status !== 'all' ? { status } : undefined
    } as Options<ListTicketsWithCountRouteProjectsProjectIdTicketsWithCountGetData>)

    return useQuery({
        ...queryOptions,
        enabled: !!projectId
    })
}

export function useCreateTicket(projectId: number) {
    const queryClient = useQueryClient()
    const mutationOptions = createTicketRouteTicketsPostMutation() // Updated name

    return useMutation<CreateTicketRouteTicketsPostResponse, CreateTicketRouteTicketsPostError, CreateTicketBody>({ // Updated types
        mutationFn: (body: CreateTicketBody) => {
            const opts: Options<CreateTicketRouteTicketsPostData> = { body } // Updated type
            return mutationOptions.mutationFn!(opts)
        },
        onSuccess: (data: any) => { // data is CreateTicketRouteTicketsPostResponse
            queryClient.invalidateQueries({ queryKey: TICKET_KEYS.listByProject(projectId) })
            queryClient.invalidateQueries({ queryKey: TICKET_KEYS.listWithCount(projectId) })
            queryClient.invalidateQueries({ queryKey: TICKET_KEYS.listWithTasks(projectId) })
        },
        onError: (error) => commonErrorHandler(error as unknown as Error)
    })
}

export function useUpdateTicket(projectId: number) {
    const queryClient = useQueryClient()
    const mutationOptions = updateTicketRouteTicketsTicketIdPatchMutation() // Updated name

    return useMutation<UpdateTicketRouteTicketsTicketIdPatchResponse, UpdateTicketRouteTicketsTicketIdPatchError, { ticketId: string; updates: UpdateTicketBody }>({ // Updated types
        mutationFn: ({ ticketId, updates }) => {
            const opts: Options<UpdateTicketRouteTicketsTicketIdPatchData> = { // Updated type
                path: { ticketId },
                body: updates
            }
            return mutationOptions.mutationFn!(opts)
        },
        onSuccess: (data: any, { ticketId }) => { // data is UpdateTicketRouteTicketsTicketIdPatchResponse
            queryClient.invalidateQueries({ queryKey: TICKET_KEYS.detail(ticketId) })
            queryClient.invalidateQueries({ queryKey: TICKET_KEYS.listByProject(projectId) })
            queryClient.invalidateQueries({ queryKey: TICKET_KEYS.listWithCount(projectId) })
            queryClient.invalidateQueries({ queryKey: TICKET_KEYS.listWithTasks(projectId) })
        },
        onError: (error) => commonErrorHandler(error as unknown as Error)
    })
}

export function useDeleteTicket(projectId: number) {
    const queryClient = useQueryClient()
    const mutationOptions = deleteTicketRouteTicketsTicketIdDeleteMutation() // Updated name

    return useMutation<DeleteTicketRouteTicketsTicketIdDeleteResponse, DeleteTicketRouteTicketsTicketIdDeleteError, string>({ // Updated types
        mutationFn: (ticketId: string) => {
            const opts: Options<DeleteTicketRouteTicketsTicketIdDeleteData> = { path: { ticketId } } // Updated type
            return mutationOptions.mutationFn!(opts)
        },
        onSuccess: (data, ticketId) => { // data is DeleteTicketRouteTicketsTicketIdDeleteResponse
            queryClient.removeQueries({ queryKey: TICKET_KEYS.detail(ticketId) })
            queryClient.removeQueries({ queryKey: TICKET_KEYS.tasks(ticketId) })
            queryClient.invalidateQueries({ queryKey: TICKET_KEYS.listByProject(projectId) })
            queryClient.invalidateQueries({ queryKey: TICKET_KEYS.listWithCount(projectId) })
            queryClient.invalidateQueries({ queryKey: TICKET_KEYS.listWithTasks(projectId) })
        },
        onError: (error) => commonErrorHandler(error as unknown as Error)
    })
}

export function useLinkFilesToTicket() {
    const queryClient = useQueryClient()
    const mutationOptions = linkFilesRouteTicketsTicketIdLinkFilesPostMutation() // Updated name

    return useMutation<LinkFilesRouteTicketsTicketIdLinkFilesPostResponse, LinkFilesRouteTicketsTicketIdLinkFilesPostError, { ticketId: string; fileIds: string[] }>({ // Updated types
        mutationFn: ({ ticketId, fileIds }) => {
            const opts: Options<LinkFilesRouteTicketsTicketIdLinkFilesPostData> = { // Updated type
                path: { ticketId },
                body: { fileIds: fileIds } // Assuming body field is file_ids
            }
            return mutationOptions.mutationFn!(opts)
        },
        onSuccess: (data, { ticketId }) => {
            queryClient.invalidateQueries({ queryKey: TICKET_KEYS.detail(ticketId) })
            // Potentially invalidate other queries that show linked files
        },
        onError: (error) => commonErrorHandler(error as unknown as Error)
    })
}

export function useSuggestTasksForTicket() {
    const mutationOptions = suggestTasksRouteTicketsTicketIdSuggestTasksPostMutation() // Updated name

    return useMutation<SuggestTasksRouteTicketsTicketIdSuggestTasksPostResponse, SuggestTasksRouteTicketsTicketIdSuggestTasksPostError, { ticketId: string; userContext?: string }>({ // Updated types
        mutationFn: ({ ticketId, userContext }) => {
            const opts: Options<SuggestTasksRouteTicketsTicketIdSuggestTasksPostData> = { // Updated type
                path: { ticketId },
                body: userContext ? { user_context: userContext } : undefined // Assuming body field is user_context
            }
            return mutationOptions.mutationFn!(opts)
        },
        onError: (error) => commonErrorHandler(error as unknown as Error)
    })
}

export function useListTasks(ticketId: string) {
    const queryOptions = getTasksRouteTicketsTicketIdTasksGetOptions({ // Updated name
        path: { ticketId }
    } as Options<GetTasksRouteTicketsTicketIdTasksGetData>)

    return useQuery({
        ...queryOptions,
        enabled: !!ticketId
    })
}

export function useCreateTask() {
    const queryClient = useQueryClient()
    const mutationOptions = createTaskRouteTicketsTicketIdTasksPostMutation() // Updated name

    return useMutation<CreateTaskRouteTicketsTicketIdTasksPostResponse, CreateTaskRouteTicketsTicketIdTasksPostError, { ticketId: string; content: string }>({ // Updated types
        mutationFn: ({ ticketId, content }) => {
            const opts: Options<CreateTaskRouteTicketsTicketIdTasksPostData> = { // Updated type
                path: { ticketId },
                body: { content }
            }
            return mutationOptions.mutationFn!(opts)
        },
        onSuccess: (data, { ticketId }) => {
            queryClient.invalidateQueries({ queryKey: TICKET_KEYS.tasks(ticketId) })
        },
        onError: (error) => commonErrorHandler(error as unknown as Error)
    })
}

export function useUpdateTask() {
    const queryClient = useQueryClient()
    const mutationOptions = updateTaskRouteTicketsTicketIdTasksTaskIdPatchMutation() // Updated name

    return useMutation<
        UpdateTaskRouteTicketsTicketIdTasksTaskIdPatchResponse, // Updated type
        UpdateTaskRouteTicketsTicketIdTasksTaskIdPatchError, // Updated type
        { ticketId: string; taskId: string; updates: UpdateTaskRouteTicketsTicketIdTasksTaskIdPatchData['body'] } // Use generated body type
    >({
        mutationFn: ({ ticketId, taskId, updates }) => {
            const opts: Options<UpdateTaskRouteTicketsTicketIdTasksTaskIdPatchData> = { // Updated type
                path: { ticketId, taskId },
                body: updates
            }
            return mutationOptions.mutationFn!(opts)
        },
        onSuccess: (data, { ticketId }) => {
            queryClient.invalidateQueries({ queryKey: TICKET_KEYS.tasks(ticketId) })
        },
        onError: (error) => commonErrorHandler(error as unknown as Error)
    })
}

export function useDeleteTask() {
    const queryClient = useQueryClient()
    const mutationOptions = deleteTaskRouteTicketsTicketIdTasksTaskIdDeleteMutation() // Updated name

    return useMutation<DeleteTaskRouteTicketsTicketIdTasksTaskIdDeleteResponse, DeleteTaskRouteTicketsTicketIdTasksTaskIdDeleteError, { ticketId: string; taskId: string }>({ // Updated types
        mutationFn: ({ ticketId, taskId }) => {
            const opts: Options<DeleteTaskRouteTicketsTicketIdTasksTaskIdDeleteData> = { // Updated type
                path: { ticketId, taskId }
            }
            return mutationOptions.mutationFn!(opts)
        },
        onSuccess: (data, { ticketId }) => {
            queryClient.invalidateQueries({ queryKey: TICKET_KEYS.tasks(ticketId) })
        },
        onError: (error) => commonErrorHandler(error as unknown as Error)
    })
}

export function useReorderTasks() {
    const queryClient = useQueryClient()
    const mutationOptions = reorderTasksRouteTicketsTicketIdTasksReorderPatchMutation() // Updated name

    return useMutation<
        ReorderTasksRouteTicketsTicketIdTasksReorderPatchResponse, // Updated type
        ReorderTasksRouteTicketsTicketIdTasksReorderPatchError, // Updated type
        // Body type for tasks should align with ReorderTasksRouteTicketsTicketIdTasksReorderPatchData['body']
        { ticketId: string; tasks: ReorderTasksRouteTicketsTicketIdTasksReorderPatchData['body']['tasks'] }
    >({
        mutationFn: ({ ticketId, tasks }) => {
            const opts: Options<ReorderTasksRouteTicketsTicketIdTasksReorderPatchData> = { // Updated type
                path: { ticketId },
                body: { tasks }
            }
            return mutationOptions.mutationFn!(opts)
        },
        onSuccess: (data, { ticketId }) => {
            queryClient.invalidateQueries({ queryKey: TICKET_KEYS.tasks(ticketId) })
        },
        onError: (error) => commonErrorHandler(error as unknown as Error)
    })
}

export function useAutoGenerateTasks() {
    const queryClient = useQueryClient()
    const mutationOptions = autoGenerateTasksRouteTicketsTicketIdAutoGenerateTasksPostMutation() // Updated name

    return useMutation<AutoGenerateTasksRouteTicketsTicketIdAutoGenerateTasksPostResponse, AutoGenerateTasksRouteTicketsTicketIdAutoGenerateTasksPostError, { ticketId: string }>({ // Updated types
        mutationFn: ({ ticketId }) => {
            const opts: Options<AutoGenerateTasksRouteTicketsTicketIdAutoGenerateTasksPostData> = { // Updated type
                path: { ticketId }
            }
            return mutationOptions.mutationFn!(opts)
        },
        onSuccess: (data, { ticketId }) => {
            queryClient.invalidateQueries({ queryKey: TICKET_KEYS.tasks(ticketId) })
        },
        onError: (error) => commonErrorHandler(error as unknown as Error)
    })
}

export function useBulkTicketTasks(ticketIds: string[]) {
    const queryClient = useQueryClient()
    const queryOptions = getTasksForTicketsRouteTicketsBulkTasksGetOptions({ // Updated name
        // Assuming query param name is 'ticket_ids' and it's a comma-separated string
        query: { ticket_ids: ticketIds } as Options<GetTasksForTicketsRouteTicketsBulkTasksGetData>['query']
    } as Options<GetTasksForTicketsRouteTicketsBulkTasksGetData>)

    return useQuery({
        ...queryOptions,
        enabled: ticketIds.length > 0,
        select: (data: GetTasksForTicketsRouteTicketsBulkTasksGetData) => { // Updated type
            if (data.tasks) { // Assuming data.tasks is Record<string, Task[]>
                Object.entries(data.tasks).forEach(([ticketId, tasks]) => {
                    // Ensure the structure set by setQueryData matches what useListTasks expects
                    queryClient.setQueryData(TICKET_KEYS.tasks(ticketId), { success: true, data: tasks }) // Or just `tasks` if that's the expected structure
                })
            }
            return data
        }
    })
}

export function useListTicketsWithTasks(projectId: number, status?: string) {
    const queryOptions = listTicketsWithTasksRouteProjectsProjectIdTicketsWithTasksGetOptions({ // Updated name
        path: { projectId },
        query: status && status !== 'all' ? { status } : undefined
    } as Options<ListTicketsWithTasksRouteProjectsProjectIdTicketsWithTasksGetData>)

    return useQuery({
        ...queryOptions,
        enabled: !!projectId
    })
}

export function useSuggestFilesForTicket(ticketId: string) {
    const mutationOptions = suggestFilesRouteTicketsTicketIdSuggestFilesPostMutation() // Updated name

    return useMutation<SuggestFilesRouteTicketsTicketIdSuggestFilesPostResponse, SuggestFilesRouteTicketsTicketIdSuggestFilesPostError, { extraUserInput?: string }>({ // Updated types
        mutationFn: ({ extraUserInput }) => {
            const opts: Options<SuggestFilesRouteTicketsTicketIdSuggestFilesPostData> = { // Updated type
                path: { ticketId },
                body: extraUserInput ? { extra_user_input: extraUserInput } : undefined // Assuming body field is extra_user_input
            }
            return mutationOptions.mutationFn!(opts) as Promise<SuggestedFilesResponse> // Cast if necessary, ensure SuggestedFilesResponse matches generated
        },
        onError: (error) => commonErrorHandler(error as unknown as Error)
    })
}