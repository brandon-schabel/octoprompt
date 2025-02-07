import { useActiveProjectTab } from '@/zustand/selectors'
import { useUpdateProjectTab, useDeleteProjectTab } from '@/zustand/updaters'

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