import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { commonErrorHandler } from './common-mutation-error-handler'
import {
  getApiProjectsByProjectIdAiFileChangesByAiFileChangeIdOptions,
  getApiProjectsByProjectIdAiFileChangesByAiFileChangeIdQueryKey,
  postApiProjectsByProjectIdAiFileChangesMutation,
  postApiProjectsByProjectIdAiFileChangesByAiFileChangeIdConfirmMutation
} from '../../generated/@tanstack/react-query.gen'
import type {
  GetApiProjectsByProjectIdAiFileChangesByAiFileChangeIdData,
  GetApiProjectsByProjectIdAiFileChangesByAiFileChangeIdResponse,
  PostApiProjectsByProjectIdAiFileChangesData,
  PostApiProjectsByProjectIdAiFileChangesError,
  PostApiProjectsByProjectIdAiFileChangesResponse,
  PostApiProjectsByProjectIdAiFileChangesByAiFileChangeIdConfirmData,
  PostApiProjectsByProjectIdAiFileChangesByAiFileChangeIdConfirmError,
  PostApiProjectsByProjectIdAiFileChangesByAiFileChangeIdConfirmResponse
} from '../../generated/types.gen'
import { Options } from '../../generated/sdk.gen'

export type GenerateChangeInput = {
  projectId: string
  filePath: string
  prompt: string
}

type FileChangeDetailsResponse = GetApiProjectsByProjectIdAiFileChangesByAiFileChangeIdResponse

const FILE_CHANGE_KEYS = {
  all: ['fileChange'] as const,
  detail: (projectId: string, changeId: number) =>
    getApiProjectsByProjectIdAiFileChangesByAiFileChangeIdQueryKey({
      path: { projectId: projectId, aiFileChangeId: changeId.toString() }
    } as Options<GetApiProjectsByProjectIdAiFileChangesByAiFileChangeIdData>)
}

export function useGenerateFileChange() {
  const mutationOptions = postApiProjectsByProjectIdAiFileChangesMutation()

  return useMutation<
    PostApiProjectsByProjectIdAiFileChangesResponse,
    PostApiProjectsByProjectIdAiFileChangesError,
    GenerateChangeInput
  >({
    mutationFn: (variables: GenerateChangeInput) => {
      const { projectId, ...body } = variables
      const opts: Options<PostApiProjectsByProjectIdAiFileChangesData> = {
        body: body,
        path: { projectId }
      }
      // Ensure mutationFn exists before calling
      if (!mutationOptions.mutationFn) {
        throw new Error('Mutation function not available')
      }
      return mutationOptions.mutationFn(opts)
    },
    onError: (error) => commonErrorHandler(error as unknown as Error)
  })
}

export function useGetFileChange(projectId: string | null, changeId: number | null) {
  const queryKey =
    projectId && changeId
      ? FILE_CHANGE_KEYS.detail(projectId, changeId)
      : [...FILE_CHANGE_KEYS.all, null] // Use a consistent key structure

  return useQuery<FileChangeDetailsResponse | null, Error, FileChangeDetailsResponse | null, typeof queryKey>({
    queryKey: queryKey,
    queryFn: async ({ signal }) => {
      if (!changeId || !projectId) return null

      try {
        const options = getApiProjectsByProjectIdAiFileChangesByAiFileChangeIdOptions({
          path: { projectId, aiFileChangeId: changeId.toString() }
        } as Options<GetApiProjectsByProjectIdAiFileChangesByAiFileChangeIdData>)

        if (!options?.queryFn) {
          console.error('Generated query options or queryFn not found')
          return null
        }

        const result = await options.queryFn({
          signal,
          queryKey: queryKey as ReturnType<typeof getApiProjectsByProjectIdAiFileChangesByAiFileChangeIdQueryKey>,
          meta: undefined
        })

        return result
      } catch (error) {
        if (error instanceof Error && error.message.includes('404')) {
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
  changeId: number
}

export function useConfirmFileChange() {
  const queryClient = useQueryClient()
  const mutationOptions = postApiProjectsByProjectIdAiFileChangesByAiFileChangeIdConfirmMutation()

  return useMutation<
    PostApiProjectsByProjectIdAiFileChangesByAiFileChangeIdConfirmResponse,
    PostApiProjectsByProjectIdAiFileChangesByAiFileChangeIdConfirmError,
    ConfirmFileChangeInput
  >({
    mutationFn: async (variables: ConfirmFileChangeInput) => {
      const { projectId, changeId } = variables
      const opts: Options<PostApiProjectsByProjectIdAiFileChangesByAiFileChangeIdConfirmData> = {
        path: { projectId, aiFileChangeId: changeId.toString() }
      }
      if (!mutationOptions.mutationFn) {
        throw new Error('Mutation function not available')
      }
      return await mutationOptions.mutationFn(opts)
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: FILE_CHANGE_KEYS.detail(variables.projectId, variables.changeId) })
    },
    onError: (error) => commonErrorHandler(error as unknown as Error)
  })
}
