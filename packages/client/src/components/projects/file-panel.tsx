import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState, memo, RefObject } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { toast } from 'sonner'
import { Link, useMatches } from '@tanstack/react-router'
import { Copy, ScanEye, TicketIcon, X } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { InfoTooltip } from '@/components/info-tooltip'
import { ShortcutDisplay } from '@/components/app-shortcut-display'
import { formatShortcut } from '@/lib/shortcuts'
import { ProjectSettingsDialog } from '@/components/projects/project-settings-dialog'
import { FileTree, FileTreeRef } from '@/components/projects/file-tree/file-tree'
import { SelectedFilesList, SelectedFilesListRef } from '@/components/projects/selected-files-list'
import { FileViewerDialog } from '@/components/navigation/file-viewer-dialog'
import { SelectedFilesDrawer } from '@/components/projects/selected-files-drawer'
import { Project } from 'shared'
import { ProjectFile } from 'shared/schema'

import { buildFileTree } from '@/components/projects/utils/projects-utils'
import { useGetProjectFiles } from '@/hooks/api/use-projects-api'
import { useListTicketsWithTasks } from '@/hooks/api/use-tickets-api'
import useClickAway from '@/hooks/use-click-away'
import { useSettings } from '@/websocket-state/hooks/selectors/websocket-selector-hoooks'
import { useActiveProjectTab } from '@/websocket-state/hooks/selectors/websocket-selector-hoooks'
import { type UseSelectedFileReturn } from '@/hooks/utility-hooks/use-selected-files'
import { useProjectTabField, useProjectTabFieldUpdater } from '@/websocket-state/project-tab-hooks'

/* -------------------------------------------------------------------------
   Types
--------------------------------------------------------------------------*/

export type FilePanelRef = {
    focusSearch: () => void
    focusFileTree: () => void
    focusPrompts: () => void
}

type FilePanelProps = {
    selectedProjectId: string | null
    projectData: Project | null
    className?: string
    onNavigateToPrompts?: () => void
    selectedFilesState: UseSelectedFileReturn
}

/* -------------------------------------------------------------------------
   Main Component
--------------------------------------------------------------------------*/

