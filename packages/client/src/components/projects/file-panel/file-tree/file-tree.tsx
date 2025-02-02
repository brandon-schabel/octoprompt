import { useState, useRef, useEffect, useCallback, KeyboardEvent, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Folder,
    File as FileIcon,
    ChevronRight,
    Eye,
    Code,
    Copy
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    getRecursiveImports,
    buildTsconfigAliasMap
} from "./file-tree-utils/import-resolver";
import { getEditorUrl } from "@/lib/editor-urls";
import { useHotkeys } from "react-hotkeys-hook";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger
} from "@/components/ui/context-menu";
import {
    FileNode,
    countTotalFiles,
    calculateFolderTokens,
    areAllFolderFilesSelected,
    isFolderPartiallySelected,
    toggleFile as toggleFileUtil,
    toggleFolder as toggleFolderUtil,
    formatTokenCount
} from "./file-tree-utils/file-node-tree-utils";
import { ProjectFile } from "shared/schema";
import { toast } from "sonner";
import { buildNodeContent } from "@/components/projects/utils/projects-utils";
import clsx from "clsx";
import { EditorType } from "shared/src/global-state/global-state-schema";
import { useActiveProjectTab } from "@/zustand/selectors";

/** 
 * Used for managing selection state externally. 
 * The callback receives the *current* array of selected file IDs, 
 * and returns the *updated* array of file IDs.
 */
type SetSelectedFilesFunction = (updater: (prev: string[]) => string[]) => void;

type VisibleItem = {
    path: string;
    name: string;
    node: FileNode;
    depth: number;
    parentPath?: string;
};

