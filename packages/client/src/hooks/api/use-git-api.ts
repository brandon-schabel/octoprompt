import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../octo-client'

import type { GitStatusResult } from '@octoprompt/schemas'

export function useProjectGitStatus(projectId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: ['projects', projectId, 'git', 'status'],
    queryFn: async () => {
      if (!projectId) {
        throw new Error('Project ID is required')
      }
      const response = await apiClient.git.getProjectGitStatus(projectId)
      if (!response.success || !response.data) {
        throw new Error(response.message || 'Failed to fetch git status')
      }
      return response.data
    },
    enabled: enabled && !!projectId,
    refetchInterval: 5000, // Refetch every 5 seconds to keep status updated
    staleTime: 4000, // Consider data stale after 4 seconds
  })
}

export function useGitFilesWithChanges(projectId: number | undefined) {
  const { data: gitStatus } = useProjectGitStatus(projectId)

  if (!gitStatus || !gitStatus.success) {
    return []
  }

  return gitStatus.data.files.filter(file =>
    file.status !== 'unchanged' && file.status !== 'ignored'
  )
}