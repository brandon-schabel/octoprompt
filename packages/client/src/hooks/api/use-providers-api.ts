import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApiClient } from './use-api-client'
import type {
  CreateProviderKeyBody,
  UpdateProviderKeyBody,
  ProviderKey,
  TestProviderRequest,
  BatchTestProviderRequest,
  ProviderHealthStatus
} from '@promptliano/schemas'
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
  // Client null check removed - handled by React Query
  return useQuery({
    queryKey: providerKeys.list(),
    enabled: !!client,
    queryFn: () => client.keys.listKeys(),
    staleTime: 5 * 60 * 1000 // 5 minutes
  })
}

// Get single provider key
export function useGetProviderKey(keyId: number | null) {
  const client = useApiClient()
  // Client null check removed - handled by React Query
  return useQuery({
    queryKey: providerKeys.detail(keyId!),
    queryFn: () => client.keys.getKey(keyId!),
    enabled: !!client && !!keyId,
    staleTime: 5 * 60 * 1000
  })
}

// Get providers health status
export function useGetProvidersHealth(refresh = false) {
  const client = useApiClient()
  // Client null check removed - handled by React Query
  return useQuery({
    queryKey: providerKeys.health(),
    enabled: !!client,
    queryFn: () => client.keys.getProvidersHealth(refresh),
    staleTime: refresh ? 0 : 2 * 60 * 1000 // 2 minutes if not refreshing
  })
}

// Create provider key
export function useCreateProviderKey() {
  const queryClient = useQueryClient()
  const client = useApiClient()

  return useMutation({
    mutationFn: (data: CreateProviderKeyBody) => client!.keys.createKey(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: providerKeys.all })
      toast.success('Provider key created successfully')
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to create provider key')
    }
  })
}

// Update provider key
export function useUpdateProviderKey() {
  const queryClient = useQueryClient()
  const client = useApiClient()
  // Client null check removed - handled by React Query

  return useMutation({
    mutationFn: ({ keyId, data }: { keyId: number; data: UpdateProviderKeyBody }) => client.keys.updateKey(keyId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: providerKeys.all })
      toast.success('Provider key updated successfully')
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to update provider key')
    }
  })
}

// Delete provider key
export function useDeleteProviderKey() {
  const queryClient = useQueryClient()
  const client = useApiClient()

  return useMutation({
    mutationFn: (keyId: number) => client!.keys.deleteKey(keyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: providerKeys.all })
      toast.success('Provider key deleted successfully')
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to delete provider key')
    }
  })
}

// Test single provider
export function useTestProvider() {
  const queryClient = useQueryClient()
  const client = useApiClient()

  return useMutation({
    mutationFn: (data: TestProviderRequest) => client!.keys.testProvider(data),
    onSuccess: (response) => {
      if (response.data.success) {
        toast.success(`Provider connected successfully`)
        queryClient.invalidateQueries({ queryKey: providerKeys.health() })
      } else {
        toast.error(`Provider test failed: ${response.data.error}`)
      }
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to test provider')
    }
  })
}

// Batch test providers
export function useBatchTestProviders() {
  const queryClient = useQueryClient()
  const client = useApiClient()

  return useMutation({
    mutationFn: (data: BatchTestProviderRequest) => client!.keys.batchTestProviders(data),
    onSuccess: (response) => {
      const results = response.data.results
      const successCount = results.filter((r) => r.success).length
      const failCount = results.filter((r) => !r.success).length

      if (successCount > 0 && failCount === 0) {
        toast.success(`All ${successCount} providers tested successfully`)
      } else if (successCount > 0 && failCount > 0) {
        toast.warning(`${successCount} providers connected, ${failCount} failed`)
      } else {
        toast.error(`All ${failCount} provider tests failed`)
      }

      queryClient.invalidateQueries({ queryKey: providerKeys.health() })
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to test providers')
    }
  })
}
