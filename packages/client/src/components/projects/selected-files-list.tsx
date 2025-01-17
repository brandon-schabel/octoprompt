import { X, Copy, Bookmark, BookmarkPlus, ArrowUpDown, ArrowDownAZ, RotateCw, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProjectFile } from "shared"
import { cn } from "@/lib/utils"
import { useHotkeys } from "react-hotkeys-hook"
import { Badge } from "@/components/ui/badge"
import { FormatTokenCount } from "../format-token-count"
import { forwardRef, useRef, useState, useImperativeHandle, KeyboardEvent, useMemo } from 'react'
import { Input } from "../ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuShortcut } from "../ui/dropdown-menu"
import { toast } from "sonner"
import { useGlobalStateHelpers } from "../global-state/use-global-state-helpers"
import { DotsHorizontalIcon } from "@radix-ui/react-icons"
import { formatModShortcut, modSymbol, shiftSymbol } from "@/lib/platform"

type SelectedFilesListProps = {
  selectedFiles: string[]
  fileMap: Map<string, ProjectFile>
  onRemoveFile: (fileId: string) => void
  onNavigateLeft?: () => void
  onNavigateRight?: () => void
  className?: string
  projectTabId: string
}

export type SelectedFilesListRef = {
  focusList: () => void
}

export const SelectedFilesList = forwardRef<SelectedFilesListRef, SelectedFilesListProps>(({
  selectedFiles,
  fileMap,
  onRemoveFile,
  onNavigateLeft,
  onNavigateRight,
  className = '',
  projectTabId,
}, ref) => {
  const [focusedIndex, setFocusedIndex] = useState<number>(-1)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])
  const [sortOrder, setSortOrder] = useState<"default" | "alphabetical">("default")
  const [filterText, setFilterText] = useState("")
  const [bookmarkDialogOpen, setBookmarkDialogOpen] = useState(false)
  const [bookmarkName, setBookmarkName] = useState("")
  const { state, updateProjectTabState } = useGlobalStateHelpers()
  const [canUndo, setCanUndo] = useState(true) // TODO: Get from state
  const [canRedo, setCanRedo] = useState(true) // TODO: Get from state
  const undo = () => {
    // TODO: Implement undo
    toast.success('Undo: Reverted file selection')
  }
  const redo = () => {
    // TODO: Implement redo
    toast.success('Redo: Restored file selection')
  }

  const projectTab = state?.projectTabs[projectTabId]
  const bookmarkedGroups = projectTab?.bookmarkedFileGroups || {}

  const copyAllSelectedFiles = async () => {
    if (!selectedFiles.length) return
    let combined = ""
    selectedFiles.forEach((id) => {
      const f = fileMap.get(id)
      if (f) {
        combined += `/* ${f.name} */\n${f.content ?? ""}\n\n`
      }
    })
    await navigator.clipboard.writeText(combined.trim())
    toast.success("Copied all selected files content.")
  }

  const handleCreateBookmark = () => {
    if (!bookmarkName.trim()) return
    updateProjectTabState(projectTabId, (prev) => ({
      bookmarkedFileGroups: {
        ...prev.bookmarkedFileGroups,
        [bookmarkName.trim()]: selectedFiles
      }
    }))
    toast.success(`Created bookmark group "${bookmarkName}" with ${selectedFiles.length} file(s)`)
    setBookmarkName("")
    setBookmarkDialogOpen(false)
  }

  let displayFiles = [...selectedFiles]
  if (sortOrder === "alphabetical") {
    displayFiles.sort((a, b) => {
      const fa = fileMap.get(a)?.name || ""
      const fb = fileMap.get(b)?.name || ""
      return fa.localeCompare(fb)
    })
  }

  const filteredFileIds = useMemo(() => {
    if (!filterText.trim()) return displayFiles
    return displayFiles.filter((fid) => {
      const f = fileMap.get(fid)
      return f && f.name.toLowerCase().includes(filterText.toLowerCase())
    })
  }, [filterText, displayFiles, fileMap])

  // Add hotkeys for removing files with r + number
  useHotkeys('r+1', () => selectedFiles[0] && onRemoveFile(selectedFiles[0]))
  useHotkeys('r+2', () => selectedFiles[1] && onRemoveFile(selectedFiles[1]))
  useHotkeys('r+3', () => selectedFiles[2] && onRemoveFile(selectedFiles[2]))
  useHotkeys('r+4', () => selectedFiles[3] && onRemoveFile(selectedFiles[3]))
  useHotkeys('r+5', () => selectedFiles[4] && onRemoveFile(selectedFiles[4]))
  useHotkeys('r+6', () => selectedFiles[5] && onRemoveFile(selectedFiles[5]))
  useHotkeys('r+7', () => selectedFiles[6] && onRemoveFile(selectedFiles[6]))
  useHotkeys('r+8', () => selectedFiles[7] && onRemoveFile(selectedFiles[7]))
  useHotkeys('r+9', () => selectedFiles[8] && onRemoveFile(selectedFiles[8]))

  useImperativeHandle(ref, () => ({
    focusList: () => {
      if (selectedFiles.length > 0) {
        setFocusedIndex(0)
        itemRefs.current[0]?.focus()
      }
    }
  }))

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>, fileId: string, index: number) => {
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
        onNavigateRight?.()
        break
      case 'Backspace':
      case 'Delete':
        e.preventDefault()
        const newIndex = Math.max(0, index - 1)
        setFocusedIndex(newIndex)
        onRemoveFile(fileId)
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

  if (selectedFiles.length === 0) {
    return <p className="text-sm text-muted-foreground p-2">No files selected</p>
  }

  return (
    <>
      <Dialog open={bookmarkDialogOpen} onOpenChange={setBookmarkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Bookmark Group</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Enter bookmark group name"
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
            <Button variant="outline" onClick={() => setBookmarkDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateBookmark}>
              Create Bookmark
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className={`space-y-2 p-2 items-center flex flex-col ${className}`}>
        <div className="flex items-center gap-2 mb-2 w-full">
          <Input
            placeholder="Filter files"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <DotsHorizontalIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={copyAllSelectedFiles}>
                <Copy className="mr-2 h-4 w-4" />
                <span>Copy All Files</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                updateProjectTabState(projectTabId, { selectedFiles: [] })
                toast.success("Cleared all selected files")
              }}>
                <X className="mr-2 h-4 w-4" />
                <span>Clear Selected Files</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={undo} disabled={!canUndo}>
                <RotateCcw className="mr-2 h-4 w-4" />
                <span>Undo</span>
                <DropdownMenuShortcut>{formatModShortcut('z')}</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={redo} disabled={!canRedo}>
                <RotateCw className="mr-2 h-4 w-4" />
                <span>Redo</span>
                <DropdownMenuShortcut>{`${modSymbol}${shiftSymbol}Z`}</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <ArrowUpDown className="mr-2 h-4 w-4" />
                  <span>Sort By</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup value={sortOrder} onValueChange={(value) => setSortOrder(value as "default" | "alphabetical")}>
                    <DropdownMenuRadioItem value="default">
                      <ArrowUpDown className="mr-2 h-4 w-4" />
                      <span>Added Order</span>
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="alphabetical">
                      <ArrowDownAZ className="mr-2 h-4 w-4" />
                      <span>Alphabetical</span>
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
                        updateProjectTabState(projectTabId, {
                          selectedFiles: fileIds
                        })
                        toast.success(`Loaded bookmark group "${name}"`)
                      }}
                    >
                      <Bookmark className="mr-2 h-4 w-4" />
                      <span>{name}</span>
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {filteredFileIds.map((fileId, index) => {
          const file = fileMap.get(fileId)
          if (!file) return null
          const shortcutNumber = index + 1
          const showShortcut = shortcutNumber <= 9

          return (
            <div
              key={fileId}
              // @ts-ignore
              ref={el => itemRefs.current[index] = el}
              className={cn(
                "w-full group relative",
                "focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
                "rounded-md"
              )}
              tabIndex={0}
              onKeyDown={(e) => handleKeyDown(e, fileId, index)}
            >
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRemoveFile(fileId)}
                className={cn(
                  "absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full",
                  "opacity-0 group-hover:opacity-100 group-hover:translate-x-2",
                  "transition-all duration-100 z-10 h-8 w-8"
                )}
              >
                <X className="h-4 w-4" />
              </Button>
              <div className={cn(
                "flex flex-col p-2 rounded-md border bg-muted/50",
                "transform transition-all duration-100",
                "group-hover:translate-x-12",
                "group-hover:bg-muted group-hover:border-muted-foreground/20",
                "dark:group-hover:bg-muted/70 dark:group-hover:border-muted-foreground/30",
                index === focusedIndex && "bg-muted border-muted-foreground/20"
              )}>
                <div className="flex items-center">
                  {showShortcut && (
                    <span className="text-xs text-muted-foreground mr-2 whitespace-nowrap">
                      {shortcutNumber}
                    </span>
                  )}
                  <span className="text-sm truncate">{file.name}</span>
                  {file.content && (
                    <div className="ml-auto">
                      <Badge
                        className="ml-2"
                      >
                        <FormatTokenCount tokenContent={file.content} />
                      </Badge>
                    </div>
                  )}
                </div>
                <div>
                  <span className="text-xs text-muted-foreground truncate">{file.path.split('/').slice(-3).join('/').slice(-30)}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}) 