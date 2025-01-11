
import { useGlobalStateHelpers } from '../use-global-state-helpers'
import { GenericTabManager } from './generic-tab-manager'

export function ProjectsTabManager() {
  const {
    state,
    isOpen,
    createProjectTab,
    setActiveProjectTab,
    updateProjectTab,
    deleteProjectTab,
  } = useGlobalStateHelpers()

  const tabs = state?.projectTabs ?? {}
  const activeTabId = state?.projectActiveTabId ?? null

  return (
    <GenericTabManager
      tabs={tabs}
      activeTabId={activeTabId}
      isReady={isOpen}
      onCreateTab={createProjectTab}
      onSetActiveTab={setActiveProjectTab}
      onRenameTab={(tabId, newName) => updateProjectTab(tabId, { displayName: newName })}
      onDeleteTab={deleteProjectTab}
      hotkeyPrefix="t"
      newTabLabel="New Project Tab"
      emptyMessage="No project tabs yet."
      className='border-b'
    />
  )
}