import React, {
    useState,
    useRef,
    useEffect,
    useCallback,
    KeyboardEvent,
    forwardRef,
    useImperativeHandle,
    RefObject,
} from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Folder,
    File as FileIcon,
    ChevronRight,
    Eye,
    Code,
    Copy,
    Wand2,
} from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";

import { useHotkeys } from "react-hotkeys-hook";
import { cn } from "@/lib/utils";
import { buildTsconfigAliasMap, getRecursiveImports } from "./file-tree-utils/import-resolver";
import {
    toggleFile as toggleFileUtil,
    toggleFolder as toggleFolderUtil,
    calculateFolderTokens,
    areAllFolderFilesSelected,
    isFolderPartiallySelected,
    countTotalFiles,
    formatTokenCount,
    FileNode,
} from "./file-tree-utils/file-node-tree-utils";
import { buildNodeContent } from "@/components/projects/utils/projects-utils";

import { getEditorUrl } from "@/lib/editor-urls";
import { useActiveProjectTab } from "@/zustand/selectors";
import { ProjectFile } from "shared/schema";
import { useSelectedFiles } from "@/hooks/utility-hooks/use-selected-files";


/**
 * The user's preferred external editor.
 */
export type EditorType = "vscode" | "webstorm" | "cursor" | "other";

type SetSelectedFilesFunction = (updater: (prev: string[]) => string[]) => void;

type VisibleItem = {
    path: string;
    name: string;
    node: FileNode;
    depth: number;
    parentPath?: string;
};

