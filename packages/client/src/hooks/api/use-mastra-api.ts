// 5 Most Recent Changes:
// 1. Initial creation of Mastra API hooks file
// 2. Added re-exports for Mastra mutation hooks
// 3. Added type exports for Mastra request/response types
// 4. Added octoClient export for direct access
// 5. Extended with new Mastra services (prompt optimization, task generation, file suggestions)

import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { octoClient } from '../api-hooks'

// Re-export existing Mastra hooks from main api-hooks file
export {
  useMastraCodeChange,
  useMastraBatchSummarize,
  useMastraSummarizeFile,
  octoClient
} from '../api-hooks'

// New Mastra hooks for additional services

export function useMastraOptimizePrompt() {
  return useMutation({
    mutationFn: (data: {
      prompt: string
      optimizationGoals?: string[]
      context?: string
    }) => octoClient.fetch('/api/mastra/optimize-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(res => res.json()),
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Prompt optimized successfully!')
      } else {
        toast.error('Failed to optimize prompt')
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to optimize prompt')
    }
  })
}

export function useMastraGenerateTasks() {
  return useMutation({
    mutationFn: (data: {
      ticketId: number
      userContext?: string
    }) => octoClient.fetch('/api/mastra/generate-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(res => res.json()),
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`Generated ${data.data.tasks.length} tasks successfully!`)
      } else {
        toast.error('Failed to generate tasks')
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to generate tasks')
    }
  })
}

export function useMastraSuggestFiles() {
  return useMutation({
    mutationFn: (data: {
      ticketId: number
      maxSuggestions?: number
    }) => octoClient.fetch('/api/mastra/suggest-files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(res => res.json()),
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`Suggested ${data.data.recommendedFileIds.length} relevant files!`)
      } else {
        toast.error('Failed to suggest files')
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to suggest files')
    }
  })
}

// Re-export Mastra types for convenience
export type {
  MastraCodeChangeRequest,
  MastraCodeChangeResponse,
  MastraSummarizeRequest,
  MastraSummarizeResponse,
  MastraSingleSummarizeRequest,
  MastraSingleSummarizeResponse
} from '@octoprompt/schemas'
