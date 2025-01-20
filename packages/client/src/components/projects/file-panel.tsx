import { useState, useMemo, useRef, useImperativeHandle, forwardRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Copy, X } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FileTree, FileTreeRef } from '@/components/projects/file-tree/file-tree'
import { SelectedFilesList, SelectedFilesListRef } from '@/components/projects/selected-files-list'
import { useGetProjectFiles } from '@/hooks/api/use-projects-api'
import { buildFileTree } from '@/components/projects/utils/projects-utils'
import { FileViewerDialog } from '@/components/navigation/file-viewer-dialog'
import { Project } from 'shared/index'
import { ProjectFile } from 'shared/schema'
import { useHotkeys } from 'react-hotkeys-hook'
import { toast } from 'sonner'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { SelectedFilesDrawer } from './selected-files-drawer'
import { Badge } from '../ui/badge'
import { ProjectSettingsDialog } from './project-settings-dialog'
import { useGlobalStateHelpers } from '../global-state/use-global-state-helpers'
import { InfoTooltip } from '../info-tooltip'
import { formatShortcut } from '@/lib/shortcuts'
import { ShortcutDisplay } from '../app-shortcut-display'
import useClickAway from '@/hooks/use-click-away'
import { type UseSelectedFileReturn } from '@/hooks/utility-hooks/use-selected-files'
import { Link, useMatches } from "@tanstack/react-router"
import { TicketIcon, ScanEye } from "lucide-react"
import { useListTicketsWithTasks } from "@/hooks/api/use-tickets-api"

export type FilePanelRef = {
    focusSearch: () => void
    focusFileTree: () => void
    focusPrompts: () => void
}

type FilePanelProps = {
    selectedProjectId: string | null
    projectData: Project
    fileSearch: string
    setFileSearch: (search: string) => void
    searchByContent: boolean
    setSearchByContent: (byContent: boolean) => void
    className?: string
    onNavigateToPrompts?: () => void
    selectedFilesState: UseSelectedFileReturn
}

