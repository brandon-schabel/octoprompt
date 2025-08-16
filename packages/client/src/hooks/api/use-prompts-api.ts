import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CreatePromptBody, UpdatePromptBody, Prompt, OptimizePromptRequest } from '@promptliano/schemas'
import type { MarkdownImportRequest, MarkdownExportRequest, BatchExportRequest } from '@promptliano/schemas'
import { useApiClient } from './use-api-client'
import { toast } from 'sonner'

// Query keys
const PROMPT_KEYS = {
  all: ['prompts'] as const,
  list: () => [...PROMPT_KEYS.all, 'list'] as const,
  detail: (promptId: number) => [...PROMPT_KEYS.all, 'detail', promptId] as const,
  projectPrompts: (projectId: number) => [...PROMPT_KEYS.all, 'project', projectId] as const
}

// --- Query Hooks ---
export function useGetAllPrompts() {
  const client = useApiClient()

  return useQuery({
    queryKey: PROMPT_KEYS.list(),
    queryFn: () => (client ? client.prompts.listPrompts() : Promise.reject(new Error('Client not connected'))),
    enabled: !!client,
    staleTime: 5 * 60 * 1000
  })
}

export function useGetPrompt(promptId: number) {
  const client = useApiClient()

  return useQuery({
    queryKey: PROMPT_KEYS.detail(promptId),
    queryFn: () => (client ? client.prompts.getPrompt(promptId) : Promise.reject(new Error('Client not connected'))),
    enabled: !!client && !!promptId,
    staleTime: 5 * 60 * 1000
  })
}

export function useGetProjectPrompts(projectId: number) {
  const client = useApiClient()

  return useQuery({
    queryKey: PROMPT_KEYS.projectPrompts(projectId),
    queryFn: async () => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.prompts.getProjectPrompts(projectId)
      return response
    },
    enabled: !!client && !!projectId,
    staleTime: 5 * 60 * 1000
  })
}

// --- Mutation Hooks ---
export function useCreatePrompt() {
  const client = useApiClient()
  const { invalidateAllPrompts } = useInvalidatePrompts()

  return useMutation({
    mutationFn: (data: CreatePromptBody) => {
      if (!client) throw new Error('API client not initialized')
      return client.prompts.createPrompt(data)
    },
    onSuccess: () => {
      invalidateAllPrompts()
      toast.success('Prompt created successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create prompt')
    }
  })
}

export function useUpdatePrompt() {
  const client = useApiClient()
  const { invalidateAllPrompts, setPromptDetail } = useInvalidatePrompts()

  return useMutation({
    mutationFn: ({ promptId, data }: { promptId: number; data: UpdatePromptBody }) => {
      if (!client) throw new Error('API client not initialized')
      return client.prompts.updatePrompt(promptId, data)
    },
    onSuccess: ({ data: updatedPrompt }) => {
      invalidateAllPrompts()
      setPromptDetail(updatedPrompt)
      toast.success('Prompt updated successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update prompt')
    }
  })
}

export function useDeletePrompt() {
  const client = useApiClient()
  const { invalidateAllPrompts, removePrompt } = useInvalidatePrompts()

  return useMutation({
    mutationFn: (promptId: number) => {
      if (!client) throw new Error('API client not initialized')
      return client.prompts.deletePrompt(promptId)
    },
    onSuccess: (_, promptId) => {
      invalidateAllPrompts()
      removePrompt(promptId)
      toast.success('Prompt deleted successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete prompt')
    }
  })
}

export function useAddPromptToProject() {
  const client = useApiClient()
  const { invalidateProjectPrompts } = useInvalidatePrompts()

  return useMutation({
    mutationFn: ({ projectId, promptId }: { projectId: number; promptId: number }) => {
      if (!client) throw new Error('API client not initialized')
      return client.prompts.addPromptToProject(projectId, promptId)
    },
    onSuccess: (_, { projectId }) => {
      invalidateProjectPrompts(projectId)
      toast.success('Prompt added to project')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add prompt to project')
    }
  })
}

export function useRemovePromptFromProject() {
  const client = useApiClient()
  const { invalidateProjectPrompts } = useInvalidatePrompts()

  return useMutation({
    mutationFn: ({ projectId, promptId }: { projectId: number; promptId: number }) => {
      if (!client) throw new Error('API client not initialized')
      return client.prompts.removePromptFromProject(projectId, promptId)
    },
    onSuccess: (_, { projectId }) => {
      invalidateProjectPrompts(projectId)
      toast.success('Prompt removed from project')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to remove prompt from project')
    }
  })
}

// AI-powered optimization
export function useOptimizeUserInput() {
  const client = useApiClient()

  return useMutation({
    mutationFn: async ({ projectId, data }: { projectId: number; data: OptimizePromptRequest }) => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.prompts.optimizeUserInput(projectId, data)
      return response.data
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to optimize input')
    }
  })
}

export function useSuggestPrompts() {
  const client = useApiClient()

  return useMutation({
    mutationFn: async ({ projectId, params }: { projectId: number; params: { userInput: string; limit?: number } }) => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.prompts.suggestPrompts(projectId, params)
      return response.data
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to suggest prompts')
    }
  })
}

