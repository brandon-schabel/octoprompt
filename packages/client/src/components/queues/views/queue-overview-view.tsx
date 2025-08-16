import { ScrollArea } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { Skeleton } from '@promptliano/ui'
import { Plus } from 'lucide-react'
import { QueueStatsCard } from '../queue-stats-card'
import { QueueDetailsDialog } from '../queue-details-dialog'
import { useGetQueuesWithStats, useUpdateQueue, useDeleteQueue } from '@/hooks/api/use-queue-api'
import { QueueWithStats } from '@promptliano/schemas'
import { useState } from 'react'
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

interface QueueOverviewViewProps {
  projectId: number
  selectedQueueId?: number
  onQueueSelect: (queueId: number | undefined) => void
  onCreateQueue: () => void
}

export function QueueOverviewView({
  projectId,
  selectedQueueId,
  onQueueSelect,
  onCreateQueue
}: QueueOverviewViewProps) {
  const [selectedQueue, setSelectedQueue] = useState<QueueWithStats | null>(null)
  const [queueToDelete, setQueueToDelete] = useState<QueueWithStats | null>(null)

  const { data: queuesWithStats, isLoading } = useGetQueuesWithStats(projectId)
  const deleteQueueMutation = useDeleteQueue()

  // Calculate summary stats
  const totalQueued = queuesWithStats?.reduce((sum, q) => sum + q.stats.queuedItems, 0) || 0
  const totalInProgress = queuesWithStats?.reduce((sum, q) => sum + q.stats.inProgressItems, 0) || 0
  const totalCompleted = queuesWithStats?.reduce((sum, q) => sum + q.stats.completedItems, 0) || 0
  const activeQueues = queuesWithStats?.filter((q) => (q.queue.status ?? 'active') === 'active').length || 0

  const handlePauseQueue = async (queue: QueueWithStats) => {
    const updateMutation = useUpdateQueue(queue.queue.id)
    await updateMutation.mutateAsync({ status: 'paused' })
  }

  const handleResumeQueue = async (queue: QueueWithStats) => {
    const updateMutation = useUpdateQueue(queue.queue.id)
    await updateMutation.mutateAsync({ status: 'active' })
  }

  const handleDeleteQueue = async (queue: QueueWithStats) => {
    await deleteQueueMutation.mutateAsync({
      queueId: queue.queue.id,
      projectId: projectId
    })
    setQueueToDelete(null)
  }

  return (
    <div className='flex flex-col h-full'>
      {/* Header */}
      <div className='p-6 border-b'>
        <div className='flex items-center justify-between mb-4'>
          <div>
            <h2 className='text-2xl font-bold'>Queue Overview</h2>
            <p className='text-muted-foreground'>Monitor and manage all task processing queues</p>
          </div>

          <Button onClick={onCreateQueue}>
            <Plus className='mr-2 h-4 w-4' />
            Create Queue
          </Button>
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

      {/* Queue grid */}
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
                isSelected={selectedQueueId === queueWithStats.queue.id}
                onSelect={() => onQueueSelect(queueWithStats.queue.id)}
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
            <Button onClick={onCreateQueue}>
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
