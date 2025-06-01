import { useMutation, useQuery } from '@tanstack/react-query'
import { octoClient } from '../api'
import type {
  AiGenerateTextRequest,
  AiGenerateStructuredRequest
} from '@octoprompt/schemas'
import { toast } from 'sonner'

// Query Keys
const GEN_AI_KEYS = {
  all: ['genAi'] as const,
  models: (provider: string) => [...GEN_AI_KEYS.all, 'models', provider] as const
}

// Simplified hook for generating text
export const useGenerateText = () => {
  return useMutation({
    mutationFn: (data: AiGenerateTextRequest) => octoClient.genAi.generateText(data),
    onError: (error) => {
      toast.error(error.message || 'Failed to generate text')
    }
  })
}

// Hook for generating structured data
export const useGenerateStructuredData = () => {
  return useMutation({
    mutationFn: (data: AiGenerateStructuredRequest) => octoClient.genAi.generateStructured(data),
    onError: (error) => {
      toast.error(error.message || 'Failed to generate structured data')
    }
  })
}

// Hook for streaming text generation
export const useStreamText = () => {
  return useMutation({
    mutationFn: (data: AiGenerateTextRequest) => octoClient.genAi.streamText(data),
    onError: (error) => {
      toast.error(error.message || 'Failed to start text stream')
    }
  })
}

// Hook for getting available models
export const useGetModels = (provider: string) => {
  return useQuery({
    queryKey: GEN_AI_KEYS.models(provider),
    queryFn: () => octoClient.genAi.getModels(provider),
    enabled: !!provider,
    staleTime: 10 * 60 * 1000 // 10 minutes - models don't change frequently
  })
}
