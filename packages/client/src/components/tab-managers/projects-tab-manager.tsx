import { useGlobalStateHelpers } from '../global-state/use-global-state-helpers'
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
      title="Project Tabs"
      titleTooltip="Project Tabs keep state and settings within the tabs. So you can either switch between projects, or have multiple tabs of one project open for example with different selections."
    />
  )
}