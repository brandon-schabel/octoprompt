import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { commonErrorHandler } from './common-mutation-error-handler'
import {
  getApiProjectsOptions,
  getApiProjectsQueryKey,
  getApiProjectsByProjectIdOptions,
  getApiProjectsByProjectIdQueryKey,
  getApiProjectsByProjectIdFilesOptions,
  getApiProjectsByProjectIdFilesQueryKey,
  postApiProjectsMutation,
  patchApiProjectsByProjectIdMutation,
  deleteApiProjectsByProjectIdMutation,
  postApiProjectsByProjectIdSyncMutation,
  postApiProjectsByProjectIdRemoveSummariesMutation,
  postApiProjectsByProjectIdSuggestFilesMutation,
  postApiProjectsByProjectIdRefreshMutation,
  postApiProjectsByProjectIdSummarizeMutation,
  postApiPromptOptimizeMutation
} from '../../generated/@tanstack/react-query.gen'
import type {
  PostApiProjectsData,
  PostApiProjectsError,
  PostApiProjectsResponse,
  GetApiProjectsByProjectIdData,
  PatchApiProjectsByProjectIdData,
  PatchApiProjectsByProjectIdError,
  PatchApiProjectsByProjectIdResponse,
  DeleteApiProjectsByProjectIdData,
  DeleteApiProjectsByProjectIdError,
  DeleteApiProjectsByProjectIdResponse,
  GetApiProjectsByProjectIdFilesData,
  PostApiProjectsByProjectIdSyncData,
  PostApiProjectsByProjectIdSyncError,
  PostApiProjectsByProjectIdSyncResponse,
  PostApiProjectsByProjectIdSummarizeData,
  PostApiProjectsByProjectIdRemoveSummariesData,
  PostApiProjectsByProjectIdRemoveSummariesError,
  PostApiProjectsByProjectIdRemoveSummariesResponse,
  PostApiProjectsByProjectIdSuggestFilesData,
  PostApiProjectsByProjectIdSuggestFilesError,
  PostApiProjectsByProjectIdSuggestFilesResponse,
  PostApiProjectsByProjectIdRefreshData,
  PostApiProjectsByProjectIdRefreshError,
  PostApiProjectsByProjectIdRefreshResponse,
  PostApiProjectsByProjectIdSummarizeError,
  PostApiProjectsByProjectIdSummarizeResponse,
  SuggestFilesRequestBody,
  PostApiPromptOptimizeData,
  PostApiPromptOptimizeResponse,
  PostApiPromptOptimizeError
} from '../../generated/types.gen'
import { Options, postApiProjectsByProjectIdSuggestFiles } from '../../generated/sdk.gen'

export type CreateProjectInput = PostApiProjectsData['body']
export type UpdateProjectInput = PatchApiProjectsByProjectIdData['body']
export type SummarizeFilesInput = PostApiProjectsByProjectIdSummarizeData['body']
export type RemoveSummariesInput = PostApiProjectsByProjectIdRemoveSummariesData['body']
export type SuggestFilesInput = PostApiProjectsByProjectIdSuggestFilesData['body']

const PROJECT_KEYS = {
  all: () => getApiProjectsQueryKey(),
  lists: () => getApiProjectsQueryKey(),
  details: () => [...getApiProjectsQueryKey(), 'detail'] as const, // Custom structure if needed, but direct ID key is better
  detail: (projectId: string) =>
    getApiProjectsByProjectIdQueryKey({ path: { projectId } } as Options<GetApiProjectsByProjectIdData>) // Corresponds to old ['projects', 'detail', id]
} as const

const PROJECT_FILES_KEYS = {
  all: ['project-files'] as const,
  lists: () => [...PROJECT_FILES_KEYS.all, 'list'] as const,
  list: (projectId: string) =>
    getApiProjectsByProjectIdFilesQueryKey({ path: { projectId } } as Options<GetApiProjectsByProjectIdFilesData>)
} as const

export const useGetProjects = () => {
  const queryOptions = getApiProjectsOptions()
  return useQuery(queryOptions)
}

export const useGetProject = (projectId: string) => {
  const queryOptions = getApiProjectsByProjectIdOptions({
    path: { projectId }
  } as Options<GetApiProjectsByProjectIdData>)
  return useQuery({
    ...queryOptions,
    enabled: !!projectId
  })
}

export const useGetProjectFiles = (projectId: string) => {
  const queryOptions = getApiProjectsByProjectIdFilesOptions({
    path: { projectId }
  } as Options<GetApiProjectsByProjectIdFilesData>)
  return useQuery({
    ...queryOptions,
    enabled: !!projectId,
    refetchOnWindowFocus: true,
    refetchOnMount: true
  })
}

export const useCreateProject = () => {
  const queryClient = useQueryClient()
  const mutationOptions = postApiProjectsMutation()

  return useMutation<PostApiProjectsResponse, PostApiProjectsError, CreateProjectInput>({
    mutationFn: (body: CreateProjectInput) => {
      const opts: Options<PostApiProjectsData> = { body }
      return mutationOptions.mutationFn!(opts)
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.lists() })
      if ('warning' in data || 'error' in data) {
        // Check if it's the multi-status response
        console.warn(`Project creation completed with issues: Warning: ${data.warning}, Error: ${data.error}`)
      }
    },
    onError: (error) => commonErrorHandler(error as unknown as Error) // Keep common error handler
  })
}

