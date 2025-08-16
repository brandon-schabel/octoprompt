import { useState } from 'react'
import { Button } from '@promptliano/ui'
import { Input } from '@promptliano/ui'
import { Textarea } from '@promptliano/ui'
import { Label } from '@promptliano/ui'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@promptliano/ui'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@promptliano/ui'
import { Skeleton } from '@promptliano/ui'
import { ScrollArea } from '@promptliano/ui'
import { Plus, Loader2 } from 'lucide-react'
import { QueueStatsCard } from './queue-stats-card'
import { QueueDetailsDialog } from './queue-details-dialog'
import { useGetQueuesWithStats, useCreateQueue, useUpdateQueue, useDeleteQueue } from '@/hooks/api/use-queue-api'
import { cn } from '@/lib/utils'
import { QueueWithStats } from '@promptliano/schemas'

interface QueueManagementPanelProps {
  projectId: number
}

export function QueueManagementPanel({ projectId }: QueueManagementPanelProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [selectedQueue, setSelectedQueue] = useState<QueueWithStats | null>(null)
  const [queueToDelete, setQueueToDelete] = useState<QueueWithStats | null>(null)

  // Form state for creating queue
  const [newQueueName, setNewQueueName] = useState('')
  const [newQueueDescription, setNewQueueDescription] = useState('')
  const [maxParallelItems, setMaxParallelItems] = useState('1')

  // API hooks
  const { data: queuesWithStats, isLoading } = useGetQueuesWithStats(projectId)
  const createQueueMutation = useCreateQueue(projectId)
  const deleteQueueMutation = useDeleteQueue()

  const handleCreateQueue = async () => {
    if (!newQueueName.trim()) return

    await createQueueMutation.mutateAsync({
      name: newQueueName.trim(),
      description: newQueueDescription.trim(),
      maxParallelItems: parseInt(maxParallelItems) || 1
    })

    // Reset form
    setNewQueueName('')
    setNewQueueDescription('')
    setMaxParallelItems('1')
    setIsCreateDialogOpen(false)
  }

  const handleDeleteQueue = async (queue: QueueWithStats) => {
    await deleteQueueMutation.mutateAsync({
      queueId: queue.queue.id,
      projectId: projectId
    })
    setQueueToDelete(null)
  }

  const handlePauseQueue = async (queue: QueueWithStats) => {
    const updateMutation = useUpdateQueue(queue.queue.id)
    await updateMutation.mutateAsync({ status: 'paused' })
  }

  const handleResumeQueue = async (queue: QueueWithStats) => {
    const updateMutation = useUpdateQueue(queue.queue.id)
    await updateMutation.mutateAsync({ status: 'active' })
  }

  // Calculate summary stats
  const totalQueued = queuesWithStats?.reduce((sum, q) => sum + q.stats.queuedItems, 0) || 0
  const totalInProgress = queuesWithStats?.reduce((sum, q) => sum + q.stats.inProgressItems, 0) || 0
  const totalCompleted = queuesWithStats?.reduce((sum, q) => sum + q.stats.completedItems, 0) || 0
  const activeQueues = queuesWithStats?.filter((q) => (q.queue.status ?? 'active') === 'active').length || 0

  return (
    <div className='flex flex-col h-full'>
      {/* Header */}
      <div className='p-6 border-b'>
        <div className='flex items-center justify-between mb-4'>
          <div>
            <h2 className='text-2xl font-bold'>Task Queues</h2>
            <p className='text-muted-foreground'>Manage AI task processing queues for this project</p>
          </div>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className='mr-2 h-4 w-4' />
                Create Queue
              </Button>
            </DialogTrigger>
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
                    value={newQueueName}
                    onChange={(e) => setNewQueueName(e.target.value)}
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='queue-description'>Description (optional)</Label>
                  <Textarea
                    id='queue-description'
                    placeholder='Describe what this queue is for...'
                    value={newQueueDescription}
                    onChange={(e) => setNewQueueDescription(e.target.value)}
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
                  <p className='text-sm text-muted-foreground'>
                    Maximum number of items an agent can process simultaneously
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button variant='outline' onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateQueue} disabled={!newQueueName.trim() || createQueueMutation.isPending}>
                  {createQueueMutation.isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                  Create Queue
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary stats */}
        <div className='grid grid-cols-4 gap-4'>
          <div className='space-y-1'>
            <p className='text-sm text-muted-foreground'>Active Queues</p>
            <p className='text-2xl font-semibold'>{activeQueues}</p>
          </div>
          <div className='space-y-1'>
            <p className='text-sm text-muted-foreground'>Total Queued</p>
            <p className='text-2xl font-semibold'>{totalQueued}</p>
          </div>
          <div className='space-y-1'>
            <p className='text-sm text-muted-foreground'>In Progress</p>
            <p className='text-2xl font-semibold'>{totalInProgress}</p>
          </div>
          <div className='space-y-1'>
            <p className='text-sm text-muted-foreground'>Completed</p>
            <p className='text-2xl font-semibold'>{totalCompleted}</p>
          </div>
        </div>
      </div>

      {/* Queue list */}
      <ScrollArea className='flex-1 p-6'>
        {isLoading ? (
          <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className='h-[300px]' />
            ))}
          </div>
        ) : queuesWithStats && queuesWithStats.length > 0 ? (
          <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
            {queuesWithStats.map((queueWithStats) => (
              <QueueStatsCard
                key={queueWithStats.queue.id}
                queueWithStats={queueWithStats}
                onPause={() => handlePauseQueue(queueWithStats)}
                onResume={() => handleResumeQueue(queueWithStats)}
                onDelete={() => setQueueToDelete(queueWithStats)}
                onViewDetails={() => setSelectedQueue(queueWithStats)}
              />
            ))}
          </div>
        ) : (
          <div className='flex flex-col items-center justify-center h-[400px] text-center'>
            <div className='rounded-full bg-muted p-3 mb-4'>
              <Plus className='h-6 w-6 text-muted-foreground' />
            </div>
            <h3 className='text-lg font-semibold mb-2'>No queues yet</h3>
            <p className='text-muted-foreground mb-4 max-w-sm'>
              Create your first queue to start processing tasks automatically with AI agents
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className='mr-2 h-4 w-4' />
              Create First Queue
            </Button>
          </div>
        )}
      </ScrollArea>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!queueToDelete} onOpenChange={() => setQueueToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Queue</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the queue "{queueToDelete?.queue.name}"? This will also delete all queued
              items. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => queueToDelete && handleDeleteQueue(queueToDelete)}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              Delete Queue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Queue details dialog */}
      {selectedQueue && (
        <QueueDetailsDialog
          queue={selectedQueue}
          open={!!selectedQueue}
          onOpenChange={(open) => !open && setSelectedQueue(null)}
        />
      )}
    </div>
  )
}
