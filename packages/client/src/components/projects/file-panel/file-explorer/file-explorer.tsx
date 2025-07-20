import { useDebounce } from '@/hooks/utility-hooks/use-debounce'
import { Input } from '@ui'
import { Button } from '@ui'
import { Badge } from '@ui'
import { ScrollArea } from '@ui'
import { Skeleton } from '@ui'
import { OctoTooltip } from '@/components/octo/octo-tooltip'
import { ShortcutDisplay } from '@/components/app-shortcut-display'
import { formatShortcut } from '@/lib/shortcuts'
import { X } from 'lucide-react'
import { ResizablePanel } from '@ui'
import { useHotkeys } from 'react-hotkeys-hook'
import { useActiveProjectTab, useProjectTabField } from '@/hooks/use-kv-local-storage'
import { useProjectFileMap, useSelectedFiles } from '@/hooks/utility-hooks/use-selected-files'
import { useClickAway } from '@/hooks/utility-hooks/use-click-away'
import { SelectedFilesListRef } from '../../selected-files-list'
import { buildFileTree } from '@octoprompt/shared'
import { FileTreeRef, FileTree } from '../file-tree/file-tree'
import { TabbedSidebarPanel } from './tabbed-sidebar-panel'
import { NoResultsScreen } from './no-results-screen'
import { EmptyProjectScreen } from './empty-project-screen'
import { SelectedFilesDrawer } from '../../selected-files-drawer'
import { FileViewerDialog } from '@/components/navigation/file-viewer-dialog'
import { useQueryClient } from '@tanstack/react-query'
import { useGetProjectFiles, useGetProject, useUpdateFileContent } from '@/hooks/api/use-projects-api'
import { ProjectFile } from '@octoprompt/schemas'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useProjectGitStatus } from '@/hooks/api/use-git-api'
import { GitPullRequest, GitBranch } from 'lucide-react'

type ExplorerRefs = {
  searchInputRef: React.RefObject<HTMLInputElement>
  fileTreeRef: React.RefObject<FileTreeRef>
  selectedFilesListRef: React.RefObject<SelectedFilesListRef>
}

type FileExplorerProps = {
  ref: ExplorerRefs
  allowSpacebarToSelect: boolean
  onFileViewerOpen?: (file: ProjectFile) => void
}

