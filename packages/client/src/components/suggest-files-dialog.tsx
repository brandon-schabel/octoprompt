import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@ui'
import { Button } from '@ui'
import { useSelectedFiles } from '@/hooks/utility-hooks/use-selected-files'
import { ProjectFile } from '@/generated'

type SuggestedFilesDialogProps = {
  open: boolean
  onClose: () => void
  suggestedFiles: ProjectFile[]
}

export function SuggestedFilesDialog({ open, onClose, suggestedFiles }: SuggestedFilesDialogProps) {
  const { selectedFiles, selectFiles } = useSelectedFiles()
  const [localSelectedFiles, setLocalSelectedFiles] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (open) {
      setLocalSelectedFiles(new Set(selectedFiles))
    }
  }, [open, selectedFiles])

  const toggleLocalFile = (fileId: number) => {
    setLocalSelectedFiles((prev) => {
      const next = new Set(prev)
      if (next.has(fileId)) {
        next.delete(fileId)
      } else {
        next.add(fileId)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    setLocalSelectedFiles((prev) => {
      const next = new Set(prev)
      const allSelected = suggestedFiles.every((f) => next.has(f.id))

      if (allSelected) {
        suggestedFiles.forEach((f) => next.delete(f.id))
      } else {
        suggestedFiles.forEach((f) => next.add(f.id))
      }
      return next
    })
  }

  const handleDialogClose = () => {
    selectFiles([...localSelectedFiles])
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className='max-w-lg'>
        <DialogHeader>
          <DialogTitle>Recommended Files</DialogTitle>
          <DialogDescription>Based on your prompt, the system recommends:</DialogDescription>
        </DialogHeader>

        <div className='mt-2 space-y-2 max-h-[300px] overflow-y-auto pr-2'>
          {suggestedFiles.map((file) => {
            const isSelected = localSelectedFiles.has(file.id)
            return (
              <div key={file.id} className='flex items-center gap-2'>
                <input type='checkbox' checked={isSelected} onChange={() => toggleLocalFile(file.id)} />
                <div className='text-sm leading-tight break-all'>
                  <div className='font-medium'>{file.name}</div>
                  <div className='text-xs text-muted-foreground'>{file.path}</div>
                </div>
              </div>
            )
          })}
        </div>

        <DialogFooter>
          <Button onClick={handleSelectAll} variant='outline'>
            {suggestedFiles.every((file) => localSelectedFiles.has(file.id)) ? 'Deselect All' : 'Select All'}
          </Button>
          <Button onClick={handleDialogClose}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
