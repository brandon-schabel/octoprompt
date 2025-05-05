import React, {
    useState,
    useRef,
    useEffect,
    useCallback,
    KeyboardEvent,
    forwardRef,
    useImperativeHandle,
    RefObject,
    useMemo,
} from "react";
import { Button } from "@ui";
import { Checkbox } from "@ui";
import {
    Folder,
    File as FileIcon,
    ChevronRight,
    Eye,
    Code,
    Copy,
    Wand2,
    RefreshCw,
    ClipboardList,
} from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@ui";

import { useHotkeys } from "react-hotkeys-hook";
import { cn } from "@/lib/utils";
import { buildTsconfigAliasMap, getRecursiveImports } from "shared/src/utils/file-tree-utils/import-resolver";
import {
    toggleFile as toggleFileUtil,
    toggleFolder as toggleFolderUtil,
    calculateFolderTokens,
    areAllFolderFilesSelected,
    isFolderPartiallySelected,
    countTotalFiles,
    formatTokenCount,
    FileNode,
    estimateTokenCount,
} from "shared/src/utils/file-tree-utils/file-node-tree-utils";
import { buildNodeContent, buildNodeSummaries } from "shared/src/utils/projects-utils";

import { getEditorUrl } from "@/utils/editor-urls";
import { useSelectedFiles } from "@/hooks/utility-hooks/use-selected-files";
import { useRefreshProject } from "@/hooks/api/use-projects-api";
import { ProjectFile } from "shared/src/schemas/project.schemas";
import { useCopyClipboard } from "@/hooks/utility-hooks/use-copy-clipboard";
import { useActiveProjectTab } from "@/hooks/api/use-kv-api";

/**
 * The user's preferred external editor.
 */
export type EditorType = "vscode" | "webstorm" | "cursor" | "other";


export type VisibleItem = {
    path: string;
    name: string;
    node: FileNode;
    depth: number;
    parentPath?: string;
};

export type FileTreeProps = {
    root: Record<string, FileNode>;
    onViewFile?: (file: ProjectFile | null) => void;
    projectRoot: string;
    resolveImports?: boolean;
    preferredEditor: EditorType;
    onNavigateRight?: () => void;
    onNavigateToSearch?: () => void;
    onRequestAIFileChange?(filePath: string): void;
};

async function copyFilePath(path: string) {
    try {
        await navigator.clipboard.writeText(path);
        toast.success("File path copied to clipboard");
    } catch (err) {
        console.error("Failed to copy file path", err);
        toast.error("Failed to copy file path");
    }
}

/**
 * Utility to recursively build the folder tree structure as text.
 */
export function buildTreeStructure(node: FileNode, indent = ""): string {
    const lines: string[] = [];

    if (node._folder && node.children) {
        for (const [name, child] of Object.entries(node.children)) {
            lines.push(`${indent}${name}`);
            if (child._folder) {
                lines.push(buildTreeStructure(child, indent + "  "));
            }
        }
    }
    return lines.join("\n");
}

interface FileTreeNodeRowProps {
    item: VisibleItem;
    isOpen: boolean;
    isFocused: boolean;
    onFocus: () => void;
    onToggleOpen: () => void;
    onViewFile?: (file: ProjectFile) => void;
    projectRoot: string;
    onRequestAIFileChange?: (filePath: string) => void;
}

/**
 * Single row in the file tree (folder or file).
 * ForwardRef so we can focus DOM nodes from parent.
 */
