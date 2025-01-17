import { useState, useMemo, useRef, useImperativeHandle, forwardRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Copy } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FileTree, FileTreeRef } from '@/components/projects/file-tree/file-tree'
import { SelectedFilesList, SelectedFilesListRef } from '@/components/projects/selected-files-list'
import { useGetProjectFiles } from '@/hooks/api/use-projects-api'
import { buildFileTree } from '@/components/projects/utils/projects-utils'
import { FileViewerDialog } from '@/components/navigation/file-viewer-dialog'
import { useSelectedFiles } from '@/hooks/utility-hooks/use-selected-files'
import { Project } from 'shared/index'
import { ProjectFile } from 'shared/schema'
import { formatModShortcut } from '@/lib/platform'
import { useHotkeys } from 'react-hotkeys-hook'
import { toast } from 'sonner'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { SelectedFilesDrawer } from './selected-files-drawer'
import { Badge } from '../ui/badge'
import { ProjectSettingsDialog } from './project-settings-dialog'
import { useGlobalStateHelpers } from '../global-state/use-global-state-helpers'

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
}

export const FilePanel = forwardRef<FilePanelRef, FilePanelProps>(({
    selectedProjectId,
    projectData,
    fileSearch,
    setFileSearch,
    searchByContent,
    setSearchByContent,
    className,
    onNavigateToPrompts
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

    const {
        selectedFiles,
        removeSelectedFile,
        selectFiles,
        clearSelectedFiles,
        undo,
        redo,
        canUndo,
        canRedo,
    } = useSelectedFiles()

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

    // We’ll limit how many suggestions are shown to keep things tidy
    const suggestions = useMemo(() => filteredFiles.slice(0, 10), [filteredFiles])

    // In your file-panel.tsx (within FilePanel component):
    const selectFileFromAutocomplete = (file: ProjectFile) => {
        handleSetSelectedFiles((prev) => {
            // Toggle selection - remove if already selected, add if not
            if (prev.includes(file.id)) {
                return prev.filter(id => id !== file.id)
            }
            return [...prev, file.id]
        })

        // Keep the current index and autocomplete state
        setShowAutocomplete(true)
        searchInputRef.current?.focus()
    }

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
                            <div className="flex items-center space-x-4">
                                <ProjectSettingsDialog />
                            </div>
                        </div>

                        <div className="flex-1 overflow-hidden space-y-4 p-4">

                            {/* Container must be relative so we can position the autocomplete dropdown */}
                            <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-start">
                                <Input
                                    ref={searchInputRef}
                                    placeholder={`Search file ${searchByContent ? 'content' : 'name'}... (${formatModShortcut('f')})`}
                                    value={fileSearch}
                                    onChange={(e) => {
                                        setFileSearch(e.target.value)
                                        setShowAutocomplete(!!e.target.value.trim())
                                        setAutocompleteIndex(-1)
                                    }}
                                    className="max-w-64"
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
                                        } else if (e.key === 'Enter' || (allowSpacebaseToSelect && e.key === ' ')) {
                                            // If we're navigating autocomplete (index >= 0), always prevent default
                                            if (autocompleteIndex >= 0) {
                                                e.preventDefault()
                                            }
                                            // Only proceed with selection if we have a valid index
                                            if (autocompleteIndex >= 0 && autocompleteIndex < suggestions.length) {
                                                selectFileFromAutocomplete(suggestions[autocompleteIndex])
                                                // Move cursor down if there are more items
                                                if (autocompleteIndex < suggestions.length - 1) {
                                                    setAutocompleteIndex(prev => prev + 1)
                                                }
                                            }
                                        }
                                    }}
                                />
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSearchByContent(!searchByContent)}
                                >
                                    {searchByContent ? 'Search Content' : 'Search Names'}
                                </Button>

                                <div className="flex lg:hidden items-center justify-between">
                                    <div className="block">
                                        <SelectedFilesDrawer
                                            selectedFiles={selectedFiles}
                                            fileMap={allFilesMap}
                                            onRemoveFile={(fileId) => {
                                                updateActiveTab(prev => ({
                                                    ...prev,
                                                    selectedFiles: prev.selectedFiles.filter(id => id !== fileId)
                                                }))
                                            }}
                                            trigger={selectedFilesButton}
                                            projectTabId={activeProjectTabId || 'defaultTab'}
                                        />
                                    </div>
                                </div>

                                {/* Autocomplete suggestions dropdown */}
                                {showAutocomplete && fileSearch.trim() && suggestions.length > 0 && (
                                    <ul
                                        className="absolute top-11 left-0 z-10 w-full bg-white border border-gray-300 rounded-md shadow-md max-h-56 overflow-auto"
                                    >
                                        <li className="px-2 py-1.5 text-sm text-muted-foreground bg-muted/50 border-b">
                                            Press Enter{allowSpacebaseToSelect && <span > or Spacebar</span>} to add highlighted file to selection
                                            
                                        </li>
                                        {suggestions.map((file, index) => {
                                            const isHighlighted = index === autocompleteIndex
                                            const isSelected = selectedFiles.includes(file.id)
                                            return (
                                                <li
                                                    key={file.id}
                                                    className={`px-2 py-1 cursor-pointer flex items-center justify-between ${
                                                        isHighlighted ? 'bg-gray-200' : ''
                                                    }`}
                                                    onMouseDown={(e) => {
                                                        e.preventDefault()
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
                                                <div className="text-sm font-medium">
                                                    <Badge variant="secondary">{selectedFiles.length}</Badge>
                                                    Selected Files
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
                onClose={() => setViewedFile(null)}
            />
        </div>
    )
})