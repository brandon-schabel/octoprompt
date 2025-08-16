import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { ApiError } from '@promptliano/shared'

/**
 * Generic CRUD hook factory
 * Reduces repetitive hook patterns across the application
 */
export interface CrudHookOptions<TEntity, TCreate, TUpdate> {
  entityName: string
  queryKeys: {
    all: readonly string[]
    list: (params?: any) => readonly unknown[]
    detail: (id: number) => readonly unknown[]
  }
  api: {
    list: (params?: any) => Promise<TEntity[]>
    get: (id: number) => Promise<TEntity>
    create: (data: TCreate) => Promise<TEntity>
    update: (id: number, data: TUpdate) => Promise<TEntity>
    delete: (id: number) => Promise<boolean>
  }
  staleTime?: number
  messages?: {
    createSuccess?: string
    updateSuccess?: string
    deleteSuccess?: string
    createError?: string
    updateError?: string
    deleteError?: string
  }
}

/**
 * Create a complete set of CRUD hooks for an entity
 */
export function createCrudHooks<
  TEntity extends { id: number },
  TCreate = Omit<TEntity, 'id'>,
  TUpdate = Partial<Omit<TEntity, 'id'>>
>(options: CrudHookOptions<TEntity, TCreate, TUpdate>) {
  const {
    entityName,
    queryKeys,
    api,
    staleTime = 5 * 60 * 1000, // 5 minutes default
    messages = {}
  } = options

  const defaultMessages = {
    createSuccess: `${entityName} created successfully`,
    updateSuccess: `${entityName} updated successfully`,
    deleteSuccess: `${entityName} deleted successfully`,
    createError: `Failed to create ${entityName}`,
    updateError: `Failed to update ${entityName}`,
    deleteError: `Failed to delete ${entityName}`,
    ...messages
  }

  /**
   * List hook
   */
  function useList(params?: any, queryOptions?: Partial<UseQueryOptions<TEntity[]>>) {
    return useQuery({
      queryKey: queryKeys.list(params),
      queryFn: () => api.list(params),
      staleTime,
      ...queryOptions
    })
  }

  /**
   * Get single entity hook
   */
  function useGet(id: number, queryOptions?: Partial<UseQueryOptions<TEntity>>) {
    return useQuery({
      queryKey: queryKeys.detail(id),
      queryFn: () => api.get(id),
      enabled: !!id && id !== -1,
      staleTime,
      ...queryOptions
    })
  }

  /**
   * Create mutation hook
   */
  function useCreate(mutationOptions?: Partial<UseMutationOptions<TEntity, ApiError, TCreate>>) {
    const queryClient = useQueryClient()

    return useMutation({
      mutationFn: api.create,
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: queryKeys.all })
        queryClient.setQueryData(queryKeys.detail(data.id), data)
        toast.success(defaultMessages.createSuccess)
      },
      onError: (error) => {
        toast.error(error?.message || defaultMessages.createError)
      },
      ...mutationOptions
    })
  }

  /**
   * Update mutation hook
   */
  function useUpdate(mutationOptions?: Partial<UseMutationOptions<TEntity, ApiError, { id: number; data: TUpdate }>>) {
    const queryClient = useQueryClient()

    return useMutation({
      mutationFn: ({ id, data }) => api.update(id, data),
      onSuccess: (data, variables) => {
        queryClient.invalidateQueries({ queryKey: queryKeys.list() })
        queryClient.setQueryData(queryKeys.detail(variables.id), data)
        toast.success(defaultMessages.updateSuccess)
      },
      onError: (error) => {
        toast.error(error?.message || defaultMessages.updateError)
      },
      ...mutationOptions
    })
  }

  /**
   * Delete mutation hook
   */
  function useDelete(mutationOptions?: Partial<UseMutationOptions<boolean, ApiError, number>>) {
    const queryClient = useQueryClient()

    return useMutation({
      mutationFn: api.delete,
      onSuccess: (_, id) => {
        queryClient.invalidateQueries({ queryKey: queryKeys.all })
        queryClient.removeQueries({ queryKey: queryKeys.detail(id) })
        toast.success(defaultMessages.deleteSuccess)
      },
      onError: (error) => {
        toast.error(error?.message || defaultMessages.deleteError)
      },
      ...mutationOptions
    })
  }

  /**
   * Invalidation utilities
   */
  function useInvalidate() {
    const queryClient = useQueryClient()

    return {
      invalidateAll: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.all })
      },
      invalidateList: (params?: any) => {
        queryClient.invalidateQueries({ queryKey: queryKeys.list(params) })
      },
      invalidateDetail: (id: number) => {
        queryClient.invalidateQueries({ queryKey: queryKeys.detail(id) })
      },
      setDetail: (entity: TEntity) => {
        queryClient.setQueryData(queryKeys.detail(entity.id), entity)
      },
      removeDetail: (id: number) => {
        queryClient.removeQueries({ queryKey: queryKeys.detail(id) })
      }
    }
  }

  return {
    [`use${entityName}List`]: useList,
    [`use${entityName}`]: useGet,
    [`useCreate${entityName}`]: useCreate,
    [`useUpdate${entityName}`]: useUpdate,
    [`useDelete${entityName}`]: useDelete,
    [`useInvalidate${entityName}`]: useInvalidate
  } as const
}

