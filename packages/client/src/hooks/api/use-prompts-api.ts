import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { commonErrorHandler } from './common-mutation-error-handler'
import {
  // Query Hooks Options & Keys
  getApiPromptsOptions,
  getApiPromptsQueryKey,
  getApiPromptsByPromptIdOptions,
  getApiPromptsByPromptIdQueryKey,
  getApiProjectsByProjectIdPromptsOptions,
  getApiProjectsByProjectIdPromptsQueryKey,

  // Mutation Hooks
  postApiPromptsMutation,
  patchApiPromptsByPromptIdMutation,
  deleteApiPromptsByPromptIdMutation,
  postApiProjectsByProjectIdPromptsByPromptIdMutation,
  deleteApiProjectsByProjectIdPromptsByPromptIdMutation,
  postApiPromptOptimizeMutation
} from '../../generated/@tanstack/react-query.gen'
import type {
  // Query Data Types
  GetApiPromptsData,
  GetApiPromptsByPromptIdData,
  GetApiProjectsByProjectIdPromptsData,

  // Mutation Data, Error, Response Types
  PostApiPromptsData,
  PostApiPromptsError,
  PostApiPromptsResponse,
  PatchApiPromptsByPromptIdData,
  PatchApiPromptsByPromptIdError,
  PatchApiPromptsByPromptIdResponse,
  DeleteApiPromptsByPromptIdData,
  DeleteApiPromptsByPromptIdError,
  DeleteApiPromptsByPromptIdResponse,
  PostApiProjectsByProjectIdPromptsByPromptIdData,
  PostApiProjectsByProjectIdPromptsByPromptIdError,
  PostApiProjectsByProjectIdPromptsByPromptIdResponse,
  DeleteApiProjectsByProjectIdPromptsByPromptIdData,
  DeleteApiProjectsByProjectIdPromptsByPromptIdError,
  DeleteApiProjectsByProjectIdPromptsByPromptIdResponse,
  PostApiPromptOptimizeData,
  PostApiPromptOptimizeError,
  PostApiPromptOptimizeResponse
} from '../../generated/types.gen'
import { Options } from '../../generated/sdk.gen'

// Input Types based on generated mutation data types
export type CreatePromptInput = PostApiPromptsData['body']
export type UpdatePromptInput = PatchApiPromptsByPromptIdData['body']

// --- Query Hooks ---
/**
 * Fetches all prompts with specific caching behavior.
 */
export function useGetAllPrompts(options?: Partial<GetApiPromptsData['query']>) {
  const queryOptions = getApiPromptsOptions(options ? ({ query: options } as Options<GetApiPromptsData>) : undefined)
  return useQuery(queryOptions)
}

/**
 * Fetches a single prompt by its ID.
 */
export function useGetPrompt(id: number) {
  const queryOptions = getApiPromptsByPromptIdOptions({
    path: { promptId: id }
  } as Options<GetApiPromptsByPromptIdData>)
  return useQuery({
    ...queryOptions,
    enabled: !!id
  })
}

/**
 * Fetches prompts associated with a specific project.
 */
export function useGetProjectPrompts(projectId: number) {
  const queryOptions = getApiProjectsByProjectIdPromptsOptions({
    path: { projectId }
  } as Options<GetApiProjectsByProjectIdPromptsData>)
  return useQuery({
    ...queryOptions,
    enabled: !!projectId
  })
}

// --- Mutation Hooks ---

/**
 * Creates a new prompt.
 */
export function useCreatePrompt(projectId?: number) {
  const queryClient = useQueryClient()
  const mutationOptions = postApiPromptsMutation()

  return useMutation<PostApiPromptsResponse, PostApiPromptsError, Options<PostApiPromptsData>>({
    mutationFn: mutationOptions.mutationFn!,
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: getApiPromptsQueryKey() })

      if (projectId) {
        queryClient.invalidateQueries({ queryKey: getApiProjectsByProjectIdPromptsQueryKey({ path: { projectId } }) })
      }
    },
    onError: (error) => commonErrorHandler(error as unknown as Error)
  })
}

/**
 * Updates an existing prompt.
 */
