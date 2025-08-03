import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  KeyboardEvent,
  forwardRef,
  useImperativeHandle,
  RefObject,
  useMemo
} from 'react'
import { Button } from '@ui'
import { Checkbox } from '@ui'
import { Folder, File as FileIcon, ChevronRight, Eye, Code, Copy, ClipboardList } from 'lucide-react'
import clsx from 'clsx'
import { toast } from 'sonner'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@ui'

import { useHotkeys } from 'react-hotkeys-hook'
import { cn } from '@/lib/utils'
import { buildTsconfigAliasMap, getRecursiveImports } from '@promptliano/shared'
import {
  toggleFile as toggleFileUtil,
  toggleFolder as toggleFolderUtil,
  calculateFolderTokens,
  areAllFolderFilesSelected,
  isFolderPartiallySelected,
  countTotalFiles,
  formatTokenCount,
  FileNode,
  estimateTokenCount
} from '@promptliano/shared'
import { buildNodeContent, buildNodeSummaries } from '@promptliano/shared'

import { getEditorUrl } from '@/utils/editor-urls'
import { useSelectedFiles } from '@/hooks/utility-hooks/use-selected-files'
import { GlobalStateEditorType as EditorType, ProjectFile } from '@promptliano/schemas'
import { useCopyClipboard } from '@/hooks/utility-hooks/use-copy-clipboard'
import { useActiveProjectTab } from '@/hooks/use-kv-local-storage'
import { useProjectGitStatus, useStageFiles, useUnstageFiles, useFileDiff } from '@/hooks/api/use-git-api'
import type { GitFileStatus, GitStatus } from '@promptliano/schemas'
import { GitBranch, Plus, Minus, History, GitCompare } from 'lucide-react'

export type VisibleItem = {
  path: string
  name: string
  node: FileNode
  depth: number
  parentPath?: string
}

export type FileTreeProps = {
  root: Record<string, FileNode>
  onViewFile?: (file: ProjectFile | null) => void
  onViewFileInEditMode?: (file: ProjectFile | null) => void
  projectRoot: string
  resolveImports?: boolean
  preferredEditor: EditorType
  onNavigateRight?: () => void
  onNavigateToSearch?: () => void
}

async function copyFilePath(path: string) {
  try {
    await navigator.clipboard.writeText(path)
    toast.success('File path copied to clipboard')
  } catch (err) {
    console.error('Failed to copy file path', err)
    toast.error('Failed to copy file path')
  }
}

/**
 * Utility to recursively build the folder tree structure as text.
 */
export function buildTreeStructure(node: FileNode, indent = ''): string {
  const lines: string[] = []

  if (node._folder && node.children) {
    for (const [name, child] of Object.entries(node.children)) {
      lines.push(`${indent}${name}`)
      if (child._folder) {
        lines.push(buildTreeStructure(child, indent + '  '))
      }
    }
  }
  return lines.join('\n')
}

/**
 * Utility to collect all git files in a folder recursively
 */
export function collectGitFilesInFolder(
  folderPath: string,
  gitStatus: GitStatus | null
): { staged: string[]; unstaged: string[]; all: string[] } {
  const staged: string[] = []
  const unstaged: string[] = []
  const all: string[] = []

  if (!gitStatus) {
    return { staged, unstaged, all }
  }

  // Iterate through all git files
  for (const file of gitStatus.files) {
    // Skip unchanged and ignored files
    if (file.status === 'unchanged' || file.status === 'ignored') {
      continue
    }

    // Check if the file is in this folder or a subfolder
    if (file.path === folderPath || file.path.startsWith(folderPath + '/')) {
      all.push(file.path)

      if (file.staged) {
        staged.push(file.path)
      } else {
        unstaged.push(file.path)
      }
    }
  }

  return { staged, unstaged, all }
}

/**
 * Utility to collect contents of files from a folder based on git status
 */
