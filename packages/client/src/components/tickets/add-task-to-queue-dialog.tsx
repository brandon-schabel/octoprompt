import React, { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { RadioGroup, RadioGroupItem } from '@promptliano/ui'
import { Label } from '@promptliano/ui'
import { Card, CardContent } from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { Slider } from '@promptliano/ui'
import { ScrollArea } from '@promptliano/ui'
import { Skeleton } from '@promptliano/ui'
import { cn } from '@/lib/utils'
import { useGetQueuesWithStats } from '@/hooks/api/use-queue-api'
import { useEnqueueTask } from '@/hooks/api/use-flow-api'
import { toast } from 'sonner'
import { Inbox, Clock, CheckCircle2, AlertCircle, Pause, Play, Loader2, ListPlus } from 'lucide-react'
import type { QueueWithStats, TicketTask } from '@promptliano/schemas'

interface AddTaskToQueueDialogProps {
  isOpen: boolean
  onClose: () => void
  task: TicketTask | null
  projectId: number
  ticketQueueId?: number | null
  ticketQueueName?: string
}

export function AddTaskToQueueDialog({
  isOpen,
  onClose,
  task,
  projectId,
  ticketQueueId,
  ticketQueueName
}: AddTaskToQueueDialogProps) {
  const [selectedQueueId, setSelectedQueueId] = useState<number | null>(ticketQueueId || null)
  const [priority, setPriority] = useState(5)

  const { data: queues, isLoading } = useGetQueuesWithStats(projectId)
  const enqueueTask = useEnqueueTask()

  const handleAddToQueue = async () => {
    if (!selectedQueueId || !task) {
      toast.error('Please select a queue')
      return
    }

    try {
      await enqueueTask.mutateAsync({
        taskId: task.id,
        queueId: selectedQueueId,
        priority: 10 - priority // Invert for UI (higher slider = higher priority)
      })

      toast.success('Task added to queue successfully')
      onClose()
    } catch (error: any) {
      toast.error(error.message || 'Failed to add task to queue')
    }
  }

  const getQueueStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Play className='h-3 w-3' />
      case 'paused':
        return <Pause className='h-3 w-3' />
      default:
        return <Clock className='h-3 w-3' />
    }
  }

  const getQueueItemCount = (stats: QueueWithStats['stats']) => {
    const total = stats.queuedItems + stats.inProgressItems
    return total
  }

  if (!task) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='sm:max-w-[500px]'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <ListPlus className='h-5 w-5' />
            Add Task to Queue
          </DialogTitle>
          <DialogDescription>Select a queue for task: "{task.content}"</DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-4'>
          {/* Queue Selection */}
          <div className='space-y-2'>
            <Label>Available Queues</Label>
            {isLoading ? (
              <div className='space-y-2'>
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className='h-16 w-full' />
                ))}
              </div>
            ) : queues && queues.length > 0 ? (
              <ScrollArea className='h-[280px] pr-4'>
                <RadioGroup
                  value={selectedQueueId?.toString()}
                  onValueChange={(value) => setSelectedQueueId(parseInt(value))}
                >
                  <div className='space-y-2'>
                    {queues.map((queueData) => {
                      const isSelected = selectedQueueId === queueData.queue.id
                      const itemCount = getQueueItemCount(queueData.stats)
                      const isTicketQueue = ticketQueueId === queueData.queue.id

                      return (
                        <div key={queueData.queue.id} className='relative'>
                          <RadioGroupItem
                            value={queueData.queue.id.toString()}
                            id={`queue-${queueData.queue.id}`}
                            className='peer sr-only'
                          />
                          <Label htmlFor={`queue-${queueData.queue.id}`} className='cursor-pointer'>
                            <Card
                              className={cn(
                                'transition-all hover:shadow-md',
                                isSelected && 'ring-2 ring-primary shadow-md',
                                queueData.queue.status === 'paused' && 'opacity-60'
                              )}
                            >
                              <CardContent className='p-3'>
                                <div className='flex items-start justify-between'>
                                  <div className='flex-1'>
                                    <div className='flex items-center gap-2 mb-1'>
                                      <Inbox className='h-4 w-4 text-muted-foreground' />
                                      <span className='font-medium'>{queueData.queue.name}</span>
                                      {isTicketQueue && (
                                        <Badge variant='outline' className='text-xs'>
                                          Ticket's Queue
                                        </Badge>
                                      )}
                                    </div>
                                    {queueData.queue.description && (
                                      <p className='text-xs text-muted-foreground mb-2 line-clamp-1'>
                                        {queueData.queue.description}
                                      </p>
                                    )}
                                    <div className='flex items-center gap-3 text-xs'>
                                      <Badge variant='secondary' className='text-xs'>
                                        {getQueueStatusIcon(queueData.queue.status ?? 'inactive')}
                                        <span className='ml-1'>{queueData.queue.status}</span>
                                      </Badge>
                                      <span className='text-muted-foreground'>
                                        {itemCount === 0 ? 'Empty' : itemCount === 1 ? '1 item' : `${itemCount} items`}
                                      </span>
                                      {queueData.stats.failedItems > 0 && (
                                        <span className='flex items-center gap-1 text-red-600'>
                                          <AlertCircle className='h-3 w-3' />
                                          {queueData.stats.failedItems} failed
                                        </span>
                                      )}
                                      {queueData.stats.completedItems > 0 && (
                                        <span className='flex items-center gap-1 text-green-600'>
                                          <CheckCircle2 className='h-3 w-3' />
                                          {queueData.stats.completedItems}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </Label>
                        </div>
                      )
                    })}
                  </div>
                </RadioGroup>
              </ScrollArea>
            ) : (
              <div className='text-center py-8 text-muted-foreground'>
                <Inbox className='h-12 w-12 mx-auto mb-3 opacity-50' />
                <p className='text-sm'>No queues available</p>
                <p className='text-xs mt-1'>Create a queue first to start processing tasks</p>
              </div>
            )}
          </div>

          {/* Priority Slider */}
          {queues && queues.length > 0 && (
            <div className='space-y-2'>
              <div className='flex items-center justify-between'>
                <Label htmlFor='priority'>Priority</Label>
                <span className='text-sm text-muted-foreground'>
                  {priority === 10 ? 'Highest' : priority >= 7 ? 'High' : priority >= 4 ? 'Medium' : 'Low'}
                </span>
              </div>
              <Slider
                id='priority'
                min={1}
                max={10}
                step={1}
                value={[priority]}
                onValueChange={([value]) => setPriority(value)}
                className='w-full'
              />
              <div className='flex justify-between text-xs text-muted-foreground'>
                <span>Low</span>
                <span>Medium</span>
                <span>High</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleAddToQueue}
            disabled={!selectedQueueId || enqueueTask.isPending || !queues || queues.length === 0}
          >
            {enqueueTask.isPending ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Adding...
              </>
            ) : (
              <>
                <ListPlus className='mr-2 h-4 w-4' />
                Add to Queue
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
