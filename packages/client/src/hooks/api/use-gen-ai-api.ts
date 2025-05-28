import { useMutation } from '@tanstack/react-query'
import { octoClient } from '../api'
import type {
  AiGenerateTextRequest,
  AiGenerateStructuredRequest
} from 'shared/src/schemas/gen-ai.schemas'
import { toast } from 'sonner'

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
export const useGetModels = () => {
  return useMutation({
    mutationFn: (provider: string) => octoClient.genAi.getModels(provider),
    onError: (error) => {
      toast.error(error.message || 'Failed to fetch models')
    }
  })
}
