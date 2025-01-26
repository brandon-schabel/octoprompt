import {
  useGlobalStateCore,
  useCreateProjectTab,
  useSetActiveProjectTab,
  useUpdateProjectTab,
  useDeleteProjectTab,
  useUpdateSettings,
} from '@/components/global-state/global-helper-hooks'
import { GenericTabManager } from './generic-tab-manager'
import { ShortcutDisplay } from '../app-shortcut-display'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { Pencil, Trash2 } from 'lucide-react'
import { type ReactNode } from 'react'
import { useActiveProjectTab, useProjectTabs, useSettings } from '../global-state/global-websocket-selectors'

type DialogContentProps = {
  tabId: string;
  isEditing: boolean;
  displayName: string;
  dialogEditingName: string;
  setDialogEditingName: (name: string) => void;
  startDialogRename: (tabId: string) => void;
  saveDialogRename: () => void;
  onDeleteTab: (tabId: string) => void;
}

type ProjectTab = {
  selectedFiles: string[];
  selectedPrompts: string[];
  userPrompt?: string;
  displayName?: string;
}

export function ProjectsTabManager() {
  const createProjectTab = useCreateProjectTab()
  const setActiveProjectTab = useSetActiveProjectTab()
  const updateProjectTab = useUpdateProjectTab()
  const deleteProjectTab = useDeleteProjectTab()
  const updateSettings = useUpdateSettings()
  const { tabData: activeProjectTabState } = useActiveProjectTab()
  const settings = useSettings()

  const projectId = activeProjectTabState?.selectedProjectId

  const tabs = useProjectTabs()
  const activeTabId = state?.projectActiveTabId ?? null

  const tabOrder = settings?.projectTabIdOrder
    ? settings.projectTabIdOrder
    : Object.keys(tabs)

  // When user reorders the tabs, store that array in global state:
  const handleTabOrderChange = (newOrder: string[]) => {
    if (activeTabId) {
      updateSettings({
        projectTabIdOrder: newOrder
      })
    }
  }

  // Function to get stats for a project tab
  function getTabStats(tabId: string) {
    const tabData = tabs[tabId] ?? {}
    const fileCount = tabData.selectedFiles?.length ?? 0
    const promptCount = tabData.selectedPrompts?.length ?? 0
    const userPromptLength = tabData.userPrompt?.length ?? 0

    return `Files: ${fileCount} | Prompts: ${promptCount} | User Input: ${userPromptLength}`
  }

  const renderDialogContent = ({
    tabId,
    isEditing,
    displayName,
    dialogEditingName,
    setDialogEditingName,
    startDialogRename,
    saveDialogRename,
    onDeleteTab,
  }: DialogContentProps): ReactNode => {
    return (
      <div
        key={tabId}
        className="group flex items-center justify-between gap-3 px-2 py-1 rounded hover:bg-accent/20"
      >
        {/* Left side: name and stats */}
        <div className="flex flex-col truncate">
          {isEditing ? (
            <Input
              value={dialogEditingName}
              onChange={(e) => setDialogEditingName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveDialogRename()
                if (e.key === 'Escape') {
                  setDialogEditingName('')
                }
              }}
              autoFocus
            />
          ) : (
            <span className="truncate font-medium">
              {displayName}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {getTabStats(tabId)}
          </span>
        </div>

        {/* Right side: rename/delete icons */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
          {isEditing ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={saveDialogRename}
              title="Save"
            >
              <Pencil className="h-3 w-3" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => startDialogRename(tabId)}
              title="Rename"
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300"
            onClick={() => onDeleteTab(tabId)}
            title="Delete"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    )
  }

  const shortcutInfo = (
    <ul>
      <li>Navigate between tabs:</li>
      <li>- Next tab: <ShortcutDisplay shortcut={['t', 'tab']} /></li>
      <li>- Previous tab: <ShortcutDisplay shortcut={['t', 'shift', 'tab']} /></li>
      <li>- Quick switch: <ShortcutDisplay shortcut={['t', '[1-9]']} /></li>
    </ul>
  )

  return (
    <GenericTabManager<ProjectTab>
      // @ts-ignore
      tabs={tabs}
      activeTabId={activeTabId}
      onCreateTab={() => createProjectTab({ projectId: projectId ?? '' })}
      onSetActiveTab={setActiveProjectTab}
      onRenameTab={(tabId, newName) => updateProjectTab(tabId, { displayName: newName })}
      onDeleteTab={deleteProjectTab}
      hotkeyPrefix="t"
      newTabLabel="New Project Tab"
      emptyMessage="No project tabs yet."
      className="border-b"
      title="Project Tabs"
      titleTooltip={
        <div className="space-y-2">
          <p>
            Project Tabs keep state and settings within the tabs. So you can either switch between projects,
            or have multiple tabs of one project open for example with different selections. You can click and drag
            the tabs to reorder them.
          </p>
          {shortcutInfo}
        </div>
      }
      tabOrder={tabOrder}
      onTabOrderChange={handleTabOrderChange}
      renderDialogContent={renderDialogContent}
    />
  )
}