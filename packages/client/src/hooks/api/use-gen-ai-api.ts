import { useMutation, useQuery } from '@tanstack/react-query'
import { promptlianoClient } from '../promptliano-client'
import type { AiGenerateTextRequest, AiGenerateStructuredRequest } from '@promptliano/schemas'
import { toast } from 'sonner'

// Query Keys
const GEN_AI_KEYS = {
  all: ['genAi'] as const,
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
  return useMutation({
    mutationFn: (data: AiGenerateTextRequest) => promptlianoClient.genAi.generateText(data),
    onError: (error) => {
      toast.error(error.message || 'Failed to generate text')
    }
  })
}

// Hook for generating structured data
export const useGenerateStructuredData = () => {
  return useMutation({
    mutationFn: (data: AiGenerateStructuredRequest) => promptlianoClient.genAi.generateStructured(data),
    onError: (error) => {
      toast.error(error.message || 'Failed to generate structured data')
    }
  })
}

// Hook for streaming text generation
export const useStreamText = () => {
  return useMutation({
    mutationFn: (data: AiGenerateTextRequest) => promptlianoClient.genAi.streamText(data),
    onError: (error) => {
      toast.error(error.message || 'Failed to start text stream')
    }
  })
}

// Hook for getting available models
export const useGetModels = (provider: string, options?: { ollamaUrl?: string; lmstudioUrl?: string }) => {
  return useQuery({
    queryKey: GEN_AI_KEYS.models(provider, options),
    queryFn: () => promptlianoClient.genAi.getModels(provider, options),
    enabled: !!provider,
    staleTime: 10 * 60 * 1000 // 10 minutes - models don't change frequently
  })
}