export const FilePanel = forwardRef<FilePanelRef, FilePanelProps>(({
    selectedProjectId,
    projectData,
    fileSearch,
    setFileSearch,
    searchByContent,
    setSearchByContent,
    className,
    onNavigateToPrompts,
    selectedFilesState
}, ref) => {
    const searchInputRef = useRef<HTMLInputElement>(null)
    const fileTreeRef = useRef<FileTreeRef>(null)
    const selectedFilesListRef = useRef<SelectedFilesListRef>(null)
    const promptsRef = useRef<HTMLDivElement>(null)
    const { updateActiveProjectTab: updateActiveTab, activeProjectTabState: activeTabState } = useGlobalStateHelpers()
    const resolveImports = typeof activeTabState?.resolveImports === 'boolean' ? activeTabState?.resolveImports : false
    const preferredEditor = activeTabState?.preferredEditor || 'vscode'
    const { state } = useGlobalStateHelpers()
    const allowSpacebaseToSelect = state?.settings?.useSpacebarToSelectAutocomplete ?? true
    const activeProjectTabId = state?.projectActiveTabId

    const matches = useMatches()
    const isOnTicketsRoute = matches.some(match => match.routeId === "/tickets")
    const isOnSummarizationRoute = matches.some(match => match.routeId === "/project-summarization")

    // Get open tickets count
    const { data: ticketsData } = useListTicketsWithTasks(selectedProjectId ?? '')
    const openTicketsCount = ticketsData?.ticketsWithTasks?.filter(t => t.status === 'open').length ?? 0

    const { selectedFiles, removeSelectedFile, selectFiles, clearSelectedFiles, undo, redo, canUndo, canRedo } = selectedFilesState

    const [viewedFile, setViewedFile] = useState<ProjectFile | null>(null)

    // NEW: local states for autocomplete behavior
    const [autocompleteIndex, setAutocompleteIndex] = useState<number>(-1)
    const [showAutocomplete, setShowAutocomplete] = useState<boolean>(false)

    // Query: get files
    const { data: fileData, isLoading: filesLoading } = useGetProjectFiles(selectedProjectId ?? '')

    // Filter the files
    const filteredFiles = useMemo(() => {
        if (!fileData?.files) return []
        if (!fileSearch.trim()) return fileData.files
        const lowerSearch = fileSearch.toLowerCase()
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
    }, [fileData, fileSearch, searchByContent])

    const fileTree = useMemo(() => {
        if (!filteredFiles.length) return null
        return buildFileTree(filteredFiles)
    }, [filteredFiles])

    // Create a map of all files, not just filtered ones
    const allFilesMap = useMemo(() => {
        const map = new Map<string, ProjectFile>()
        fileData?.files?.forEach(f => map.set(f.id, f))
        return map
    }, [fileData?.files])

    // Keep the filtered files map for the file tree
    const fileMap = useMemo(() => {
        const map = new Map<string, ProjectFile>()
        filteredFiles.forEach(f => map.set(f.id, f))
        return map
    }, [filteredFiles])

    const openFileViewer = (file: ProjectFile) => {
        setViewedFile(file)
    }

    const handleSetSelectedFiles = (updater: (prev: string[]) => string[]) => {
        selectFiles(updater(selectedFiles))
    }

    const handleNavigateToSelectedFiles = () => {
        selectedFilesListRef.current?.focusList()
    }

    const handleNavigateToFileTree = () => {
        fileTreeRef.current?.focusTree()
    }

    const handleNavigateToSearch = () => {
        searchInputRef.current?.focus()
    }

    useImperativeHandle(ref, () => ({
        focusSearch: () => {
            searchInputRef.current?.focus()
        },
        focusFileTree: () => {
            fileTreeRef.current?.focusTree()
        },
        focusPrompts: () => {
            promptsRef.current?.focus()
        },
    }))

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

    // Keyboard shortcuts for Undo/Redo
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

    const selectedFilesButton = (
        <Button variant="outline" className="relative" size="sm">
            Files
            <Badge variant="secondary" className="ml-2">
                {selectedFiles.length}
            </Badge>
        </Button>
    )

    // We'll limit how many suggestions are shown to keep things tidy
    const suggestions = useMemo(() => filteredFiles.slice(0, 10), [filteredFiles])

    const selectFileFromAutocomplete = (file: ProjectFile) => {
        handleSetSelectedFiles((prev) => {
            // Toggle selection - remove if already selected, add if not
            if (prev.includes(file.id)) {
                return prev.filter(id => id !== file.id)
            }
            return [...prev, file.id]
        })
        setShowAutocomplete(true)
        searchInputRef.current?.focus()
    }

    const searchContainerRef = useRef<HTMLDivElement>(null)
    useClickAway(searchContainerRef, () => {
        setShowAutocomplete(false)
        setAutocompleteIndex(-1)
    })

    return (
        <div id="outer-area" className={`flex flex-col ${className}`}>
            <div className="flex-1 space-y-4 transition-all duration-300">
                {selectedProjectId ? (
                    <div className="h-full flex flex-col space-y-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 pt-4">
                            <div>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <h2 className="text-lg font-semibold hover:cursor-help">
                                                {projectData.name}
                                            </h2>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" className="flex items-center gap-2 max-w-md">
                                            <span className="break-all">{projectData.path}</span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-4 w-4 hover:bg-accent hover:text-accent-foreground"
                                                onClick={(e) => {
                                                    e.preventDefault()
                                                    navigator.clipboard.writeText(projectData.path)
                                                    toast.success('Project path copied to clipboard')
                                                }}
                                            >
                                                <Copy className="h-3 w-3" />
                                            </Button>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                                <span className="hidden md:block text-sm text-muted-foreground">
                                    {projectData.path.slice(0, 100)}
                                </span>
                            </div>

                            {/* Added Tickets & Summarization links next to Project Settings */}
                            <div className="flex items-center space-x-4">
                                <ProjectSettingsDialog />

                                <Link
                                    to="/tickets"
                                    className={`inline-flex items-center gap-2 text-sm font-medium transition-colors 
                                        hover:bg-accent/50 px-3 py-2 rounded-md ${isOnTicketsRoute
                                            ? "text-indigo-600 dark:text-indigo-400 bg-accent/80"
                                            : "text-foreground hover:text-indigo-600 dark:hover:text-indigo-400"
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
                                            ? "text-indigo-600 dark:text-indigo-400 bg-accent/80"
                                            : "text-foreground hover:text-indigo-600 dark:hover:text-indigo-400"
                                        }`}
                                >
                                    <ScanEye className="w-4 h-4" />
                                    Summarization
                                </Link>
                            </div>
                        </div>

                        <div className="flex-1 overflow-hidden space-y-4 p-4">
                            {/* Container must be relative so we can position the autocomplete dropdown */}
                            <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-start">
                                <div ref={searchContainerRef} className="relative max-w-64 w-full">
                                    <div className="flex items-center gap-2">
                                        <Input
                                            ref={searchInputRef}
                                            placeholder={`Search file ${searchByContent ? 'content' : 'name'}... (${formatShortcut('mod+f')})`}
                                            value={fileSearch}
                                            onChange={(e) => {
                                                setFileSearch(e.target.value)
                                                setShowAutocomplete(!!e.target.value.trim())
                                                setAutocompleteIndex(-1)
                                            }}
                                            className="pr-8 w-full"
                                            onFocus={() => setShowAutocomplete(!!fileSearch.trim())}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Escape') {
                                                    searchInputRef.current?.blur()
                                                    setShowAutocomplete(false)
                                                } else if (e.key === 'ArrowDown') {
                                                    e.preventDefault()
                                                    if (showAutocomplete && fileSearch.trim()) {
                                                        setAutocompleteIndex((prev) =>
                                                            Math.min(suggestions.length - 1, prev + 1)
                                                        )
                                                    } else {
                                                        handleNavigateToFileTree()
                                                    }
                                                } else if (e.key === 'ArrowUp') {
                                                    e.preventDefault()
                                                    if (showAutocomplete && fileSearch.trim()) {
                                                        setAutocompleteIndex((prev) =>
                                                            Math.max(0, prev - 1)
                                                        )
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

                                <div className="flex lg:hidden items-center justify-between">
                                    <div className="block">
                                        <SelectedFilesDrawer
                                            selectedFiles={selectedFiles}
                                            fileMap={allFilesMap}
                                            onRemoveFile={(fileId) => {
                                                updateActiveTab(prev => ({
                                                    ...prev,
                                                    selectedFiles: prev.selectedFiles?.filter(id => id !== fileId) || []
                                                }))
                                            }}
                                            trigger={selectedFilesButton}
                                            projectTabId={activeProjectTabId || 'defaultTab'}
                                            selectedFilesState={selectedFilesState}
                                        />
                                    </div>
                                </div>

                                {/* Autocomplete suggestions dropdown */}
                                {showAutocomplete && fileSearch.trim() && suggestions.length > 0 && (
                                    <ul
                                        className="absolute top-11 left-0 z-10 w-full bg-background border border-border rounded-md shadow-md max-h-56 overflow-auto"
                                    >
                                        <li className="px-2 py-1.5 text-sm text-muted-foreground bg-muted border-b border-border">
                                            Press Enter{allowSpacebaseToSelect && <span> or Spacebar</span>} to add highlighted file to selection, right arrow to preview file
                                        </li>
                                        {suggestions.map((file, index) => {
                                            const isHighlighted = index === autocompleteIndex
                                            const isSelected = selectedFiles.includes(file.id)
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

                            {filesLoading ? (
                                <>
                                    <Skeleton className="h-8 w-1/2" />
                                    <Skeleton className="h-8 w-2/3" />
                                </>
                            ) : (
                                fileTree ? (
                                    <div className="flex-1 lg:flex min-h-0 overflow-hidden">
                                        <div className="flex flex-col flex-1 min-h-0">
                                            <ScrollArea className="flex-1 min-h-0 border rounded-md max-h-[62vh]" type="auto">
                                                <FileTree
                                                    ref={fileTreeRef}
                                                    root={fileTree}
                                                    selectedFiles={selectedFiles}
                                                    setSelectedFiles={handleSetSelectedFiles}
                                                    fileMap={fileMap}
                                                    onViewFile={openFileViewer}
                                                    projectRoot={projectData?.path || ''}
                                                    resolveImports={resolveImports}
                                                    preferredEditor={preferredEditor}
                                                    onNavigateRight={handleNavigateToSelectedFiles}
                                                    onNavigateToSearch={handleNavigateToSearch}
                                                />
                                            </ScrollArea>
                                        </div>
                                        <div className="hidden lg:flex lg:flex-col w-64 pl-4 min-h-0">
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="flex text-sm font-medium items-center space-x-2">
                                                    <Badge variant="secondary">{selectedFiles.length}</Badge>
                                                    <span>Selected Files</span>
                                                    <InfoTooltip>
                                                        Selected files will be included with your prompt.
                                                        <ul>
                                                            <li>- Use arrow keys <ShortcutDisplay shortcut={['up', 'down']} /> to navigate the selected files list.</li>
                                                            <li>- Press <ShortcutDisplay shortcut={['r', '[1-9]']} /> or <ShortcutDisplay shortcut={['delete', 'backspace']} /> to remove a file from the selected list.</li>
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
                                                    onRemoveFile={removeSelectedFile}
                                                    onNavigateLeft={handleNavigateToFileTree}
                                                    onNavigateRight={onNavigateToPrompts}
                                                    className="w-60"
                                                    projectTabId={activeProjectTabId || 'defaultTab'}
                                                    selectedFilesState={selectedFilesState}
                                                />
                                            </ScrollArea>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">No files found.</p>
                                )
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <p className="text-muted-foreground">Select a project to view files</p>
                    </div>
                )}
            </div>

            <FileViewerDialog
                open={!!viewedFile}
                viewedFile={viewedFile}
                onClose={() => {
                    setViewedFile(null)
                    // Refocus the search input after a small delay to ensure the dialog is fully closed
                    setTimeout(() => {
                        searchInputRef.current?.focus()
                        // Restore autocomplete state
                        setShowAutocomplete(!!fileSearch.trim())
                    }, 0)
                }}
            />
        </div>
    )
})