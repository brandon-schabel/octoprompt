import { useState, useRef, useEffect, useCallback, KeyboardEvent, forwardRef, useImperativeHandle } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Folder, File as FileIcon, ChevronRight, Eye, Code } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getRecursiveImports, buildTsconfigAliasMap } from './utils/import-resolver'
import { getEditorUrl } from '@/lib/editor-urls'
import { useHotkeys } from 'react-hotkeys-hook'
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
    FileNode,
    countTotalFiles,
    calculateFolderTokens,
    areAllFolderFilesSelected,
    isFolderPartiallySelected,
    toggleFile as toggleFileUtil,
    toggleFolder as toggleFolderUtil,
    formatTokenCount
} from './utils/file-node-tree-utils'
import { ProjectFile } from 'shared/schema'
import { toast } from 'sonner'
import { buildNodeContent } from '@/components/projects/utils/projects-utils'
import clsx from 'clsx'
import { formatModShortcut } from '@/lib/platform'
import { EditorType } from 'shared/src/global-state/global-state-schema'
import { useGlobalStateContext } from '@/components/global-state-context'

type SetSelectedFilesFunction = (updater: (prev: string[]) => string[]) => void;

type VisibleItem = {
    path: string;
    name: string;
    node: FileNode;
    depth: number;
    parentPath?: string;
};

type FileTreeProps = {
    root: Record<string, FileNode>
    selectedFiles: string[]
    setSelectedFiles: SetSelectedFilesFunction
    fileMap: Map<string, ProjectFile>
    onViewFile?: (file: ProjectFile) => void
    projectRoot: string
    resolveImports?: boolean
    preferredEditor: EditorType
    onNavigateRight?: () => void
    onNavigateToSearch?: () => void
}

async function copyFilePath(path: string) {
    try {
        await navigator.clipboard.writeText(path)
        toast.success("File path copied to clipboard")
    } catch (err) {
        console.error("Failed to copy file path", err)
        toast.error("Failed to copy file path")
    }
}