export const FilePanel = forwardRef<FilePanelRef, FilePanelProps>(({
    selectedProjectId,
    projectData,
    className,
    onNavigateToPrompts,
    selectedFilesState
}, ref) => {

    // Various refs
    const searchInputRef = useRef<HTMLInputElement>(null)
    const fileTreeRef = useRef<FileTreeRef>(null)
    const selectedFilesListRef = useRef<SelectedFilesListRef>(null)
    const promptsRef = useRef<HTMLDivElement>(null)

    // Active tab ID from WebSocket state
    const { id: activeProjectTabId } = useActiveProjectTab()

    // Local UI state
    const [viewedFile, setViewedFile] = useState<ProjectFile | null>(null)
    const [autocompleteIndex, setAutocompleteIndex] = useState<number>(-1)
    const [showAutocomplete, setShowAutocomplete] = useState<boolean>(false)

    // Settings from server
    const settings = useSettings()
    const allowSpacebaseToSelect = settings?.useSpacebarToSelectAutocomplete ?? true

    // React Router info (for highlighting tickets/summarization links)
    const matches = useMatches()
    const isOnTicketsRoute = matches.some(match => match.routeId === '/tickets')
    const isOnSummarizationRoute = matches.some(match => match.routeId === '/project-summarization')

    // Tickets for this project
    const { data: ticketsData } = useListTicketsWithTasks(selectedProjectId ?? '')
    const openTicketsCount = ticketsData?.ticketsWithTasks?.filter(t => t.status === 'open').length ?? 0

    // Keyboard shortcuts for focusing search, file tree, prompts
    useHotkeys('mod+f', (e) => {
        e.preventDefault()
        searchInputRef.current?.focus()
    })
    useHotkeys('mod+g', (e) => {
        e.preventDefault()
        fileTreeRef.current?.focusTree()
    })
    useHotkeys('mod+p', (e) => {
        e.preventDefault()
        promptsRef.current?.focus()
    })

    // Undo/Redo for selected files
    const { undo, redo, canUndo, canRedo } = selectedFilesState
    useHotkeys('mod+z', (e) => {
        e.preventDefault()
        if (canUndo) {
            undo()
            toast.success('Undo: Reverted file selection')
        }
    })
    useHotkeys('shift+mod+z', (e) => {
        e.preventDefault()
        if (canRedo) {
            redo()
            toast.success('Redo: Restored file selection')
        }
    })

    // Imperative methods for parent ref
    useImperativeHandle(ref, () => ({
        focusSearch: () => {
            searchInputRef.current?.focus()
        },
        focusFileTree: () => {
            fileTreeRef.current?.focusTree()
        },
        focusPrompts: () => {
            promptsRef.current?.focus()
        }
    }))

    // If no project selected, display "no project" message
    if (!selectedProjectId) {
        return (
            <div className={`flex flex-col items-center justify-center h-full p-8 text-center space-y-6 ${className}`}>
                <NoProjectSelectedScreen />
            </div>
        )
    }

    return (
        <div id="outer-area" className={`flex flex-col ${className}`}>
            <div className="flex-1 space-y-4 transition-all duration-300">
                {/* Top Header: Project info, tickets link, summarization link, etc. */}
                <ProjectHeader
                    projectData={projectData}
                    isOnTicketsRoute={isOnTicketsRoute}
                    isOnSummarizationRoute={isOnSummarizationRoute}
                    openTicketsCount={openTicketsCount}
                />

                {/* Main Content Area */}
                <div className="flex-1 overflow-hidden space-y-4 p-4">

                    {/* File explorer & search area */}
                    <FileExplorer
                        activeProjectTabId={activeProjectTabId ?? ''}
                        selectedProjectId={selectedProjectId}
                        projectData={projectData}
                        viewedFile={viewedFile}
                        setViewedFile={setViewedFile}
                        allowSpacebaseToSelect={allowSpacebaseToSelect}
                        searchInputRef={searchInputRef as RefObject<HTMLInputElement>}
                        fileTreeRef={fileTreeRef as RefObject<FileTreeRef>}
                        selectedFilesListRef={selectedFilesListRef as RefObject<SelectedFilesListRef>}
                        onNavigateToPrompts={onNavigateToPrompts}
                        selectedFilesState={selectedFilesState}
                        autocompleteIndex={autocompleteIndex}
                        setAutocompleteIndex={setAutocompleteIndex}
                        showAutocomplete={showAutocomplete}
                        setShowAutocomplete={setShowAutocomplete}
                    />

                </div>
            </div>

            {/* File Viewer Modal */}
            <FileViewerDialog
                open={!!viewedFile}
                viewedFile={viewedFile}
                onClose={() => {
                    setViewedFile(null)
                    // Refocus the search input after a small delay
                    setTimeout(() => {
                        searchInputRef.current?.focus()
                        // Restore autocomplete state
                        setShowAutocomplete(prev => !!prev)
                    }, 0)
                }}
            />
        </div>
    )
})

/* -------------------------------------------------------------------------
   Subcomponent: ProjectHeader
   Shows the project name, path (with tooltip), tickets link, summarization link, etc.
--------------------------------------------------------------------------*/
type ProjectHeaderProps = {
    projectData: Project | null
    isOnTicketsRoute: boolean
    isOnSummarizationRoute: boolean
    openTicketsCount: number
}

