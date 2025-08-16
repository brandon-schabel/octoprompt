import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApiClient } from './use-api-client'
import type {
  CreateProviderKeyBody,
  UpdateProviderKeyBody,
  ProviderKey,
  TestProviderRequest,
  TestProviderResponse,
  BatchTestProviderRequest,
  BatchTestProviderResponse,
  ProviderHealthStatus
} from '@promptliano/schemas'
import type { DataResponseSchema } from '@promptliano/api-client'
import { toast } from 'sonner'

// Query keys
export const providerKeys = {
  all: ['providers'] as const,
  lists: () => [...providerKeys.all, 'list'] as const,
  list: () => [...providerKeys.lists()] as const,
  details: () => [...providerKeys.all, 'detail'] as const,
  detail: (id: number) => [...providerKeys.details(), id] as const,
  health: () => [...providerKeys.all, 'health'] as const,
  test: () => [...providerKeys.all, 'test'] as const
}

// Get all provider keys
export function useGetProviderKeys() {
  const client = useApiClient()
  
  return useQuery({
    queryKey: providerKeys.list(),
    enabled: !!client,
    queryFn: async (): Promise<DataResponseSchema<ProviderKey[]>> => {
      if (!client) {
        throw new Error('API client not connected. Please check your connection to the Promptliano server.')
      }
      return client.keys.listKeys()
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount: number, error: Error) => {
      // Don't retry if client is null/disconnected
      if (error.message.includes('not connected')) {
        return false
      }
      return failureCount < 3
    }
  })
}

// Get single provider key
export function useGetProviderKey(keyId: number | null) {
  const client = useApiClient()
  
  return useQuery({
    queryKey: providerKeys.detail(keyId!),
    queryFn: async (): Promise<DataResponseSchema<ProviderKey>> => {
      if (!client) {
        throw new Error('API client not connected. Please check your connection to the Promptliano server.')
      }
      if (!keyId) {
        throw new Error('Provider key ID is required')
      }
      return client.keys.getKey(keyId)
    },
    enabled: !!client && !!keyId,
    staleTime: 5 * 60 * 1000,
    retry: (failureCount: number, error: Error) => {
      // Don't retry if client is null/disconnected or key ID is invalid
      if (error.message.includes('not connected') || error.message.includes('is required')) {
        return false
      }
      return failureCount < 3
    }
  })
}

// Get providers health status
export function useGetProvidersHealth(refresh = false) {
  const client = useApiClient()
  
  return useQuery({
    queryKey: providerKeys.health(),
    enabled: !!client,
    queryFn: async (): Promise<DataResponseSchema<ProviderHealthStatus[]>> => {
      if (!client) {
        throw new Error('API client not connected. Please check your connection to the Promptliano server.')
      }
      return client.keys.getProvidersHealth(refresh)
    },
    staleTime: refresh ? 0 : 2 * 60 * 1000, // 2 minutes if not refreshing
    retry: (failureCount: number, error: Error) => {
      // Don't retry if client is null/disconnected
      if (error.message.includes('not connected')) {
        return false
      }
      return failureCount < 3
    }
  })
}

// Create provider key
export function useCreateProviderKey() {
  const queryClient = useQueryClient()
  const client = useApiClient()

  return useMutation({
    mutationFn: async (data: CreateProviderKeyBody): Promise<DataResponseSchema<ProviderKey>> => {
      if (!client) {
        throw new Error('API client not connected. Please check your connection to the Promptliano server.')
      }
      return client.keys.createKey(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: providerKeys.all })
      toast.success('Provider key created successfully')
    },
    onError: (error: Error) => {
      const message = error?.message || 'Failed to create provider key'
      toast.error(message)
    }
  })
}

// Update provider key
export function useUpdateProviderKey() {
  const queryClient = useQueryClient()
  const client = useApiClient()

  return useMutation({
    mutationFn: async ({ keyId, data }: { keyId: number; data: UpdateProviderKeyBody }): Promise<DataResponseSchema<ProviderKey>> => {
      if (!client) {
        throw new Error('API client not connected. Please check your connection to the Promptliano server.')
      }
      return client.keys.updateKey(keyId, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: providerKeys.all })
      toast.success('Provider key updated successfully')
    },
    onError: (error: Error) => {
      const message = error?.message || 'Failed to update provider key'
      toast.error(message)
    }
  })
}