const FileTreeNodeRow = forwardRef<HTMLDivElement, FileTreeNodeRowProps>(function FileTreeNodeRow(
    {
        item,
        isOpen,
        isFocused,
        onFocus,
        onToggleOpen,
        onViewFile,
        projectRoot,
        onRequestAIFileChange,
    },
    ref
) {
    const [projectTabState, , selectedProjectId] = useActiveProjectTab();
    const { selectedFiles, selectFiles, projectFileMap } = useSelectedFiles();
    const resolveImports = projectTabState?.resolveImports ?? false;
    const preferredEditor = projectTabState?.preferredEditor ?? "vscode";
    const { copyToClipboard } = useCopyClipboard()

    // New refresh functionality
    const { mutate: refreshProject } = useRefreshProject(selectedProjectId ?? "");

    const isFolder = item.node._folder === true;

    const folderChecked = isFolder
        ? areAllFolderFilesSelected(item.node, selectedFiles)
        : selectedFiles.includes(item.node.file?.id ?? "");

    const folderIndeterminate = isFolder && isFolderPartiallySelected(item.node, selectedFiles);

    const handleToggleFile = useCallback(
        (fileId: string) => {
            selectFiles(
                toggleFileUtil(
                    fileId,
                    selectedFiles,
                    resolveImports,
                    projectFileMap,
                    getRecursiveImports,
                    buildTsconfigAliasMap
                )
            );
        },
        [selectFiles, resolveImports, projectFileMap, selectedFiles]
    );

    const handleToggleFolder = useCallback(
        (folderNode: FileNode, select: boolean) => {
            selectFiles(toggleFolderUtil(folderNode, select, selectedFiles));
        },
        [selectFiles, selectedFiles]
    );

    useEffect(() => {
        if (isFocused && ref && "current" in ref && ref.current) {
            ref.current.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
        }
    }, [isFocused, ref]);

    const handleEnter = useCallback(() => {
        if (isFolder) {
            onToggleOpen();
        } else if (item.node.file && onViewFile) {
            onViewFile(item.node.file);
        }
    }, [isFolder, item.node.file, onToggleOpen, onViewFile]);

    const handleKeyDown = useCallback(
        (e: KeyboardEvent<HTMLDivElement>) => {
            if (e.key === "Enter") {
                handleEnter();
            } else if (e.key === "Escape") {
                e.currentTarget.blur();
            } else if (e.key === " ") {
                e.preventDefault();
                if (isFolder) {
                    handleToggleFolder(item.node, !folderChecked);
                } else if (item.node.file?.id) {
                    handleToggleFile(item.node.file.id);
                }
            }
        },
        [isFolder, item.node, folderChecked, handleToggleFile, handleToggleFolder, handleEnter]
    );


    const summaries = useMemo(() => buildNodeSummaries(item.node, isFolder), [item.node, isFolder]);
    const contents = useMemo(() => buildNodeContent(item.node, isFolder), [item.node, isFolder]);
    const tree = useMemo(() => buildTreeStructure(item.node), [item.node]);
    const hasSummary = item.node.file?.summary;

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <div
                    ref={ref}
                    className={cn("flex flex-col outline-none", isFocused && "bg-accent rounded-md")}
                    style={{
                        paddingLeft: item.depth > 0 ? `${Math.min(item.depth * 8, 64)}px` : undefined,
                    }}
                    tabIndex={0}
                    onClick={onFocus}
                    onKeyDown={handleKeyDown}
                >
                    <div className="flex items-center hover:bg-muted/50 rounded-sm gap-1 group">
                        {isFolder ? (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 p-0"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleOpen();
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
                            checked={folderIndeterminate ? "indeterminate" : folderChecked}
                            onCheckedChange={(checked) => {
                                if (isFolder) {
                                    if (folderIndeterminate) {
                                        handleToggleFolder(item.node, false);
                                    } else {
                                        handleToggleFolder(item.node, checked === true);
                                    }
                                } else if (item.node.file?.id) {
                                    handleToggleFile(item.node.file.id);
                                }
                            }}
                        />
                        {isFolder ? (
                            <Folder className="h-4 w-4" />
                        ) : (
                            <FileIcon className="h-4 w-4" />
                        )}
                        <span className="font-mono text-sm truncate">{item.name}</span>

                        {/* Token count display */}
                        {((!isFolder && item.node.file?.content) || isFolder) && (
                            <div className="flex items-center gap-2 ml-2">
                                {isFolder ? (
                                    (() => {
                                        const { selectedTokens, totalTokens } = calculateFolderTokens(
                                            item.node,
                                            selectedFiles
                                        );
                                        return (
                                            <span
                                                className={clsx("text-xs text-muted-foreground", {
                                                    "text-primary font-semibold": selectedTokens === totalTokens,
                                                })}
                                            >
                                                {formatTokenCount(selectedTokens)}/{formatTokenCount(totalTokens)}
                                            </span>
                                        );
                                    })()
                                ) : (
                                    <span
                                        className={cn(
                                            "text-xs",
                                            selectedFiles.includes(item.node.file?.id ?? "")
                                                ? "text-primary font-medium"
                                                : "text-muted-foreground"
                                        )}
                                    >
                                        {formatTokenCount(item.node.file!.content || "")}
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Inline icons for single file */}
                        {!isFolder && item.node.file && (
                            <>
                                {onViewFile && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onViewFile(item.node.file!);
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
                                        href={getEditorUrl(
                                            preferredEditor,
                                            `${projectRoot}/${item.node.file.path}`
                                        )}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <Code className="h-4 w-4" />
                                    </a>
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        await copyToClipboard(contents, {
                                            successMessage: "File contents copied to clipboard",
                                            errorMessage: "Failed to copy file contents"
                                        });
                                    }}
                                >
                                    <Copy className="h-4 w-4" />
                                </Button>

                                {/* --- New Copy Summary Button --- */}
                                {hasSummary && ( // Only show if file has a summary
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        title="Copy File Summary" // Add tooltip
                                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            // Use false for isFolder when copying single file summary
                                            const summary = buildNodeSummaries(item.node, false);
                                            if (summary) {
                                                copyToClipboard(summary, {
                                                    successMessage: "File summary copied to clipboard",
                                                    errorMessage: "Failed to copy file summary"
                                                })
                                            } else {
                                                toast.info("No summary available for this file.");
                                            }
                                        }}
                                    >
                                        <ClipboardList className="h-4 w-4" />
                                    </Button>
                                )}


                                {onRequestAIFileChange && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onRequestAIFileChange(item.node.file!.path);
                                        }}
                                    >
                                        <Wand2 className="h-4 w-4" />
                                    </Button>
                                )}


                            </>
                        )}
                    </div>
                </div>
            </ContextMenuTrigger>

            <ContextMenuContent>
                {/* File-specific context menu items */}
                {!isFolder && item.node.file?.path && (
                    <>
                        <ContextMenuItem
                            onClick={async () => {
                                await copyFilePath(item.node.file!.path);
                            }}
                        >
                            Copy Relative Path
                        </ContextMenuItem>
                        <ContextMenuItem
                            onClick={async () => {
                                await copyFilePath(`${projectRoot}/${item.node.file!.path}`);
                            }}
                        >
                            Copy Absolute Path
                        </ContextMenuItem>
                    </>
                )}

                {/* Copy contents for both files and folders */}
                <ContextMenuItem
                    onClick={async () => {
                        copyToClipboard(contents, {
                            successMessage: `${isFolder ? "Folder" : "File"} contents copied to clipboard`,
                            errorMessage: `Failed to copy ${isFolder ? "folder" : "file"} contents`
                        })
                    }}
                >
                    Copy {isFolder ? "Folder" : "File"} Contents ({estimateTokenCount(contents)} Tokens)
                </ContextMenuItem>

                {/* Folder-specific context menu items */}
                {isFolder && (
                    <>

                        {/* --- New Copy Folder Summaries Context Menu Item --- */}
                        <ContextMenuItem
                            onClick={async () => {
                                if (summaries) {
                                    copyToClipboard(summaries, {
                                        successMessage: "Folder summaries copied to clipboard",
                                        errorMessage: "Failed to copy folder summaries"
                                    })
                                } else {
                                    toast.info("No file summaries found in this folder.");
                                }
                            }}
                        >
                            Copy Folder Summaries ({estimateTokenCount(summaries)} Tokens)
                        </ContextMenuItem>
                        {/* --- End New Copy Folder Summaries Context Menu Item --- */}


                        <ContextMenuItem /* Copy Folder Tree */
                            onClick={async () => {
                                await copyToClipboard(tree, {
                                    successMessage: "Folder tree copied to clipboard",
                                    errorMessage: "Failed to copy folder tree"
                                })
                            }}
                        >
                            Copy Folder Tree ({estimateTokenCount(tree)} Tokens)
                        </ContextMenuItem>
                    </>
                )}



                {/* "Modify with AI..." for files */}
                {!isFolder && item.node.file?.path && onRequestAIFileChange && (
                    <ContextMenuItem
                        onClick={() => {
                            onRequestAIFileChange(item.node.file!.path);
                        }}
                    >
                        Modify with AI...
                    </ContextMenuItem>
                )}

                {/* Refresh options for folders */}
                {isFolder && (
                    <>
                        <ContextMenuSeparator />
                        <ContextMenuItem onClick={() => refreshProject({ folder: item.path })}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Refresh This Folder
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => refreshProject({})}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Refresh Entire Project
                        </ContextMenuItem>
                    </>
                )}
            </ContextMenuContent>
        </ContextMenu>
    );
});