export function collectGitFileContents(
  folderPath: string,
  gitStatus: GitStatus | null,
  root: Record<string, FileNode>,
  filter: 'all' | 'staged' | 'unstaged' = 'all'
): string {
  const gitFiles = collectGitFilesInFolder(folderPath, gitStatus)
  const filePaths = filter === 'staged' ? gitFiles.staged : filter === 'unstaged' ? gitFiles.unstaged : gitFiles.all

  const contents: string[] = []

  // Helper to find a file node by path
  function findFileNode(path: string): FileNode | null {
    const parts = path.split('/')
    let current = root

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]
      if (!current[part] || !current[part]._folder || !current[part].children) {
        return null
      }
      current = current[part].children!
    }

    const fileName = parts[parts.length - 1]
    return current[fileName] || null
  }

  // Collect contents for each file
  for (const filePath of filePaths) {
    const node = findFileNode(filePath)
    if (node && node.file && node.file.content) {
      contents.push(`// File: ${filePath}\n${node.file.content}`)
    }
  }

  return contents.join('\n\n')
}

interface FileTreeNodeRowProps {
  item: VisibleItem
  isOpen: boolean
  isFocused: boolean
  onFocus: () => void
  onToggleOpen: () => void
  onViewFile?: (file: ProjectFile) => void
  onViewFileInEditMode?: (file: ProjectFile) => void
  projectRoot: string
  gitFileStatus?: GitFileStatus
  gitStatus?: GitStatus | null
  root: Record<string, FileNode>
}

/**
 * Single row in the file tree (folder or file).
 * ForwardRef so we can focus DOM nodes from parent.
 */
const getGitStatusColor = (gitFileStatus: GitFileStatus | undefined) => {
  if (!gitFileStatus || gitFileStatus.status === 'unchanged' || gitFileStatus.status === 'ignored') {
    return undefined
  }

  // Use darker colors for unstaged, brighter for staged
  const isStaged = gitFileStatus.staged

  if (gitFileStatus.status === 'added' || gitFileStatus.status === 'untracked') {
    return isStaged ? 'text-green-500' : 'text-green-700'
  }

  if (gitFileStatus.status === 'modified') {
    return isStaged ? 'text-yellow-500' : 'text-yellow-700'
  }

  if (gitFileStatus.status === 'deleted') {
    return isStaged ? 'text-red-500' : 'text-red-700'
  }

  if (gitFileStatus.status === 'renamed' || gitFileStatus.status === 'copied') {
    return isStaged ? 'text-blue-500' : 'text-blue-700'
  }

  return 'text-gray-500'
}

