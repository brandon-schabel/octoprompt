import { describe, test, expect, beforeEach, jest, mock } from 'bun:test'
import { createCrudHooks, createQueryHook, createMutationHook, createOptimisticMutation } from './hook-factory'

// Mock React Query and sonner
const mockUseQuery = jest.fn()
const mockUseMutation = jest.fn()
const mockUseQueryClient = jest.fn()
const mockQueryClient = {
  invalidateQueries: jest.fn(),
  setQueryData: jest.fn(),
  removeQueries: jest.fn(),
  getQueryData: jest.fn(),
  cancelQueries: jest.fn()
}
const mockToast = {
  success: jest.fn(),
  error: jest.fn()
}

// Mock the dependencies
mock.module('@tanstack/react-query', () => ({
  useQuery: mockUseQuery,
  useMutation: mockUseMutation,
  useQueryClient: mockUseQueryClient
}))

mock.module('sonner', () => ({
  toast: mockToast
}))

// Test types and mock data
interface TestEntity {
  id: number
  name: string
  value: number
}

interface TestCreate {
  name: string
  value: number
}

interface TestUpdate {
  name?: string
  value?: number
}

const mockEntity: TestEntity = {
  id: 1,
  name: 'Test Entity',
  value: 42
}

const mockCreateData: TestCreate = {
  name: 'New Entity',
  value: 100
}

const mockUpdateData: TestUpdate = {
  name: 'Updated Entity'
}

const mockApi = {
  list: jest.fn(),
  get: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn()
}

const mockQueryKeys = {
  all: ['test-entities'] as const,
  list: (params?: any) => ['test-entities', 'list', params] as const,
  detail: (id: number) => ['test-entities', 'detail', id] as const
}

const mockApiError = {
  message: 'API Error occurred',
  status: 400
}

