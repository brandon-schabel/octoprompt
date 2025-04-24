import { useActiveProjectTab } from '@/hooks/api/global-state/selectors'
import { useUpdateProjectTab, useDeleteProjectTab } from '@/hooks/api/global-state/updaters'

export function useProjectTabActions() {
  const { id: activeTabId, tabData: activeProjectTabData } = useActiveProjectTab()
  const updateProjectTab = useUpdateProjectTab()
  const deleteProjectTab = useDeleteProjectTab()

  function renameTab(newName: string) {
    if (activeTabId) {
      updateProjectTab(activeTabId, { displayName: newName })
    }
  }

  function deleteTab() {
    if (activeTabId) {
      deleteProjectTab(activeTabId)
    }
  }

  return { activeTabId, activeProjectTabData, renameTab, deleteTab }
} 