const FileTreeNodeRow = forwardRef<HTMLDivElement, {
    item: VisibleItem;
    isOpen: boolean;
    isFocused: boolean;
    onFocus: () => void;
    onToggleOpen: () => void;
    setSelectedFiles: SetSelectedFilesFunction;
    fileMap: Map<string, ProjectFile>;
    onViewFile?: (file: ProjectFile) => void;
    projectRoot: string;
}>(({
    item,
    isOpen,
    isFocused,
    onFocus,
    onToggleOpen,
    setSelectedFiles,
    fileMap,
    onViewFile,
    projectRoot,
}, ref) => {
    const { activeProjectTabState: activeTabState } = useGlobalStateContext()
    const selectedFiles = activeTabState?.selectedFiles || []
    const resolveImports = activeTabState?.resolveImports || false
    const preferredEditor = activeTabState?.preferredEditor || 'vscode'


    const isFolder = item.node._folder === true

    const folderChecked = isFolder
        ? areAllFolderFilesSelected(item.node, selectedFiles)
        : selectedFiles.includes(item.node.file?.id ?? '')

    const folderIndeterminate = isFolder && isFolderPartiallySelected(item.node, selectedFiles)

    const handleToggleFile = (fileId: string): void => {
        setSelectedFiles(prev => toggleFileUtil(
            fileId,
            prev,
            resolveImports ?? false,
            fileMap,
            getRecursiveImports,
            buildTsconfigAliasMap
        ))
    }

    const handleToggleFolder = (folderNode: FileNode, select: boolean): void => {
        setSelectedFiles(prev => toggleFolderUtil(folderNode, select, prev))
    }

    useEffect(() => {
        if (isFocused && ref && 'current' in ref && ref.current) {
            ref.current.scrollIntoView({ block: 'nearest' })
            ref.current.focus()
        }
    }, [isFocused, ref])

    const handleEnter = useCallback(() => {
        if (isFolder) {
            onToggleOpen()
        } else if (item.node.file && onViewFile) {
            onViewFile(item.node.file)
        }
    }, [isFolder, onToggleOpen, onViewFile, item.node.file])

    const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter') {
            handleEnter()
        } else if (e.key === 'Escape') {
            e.currentTarget.blur();
        } else if (e.key === ' ') {
            e.preventDefault();
            if (isFolder) {
                handleToggleFolder(item.node, !folderChecked);
            } else if (item.node.file?.id) {
                handleToggleFile(item.node.file.id);
            }
        }
    }, [handleEnter, isFolder, item.node, folderChecked, handleToggleFile, handleToggleFolder])

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <div
                    ref={ref}
                    className={cn(
                        "flex flex-col outline-none",
                        isFocused && "bg-accent"
                    )}
                    style={{
                        paddingLeft: item.depth > 0 ? `${Math.min(item.depth * 8, 64)}px` : undefined,
                    }}
                    tabIndex={0}
                    onClick={onFocus}
                    onKeyDown={handleKeyDown}
                >
                    <div className="flex items-center hover:bg-muted/50 rounded-sm gap-1 group">
                        {item.node._folder ? (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 p-0"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onToggleOpen()
                                }}
                            >
                                <ChevronRight
                                    className={cn("h-4 w-4 transition-transform", isOpen && "rotate-90")}
                                />
                            </Button>
                        ) : (
                            <div className="w-6" />
                        )}
                        <Checkbox
                            checked={folderIndeterminate ? 'indeterminate' : folderChecked}
                            onCheckedChange={(checked) => {
                                if (isFolder) {
                                    if (folderIndeterminate) {
                                        handleToggleFolder(item.node, false)
                                    } else {
                                        handleToggleFolder(item.node, checked === true)
                                    }
                                } else if (item.node.file?.id) {
                                    handleToggleFile(item.node.file.id)
                                }
                            }}
                        />
                        {isFolder ? (
                            <Folder className="h-4 w-4" />
                        ) : (
                            <FileIcon className="h-4 w-4" />
                        )}
                        <span className="font-mono text-sm truncate">{item.name}</span>
                        {((!isFolder && item.node.file?.content) || isFolder) && (
                            <div className="flex items-center gap-2 ml-2">
                                {isFolder ? (
                                    <>
                                        {(() => {
                                            const { selectedTokens, totalTokens } = calculateFolderTokens(item.node, selectedFiles)

                                            return (
                                                <span className={clsx('text-xs text-muted-foreground', {
                                                    'text-primary font-semibold': selectedTokens === totalTokens
                                                })}>
                                                    {formatTokenCount(selectedTokens)}/{formatTokenCount(totalTokens)}
                                                </span>

                                            )
                                        })()}
                                    </>
                                ) : (
                                    <span className={cn(
                                        "text-xs",
                                        selectedFiles.includes(item.node.file?.id ?? '')
                                            ? "text-primary font-medium"
                                            : "text-muted-foreground"
                                    )}>
                                        {formatTokenCount(item.node.file!.content || '')}
                                    </span>
                                )}
                            </div>
                        )}
                        {!isFolder && item.node.file && (
                            <>
                                {onViewFile && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onViewFile(item.node.file!)
                                        }}
                                    >
                                        <Eye className="h-4 w-4" />
                                    </Button>
                                )}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                                    asChild
                                >
                                    <a
                                        href={getEditorUrl(preferredEditor, `${projectRoot}/${item.node.file.path}`)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <Code className="h-4 w-4" />
                                    </a>
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </ContextMenuTrigger>

            <ContextMenuContent>
                <ContextMenuItem
                    onClick={() => {
                        if (item.node.file?.path) {
                            void copyFilePath(item.node.file.path)
                        }
                    }}
                >
                    Copy Relative Path
                </ContextMenuItem>
                <ContextMenuItem
                    onClick={() => {
                        if (item.node.file?.path) {
                            void copyFilePath(`${projectRoot}/${item.node.file.path}`)
                        }
                    }}
                >
                    Copy Absolute Path
                </ContextMenuItem>
                <ContextMenuItem
                    onClick={async () => {
                        const content = buildNodeContent(item.node, fileMap, isFolder)
                        try {
                            await navigator.clipboard.writeText(content)
                            toast.success(`${isFolder ? 'Folder' : 'File'} contents copied to clipboard`)
                        } catch (err) {
                            toast.error(`Failed to copy ${isFolder ? 'folder' : 'file'} contents`)
                            console.error(err)
                        }
                    }}
                >
                    Copy {isFolder ? 'Folder' : 'File'} Contents
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    )
})

