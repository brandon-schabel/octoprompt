import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { octoClient } from '../api-hooks'

const MASTRA_FILE_EDIT_KEYS = {
  all: ['mastraFileEdit'] as const,
}

// Updated to use Mastra file editing instead of old AI file changes
export function useGenerateFileChange() {
  return useMutation({
    mutationFn: async (data: { projectId: number; fileId: number; prompt: string }) => {
      // Use the new Mastra file editing endpoint instead of old AI file changes
      return await octoClient.mastra.editFile(data.projectId, data.fileId, data.prompt)
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success('File changes generated successfully using Mastra!')
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to generate file change')
    },
  })
}

// Deprecated - use agent coder functionality instead
export function useGetFileChange(projectId: number | null, changeId: number | null) {
  return useQuery({
    queryKey: ['deprecated', 'fileChange', projectId, changeId],
    queryFn: async () => {
      console.warn('useGetFileChange is deprecated. Use agent coder functionality instead.')
      return null
    },
    enabled: false, // Disable this deprecated functionality
  })
}

// Deprecated - use agent coder functionality instead  
export function useConfirmFileChange() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ projectId, changeId }: { projectId: number; changeId: number }) => {
      console.warn('useConfirmFileChange is deprecated. Use agent coder functionality instead.')
      return { success: true }
    },
    onSuccess: () => {
      toast.info('This functionality has been replaced by the Agent Coder. Please use that instead.')
    },
    onError: (error) => {
      toast.error(error.message || 'This functionality is deprecated')
    },
  })
}