const FileTreeNodeRow = forwardRef<HTMLDivElement, FileTreeNodeRowProps>(function FileTreeNodeRow(
  {
    item,
    isOpen,
    isFocused,
    onFocus,
    onToggleOpen,
    onViewFile,
    onViewFileInEditMode,
    projectRoot,
    gitFileStatus,
    gitStatus,
    root
  },
  ref
) {
  const [projectTabState, , projectTabId] = useActiveProjectTab()
  const { selectedFiles, selectedFilePaths, selectFiles, projectFileMap, toggleFilePath, isFileSelectedByPath } =
    useSelectedFiles()
  const resolveImports = projectTabState?.resolveImports ?? false
  const preferredEditor = projectTabState?.preferredEditor ?? 'vscode'
  const { copyToClipboard } = useCopyClipboard()
  const projectId = projectTabState?.selectedProjectId ?? -1

  const { mutate: stageFiles } = useStageFiles(projectId)
  const { mutate: unstageFiles } = useUnstageFiles(projectId)

  // State for loading diff data
  const [loadingDiff, setLoadingDiff] = useState(false)
  const [loadingOriginal, setLoadingOriginal] = useState(false)

  const isFolder = item.node._folder === true

  const folderChecked = isFolder
    ? areAllFolderFilesSelected(item.node, selectedFiles)
    : selectedFiles.includes(item.node.file?.id ?? -1)

  const folderIndeterminate = isFolder && isFolderPartiallySelected(item.node, selectedFiles)

  const handleToggleFile = useCallback(
    (fileId: number) => {
      // Use path-based selection if available
      const file = projectFileMap.get(fileId)
      if (file && toggleFilePath) {
        toggleFilePath(file.path)
      } else {
        // Fallback to legacy ID-based selection
        selectFiles(
          toggleFileUtil(
            fileId,
            selectedFiles,
            resolveImports,
            projectFileMap,
            getRecursiveImports,
            buildTsconfigAliasMap
          )
        )
      }
    },
    [selectFiles, resolveImports, projectFileMap, selectedFiles, toggleFilePath]
  )

  const handleToggleFolder = useCallback(
    (folderNode: FileNode, select: boolean) => {
      selectFiles(toggleFolderUtil(folderNode, select, selectedFiles))
    },
    [selectFiles, selectedFiles]
  )

  useEffect(() => {
    if (isFocused && ref && 'current' in ref && ref.current) {
      ref.current.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
    }
  }, [isFocused, ref])

  const handleEnter = useCallback(() => {
    if (isFolder) {
      onToggleOpen()
    } else if (item.node.file && onViewFile) {
      onViewFile(item.node.file)
    }
  }, [isFolder, item.node.file, onToggleOpen, onViewFile])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter') {
        handleEnter()
      } else if (e.key === 'Escape') {
        e.currentTarget.blur()
      } else if (e.key === ' ') {
        e.preventDefault()
        if (isFolder) {
          handleToggleFolder(item.node, !folderChecked)
        } else if (item.node.file?.id) {
          handleToggleFile(item.node.file.id)
        }
      }
    },
    [isFolder, item.node, folderChecked, handleToggleFile, handleToggleFolder, handleEnter]
  )

  const summaries = useMemo(() => buildNodeSummaries(item.node, isFolder), [item.node, isFolder])
  const contents = useMemo(() => buildNodeContent(item.node, isFolder), [item.node, isFolder])
  const tree = useMemo(() => buildTreeStructure(item.node), [item.node])
  const hasSummary = item.node.file?.summary

  // Function to parse diff and extract original content
  const parseDiff = useCallback((diff: string) => {
    const lines = diff.split('\n')
    const original: string[] = []
    const modified: string[] = []

    let inDiffSection = false

    for (const line of lines) {
      if (line.startsWith('@@')) {
        inDiffSection = true
        continue
      }

      if (!inDiffSection) continue

      if (line.startsWith('-') && !line.startsWith('---')) {
        original.push(line.substring(1))
      } else if (line.startsWith('+') && !line.startsWith('+++')) {
        modified.push(line.substring(1))
      } else if (line.startsWith(' ')) {
        original.push(line.substring(1))
        modified.push(line.substring(1))
      }
    }

    return {
      original: original.join('\n'),
      modified: modified.join('\n')
    }
  }, [])

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={ref}
          className={cn('flex flex-col outline-none', isFocused && 'bg-accent rounded-md')}
          style={{
            paddingLeft: item.depth > 0 ? `${Math.min(item.depth * 8, 64)}px` : undefined
          }}
          tabIndex={0}
          onClick={onFocus}
          onDoubleClick={(e) => {
            e.stopPropagation()
            if (!isFolder && item.node.file && onViewFileInEditMode) {
              onViewFileInEditMode(item.node.file)
            }
          }}
          onKeyDown={handleKeyDown}
        >
          <div className='flex items-center hover:bg-muted/50 rounded-sm gap-1 group select-none'>
            {isFolder ? (
              <Button
                variant='ghost'
                size='icon'
                className='h-6 w-6 p-0'
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleOpen()
                }}
              >
                <ChevronRight className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-90')} />
              </Button>
            ) : (
              <div className='w-6' />
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
              <Folder className={cn('h-4 w-4', getGitStatusColor(gitFileStatus))} />
            ) : (
              <FileIcon className={cn('h-4 w-4', getGitStatusColor(gitFileStatus))} />
            )}
            <span
              className={cn('font-mono text-sm truncate', getGitStatusColor(gitFileStatus))}
              title={
                isFolder && gitStatus
                  ? (() => {
                      const folderGitFiles = collectGitFilesInFolder(item.path, gitStatus)
                      if (folderGitFiles.all.length === 0) return undefined
                      return `Git: ${folderGitFiles.staged.length} staged, ${folderGitFiles.unstaged.length} unstaged`
                    })()
                  : gitFileStatus && gitFileStatus.status !== 'unchanged' && gitFileStatus.status !== 'ignored'
                    ? `Git: ${gitFileStatus.status} (${gitFileStatus.staged ? 'staged' : 'unstaged'})`
                    : undefined
              }
            >
              {item.name}
            </span>

            {/* Token count display */}
            {((!isFolder && item.node.file?.content) || isFolder) && (
              <div className='flex items-center gap-2 ml-2'>
                {isFolder ? (
                  (() => {
                    const { selectedTokens, totalTokens } = calculateFolderTokens(item.node, selectedFiles)
                    return (
                      <span
                        className={clsx('text-xs text-muted-foreground', {
                          'text-primary font-semibold': selectedTokens === totalTokens
                        })}
                      >
                        {formatTokenCount(selectedTokens)}/{formatTokenCount(totalTokens)}
                      </span>
                    )
                  })()
                ) : (
                  <span
                    className={cn(
                      'text-xs',
                      selectedFiles.includes(item.node.file?.id ?? -1)
                        ? 'text-primary font-medium'
                        : 'text-muted-foreground'
                    )}
                  >
                    {formatTokenCount(item.node.file!.content || '')}
                  </span>
                )}
              </div>
            )}

            {/* Inline icons for single file */}
            {!isFolder && item.node.file && (
              <>
                {onViewFile && (
                  <Button
                    variant='ghost'
                    size='icon'
                    className='opacity-0 group-hover:opacity-100 transition-opacity'
                    onClick={(e) => {
                      e.stopPropagation()
                      onViewFile(item.node.file!)
                    }}
                  >
                    <Eye className='h-4 w-4' />
                  </Button>
                )}
                <Button
                  variant='ghost'
                  size='icon'
                  className='opacity-0 group-hover:opacity-100 transition-opacity'
                  onClick={async (e) => {
                    e.stopPropagation()
                    await copyToClipboard(contents, {
                      successMessage: 'File contents copied to clipboard',
                      errorMessage: 'Failed to copy file contents'
                    })
                  }}
                >
                  <Copy className='h-4 w-4' />
                </Button>

                {/* --- New Copy Summary Button --- */}
                {hasSummary && ( // Only show if file has a summary
                  <Button
                    variant='ghost'
                    size='icon'
                    title='Copy File Summary' // Add tooltip
                    className='opacity-0 group-hover:opacity-100 transition-opacity'
                    onClick={async (e) => {
                      e.stopPropagation()
                      // Use false for isFolder when copying single file summary
                      const summary = buildNodeSummaries(item.node, false)
                      if (summary) {
                        copyToClipboard(summary, {
                          successMessage: 'File summary copied to clipboard',
                          errorMessage: 'Failed to copy file summary'
                        })
                      } else {
                        toast.info('No summary available for this file.')
                      }
                    }}
                  >
                    <ClipboardList className='h-4 w-4' />
                  </Button>
                )}

                {/* Git stage/unstage buttons */}
                {gitFileStatus && gitFileStatus.status !== 'unchanged' && gitFileStatus.status !== 'ignored' && (
                  <>
                    {!gitFileStatus.staged && (
                      <Button
                        variant='ghost'
                        size='icon'
                        title='Stage file for commit'
                        className='opacity-0 group-hover:opacity-100 transition-opacity'
                        onClick={async (e) => {
                          e.stopPropagation()
                          if (item.node.file?.path) {
                            stageFiles([item.node.file.path])
                          }
                        }}
                      >
                        <Plus className='h-4 w-4 text-green-600' />
                      </Button>
                    )}
                    {gitFileStatus.staged && (
                      <Button
                        variant='ghost'
                        size='icon'
                        title='Unstage file from commit'
                        className='opacity-0 group-hover:opacity-100 transition-opacity'
                        onClick={async (e) => {
                          e.stopPropagation()
                          if (item.node.file?.path) {
                            unstageFiles([item.node.file.path])
                          }
                        }}
                      >
                        <Minus className='h-4 w-4 text-red-600' />
                      </Button>
                    )}
                  </>
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
                await copyFilePath(item.node.file!.path)
              }}
            >
              Copy Relative Path
            </ContextMenuItem>
            <ContextMenuItem
              onClick={async () => {
                await copyFilePath(`${projectRoot}/${item.node.file!.path}`)
              }}
            >
              Copy Absolute Path
            </ContextMenuItem>
            <ContextMenuItem asChild>
              <a
                href={getEditorUrl(preferredEditor, `${projectRoot}/${item.node.file!.path}`)}
                target='_blank'
                rel='noopener noreferrer'
              >
                <Code className='h-4 w-4 mr-2' />
                Open in Editor
              </a>
            </ContextMenuItem>
          </>
        )}

        {/* Copy contents for both files and folders */}
        <ContextMenuItem
          onClick={async () => {
            copyToClipboard(contents, {
              successMessage: `${isFolder ? 'Folder' : 'File'} contents copied to clipboard`,
              errorMessage: `Failed to copy ${isFolder ? 'folder' : 'file'} contents`
            })
          }}
        >
          Copy {isFolder ? 'Folder' : 'File'} Contents ({estimateTokenCount(contents)} Tokens)
        </ContextMenuItem>

        {/* Folder-specific context menu items */}
        {isFolder && (
          <>
            {/* --- New Copy Folder Summaries Context Menu Item --- */}
            <ContextMenuItem
              onClick={async () => {
                if (summaries) {
                  copyToClipboard(summaries, {
                    successMessage: 'Folder summaries copied to clipboard',
                    errorMessage: 'Failed to copy folder summaries'
                  })
                } else {
                  toast.info('No file summaries found in this folder.')
                }
              }}
            >
              Copy Folder Summaries ({estimateTokenCount(summaries)} Tokens)
            </ContextMenuItem>
            {/* --- End New Copy Folder Summaries Context Menu Item --- */}

            <ContextMenuItem /* Copy Folder Tree */
              onClick={async () => {
                await copyToClipboard(tree, {
                  successMessage: 'Folder tree copied to clipboard',
                  errorMessage: 'Failed to copy folder tree'
                })
              }}
            >
              Copy Folder Tree ({estimateTokenCount(tree)} Tokens)
            </ContextMenuItem>
          </>
        )}

        {/* "Modify with AI..." for files */}

        {/* Git operations for files */}
        {!isFolder && gitFileStatus && gitFileStatus.status !== 'unchanged' && gitFileStatus.status !== 'ignored' && (
          <>
            <ContextMenuSeparator />
            {!gitFileStatus.staged && (
              <ContextMenuItem
                onClick={() => {
                  if (item.node.file?.path) {
                    stageFiles([item.node.file.path])
                  }
                }}
              >
                <Plus className='h-4 w-4 mr-2 text-green-600' />
                Stage File
              </ContextMenuItem>
            )}
            {gitFileStatus.staged && (
              <ContextMenuItem
                onClick={() => {
                  if (item.node.file?.path) {
                    unstageFiles([item.node.file.path])
                  }
                }}
              >
                <Minus className='h-4 w-4 mr-2 text-red-600' />
                Unstage File
              </ContextMenuItem>
            )}
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={async () => {
                if (!item.node.file?.path) return
                setLoadingOriginal(true)
                try {
                  // Use the API client directly to fetch the diff
                  const { promptlianoClient: apiClient } = await import('@/hooks/promptliano-client')
                  const response = await apiClient.git.getFileDiff(projectId, item.node.file.path, { staged: false })

                  if (response.success && response.data?.diff) {
                    const { original } = parseDiff(response.data.diff)
                    await copyToClipboard(original, {
                      successMessage: 'Previous version copied to clipboard',
                      errorMessage: 'Failed to copy previous version'
                    })
                  } else {
                    toast.error('Failed to fetch file diff')
                  }
                } catch (error) {
                  console.error('Failed to copy previous version:', error)
                  toast.error('Failed to copy previous version')
                } finally {
                  setLoadingOriginal(false)
                }
              }}
              disabled={loadingOriginal}
            >
              <History className='h-4 w-4 mr-2' />
              {loadingOriginal ? 'Loading...' : 'Copy Previous Version'}
            </ContextMenuItem>
            <ContextMenuItem
              onClick={async () => {
                if (!item.node.file?.path) return
                setLoadingDiff(true)
                try {
                  // Use the API client directly to fetch the diff
                  const { promptlianoClient: apiClient } = await import('@/hooks/promptliano-client')
                  const response = await apiClient.git.getFileDiff(projectId, item.node.file.path, { staged: false })

                  if (response.success && response.data?.diff) {
                    await copyToClipboard(response.data.diff, {
                      successMessage: 'Diff copied to clipboard',
                      errorMessage: 'Failed to copy diff'
                    })
                  } else {
                    toast.error('Failed to fetch file diff')
                  }
                } catch (error) {
                  console.error('Failed to copy diff:', error)
                  toast.error('Failed to copy diff')
                } finally {
                  setLoadingDiff(false)
                }
              }}
              disabled={loadingDiff}
            >
              <GitCompare className='h-4 w-4 mr-2' />
              {loadingDiff ? 'Loading...' : 'Copy Diff'}
            </ContextMenuItem>
          </>
        )}

        {/* Git operations for folders */}
        {isFolder &&
          gitStatus &&
          (() => {
            const folderGitFiles = collectGitFilesInFolder(item.path, gitStatus)
            const hasGitFiles = folderGitFiles.all.length > 0
            const hasUnstagedFiles = folderGitFiles.unstaged.length > 0
            const hasStagedFiles = folderGitFiles.staged.length > 0

            // Debug logging
            if (item.path === 'packages') {
              console.log('Folder git files for packages:', folderGitFiles)
              console.log('gitStatus:', gitStatus)
            }

            if (!hasGitFiles) return null

            return (
              <>
                <ContextMenuSeparator />
                {hasUnstagedFiles && (
                  <ContextMenuItem
                    onClick={() => {
                      stageFiles(folderGitFiles.unstaged)
                    }}
                  >
                    <Plus className='h-4 w-4 mr-2 text-green-600' />
                    Stage All Files in Folder ({folderGitFiles.unstaged.length})
                  </ContextMenuItem>
                )}
                {hasStagedFiles && (
                  <ContextMenuItem
                    onClick={() => {
                      unstageFiles(folderGitFiles.staged)
                    }}
                  >
                    <Minus className='h-4 w-4 mr-2 text-red-600' />
                    Unstage All Files in Folder ({folderGitFiles.staged.length})
                  </ContextMenuItem>
                )}
                <ContextMenuSeparator />
                {/* Copy git file contents options */}
                {hasGitFiles && (
                  <ContextMenuItem
                    onClick={async () => {
                      const contents = collectGitFileContents(item.path, gitStatus, root, 'all')
                      if (contents) {
                        await copyToClipboard(contents, {
                          successMessage: `Git files contents copied (${folderGitFiles.all.length} files)`,
                          errorMessage: 'Failed to copy git files contents'
                        })
                      } else {
                        toast.info('No git file contents found in this folder')
                      }
                    }}
                  >
                    <Copy className='h-4 w-4 mr-2' />
                    Copy All Git Files ({folderGitFiles.all.length})
                  </ContextMenuItem>
                )}
                {hasStagedFiles && (
                  <ContextMenuItem
                    onClick={async () => {
                      const contents = collectGitFileContents(item.path, gitStatus, root, 'staged')
                      if (contents) {
                        await copyToClipboard(contents, {
                          successMessage: `Staged files contents copied (${folderGitFiles.staged.length} files)`,
                          errorMessage: 'Failed to copy staged files contents'
                        })
                      } else {
                        toast.info('No staged file contents found in this folder')
                      }
                    }}
                  >
                    <Copy className='h-4 w-4 mr-2 text-green-600' />
                    Copy Staged Files ({folderGitFiles.staged.length})
                  </ContextMenuItem>
                )}
                {hasUnstagedFiles && (
                  <ContextMenuItem
                    onClick={async () => {
                      const contents = collectGitFileContents(item.path, gitStatus, root, 'unstaged')
                      if (contents) {
                        await copyToClipboard(contents, {
                          successMessage: `Unstaged files contents copied (${folderGitFiles.unstaged.length} files)`,
                          errorMessage: 'Failed to copy unstaged files contents'
                        })
                      } else {
                        toast.info('No unstaged file contents found in this folder')
                      }
                    }}
                  >
                    <Copy className='h-4 w-4 mr-2 text-yellow-600' />
                    Copy Unstaged Files ({folderGitFiles.unstaged.length})
                  </ContextMenuItem>
                )}
              </>
            )
          })()}
      </ContextMenuContent>
    </ContextMenu>
  )
})

