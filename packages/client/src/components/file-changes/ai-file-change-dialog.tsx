import React, { useState } from 'react'
import { useGenerateFileChange, useGetFileChange, useConfirmFileChange } from '@/hooks/api/use-ai-file-changes-api'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@ui'
import { Button } from '@ui'
import { Textarea } from '@ui'
import { Alert, AlertDescription } from '@ui'
import { LoaderPinwheel } from 'lucide-react'
import { DiffViewer } from './diff-viewer'
import { useActiveProjectTab } from '@/hooks/use-kv-local-storage'

interface AIFileChangeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filePath?: string
  onSuccess?: () => void
}

export function AIFileChangeDialog({ open, onOpenChange, filePath = '', onSuccess }: AIFileChangeDialogProps) {
  const [prompt, setPrompt] = useState('')
  const [changeId, setChangeId] = useState<string | null>(null)
  const [activeProject] = useActiveProjectTab()
  const projectId = activeProject?.selectedProjectId

  const generateMutation = useGenerateFileChange()
  const confirmMutation = useConfirmFileChange()
  const { data: changeResponse, isLoading: isLoadingChange } = useGetFileChange(projectId ?? '', changeId)

  const handleGenerate = async () => {
    if (!filePath) return

    try {
      const response = await generateMutation.mutateAsync({
        filePath,
        prompt,
        projectId: projectId ?? ''
      })

      if (response?.result?.id) {
        setChangeId(response.result.id)
      }
    } catch (error) {
      console.error('Failed to generate change:', error)
    }
  }

  const handleConfirm = async () => {
    if (!changeId) return

    try {
      await confirmMutation.mutateAsync({ changeId: changeId, projectId: projectId ?? '' })
      onSuccess?.()
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to confirm change:', error)
    }
  }

  const handleClose = () => {
    setPrompt('')
    setChangeId(null)
    onOpenChange(false)
  }

  const isGenerating = generateMutation.isPending
  const isConfirming = confirmMutation.isPending

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className='sm:max-w-[600px]'>
        <DialogHeader>
          <DialogTitle>AI File Change</DialogTitle>
          <DialogDescription>Describe the changes you want to make to {filePath}</DialogDescription>
        </DialogHeader>

        <div className='grid gap-4 py-4'>
          {/* Prompt Section */}
          <div className='grid gap-2'>
            <label htmlFor='prompt'>What changes would you like to make?</label>
            <Textarea
              id='prompt'
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder='Describe the changes you want...'
              disabled={!!changeId}
              rows={4}
            />
          </div>

          {changeId && (
            <div className='grid gap-2'>
              <h3 className='font-medium'>Suggested Changes</h3>
              {isLoadingChange ? (
                <div className='flex items-center justify-center p-4'>
                  <LoaderPinwheel />
                </div>
              ) : changeResponse ? (
                <DiffViewer
                  oldValue={changeResponse.fileChange.originalContent}
                  newValue={changeResponse.fileChange.suggestedContent}
                />
              ) : (
                <Alert variant='destructive'>
                  <AlertDescription>Failed to load the suggested changes.</AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <DialogFooter className='gap-2'>
          <Button variant='outline' onClick={handleClose}>
            Cancel
          </Button>
          {!changeId ? (
            <Button onClick={handleGenerate} disabled={!prompt || isGenerating}>
              {isGenerating ? <LoaderPinwheel className='mr-2' /> : null}
              Generate Changes
            </Button>
          ) : (
            <Button onClick={handleConfirm} disabled={isConfirming || !changeResponse} variant='default'>
              {isConfirming ? <LoaderPinwheel className='mr-2' /> : null}
              Confirm &amp; Apply Changes
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
