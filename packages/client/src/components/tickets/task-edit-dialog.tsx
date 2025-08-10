import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { Input } from '@promptliano/ui'
import { Textarea } from '@promptliano/ui'
import { Label } from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { X } from 'lucide-react'
import { useUpdateTask } from '@/hooks/api/use-tickets-api'
import { toast } from 'sonner'
import type { TicketTask } from '@promptliano/schemas'

interface TaskEditDialogProps {
  isOpen: boolean
  onClose: () => void
  task: TicketTask | null
  ticketId: number
  projectId: number
}

export function TaskEditDialog({ isOpen, onClose, task, ticketId, projectId }: TaskEditDialogProps) {
  const [content, setContent] = useState('')
  const [description, setDescription] = useState('')
  const [estimatedHours, setEstimatedHours] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [agentId, setAgentId] = useState('')

  const updateTask = useUpdateTask()

  useEffect(() => {
    if (task) {
      setContent(task.content || '')
      setDescription(task.description || '')
      setEstimatedHours(task.estimatedHours?.toString() || '')
      setTags(task.tags || [])
      setAgentId(task.agentId || '')
    }
  }, [task])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!task || !content.trim()) return

    // Validate input lengths
    if (content.length > 500) {
      toast.error('Task content must be less than 500 characters')
      return
    }

    if (description.length > 2000) {
      toast.error('Description must be less than 2000 characters')
      return
    }

    try {
      await updateTask.mutateAsync({
        ticketId,
        taskId: task.id,
        data: {
          content: content.trim().substring(0, 500), // Extra safety
          description: description.trim().substring(0, 2000) || undefined,
          estimatedHours: estimatedHours ? parseFloat(estimatedHours) : undefined,
          tags: tags.slice(0, 10), // Limit to 10 tags
          agentId: agentId.trim() || undefined
        }
      })

      toast.success('Task updated successfully')
      onClose()
    } catch (error) {
      toast.error('Failed to update task')
      console.error('Task update error:', error)
    }
  }

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()])
      setTagInput('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.metaKey) {
      e.preventDefault()
      handleSubmit(e as any)
    }
  }

  if (!task) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='sm:max-w-[600px]' onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className='space-y-4'>
          <div className='space-y-2'>
            <div className='flex justify-between items-center'>
              <Label htmlFor='content'>Task Content *</Label>
              <span className='text-xs text-muted-foreground'>{content.length}/500</span>
            </div>
            <Input
              id='content'
              value={content}
              onChange={(e) => setContent(e.target.value.substring(0, 500))}
              placeholder='Enter task content'
              required
              autoFocus
              maxLength={500}
            />
          </div>

          <div className='space-y-2'>
            <div className='flex justify-between items-center'>
              <Label htmlFor='description'>Description</Label>
              <span className='text-xs text-muted-foreground'>{description.length}/2000</span>
            </div>
            <Textarea
              id='description'
              value={description}
              onChange={(e) => setDescription(e.target.value.substring(0, 2000))}
              placeholder='Add a detailed description (optional)'
              rows={3}
              maxLength={2000}
            />
          </div>

          <div className='grid grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <Label htmlFor='estimatedHours'>Estimated Hours</Label>
              <Input
                id='estimatedHours'
                type='number'
                step='0.5'
                min='0'
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                placeholder='e.g., 2.5'
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='agentId'>Agent ID</Label>
              <Input
                id='agentId'
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                placeholder='e.g., frontend-expert'
              />
            </div>
          </div>

          <div className='space-y-2'>
            <Label>Tags</Label>
            <div className='flex gap-2'>
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddTag()
                  }
                }}
                placeholder='Add tags and press Enter'
              />
              <Button type='button' onClick={handleAddTag} variant='outline'>
                Add
              </Button>
            </div>
            {tags.length > 0 && (
              <div className='flex flex-wrap gap-2 mt-2'>
                {tags.map((tag) => (
                  <Badge key={tag} variant='secondary' className='gap-1'>
                    {tag}
                    <button type='button' onClick={() => handleRemoveTag(tag)} className='ml-1 hover:text-destructive'>
                      <X className='h-3 w-3' />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type='button' variant='outline' onClick={onClose}>
              Cancel
            </Button>
            <Button type='submit' disabled={updateTask.isPending}>
              {updateTask.isPending ? 'Updating...' : 'Update Task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
