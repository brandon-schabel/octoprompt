import React, { memo, useMemo, useState, useCallback, useRef } from "react"
import { useDebounce } from "@/hooks/utility-hooks/use-debounce"
import { useActiveProjectTab } from "@/zustand/selectors"
import { useGetProject, useGetProjectFiles } from "@/hooks/api/use-projects-api"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { InfoTooltip } from "@/components/info-tooltip"
import { ShortcutDisplay } from "@/components/app-shortcut-display"
import { formatShortcut } from "@/lib/shortcuts"
import { X } from "lucide-react"

import { useProjectTabField } from "@/zustand/zustand-utility-hooks"
import { useSelectedFiles } from "@/hooks/utility-hooks/use-selected-files"

import type { ProjectFile } from "shared/schema"
import { useClickAway } from "@/hooks/use-click-away"
import { SelectedFilesListRef } from "../../selected-files-list"
import { buildFileTree } from "../../utils/projects-utils"
import { FileTreeRef, FileTree } from "../file-tree/file-tree"
import { SelectedFilesListDisplay } from "./selected-files-list-display"
import { NoResultsScreen } from "./no-results-screen"
import { EmptyProjectScreen } from "./empty-project-screen"
import { SelectedFilesDrawer } from "../../selected-files-drawer"
import { AIFileChangeDialog } from "@/components/file-changes/ai-file-change-dialog"
import { FileViewerDialog } from "@/components/navigation/file-viewer-dialog"
import { useQueryClient } from '@tanstack/react-query'
import { PROJECT_FILES_KEYS } from '@/hooks/api/use-projects-api'

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

