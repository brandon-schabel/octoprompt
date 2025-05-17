import { useMemo } from 'react'
import { useActiveProjectTab } from './api/use-kv-api'
import { useGetProjectFiles } from './api/use-projects-api'
import { buildFileTree } from 'shared/src/utils/projects-utils'

export const useProjectFileTree = () => {
  const [activeProjectTabState] = useActiveProjectTab()
  const projectId = activeProjectTabState?.selectedProjectId
  const { data: projectFiles } = useGetProjectFiles(projectId ?? '')
  const fileTree = useMemo(() => buildFileTree(projectFiles?.data ?? []), [projectFiles])
  return fileTree
}
