import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProjectFile } from "shared"
import { cn } from "@/lib/utils"
import { useHotkeys } from "react-hotkeys-hook"
import { Badge } from "@/components/ui/badge"
import { FormatTokenCount } from "../format-token-count"
import { forwardRef, useRef, useState, useImperativeHandle, KeyboardEvent } from 'react'

type SelectedFilesListProps = {
  selectedFiles: string[]
  fileMap: Map<string, ProjectFile>
  onRemoveFile: (fileId: string) => void
  onNavigateLeft?: () => void
  onNavigateRight?: () => void
}

export type SelectedFilesListRef = {
  focusList: () => void
}

export const SelectedFilesList = forwardRef<SelectedFilesListRef, SelectedFilesListProps>(({
  selectedFiles,
  fileMap,
  onRemoveFile,
  onNavigateLeft,
  onNavigateRight
}, ref) => {
  const [focusedIndex, setFocusedIndex] = useState<number>(-1)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])

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
    <div className="space-y-2 w-60 p-2 items-center flex flex-col">
      {selectedFiles.map((fileId, index) => {
        const file = fileMap.get(fileId)
        if (!file) return null
        const shortcutNumber = index + 1
        const showShortcut = shortcutNumber <= 9

        return (
          <div
            key={fileId}
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
  )
}) 