import * as React from 'react'
import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  ScrollArea,
  Separator
} from '@ui'
import { ChevronRight, Folder, FolderOpen, Home, ChevronUp } from 'lucide-react'
import { useBrowseDirectory } from '@/hooks/api/use-browse-directory'
import type { DirectoryEntry } from '@octoprompt/schemas'
import { cn } from '@/lib/utils'

interface DirectoryBrowserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectPath: (path: string) => void
  initialPath?: string
}

export function DirectoryBrowserDialog({
  open,
  onOpenChange,
  onSelectPath,
  initialPath
}: DirectoryBrowserDialogProps) {
  const [currentPath, setCurrentPath] = useState<string>('')
  const [selectedPath, setSelectedPath] = useState<string>('')
  const [entries, setEntries] = useState<DirectoryEntry[]>([])
  const [parentPath, setParentPath] = useState<string | null>(null)
  
  const { mutate: browseDirectory, isPending } = useBrowseDirectory()

  // Load initial directory when dialog opens
  useEffect(() => {
    if (open) {
      browseDirectory(
        { path: initialPath },
        {
          onSuccess: (data) => {
            setCurrentPath(data.data.currentPath)
            setSelectedPath(data.data.currentPath)
            setEntries(data.data.entries)
            setParentPath(data.data.parentPath)
          }
        }
      )
    }
  }, [open, initialPath, browseDirectory])

  const navigateToDirectory = (path: string) => {
    browseDirectory(
      { path },
      {
        onSuccess: (data) => {
          setCurrentPath(data.data.currentPath)
          setSelectedPath(data.data.currentPath)
          setEntries(data.data.entries)
          setParentPath(data.data.parentPath)
        }
      }
    )
  }

  const handleSelectDirectory = (entry: DirectoryEntry) => {
    if (entry.isDirectory) {
      navigateToDirectory(entry.path)
    }
  }

  const handleConfirm = () => {
    onSelectPath(selectedPath)
    onOpenChange(false)
  }

  const handleGoHome = () => {
    browseDirectory(
      undefined, // No path means home directory
      {
        onSuccess: (data) => {
          setCurrentPath(data.data.currentPath)
          setSelectedPath(data.data.currentPath)
          setEntries(data.data.entries)
          setParentPath(data.data.parentPath)
        }
      }
    )
  }

  const handleGoUp = () => {
    if (parentPath) {
      navigateToDirectory(parentPath)
    }
  }

  // Generate breadcrumb parts from path
  const pathParts = currentPath.split('/').filter(Boolean)
  const homePath = currentPath.substring(0, currentPath.indexOf(pathParts[0]))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Select Project Directory</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Breadcrumb navigation */}
          <div className="flex items-center gap-1 text-sm text-muted-foreground overflow-x-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGoHome}
              className="h-7 px-2"
            >
              <Home className="h-4 w-4" />
            </Button>
            {pathParts.map((part, index) => {
              const fullPath = homePath + pathParts.slice(0, index + 1).join('/')
              return (
                <React.Fragment key={index}>
                  <ChevronRight className="h-4 w-4" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigateToDirectory(fullPath)}
                    className="h-7 px-2"
                  >
                    {part}
                  </Button>
                </React.Fragment>
              )
            })}
          </div>

          <Separator />

          {/* Navigation buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGoUp}
              disabled={!parentPath || isPending}
            >
              <ChevronUp className="h-4 w-4 mr-1" />
              Up
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGoHome}
              disabled={isPending}
            >
              <Home className="h-4 w-4 mr-1" />
              Home
            </Button>
          </div>

          {/* Directory listing */}
          <ScrollArea className="h-[400px] border rounded-md p-2">
            {isPending ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Loading...
              </div>
            ) : entries.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No folders found
              </div>
            ) : (
              <div className="space-y-1">
                {entries
                  .filter(entry => entry.isDirectory && !entry.isHidden)
                  .map((entry) => (
                    <button
                      key={entry.path}
                      onClick={() => handleSelectDirectory(entry)}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent transition-colors text-left",
                        selectedPath === entry.path && "bg-accent"
                      )}
                    >
                      <Folder className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{entry.name}</span>
                    </button>
                  ))}
              </div>
            )}
          </ScrollArea>

          {/* Selected path display */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Selected Path:</div>
            <div className="bg-muted px-3 py-2 rounded-md text-sm font-mono truncate">
              {selectedPath || 'No directory selected'}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedPath}>
            Select This Directory
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}