FileTreeNodeRow.displayName = "FileTreeNodeRow";

/**
 * Exposed ref API for focusing the file tree.
 */
export type FileTreeRef = {
    focusTree: (index?: number) => void;
};

/**
 * Main FileTree component.
 */
export const FileTree = forwardRef<FileTreeRef, FileTreeProps>(function FileTree(
    {
        root,
        onViewFile,
        projectRoot,
        resolveImports,
        onNavigateRight,
        onNavigateToSearch,
        onRequestAIFileChange,
    },
    ref
) {
    const totalFiles = countTotalFiles(root);
    const autoExpand = totalFiles < 20;

    const [openPaths, setOpenPaths] = useState<Map<string, boolean>>(new Map());
    const [visibleItems, setVisibleItems] = useState<VisibleItem[]>([]);

    const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
    const [focusedIndex, setFocusedIndex] = useState<number>(-1);
    const [lastFocusedIndex, setLastFocusedIndex] = useState<number>(-1);
    const { selectedFiles, selectFiles, projectFileMap } = useSelectedFiles();

    // Track whether the container is "focused" to enable/disable certain hotkeys
    const [isFocused, setIsFocused] = useState(false);

    useImperativeHandle(
        ref,
        () => ({
            focusTree: (index?: number) => {
                if (index !== undefined && rowRefs.current[index]) {
                    rowRefs.current[index]?.focus();
                    setFocusedIndex(index);
                }
                // NOTE: If no index is provided, do nothing.
            },
        }),
        []
    );

    useEffect(() => {
        if (focusedIndex >= 0) {
            setLastFocusedIndex(focusedIndex);
        }
    }, [focusedIndex]);

    /**
     * Ensure no duplicates are added to the visible list
     * if the project has symlinks or other repeated paths.
     */
    const buildVisibleItems = useCallback((): VisibleItem[] => {
        const result: VisibleItem[] = [];
        const visitedPaths = new Set<string>();

        function traverse(
            obj: Record<string, FileNode>,
            parentPath: string | undefined,
            depth: number
        ) {
            const entries = Object.entries(obj).sort(([nameA, a], [nameB, b]) => {
                if (a._folder && !b._folder) return -1;
                if (!a._folder && b._folder) return 1;
                return nameA.toLowerCase().localeCompare(nameB.toLowerCase());
            });

            entries.forEach(([name, node]) => {
                const currentPath = parentPath ? `${parentPath}/${name}` : name;
                if (visitedPaths.has(currentPath)) return;
                visitedPaths.add(currentPath);

                result.push({
                    path: currentPath,
                    name,
                    node,
                    depth,
                    parentPath,
                });

                if (node._folder && node.children) {
                    const isNodeOpen = openPaths.get(currentPath) ?? autoExpand;
                    if (isNodeOpen) {
                        traverse(node.children, currentPath, depth + 1);
                    }
                }
            });
        }

        traverse(root, undefined, 0);
        return result;
    }, [root, openPaths, autoExpand]);

    useEffect(() => {
        const items = buildVisibleItems();
        setVisibleItems(items);
        if (focusedIndex >= items.length) {
            setFocusedIndex(items.length - 1);
        }
    }, [buildVisibleItems, focusedIndex]);

    const toggleOpen = useCallback((path: string) => {
        setOpenPaths((prev) => {
            const next = new Map(prev);
            const current = next.get(path);
            next.set(path, !current);
            return next;
        });
    }, []);

    const focusParent = (item: VisibleItem) => {
        if (!item.parentPath) return;
        const parentIndex = visibleItems.findIndex((i) => i.path === item.parentPath);
        if (parentIndex >= 0) {
            setFocusedIndex(parentIndex);
        }
    };

    const focusFirstChild = (folderPath: string) => {
        const childIndex = visibleItems.findIndex((i) => i.parentPath === folderPath);
        if (childIndex !== -1) {
            setFocusedIndex(childIndex);
        }
    };

    const handleTreeKeyDown = useCallback(
        (e: KeyboardEvent<HTMLDivElement>) => {
            if (focusedIndex < 0) return;

            switch (e.key) {
                case "ArrowUp": {
                    e.preventDefault();
                    if (focusedIndex > 0) {
                        setFocusedIndex((prev) => Math.max(prev - 1, 0));
                    } else if (onNavigateToSearch) {
                        onNavigateToSearch();
                    }
                    break;
                }
                case "ArrowDown": {
                    e.preventDefault();
                    setFocusedIndex((prev) => Math.min(prev + 1, visibleItems.length - 1));
                    break;
                }
                case "ArrowLeft": {
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
            }
        },
        [
            focusedIndex,
            visibleItems,
            onNavigateToSearch,
            openPaths,
            autoExpand,
            toggleOpen,
        ]
    );

    // Handle right arrow with react-hotkeys
    useHotkeys(
        "right",
        (e) => {
            e.preventDefault();
            if (focusedIndex < 0) return;
            const item = visibleItems[focusedIndex];
            if (item.node._folder) {
                const isOpen = openPaths.get(item.path) ?? autoExpand;
                if (isOpen) {
                    focusFirstChild(item.path);
                } else {
                    toggleOpen(item.path);
                    setTimeout(() => {
                        const newItems = buildVisibleItems();
                        const childIndex = newItems.findIndex((i) => i.parentPath === item.path);
                        if (childIndex !== -1) {
                            setFocusedIndex(childIndex);
                        }
                    }, 0);
                }
            } else {
                onNavigateRight?.();
            }
        },
        { enabled: isFocused },
        [
            visibleItems,
            focusedIndex,
            openPaths,
            autoExpand,
            isFocused,
            onNavigateRight,
            buildVisibleItems,
            toggleOpen,
        ]
    );


    // Handle space toggling the current file/folder
    useHotkeys(
        "space",
        (e) => {
            e.preventDefault();
            if (focusedIndex < 0) return;
            const item = visibleItems[focusedIndex];
            const { node } = item;
            if (node._folder) {
                selectFiles(
                    toggleFolderUtil(node, !areAllFolderFilesSelected(node, selectedFiles), selectedFiles)
                );
            } else if (node.file?.id) {
                selectFiles(
                    toggleFileUtil(
                        node.file!.id,
                        selectedFiles,
                        resolveImports ?? false,
                        projectFileMap,
                        getRecursiveImports,
                        buildTsconfigAliasMap
                    )
                );
            }
        },
        { enabled: isFocused },
        [visibleItems, focusedIndex, selectFiles, isFocused]
    );

    const { copyToClipboard } = useCopyClipboard()

    /**
     * Copy the entire root folder tree structure.
     */
    function copyEntireTree() {
        const lines: string[] = [];
        for (const [name, node] of Object.entries(root)) {
            lines.push(name);
            if (node._folder) {
                lines.push(buildTreeStructure(node, "  "));
            }
        }
        copyToClipboard(lines.join("\n"), {
            successMessage: "Full file tree copied to clipboard",
            errorMessage: "Failed to copy full file tree"
        });
    }

    return (
        <div
            className="flex flex-col"
            tabIndex={0}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={handleTreeKeyDown}
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    e.currentTarget.focus();
                }
            }}
        >
            <div className="flex items-center justify-between px-2 py-1 text-xs text-muted-foreground shrink-0">
                <span>Files</span>
                <Button variant="ghost" size="sm" onClick={copyEntireTree}>
                    Copy Full Tree
                </Button>
            </div>
            <div className="flex-1 min-h-0">
                <div className="space-y-0.5 p-1">
                    {visibleItems.map((item, idx) => (
                        <FileTreeNodeRow
                            key={item.path}
                            ref={(el) => {
                                rowRefs.current[idx] = el;
                            }}
                            item={item}
                            isOpen={openPaths.get(item.path) ?? autoExpand}
                            isFocused={idx === focusedIndex}
                            onFocus={() => setFocusedIndex(idx)}
                            onToggleOpen={() => toggleOpen(item.path)}
                            onViewFile={onViewFile}
                            projectRoot={projectRoot}
                            onRequestAIFileChange={onRequestAIFileChange}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
});