// Markdown Import/Export hooks
export function useImportMarkdownPrompts() {
  const client = useApiClient()
  const { invalidateAllPrompts } = useInvalidatePrompts()

  return useMutation({
    mutationFn: async (data: MarkdownImportRequest) => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.markdown.importPrompts(data)
      return response.data
    },
    onSuccess: (data) => {
      invalidateAllPrompts()
      const successCount = data.results.filter((r: any) => r.success).length
      const failedCount = data.results.filter((r: any) => !r.success).length
      
      if (successCount > 0 && failedCount === 0) {
        toast.success(`Successfully imported ${successCount} prompts`)
      } else if (successCount > 0 && failedCount > 0) {
        toast.warning(`Imported ${successCount} prompts, ${failedCount} failed`)
      } else {
        toast.error('Failed to import prompts')
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to import prompts')
    }
  })
}

export function useExportPromptAsMarkdown() {
  const client = useApiClient()

  return useMutation({
    mutationFn: async (promptId: number) => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.markdown.exportPrompt(promptId)
      return response.data
    },
    onSuccess: (data) => {
      // Create a blob and download the file
      const blob = new Blob([data.content], { type: 'text/markdown' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = data.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      
      toast.success('Prompt exported successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to export prompt')
    }
  })
}

export function useExportPromptsAsMarkdown() {
  const client = useApiClient()

  return useMutation({
    mutationFn: async (data: BatchExportRequest) => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.markdown.exportBatch(data)
      return response.data
    },
    onSuccess: (data) => {
      // Create a blob and download the file
      const blob = new Blob([data.content], { type: 'text/markdown' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = data.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      
      toast.success(`Exported ${data.count} prompts successfully`)
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to export prompts')
    }
  })
}

export function useValidateMarkdownFile() {
  const client = useApiClient()

  return useMutation({
    mutationFn: async (content: string) => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.markdown.validateContent(content)
      return response.data
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to validate markdown file')
    }
  })
}

export function useImportProjectMarkdownPrompts() {
  const client = useApiClient()
  const { invalidateProjectPrompts } = useInvalidatePrompts()

  return useMutation({
    mutationFn: async ({ projectId, data }: { projectId: number; data: MarkdownImportRequest }) => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.markdown.importPromptsToProject(projectId, data)
      return response.data
    },
    onSuccess: (data, { projectId }) => {
      invalidateProjectPrompts(projectId)
      const successCount = data.results.filter((r: any) => r.success).length
      const failedCount = data.results.filter((r: any) => !r.success).length
      
      if (successCount > 0 && failedCount === 0) {
        toast.success(`Successfully imported ${successCount} prompts to project`)
      } else if (successCount > 0 && failedCount > 0) {
        toast.warning(`Imported ${successCount} prompts, ${failedCount} failed`)
      } else {
        toast.error('Failed to import prompts to project')
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to import prompts to project')
    }
  })
}

export function useExportProjectPromptsAsMarkdown() {
  const client = useApiClient()

  return useMutation({
    mutationFn: async ({ projectId, data }: { projectId: number; data: MarkdownExportRequest }) => {
      if (!client) throw new Error('API client not initialized')
      const response = await client.markdown.exportProjectPrompts(projectId, data)
      return response.data
    },
    onSuccess: (data) => {
      // Create a blob and download the file
      const blob = new Blob([data.content], { type: 'text/markdown' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = data.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      
      toast.success(`Exported ${data.count} project prompts successfully`)
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to export project prompts')
    }
  })
}

// --- Invalidation Utilities ---
export function useInvalidatePrompts() {
  const queryClient = useQueryClient()

  return {
    // Invalidate all prompt-related queries
    invalidateAllPrompts: () => {
      queryClient.invalidateQueries({ queryKey: PROMPT_KEYS.all })
    },

    // Invalidate prompt list
    invalidatePromptList: () => {
      queryClient.invalidateQueries({ queryKey: PROMPT_KEYS.list() })
    },

    // Invalidate specific prompt detail
    invalidatePrompt: (promptId: number) => {
      queryClient.invalidateQueries({ queryKey: PROMPT_KEYS.detail(promptId) })
    },

    // Invalidate project prompts
    invalidateProjectPrompts: (projectId: number) => {
      queryClient.invalidateQueries({ queryKey: PROMPT_KEYS.projectPrompts(projectId) })
    },

    // Remove prompt from cache completely
    removePrompt: (promptId: number) => {
      queryClient.removeQueries({ queryKey: PROMPT_KEYS.detail(promptId) })
    },

    // Set specific prompt detail in the cache
    setPromptDetail: (prompt: Prompt) => {
      queryClient.setQueryData(PROMPT_KEYS.detail(prompt.id), prompt)
    }
  }
}

// Export query keys for external use
export { PROMPT_KEYS }

// Type exports for backward compatibility
export type CreatePromptInput = CreatePromptBody
export type UpdatePromptInput = UpdatePromptBody