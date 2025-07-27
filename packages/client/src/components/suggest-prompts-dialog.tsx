import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@ui'
import { Button } from '@ui'
import { useActiveProjectTab, useUpdateActiveProjectTab, useProjectTabField } from '@/hooks/use-kv-local-storage'
import { Prompt } from '@promptliano/schemas'
import { ErrorBoundary } from '@/components/error-boundary/error-boundary'
import { cn } from '@/lib/utils'

type SuggestedPromptsDialogProps = {
  open: boolean
  onClose: () => void
  suggestedPrompts: Prompt[]
}

export function SuggestedPromptsDialog({ open, onClose, suggestedPrompts }: SuggestedPromptsDialogProps) {
  const [activeProjectTabState, , activeProjectTabId] = useActiveProjectTab()
  const updateActiveProjectTab = useUpdateActiveProjectTab()
  const { data: selectedPrompts = [] } = useProjectTabField('selectedPrompts', activeProjectTabId ?? -1)
  const [localSelectedPrompts, setLocalSelectedPrompts] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (open) {
      setLocalSelectedPrompts(new Set(selectedPrompts))
    }
  }, [open, selectedPrompts])

  const toggleLocalPrompt = (promptId: number) => {
    setLocalSelectedPrompts((prev) => {
      const next = new Set(prev)
      if (next.has(promptId)) {
        next.delete(promptId)
      } else {
        next.add(promptId)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    setLocalSelectedPrompts((prev) => {
      const next = new Set<number>(prev)
      const allSelected = suggestedPrompts.every((p) => next.has(p.id))

      if (allSelected) {
        suggestedPrompts.forEach((p) => next.delete(p.id))
      } else {
        suggestedPrompts.forEach((p) => next.add(p.id))
      }
      return next
    })
  }

  const handleDialogClose = () => {
    updateActiveProjectTab({ selectedPrompts: [...localSelectedPrompts] })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className='max-w-2xl'>
        <ErrorBoundary>
          <DialogHeader>
            <DialogTitle>Recommended Prompts</DialogTitle>
            <DialogDescription>
              Based on your input and project context, these prompts may be helpful:
            </DialogDescription>
          </DialogHeader>

          <div className='mt-2 space-y-3 max-h-[400px] overflow-y-auto pr-2'>
            {suggestedPrompts.map((prompt) => {
              const isSelected = localSelectedPrompts.has(prompt.id)
              return (
                <div
                  key={prompt.id}
                  className={cn(
                    'p-3 rounded-md border cursor-pointer transition-colors',
                    isSelected ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
                  )}
                  onClick={() => toggleLocalPrompt(prompt.id)}
                >
                  <div className='flex items-start gap-3'>
                    <input
                      type='checkbox'
                      checked={isSelected}
                      onChange={() => toggleLocalPrompt(prompt.id)}
                      onClick={(e) => e.stopPropagation()}
                      className='mt-1'
                    />
                    <div className='flex-1 space-y-1'>
                      <div className='font-medium text-sm'>{prompt.name}</div>
                      <div className='text-xs text-muted-foreground line-clamp-3'>{prompt.content}</div>
                    </div>
                  </div>
                </div>
              )
            })}
            {suggestedPrompts.length === 0 && (
              <div className='text-center py-8 text-muted-foreground'>No prompts found matching your input</div>
            )}
          </div>

          <DialogFooter>
            {suggestedPrompts.length > 0 && (
              <Button onClick={handleSelectAll} variant='outline'>
                {suggestedPrompts.every((prompt) => localSelectedPrompts.has(prompt.id))
                  ? 'Deselect All'
                  : 'Select All'}
              </Button>
            )}
            <Button onClick={handleDialogClose}>{suggestedPrompts.length > 0 ? 'Confirm' : 'Close'}</Button>
          </DialogFooter>
        </ErrorBoundary>
      </DialogContent>
    </Dialog>
  )
}
