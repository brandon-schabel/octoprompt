import { useState, useRef, useEffect } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { cn } from '@/lib/utils'
import { Tabs, TabsList, TabsTrigger } from '@ui'
import { Button } from '@ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@ui'
import { Input } from '@ui'
import { Badge } from '@ui'
import { OctoTooltip } from './octo/octo-tooltip'
import { ShortcutDisplay } from './app-shortcut-display'
import { LinkIcon, Plus, Pencil, Trash2, Settings, Icon } from 'lucide-react'
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core'
import { arrayMove, SortableContext, useSortable, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  useActiveProjectTab,
  useCreateProjectTab,
  useDeleteProjectTabById,
  useGetActiveProjectTabId,
  useGetProjectTabs,
  useSetActiveProjectTabId,
  useUpdateProjectTabById
} from '@/hooks/use-kv-local-storage'
import { toast } from 'sonner'
import { useGetProjects } from '@/hooks/python-api/use-projects-api'
import { ErrorBoundary } from '@/components/error-boundary/error-boundary'

export type ProjectsTabManagerProps = {
  className?: string
}

export function ProjectsTabManager({ className }: ProjectsTabManagerProps) {
  const [tabs] = useGetProjectTabs()
  const { deleteTab } = useDeleteProjectTabById()
  const [activeProjectTabState] = useActiveProjectTab()

  const [editingTabName, setEditingTabName] = useState<{ id: string; name: string } | null>(null)
  const [localOrder, setLocalOrder] = useState<string[] | null>(null)
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)
  const [dialogEditingTab, setDialogEditingTab] = useState<string | null>(null)
  const [dialogEditingName, setDialogEditingName] = useState('')
  const { updateProjectTabById } = useUpdateProjectTabById()
  const { setActiveProjectTabId } = useSetActiveProjectTabId()
  const [activeTabId] = useGetActiveProjectTabId()
  const { data: projects } = useGetProjects()
  const { createProjectTab } = useCreateProjectTab()
  // by default use selected tabs project id, otherwise fallback to the first project
  const projectId = activeProjectTabState?.selectedProjectId ?? projects?.data[0]?.id

  const scrollableTabsRef = useRef<HTMLDivElement>(null)
  const [showFade, setShowFade] = useState(false)

  const calculateInitialOrder = (): string[] => {
    if (!tabs) return []
    return Object.keys(tabs).sort((a, b) => {
      const orderA = tabs[a]?.sortOrder ?? Infinity
      const orderB = tabs[b]?.sortOrder ?? Infinity
      return orderA - orderB
    })
  }

  const initialTabOrderFromState = calculateInitialOrder()
  const finalTabOrder = localOrder ?? initialTabOrderFromState

  const sensors = useSensors(useSensor(PointerSensor))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!tabs || !over || active.id === over.id) return

    const oldIndex = finalTabOrder.indexOf(active.id as string)
    const newIndex = finalTabOrder.indexOf(over.id as string)
    if (oldIndex === -1 || newIndex === -1) return

    const newOrder = arrayMove(finalTabOrder, oldIndex, newIndex)

    console.debug('[ProjectsTabManager] handleDragEnd -> New Order:', newOrder)
    setLocalOrder(newOrder)

    newOrder.forEach((tabId, index) => {
      if (tabs[tabId]?.sortOrder !== index) {
        updateProjectTabById(tabId, { sortOrder: index })
      }
    })
  }

  const hotkeyPrefix = 't'
  for (let i = 1; i <= 9; i++) {
    useHotkeys(
      `${hotkeyPrefix}+${i}`,
      () => {
        const targetTabId = finalTabOrder[i - 1]
        if (targetTabId) setActiveProjectTabId(targetTabId)
      },
      { preventDefault: true },
      [finalTabOrder, setActiveProjectTabId]
    )
  }

  useHotkeys(
    `${hotkeyPrefix}+tab`,
    (e) => {
      e.preventDefault()
      if (!activeTabId || finalTabOrder.length < 2) return
      const currentIndex = finalTabOrder.indexOf(activeTabId)
      if (currentIndex === -1) return
      const nextIndex = (currentIndex + 1) % finalTabOrder.length
      setActiveProjectTabId(finalTabOrder[nextIndex])
    },
    { preventDefault: true },
    [activeTabId, finalTabOrder, setActiveProjectTabId]
  )

  useHotkeys(
    `${hotkeyPrefix}+shift+tab`,
    (e) => {
      e.preventDefault()
      if (!activeTabId || finalTabOrder.length < 2) return
      const currentIndex = finalTabOrder.indexOf(activeTabId)
      if (currentIndex === -1) return
      const prevIndex = (currentIndex - 1 + finalTabOrder.length) % finalTabOrder.length
      setActiveProjectTabId(finalTabOrder[prevIndex])
    },
    { preventDefault: true },
    [activeTabId, finalTabOrder, setActiveProjectTabId]
  )

  useEffect(() => {
    const tabContainer = scrollableTabsRef.current
    if (!tabContainer) return

    const checkFadeVisibility = () => {
      if (tabContainer) {
        const isOverflowing = tabContainer.scrollWidth > tabContainer.clientWidth
        // Add a small tolerance to avoid fade flickering/appearing when fully scrolled.
        const isNotScrolledToEnd = tabContainer.scrollLeft + tabContainer.clientWidth < tabContainer.scrollWidth - 5
        setShowFade(isOverflowing && isNotScrolledToEnd)
      }
    }

    checkFadeVisibility() // Initial check

    tabContainer.addEventListener('scroll', checkFadeVisibility)
    const resizeObserver = new ResizeObserver(checkFadeVisibility)
    resizeObserver.observe(tabContainer)

    return () => {
      tabContainer.removeEventListener('scroll', checkFadeVisibility)
      resizeObserver.disconnect()
    }
  }, [tabs, finalTabOrder]) // Re-check when tabs or their order changes

  const handleCreateTab = () => {
    createProjectTab({ selectedProjectId: projectId, selectedFiles: [] })
  }

  const handleRenameTab = (tabId: string, newName: string) => {
    updateProjectTabById(tabId, { displayName: newName })
    setEditingTabName(null)
  }

  const handleDeleteTab = (tabId: string) => {
    deleteTab(tabId)
    if (dialogEditingTab === tabId) {
      setDialogEditingTab(null)
      setDialogEditingName('')
    }
    if (Object.keys(tabs ?? {}).length <= 1) {
      setShowSettingsDialog(false)
    }
  }

  const startDialogRename = (tabId: string) => {
    const currentName = tabs?.[tabId]?.displayName || `Tab ${tabId.substring(0, 4)}`
    setDialogEditingTab(tabId)
    setDialogEditingName(currentName)
  }

  const saveDialogRename = () => {
    if (!dialogEditingTab || !tabs) return
    if (tabs[dialogEditingTab]?.displayName !== dialogEditingName) {
      updateProjectTabById(dialogEditingTab, { displayName: dialogEditingName })
    }
    setDialogEditingTab(null)
    setDialogEditingName('')
  }

  const cancelDialogRename = () => {
    setDialogEditingTab(null)
    setDialogEditingName('')
  }

  function getTabStats(tabId: string): string {
    const tabData = tabs?.[tabId]
    if (!tabData) return 'No data'
    const fileCount = tabData.selectedFiles?.length ?? 0
    const promptCount = tabData.selectedPrompts?.length ?? 0
    const userPromptLength = tabData.userPrompt?.length ?? 0
    return `Files: ${fileCount} | Prompts: ${promptCount} | User Input: ${userPromptLength}`
  }

  if (!tabs || Object.keys(tabs).length === 0) {
    return (
      <div className={cn('flex flex-col gap-2 p-2', className)}>
        <Button onClick={handleCreateTab}>
          <Plus className='mr-2 h-4 w-4' /> New Project Tab
        </Button>
        <div className='text-sm text-muted-foreground'>No project tabs yet.</div>
      </div>
    )
  }

  const shortcutInfo = (
    <ul className='list-disc list-inside text-xs space-y-1'>
      <li>Navigate between tabs:</li>
      <li className='ml-2'>
        - Next tab: <ShortcutDisplay shortcut={['t', 'tab']} />
      </li>
      <li className='ml-2'>
        - Previous tab: <ShortcutDisplay shortcut={['t', 'shift', 'tab']} />
      </li>
      <li className='ml-2'>
        - Quick switch: <ShortcutDisplay shortcut={['t', '[1-9]']} />
      </li>
      <li>Double-click tab to rename.</li>
      <li>Drag tabs to reorder.</li>
    </ul>
  )

  const titleTooltipContent = (
    <div className='space-y-2 text-sm'>
      <p>Project Tabs save your selections and input. Use them to manage different contexts within your project.</p>
      {shortcutInfo}
    </div>
  )

  return (
    <ErrorBoundary>
      <>
        <Tabs
          value={activeTabId ?? ''}
          onValueChange={(value) => {
            setActiveProjectTabId(value)
          }}
          className={cn('flex flex-col justify-start rounded-none border-b', className)}
        >
          <TabsList className='h-auto bg-background justify-start rounded-none p-1'>
            <div className='text-xs lg:text-sm px-2 font-semibold flex items-center gap-1 mr-2 whitespace-nowrap'>
              Project Tabs
              <OctoTooltip>{titleTooltipContent}</OctoTooltip>
              <Button
                variant='ghost'
                size='icon'
                className='h-6 w-6'
                onClick={() => setShowSettingsDialog(true)}
                title='Manage Tabs'
              >
                <Settings className='h-4 w-4' />
              </Button>
            </div>

            <div className='mr-2'>
              <Button
                onClick={handleCreateTab}
                size='icon'
                className='w-6 h-6'
                variant='ghost'
                title={`New Project Tab (${hotkeyPrefix}+?)`}
              >
                <Plus className='h-4 w-4' />
              </Button>
            </div>

            <div ref={scrollableTabsRef} className='flex-1 min-w-0 overflow-x-auto scrollbar-hide relative'>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={finalTabOrder} strategy={horizontalListSortingStrategy}>
                  <div className='flex gap-1 whitespace-nowrap py-1'>
                    {finalTabOrder.map((tabId, index) => {
                      const tabData = tabs[tabId]
                      if (!tabData) return null
                      const displayName = tabData.displayName || `Tab ${tabId.substring(0, 4)}`

                      return (
                        <SortableTab
                          key={tabId}
                          tabId={tabId}
                          index={index}
                          displayName={displayName}
                          hasLink={false}
                          isEditingInline={editingTabName?.id === tabId}
                          editingInlineName={editingTabName?.name ?? ''}
                          setEditingInlineName={(name) => setEditingTabName({ id: tabId, name })}
                          onSaveInlineRename={handleRenameTab}
                          onCancelInlineRename={() => setEditingTabName(null)}
                          isActive={activeTabId === tabId}
                          hotkeyPrefix={hotkeyPrefix}
                        />
                      )
                    })}
                  </div>
                </SortableContext>
              </DndContext>
              {showFade && (
                <div className='absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-background to-transparent pointer-events-none' />
              )}
            </div>
          </TabsList>
        </Tabs>

        <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
          <DialogContent className='sm:max-w-lg'>
            <DialogHeader>
              <DialogTitle>Manage Project Tabs</DialogTitle>
            </DialogHeader>
            <div className='mt-4 space-y-2 max-h-[60vh] overflow-y-auto pr-2'>
              {finalTabOrder.map((tabId) => {
                const tabData = tabs[tabId]
                if (!tabData) return null
                const displayName = tabData.displayName || `Tab ${tabId.substring(0, 4)}`
                const isEditing = dialogEditingTab === tabId

                return (
                  <div
                    key={tabId}
                    className='group flex items-center justify-between gap-3 px-2 py-1.5 rounded hover:bg-accent/10'
                  >
                    <div className='flex flex-col flex-1 truncate min-w-0'>
                      {isEditing ? (
                        <Input
                          value={dialogEditingName}
                          onChange={(e) => setDialogEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveDialogRename()
                            if (e.key === 'Escape') cancelDialogRename()
                          }}
                          onBlur={saveDialogRename}
                          className='h-7 text-sm'
                          autoFocus
                        />
                      ) : (
                        <span
                          className='truncate font-medium text-sm cursor-pointer'
                          onClick={() => startDialogRename(tabId)}
                          title={displayName}
                        >
                          {displayName}
                        </span>
                      )}
                      <span className='text-xs text-muted-foreground truncate' title={getTabStats(tabId)}>
                        {getTabStats(tabId)}
                      </span>
                    </div>

                    <div className='flex items-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity'>
                      {isEditing ? (
                        <Button
                          variant='ghost'
                          size='icon'
                          className='h-6 w-6'
                          onClick={saveDialogRename}
                          title='Save Name'
                        >
                          <Pencil className='h-3.5 w-3.5' />
                        </Button>
                      ) : (
                        <Button
                          variant='ghost'
                          size='icon'
                          className='h-6 w-6'
                          onClick={() => startDialogRename(tabId)}
                          title='Rename Tab'
                        >
                          <Pencil className='h-3.5 w-3.5' />
                        </Button>
                      )}

                      <Button
                        variant='ghost'
                        size='icon'
                        className='h-6 w-6 text-destructive hover:bg-destructive/10 hover:text-destructive'
                        onClick={() => handleDeleteTab(tabId)}
                        title='Delete Tab'
                      >
                        <Trash2 className='h-3.5 w-3.5' />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
            {finalTabOrder.length === 0 && (
              <p className='text-sm text-muted-foreground text-center mt-4'>No tabs to manage.</p>
            )}
          </DialogContent>
        </Dialog>
      </>
    </ErrorBoundary>
  )
}

function SortableTab(props: {
  tabId: string
  index: number
  displayName: string
  hasLink: boolean
  isEditingInline: boolean
  editingInlineName: string
  setEditingInlineName: (name: string) => void
  onSaveInlineRename: (tabId: string, newName: string) => void
  onCancelInlineRename: () => void
  isActive: boolean
  hotkeyPrefix: string
}) {
  const {
    tabId,
    index,
    displayName,
    hasLink,
    isEditingInline,
    editingInlineName,
    setEditingInlineName,
    onSaveInlineRename,
    onCancelInlineRename,
    isActive,
    hotkeyPrefix
  } = props

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tabId
  })

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition: transition || 'transform 250ms ease',
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : 1,
    cursor: isDragging ? 'grabbing' : 'grab'
  }

  const showShortcut = index < 9
  const shortcutNumber = index + 1

  const handleSave = () => {
    const trimmedName = editingInlineName.trim()
    if (trimmedName && trimmedName !== displayName) {
      onSaveInlineRename(tabId, trimmedName)
    } else {
      onCancelInlineRename()
    }
  }

  return (
    <ErrorBoundary>
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          'inline-flex group relative rounded-md',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
        )}
        {...attributes}
      >
        <TabsTrigger
          value={tabId}
          className={cn(
            'flex-1 flex items-center gap-1.5 px-2.5 py-1.5 h-full text-sm rounded-md',
            'data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-inner',
            'hover:bg-accent/50',
            isDragging ? 'shadow-lg' : ''
          )}
          onDoubleClick={(e) => {
            e.preventDefault()
            setEditingInlineName(displayName)
          }}
          {...listeners}
          title={displayName}
        >
          {isEditingInline ? (
            <Input
              value={editingInlineName}
              onChange={(e) => setEditingInlineName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave()
                if (e.key === 'Escape') onCancelInlineRename()
              }}
              onBlur={handleSave}
              className='h-6 w-28 text-sm'
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <>
              {showShortcut && (
                <Badge
                  variant='outline'
                  className={cn(
                    'px-1.5 text-xs font-mono',
                    isActive ? 'border-primary/50 text-primary' : 'text-muted-foreground'
                  )}
                >
                  {`${hotkeyPrefix}${shortcutNumber}`}
                </Badge>
              )}
              <span className='truncate max-w-[120px]'>{displayName}</span>
              {hasLink && <LinkIcon className='h-3.5 w-3.5 text-muted-foreground flex-shrink-0' />}
            </>
          )}
        </TabsTrigger>
      </div>
    </ErrorBoundary>
  )
}
