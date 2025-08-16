import { useState, useRef, useEffect } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { cn } from '@/lib/utils'
import { Tabs, TabsList, TabsTrigger } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@promptliano/ui'
import { Input } from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { PromptlianoTooltip } from './promptliano/promptliano-tooltip'
import { ShortcutDisplay } from './app-shortcut-display'
import { LinkIcon, Plus, Pencil, Trash2, LayoutGrid } from 'lucide-react'
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
import { useGetProjects, useGetProjectFiles } from '@/hooks/api/use-projects-api'
import { ErrorBoundary } from '@/components/error-boundary/error-boundary'
import { useGenerateTabName } from '@/hooks/api/use-tab-naming'
import { Sparkles } from 'lucide-react'
import type { ProjectFile } from '@promptliano/schemas'

export type ProjectsTabManagerProps = {
  className?: string
}

export function ProjectsTabManager({ className }: ProjectsTabManagerProps) {
  const [tabs] = useGetProjectTabs()
  const { deleteTab } = useDeleteProjectTabById()
  const [activeProjectTabState] = useActiveProjectTab()

  const [editingTabName, setEditingTabName] = useState<{ id: number; name: string } | null>(null)
  const [localOrder, setLocalOrder] = useState<number[] | null>(null)
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)
  const [dialogEditingTab, setDialogEditingTab] = useState<number | null>(null)
  const [dialogEditingName, setDialogEditingName] = useState('')
  const { updateProjectTabById } = useUpdateProjectTabById()
  const { setActiveProjectTabId } = useSetActiveProjectTabId()
  const [activeTabId] = useGetActiveProjectTabId()
  const { data: projects } = useGetProjects()
  const { createProjectTab } = useCreateProjectTab()

  const scrollableTabsRef = useRef<HTMLDivElement>(null)
  const [showFade, setShowFade] = useState(false)

  const generateTabNameMutation = useGenerateTabName()

  const calculateInitialOrder = (): number[] => {
    if (!tabs) return []
    return Object.keys(tabs)
      .filter((key) => !isNaN(Number(key))) // Filter out non-numeric keys like 'defaultTab'
      .map(Number)
      .sort((a, b) => {
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

    const activeId = Number(active.id)
    const overId = Number(over.id)

    const oldIndex = finalTabOrder.indexOf(activeId)
    const newIndex = finalTabOrder.indexOf(overId)
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

  const handleCreateTab = async () => {
    // Use the project ID from the currently active tab
    const currentProjectId = activeProjectTabState?.selectedProjectId
    if (!currentProjectId) {
      toast.error('Please select a project first')
      return
    }

    const newTabId = createProjectTab({ selectedProjectId: currentProjectId, selectedFiles: [] })

    // Auto-generate name for the new tab
    if (currentProjectId && projects) {
      const project = projects.find((p) => p.id === currentProjectId)
      if (project) {
        try {
          const generatedName = await generateTabNameMutation.mutateAsync({
            projectName: project.name,
            selectedFiles: [],
            context: undefined
          })

          updateProjectTabById(newTabId, {
            displayName: generatedName,
            nameGenerationStatus: 'success',
            nameGeneratedAt: new Date()
          })
        } catch (error) {
          console.error('Failed to auto-generate tab name:', error)
          // Fallback is already set by the createProjectTab function
        }
      }
    }
  }

  const handleRenameTab = (tabId: number, newName: string) => {
    updateProjectTabById(tabId, { displayName: newName })
    setEditingTabName(null)
  }

  const handleDeleteTab = (tabId: number) => {
    deleteTab(tabId)
    if (dialogEditingTab === tabId) {
      setDialogEditingTab(null)
      setDialogEditingName('')
    }
    if (Object.keys(tabs ?? {}).length <= 1) {
      setShowSettingsDialog(false)
    }
  }

  const startDialogRename = (tabId: number) => {
    const currentName = tabs?.[tabId]?.displayName || `Tab ${tabId.toString().slice(-4)}`
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

  const handleGenerateTabName = async (tabId: number, projectFiles?: ProjectFile[]) => {
    const tabData = tabs?.[tabId]
    if (!tabData) return

    const project = projects?.find((p) => p.id === tabData.selectedProjectId)
    if (!project) return

    try {
      // Get file names from the selected file IDs
      const selectedFileNames =
        tabData.selectedFiles?.map((fileId) => {
          const file = projectFiles?.find((f) => f.id === fileId)
          return file?.path || file?.name || `file_${fileId}`
        }) || []

      const generatedName = await generateTabNameMutation.mutateAsync({
        projectName: project.name,
        selectedFiles: selectedFileNames,
        context: tabData.userPrompt || undefined
      })

      updateProjectTabById(tabId, {
        displayName: generatedName,
        nameGenerationStatus: 'success',
        nameGeneratedAt: new Date()
      })
      toast.success('Tab name generated')

      // If we're in editing mode, update the dialog
      if (dialogEditingTab === tabId) {
        setDialogEditingName(generatedName)
      }
    } catch (error) {
      console.error('Failed to generate tab name:', error)
      toast.error('Failed to generate tab name')
    }
  }

  function getTabStats(tabId: number): string {
    const tabData = tabs?.[tabId]
    if (!tabData) return 'No data'
    const fileCount = tabData.selectedFiles?.length ?? 0
    const promptCount = tabData.selectedPrompts?.length ?? 0
    const userPromptLength = tabData.userPrompt?.length ?? 0
    return `Files: ${fileCount} | Prompts: ${promptCount} | User Input: ${userPromptLength}`
  }

  // Filter out non-numeric tab IDs for validation
  const validTabs = tabs ? Object.keys(tabs).filter((key) => !isNaN(Number(key))) : []

  if (!tabs || validTabs.length === 0) {
    return (
      <div className={cn('flex flex-col gap-2 p-2', className)}>
        <Button onClick={handleCreateTab} disabled={!activeProjectTabState?.selectedProjectId}>
          <Plus className='mr-2 h-4 w-4' /> New Project Tab
        </Button>
        <div className='text-sm text-muted-foreground'>
          {!activeProjectTabState?.selectedProjectId ? 'Please select a project first.' : 'No project tabs yet.'}
        </div>
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
          value={activeTabId?.toString() ?? ''}
          onValueChange={(value) => {
            setActiveProjectTabId(Number(value))
          }}
          className={cn('flex flex-col justify-start rounded-none border-b', className)}
        >
          <TabsList className='h-auto bg-background justify-start rounded-none p-1 pl-12 sm:pl-1'>
            <div className='text-xs lg:text-sm px-2 font-semibold flex items-center gap-1 mr-2 whitespace-nowrap'>
              <span className='hidden sm:inline'>Project Tabs</span>
              <span className='sm:hidden'>Tabs</span>
              <PromptlianoTooltip>{titleTooltipContent}</PromptlianoTooltip>
              <Button
                variant='ghost'
                size='icon'
                className='h-6 w-6'
                onClick={() => setShowSettingsDialog(true)}
                title='Manage Tabs'
              >
                <LayoutGrid className='h-4 w-4' />
              </Button>
            </div>

            <div className='mr-2'>
              <Button
                onClick={handleCreateTab}
                size='icon'
                className='w-6 h-6'
                variant='ghost'
                disabled={!activeProjectTabState?.selectedProjectId}
                title={
                  !activeProjectTabState?.selectedProjectId
                    ? 'Select a project first'
                    : `New Project Tab (${hotkeyPrefix}+?)`
                }
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
                      const displayName = tabData.displayName || `Tab ${tabId.toString().slice(-4)}`
                      const isAIGenerated = tabData.nameGenerationStatus === 'success'

                      return (
                        <SortableTab
                          key={tabId}
                          tabId={tabId}
                          index={index}
                          displayName={displayName}
                          hasLink={false}
                          isAIGenerated={isAIGenerated}
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
                const displayName = tabData.displayName || `Tab ${tabId.toString().slice(-4)}`
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
                        className='h-6 w-6'
                        onClick={() => handleGenerateTabName(tabId)}
                        disabled={generateTabNameMutation.isPending}
                        title='Auto-generate Tab Name'
                      >
                        {generateTabNameMutation.isPending ? (
                          <span className='h-3.5 w-3.5 animate-spin'>⌛</span>
                        ) : (
                          <Sparkles className='h-3.5 w-3.5' />
                        )}
                      </Button>

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
  tabId: number
  index: number
  displayName: string
  hasLink: boolean
  isAIGenerated?: boolean
  isEditingInline: boolean
  editingInlineName: string
  setEditingInlineName: (name: string) => void
  onSaveInlineRename: (tabId: number, newName: string) => void
  onCancelInlineRename: () => void
  isActive: boolean
  hotkeyPrefix: string
}) {
  const {
    tabId,
    index,
    displayName,
    hasLink,
    isAIGenerated,
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
          value={tabId.toString()}
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
                    isActive ? 'border-primary-foreground/50 text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {`${hotkeyPrefix}${shortcutNumber}`}
                </Badge>
              )}
              <span className='truncate max-w-[120px] text-foreground'>{displayName}</span>
              {isAIGenerated && <Sparkles className='h-3 w-3 text-muted-foreground flex-shrink-0' />}
              {hasLink && <LinkIcon className='h-3.5 w-3.5 text-muted-foreground flex-shrink-0' />}
            </>
          )}
        </TabsTrigger>
      </div>
    </ErrorBoundary>
  )
}
