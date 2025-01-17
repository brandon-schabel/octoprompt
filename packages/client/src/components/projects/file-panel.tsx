import { useState, useMemo, useRef, useImperativeHandle, forwardRef } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Copy } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FileTree, FileTreeRef } from '@/components/projects/file-tree/file-tree'
import { SelectedFilesList, SelectedFilesListRef } from '@/components/projects/selected-files-list'
import { useGetProjectFiles, useSyncProjectInterval } from '@/hooks/api/use-projects-api'
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
    const activeProjectTabId = state?.projectActiveTabId

    // Now we can do everything from our updated useSelectedFiles:
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

    // For file viewer
    const [viewedFile, setViewedFile] = useState<ProjectFile | null>(null)

    // Query: get files, poll for sync
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

    const fileMap = useMemo(() => {
        const map = new Map<string, ProjectFile>()
        filteredFiles.forEach(f => map.set(f.id, f))
        return map
    }, [filteredFiles])

    const openFileViewer = (file: ProjectFile) => {
        setViewedFile(file)
    }

    const handleSetSelectedFiles = (updater: (prev: string[]) => string[]) => {
        // This method is used by <FileTree /> internally
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
            <Badge
                variant="secondary"
                className="ml-2"
            >
                {selectedFiles.length}
            </Badge>
        </Button>
    )


    return (
        <div id="outer-area" className={`flex flex-col  ${className}`}>
            <div className="flex-1 space-y-4 transition-all duration-300 ">
                {selectedProjectId ? (
                    <div className=" h-full flex flex-col space-y-4 ">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 pt-4">
                            <div>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <h2 className="text-lg font-semibold hover:cursor-help">{projectData.name}</h2>
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
                                <span className="hidden md:block text-sm text-muted-foreground">{projectData.path.slice(0, 100)}</span>
                            </div>
                            <div className="flex items-center space-x-4">
                                <ProjectSettingsDialog />
                            </div>
                        </div>

                        <div className="flex-1 overflow-hidden space-y-4 p-4">

                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-start">
                                <Input
                                    ref={searchInputRef}
                                    placeholder={`Search file ${searchByContent ? 'content' : 'name'}... (${formatModShortcut('s')})`}
                                    value={fileSearch}
                                    onChange={(e) => setFileSearch(e.target.value)}
                                    className="max-w-64"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Escape') {
                                            searchInputRef.current?.blur()
                                        } else if (e.key === 'ArrowDown') {
                                            e.preventDefault() // Prevent scrolling
                                            fileTreeRef.current?.focusTree()
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
                                            fileMap={fileMap}
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
                                                <div className="text-sm font-medium"><Badge variant="secondary">{selectedFiles.length}</Badge>Selected Files </div>
                                            </div>

                                            <ScrollArea
                                                className="flex-1 min-h-0 border rounded-md max-h-[50vh] items-center flex w-60 "
                                                type="auto"
                                            >
                                                <SelectedFilesList
                                                    ref={selectedFilesListRef}
                                                    selectedFiles={selectedFiles}
                                                    fileMap={fileMap}
                                                    onRemoveFile={removeSelectedFile}
                                                    onNavigateLeft={handleNavigateToFileTree}
                                                    onNavigateRight={onNavigateToPrompts}
                                                    className='w-60'
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