/**
 * Create a simple query hook with standard options
 */
export function createQueryHook<TData, TParams = void>(
  keyFn: (params: TParams) => readonly unknown[],
  queryFn: (params: TParams) => Promise<TData>,
  options: {
    staleTime?: number
    enabled?: (params: TParams) => boolean
  } = {}
) {
  return (params: TParams, queryOptions?: Partial<UseQueryOptions<TData>>) => {
    return useQuery({
      queryKey: keyFn(params),
      queryFn: () => queryFn(params),
      staleTime: options.staleTime || 5 * 60 * 1000,
      enabled: options.enabled ? options.enabled(params) : true,
      ...queryOptions
    })
  }
}

/**
 * Create a simple mutation hook with standard error handling
 */
export function createMutationHook<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: {
    onSuccess?: (data: TData, variables: TVariables) => void
    successMessage?: string | ((data: TData) => string)
    errorMessage?: string | ((error: ApiError) => string)
    invalidateKeys?: readonly unknown[][]
  } = {}
) {
  return (mutationOptions?: Partial<UseMutationOptions<TData, ApiError, TVariables>>) => {
    const queryClient = useQueryClient()

    return useMutation({
      mutationFn,
      onSuccess: (data, variables) => {
        if (options.invalidateKeys) {
          options.invalidateKeys.forEach(key => {
            queryClient.invalidateQueries({ queryKey: key })
          })
        }

        if (options.successMessage) {
          const message = typeof options.successMessage === 'function' 
            ? options.successMessage(data)
            : options.successMessage
          toast.success(message)
        }

        options.onSuccess?.(data, variables)
      },
      onError: (error) => {
        const message = options.errorMessage
          ? typeof options.errorMessage === 'function'
            ? options.errorMessage(error)
            : options.errorMessage
          : error?.message || 'An error occurred'
        
        toast.error(message)
      },
      ...mutationOptions
    })
  }
}

/**
 * Create optimistic update mutation
 */
export function createOptimisticMutation<TData, TVariables, TContext = unknown>(
  options: {
    mutationFn: (variables: TVariables) => Promise<TData>
    queryKey: (variables: TVariables) => readonly unknown[]
    optimisticUpdate: (old: TData | undefined, variables: TVariables) => TData
    successMessage?: string
    errorMessage?: string
  }
) {
  return (mutationOptions?: Partial<UseMutationOptions<TData, ApiError, TVariables, TContext>>) => {
    const queryClient = useQueryClient()

    return useMutation({
      mutationFn: options.mutationFn,
      onMutate: async (variables) => {
        const queryKey = options.queryKey(variables)
        
        // Cancel outgoing refetches
        await queryClient.cancelQueries({ queryKey })
        
        // Snapshot previous value
        const previousData = queryClient.getQueryData<TData>(queryKey)
        
        // Optimistically update
        queryClient.setQueryData(queryKey, (old: TData | undefined) => 
          options.optimisticUpdate(old, variables)
        )
        
        return { previousData, queryKey } as TContext
      },
      onError: (error, _, context) => {
        // Rollback on error
        if (context && typeof context === 'object' && 'queryKey' in context && 'previousData' in context) {
          queryClient.setQueryData(
            (context as any).queryKey,
            (context as any).previousData
          )
        }
        
        toast.error(options.errorMessage || error?.message || 'An error occurred')
      },
      onSuccess: () => {
        if (options.successMessage) {
          toast.success(options.successMessage)
        }
      },
      onSettled: (_, __, ___, context) => {
        // Always refetch after error or success
        if (context && typeof context === 'object' && 'queryKey' in context) {
          queryClient.invalidateQueries({ queryKey: (context as any).queryKey })
        }
      },
      ...mutationOptions
    })
  }
}