export const useUpdateProject = () => {
  const queryClient = useQueryClient()
  const mutationOptions = patchApiProjectsByProjectIdMutation()

  return useMutation<
    PatchApiProjectsByProjectIdResponse,
    PatchApiProjectsByProjectIdError,
    { projectId: string; data: UpdateProjectInput }
  >({
    mutationFn: (vars: { projectId: string; data: UpdateProjectInput }) => {
      const opts: Options<PatchApiProjectsByProjectIdData> = { path: { projectId: vars.projectId }, body: vars.data }
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
  const mutationOptions = deleteApiProjectsByProjectIdMutation()

  return useMutation<DeleteApiProjectsByProjectIdResponse, DeleteApiProjectsByProjectIdError, string>({
    mutationFn: (projectId: string) => {
      const opts: Options<DeleteApiProjectsByProjectIdData> = { path: { projectId } }
      return mutationOptions.mutationFn!(opts)
    },
    onSuccess: (data, variables, context) => {
      const projectId = variables
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.lists() })
      queryClient.removeQueries({ queryKey: PROJECT_KEYS.detail(projectId) })
      queryClient.removeQueries({ queryKey: PROJECT_FILES_KEYS.list(projectId) })
    },
    onError: (error) => commonErrorHandler(error as unknown as Error)
  })
}

export const useSyncProject = (projectId: string) => {
  const queryClient = useQueryClient()
  const mutationOptions = postApiProjectsByProjectIdSyncMutation()

  return useMutation<PostApiProjectsByProjectIdSyncResponse, PostApiProjectsByProjectIdSyncError, void>({
    mutationFn: () => {
      const opts: Options<PostApiProjectsByProjectIdSyncData> = { path: { projectId } }
      return mutationOptions.mutationFn!(opts)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.detail(projectId) })
      queryClient.invalidateQueries({ queryKey: PROJECT_FILES_KEYS.list(projectId) })
    },
    onError: (error) => commonErrorHandler(error as unknown as Error)
  })
}

export const useFindSuggestedFiles = (projectId: string) => {
  const mutationOptions = postApiProjectsByProjectIdSuggestFilesMutation()

  return useMutation<
    PostApiProjectsByProjectIdSuggestFilesResponse,
    PostApiProjectsByProjectIdSuggestFilesError,
    string
  >({
    mutationFn: async (userInput: string) => {
      const body: SuggestFilesInput = { userInput }
      const opts: Options<PostApiProjectsByProjectIdSuggestFilesData> = { path: { projectId }, body }
      return mutationOptions.mutationFn!(opts)
    },
    onError: (error) => commonErrorHandler(error as unknown as Error)
  })
}

export const useRemoveSummariesFromFiles = (projectId: string) => {
  const queryClient = useQueryClient()
  const mutationOptions = postApiProjectsByProjectIdRemoveSummariesMutation()

  return useMutation<
    PostApiProjectsByProjectIdRemoveSummariesResponse,
    PostApiProjectsByProjectIdRemoveSummariesError,
    string[]
  >({
    mutationFn: (fileIds: string[]) => {
      const body: RemoveSummariesInput = { fileIds }
      const opts: Options<PostApiProjectsByProjectIdRemoveSummariesData> = { path: { projectId }, body }
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
  const mutationOptions = postApiProjectsByProjectIdRefreshMutation()

  return useMutation<
    PostApiProjectsByProjectIdRefreshResponse,
    PostApiProjectsByProjectIdRefreshError,
    { folder?: string }
  >({
    mutationFn: async (vars: { folder?: string }) => {
      const opts: Options<PostApiProjectsByProjectIdRefreshData> = { path: { projectId } }
      if (vars.folder) {
        opts.query = { folder: vars.folder }
      }
      return mutationOptions.mutationFn!(opts)
    },
    onSuccess: () => {
      // Invalidate the project's file list
      queryClient.invalidateQueries({ queryKey: PROJECT_FILES_KEYS.list(projectId) })
    },
    onError: (error) => commonErrorHandler(error as unknown as Error)
  })
}

export const useSuggestFiles = (projectId: string) => {
  return useMutation({
    mutationFn: async (requestBody: SuggestFilesRequestBody) => {
      return await postApiProjectsByProjectIdSuggestFiles({
        path: {
          projectId: projectId
        },
        body: {
          userInput: requestBody.userInput
        }
      })
    }
  })
}

export const useSummarizeProjectFiles = (projectId: string) => {
  const mutationOptions = postApiProjectsByProjectIdSummarizeMutation()
  const queryClient = useQueryClient()

  return useMutation<
    PostApiProjectsByProjectIdSummarizeResponse,
    PostApiProjectsByProjectIdSummarizeError,
    SummarizeFilesInput
  >({
    mutationFn: (body: SummarizeFilesInput) => {
      const opts: Options<PostApiProjectsByProjectIdSummarizeData> = { path: { projectId }, body }
      return mutationOptions.mutationFn!(opts)
    },
    onSuccess: () => {
      // TODO: invalidate project files
      queryClient.invalidateQueries({ queryKey: PROJECT_FILES_KEYS.list(projectId) })
      queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.detail(projectId) })

      // queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.summaries(projectId) });
      // queryClient.invalidateQueries({ queryKey: PROJECT_FILES_KEYS.list(projectId) });

      // TODO: invalidate project files
    },
    onError: (error) => commonErrorHandler(error as unknown as Error)
  })
}


/**
 * Optimizes a given prompt text (doesn't modify stored prompts).
 */
export const useOptimzeUserInput = () => {
  const mutationOptions = postApiPromptOptimizeMutation()
  return useMutation<PostApiPromptOptimizeResponse, PostApiPromptOptimizeError, { userContext: string; projectId: string }>({
    mutationFn: (vars: { userContext: string; projectId: string }) => {
      const opts: Options<PostApiPromptOptimizeData> = { body: { userContext: vars.userContext, projectId: vars.projectId } }
      return mutationOptions.mutationFn!(opts)
    },
    onError: (error) => commonErrorHandler(error as unknown as Error)
  })
}