const ProjectHeader = memo(function ProjectHeader({
    projectData,
    isOnTicketsRoute,
    isOnSummarizationRoute,
    openTicketsCount
}: ProjectHeaderProps) {
    if (!projectData) return null

    return (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 pt-4">
            <div>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <h2 className="text-lg font-semibold hover:cursor-help">
                                {projectData?.name}
                            </h2>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="flex items-center gap-2 max-w-md">
                            <span className="break-all">{projectData?.path}</span>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4 hover:bg-accent hover:text-accent-foreground"
                                onClick={(e) => {
                                    e.preventDefault()
                                    navigator.clipboard.writeText(projectData?.path || '')
                                    toast.success('Project path copied to clipboard')
                                }}
                            >
                                <Copy className="h-3 w-3" />
                            </Button>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
                <span className="hidden md:block text-sm text-muted-foreground">
                    {projectData?.path.slice(0, 100)}
                </span>
            </div>

            <div className="flex items-center space-x-4">
                <ProjectSettingsDialog />

                <Link
                    to="/tickets"
                    className={`inline-flex items-center gap-2 text-sm font-medium transition-colors 
            hover:bg-accent/50 px-3 py-2 rounded-md ${isOnTicketsRoute
                            ? 'text-indigo-600 dark:text-indigo-400 bg-accent/80'
                            : 'text-foreground hover:text-indigo-600 dark:hover:text-indigo-400'
                        }`}
                >
                    <TicketIcon className="w-4 h-4" />
                    Tickets
                    {openTicketsCount > 0 && (
                        <Badge variant="count" className="ml-1">
                            {openTicketsCount}
                        </Badge>
                    )}
                </Link>

                <Link
                    to="/project-summarization"
                    className={`inline-flex items-center gap-2 text-sm font-medium transition-colors 
            hover:bg-accent/50 px-3 py-2 rounded-md ${isOnSummarizationRoute
                            ? 'text-indigo-600 dark:text-indigo-400 bg-accent/80'
                            : 'text-foreground hover:text-indigo-600 dark:hover:text-indigo-400'
                        }`}
                >
                    <ScanEye className="w-4 h-4" />
                    Summarization
                </Link>
            </div>
        </div>
    )
})

/* -------------------------------------------------------------------------
   Subcomponent: FileExplorer
   - Grabs fileSearch, searchByContent, resolveImports, preferredEditor, selectedFiles
   - Renders the search bar/autocomplete
   - Renders the file tree (and sets selected files)
   - Renders the selected files (both drawer on mobile and sidebar on large)
--------------------------------------------------------------------------*/
type FileExplorerProps = {
    activeProjectTabId: string | null
    selectedProjectId: string
    projectData: Project | null
    viewedFile: ProjectFile | null
    setViewedFile: (file: ProjectFile | null) => void
    allowSpacebaseToSelect: boolean
    searchInputRef: React.RefObject<HTMLInputElement>
    fileTreeRef: React.RefObject<FileTreeRef>
    selectedFilesListRef: React.RefObject<SelectedFilesListRef>
    onNavigateToPrompts?: () => void
    selectedFilesState: UseSelectedFileReturn
    autocompleteIndex: number
    setAutocompleteIndex: React.Dispatch<React.SetStateAction<number>>
    showAutocomplete: boolean
    setShowAutocomplete: React.Dispatch<React.SetStateAction<boolean>>
}

