import { useMemo } from 'react'
import { useActiveProjectTab } from './use-kv-local-storage'
import { useGetProjectFilesWithoutContent } from '@/hooks/api/use-projects-api'
import { buildFileTree } from '@promptliano/shared'

export const useProjectFileTree = () => {
  const [activeProjectTabState] = useActiveProjectTab()
  const projectId = activeProjectTabState?.selectedProjectId
  const { data: projectFiles } = useGetProjectFilesWithoutContent(projectId ?? -1)
  const fileTree = useMemo(() => buildFileTree(projectFiles ?? []), [projectFiles])
  return fileTree
}
