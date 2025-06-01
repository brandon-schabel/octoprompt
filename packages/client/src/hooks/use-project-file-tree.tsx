import { useMemo } from 'react'
import { useActiveProjectTab } from './use-kv-local-storage'
import { useGetProjectFiles } from './api/use-projects-api'
import { buildFileTree } from '@octoprompt/shared'

export const useProjectFileTree = () => {
  const [activeProjectTabState] = useActiveProjectTab()
  const projectId = activeProjectTabState?.selectedProjectId
  const { data: projectFiles } = useGetProjectFiles(projectId ?? -1)
  const fileTree = useMemo(() => buildFileTree(projectFiles?.data ?? []), [projectFiles])
  return fileTree
}