// Delete provider key
export function useDeleteProviderKey() {
  const queryClient = useQueryClient()
  const client = useApiClient()

  return useMutation({
    mutationFn: async (keyId: number): Promise<boolean> => {
      if (!client) {
        throw new Error('API client not connected. Please check your connection to the Promptliano server.')
      }
      return client.keys.deleteKey(keyId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: providerKeys.all })
      toast.success('Provider key deleted successfully')
    },
    onError: (error: Error) => {
      const message = error?.message || 'Failed to delete provider key'
      toast.error(message)
    }
  })
}

// Type guard for test provider response
const isValidTestProviderResponse = (response: unknown): response is DataResponseSchema<TestProviderResponse> => {
  if (typeof response !== 'object' || response === null) {
    return false
  }
  
  const responseObj = response as Record<string, unknown>
  
  return (
    'data' in responseObj &&
    typeof responseObj.data === 'object' &&
    responseObj.data !== null &&
    'success' in responseObj.data &&
    typeof (responseObj.data as Record<string, unknown>).success === 'boolean'
  )
}

// Test single provider
export function useTestProvider() {
  const queryClient = useQueryClient()
  const client = useApiClient()

  return useMutation({
    mutationFn: async (data: TestProviderRequest): Promise<DataResponseSchema<TestProviderResponse>> => {
      if (!client) {
        throw new Error('API client not connected. Please check your connection to the Promptliano server.')
      }
      return client.keys.testProvider(data)
    },
    onSuccess: (response: DataResponseSchema<TestProviderResponse>) => {
      if (!isValidTestProviderResponse(response)) {
        toast.error('Invalid response format from provider test')
        return
      }
      
      const testData = response.data
      if (testData.success) {
        toast.success(`Provider connected successfully`)
        queryClient.invalidateQueries({ queryKey: providerKeys.health() })
      } else {
        toast.error(`Provider test failed: ${testData.error || 'Unknown error'}`)
      }
    },
    onError: (error: Error) => {
      const message = error?.message || 'Failed to test provider'
      toast.error(message)
    }
  })
}

// Type guard for batch test provider response
const isValidBatchTestProviderResponse = (response: unknown): response is DataResponseSchema<BatchTestProviderResponse> => {
  if (typeof response !== 'object' || response === null) {
    return false
  }
  
  const responseObj = response as Record<string, unknown>
  
  return (
    'data' in responseObj &&
    typeof responseObj.data === 'object' &&
    responseObj.data !== null &&
    'results' in responseObj.data &&
    Array.isArray((responseObj.data as Record<string, unknown>).results)
  )
}

// Batch test providers
export function useBatchTestProviders() {
  const queryClient = useQueryClient()
  const client = useApiClient()

  return useMutation({
    mutationFn: async (data: BatchTestProviderRequest): Promise<DataResponseSchema<BatchTestProviderResponse>> => {
      if (!client) {
        throw new Error('API client not connected. Please check your connection to the Promptliano server.')
      }
      return client.keys.batchTestProviders(data)
    },
    onSuccess: (response: DataResponseSchema<BatchTestProviderResponse>) => {
      if (!isValidBatchTestProviderResponse(response)) {
        toast.error('Invalid response format from batch provider test')
        return
      }
      
      const testData = response.data
      const results = testData.results
      const successCount = results.filter((r: TestProviderResponse) => r.success).length
      const failCount = results.filter((r: TestProviderResponse) => !r.success).length

      if (successCount > 0 && failCount === 0) {
        toast.success(`All ${successCount} providers tested successfully`)
      } else if (successCount > 0 && failCount > 0) {
        toast.warning(`${successCount} providers connected, ${failCount} failed`)
      } else {
        toast.error(`All ${failCount} provider tests failed`)
      }

      queryClient.invalidateQueries({ queryKey: providerKeys.health() })
    },
    onError: (error: Error) => {
      const message = error?.message || 'Failed to test providers'
      toast.error(message)
    }
  })
}
