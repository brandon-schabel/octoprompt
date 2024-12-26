import { useEffect } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { useGetProjects } from '@/hooks/api/use-projects-api'
import { useGlobalStateContext } from './global-state-context'
import { Plus } from 'lucide-react'
import { useHotkeys } from 'react-hotkeys-hook'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Input } from '@/components/ui/input'
import { useState } from 'react'

/**
 * TabManager using shadcn/ui Tabs
 */
export function TabManager() {
  const {
    state,
    activeTabState,
    createNewTab,
    setActiveTab,
    wsReady,
    updateTab,
    deleteTab,
  } = useGlobalStateContext()

  const [editingTabName, setEditingTabName] = useState<{ id: string, name: string } | null>(null)

  const activeTabId = state?.activeTabId
  const tabs = state?.tabs

  // Add hotkeys for selecting tabs with t + number
  useHotkeys('t+1', () => tabIds[0] && setActiveTab(tabIds[0]))
  useHotkeys('t+2', () => tabIds[1] && setActiveTab(tabIds[1]))
  useHotkeys('t+3', () => tabIds[2] && setActiveTab(tabIds[2]))
  useHotkeys('t+4', () => tabIds[3] && setActiveTab(tabIds[3]))
  useHotkeys('t+5', () => tabIds[4] && setActiveTab(tabIds[4]))
  useHotkeys('t+6', () => tabIds[5] && setActiveTab(tabIds[5]))
  useHotkeys('t+7', () => tabIds[6] && setActiveTab(tabIds[6]))
  useHotkeys('t+8', () => tabIds[7] && setActiveTab(tabIds[7]))
  useHotkeys('t+9', () => tabIds[8] && setActiveTab(tabIds[8]))

  // Create a default tab if none exists and WebSocket is ready
  useEffect(() => {
    if (wsReady && tabs && Object.keys(tabs).length === 0) {
      createNewTab({ displayName: "Default Tab" })
    }
  }, [wsReady, tabs, createNewTab])

  // If WebSocket isn't ready, show loading
  if (!wsReady) {
    return <div>Connecting...</div>
  }

  // If no tabs exist yet, show only the new tab button
  if (!tabs || Object.keys(tabs).length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <Button onClick={() => createNewTab({ displayName: getNextNewTabName() })}>
          + New Tab
        </Button>
      </div>
    )
  }

  // We assume each tab is identified by its key in `state.tabs`
  const tabIds = Object.keys(tabs)

  const handleRenameTab = (tabId: string, newName: string) => {
    updateTab(tabId, { displayName: newName })
    setEditingTabName(null)
  }

  const totalTabs = Object.keys(tabs).length
  const nextTabName = `Tab ${totalTabs + 1}`

  const getNextNewTabName = () => {
    // ensure the name is unique
    let newName = nextTabName
    while (Object.values(tabs).some(tab => tab.displayName === newName)) {
      newName = `Tab ${totalTabs + 1}`
    }
    return newName
  }

  return (
    <Tabs
      value={activeTabId ?? ''}
      onValueChange={(val) => setActiveTab(val)}
      className="flex flex-col justify-start  rounded-none "
    >
      <TabsList className='bg-background  justify-start rounded-none'>
        {tabIds.map((tabId, index) => {
          const shortcutNumber = index + 1
          const showShortcut = shortcutNumber <= 9

          return (
            <ContextMenu key={tabId}>
              <ContextMenuTrigger>
                <TabsTrigger value={tabId} className="flex items-center gap-2">
                  {editingTabName?.id === tabId ? (
                    <Input
                      value={editingTabName.name}
                      onChange={(e) => setEditingTabName({ id: tabId, name: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleRenameTab(tabId, editingTabName.name)
                        }
                        if (e.key === 'Escape') {
                          setEditingTabName(null)
                        }
                      }}
                      onBlur={() => handleRenameTab(tabId, editingTabName.name)}
                      className="h-6 w-24"
                      autoFocus
                    />
                  ) : (
                    <>
                      <span>{tabs[tabId].displayName || tabId}</span>
                      {showShortcut && (
                        <span className="text-xs text-muted-foreground">
                          {shortcutNumber}
                        </span>
                      )}
                    </>
                  )}
                </TabsTrigger>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem
                  onClick={() => setEditingTabName({
                    id: tabId,
                    name: tabs[tabId].displayName || tabId
                  })}
                >
                  Rename Tab
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() => deleteTab(tabId)}
                  className="text-red-500 dark:text-red-400"
                >
                  Delete Tab
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          )
        })}
        <div>
          <Button onClick={() => createNewTab({
            displayName: getNextNewTabName()
          })} size="icon" className="w-6 h-6 ml-2">
            <Plus />
          </Button>
        </div>
      </TabsList>
    </Tabs>
  )
}