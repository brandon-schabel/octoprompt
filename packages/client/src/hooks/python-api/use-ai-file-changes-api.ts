import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { commonErrorHandler } from './common-mutation-error-handler'
import {
    getAiFileChangeDetailsApiProjectsProjectIdAiFileChangesAiFileChangeIdGetOptions, // Updated name
    getAiFileChangeDetailsApiProjectsProjectIdAiFileChangesAiFileChangeIdGetQueryKey, // Updated name
    generateAiFileChangeApiProjectsProjectIdAiFileChangesPostMutation, // Updated name
    confirmAiFileChangeApiProjectsProjectIdAiFileChangesAiFileChangeIdConfirmPostMutation // Updated name
    // rejectAiFileChange mutation might be needed if there's a reject functionality
} from '../../generated-python/@tanstack/react-query.gen' // Ensure path
import type {
    GetAiFileChangeDetailsApiProjectsProjectIdAiFileChangesAiFileChangeIdGetData, // Updated name
    // GetAiFileChangeDetailsApiProjectsProjectIdAiFileChangesAiFileChangeIdResponse, // This is likely GetAiFileChangeDetailsApiProjectsProjectIdAiFileChangesAiFileChangeIdGetData
    GenerateAiFileChangeApiProjectsProjectIdAiFileChangesPostData, // Updated name
    GenerateAiFileChangeApiProjectsProjectIdAiFileChangesPostError, // Updated name
    GenerateAiFileChangeApiProjectsProjectIdAiFileChangesPostResponse, // Updated name
    ConfirmAiFileChangeApiProjectsProjectIdAiFileChangesAiFileChangeIdConfirmPostData, // Updated name
    ConfirmAiFileChangeApiProjectsProjectIdAiFileChangesAiFileChangeIdConfirmPostError, // Updated name
    ConfirmAiFileChangeApiProjectsProjectIdAiFileChangesAiFileChangeIdConfirmPostResponse // Updated name
} from '../../generated-python/types.gen' // Ensure path
import { Options } from '../../generated-python/sdk.gen' // Ensure path

export type GenerateChangeInput = { // This should align with GenerateAiFileChangeApiProjectsProjectIdAiFileChangesPostData['body']
    projectId: string // This will be part of path for the mutation
} & GenerateAiFileChangeApiProjectsProjectIdAiFileChangesPostData['body']; // filePath and prompt are in body

// The queryFn returns GetData type directly
type FileChangeDetailsResponse = GetAiFileChangeDetailsApiProjectsProjectIdAiFileChangesAiFileChangeIdGetData

const FILE_CHANGE_KEYS = {
    all: ['fileChange'] as const, // Keep as is, or align with new query key prefixes if desired
    detail: (projectId: string, changeId: string) =>
        getAiFileChangeDetailsApiProjectsProjectIdAiFileChangesAiFileChangeIdGetQueryKey({ // Updated name
            path: { projectId: projectId, aiFileChangeId: changeId } // No .toString() needed if type is string
        } as Options<GetAiFileChangeDetailsApiProjectsProjectIdAiFileChangesAiFileChangeIdGetData>)
}

export function useGenerateFileChange() {
    const mutationOptions = generateAiFileChangeApiProjectsProjectIdAiFileChangesPostMutation() // Updated name

    return useMutation<
        GenerateAiFileChangeApiProjectsProjectIdAiFileChangesPostResponse, // Updated name
        GenerateAiFileChangeApiProjectsProjectIdAiFileChangesPostError, // Updated name
        { projectId: string } & GenerateAiFileChangeApiProjectsProjectIdAiFileChangesPostData['body'] // Combined type for variables
    >({
        mutationFn: (variables) => { // variables now contain projectId and body
            const { projectId, ...body } = variables
            const opts: Options<GenerateAiFileChangeApiProjectsProjectIdAiFileChangesPostData> = { // Updated name
                body: body,
                path: { projectId }
            }
            if (!mutationOptions.mutationFn) {
                throw new Error('Mutation function not available')
            }
            return mutationOptions.mutationFn(opts)
        },
        onError: (error) => commonErrorHandler(error as unknown as Error)
    })
}