export type FileTreeRef = {
    focusTree: (index?: number) => void
}

export const FileTree = forwardRef<FileTreeRef, FileTreeProps>(({
    root,
    setSelectedFiles,
    fileMap,
    onViewFile,
    projectRoot,
    resolveImports,
    onNavigateRight,
    onNavigateToSearch
}, ref) => {
    const totalFiles = countTotalFiles(root)
    const autoExpand = totalFiles < 20

    const [openPaths, setOpenPaths] = useState<Map<string, boolean>>(new Map())
    const [visibleItems, setVisibleItems] = useState<VisibleItem[]>([])
    const [focusedIndex, setFocusedIndex] = useState<number>(-1)
    const rowRefs = useRef<(HTMLDivElement | null)[]>([])
    const [lastFocusedIndex, setLastFocusedIndex] = useState<number>(-1)

    // ------------------------------------
    // 1) Local "isFocused" state to scope hotkeys
    // ------------------------------------
    const [isFocused, setIsFocused] = useState(false);

    useImperativeHandle(ref, () => ({
        focusTree: (index?: number) => {
            const targetIndex = index ?? lastFocusedIndex
            if (targetIndex >= 0 && rowRefs.current[targetIndex]) {
                rowRefs.current[targetIndex]?.focus()
                setFocusedIndex(targetIndex)
            } else if (rowRefs.current[0]) {
                rowRefs.current[0]?.focus()
                setFocusedIndex(0)
            }
        }
    }), [lastFocusedIndex])

    useEffect(() => {
        if (focusedIndex >= 0) {
            setLastFocusedIndex(focusedIndex)
        }
    }, [focusedIndex])

    const buildVisibleItems = useCallback((): VisibleItem[] => {
        const result: VisibleItem[] = []

        function traverse(obj: Record<string, FileNode>, parentPath: string | undefined, depth: number) {
            // Sort entries to put folders first and sort alphabetically within each group
            const entries = Object.entries(obj).sort(([nameA, a], [nameB, b]) => {
                // First, separate folders and files
                if (a._folder && !b._folder) return -1;
                if (!a._folder && b._folder) return 1;
                // Then sort alphabetically within each group
                return nameA.toLowerCase().localeCompare(nameB.toLowerCase());
            });

            entries.forEach(([name, node]) => {
                const currentPath = parentPath ? `${parentPath}/${name}` : name
                result.push({
                    path: currentPath,
                    name,
                    node,
                    depth,
                    parentPath,
                })

                if (node._folder && node.children) {
                    const isNodeOpen = openPaths.get(currentPath) ?? autoExpand
                    if (isNodeOpen) {
                        traverse(node.children, currentPath, depth + 1)
                    }
                }
            })
        }

        traverse(root, undefined, 0)
        return result
    }, [root, openPaths, autoExpand])

    useEffect(() => {
        const items = buildVisibleItems()
        setVisibleItems(items)
        if (focusedIndex >= items.length) {
            setFocusedIndex(items.length - 1)
        }
    }, [buildVisibleItems, focusedIndex])

    const toggleOpen = useCallback((path: string) => {
        setOpenPaths((prev) => {
            const next = new Map(prev)
            const current = next.get(path)
            next.set(path, !current)
            return next
        })
    }, [])

    const focusParent = (item: VisibleItem) => {
        if (!item.parentPath) return
        const parentIndex = visibleItems.findIndex((i) => i.path === item.parentPath)
        if (parentIndex >= 0) {
            setFocusedIndex(parentIndex)
        }
    }

    const focusFirstChild = (folderPath: string) => {
        const childIndex = visibleItems.findIndex(
            (i) => i.parentPath === folderPath
        )
        if (childIndex !== -1) {
            setFocusedIndex(childIndex)
        }
    }

    const handleTreeKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
        if (focusedIndex < 0) return;

        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                if (focusedIndex > 0) {
                    setFocusedIndex((prev) => Math.max(prev - 1, 0));
                } else if (onNavigateToSearch) {
                    onNavigateToSearch();
                }
                break;
            case 'ArrowDown':
                e.preventDefault();
                setFocusedIndex((prev) => Math.min(prev + 1, visibleItems.length - 1));
                break;
            case 'ArrowLeft':
                e.preventDefault();
                const leftItem = visibleItems[focusedIndex];
                if (leftItem.node._folder) {
                    const isOpen = openPaths.get(leftItem.path) ?? autoExpand;
                    if (isOpen) {
                        toggleOpen(leftItem.path);
                        return;
                    }
                }
                focusParent(leftItem);
                break;
        }
    }, [focusedIndex, visibleItems, onNavigateToSearch, openPaths, autoExpand, toggleOpen])

    // ------------------------------------------------
    // 2) Pass "enabled: isFocused" to the arrow-key hotkeys
    // ------------------------------------------------
    useHotkeys(
        'right',
        (e) => {
            e.preventDefault()
            if (focusedIndex < 0) return
            const item = visibleItems[focusedIndex]
            if (item.node._folder) {
                const isOpen = openPaths.get(item.path) ?? autoExpand
                if (isOpen) {
                    focusFirstChild(item.path)
                } else {
                    toggleOpen(item.path)
                    setTimeout(() => {
                        const newItems = buildVisibleItems()
                        const childIndex = newItems.findIndex((i) => i.parentPath === item.path)
                        if (childIndex !== -1) {
                            setFocusedIndex(childIndex)
                        }
                    }, 0)
                }
            } else {
                // If it's a file, move over to the selected files
                onNavigateRight?.()
            }
        },
        { enabled: isFocused },
        [visibleItems, focusedIndex, openPaths, autoExpand, isFocused, onNavigateRight]
    )

    useHotkeys(
        'space',
        (e) => {
            e.preventDefault()
            if (focusedIndex < 0) return
            const item = visibleItems[focusedIndex]
            const { node } = item
            if (node._folder) {
                setSelectedFiles(prev => toggleFolderUtil(node, !areAllFolderFilesSelected(node, prev), prev))
            } else if (node.file?.id) {
                setSelectedFiles(prev => toggleFileUtil(
                    node.file!.id,
                    prev,
                    resolveImports ?? false,
                    fileMap,
                    getRecursiveImports,
                    buildTsconfigAliasMap
                ))
            }
        },
        { enabled: isFocused }, 
        [visibleItems, focusedIndex, setSelectedFiles, isFocused]
    )

    return (
        <div
            className='h-full overflow-y-auto'
            tabIndex={0}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={handleTreeKeyDown}
            onClick={(e) => {
                // Only focus the container if the user clicks the container itself
                if (e.target === e.currentTarget) {
                    e.currentTarget.focus()
                }
            }}
        >
            <div className="flex items-center justify-between px-2 py-1 text-xs text-muted-foreground">
                <span>Files</span>
                <span>{formatModShortcut('g')} to focus</span>
            </div>
            <div className="p-1">
                {visibleItems.map((item, idx) => {
                    const isOpen = item.node._folder
                        ? openPaths.get(item.path) ?? autoExpand
                        : false

                    return (
                        <FileTreeNodeRow
                            key={item.path}
                            ref={el => rowRefs.current[idx] = el}
                            item={item}
                            isOpen={isOpen}
                            isFocused={idx === focusedIndex}
                            onFocus={() => setFocusedIndex(idx)}
                            onToggleOpen={() => toggleOpen(item.path)}
                            setSelectedFiles={setSelectedFiles}
                            fileMap={fileMap}
                            onViewFile={onViewFile}
                            projectRoot={projectRoot}
                        />
                    )
                })}
            </div>
        </div>
    )
})