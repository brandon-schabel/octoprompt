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
} from '@promptliano/ui'
import { ChevronRight, Folder, FolderOpen, Home, ChevronUp } from 'lucide-react'
import { useBrowseDirectory } from '@/hooks/api/use-browse-directory'
import type { DirectoryEntry, BrowseDirectoryResponse } from '@promptliano/schemas'
import { cn } from '@/lib/utils'

interface DirectoryBrowserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectPath: (path: string) => void
  initialPath?: string
}

export function DirectoryBrowserDialog({ open, onOpenChange, onSelectPath, initialPath }: DirectoryBrowserDialogProps) {
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
            const response = data as BrowseDirectoryResponse
            setCurrentPath(response.data.currentPath)
            setSelectedPath(response.data.currentPath)
            setEntries(response.data.entries)
            setParentPath(response.data.parentPath)
          }
        }
      )
    }
  }, [open, initialPath, browseDirectory])

  const navigateToDirectory = (path: string) => {
    browseDirectory(
      { path },
      {
        onSuccess: (data: unknown) => {
          const response = data as BrowseDirectoryResponse
          setCurrentPath(response.data.currentPath)
          setSelectedPath(response.data.currentPath)
          setEntries(response.data.entries)
          setParentPath(response.data.parentPath)
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
        onSuccess: (data: unknown) => {
          const response = data as BrowseDirectoryResponse
          setCurrentPath(response.data.currentPath)
          setSelectedPath(response.data.currentPath)
          setEntries(response.data.entries)
          setParentPath(response.data.parentPath)
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
      <DialogContent className='w-[90vw] max-w-3xl h-[90vh] max-h-[600px] sm:h-[80vh] overflow-hidden'>
        <DialogHeader>
          <DialogTitle>Select Project Directory</DialogTitle>
        </DialogHeader>

        <div className='space-y-2 sm:space-y-4 flex flex-col h-full overflow-hidden'>
          {/* Breadcrumb navigation */}
          <div className='flex items-center gap-1 text-sm text-muted-foreground overflow-x-auto pb-2 min-h-[32px] scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600'>
            <Button variant='ghost' size='sm' onClick={handleGoHome} className='h-7 px-1 sm:px-2 flex-shrink-0'>
              <Home className='h-3 w-3 sm:h-4 sm:w-4' />
            </Button>
            {pathParts.map((part, index) => {
              const fullPath = homePath + pathParts.slice(0, index + 1).join('/')
              return (
                <React.Fragment key={index}>
                  <ChevronRight className='h-4 w-4 flex-shrink-0' />
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => navigateToDirectory(fullPath)}
                    className='h-7 px-1 sm:px-2 min-w-0 whitespace-nowrap'
                  >
                    <span className='whitespace-nowrap'>{part}</span>
                  </Button>
                </React.Fragment>
              )
            })}
          </div>

          <Separator />

          {/* Navigation buttons */}
          <div className='flex gap-1 sm:gap-2'>
            <Button
              variant='outline'
              size='sm'
              onClick={handleGoUp}
              disabled={!parentPath || isPending}
              className='text-xs sm:text-sm'
            >
              <ChevronUp className='h-3 w-3 sm:h-4 sm:w-4 mr-0.5 sm:mr-1' />
              <span className='hidden sm:inline'>Up</span>
            </Button>
            <Button
              variant='outline'
              size='sm'
              onClick={handleGoHome}
              disabled={isPending}
              className='text-xs sm:text-sm'
            >
              <Home className='h-3 w-3 sm:h-4 sm:w-4 mr-0.5 sm:mr-1' />
              <span className='hidden sm:inline'>Home</span>
            </Button>
          </div>

          {/* Directory listing */}
          <ScrollArea className='flex-1 min-h-[200px] sm:min-h-[300px] border rounded-md p-2'>
            {isPending ? (
              <div className='flex items-center justify-center h-full text-muted-foreground'>Loading...</div>
            ) : entries.length === 0 ? (
              <div className='flex items-center justify-center h-full text-muted-foreground'>No folders found</div>
            ) : (
              <div className='space-y-1'>
                {entries
                  .filter((entry) => entry.isDirectory && !entry.isHidden)
                  .map((entry) => (
                    <button
                      key={entry.path}
                      onClick={() => handleSelectDirectory(entry)}
                      className={cn(
                        'w-full flex items-center gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-md hover:bg-accent transition-colors text-left text-sm',
                        selectedPath === entry.path && 'bg-accent'
                      )}
                    >
                      <Folder className='h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0' />
                      <span className='truncate text-xs sm:text-sm'>{entry.name}</span>
                    </button>
                  ))}
              </div>
            )}
          </ScrollArea>

          {/* Selected path display */}
          <div className='space-y-1 sm:space-y-2'>
            <div className='text-xs sm:text-sm font-medium'>Selected Path:</div>
            <div className='bg-muted px-2 sm:px-3 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-mono overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700 whitespace-nowrap'>
              {selectedPath || 'No directory selected'}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
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