export function useUpdatePrompt(projectId?: number) {
  const queryClient = useQueryClient()
  const mutationOptions = patchApiPromptsByPromptIdMutation()

  // *** MODIFIED: Variables now include projectId ***
  return useMutation<
    PatchApiPromptsByPromptIdResponse,
    PatchApiPromptsByPromptIdError,
    { promptId: number; data: UpdatePromptInput }
  >({
    mutationFn: (vars: { promptId: number; data: UpdatePromptInput }) => {
      // projectId is now available in vars but not directly used in API call path/body
      const opts: Options<PatchApiPromptsByPromptIdData> = { path: { promptId: vars.promptId }, body: vars.data }
      return mutationOptions.mutationFn!(opts)
    },
    onSuccess: (data, variables, context) => {
      // *** MODIFIED: Extract projectId from variables ***
      const { promptId } = variables

      // if there's a projectId, invalidate the project-specific prompts list
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: getApiProjectsByProjectIdPromptsQueryKey({ path: { projectId } }) })
      }

      // Invalidate the specific prompt's detail query
      queryClient.invalidateQueries({ queryKey: getApiPromptsByPromptIdQueryKey({ path: { promptId } }) })
      // Invalidate the general list of all prompts (optional)
      queryClient.invalidateQueries({ queryKey: getApiPromptsQueryKey() })
    },
    onError: (error) => commonErrorHandler(error as unknown as Error)
  })
}

/**
 * Deletes a prompt by its ID.
 */
// optional projectId used for invalidating project-specific prompts list
export function useDeletePrompt(projectId?: number) {
  const queryClient = useQueryClient()
  const mutationOptions = deleteApiPromptsByPromptIdMutation()

  // *** MODIFIED: Variables are now an object including projectId ***
  return useMutation<DeleteApiPromptsByPromptIdResponse, DeleteApiPromptsByPromptIdError, { promptId: number }>({
    mutationFn: (vars) => {
      // projectId is now available in vars but only promptId is needed for API call path
      const opts: Options<DeleteApiPromptsByPromptIdData> = { path: { promptId: vars.promptId } }
      return mutationOptions.mutationFn!(opts)
    },
    onSuccess: (data, variables, context) => {
      const { promptId } = variables

      // if there's a projectId, invalidate the project-specific prompts list
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: getApiProjectsByProjectIdPromptsQueryKey({ path: { projectId } }) })
      }

      // Invalidate (or remove) the specific prompt's detail query
      queryClient.invalidateQueries({ queryKey: getApiPromptsByPromptIdQueryKey({ path: { promptId } }) })
      // queryClient.removeQueries({ queryKey: getApiPromptsByPromptIdQueryKey({ path: { promptId } }) }); // Alternative

      // Invalidate the general list of all prompts (optional)
      queryClient.invalidateQueries({ queryKey: getApiPromptsQueryKey() })
    },
    onError: (error) => commonErrorHandler(error as unknown as Error)
  })
}

/**
 * Adds an existing prompt to a specific project.
 */
export function useAddPromptToProject() {
  const queryClient = useQueryClient()
  const mutationOptions = postApiProjectsByProjectIdPromptsByPromptIdMutation()

  return useMutation<
    PostApiProjectsByProjectIdPromptsByPromptIdResponse,
    PostApiProjectsByProjectIdPromptsByPromptIdError,
    { promptId: number; projectId: number }
  >({
    mutationFn: (vars: { promptId: number; projectId: number }) => {
      const opts: Options<PostApiProjectsByProjectIdPromptsByPromptIdData> = {
        path: { promptId: vars.promptId, projectId: vars.projectId }
      }
      return mutationOptions.mutationFn!(opts)
    },
    onSuccess: (data, variables, context) => {
      const { projectId } = variables
      queryClient.invalidateQueries({ queryKey: getApiProjectsByProjectIdPromptsQueryKey({ path: { projectId } }) })
    },
    onError: (error) => commonErrorHandler(error as unknown as Error)
  })
}

/**
 * Removes a prompt from a specific project.
 */
export function useRemovePromptFromProject() {
  const queryClient = useQueryClient()
  const mutationOptions = deleteApiProjectsByProjectIdPromptsByPromptIdMutation()

  return useMutation<
    DeleteApiProjectsByProjectIdPromptsByPromptIdResponse,
    DeleteApiProjectsByProjectIdPromptsByPromptIdError,
    { promptId: number; projectId: number }
  >({
    mutationFn: (vars: { promptId: number; projectId: number }) => {
      const opts: Options<DeleteApiProjectsByProjectIdPromptsByPromptIdData> = {
        path: { promptId: vars.promptId, projectId: vars.projectId }
      }
      return mutationOptions.mutationFn!(opts)
    },
    onSuccess: (data, variables, context) => {
      const { projectId } = variables
      queryClient.invalidateQueries({ queryKey: getApiProjectsByProjectIdPromptsQueryKey({ path: { projectId } }) })
    },
    onError: (error) => commonErrorHandler(error as unknown as Error)
  })
}