FileTreeNodeRow.displayName = 'FileTreeNodeRow'

export type FileTreeRef = {
  focusTree: (index?: number) => void
}

export const FileTree = forwardRef<FileTreeRef, FileTreeProps>(function FileTree(
  { root, onViewFile, onViewFileInEditMode, projectRoot, resolveImports, onNavigateRight, onNavigateToSearch },
  ref
) {
  const totalFiles = countTotalFiles(root)
  const autoExpand = totalFiles < 20

  const [openPaths, setOpenPaths] = useState<Map<string, boolean>>(new Map())
  const [visibleItems, setVisibleItems] = useState<VisibleItem[]>([])

  const rowRefs = useRef<(HTMLDivElement | null)[]>([])
  const [focusedIndex, setFocusedIndex] = useState<number>(-1)
  const [lastFocusedIndex, setLastFocusedIndex] = useState<number>(-1)
  const { selectedFiles, selectedFilePaths, selectFiles, projectFileMap, toggleFilePath, isFileSelectedByPath } =
    useSelectedFiles()
  const [projectTabState] = useActiveProjectTab()
  const projectId = projectTabState?.selectedProjectId

  // Track whether the container is "focused" to enable/disable certain hotkeys
  const [isFocused, setIsFocused] = useState(false)

  // Get git status for the project
  const { data: gitStatus } = useProjectGitStatus(projectId)

  // Create a map of file paths to git file status
  const gitStatusMap = useMemo(() => {
    const map = new Map<string, GitFileStatus>()
    if (gitStatus?.success && gitStatus.data.files) {
      gitStatus.data.files.forEach((file) => {
        map.set(file.path, file)
      })
    }
    return map
  }, [gitStatus])

  // Function to check if a folder contains any files with git changes
  const folderContainsGitChanges = useCallback(
    (folderPath: string): GitFileStatus | null => {
      if (!gitStatus?.success) return null

      // Priority order for git statuses (most important first)
      // Added/untracked have highest priority (green), then modified (yellow), then deleted (red)
      const statusPriority = ['added', 'untracked', 'modified', 'renamed', 'copied', 'deleted']
      let bestStatus: GitFileStatus | null = null

      // Check if any git file starts with this folder path
      for (const file of gitStatus.data.files) {
        if (file.status !== 'unchanged' && file.status !== 'ignored') {
          // Check if the file is in this folder or a subfolder
          if (file.path.startsWith(folderPath + '/')) {
            if (!bestStatus) {
              bestStatus = file
            } else {
              // If we find a higher priority status, use it
              const currentPriority = statusPriority.indexOf(bestStatus.status)
              const newPriority = statusPriority.indexOf(file.status)
              if (newPriority < currentPriority && newPriority !== -1) {
                bestStatus = file
              }
            }
          }
        }
      }
      return bestStatus
    },
    [gitStatus]
  )

  useImperativeHandle(
    ref,
    () => ({
      focusTree: (index?: number) => {
        if (index !== undefined && rowRefs.current[index]) {
          rowRefs.current[index]?.focus()
          setFocusedIndex(index)
        }
        // NOTE: If no index is provided, do nothing.
      }
    }),
    []
  )

  useEffect(() => {
    if (focusedIndex >= 0) {
      setLastFocusedIndex(focusedIndex)
    }
  }, [focusedIndex])

  const buildVisibleItems = useCallback((): VisibleItem[] => {
    const result: VisibleItem[] = []
    const visitedPaths = new Set<string>()

    function traverse(obj: Record<string, FileNode>, parentPath: string | undefined, depth: number) {
      const entries = Object.entries(obj).sort(([nameA, a], [nameB, b]) => {
        if (a._folder && !b._folder) return -1
        if (!a._folder && b._folder) return 1
        return nameA.toLowerCase().localeCompare(nameB.toLowerCase())
      })

      entries.forEach(([name, node]) => {
        const currentPath = parentPath ? `${parentPath}/${name}` : name
        if (visitedPaths.has(currentPath)) return
        visitedPaths.add(currentPath)

        result.push({
          path: currentPath,
          name,
          node,
          depth,
          parentPath
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
    const childIndex = visibleItems.findIndex((i) => i.parentPath === folderPath)
    if (childIndex !== -1) {
      setFocusedIndex(childIndex)
    }
  }

  const handleTreeKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (focusedIndex < 0) return

      switch (e.key) {
        case 'ArrowUp': {
          e.preventDefault()
          if (focusedIndex > 0) {
            setFocusedIndex((prev) => Math.max(prev - 1, 0))
          } else if (onNavigateToSearch) {
            onNavigateToSearch()
          }
          break
        }
        case 'ArrowDown': {
          e.preventDefault()
          setFocusedIndex((prev) => Math.min(prev + 1, visibleItems.length - 1))
          break
        }
        case 'ArrowLeft': {
          e.preventDefault()
          const leftItem = visibleItems[focusedIndex]
          if (leftItem.node._folder) {
            const isOpen = openPaths.get(leftItem.path) ?? autoExpand
            if (isOpen) {
              toggleOpen(leftItem.path)
              return
            }
          }
          focusParent(leftItem)
          break
        }
      }
    },
    [focusedIndex, visibleItems, onNavigateToSearch, openPaths, autoExpand, toggleOpen]
  )

  // Handle right arrow with react-hotkeys
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
        onNavigateRight?.()
      }
    },
    { enabled: isFocused },
    [visibleItems, focusedIndex, openPaths, autoExpand, isFocused, onNavigateRight, buildVisibleItems, toggleOpen]
  )

  // Handle space toggling the current file/folder
  useHotkeys(
    'space',
    (e) => {
      e.preventDefault()
      if (focusedIndex < 0) return
      const item = visibleItems[focusedIndex]
      const { node } = item
      if (node._folder) {
        selectFiles(toggleFolderUtil(node, !areAllFolderFilesSelected(node, selectedFiles), selectedFiles))
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
        )
      }
    },
    { enabled: isFocused },
    [visibleItems, focusedIndex, selectFiles, isFocused]
  )

  const { copyToClipboard } = useCopyClipboard()

  function copyEntireTree() {
    const lines: string[] = []
    for (const [name, node] of Object.entries(root)) {
      lines.push(name)
      if (node._folder) {
        lines.push(buildTreeStructure(node, '  '))
      }
    }
    copyToClipboard(lines.join('\n'), {
      successMessage: 'Full file tree copied to clipboard',
      errorMessage: 'Failed to copy full file tree'
    })
  }

  return (
    <div
      className='flex flex-col'
      tabIndex={0}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onKeyDown={handleTreeKeyDown}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          e.currentTarget.focus()
        }
      }}
    >
      <div className='flex items-center justify-between px-2 py-1 text-xs text-muted-foreground shrink-0'>
        <span>Files</span>
        <Button variant='ghost' size='sm' onClick={copyEntireTree}>
          Copy Full Tree
        </Button>
      </div>
      <div className='flex-1 min-h-0'>
        <div className='space-y-0.5 p-1'>
          {visibleItems.map((item, idx) => (
            <FileTreeNodeRow
              key={item.path}
              ref={(el) => {
                rowRefs.current[idx] = el
              }}
              item={item}
              isOpen={openPaths.get(item.path) ?? autoExpand}
              isFocused={idx === focusedIndex}
              onFocus={() => setFocusedIndex(idx)}
              onToggleOpen={() => toggleOpen(item.path)}
              onViewFile={onViewFile}
              onViewFileInEditMode={onViewFileInEditMode}
              projectRoot={projectRoot}
              gitFileStatus={
                item.node.file
                  ? gitStatusMap.get(item.node.file.path)
                  : item.node._folder
                    ? (folderContainsGitChanges(item.path) ?? undefined)
                    : undefined
              }
              gitStatus={gitStatus?.success ? gitStatus.data : null}
              root={root}
            />
          ))}
        </div>
      </div>
    </div>
  )
})
