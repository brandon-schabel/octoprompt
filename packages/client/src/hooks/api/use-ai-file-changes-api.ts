import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { octoClient } from '../api'
import type {
  GenerateChangeBody,
  AIFileChangeRecord
} from 'shared/src/schemas/ai-file-change.schemas'

const AI_FILE_CHANGE_KEYS = {
  all: ['aiFileChanges'] as const,
  detail: (projectId: number, changeId: number) => [...AI_FILE_CHANGE_KEYS.all, 'detail', projectId, changeId] as const,
}

export function useGenerateFileChange() {
  return useMutation({
    mutationFn: (data: GenerateChangeBody) =>
      octoClient.aiFileChanges.generateChange(data.projectId, {
        filePath: data.filePath,
        prompt: data.prompt
      }),
    onError: (error) => {
      toast.error(error.message || 'Failed to generate file change')
    },
  })
}

export function useGetFileChange(projectId: number | null, changeId: number | null) {
  return useQuery({
    queryKey: AI_FILE_CHANGE_KEYS.detail(projectId || -1, changeId || -1),
    queryFn: async (): Promise<AIFileChangeRecord | null> => {
      if (!projectId || !changeId) return null
      const result = await octoClient.aiFileChanges.getChange(projectId, changeId)
      return result.fileChange
    },
    enabled: !!projectId && !!changeId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes('404')) {
        return false
      }
      return failureCount < 3
    },
    refetchOnWindowFocus: false
  })
}

export function useConfirmFileChange() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ projectId, changeId }: { projectId: number; changeId: number }) =>
      octoClient.aiFileChanges.confirmChange(projectId, changeId),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: AI_FILE_CHANGE_KEYS.detail(variables.projectId, variables.changeId)
      })
      toast.success('File change confirmed successfully')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to confirm file change')
    },
  })
}
