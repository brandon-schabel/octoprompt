import { X, Copy, Bookmark, ArrowUpDown, ArrowDownAZ, RotateCw, RotateCcw, Eye } from 'lucide-react'
import { Button } from '@ui'
import { cn } from '@/lib/utils'
import { useHotkeys } from 'react-hotkeys-hook'
import { Badge } from '@ui'
import { FormatTokenCount } from '../format-token-count'
import { forwardRef, useRef, useState, useImperativeHandle, KeyboardEvent, useMemo } from 'react'
import { Input } from '@ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@ui'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuShortcut
} from '@ui'
import { toast } from 'sonner'
import { DotsHorizontalIcon } from '@radix-ui/react-icons'
import { formatShortcut } from '@/lib/shortcuts'
import { useSelectedFiles } from '@/hooks/utility-hooks/use-selected-files'
import { FileViewerDialog } from '../navigation/file-viewer-dialog'
import { ProjectFile } from '@/generated'
import { useCopyClipboard } from '@/hooks/utility-hooks/use-copy-clipboard'
import { useProjectTabById, useUpdateProjectTabState } from '@/hooks/use-kv-local-storage'

type SelectedFilesListProps = {
  onRemoveFile: (fileId: number) => void
  onNavigateLeft?: () => void
  onNavigateRight?: () => void
  className?: string
  projectTabId: string
}

export type SelectedFilesListRef = {
  focusList: () => void
}

