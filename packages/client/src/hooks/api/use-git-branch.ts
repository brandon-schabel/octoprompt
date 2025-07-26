import { useProjectGitStatus } from './use-git-api'

export function useGitCurrentBranch(projectId: number | undefined, enabled = true) {
  const { data: gitStatus, isLoading, error } = useProjectGitStatus(projectId, enabled)

  const currentBranch = gitStatus?.success && gitStatus.data ? gitStatus.data.current : null

  return {
    branch: currentBranch,
    isLoading,
    error
  }
}