export function useGetFileChange(projectId: string | null, changeId: string | null) {
    const queryKey =
        projectId && changeId
            ? FILE_CHANGE_KEYS.detail(projectId, changeId)
            : ([...FILE_CHANGE_KEYS.all, null] as any) // Keep dynamic key structure, ensure type compatibility

    return useQuery<FileChangeDetailsResponse | null, Error, FileChangeDetailsResponse | null, typeof queryKey>({
        queryKey: queryKey,
        queryFn: async ({ signal }) => {
            if (!changeId || !projectId) return null

            try {
                const options = getAiFileChangeDetailsApiProjectsProjectIdAiFileChangesAiFileChangeIdGetOptions({ // Updated name
                    path: { projectId, aiFileChangeId: changeId }
                } as Options<GetAiFileChangeDetailsApiProjectsProjectIdAiFileChangesAiFileChangeIdGetData>)

                if (!options?.queryFn) {
                    console.error('Generated query options or queryFn not found')
                    return null
                }
                // The queryKey type here should match what queryFn expects.
                // The generated queryKey has a specific structure.
                const result = await options.queryFn({
                    signal,
                    queryKey: getAiFileChangeDetailsApiProjectsProjectIdAiFileChangesAiFileChangeIdGetQueryKey({ // Pass the correctly structured key
                        path: { projectId, aiFileChangeId: changeId }
                    } as Options<GetAiFileChangeDetailsApiProjectsProjectIdAiFileChangesAiFileChangeIdGetData>),
                    meta: undefined
                })
                return result
            } catch (error) {
                // instanceof check for specific error types if available from generated client
                if (error instanceof Error && error.message.includes('404')) { // Or check (error as any).status === 404
                    return null
                }
                console.error('Error fetching file change:', error)
                commonErrorHandler(error as Error)
                throw error
            }
        },
        enabled: changeId !== null && projectId !== null,
        retry: (failureCount, error) => {
            if (error instanceof Error && error.message.includes('404')) {
                return false
            }
            return failureCount < 3
        },
        refetchOnWindowFocus: false
    })
}

export type ConfirmFileChangeInput = {
    projectId: string
    changeId: string
} // This matches ConfirmAiFileChangeApiProjectsProjectIdAiFileChangesAiFileChangeIdConfirmPostData['path']

export function useConfirmFileChange() {
    const queryClient = useQueryClient()
    const mutationOptions = confirmAiFileChangeApiProjectsProjectIdAiFileChangesAiFileChangeIdConfirmPostMutation() // Updated name

    return useMutation<
        ConfirmAiFileChangeApiProjectsProjectIdAiFileChangesAiFileChangeIdConfirmPostResponse, // Updated name
        ConfirmAiFileChangeApiProjectsProjectIdAiFileChangesAiFileChangeIdConfirmPostError, // Updated name
        ConfirmFileChangeInput
    >({
        mutationFn: async (variables: ConfirmFileChangeInput) => {
            const { projectId, changeId } = variables
            const opts: Options<ConfirmAiFileChangeApiProjectsProjectIdAiFileChangesAiFileChangeIdConfirmPostData> = { // Updated name
                path: { projectId, aiFileChangeId: changeId }
            }
            if (!mutationOptions.mutationFn) {
                throw new Error('Mutation function not available')
            }
            return await mutationOptions.mutationFn(opts)
        },
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: FILE_CHANGE_KEYS.detail(variables.projectId, variables.changeId) })
            // Potentially invalidate project files list if confirmation affects it
            // queryClient.invalidateQueries({ queryKey: ['getProjectFilesRouteProjectsProjectIdFilesGet', variables.projectId] }); // Example
        },
        onError: (error) => commonErrorHandler(error as unknown as Error)
    })
}