type FileTreeProps = {
    /** 
     * Root node structure for the file tree. 
     */
    root: Record<string, FileNode>;
    /**
     * Currently selected file IDs.
     */
    selectedFiles: string[];
    /**
     * Setter for selected files; must follow the (prev => next) pattern.
     */
    setSelectedFiles: SetSelectedFilesFunction;
    /**
     * Map from file path to the actual file metadata (ProjectFile).
     */
    fileMap: Map<string, ProjectFile>;
    /**
     * Callback when user explicitly views a file (e.g. "Eye" icon).
     */
    onViewFile?: (file: ProjectFile) => void;
    /**
     * Project root path, used for building absolute paths or editor links.
     */
    projectRoot: string;
    /**
     * If true, toggling a file's selection includes its imports (and so on).
     */
    resolveImports?: boolean;
    /**
     * The user’s chosen editor type (to build the "Open in Editor" link).
     */
    preferredEditor: EditorType;
    /**
     * Callback fired when user hits right arrow while focused on a file. 
     * Typically used to move focus to a next panel or UI area.
     */
    onNavigateRight?: () => void;
    /**
     * Callback fired when user hits up arrow at top item. 
     * Typically used to move focus to a "search" field or similar.
     */
    onNavigateToSearch?: () => void;
    /**
     * **New**: Called from the context menu when user chooses "Modify with AI...".
     * Passes the file's path so the parent can open an AIFileChangeDialog.
     */
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
 * A single visible row in the file tree (folder or file).
 */
const FileTreeNodeRow = forwardRef<
    HTMLDivElement,
    {
        item: VisibleItem;
        isOpen: boolean;
        isFocused: boolean;
        onFocus: () => void;
        onToggleOpen: () => void;
        setSelectedFiles: SetSelectedFilesFunction;
        fileMap: Map<string, ProjectFile>;
        onViewFile?: (file: ProjectFile) => void;
        projectRoot: string;
        onRequestAIFileChange?: (filePath: string) => void;
    }
>(
    (
        {
            item,
            isOpen,
            isFocused,
            onFocus,
            onToggleOpen,
            setSelectedFiles,
            fileMap,
            onViewFile,
            projectRoot,
            onRequestAIFileChange
        },
        ref
    ) => {
        const { tabData: projectTabState } = useActiveProjectTab();
        const selectedFiles = projectTabState?.selectedFiles || [];
        const resolveImports = projectTabState?.resolveImports || false;
        const preferredEditor = projectTabState?.preferredEditor || "vscode";

        const isFolder = item.node._folder === true;

        const folderChecked = isFolder
            ? areAllFolderFilesSelected(item.node, selectedFiles)
            : selectedFiles.includes(item.node.file?.id ?? "");

        const folderIndeterminate =
            isFolder && isFolderPartiallySelected(item.node, selectedFiles);

        const handleToggleFile = (fileId: string): void => {
            setSelectedFiles((prev) =>
                toggleFileUtil(
                    fileId,
                    prev,
                    resolveImports ?? false,
                    fileMap,
                    getRecursiveImports,
                    buildTsconfigAliasMap
                )
            );
        };

        const handleToggleFolder = (folderNode: FileNode, select: boolean): void => {
            setSelectedFiles((prev) => toggleFolderUtil(folderNode, select, prev));
        };

        useEffect(() => {
            // When an item is newly "focused", ensure it is scrolled into view
            if (isFocused && ref && "current" in ref && ref.current) {
                ref.current.scrollIntoView({ block: "nearest" });
                ref.current.focus();
            }
        }, [isFocused, ref]);

        const handleEnter = useCallback(() => {
            if (isFolder) {
                onToggleOpen();
            } else if (item.node.file && onViewFile) {
                onViewFile(item.node.file);
            }
        }, [isFolder, onToggleOpen, onViewFile, item.node.file]);

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
            [handleEnter, isFolder, item.node, folderChecked, handleToggleFile, handleToggleFolder]
        );

        return (
            <ContextMenu>
                <ContextMenuTrigger asChild>
                    <div
                        ref={ref}
                        className={cn("flex flex-col outline-none", isFocused && "bg-accent")}
                        style={{
                            paddingLeft: item.depth > 0 ? `${Math.min(item.depth * 8, 64)}px` : undefined
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
                                    <ChevronRight className={cn("h-4 w-4 transition-transform", isOpen && "rotate-90")} />
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
                                                        "text-primary font-semibold": selectedTokens === totalTokens
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
                                            const content = buildNodeContent(item.node, fileMap, false);
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
                            const content = buildNodeContent(item.node, fileMap, isFolder);
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

                    {/* NEW: "Modify with AI..." context menu item (only if file) */}
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
    }
);

FileTreeNodeRow.displayName = "FileTreeNodeRow";

export type FileTreeRef = {
    focusTree: (index?: number) => void;
};

export const FileTree = forwardRef<FileTreeRef, FileTreeProps>(
    (
        {
            root,
            selectedFiles,
            setSelectedFiles,
            fileMap,
            onViewFile,
            projectRoot,
            resolveImports,
            onNavigateRight,
            onNavigateToSearch,
            onRequestAIFileChange
        },
        ref
    ) => {
        const totalFiles = countTotalFiles(root);
        const autoExpand = totalFiles < 20;

        const [openPaths, setOpenPaths] = useState<Map<string, boolean>>(new Map());
        const [visibleItems, setVisibleItems] = useState<VisibleItem[]>([]);
        const [focusedIndex, setFocusedIndex] = useState<number>(-1);
        const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
        const [lastFocusedIndex, setLastFocusedIndex] = useState<number>(-1);

        // 1) Local "isFocused" state to scope hotkeys
        const [isFocused, setIsFocused] = useState(false);

        useImperativeHandle(ref, () => ({
            focusTree: (index?: number) => {
                const targetIndex = index ?? lastFocusedIndex;
                if (targetIndex >= 0 && rowRefs.current[targetIndex]) {
                    rowRefs.current[targetIndex]?.focus();
                    setFocusedIndex(targetIndex);
                } else if (rowRefs.current[0]) {
                    rowRefs.current[0]?.focus();
                    setFocusedIndex(0);
                }
            }
        }), [lastFocusedIndex]);

        useEffect(() => {
            if (focusedIndex >= 0) {
                setLastFocusedIndex(focusedIndex);
            }
        }, [focusedIndex]);

        const buildVisibleItems = useCallback((): VisibleItem[] => {
            const result: VisibleItem[] = [];

            function traverse(obj: Record<string, FileNode>, parentPath: string | undefined, depth: number) {
                // Sort folders first, then files, each group alphabetically
                const entries = Object.entries(obj).sort(([nameA, a], [nameB, b]) => {
                    if (a._folder && !b._folder) return -1;
                    if (!a._folder && b._folder) return 1;
                    return nameA.toLowerCase().localeCompare(nameB.toLowerCase());
                });

                entries.forEach(([name, node]) => {
                    const currentPath = parentPath ? `${parentPath}/${name}` : name;
                    result.push({
                        path: currentPath,
                        name,
                        node,
                        depth,
                        parentPath
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
                    case "ArrowUp":
                        e.preventDefault();
                        if (focusedIndex > 0) {
                            setFocusedIndex((prev) => Math.max(prev - 1, 0));
                        } else if (onNavigateToSearch) {
                            onNavigateToSearch();
                        }
                        break;

                    case "ArrowDown":
                        e.preventDefault();
                        setFocusedIndex((prev) => Math.min(prev + 1, visibleItems.length - 1));
                        break;

                    case "ArrowLeft":
                        e.preventDefault();
                        {
                            const leftItem = visibleItems[focusedIndex];
                            if (leftItem.node._folder) {
                                const isOpen = openPaths.get(leftItem.path) ?? autoExpand;
                                if (isOpen) {
                                    toggleOpen(leftItem.path);
                                    return;
                                }
                            }
                            focusParent(leftItem);
                        }
                        break;
                }
            },
            [
                focusedIndex,
                visibleItems,
                onNavigateToSearch,
                openPaths,
                autoExpand,
                toggleOpen
            ]
        );

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
                        // After we expand, we can optionally focus the first child
                        setTimeout(() => {
                            const newItems = buildVisibleItems();
                            const childIndex = newItems.findIndex((i) => i.parentPath === item.path);
                            if (childIndex !== -1) {
                                setFocusedIndex(childIndex);
                            }
                        }, 0);
                    }
                } else {
                    // If it's a file, user might want to navigate to the next UI panel
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
                toggleOpen
            ]
        );

        useHotkeys(
            "space",
            (e) => {
                e.preventDefault();
                if (focusedIndex < 0) return;
                const item = visibleItems[focusedIndex];
                const { node } = item;
                if (node._folder) {
                    setSelectedFiles((prev) =>
                        toggleFolderUtil(node, !areAllFolderFilesSelected(node, prev), prev)
                    );
                } else if (node.file?.id) {
                    setSelectedFiles((prev) =>
                        toggleFileUtil(
                            node.file!.id,
                            prev,
                            resolveImports ?? false,
                            fileMap,
                            getRecursiveImports,
                            buildTsconfigAliasMap
                        )
                    );
                }
            },
            { enabled: isFocused },
            [visibleItems, focusedIndex, setSelectedFiles, isFocused]
        );

        function copyEntireTree() {
            const lines: string[] = [];
            for (const [name, node] of Object.entries(root)) {
                lines.push(name);
                if (node._folder) {
                    lines.push(buildTreeStructure(node, "  "));
                }
            }
            navigator.clipboard.writeText(lines.join("\n"));
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
                    // Only focus container if user clicks the container itself
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
                                ref={(el) => (rowRefs.current[idx] = el)}
                                item={item}
                                isOpen={isOpen}
                                isFocused={idx === focusedIndex}
                                onFocus={() => setFocusedIndex(idx)}
                                onToggleOpen={() => toggleOpen(item.path)}
                                setSelectedFiles={setSelectedFiles}
                                fileMap={fileMap}
                                onViewFile={onViewFile}
                                projectRoot={projectRoot}
                                onRequestAIFileChange={onRequestAIFileChange}
                            />
                        );
                    })}
                </div>
            </div>
        );
    }
);

FileTree.displayName = "FileTree";