const FileExplorer = memo(function FileExplorer({
    activeProjectTabId,
    selectedProjectId,
    projectData,
    viewedFile,
    setViewedFile,
    allowSpacebaseToSelect,
    searchInputRef,
    fileTreeRef,
    selectedFilesListRef,
    onNavigateToPrompts,
    selectedFilesState,
    autocompleteIndex,
    setAutocompleteIndex,
    showAutocomplete,
    setShowAutocomplete,
}: FileExplorerProps) {

    // 1) Subscribe to fields from Project Tab
    const { data: fileSearch = '' } = useProjectTabField(activeProjectTabId ?? '', 'fileSearch')
    const { data: searchByContent = false } = useProjectTabField(activeProjectTabId ?? '', 'searchByContent')
    const { data: resolveImports = false } = useProjectTabField(activeProjectTabId ?? '', 'resolveImports')
    const { data: preferredEditor = 'vscode' } = useProjectTabField(activeProjectTabId ?? '', 'preferredEditor')
    const { data: selectedFiles = [] } = useProjectTabField(activeProjectTabId ?? '', 'selectedFiles')

    // 2) Updaters
    const { mutate: setFileSearch } = useProjectTabFieldUpdater(activeProjectTabId ?? '', 'fileSearch')
    const { mutate: setSearchByContent } = useProjectTabFieldUpdater(activeProjectTabId ?? '', 'searchByContent')
    const { mutate: setSelectedFiles } = useProjectTabFieldUpdater(activeProjectTabId ?? '', 'selectedFiles')

    // 3) Query to get all files
    const { data: fileData, isLoading: filesLoading } = useGetProjectFiles(selectedProjectId)

    // 4) Computed: filter & build file tree
    const filteredFiles = useMemo(() => {
        if (!fileData?.files) return []
        const trimmed = fileSearch.trim()
        if (!trimmed) return fileData.files

        const lowerSearch = trimmed.toLowerCase()
        if (searchByContent) {
            return fileData.files.filter(
                f =>
                    (f.content && f.content.toLowerCase().includes(lowerSearch)) ||
                    f.path.toLowerCase().includes(lowerSearch)
            )
        } else {
            return fileData.files.filter(f =>
                f.path.toLowerCase().includes(lowerSearch)
            )
        }
    }, [fileData?.files, fileSearch, searchByContent])

    const fileTree = useMemo(() => {
        if (!filteredFiles.length) return null
        return buildFileTree(filteredFiles)
    }, [filteredFiles])

    const allFilesMap = useMemo(() => {
        const map = new Map<string, ProjectFile>()
        fileData?.files?.forEach(f => map.set(f.id, f))
        return map
    }, [fileData?.files])

    const filteredFilesMap = useMemo(() => {
        const map = new Map<string, ProjectFile>()
        filteredFiles.forEach(f => map.set(f.id, f))
        return map
    }, [filteredFiles])

    // 5) Handlers
    const handleSetSelectedFiles = useCallback((updater: (prev: string[]) => string[]) => {
        const newVal = updater(selectedFiles ?? [])
        selectedFilesState.selectFiles(newVal) // local "undo/redo" manager
        setSelectedFiles(newVal)               // persist to server via WS
    }, [selectedFiles, selectedFilesState, setSelectedFiles])

    const openFileViewer = (file: ProjectFile) => {
        setViewedFile(file)
    }

    const handleNavigateToFileTree = () => {
        fileTreeRef.current?.focusTree()
    }

    const handleNavigateToSelectedFiles = () => {
        selectedFilesListRef.current?.focusList()
    }

    // Autocomplete suggestions
    const suggestions = useMemo(() => filteredFiles.slice(0, 10), [filteredFiles])

    const selectFileFromAutocomplete = (file: ProjectFile) => {
        handleSetSelectedFiles(prev => {
            if (prev.includes(file.id)) {
                return prev.filter(id => id !== file.id)
            }
            return [...prev, file.id]
        })
        setShowAutocomplete(true)
        searchInputRef.current?.focus()
    }

    // Click-away for autocomplete
    const searchContainerRef = useRef<HTMLDivElement>(null)
    useClickAway(searchContainerRef, () => {
        setShowAutocomplete(false)
        setAutocompleteIndex(-1)
    })

    // 6) Render
    if (filesLoading) {
        return (
            <div>
                <Skeleton className="h-8 w-1/2" />
                <Skeleton className="h-8 w-2/3" />
            </div>
        )
    }

    // If no files
    if (!fileData?.files?.length) {
        return <EmptyProjectScreen fileSearch={fileSearch} setFileSearch={setFileSearch} setSearchByContent={setSearchByContent} />
    }

    // If filtered has data, render the explorer
    if (fileTree) {
        return (
            <div className="flex flex-col space-y-4">
                {/* Search + Controls row */}
                <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-start">
                    <div ref={searchContainerRef} className="relative max-w-64 w-full">
                        <div className="flex items-center gap-2">
                            <Input
                                ref={searchInputRef}
                                placeholder={`Search file ${searchByContent ? 'content' : 'name'}... (${formatShortcut('mod+f')})`}
                                value={fileSearch ?? ''}
                                onChange={(e) => {
                                    setFileSearch(e.target.value)
                                    setShowAutocomplete(!!e.target.value.trim())
                                    setAutocompleteIndex(-1)
                                }}
                                className="pr-8 w-full"
                                onFocus={() => setShowAutocomplete(!!fileSearch?.trim())}
                                onKeyDown={(e) => {
                                    if (e.key === 'Escape') {
                                        searchInputRef.current?.blur()
                                        setShowAutocomplete(false)
                                    } else if (e.key === 'ArrowDown') {
                                        e.preventDefault()
                                        if (showAutocomplete && fileSearch?.trim()) {
                                            setAutocompleteIndex(prev => Math.min(suggestions.length - 1, prev + 1))
                                        } else {
                                            handleNavigateToFileTree()
                                        }
                                    } else if (e.key === 'ArrowUp') {
                                        e.preventDefault()
                                        if (showAutocomplete && fileSearch?.trim()) {
                                            setAutocompleteIndex(prev => Math.max(0, prev - 1))
                                        }
                                    } else if (e.key === 'ArrowRight') {
                                        e.preventDefault()
                                        if (autocompleteIndex >= 0 && autocompleteIndex < suggestions.length) {
                                            openFileViewer(suggestions[autocompleteIndex])
                                        }
                                    } else if (e.key === 'Enter' || (allowSpacebaseToSelect && e.key === ' ')) {
                                        if (autocompleteIndex >= 0) {
                                            e.preventDefault()
                                        }
                                        if (autocompleteIndex >= 0 && autocompleteIndex < suggestions.length) {
                                            selectFileFromAutocomplete(suggestions[autocompleteIndex])
                                            if (autocompleteIndex < suggestions.length - 1) {
                                                setAutocompleteIndex(prev => prev + 1)
                                            }
                                        }
                                    }
                                }}
                            />
                        </div>
                        {fileSearch && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-accent hover:text-accent-foreground"
                                onClick={() => {
                                    setFileSearch('')
                                    setShowAutocomplete(false)
                                    setAutocompleteIndex(-1)
                                    searchInputRef.current?.focus()
                                }}
                                aria-label="Clear search"
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSearchByContent(!searchByContent)}
                    >
                        {searchByContent ? 'Search Content' : 'Search Names'}
                    </Button>
                    <InfoTooltip>
                        <div className="space-y-2">
                            <p>File Search Keyboard Shortcuts:</p>
                            <ul>
                                <li><ShortcutDisplay shortcut={['up', 'down']} /> Navigate suggestions</li>
                                <li><ShortcutDisplay shortcut={['enter']} /> or <ShortcutDisplay shortcut={['space']} /> Select highlighted file</li>
                                <li><ShortcutDisplay shortcut={['right']} /> Preview highlighted file</li>
                                <li><ShortcutDisplay shortcut={['escape']} /> Close suggestions</li>
                                <li><ShortcutDisplay shortcut={['mod', 'f']} /> Focus search</li>
                                <li><ShortcutDisplay shortcut={['mod', 'g']} /> Focus file tree</li>
                            </ul>
                        </div>
                    </InfoTooltip>

                    {/* Drawer trigger (mobile only) */}
                    <div className="flex lg:hidden items-center justify-between">
                        <MobileSelectedFilesDrawerButton
                            selectedFiles={selectedFiles ?? []}
                            allFilesMap={allFilesMap}
                            activeProjectTabId={activeProjectTabId ?? ''}
                            selectedFilesState={selectedFilesState}
                        />
                    </div>

                    {/* Autocomplete dropdown */}
                    {showAutocomplete && fileSearch?.trim() && suggestions.length > 0 && (
                        <ul
                            className="absolute top-11 left-0 z-10 w-full bg-background border border-border rounded-md shadow-md max-h-56 overflow-auto"
                        >
                            <li className="px-2 py-1.5 text-sm text-muted-foreground bg-muted border-b border-border">
                                Press Enter{allowSpacebaseToSelect && <span> or Spacebar</span>} to add highlighted file to selection, right arrow to preview file
                            </li>
                            {suggestions.map((file, index) => {
                                const isHighlighted = index === autocompleteIndex
                                const isSelected = selectedFiles?.includes(file.id)
                                return (
                                    <li
                                        key={file.id}
                                        className={`px-2 py-1 cursor-pointer flex items-center justify-between ${isHighlighted
                                            ? 'bg-accent text-accent-foreground'
                                            : 'hover:bg-accent/50'
                                            }`}
                                        onMouseDown={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            selectFileFromAutocomplete(file)
                                        }}
                                        onMouseEnter={() => setAutocompleteIndex(index)}
                                    >
                                        <span>{file.path}</span>
                                        {isSelected && (
                                            <Badge variant="secondary" className="ml-2">Selected</Badge>
                                        )}
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </div>

                {/* FileTree + Selected Files (desktop) */}
                <div className="flex-1 lg:flex min-h-0 overflow-hidden">
                    <div className="flex flex-col flex-1 min-h-0">
                        <ScrollArea className="flex-1 min-h-0 border rounded-md max-h-[62vh]" type="auto">
                            <FileTree
                                ref={fileTreeRef}
                                root={fileTree}
                                selectedFiles={selectedFiles ?? []}
                                setSelectedFiles={handleSetSelectedFiles}
                                fileMap={filteredFilesMap}
                                onViewFile={openFileViewer}
                                projectRoot={projectData?.path || ''}
                                resolveImports={resolveImports}
                                preferredEditor={preferredEditor}
                                onNavigateRight={handleNavigateToSelectedFiles}
                                onNavigateToSearch={() => searchInputRef.current?.focus()}
                            />
                        </ScrollArea>
                    </div>
                    <div className="hidden lg:flex lg:flex-col w-64 pl-4 min-h-0">
                        <SelectedFilesSidebar
                            selectedFiles={selectedFiles ?? []}
                            allFilesMap={allFilesMap}
                            setSelectedFiles={setSelectedFiles}
                            selectedFilesListRef={selectedFilesListRef}
                            onNavigateToFileTree={handleNavigateToFileTree}
                            onNavigateToPrompts={onNavigateToPrompts}
                            selectedFilesState={selectedFilesState}
                            activeProjectTabId={activeProjectTabId ?? ''}
                        />
                    </div>
                </div>
            </div>
        )
    }

    // If fileSearch is set, but no results
    return (
        <NoResultsScreen
            fileSearch={fileSearch}
            searchByContent={searchByContent}
            setFileSearch={setFileSearch}
            setSearchByContent={setSearchByContent}
        />
    )
})

/* -------------------------------------------------------------------------
   MobileSelectedFilesDrawerButton
   - Renders the "Files [X]" button for mobile and opens a SelectedFilesDrawer
--------------------------------------------------------------------------*/
type MobileSelectedFilesDrawerButtonProps = {
    selectedFiles: string[]
    allFilesMap: Map<string, ProjectFile>
    activeProjectTabId: string
    selectedFilesState: UseSelectedFileReturn
}

const MobileSelectedFilesDrawerButton = memo(function MobileSelectedFilesDrawerButton({
    selectedFiles,
    allFilesMap,
    activeProjectTabId,
    selectedFilesState
}: MobileSelectedFilesDrawerButtonProps) {
    const trigger = (
        <Button variant="outline" className="relative" size="sm">
            Files
            <Badge variant="secondary" className="ml-2">
                {selectedFiles.length}
            </Badge>
        </Button>
    )

    return (
        <SelectedFilesDrawer
            selectedFiles={selectedFiles}
            fileMap={allFilesMap}
            onRemoveFile={() => {
                // We'll handle removal inside the drawer
            }}
            trigger={trigger}
            projectTabId={activeProjectTabId}
            selectedFilesState={selectedFilesState}
        />
    )
})

/* -------------------------------------------------------------------------
   SelectedFilesSidebar
   - Desktop-only side panel to show selected files
--------------------------------------------------------------------------*/
type SelectedFilesSidebarProps = {
    selectedFiles: string[]
    allFilesMap: Map<string, ProjectFile>
    setSelectedFiles: (value: null | string[] | ((prev: string[] | null) => string[] | null)) => void
    selectedFilesListRef: React.RefObject<SelectedFilesListRef>
    onNavigateToFileTree: () => void
    onNavigateToPrompts?: () => void
    selectedFilesState: UseSelectedFileReturn
    activeProjectTabId: string
}

const SelectedFilesSidebar = memo(function SelectedFilesSidebar({
    selectedFiles,
    allFilesMap,
    setSelectedFiles,
    selectedFilesListRef,
    onNavigateToFileTree,
    onNavigateToPrompts,
    selectedFilesState,
    activeProjectTabId,
}: SelectedFilesSidebarProps) {
    return (
        <div className="flex flex-col w-full">
            <div className="flex justify-between items-center mb-2">
                <div className="flex text-sm font-medium items-center space-x-2">
                    <Badge variant="secondary">{selectedFiles.length}</Badge>
                    <span>Selected Files</span>
                    <InfoTooltip>
                        Selected files will be included with your prompt.
                        <ul className="mt-2 list-disc list-inside">
                            <li>Use arrow keys <ShortcutDisplay shortcut={['up', 'down']} /> to navigate the selected files list.</li>
                            <li>Press <ShortcutDisplay shortcut={['r', '[1-9]']} /> or <ShortcutDisplay shortcut={['delete', 'backspace']} /> to remove a file.</li>
                        </ul>
                    </InfoTooltip>
                </div>
            </div>
            <ScrollArea
                className="flex-1 min-h-0 border rounded-md max-h-[50vh] items-center flex w-60"
                type="auto"
            >
                <SelectedFilesList
                    ref={selectedFilesListRef}
                    selectedFiles={selectedFiles}
                    fileMap={allFilesMap}
                    onRemoveFile={(fileId: string) => {
                        setSelectedFiles(prev => prev?.filter(id => id !== fileId) ?? [])
                    }}
                    onNavigateLeft={onNavigateToFileTree}
                    onNavigateRight={onNavigateToPrompts}
                    className="w-60"
                    projectTabId={activeProjectTabId}
                    selectedFilesState={selectedFilesState}
                />
            </ScrollArea>
        </div>
    )
})

/* -------------------------------------------------------------------------
   NoProjectSelectedScreen
--------------------------------------------------------------------------*/
function NoProjectSelectedScreen() {
    return (
        <div className="max-w-md space-y-4">
            <h3 className="text-lg font-semibold">No Project Selected</h3>
            <p className="text-muted-foreground">
                Select a project to start exploring files, or create a new project if you haven't added one yet.
            </p>
            <div className="space-y-2">
                <p className="text-sm font-medium">Quick Tips:</p>
                <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                    <li>Use <kbd className="px-1 rounded bg-muted">{formatShortcut('mod+f')}</kbd> to quickly search files</li>
                    <li>Use <kbd className="px-1 rounded bg-muted">{formatShortcut('mod+g')}</kbd> to focus the file tree</li>
                    <li>Enable content search to find text within files</li>
                    <li>Select files to include them in your AI prompts</li>
                </ul>
            </div>
        </div>
    )
}

/* -------------------------------------------------------------------------
   EmptyProjectScreen
   - Shown when the project has 0 files at all
--------------------------------------------------------------------------*/
type EmptyProjectScreenProps = {
    fileSearch: string
    setFileSearch: (val: string) => void
    setSearchByContent: (val: boolean) => void
}

function EmptyProjectScreen({
    fileSearch,
    setFileSearch,
    setSearchByContent
}: EmptyProjectScreenProps) {
    return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4">
            {fileSearch ? (
                <>
                    <p className="text-muted-foreground">No files found matching "{fileSearch}"</p>
                    <p className="text-sm text-muted-foreground">
                        Try adjusting your search or{' '}
                        <Button
                            variant="link"
                            className="p-0 h-auto"
                            onClick={() => {
                                setFileSearch('')
                                setSearchByContent(false)
                            }}
                        >
                            clear the search
                        </Button>
                    </p>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSearchByContent(true)}
                    >
                        Try searching file contents
                    </Button>
                </>
            ) : (
                <>
                    <p className="text-muted-foreground">This project appears to be empty.</p>
                    <p className="text-sm text-muted-foreground">
                        Make sure you've selected the correct directory and it actually contains files.
                    </p>
                </>
            )}
        </div>
    )
}

/* -------------------------------------------------------------------------
   NoResultsScreen
   - Shown when the user typed a search but no files matched
--------------------------------------------------------------------------*/
type NoResultsScreenProps = {
    fileSearch: string
    searchByContent: boolean
    setFileSearch: (val: string) => void
    setSearchByContent: (val: boolean) => void
}

function NoResultsScreen({
    fileSearch,
    searchByContent,
    setFileSearch,
    setSearchByContent
}: NoResultsScreenProps) {
    return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4">
            <p className="text-muted-foreground">No files found matching "{fileSearch}"</p>
            <p className="text-sm text-muted-foreground">
                Try adjusting your search or{' '}
                <Button
                    variant="link"
                    className="p-0 h-auto"
                    onClick={() => {
                        setFileSearch('')
                        setSearchByContent(false)
                    }}
                >
                    clear the search
                </Button>
            </p>
            {!searchByContent && (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSearchByContent(true)}
                >
                    Try searching file contents
                </Button>
            )}
        </div>
    )
}