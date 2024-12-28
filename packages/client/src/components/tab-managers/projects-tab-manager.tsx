import { useGlobalStateContext } from '../global-state-context'
import { GenericTabManager } from './generic-tab-manager'

export function ProjectsTabManager() {
  const {
    state,
    wsReady,
    createProjectTab,
    setActiveProjectTab,
    updateProjectTab,
    deleteProjectTab,
  } = useGlobalStateContext()

  const tabs = state?.projectTabs ?? {}
  const activeTabId = state?.projectActiveTabId ?? null

  return (
    <GenericTabManager
      tabs={tabs}
      activeTabId={activeTabId}
      isReady={wsReady}
      onCreateTab={createProjectTab}
      onSetActiveTab={setActiveProjectTab}
      onRenameTab={(tabId, newName) => updateProjectTab(tabId, { displayName: newName })}
      onDeleteTab={deleteProjectTab}
      hotkeyPrefix="t"
      newTabLabel="New Project Tab"
      emptyMessage="No project tabs yet."
    />
  )
}