describe('hook-factory', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseQueryClient.mockReturnValue(mockQueryClient)
  })

  describe('createCrudHooks', () => {
    test('creates all CRUD hooks with correct names', () => {
      const hooks = createCrudHooks<TestEntity, TestCreate, TestUpdate>({
        entityName: 'TestEntity',
        queryKeys: mockQueryKeys,
        api: mockApi
      })

      expect(hooks).toHaveProperty('useTestEntityList')
      expect(hooks).toHaveProperty('useTestEntity')
      expect(hooks).toHaveProperty('useCreateTestEntity')
      expect(hooks).toHaveProperty('useUpdateTestEntity')
      expect(hooks).toHaveProperty('useDeleteTestEntity')
      expect(hooks).toHaveProperty('useInvalidateTestEntity')
      expect(typeof hooks.useTestEntityList).toBe('function')
      expect(typeof hooks.useTestEntity).toBe('function')
      expect(typeof hooks.useCreateTestEntity).toBe('function')
      expect(typeof hooks.useUpdateTestEntity).toBe('function')
      expect(typeof hooks.useDeleteTestEntity).toBe('function')
      expect(typeof hooks.useInvalidateTestEntity).toBe('function')
    })

    test('uses custom messages when provided', () => {
      const customMessages = {
        createSuccess: 'Custom create success',
        updateSuccess: 'Custom update success',
        deleteSuccess: 'Custom delete success',
        createError: 'Custom create error',
        updateError: 'Custom update error',
        deleteError: 'Custom delete error'
      }

      const hooks = createCrudHooks<TestEntity, TestCreate, TestUpdate>({
        entityName: 'TestEntity',
        queryKeys: mockQueryKeys,
        api: mockApi,
        messages: customMessages
      })

      // Test create hook with custom messages
      const mockCreateMutation = {
        mutationFn: mockApi.create,
        onSuccess: jest.fn(),
        onError: jest.fn()
      }
      mockUseMutation.mockReturnValue(mockCreateMutation)

      hooks.useCreateTestEntity()

      expect(mockUseMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          mutationFn: mockApi.create,
          onSuccess: expect.any(Function),
          onError: expect.any(Function)
        })
      )

      // Test success callback
      const createCall = mockUseMutation.mock.calls[0][0]
      createCall.onSuccess(mockEntity)
      expect(mockToast.success).toHaveBeenCalledWith(customMessages.createSuccess)

      // Test error callback
      createCall.onError(mockApiError)
      expect(mockToast.error).toHaveBeenCalledWith(mockApiError.message)
    })

    test('uses default stale time when not provided', () => {
      const hooks = createCrudHooks<TestEntity, TestCreate, TestUpdate>({
        entityName: 'TestEntity',
        queryKeys: mockQueryKeys,
        api: mockApi
      })

      hooks.useTestEntityList()

      expect(mockUseQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          staleTime: 5 * 60 * 1000 // 5 minutes
        })
      )
    })

    test('uses custom stale time when provided', () => {
      const customStaleTime = 10 * 60 * 1000 // 10 minutes
      const hooks = createCrudHooks<TestEntity, TestCreate, TestUpdate>({
        entityName: 'TestEntity',
        queryKeys: mockQueryKeys,
        api: mockApi,
        staleTime: customStaleTime
      })

      hooks.useTestEntityList()

      expect(mockUseQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          staleTime: customStaleTime
        })
      )
    })
  })

  describe('useList hook', () => {
    test('calls useQuery with correct parameters', () => {
      const hooks = createCrudHooks<TestEntity, TestCreate, TestUpdate>({
        entityName: 'TestEntity',
        queryKeys: mockQueryKeys,
        api: mockApi
      })

      const params = { page: 1, limit: 10 }
      hooks.useTestEntityList(params)

      expect(mockUseQuery).toHaveBeenCalledWith({
        queryKey: mockQueryKeys.list(params),
        queryFn: expect.any(Function),
        staleTime: 5 * 60 * 1000
      })
    })

    test('merges custom query options', () => {
      const hooks = createCrudHooks<TestEntity, TestCreate, TestUpdate>({
        entityName: 'TestEntity',
        queryKeys: mockQueryKeys,
        api: mockApi
      })

      const customOptions = { enabled: false, retry: 3 }
      hooks.useTestEntityList(undefined, customOptions)

      expect(mockUseQuery).toHaveBeenCalledWith(
        expect.objectContaining(customOptions)
      )
    })

    test('calls api.list when queryFn is executed', () => {
      const hooks = createCrudHooks<TestEntity, TestCreate, TestUpdate>({
        entityName: 'TestEntity',
        queryKeys: mockQueryKeys,
        api: mockApi
      })

      hooks.useTestEntityList()
      const queryConfig = mockUseQuery.mock.calls[0][0]
      const params = { test: 'value' }
      
      queryConfig.queryFn()
      expect(mockApi.list).toHaveBeenCalled()
    })
  })

  describe('useGet hook', () => {
    test('calls useQuery with correct parameters', () => {
      const hooks = createCrudHooks<TestEntity, TestCreate, TestUpdate>({
        entityName: 'TestEntity',
        queryKeys: mockQueryKeys,
        api: mockApi
      })

      const id = 123
      hooks.useTestEntity(id)

      expect(mockUseQuery).toHaveBeenCalledWith({
        queryKey: mockQueryKeys.detail(id),
        queryFn: expect.any(Function),
        enabled: true,
        staleTime: 5 * 60 * 1000
      })
    })

    test('disables query when id is falsy or -1', () => {
      const hooks = createCrudHooks<TestEntity, TestCreate, TestUpdate>({
        entityName: 'TestEntity',
        queryKeys: mockQueryKeys,
        api: mockApi
      })

      // Test with 0
      hooks.useTestEntity(0)
      expect(mockUseQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({ enabled: false })
      )

      // Test with -1
      hooks.useTestEntity(-1)
      expect(mockUseQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({ enabled: false })
      )
    })

    test('calls api.get when queryFn is executed', () => {
      const hooks = createCrudHooks<TestEntity, TestCreate, TestUpdate>({
        entityName: 'TestEntity',
        queryKeys: mockQueryKeys,
        api: mockApi
      })

      const id = 123
      hooks.useTestEntity(id)
      const queryConfig = mockUseQuery.mock.calls[0][0]
      
      queryConfig.queryFn()
      expect(mockApi.get).toHaveBeenCalledWith(id)
    })
  })

  describe('useCreate hook', () => {
    test('calls useMutation with correct parameters', () => {
      const hooks = createCrudHooks<TestEntity, TestCreate, TestUpdate>({
        entityName: 'TestEntity',
        queryKeys: mockQueryKeys,
        api: mockApi
      })

      hooks.useCreateTestEntity()

      expect(mockUseMutation).toHaveBeenCalledWith({
        mutationFn: mockApi.create,
        onSuccess: expect.any(Function),
        onError: expect.any(Function)
      })
    })

    test('invalidates queries and sets cache on success', () => {
      const hooks = createCrudHooks<TestEntity, TestCreate, TestUpdate>({
        entityName: 'TestEntity',
        queryKeys: mockQueryKeys,
        api: mockApi
      })

      hooks.useCreateTestEntity()
      const mutationConfig = mockUseMutation.mock.calls[0][0]
      
      mutationConfig.onSuccess(mockEntity)

      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: mockQueryKeys.all
      })
      expect(mockQueryClient.setQueryData).toHaveBeenCalledWith(
        mockQueryKeys.detail(mockEntity.id),
        mockEntity
      )
      expect(mockToast.success).toHaveBeenCalledWith('TestEntity created successfully')
    })

    test('shows error toast on failure', () => {
      const hooks = createCrudHooks<TestEntity, TestCreate, TestUpdate>({
        entityName: 'TestEntity',
        queryKeys: mockQueryKeys,
        api: mockApi
      })

      hooks.useCreateTestEntity()
      const mutationConfig = mockUseMutation.mock.calls[0][0]
      
      mutationConfig.onError(mockApiError)

      expect(mockToast.error).toHaveBeenCalledWith(mockApiError.message)
    })

    test('shows default error message when error has no message', () => {
      const hooks = createCrudHooks<TestEntity, TestCreate, TestUpdate>({
        entityName: 'TestEntity',
        queryKeys: mockQueryKeys,
        api: mockApi
      })

      hooks.useCreateTestEntity()
      const mutationConfig = mockUseMutation.mock.calls[0][0]
      
      mutationConfig.onError({})

      expect(mockToast.error).toHaveBeenCalledWith('Failed to create TestEntity')
    })

    test('merges custom mutation options', () => {
      const hooks = createCrudHooks<TestEntity, TestCreate, TestUpdate>({
        entityName: 'TestEntity',
        queryKeys: mockQueryKeys,
        api: mockApi
      })

      const customOptions = { retry: 3 }
      hooks.useCreateTestEntity(customOptions)

      expect(mockUseMutation).toHaveBeenCalledWith(
        expect.objectContaining(customOptions)
      )
    })
  })

  describe('useUpdate hook', () => {
    test('calls useMutation with correct parameters', () => {
      const hooks = createCrudHooks<TestEntity, TestCreate, TestUpdate>({
        entityName: 'TestEntity',
        queryKeys: mockQueryKeys,
        api: mockApi
      })

      hooks.useUpdateTestEntity()

      expect(mockUseMutation).toHaveBeenCalledWith({
        mutationFn: expect.any(Function),
        onSuccess: expect.any(Function),
        onError: expect.any(Function)
      })
    })

    test('calls api.update with correct parameters when mutationFn is executed', () => {
      const hooks = createCrudHooks<TestEntity, TestCreate, TestUpdate>({
        entityName: 'TestEntity',
        queryKeys: mockQueryKeys,
        api: mockApi
      })

      hooks.useUpdateTestEntity()
      const mutationConfig = mockUseMutation.mock.calls[0][0]
      
      const variables = { id: 123, data: mockUpdateData }
      mutationConfig.mutationFn(variables)

      expect(mockApi.update).toHaveBeenCalledWith(123, mockUpdateData)
    })

    test('invalidates list and sets detail cache on success', () => {
      const hooks = createCrudHooks<TestEntity, TestCreate, TestUpdate>({
        entityName: 'TestEntity',
        queryKeys: mockQueryKeys,
        api: mockApi
      })

      hooks.useUpdateTestEntity()
      const mutationConfig = mockUseMutation.mock.calls[0][0]
      
      const variables = { id: 123, data: mockUpdateData }
      mutationConfig.onSuccess(mockEntity, variables)

      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: mockQueryKeys.list()
      })
      expect(mockQueryClient.setQueryData).toHaveBeenCalledWith(
        mockQueryKeys.detail(variables.id),
        mockEntity
      )
      expect(mockToast.success).toHaveBeenCalledWith('TestEntity updated successfully')
    })
  })

  describe('useDelete hook', () => {
    test('calls useMutation with correct parameters', () => {
      const hooks = createCrudHooks<TestEntity, TestCreate, TestUpdate>({
        entityName: 'TestEntity',
        queryKeys: mockQueryKeys,
        api: mockApi
      })

      hooks.useDeleteTestEntity()

      expect(mockUseMutation).toHaveBeenCalledWith({
        mutationFn: mockApi.delete,
        onSuccess: expect.any(Function),
        onError: expect.any(Function)
      })
    })

    test('invalidates all queries and removes detail cache on success', () => {
      const hooks = createCrudHooks<TestEntity, TestCreate, TestUpdate>({
        entityName: 'TestEntity',
        queryKeys: mockQueryKeys,
        api: mockApi
      })

      hooks.useDeleteTestEntity()
      const mutationConfig = mockUseMutation.mock.calls[0][0]
      
      const id = 123
      mutationConfig.onSuccess(true, id)

      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: mockQueryKeys.all
      })
      expect(mockQueryClient.removeQueries).toHaveBeenCalledWith({
        queryKey: mockQueryKeys.detail(id)
      })
      expect(mockToast.success).toHaveBeenCalledWith('TestEntity deleted successfully')
    })
  })

  describe('useInvalidate hook', () => {
    test('provides invalidation utilities', () => {
      const hooks = createCrudHooks<TestEntity, TestCreate, TestUpdate>({
        entityName: 'TestEntity',
        queryKeys: mockQueryKeys,
        api: mockApi
      })

      const invalidateUtils = hooks.useInvalidateTestEntity()

      expect(invalidateUtils).toHaveProperty('invalidateAll')
      expect(invalidateUtils).toHaveProperty('invalidateList')
      expect(invalidateUtils).toHaveProperty('invalidateDetail')
      expect(invalidateUtils).toHaveProperty('setDetail')
      expect(invalidateUtils).toHaveProperty('removeDetail')
    })

    test('invalidateAll works correctly', () => {
      const hooks = createCrudHooks<TestEntity, TestCreate, TestUpdate>({
        entityName: 'TestEntity',
        queryKeys: mockQueryKeys,
        api: mockApi
      })

      const invalidateUtils = hooks.useInvalidateTestEntity()
      invalidateUtils.invalidateAll()

      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: mockQueryKeys.all
      })
    })

    test('invalidateList works correctly', () => {
      const hooks = createCrudHooks<TestEntity, TestCreate, TestUpdate>({
        entityName: 'TestEntity',
        queryKeys: mockQueryKeys,
        api: mockApi
      })

      const params = { page: 1 }
      const invalidateUtils = hooks.useInvalidateTestEntity()
      invalidateUtils.invalidateList(params)

      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: mockQueryKeys.list(params)
      })
    })

    test('invalidateDetail works correctly', () => {
      const hooks = createCrudHooks<TestEntity, TestCreate, TestUpdate>({
        entityName: 'TestEntity',
        queryKeys: mockQueryKeys,
        api: mockApi
      })

      const id = 123
      const invalidateUtils = hooks.useInvalidateTestEntity()
      invalidateUtils.invalidateDetail(id)

      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: mockQueryKeys.detail(id)
      })
    })

    test('setDetail works correctly', () => {
      const hooks = createCrudHooks<TestEntity, TestCreate, TestUpdate>({
        entityName: 'TestEntity',
        queryKeys: mockQueryKeys,
        api: mockApi
      })

      const invalidateUtils = hooks.useInvalidateTestEntity()
      invalidateUtils.setDetail(mockEntity)

      expect(mockQueryClient.setQueryData).toHaveBeenCalledWith(
        mockQueryKeys.detail(mockEntity.id),
        mockEntity
      )
    })

    test('removeDetail works correctly', () => {
      const hooks = createCrudHooks<TestEntity, TestCreate, TestUpdate>({
        entityName: 'TestEntity',
        queryKeys: mockQueryKeys,
        api: mockApi
      })

      const id = 123
      const invalidateUtils = hooks.useInvalidateTestEntity()
      invalidateUtils.removeDetail(id)

      expect(mockQueryClient.removeQueries).toHaveBeenCalledWith({
        queryKey: mockQueryKeys.detail(id)
      })
    })
  })

  describe('createQueryHook', () => {
    test('creates a query hook with default options', () => {
      const keyFn = (params: string) => ['test', params] as const
      const queryFn = jest.fn().mockResolvedValue('test data')
      
      const useTestQuery = createQueryHook(keyFn, queryFn)
      
      expect(typeof useTestQuery).toBe('function')
      
      const params = 'test-param'
      useTestQuery(params)
      
      expect(mockUseQuery).toHaveBeenCalledWith({
        queryKey: ['test', params],
        queryFn: expect.any(Function),
        staleTime: 5 * 60 * 1000,
        enabled: true
      })
    })

    test('uses custom stale time', () => {
      const keyFn = (params: string) => ['test', params] as const
      const queryFn = jest.fn().mockResolvedValue('test data')
      const customStaleTime = 10 * 60 * 1000
      
      const useTestQuery = createQueryHook(keyFn, queryFn, {
        staleTime: customStaleTime
      })
      
      useTestQuery('test')
      
      expect(mockUseQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          staleTime: customStaleTime
        })
      )
    })

    test('uses custom enabled function', () => {
      const keyFn = (params: string) => ['test', params] as const
      const queryFn = jest.fn().mockResolvedValue('test data')
      const enabledFn = jest.fn().mockReturnValue(false)
      
      const useTestQuery = createQueryHook(keyFn, queryFn, {
        enabled: enabledFn
      })
      
      const params = 'test-param'
      useTestQuery(params)
      
      expect(enabledFn).toHaveBeenCalledWith(params)
      expect(mockUseQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: false
        })
      )
    })

    test('calls queryFn with correct parameters', () => {
      const keyFn = (params: string) => ['test', params] as const
      const queryFn = jest.fn().mockResolvedValue('test data')
      
      const useTestQuery = createQueryHook(keyFn, queryFn)
      
      const params = 'test-param'
      useTestQuery(params)
      
      const queryConfig = mockUseQuery.mock.calls[0][0]
      queryConfig.queryFn()
      
      expect(queryFn).toHaveBeenCalledWith(params)
    })

    test('merges custom query options', () => {
      const keyFn = (params: string) => ['test', params] as const
      const queryFn = jest.fn().mockResolvedValue('test data')
      
      const useTestQuery = createQueryHook(keyFn, queryFn)
      
      const customOptions = { retry: 3, enabled: false }
      useTestQuery('test', customOptions)
      
      expect(mockUseQuery).toHaveBeenCalledWith(
        expect.objectContaining(customOptions)
      )
    })
  })

  describe('createMutationHook', () => {
    test('creates a mutation hook with basic functionality', () => {
      const mutationFn = jest.fn().mockResolvedValue('result')
      
      const useTestMutation = createMutationHook(mutationFn)
      
      expect(typeof useTestMutation).toBe('function')
      
      useTestMutation()
      
      expect(mockUseMutation).toHaveBeenCalledWith({
        mutationFn,
        onSuccess: expect.any(Function),
        onError: expect.any(Function)
      })
    })

    test('invalidates specified query keys on success', () => {
      const mutationFn = jest.fn().mockResolvedValue('result')
      const invalidateKeys = [['key1'], ['key2', 'subkey']]
      
      const useTestMutation = createMutationHook(mutationFn, {
        invalidateKeys
      })
      
      useTestMutation()
      
      const mutationConfig = mockUseMutation.mock.calls[0][0]
      mutationConfig.onSuccess('result', 'variables')
      
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledTimes(2)
      expect(mockQueryClient.invalidateQueries).toHaveBeenNthCalledWith(1, {
        queryKey: ['key1']
      })
      expect(mockQueryClient.invalidateQueries).toHaveBeenNthCalledWith(2, {
        queryKey: ['key2', 'subkey']
      })
    })

    test('shows success message as string', () => {
      const mutationFn = jest.fn().mockResolvedValue('result')
      const successMessage = 'Operation successful'
      
      const useTestMutation = createMutationHook(mutationFn, {
        successMessage
      })
      
      useTestMutation()
      
      const mutationConfig = mockUseMutation.mock.calls[0][0]
      mutationConfig.onSuccess('result', 'variables')
      
      expect(mockToast.success).toHaveBeenCalledWith(successMessage)
    })

    test('shows success message as function', () => {
      const mutationFn = jest.fn().mockResolvedValue({ id: 1, name: 'Test' })
      const successMessage = jest.fn().mockReturnValue('Dynamic success message')
      
      const useTestMutation = createMutationHook(mutationFn, {
        successMessage
      })
      
      useTestMutation()
      
      const mutationConfig = mockUseMutation.mock.calls[0][0]
      const result = { id: 1, name: 'Test' }
      mutationConfig.onSuccess(result, 'variables')
      
      expect(successMessage).toHaveBeenCalledWith(result)
      expect(mockToast.success).toHaveBeenCalledWith('Dynamic success message')
    })

    test('calls custom onSuccess callback', () => {
      const mutationFn = jest.fn().mockResolvedValue('result')
      const onSuccess = jest.fn()
      
      const useTestMutation = createMutationHook(mutationFn, {
        onSuccess
      })
      
      useTestMutation()
      
      const mutationConfig = mockUseMutation.mock.calls[0][0]
      mutationConfig.onSuccess('result', 'variables')
      
      expect(onSuccess).toHaveBeenCalledWith('result', 'variables')
    })

    test('shows error message as string', () => {
      const mutationFn = jest.fn().mockResolvedValue('result')
      const errorMessage = 'Custom error message'
      
      const useTestMutation = createMutationHook(mutationFn, {
        errorMessage
      })
      
      useTestMutation()
      
      const mutationConfig = mockUseMutation.mock.calls[0][0]
      mutationConfig.onError(mockApiError)
      
      expect(mockToast.error).toHaveBeenCalledWith(errorMessage)
    })

    test('shows error message as function', () => {
      const mutationFn = jest.fn().mockResolvedValue('result')
      const errorMessage = jest.fn().mockReturnValue('Dynamic error message')
      
      const useTestMutation = createMutationHook(mutationFn, {
        errorMessage
      })
      
      useTestMutation()
      
      const mutationConfig = mockUseMutation.mock.calls[0][0]
      mutationConfig.onError(mockApiError)
      
      expect(errorMessage).toHaveBeenCalledWith(mockApiError)
      expect(mockToast.error).toHaveBeenCalledWith('Dynamic error message')
    })

    test('shows default error message when no custom message and no error message', () => {
      const mutationFn = jest.fn().mockResolvedValue('result')
      
      const useTestMutation = createMutationHook(mutationFn)
      
      useTestMutation()
      
      const mutationConfig = mockUseMutation.mock.calls[0][0]
      mutationConfig.onError({})
      
      expect(mockToast.error).toHaveBeenCalledWith('An error occurred')
    })

    test('shows error.message when available and no custom error message', () => {
      const mutationFn = jest.fn().mockResolvedValue('result')
      
      const useTestMutation = createMutationHook(mutationFn)
      
      useTestMutation()
      
      const mutationConfig = mockUseMutation.mock.calls[0][0]
      mutationConfig.onError(mockApiError)
      
      expect(mockToast.error).toHaveBeenCalledWith(mockApiError.message)
    })

    test('merges custom mutation options', () => {
      const mutationFn = jest.fn().mockResolvedValue('result')
      
      const useTestMutation = createMutationHook(mutationFn)
      
      const customOptions = { retry: 3 }
      useTestMutation(customOptions)
      
      expect(mockUseMutation).toHaveBeenCalledWith(
        expect.objectContaining(customOptions)
      )
    })
  })

  describe('createOptimisticMutation', () => {
    const mockMutationFn = jest.fn().mockResolvedValue(mockEntity)
    const mockQueryKey = (variables: any) => ['optimistic', variables.id] as const
    const mockOptimisticUpdate = jest.fn().mockImplementation((old, variables) => ({
      ...old,
      ...variables.data
    }))

    test('creates an optimistic mutation hook', () => {
      const useOptimisticMutation = createOptimisticMutation({
        mutationFn: mockMutationFn,
        queryKey: mockQueryKey,
        optimisticUpdate: mockOptimisticUpdate
      })
      
      expect(typeof useOptimisticMutation).toBe('function')
      
      useOptimisticMutation()
      
      expect(mockUseMutation).toHaveBeenCalledWith({
        mutationFn: mockMutationFn,
        onMutate: expect.any(Function),
        onError: expect.any(Function),
        onSuccess: expect.any(Function),
        onSettled: expect.any(Function)
      })
    })

    test('performs optimistic update on mutate', async () => {
      const useOptimisticMutation = createOptimisticMutation({
        mutationFn: mockMutationFn,
        queryKey: mockQueryKey,
        optimisticUpdate: mockOptimisticUpdate
      })
      
      useOptimisticMutation()
      
      const mutationConfig = mockUseMutation.mock.calls[0][0]
      const variables = { id: 1, data: { name: 'Optimistic' } }
      const previousData = { id: 1, name: 'Original' }
      
      mockQueryClient.getQueryData.mockReturnValue(previousData)
      
      const context = await mutationConfig.onMutate(variables)
      
      expect(mockQueryClient.cancelQueries).toHaveBeenCalledWith({
        queryKey: mockQueryKey(variables)
      })
      expect(mockQueryClient.getQueryData).toHaveBeenCalledWith(mockQueryKey(variables))
      expect(mockQueryClient.setQueryData).toHaveBeenCalledWith(
        mockQueryKey(variables),
        expect.any(Function)
      )
      expect(context).toEqual({
        previousData,
        queryKey: mockQueryKey(variables)
      })
    })

    test('calls optimistic update function correctly', async () => {
      const useOptimisticMutation = createOptimisticMutation({
        mutationFn: mockMutationFn,
        queryKey: mockQueryKey,
        optimisticUpdate: mockOptimisticUpdate
      })
      
      useOptimisticMutation()
      
      const mutationConfig = mockUseMutation.mock.calls[0][0]
      const variables = { id: 1, data: { name: 'Optimistic' } }
      const previousData = { id: 1, name: 'Original' }
      
      mockQueryClient.getQueryData.mockReturnValue(previousData)
      
      await mutationConfig.onMutate(variables)
      
      // Get the function passed to setQueryData
      const setQueryDataCall = mockQueryClient.setQueryData.mock.calls[0]
      const updateFunction = setQueryDataCall[1]
      
      // Call the update function
      updateFunction(previousData)
      
      expect(mockOptimisticUpdate).toHaveBeenCalledWith(previousData, variables)
    })

    test('rollbacks on error', () => {
      const useOptimisticMutation = createOptimisticMutation({
        mutationFn: mockMutationFn,
        queryKey: mockQueryKey,
        optimisticUpdate: mockOptimisticUpdate,
        errorMessage: 'Custom error'
      })
      
      useOptimisticMutation()
      
      const mutationConfig = mockUseMutation.mock.calls[0][0]
      const context = {
        queryKey: ['optimistic', 1],
        previousData: { id: 1, name: 'Original' }
      }
      
      mutationConfig.onError(mockApiError, 'variables', context)
      
      expect(mockQueryClient.setQueryData).toHaveBeenCalledWith(
        context.queryKey,
        context.previousData
      )
      expect(mockToast.error).toHaveBeenCalledWith('Custom error')
    })

    test('shows error message from error object when no custom message', () => {
      const useOptimisticMutation = createOptimisticMutation({
        mutationFn: mockMutationFn,
        queryKey: mockQueryKey,
        optimisticUpdate: mockOptimisticUpdate
      })
      
      useOptimisticMutation()
      
      const mutationConfig = mockUseMutation.mock.calls[0][0]
      
      mutationConfig.onError(mockApiError, 'variables', {})
      
      expect(mockToast.error).toHaveBeenCalledWith(mockApiError.message)
    })

    test('shows default error message when no message available', () => {
      const useOptimisticMutation = createOptimisticMutation({
        mutationFn: mockMutationFn,
        queryKey: mockQueryKey,
        optimisticUpdate: mockOptimisticUpdate
      })
      
      useOptimisticMutation()
      
      const mutationConfig = mockUseMutation.mock.calls[0][0]
      
      mutationConfig.onError({}, 'variables', {})
      
      expect(mockToast.error).toHaveBeenCalledWith('An error occurred')
    })

    test('shows success message on success', () => {
      const useOptimisticMutation = createOptimisticMutation({
        mutationFn: mockMutationFn,
        queryKey: mockQueryKey,
        optimisticUpdate: mockOptimisticUpdate,
        successMessage: 'Optimistic success'
      })
      
      useOptimisticMutation()
      
      const mutationConfig = mockUseMutation.mock.calls[0][0]
      
      mutationConfig.onSuccess()
      
      expect(mockToast.success).toHaveBeenCalledWith('Optimistic success')
    })

    test('does not show success message when not provided', () => {
      const useOptimisticMutation = createOptimisticMutation({
        mutationFn: mockMutationFn,
        queryKey: mockQueryKey,
        optimisticUpdate: mockOptimisticUpdate
      })
      
      useOptimisticMutation()
      
      const mutationConfig = mockUseMutation.mock.calls[0][0]
      
      mutationConfig.onSuccess()
      
      expect(mockToast.success).not.toHaveBeenCalled()
    })

    test('invalidates queries on settled', () => {
      const useOptimisticMutation = createOptimisticMutation({
        mutationFn: mockMutationFn,
        queryKey: mockQueryKey,
        optimisticUpdate: mockOptimisticUpdate
      })
      
      useOptimisticMutation()
      
      const mutationConfig = mockUseMutation.mock.calls[0][0]
      const context = {
        queryKey: ['optimistic', 1]
      }
      
      mutationConfig.onSettled(null, null, null, context)
      
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: context.queryKey
      })
    })

    test('does not invalidate when context has no queryKey', () => {
      const useOptimisticMutation = createOptimisticMutation({
        mutationFn: mockMutationFn,
        queryKey: mockQueryKey,
        optimisticUpdate: mockOptimisticUpdate
      })
      
      useOptimisticMutation()
      
      const mutationConfig = mockUseMutation.mock.calls[0][0]
      
      mutationConfig.onSettled(null, null, null, {})
      
      expect(mockQueryClient.invalidateQueries).not.toHaveBeenCalled()
    })

    test('merges custom mutation options', () => {
      const useOptimisticMutation = createOptimisticMutation({
        mutationFn: mockMutationFn,
        queryKey: mockQueryKey,
        optimisticUpdate: mockOptimisticUpdate
      })
      
      const customOptions = { retry: 3 }
      useOptimisticMutation(customOptions)
      
      expect(mockUseMutation).toHaveBeenCalledWith(
        expect.objectContaining(customOptions)
      )
    })
  })

  describe('Integration scenarios', () => {
    test('CRUD hooks work together for complete workflow', () => {
      const hooks = createCrudHooks<TestEntity, TestCreate, TestUpdate>({
        entityName: 'TestEntity',
        queryKeys: mockQueryKeys,
        api: mockApi
      })

      // Use list hook
      hooks.useTestEntityList()
      expect(mockUseQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: mockQueryKeys.list(undefined)
        })
      )

      // Use create hook and simulate success
      hooks.useCreateTestEntity()
      let mutationConfig = mockUseMutation.mock.calls[mockUseMutation.mock.calls.length - 1][0]
      mutationConfig.onSuccess(mockEntity)
      
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: mockQueryKeys.all
      })
      expect(mockQueryClient.setQueryData).toHaveBeenCalledWith(
        mockQueryKeys.detail(mockEntity.id),
        mockEntity
      )

      // Use update hook and simulate success
      hooks.useUpdateTestEntity()
      mutationConfig = mockUseMutation.mock.calls[mockUseMutation.mock.calls.length - 1][0]
      const updateVariables = { id: mockEntity.id, data: mockUpdateData }
      mutationConfig.onSuccess(mockEntity, updateVariables)
      
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: mockQueryKeys.list()
      })

      // Use delete hook and simulate success
      hooks.useDeleteTestEntity()
      mutationConfig = mockUseMutation.mock.calls[mockUseMutation.mock.calls.length - 1][0]
      mutationConfig.onSuccess(true, mockEntity.id)
      
      expect(mockQueryClient.removeQueries).toHaveBeenCalledWith({
        queryKey: mockQueryKeys.detail(mockEntity.id)
      })
    })

    test('Error handling works across all hooks', () => {
      const hooks = createCrudHooks<TestEntity, TestCreate, TestUpdate>({
        entityName: 'TestEntity',
        queryKeys: mockQueryKeys,
        api: mockApi
      })

      // Test create error
      hooks.useCreateTestEntity()
      let mutationConfig = mockUseMutation.mock.calls[mockUseMutation.mock.calls.length - 1][0]
      mutationConfig.onError(mockApiError)
      expect(mockToast.error).toHaveBeenCalledWith(mockApiError.message)

      // Test update error
      hooks.useUpdateTestEntity()
      mutationConfig = mockUseMutation.mock.calls[mockUseMutation.mock.calls.length - 1][0]
      mutationConfig.onError(mockApiError)
      expect(mockToast.error).toHaveBeenCalledWith(mockApiError.message)

      // Test delete error
      hooks.useDeleteTestEntity()
      mutationConfig = mockUseMutation.mock.calls[mockUseMutation.mock.calls.length - 1][0]
      mutationConfig.onError(mockApiError)
      expect(mockToast.error).toHaveBeenCalledWith(mockApiError.message)
    })

    test('Query key factory patterns work correctly', () => {
      const hooks = createCrudHooks<TestEntity, TestCreate, TestUpdate>({
        entityName: 'TestEntity',
        queryKeys: mockQueryKeys,
        api: mockApi
      })

      // Test list with different parameters
      const params1 = { page: 1 }
      const params2 = { page: 2, filter: 'active' }
      
      hooks.useTestEntityList(params1)
      hooks.useTestEntityList(params2)
      
      expect(mockUseQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: mockQueryKeys.list(params1)
        })
      )
      expect(mockUseQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: mockQueryKeys.list(params2)
        })
      )

      // Test detail with different IDs
      hooks.useTestEntity(1)
      hooks.useTestEntity(2)
      
      expect(mockUseQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: mockQueryKeys.detail(1)
        })
      )
      expect(mockUseQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: mockQueryKeys.detail(2)
        })
      )
    })
  })

  describe('Edge cases and robustness', () => {
    test('handles void params for createQueryHook', () => {
      const keyFn = () => ['test'] as const
      const queryFn = jest.fn().mockResolvedValue('data')
      
      const useTestQuery = createQueryHook<string, void>(keyFn, queryFn)
      
      useTestQuery(undefined)
      
      expect(mockUseQuery).toHaveBeenCalledWith({
        queryKey: ['test'],
        queryFn: expect.any(Function),
        staleTime: 5 * 60 * 1000,
        enabled: true
      })
    })

    test('handles complex entity types', () => {
      interface ComplexEntity {
        id: number
        nested: {
          prop: string
          array: number[]
        }
        optional?: string
      }

      const complexQueryKeys = {
        all: ['complex'] as const,
        list: (params?: any) => ['complex', 'list', params] as const,
        detail: (id: number) => ['complex', 'detail', id] as const
      }

      const complexApi = {
        list: jest.fn(),
        get: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
      }

      const hooks = createCrudHooks<ComplexEntity>({
        entityName: 'Complex',
        queryKeys: complexQueryKeys,
        api: complexApi
      })

      expect(hooks).toHaveProperty('useComplexList')
      expect(hooks).toHaveProperty('useComplex')
      expect(hooks).toHaveProperty('useCreateComplex')
      expect(hooks).toHaveProperty('useUpdateComplex')
      expect(hooks).toHaveProperty('useDeleteComplex')
      expect(hooks).toHaveProperty('useInvalidateComplex')
    })

    test('handles empty and null contexts in optimistic mutations', () => {
      const testMutationFn = jest.fn().mockResolvedValue(mockEntity)
      const testOptimisticUpdate = jest.fn().mockImplementation((old, variables) => ({
        ...old,
        ...variables.data
      }))
      
      const useOptimisticMutation = createOptimisticMutation({
        mutationFn: testMutationFn,
        queryKey: (variables: any) => ['optimistic', variables.id] as const,
        optimisticUpdate: testOptimisticUpdate
      })
      
      useOptimisticMutation()
      
      const mutationConfig = mockUseMutation.mock.calls[0][0]
      
      // Test with null context
      mutationConfig.onError(mockApiError, 'variables', null)
      expect(mockToast.error).toHaveBeenCalledWith(mockApiError.message)
      
      // Test with undefined context
      mutationConfig.onError(mockApiError, 'variables', undefined)
      expect(mockToast.error).toHaveBeenCalledWith(mockApiError.message)
      
      // Test onSettled with null context
      mutationConfig.onSettled(null, null, null, null)
      // Should not crash or call invalidateQueries
    })

    test('handles partial objects in mutation options', () => {
      const hooks = createCrudHooks<TestEntity, TestCreate, TestUpdate>({
        entityName: 'TestEntity',
        queryKeys: mockQueryKeys,
        api: mockApi
      })

      // Test with partial mutation options
      const partialOptions = {
        onSuccess: jest.fn(),
        // onError intentionally omitted
        retry: 3
      }
      
      hooks.useCreateTestEntity(partialOptions)
      
      expect(mockUseMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          mutationFn: mockApi.create,
          onSuccess: expect.any(Function),
          onError: expect.any(Function),
          retry: 3
        })
      )
    })

    test('optimistic mutation handles getQueryData returning undefined', () => {
      const testMutationFn = jest.fn().mockResolvedValue(mockEntity)
      const testOptimisticUpdate = jest.fn().mockImplementation((old, variables) => ({
        ...old,
        ...variables.data
      }))
      
      const useOptimisticMutation = createOptimisticMutation({
        mutationFn: testMutationFn,
        queryKey: (variables: any) => ['optimistic', variables.id] as const,
        optimisticUpdate: testOptimisticUpdate
      })
      
      useOptimisticMutation()
      
      const mutationConfig = mockUseMutation.mock.calls[0][0]
      const variables = { id: 1, data: { name: 'Optimistic' } }
      
      // Mock getQueryData to return undefined
      mockQueryClient.getQueryData.mockReturnValue(undefined)
      
      const context = mutationConfig.onMutate(variables)
      
      expect(context).resolves.toEqual({
        previousData: undefined,
        queryKey: ['optimistic', 1]
      })
    })

    test('handles boolean return types correctly', () => {
      const hooks = createCrudHooks<TestEntity, TestCreate, TestUpdate>({
        entityName: 'TestEntity',
        queryKeys: mockQueryKeys,
        api: mockApi
      })

      hooks.useDeleteTestEntity()
      const mutationConfig = mockUseMutation.mock.calls[mockUseMutation.mock.calls.length - 1][0]
      
      // Test successful delete returning true
      mutationConfig.onSuccess(true, 123)
      expect(mockToast.success).toHaveBeenCalledWith('TestEntity deleted successfully')
      
      // Test failed delete returning false (edge case)
      mutationConfig.onSuccess(false, 123)
      expect(mockToast.success).toHaveBeenCalledWith('TestEntity deleted successfully')
    })

    test('handles missing error properties gracefully', () => {
      const hooks = createCrudHooks<TestEntity, TestCreate, TestUpdate>({
        entityName: 'TestEntity',
        queryKeys: mockQueryKeys,
        api: mockApi
      })

      hooks.useCreateTestEntity()
      const mutationConfig = mockUseMutation.mock.calls[mockUseMutation.mock.calls.length - 1][0]
      
      // Test with error object that has no message property
      const errorWithoutMessage = { status: 500 }
      mutationConfig.onError(errorWithoutMessage)
      expect(mockToast.error).toHaveBeenCalledWith('Failed to create TestEntity')
      
      // Test with null error - protect against accessing properties on null
      const nullError = null as any
      mutationConfig.onError(nullError)
      expect(mockToast.error).toHaveBeenCalledWith('Failed to create TestEntity')
    })

    test('verifies all CRUD hook return types', () => {
      const hooks = createCrudHooks<TestEntity, TestCreate, TestUpdate>({
        entityName: 'TestEntity',
        queryKeys: mockQueryKeys,
        api: mockApi
      })

      // Test that all hooks are functions and return objects from their respective React Query hooks
      mockUseQuery.mockReturnValue({ data: [], isLoading: false })
      mockUseMutation.mockReturnValue({ mutate: jest.fn(), isLoading: false })
      
      const listResult = hooks.useTestEntityList()
      const getResult = hooks.useTestEntity(1)
      const createResult = hooks.useCreateTestEntity()
      const updateResult = hooks.useUpdateTestEntity()
      const deleteResult = hooks.useDeleteTestEntity()
      const invalidateResult = hooks.useInvalidateTestEntity()
      
      expect(listResult).toEqual({ data: [], isLoading: false })
      expect(getResult).toEqual({ data: [], isLoading: false })
      expect(createResult).toEqual({ mutate: expect.any(Function), isLoading: false })
      expect(updateResult).toEqual({ mutate: expect.any(Function), isLoading: false })
      expect(deleteResult).toEqual({ mutate: expect.any(Function), isLoading: false })
      expect(invalidateResult).toHaveProperty('invalidateAll')
    })
  })
})