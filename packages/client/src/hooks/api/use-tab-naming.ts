import { useMutation } from '@tanstack/react-query'
import { useApiClient } from './use-api-client'
import { toast } from 'sonner'

export interface TabNameGenerationRequest {
  projectName: string
  selectedFiles?: string[]
  context?: string
}

export function useGenerateTabName() {
  const client = useApiClient()

  return useMutation({
    mutationFn: async (params: TabNameGenerationRequest) => {
      // Client null check removed - handled by React Query
      // Since we're using AI generation, we'll call the gen-ai endpoint directly
      const response = await client.genAi.generateStructured({
        schemaKey: 'tabNaming',
        userInput: `Project Name: ${params.projectName}, Selected Files: ${params.selectedFiles?.join(', ') || 'None'}, Context: ${params.context || 'General project work'}`
      })

      if (!response.success || !response.data?.output?.tabName) {
        throw new Error('Failed to generate tab name')
      }

      return response.data.output.tabName
    },
    onError: (error) => {
      console.error('Failed to generate tab name:', error)
      toast.error('Failed to generate tab name')
    }
  })
}
