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
import { X, ListTree, Network, Maximize2 } from "lucide-react"
import { useNavigate } from "@tanstack/react-router"

import { useProjectTabField } from "@/zustand/zustand-utility-hooks"
import { useSelectedFiles } from "@/hooks/utility-hooks/use-selected-files"

import type { ProjectFile } from "shared/schema"
import { useClickAway } from "@/hooks/use-click-away"
import { SelectedFilesListRef } from "../../selected-files-list"
import { buildFileTree } from "../../utils/projects-utils"
import { FileTreeRef, FileTree } from "../file-tree/file-tree"
import { FileGraphRef, FileGraph } from "../file-graph/file-graph"
import { SelectedFilesListDisplay } from "./selected-files-list-display"
import { NoResultsScreen } from "./no-results-screen"
import { EmptyProjectScreen } from "./empty-project-screen"
import { SelectedFilesDrawer } from "../../selected-files-drawer"
import { AIFileChangeDialog } from "@/components/file-changes/ai-file-change-dialog"
import { FileViewerDialog } from "@/components/navigation/file-viewer-dialog"
import { useQueryClient } from '@tanstack/react-query'
import { PROJECT_FILES_KEYS } from '@/hooks/api/use-projects-api'
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

// View mode for file representation
type ViewMode = "tree" | "graph";

type ExplorerRefs = {
    searchInputRef: React.RefObject<HTMLInputElement>
    fileTreeRef: React.RefObject<FileTreeRef>
    fileGraphRef?: React.RefObject<FileGraphRef>
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
    const navigate = useNavigate();
    /**
     * The server will do a fresh sync (via "GET /api/projects/:id/files") 
     * then we store them in React Query's cache.
     */
    const { data: fileData, isLoading: filesLoading } = useGetProjectFiles(selectedProjectId || '')
    const { data: projectData } = useGetProject(selectedProjectId || '')
    const queryClient = useQueryClient()

    // View mode state
    const [viewMode, setViewMode] = useState<ViewMode>("tree");
    const fileGraphRef = useRef<FileGraphRef>(null);

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
        const file = fileData?.files.find(f => f.path === filePath);
        if (file) {
            setSelectedFile(file);
            setAiDialogOpen(true);
        }
    };

    // View file handler
    const handleViewFile = (file: ProjectFile) => {
        setViewedFile(file);
    };

    // Handle Tab Change
    const handleViewModeChange = (value: string) => {
        setViewMode(value as ViewMode);
    };

    const handleNavigateToFullGraph = () => {
        navigate({ to: '/file-graph' });
    };

    if (!fileData || filesLoading) {
        return (
            <div className="p-4 space-y-4">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-[300px] w-full" />
            </div>
        );
    }

    if (fileData.files.length === 0) {
        return (
            <EmptyProjectScreen 
                fileSearch={localFileSearch}
                setFileSearch={setLocalFileSearch} 
                setSearchByContent={setSearchByContent}
            />
        );
    }

    const totalFilteredFiles = filteredFiles.length;
    if (localFileSearch && totalFilteredFiles === 0) {
        return (
            <NoResultsScreen 
                fileSearch={localFileSearch}
                searchByContent={searchByContent}
                setFileSearch={setLocalFileSearch}
                setSearchByContent={setSearchByContent}
            />
        );
    }

    return (
        <>
            <div className="space-y-4">
                <div className="flex items-center space-x-2">
                    <Input
                        ref={ref.searchInputRef}
                        type="text"
                        className="flex-1"
                        placeholder="Search files... (Cmd+F)"
                        value={localFileSearch}
                        onChange={(e) => handleSearchChange(e.target.value)}
                    />
                    {localFileSearch && (
                        <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleSearchChange("")}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>

                <Tabs
                    defaultValue="tree"
                    value={viewMode}
                    onValueChange={handleViewModeChange}
                    className="w-full"
                >
                    <TabsList className="w-full mb-4">
                        <TabsTrigger value="tree" className="flex-1">
                            <ListTree className="h-4 w-4 mr-2" />
                            Tree View
                        </TabsTrigger>
                        <TabsTrigger value="graph" className="flex-1">
                            <Network className="h-4 w-4 mr-2" />
                            Graph View
                        </TabsTrigger>
                    </TabsList>

                    {viewMode === 'graph' && (
                        <div className="flex justify-end mb-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleNavigateToFullGraph}
                                className="text-xs"
                            >
                                <Maximize2 className="h-3.5 w-3.5 mr-1.5" />
                                Full Page View
                            </Button>
                        </div>
                    )}

                    <TabsContent value="tree" className="mt-0">
                        <div className="h-[500px]">
                            <FileTree
                                ref={ref.fileTreeRef}
                                root={fileTree}
                                onViewFile={handleViewFile}
                                projectRoot={projectData?.project?.path || ""}
                                resolveImports={resolveImports}
                                preferredEditor={preferredEditor}
                                onRequestAIFileChange={handleRequestAIFileChange}
                            />
                        </div>
                    </TabsContent>

                    <TabsContent value="graph" className="mt-0">
                        <div className="h-[500px]">
                            <FileGraph
                                ref={fileGraphRef}
                                root={fileTree}
                                onViewFile={handleViewFile}
                                projectRoot={projectData?.project?.path || ""}
                                onRequestAIFileChange={handleRequestAIFileChange}
                            />
                        </div>
                    </TabsContent>
                </Tabs>

                <SelectedFilesListDisplay
                    allFilesMap={projectFileMap}
                    selectedFilesListRef={ref.selectedFilesListRef}
                    onNavigateToFileTree={() => ref.fileTreeRef.current?.focusTree()}
                />
            </div>

            {viewedFile && (
                <FileViewerDialog
                    key={viewedFile.path}
                    open={!!viewedFile}
                    viewedFile={viewedFile}
                    onClose={closeFileViewer}
                />
            )}

            <AIFileChangeDialog
                open={aiDialogOpen}
                onOpenChange={setAiDialogOpen}
                filePath={(projectData?.project?.path || '') + "/" + (selectedFile?.path || '')}
                onSuccess={() => {
                    // Refresh file list after successful AI edit
                    queryClient.invalidateQueries({
                        queryKey: PROJECT_FILES_KEYS.list(selectedProjectId || ""),
                    });
                }}
            />
        </>
    );
}