type FileTreeProps = {
    root: Record<string, FileNode>;
    onViewFile?: (file: ProjectFile) => void;
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

/**
 * Single row in the file tree (folder or file).
 * ForwardRef so we can focus DOM nodes from parent.
 */
const FileTreeNodeRow = forwardRef<
    HTMLDivElement,
    {
        item: VisibleItem;
        isOpen: boolean;
        isFocused: boolean;
        onFocus: () => void;
        onToggleOpen: () => void;
        onViewFile?: (file: ProjectFile) => void;
        projectRoot: string;
        onRequestAIFileChange?: (filePath: string) => void;
    }
>(function FileTreeNodeRow(
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
    console.log({
        onRequestAIFileChange,

    })
    const { tabData: projectTabState } = useActiveProjectTab();
    const { selectedFiles, selectFiles, projectFileMap } = useSelectedFiles()
    const resolveImports = projectTabState?.resolveImports ?? false;
    const preferredEditor = projectTabState?.preferredEditor ?? "vscode";

    const isFolder = item.node._folder === true;

    const folderChecked = isFolder
        ? areAllFolderFilesSelected(item.node, selectedFiles)
        : selectedFiles.includes(item.node.file?.id ?? "");

    const folderIndeterminate =
        isFolder && isFolderPartiallySelected(item.node, selectedFiles);

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
        [selectFiles, resolveImports, projectFileMap]
    );

    const handleToggleFolder = useCallback(
        (folderNode: FileNode, select: boolean) => {
            selectFiles(toggleFolderUtil(folderNode, select, selectedFiles));
        },
        [selectFiles, selectedFiles]
    );

    // Scroll newly-focused items into view with smooth behavior
    useEffect(() => {
        if (isFocused && ref && "current" in ref && ref.current) {
            ref.current.scrollIntoView({
                block: "nearest",
                inline: "nearest",
                behavior: "smooth",
            });
            // ref.current.focus(); // Usually safe to ensure focus is set
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

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <div
                    ref={ref}
                    className={cn("flex flex-col outline-none", isFocused && "bg-accent")}
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

                        {/* Inline icons: Eye, Open in Editor, Copy contents */}
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
                                        const content = buildNodeContent(item.node, projectFileMap, false);
                                        try {
                                            await navigator.clipboard.writeText(content);
                                            toast.success("File contents copied to clipboard");
                                        } catch (err) {
                                            toast.error("Failed to copy file contents");
                                            console.error(err);
                                        }
                                    }}
                                >
                                    <Copy className="h-4 w-4" />
                                </Button>
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
                {/* Copy relative path */}
                <ContextMenuItem
                    onClick={() => {
                        if (item.node.file?.path) {
                            void copyFilePath(item.node.file.path);
                        }
                    }}
                >
                    Copy Relative Path
                </ContextMenuItem>

                {/* Copy absolute path */}
                <ContextMenuItem
                    onClick={() => {
                        if (item.node.file?.path) {
                            void copyFilePath(`${projectRoot}/${item.node.file.path}`);
                        }
                    }}
                >
                    Copy Absolute Path
                </ContextMenuItem>

                {/* Copy entire contents (file or folder) */}
                <ContextMenuItem
                    onClick={async () => {
                        const content = buildNodeContent(item.node, projectFileMap, isFolder);
                        try {
                            await navigator.clipboard.writeText(content);
                            toast.success(
                                `${isFolder ? "Folder" : "File"} contents copied to clipboard`
                            );
                        } catch (err) {
                            toast.error(`Failed to copy ${isFolder ? "folder" : "file"} contents`);
                            console.error(err);
                        }
                    }}
                >
                    Copy {isFolder ? "Folder" : "File"} Contents
                </ContextMenuItem>

                {/* Copy folder tree (only visible if isFolder) */}
                {isFolder && (
                    <ContextMenuItem
                        onClick={async () => {
                            const tree = buildTreeStructure(item.node);
                            await navigator.clipboard.writeText(tree);
                            toast.success("Folder tree copied to clipboard");
                        }}
                    >
                        Copy Folder Tree
                    </ContextMenuItem>
                )}

                {
                    console.log({
                        isFolder,
                        item: item.node.file?.path,
                        onRequestAIFileChange,
                    })
                }

                {/* "Modify with AI..." (only if file) */}
                {!isFolder && item.node.file?.path && onRequestAIFileChange && (

                    <ContextMenuItem
                        onClick={() => {
                            onRequestAIFileChange(item.node.file!.path);
                        }}
                    >
                        Modify with AI...
                    </ContextMenuItem>
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
    const { selectedFiles, selectFiles, projectFileMap } = useSelectedFiles()

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
                // This prevents auto-focusing the top item and resetting scroll.
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
                // Skip if we've seen this path already:
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
                    // After toggling open, re-check the new child index
                    setTimeout(() => {
                        const newItems = buildVisibleItems();
                        const childIndex = newItems.findIndex((i) => i.parentPath === item.path);
                        if (childIndex !== -1) {
                            setFocusedIndex(childIndex);
                        }
                    }, 0);
                }
            } else {
                // If it's a file, user might want to navigate to next UI panel
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
        void navigator.clipboard.writeText(lines.join("\n"));
        toast.success("Full file tree copied to clipboard");
    }

    return (
        <div
            className="h-full overflow-y-auto"
            tabIndex={0}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={handleTreeKeyDown}
            onClick={(e) => {
                // Focus container if user clicks blank space in the container
                if (e.target === e.currentTarget) {
                    e.currentTarget.focus();
                }
            }}
        >
            <div className="flex items-center justify-between px-2 py-1 text-xs text-muted-foreground">
                <span>Files</span>
                <Button variant="ghost" size="sm" onClick={copyEntireTree}>
                    Copy Full Tree
                </Button>
            </div>
            <div className="p-1">
                {visibleItems.map((item, idx) => {
                    const isOpen = item.node._folder
                        ? openPaths.get(item.path) ?? autoExpand
                        : false;

                    return (
                        <FileTreeNodeRow
                            key={item.path}
                            ref={(el) => {
                                rowRefs.current[idx] = el;
                            }}
                            item={item}
                            isOpen={isOpen}
                            isFocused={idx === focusedIndex}
                            onFocus={() => setFocusedIndex(idx)}
                            onToggleOpen={() => toggleOpen(item.path)}
                            onViewFile={onViewFile}
                            projectRoot={projectRoot}
                            onRequestAIFileChange={onRequestAIFileChange}
                        />
                    );
                })}
            </div>
        </div>
    );
});