export function FileExplorer({ ref, allowSpacebarToSelect }: FileExplorerProps) {
  const [activeProjectTabState, , activeProjectTabId] = useActiveProjectTab()
  const selectedProjectId = activeProjectTabState?.selectedProjectId
  const queryClient = useQueryClient()

  const { data: fileDataResponse, isLoading: filesLoading } = useGetProjectFiles(
    activeProjectTabState?.selectedProjectId || -1
  )
  const fileDataArray = useMemo(() => fileDataResponse?.data || [], [fileDataResponse])

  const { data: projectDataResponse } = useGetProject(activeProjectTabState?.selectedProjectId || -1)

  const projectFiles = useMemo(() => fileDataResponse?.data || [], [fileDataResponse])
  const project = useMemo(() => projectDataResponse?.data, [projectDataResponse])

  const [viewedFile, setViewedFile] = useState<ProjectFile | null>(null)
  const [openInEditMode, setOpenInEditMode] = useState(false)
  const closeFileViewer = () => {
    setViewedFile(null)
    setOpenInEditMode(false)
  }

  const updateFileContentMutation = useUpdateFileContent()

  const { data: searchByContent = false, mutate: setSearchByContent } = useProjectTabField(
    'searchByContent',
    activeProjectTabId || -1
  )
  const { data: preferredEditor = 'vscode' } = useProjectTabField('preferredEditor', activeProjectTabId || -1)
  const { data: resolveImports = false } = useProjectTabField('resolveImports', activeProjectTabId || -1)

  const [localFileSearch, setLocalFileSearch] = useState('')
  const debouncedSetFileSearch = useDebounce(setLocalFileSearch, 300)

  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [autocompleteIndex, setAutocompleteIndex] = useState(-1)

  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false)

  useHotkeys(
    'mod+b',
    (e) => {
      e.preventDefault()
      setIsPanelCollapsed((prev) => !prev)
    },
    { enableOnFormTags: true }
  )

  const handleSearchChange = useCallback(
    (val: string) => {
      setLocalFileSearch(val)
      debouncedSetFileSearch(val)
      setShowAutocomplete(!!(val || '').trim())
      setAutocompleteIndex(-1)
    },
    [debouncedSetFileSearch]
  )
  const { selectedFiles, selectFiles } = useSelectedFiles()
  const projectFileMap = useProjectFileMap(selectedProjectId ?? -1)

  // Get git status for the project
  const { data: gitStatus } = useProjectGitStatus(selectedProjectId)

  const filteredFiles = useMemo(() => {
    if (!projectFiles) return []
    const trimmed = (localFileSearch || '').trim().toLowerCase()
    if (!trimmed) return projectFiles
    if (searchByContent) {
      return projectFiles.filter((f) => {
        return f.path.toLowerCase().includes(trimmed) || (f.content && f.content.toLowerCase().includes(trimmed))
      })
    }
    return projectFiles.filter((f) => f.path.toLowerCase().includes(trimmed))
  }, [projectFiles, localFileSearch, searchByContent])

  const fileTree = useMemo(() => {
    if (!filteredFiles.length) return {}
    return buildFileTree(filteredFiles)
  }, [filteredFiles])

  const suggestions = useMemo(() => filteredFiles.slice(0, 10), [filteredFiles])

  const toggleFileInSelection = useCallback(
    (file: ProjectFile) => {
      selectFiles((prev) => {
        if (prev.includes(file.id)) {
          return prev.filter((id) => id !== file.id)
        }
        return [...prev, file.id]
      })
    },
    [selectFiles]
  )

  const searchContainerRef = useRef<HTMLDivElement>(null)
  useClickAway(searchContainerRef, () => {
    setShowAutocomplete(false)
    setAutocompleteIndex(-1)
  })

  const renderMobileSelectedFilesDrawerButton = () => {
    const trigger = (
      <Button variant='outline' className='relative' size='sm'>
        Files
        <Badge variant='secondary' className='ml-2'>
          {selectedFiles.length}
        </Badge>
      </Button>
    )
    return (
      <SelectedFilesDrawer
        selectedFiles={selectedFiles}
        fileMap={projectFileMap}
        onRemoveFile={() => {}}
        trigger={trigger}
        projectTabId={activeProjectTabId ?? -1}
      />
    )
  }

  const handleViewFile = useCallback((file: ProjectFile, editMode: boolean = false) => {
    setOpenInEditMode(editMode)
    setViewedFile(file)
  }, [])

  const handleSaveFileContent = useCallback(
    async (content: string) => {
      if (!viewedFile || !selectedProjectId) return

      try {
        await updateFileContentMutation.mutateAsync({
          projectId: selectedProjectId,
          fileId: viewedFile.id,
          content
        })
        // Don't close the viewer here - let the component handle it
        // since it has its own logic for exiting edit mode
      } catch (error) {
        // Error is already handled by the mutation
        console.error('Failed to save file:', error)
        throw error // Re-throw so FileViewerDialog can handle failed saves
      }
    },
    [viewedFile, selectedProjectId, updateFileContentMutation]
  )

  return (
    <div className='flex flex-col h-full min-h-0 space-y-5'>
      <div
        ref={searchContainerRef}
        className='relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-start'
      >
        <div className='relative max-w-64 w-full'>
          <div className='flex items-center gap-2'>
            <Input
              ref={ref.searchInputRef}
              placeholder={`Search file ${searchByContent ? 'content' : 'name'}... (${formatShortcut('mod+f')})`}
              value={localFileSearch || ''}
              onChange={(e) => handleSearchChange(e.target.value)}
              className='pr-8 w-full'
              onFocus={() => setShowAutocomplete(!!(localFileSearch || '').trim())}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  ref.searchInputRef.current?.blur()
                  setShowAutocomplete(false)
                } else if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  if (showAutocomplete && (localFileSearch || '').trim()) {
                    setAutocompleteIndex((prev) => Math.min(suggestions.length - 1, prev + 1))
                  } else {
                    ref.fileTreeRef.current?.focusTree()
                  }
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  if (showAutocomplete && (localFileSearch || '').trim()) {
                    setAutocompleteIndex((prev) => Math.max(0, prev - 1))
                  }
                } else if (e.key === 'ArrowRight') {
                  e.preventDefault()
                  if (autocompleteIndex >= 0 && autocompleteIndex < suggestions.length) {
                    setViewedFile?.(suggestions[autocompleteIndex] as ProjectFile)
                  }
                } else if (e.key === 'Enter' || (allowSpacebarToSelect && e.key === ' ')) {
                  if (autocompleteIndex >= 0) {
                    e.preventDefault()
                  }
                  if (autocompleteIndex >= 0 && autocompleteIndex < suggestions.length) {
                    toggleFileInSelection(suggestions[autocompleteIndex] as ProjectFile)
                    if (autocompleteIndex < suggestions.length - 1) {
                      setAutocompleteIndex((prev) => prev + 1)
                    }
                  }
                }
              }}
            />
          </div>
          {localFileSearch && (
            <Button
              type='button'
              variant='ghost'
              size='sm'
              className='absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-accent hover:text-accent-foreground'
              onClick={() => {
                handleSearchChange('')
                setShowAutocomplete(false)
                setAutocompleteIndex(-1)
                ref.searchInputRef.current?.focus()
              }}
              aria-label='Clear search'
            >
              <X className='h-3 w-3' />
            </Button>
          )}
        </div>

        <Button variant='outline' size='sm' onClick={() => setSearchByContent((prev) => !prev)}>
          {searchByContent ? 'Search Content' : 'Search Names'}
        </Button>

        {/* Git changes selector button */}
        {gitStatus?.success &&
          gitStatus.data.files.length > 0 &&
          (() => {
            const changedFilesCount = gitStatus.data.files.filter(
              (file) => file.status !== 'unchanged' && file.status !== 'ignored'
            ).length

            if (changedFilesCount === 0) return null

            return (
              <Button
                variant='outline'
                size='sm'
                onClick={() => {
                  const filesWithChanges = gitStatus.data.files
                    .filter((file) => file.status !== 'unchanged' && file.status !== 'ignored')
                    .map((file) => {
                      // Find the file ID from projectFiles by matching the path
                      const projectFile = projectFiles.find((pf) => pf.path === file.path)
                      return projectFile?.id
                    })
                    .filter((id): id is number => id !== undefined)

                  if (filesWithChanges.length > 0) {
                    selectFiles([...new Set([...selectedFiles, ...filesWithChanges])])
                  }
                }}
              >
                <GitPullRequest className='h-4 w-4 mr-1' />
                Select Git Files
                <Badge variant='secondary' className='ml-2'>
                  {changedFilesCount}
                </Badge>
              </Button>
            )
          })()}

        <OctoTooltip>
          <div className='space-y-2'>
            <p>File Search Keyboard Shortcuts:</p>
            <ul>
              <li>
                <ShortcutDisplay shortcut={['up', 'down']} /> Navigate suggestions
              </li>
              <li>
                <ShortcutDisplay shortcut={['enter']} /> or{' '}
                {allowSpacebarToSelect && <ShortcutDisplay shortcut={['space']} />} to add highlighted file
              </li>
              <li>
                <ShortcutDisplay shortcut={['right']} /> Preview highlighted file
              </li>
              <li>
                <ShortcutDisplay shortcut={['escape']} /> Close suggestions
              </li>
              <li>
                <ShortcutDisplay shortcut={['mod', 'f']} /> Focus search
              </li>
              <li>
                <ShortcutDisplay shortcut={['mod', 'g']} /> Focus file tree
              </li>
            </ul>
          </div>
        </OctoTooltip>

        <div className='flex lg:hidden items-center justify-between'>{renderMobileSelectedFilesDrawerButton()}</div>
        {showAutocomplete && (localFileSearch || '').trim() && suggestions.length > 0 && (
          <ul className='absolute top-11 left-0 z-10 w-full bg-background border border-border rounded-md shadow-md max-h-56 overflow-auto'>
            <li className='px-2 py-1.5 text-sm text-muted-foreground bg-muted border-b border-border'>
              Press Enter{allowSpacebarToSelect && ' or Spacebar'} to add highlighted file; Right arrow to preview
            </li>
            {suggestions.map((file, index) => {
              const isHighlighted = index === autocompleteIndex
              const isSelected = selectedFiles.includes(file.id)
              return (
                <li
                  key={file.id}
                  className={`px-2 py-1 cursor-pointer flex items-center justify-between ${
                    isHighlighted ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    toggleFileInSelection(file as ProjectFile)
                  }}
                  onMouseEnter={() => setAutocompleteIndex(index)}
                >
                  <span>{file.path}</span>
                  {isSelected && <Badge variant='secondary'>Selected</Badge>}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {filesLoading ? (
        <div className='mt-2'>
          <Skeleton className='h-8 w-1/2' />
          <Skeleton className='h-8 w-2/3' />
        </div>
      ) : !projectFiles.length ? (
        <EmptyProjectScreen
          fileSearch={localFileSearch}
          setFileSearch={setLocalFileSearch}
          setSearchByContent={setSearchByContent}
        />
      ) : !filteredFiles.length ? (
        <NoResultsScreen
          fileSearch={localFileSearch}
          searchByContent={searchByContent}
          setFileSearch={setLocalFileSearch}
          setSearchByContent={setSearchByContent}
        />
      ) : (
        <div className='flex-1 min-h-0 flex flex-col'>
          <div className='flex lg:hidden items-center justify-between mb-2'>
            {renderMobileSelectedFilesDrawerButton()}
          </div>

          <div className='hidden lg:flex flex-1 min-h-0'>
            <ResizablePanel
              leftPanel={
                <div className='h-full w-full'>
                  <ScrollArea className='h-full min-h-0 border rounded-md'>
                    <FileTree
                      ref={ref.fileTreeRef}
                      root={fileTree}
                      onViewFile={(file) => handleViewFile(file as ProjectFile, false)}
                      onViewFileInEditMode={(file) => handleViewFile(file as ProjectFile, true)}
                      projectRoot={project?.path || ''}
                      resolveImports={resolveImports}
                      preferredEditor={preferredEditor as 'vscode' | 'cursor' | 'webstorm'}
                      onNavigateRight={() => ref.selectedFilesListRef.current?.focusList()}
                      onNavigateToSearch={() => ref.searchInputRef.current?.focus()}
                    />
                  </ScrollArea>
                </div>
              }
              rightPanel={
                <div className='h-full w-full'>
                  <TabbedSidebarPanel
                    allFilesMap={projectFileMap}
                    selectedFilesListRef={ref.selectedFilesListRef}
                    onNavigateToFileTree={() => ref.fileTreeRef.current?.focusTree()}
                  />
                </div>
              }
              initialLeftPanelWidth={70}
              minLeftPanelWidth={200}
              collapseThreshold={100}
              storageKey='file-explorer-panel-width'
              className='h-full w-full'
              resizerClassName='mx-1'
              badgeContent={
                selectedFiles.length > 0 && (
                  <Badge variant='secondary' className='absolute -top-1 -right-1 text-xs'>
                    {selectedFiles.length}
                  </Badge>
                )
              }
              onCollapseChange={setIsPanelCollapsed}
              isCollapsedExternal={isPanelCollapsed}
            />
          </div>

          <div className='flex flex-col flex-1 min-h-0 lg:hidden'>
            <ScrollArea className='flex-1 min-h-0 border rounded-md'>
              <FileTree
                ref={ref.fileTreeRef}
                root={fileTree}
                onViewFile={(file) => handleViewFile(file as ProjectFile, false)}
                onViewFileInEditMode={(file) => handleViewFile(file as ProjectFile, true)}
                projectRoot={project?.path || ''}
                resolveImports={resolveImports}
                preferredEditor={preferredEditor as 'vscode' | 'cursor' | 'webstorm'}
                onNavigateRight={() => ref.selectedFilesListRef.current?.focusList()}
                onNavigateToSearch={() => ref.searchInputRef.current?.focus()}
              />
            </ScrollArea>
          </div>
        </div>
      )}

      {/* FileViewerDialog with versioning support */}
      {viewedFile && (
        <FileViewerDialog
          viewedFile={viewedFile}
          open={!!viewedFile}
          onClose={closeFileViewer}
          projectId={selectedProjectId || undefined}
          startInEditMode={openInEditMode}
        />
      )}
    </div>
  )
}