export function FileExplorer({
    ref,
    allowSpacebarToSelect,
}: FileExplorerProps) {
    const { id: activeProjectTabId, selectedProjectId } = useActiveProjectTab()
    /**
     * The server will do a fresh sync (via "GET /api/projects/:id/files") 
     * then we store them in React Query's cache.
     */
    const { data: fileData, isLoading: filesLoading } = useGetProjectFiles(selectedProjectId || '')
    const { data: projectData } = useGetProject(selectedProjectId || '')
    const queryClient = useQueryClient()

    const [viewedFile, setViewedFile] = useState<ProjectFile | null>(null)
    const closeFileViewer = () => setViewedFile(null)

    const { data: searchByContent = false, mutate: setSearchByContent } =
        useProjectTabField('searchByContent', activeProjectTabId || '')
    const { data: preferredEditor = 'vscode' } =
        useProjectTabField('preferredEditor', activeProjectTabId || '')
    const { data: resolveImports = false } =
        useProjectTabField('resolveImports', activeProjectTabId || '')

    const [localFileSearch, setLocalFileSearch] = useState('')
    const debouncedSetFileSearch = useDebounce(setLocalFileSearch, 300)

    const [showAutocomplete, setShowAutocomplete] = useState(false)
    const [autocompleteIndex, setAutocompleteIndex] = useState(-1)

    const [aiDialogOpen, setAiDialogOpen] = useState(false)
    const [selectedFile, setSelectedFile] = useState<ProjectFile>()

    const handleSearchChange = useCallback((val: string) => {
        setLocalFileSearch(val)
        debouncedSetFileSearch(val)
        setShowAutocomplete(!!(val || '').trim())
        setAutocompleteIndex(-1)
    }, [debouncedSetFileSearch])

    const {
        selectedFiles,
        selectFiles,
        projectFileMap,
    } = useSelectedFiles()

    const filteredFiles = useMemo(() => {
        if (!fileData?.files) return []
        const trimmed = (localFileSearch || '').trim().toLowerCase()
        if (!trimmed) return fileData.files
        if (searchByContent) {
            return fileData.files.filter(f => {
                return f.path.toLowerCase().includes(trimmed) ||
                    f.content?.toLowerCase().includes(trimmed)
            })
        }
        return fileData.files.filter(f => f.path.toLowerCase().includes(trimmed))
    }, [fileData?.files, localFileSearch, searchByContent])

    const fileTree = useMemo(() => {
        if (!filteredFiles.length) return {}
        return buildFileTree(filteredFiles)
    }, [filteredFiles])

    const filteredFilesMap = useMemo(() => {
        const m = new Map<string, ProjectFile>()
        filteredFiles.forEach(f => m.set(f.id, f))
        return m
    }, [filteredFiles])

    const suggestions = useMemo(() => filteredFiles.slice(0, 10), [filteredFiles])

    const toggleFileInSelection = useCallback((file: ProjectFile) => {
        selectFiles(prev => {
            if (prev.includes(file.id)) {
                return prev.filter(id => id !== file.id)
            }
            return [...prev, file.id]
        })
    }, [selectFiles])

    const searchContainerRef = useRef<HTMLDivElement>(null)
    useClickAway(searchContainerRef, () => {
        setShowAutocomplete(false)
        setAutocompleteIndex(-1)
    })

    const renderMobileSelectedFilesDrawerButton = () => {
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
                fileMap={projectFileMap}
                onRemoveFile={() => { }}
                trigger={trigger}
                projectTabId={activeProjectTabId ?? ''}
            />
        )
    }

    const handleRequestAIFileChange = (filePath: string) => {
        const file = fileData?.files?.find(f => f.path === filePath)
        if (file) {
            setSelectedFile(file)
            setAiDialogOpen(true)
        }
    }

    return (
        <div className="flex flex-col space-y-4 h-full">
            <FileViewerDialog
                open={!!viewedFile}
                viewedFile={viewedFile}
                onClose={closeFileViewer}
            />
            <div
                ref={searchContainerRef}
                className="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-start"
            >
                <div className="relative max-w-64 w-full">
                    <div className="flex items-center gap-2">
                        <Input
                            ref={ref.searchInputRef}
                            placeholder={`Search file ${searchByContent ? 'content' : 'name'}... (${formatShortcut('mod+f')})`}
                            value={localFileSearch || ''}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className="pr-8 w-full"
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
                                        setViewedFile?.(suggestions[autocompleteIndex])
                                    }
                                } else if (e.key === 'Enter' || (allowSpacebarToSelect && e.key === ' ')) {
                                    if (autocompleteIndex >= 0) {
                                        e.preventDefault()
                                    }
                                    if (autocompleteIndex >= 0 && autocompleteIndex < suggestions.length) {
                                        toggleFileInSelection(suggestions[autocompleteIndex])
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
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-accent hover:text-accent-foreground"
                            onClick={() => {
                                handleSearchChange('')
                                setShowAutocomplete(false)
                                setAutocompleteIndex(-1)
                                ref.searchInputRef.current?.focus()
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
                    onClick={() => setSearchByContent((prev) => !prev)}
                >
                    {searchByContent ? 'Search Content' : 'Search Names'}
                </Button>

                <InfoTooltip>
                    <div className="space-y-2">
                        <p>File Search Keyboard Shortcuts:</p>
                        <ul>
                            <li>
                                <ShortcutDisplay shortcut={['up', 'down']} /> Navigate suggestions
                            </li>
                            <li>
                                <ShortcutDisplay shortcut={['enter']} /> or {allowSpacebarToSelect && <ShortcutDisplay shortcut={['space']} />} to add highlighted file
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
                </InfoTooltip>

                <div className="flex lg:hidden items-center justify-between">
                    {renderMobileSelectedFilesDrawerButton()}
                </div>

                {showAutocomplete && (localFileSearch || '').trim() && suggestions.length > 0 && (
                    <ul className="absolute top-11 left-0 z-10 w-full bg-background border border-border rounded-md shadow-md max-h-56 overflow-auto">
                        <li className="px-2 py-1.5 text-sm text-muted-foreground bg-muted border-b border-border">
                            Press Enter{allowSpacebarToSelect && ' or Spacebar'} to add highlighted file; Right arrow to preview
                        </li>
                        {suggestions.map((file, index) => {
                            const isHighlighted = index === autocompleteIndex
                            const isSelected = selectedFiles.includes(file.id)
                            return (
                                <li
                                    key={file.id}
                                    className={`px-2 py-1 cursor-pointer flex items-center justify-between ${isHighlighted ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
                                        }`}
                                    onMouseDown={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        toggleFileInSelection(file)
                                    }}
                                    onMouseEnter={() => setAutocompleteIndex(index)}
                                >
                                    <span>{file.path}</span>
                                    {isSelected && <Badge variant="secondary">Selected</Badge>}
                                </li>
                            )
                        })}
                    </ul>
                )}
            </div>

            {filesLoading ? (
                <div>
                    <Skeleton className="h-8 w-1/2" />
                    <Skeleton className="h-8 w-2/3" />
                </div>
            ) : !fileData?.files?.length ? (
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
                <div className="flex-1 lg:flex min-h-0">
                    <div className="flex flex-col flex-1 min-h-0">
                        <ScrollArea className="flex-1 min-h-0 border rounded-md">
                            <FileTree
                                ref={ref.fileTreeRef}
                                root={fileTree}
                                onViewFile={setViewedFile}
                                projectRoot={''}
                                resolveImports={resolveImports}
                                preferredEditor={preferredEditor as 'vscode' | 'cursor' | 'webstorm'}
                                onNavigateRight={() => ref.selectedFilesListRef.current?.focusList()}
                                onNavigateToSearch={() => ref.searchInputRef.current?.focus()}
                                onRequestAIFileChange={handleRequestAIFileChange}
                            />
                        </ScrollArea>
                    </div>
                    <div className="hidden lg:flex lg:flex-col w-64 pl-4 min-h-0">
                        <SelectedFilesListDisplay
                            allFilesMap={projectFileMap}
                            selectedFilesListRef={ref.selectedFilesListRef}
                            onNavigateToFileTree={() => ref.fileTreeRef.current?.focusTree()}
                        />
                    </div>
                </div>
            )}
            {projectData?.project && <AIFileChangeDialog
                open={aiDialogOpen}
                onOpenChange={setAiDialogOpen}
                filePath={(projectData?.project?.path || '') + "/" + (selectedFile?.path || '')}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: PROJECT_FILES_KEYS.list(selectedProjectId || '') })
                    setAiDialogOpen(false)
                    setSelectedFile(undefined)
                }}
            />}
        </div>
    )
}