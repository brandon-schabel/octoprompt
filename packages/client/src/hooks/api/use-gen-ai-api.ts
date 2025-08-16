import { useMutation, useQuery } from '@tanstack/react-query'
import { useApiClient } from './use-api-client'
import type { AiGenerateTextRequest, AiGenerateStructuredRequest } from '@promptliano/schemas'
import { toast } from 'sonner'

// Query Keys
const GEN_AI_KEYS = {
  all: ['genAi'] as const,
  providers: () => [...GEN_AI_KEYS.all, 'providers'] as const,
  models: (provider: string, options?: { ollamaUrl?: string; lmstudioUrl?: string }) =>
    [
      ...GEN_AI_KEYS.all,
      'models',
      provider,
      options?.ollamaUrl || 'default',
      options?.lmstudioUrl || 'default'
    ] as const
}

// Simplified hook for generating text
export const useGenerateText = () => {
  const client = useApiClient()

  return useMutation({
    mutationFn: (data: AiGenerateTextRequest) => {
      if (!client) throw new Error('API client not initialized')
      return client.genAi.generateText(data)
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to generate text')
    }
  })
}

// Hook for generating structured data with optional timeout
export const useGenerateStructuredData = (options?: { timeout?: number }) => {
  const client = useApiClient()

  return useMutation({
    mutationFn: (data: AiGenerateStructuredRequest) => {
      if (!client) throw new Error('API client not initialized')
      return client.genAi.generateStructured(data)
    },
    onError: (error) => {
      // Check if error is due to timeout
      if (error.message?.includes('abort') || error.message?.includes('timeout')) {
        toast.error('Generation timed out. Try simplifying your request or using a faster model.')
      } else {
        toast.error(error.message || 'Failed to generate structured data')
      }
    }
  })
}

// Hook for streaming text generation
export const useStreamText = () => {
  const client = useApiClient()

  return useMutation({
    mutationFn: (data: AiGenerateTextRequest) => {
      if (!client) throw new Error('API client not initialized')
      return client.genAi.streamText(data)
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to start text stream')
    }
  })
}

// Hook for getting all providers including custom ones
export const useGetProviders = () => {
  const client = useApiClient()

  return useQuery({
    queryKey: GEN_AI_KEYS.providers(),
    queryFn: () => {
      if (!client) throw new Error('API client not initialized')
      return client.genAi.getProviders()
    },
    enabled: !!client,
    staleTime: 5 * 60 * 1000 // 5 minutes - providers change when user adds/removes them
  })
}

// Hook for getting available models
export const useGetModels = (provider: string, options?: { ollamaUrl?: string; lmstudioUrl?: string }) => {
  const client = useApiClient()
  // Client null check removed - handled by React Query

  return useQuery({
    queryKey: GEN_AI_KEYS.models(provider, options),
    queryFn: () => {
      if (!client) throw new Error('API client not initialized')
      return client.genAi.getModels(provider, options)
    },
    enabled: !!client && !!provider,
    staleTime: 10 * 60 * 1000 // 10 minutes - models don't change frequently
  })
}
