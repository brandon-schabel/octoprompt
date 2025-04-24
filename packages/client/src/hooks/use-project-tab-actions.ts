import { useUpdateProjectTab, useDeleteProjectTab } from '@/hooks/api/global-state/updaters'
import { useActiveProjectTab } from './api/use-state-api'

export function useProjectTabActions() {
  const [activeProjectTabData, , activeTabId] = useActiveProjectTab()
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