export const SelectedFilesList = forwardRef<SelectedFilesListRef, SelectedFilesListProps>(
  ({ onRemoveFile, onNavigateLeft, className = '', projectTabId }, ref) => {
    const { undo, redo, canUndo, canRedo, clearSelectedFiles, selectedFiles, projectFileMap } = useSelectedFiles({
      tabId: projectTabId
    })

    const [focusedIndex, setFocusedIndex] = useState<number>(-1)
    const itemRefs = useRef<(HTMLDivElement | null)[]>([])
    const [sortOrder, setSortOrder] = useState<'default' | 'alphabetical' | 'size_asc' | 'size_desc'>('default')
    const [filterText, setFilterText] = useState('')
    const [bookmarkDialogOpen, setBookmarkDialogOpen] = useState(false)
    const [bookmarkName, setBookmarkName] = useState('')
    const updateProjectTabState = useUpdateProjectTabState(projectTabId)
    const [viewedFile, setViewedFile] = useState<ProjectFile | null>(null)
    const closeFileViewer = () => setViewedFile(null)
    const { copyToClipboard } = useCopyClipboard()

    const projectTab = useProjectTabById(projectTabId)
    const bookmarkedGroups = projectTab?.bookmarkedFileGroups || {}

    const copyAllSelectedFiles = async () => {
      if (!selectedFiles.length) return
      let combined = ''
      selectedFiles.forEach((id) => {
        const f = projectFileMap.get(id)
        if (f) {
          combined += `/* ${f.name} */\n${f.content ?? ''}\n\n`
        }
      })
      await copyToClipboard(combined.trim(), {
        successMessage: 'Copied all selected files content.'
      })
    }

    const handleCreateBookmark = () => {
      if (!bookmarkName.trim()) return
      updateProjectTabState((prev) => ({
        bookmarkedFileGroups: {
          ...prev.bookmarkedFileGroups,
          [bookmarkName.trim()]: selectedFiles
        }
      }))
      toast.success(`Created bookmark group "${bookmarkName}" with ${selectedFiles.length} file(s)`)
      setBookmarkName('')
      setBookmarkDialogOpen(false)
    }

    // Sorting
    let displayFiles = [...selectedFiles]
    if (sortOrder === 'alphabetical') {
      displayFiles.sort((a, b) => {
        const fa = projectFileMap.get(a)?.name || ''
        const fb = projectFileMap.get(b)?.name || ''
        return fa.localeCompare(fb)
      })
    } else if (sortOrder === 'size_desc') {
      displayFiles.sort((a, b) => {
        const fa = projectFileMap.get(a)?.content || ''
        const fb = projectFileMap.get(b)?.content || ''
        return fb.length - fa.length // Sort by size descending
      })
    } else if (sortOrder === 'size_asc') {
      displayFiles.sort((a, b) => {
        const fa = projectFileMap.get(a)?.content || ''
        const fb = projectFileMap.get(b)?.content || ''
        return fa.length - fb.length // Sort by size ascending
      })
    }

    const filteredFileIds = useMemo(() => {
      if (!filterText.trim()) return displayFiles
      return displayFiles.filter((fid) => {
        const f = projectFileMap.get(fid)
        return f && f.name.toLowerCase().includes(filterText.toLowerCase())
      })
    }, [filterText, displayFiles, projectFileMap])

    // Hotkeys for removing files with r + number
    useHotkeys('r+1', () => selectedFiles[0] && onRemoveFile(selectedFiles[0]))
    useHotkeys('r+2', () => selectedFiles[1] && onRemoveFile(selectedFiles[1]))
    useHotkeys('r+3', () => selectedFiles[2] && onRemoveFile(selectedFiles[2]))
    useHotkeys('r+4', () => selectedFiles[3] && onRemoveFile(selectedFiles[3]))
    useHotkeys('r+5', () => selectedFiles[4] && onRemoveFile(selectedFiles[4]))
    useHotkeys('r+6', () => selectedFiles[5] && onRemoveFile(selectedFiles[5]))
    useHotkeys('r+7', () => selectedFiles[6] && onRemoveFile(selectedFiles[6]))
    useHotkeys('r+8', () => selectedFiles[7] && onRemoveFile(selectedFiles[7]))
    useHotkeys('r+9', () => selectedFiles[8] && onRemoveFile(selectedFiles[8]))

    // Optional: CMD/CTRL+Z hotkeys for undo/redo can be added here

    useImperativeHandle(ref, () => ({
      focusList: () => {
        if (selectedFiles.length > 0) {
          setFocusedIndex(0)
          itemRefs.current[0]?.focus()
        }
      }
    }))

    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>, fileId: number, index: number) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          if (index < selectedFiles.length - 1) {
            setFocusedIndex(index + 1)
            itemRefs.current[index + 1]?.focus()
          }
          break
        case 'ArrowUp':
          e.preventDefault()
          if (index > 0) {
            setFocusedIndex(index - 1)
            itemRefs.current[index - 1]?.focus()
          }
          break
        case 'ArrowLeft':
          e.preventDefault()
          onNavigateLeft?.()
          break
        case 'ArrowRight':
          e.preventDefault()
          setViewedFile(projectFileMap.get(fileId) as ProjectFile)

          break
        case 'Backspace':
        case 'Delete': {
          e.preventDefault()
          const file = projectFileMap.get(fileId)
          const fileName = file?.name || ''
          const newIndex = Math.max(0, index - 1)
          setFocusedIndex(newIndex)
          onRemoveFile(fileId)
          toast.success(`Removed file "${fileName}". Press ${formatShortcut('mod+z')} to undo.`)
          // Wait for the list to update before focusing
          setTimeout(() => {
            if (selectedFiles.length > 1) {
              itemRefs.current[newIndex]?.focus()
            } else {
              // If we removed the last item, navigate back to file tree
              onNavigateLeft?.()
            }
          }, 0)
          break
        }
      }
    }

    // If no files selected:
    if (selectedFiles.length === 0) {
      return (
        <div className='flex flex-col items-center justify-center h-full p-4 text-center space-y-4'>
          <div className='space-y-3'>
            <p className='text-sm text-muted-foreground'>No files selected yet</p>
            <div className='space-y-2'>
              <p className='text-xs font-medium'>How to select files:</p>
              <ul className='text-xs text-muted-foreground space-y-1.5 list-disc list-inside'>
                <li>Click files in the file tree</li>
                <li>Search and select from results</li>
                <li>
                  Use <kbd className='px-1 rounded bg-muted'>{formatShortcut('mod+f')}</kbd> to search
                </li>
                <li>
                  Use <kbd className='px-1 rounded bg-muted'>↑</kbd> <kbd className='px-1 rounded bg-muted'>↓</kbd> to
                  navigate
                </li>
                <li>
                  Press <kbd className='px-1 rounded bg-muted'>Enter</kbd> or{' '}
                  <kbd className='px-1 rounded bg-muted'>Space</kbd> to select
                </li>
              </ul>
            </div>
            {Object.entries(bookmarkedGroups).length > 0 && (
              <div className='pt-2'>
                <p className='text-xs font-medium mb-1'>Or load a bookmark group:</p>
                <div className='flex flex-wrap gap-2 justify-center'>
                  {Object.entries(bookmarkedGroups)
                    .slice(0, 3)
                    .map(([name]) => (
                      <Button
                        key={name}
                        variant='outline'
                        size='sm'
                        className='text-xs'
                        onClick={() => {
                          updateProjectTabState({
                            selectedFiles: bookmarkedGroups[name]
                          })
                          toast.success(`Loaded bookmark group "${name}"`)
                        }}
                      >
                        <Bookmark className='mr-1 h-3 w-3' />
                        {name}
                      </Button>
                    ))}
                  {Object.entries(bookmarkedGroups).length > 3 && (
                    <Button
                      variant='ghost'
                      size='sm'
                      className='text-xs'
                      onClick={() => {
                        const menu = document.querySelector('[data-radix-collection-item]')
                        if (menu instanceof HTMLElement) {
                          menu.click()
                        }
                      }}
                    >
                      +{Object.entries(bookmarkedGroups).length - 3} more
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )
    }

    return (
      <>
        <FileViewerDialog open={!!viewedFile} viewedFile={viewedFile} onClose={closeFileViewer} />

        <Dialog open={bookmarkDialogOpen} onOpenChange={setBookmarkDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Bookmark Group</DialogTitle>
            </DialogHeader>
            <div className='py-4'>
              <Input
                placeholder='Enter bookmark group name'
                value={bookmarkName}
                onChange={(e) => setBookmarkName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateBookmark()
                  }
                }}
              />
            </div>
            <DialogFooter>
              <Button variant='outline' onClick={() => setBookmarkDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateBookmark}>Create Bookmark</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className={`flex flex-col min-h-0 ${className}`}>
          <div className='flex items-center gap-2 mb-2 shrink-0'>
            <Input
              placeholder='Filter files'
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className='flex-1'
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='ghost' size='icon' className='h-8 w-8'>
                  <DotsHorizontalIcon className='h-4 w-4' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end' className='w-48'>
                <DropdownMenuItem onClick={copyAllSelectedFiles}>
                  <Copy className='mr-2 h-4 w-4' />
                  <span>Copy All Files</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => {
                    clearSelectedFiles()
                    toast.success('Cleared all selected files')
                  }}
                >
                  <X className='mr-2 h-4 w-4' />
                  <span>Clear Selected Files</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    undo()
                    toast.success('Undo: Reverted file selection')
                  }}
                  disabled={!canUndo}
                >
                  <RotateCcw className='mr-2 h-4 w-4' />
                  <span>Undo</span>
                  <DropdownMenuShortcut>{formatShortcut('mod+z')}</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    redo()
                    toast.success('Redo: Restored file selection')
                  }}
                  disabled={!canRedo}
                >
                  <RotateCw className='mr-2 h-4 w-4' />
                  <span>Redo</span>
                  <DropdownMenuShortcut>{formatShortcut('mod+shift+z')}</DropdownMenuShortcut>
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <ArrowUpDown className='mr-2 h-4 w-4' />
                    <span>Sort By</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuRadioGroup
                      value={sortOrder}
                      onValueChange={(value) =>
                        setSortOrder(value as 'default' | 'alphabetical' | 'size_asc' | 'size_desc')
                      }
                    >
                      <DropdownMenuRadioItem value='default'>
                        <ArrowUpDown className='mr-2 h-4 w-4' />
                        <span>Added Order</span>
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value='alphabetical'>
                        <ArrowDownAZ className='mr-2 h-4 w-4' />
                        <span>Alphabetical</span>
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value='size_desc'>
                        <ArrowDownAZ className='mr-2 h-4 w-4' />
                        <span>Size (Largest First)</span>
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value='size_asc'>
                        <ArrowDownAZ className='mr-2 h-4 w-4' />
                        <span>Size (Smallest First)</span>
                      </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                {Object.entries(bookmarkedGroups).length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    {Object.entries(bookmarkedGroups).map(([name, fileIds]) => (
                      <DropdownMenuItem
                        key={name}
                        onClick={() => {
                          updateProjectTabState({
                            selectedFiles: fileIds
                          })
                          toast.success(`Loaded bookmark group "${name}"`)
                        }}
                      >
                        <Bookmark className='mr-2 h-4 w-4' />
                        <span>{name}</span>
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className='flex-1 min-h-0'>
            {filteredFileIds.map((fileId, index) => {
              const file = projectFileMap.get(fileId)
              if (!file) return null
              const shortcutNumber = index + 1
              const showShortcut = shortcutNumber <= 9

              return (
                <div
                  key={fileId}
                  ref={(el) => {
                    itemRefs.current[index] = el
                  }}
                  className={cn(
                    'shrink-0 w-full group relative mb-2 last:mb-0',
                    'focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
                    'rounded-md',
                    'flex flex-col'
                  )}
                  tabIndex={0}
                  onKeyDown={(e) => handleKeyDown(e, fileId, index)}
                >
                  {/* Action buttons container with equal spacing */}
                  <div className='absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full flex flex-col gap-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-2 transition-all duration-100 z-10'>
                    <Button
                      variant='ghost'
                      size='icon'
                      onClick={() => setViewedFile(projectFileMap.get(fileId) as ProjectFile)}
                      className='h-8 w-8'
                    >
                      <Eye className='h-4 w-4' />
                    </Button>

                    <Button
                      variant='ghost'
                      size='icon'
                      onClick={() => {
                        onRemoveFile(fileId)
                        toast.success(`Removed file "${file.name}". Press ${formatShortcut('mod+z')} to undo.`)
                      }}
                      className='h-8 w-8'
                    >
                      <X className='h-4 w-4' />
                    </Button>
                  </div>

                  <div
                    className={cn(
                      'flex flex-col p-2 rounded-md border bg-muted/50',
                      'transform transition-all duration-100',
                      'group-hover:translate-x-12',
                      'group-hover:bg-muted group-hover:border-muted-foreground/20',
                      'dark:group-hover:bg-muted/70 dark:group-hover:border-muted-foreground/30',
                      index === focusedIndex && 'bg-muted border-muted-foreground/20'
                    )}
                  >
                    <div className='flex items-center'>
                      {showShortcut && (
                        <span className='text-xs text-muted-foreground mr-2 whitespace-nowrap'>{shortcutNumber}</span>
                      )}
                      <span className='text-sm truncate'>{file.name}</span>
                      {file.content && (
                        <div className='ml-auto'>
                          <Badge className='ml-2'>
                            <FormatTokenCount tokenContent={file.content} />
                          </Badge>
                        </div>
                      )}
                    </div>
                    <div>
                      <span className='text-xs text-muted-foreground truncate'>
                        {file.path.split('/').slice(-3).join('/').slice(-30)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </>
    )
  }
)
