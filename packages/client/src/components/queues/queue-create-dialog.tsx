import { useState } from 'react'
import { Button } from '@promptliano/ui'
import { Input } from '@promptliano/ui'
import { Textarea } from '@promptliano/ui'
import { Label } from '@promptliano/ui'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@promptliano/ui'
import { Loader2 } from 'lucide-react'
import { useCreateQueue } from '@/hooks/api/use-queue-api'

interface QueueCreateDialogProps {
  projectId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function QueueCreateDialog({ projectId, open, onOpenChange }: QueueCreateDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [maxParallelItems, setMaxParallelItems] = useState('1')

  const createQueueMutation = useCreateQueue(projectId)

  const handleCreate = async () => {
    if (!name.trim()) return

    await createQueueMutation.mutateAsync({
      name: name.trim(),
      description: description.trim(),
      maxParallelItems: parseInt(maxParallelItems) || 1
    })

    // Reset form
    setName('')
    setDescription('')
    setMaxParallelItems('1')
    onOpenChange(false)
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset form when closing
      setName('')
      setDescription('')
      setMaxParallelItems('1')
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Queue</DialogTitle>
          <DialogDescription>Create a new task processing queue for AI agents</DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-4'>
          <div className='space-y-2'>
            <Label htmlFor='queue-name'>Queue Name</Label>
            <Input
              id='queue-name'
              placeholder='e.g., Main Queue, Bug Fixes, Features'
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='queue-description'>Description (optional)</Label>
            <Textarea
              id='queue-description'
              placeholder='Describe what this queue is for...'
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='max-parallel'>Max Parallel Items</Label>
            <Input
              id='max-parallel'
              type='number'
              min='1'
              max='10'
              value={maxParallelItems}
              onChange={(e) => setMaxParallelItems(e.target.value)}
            />
            <p className='text-sm text-muted-foreground'>Maximum number of items an agent can process simultaneously</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim() || createQueueMutation.isPending}>
            {createQueueMutation.isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            Create Queue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
