import { useMemo } from 'react'
import { ScrollArea } from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { Skeleton } from '@promptliano/ui'
import { Alert, AlertDescription } from '@promptliano/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@promptliano/ui'
import { useGetQueuesWithStats, useGetQueueItems } from '@/hooks/api/use-queue-api'
import { useGetTicketsWithTasks } from '@/hooks/api/use-tickets-api'
import { format, addMinutes } from 'date-fns'
import { Clock, AlertCircle, CheckCircle2, XCircle, Play, Pause, ListTodo, FileText, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ensureArray, safeFormatDate } from '@/utils/queue-item-utils'
import { QueueItem, QueueItemStatus } from '@promptliano/schemas'

interface QueueTimelineViewProps {
  projectId: number
  selectedQueueId?: number
}

interface TimelineItem {
  item: QueueItem
  startTime: Date
  endTime: Date
  duration: number
  taskTitle?: string
  ticketTitle?: string
}

export function QueueTimelineView({ projectId, selectedQueueId }: QueueTimelineViewProps) {
  const { data: queuesWithStats } = useGetQueuesWithStats(projectId)
  const { data: items, isLoading } = useGetQueueItems(selectedQueueId || 0)
  const { data: ticketsWithTasks } = useGetTicketsWithTasks(projectId)

  // Find selected queue
  const selectedQueue = queuesWithStats?.find((q) => q.queue.id === selectedQueueId)
  const avgProcessingTime = selectedQueue?.stats.averageProcessingTime || 300000 // Default 5 minutes

  // Calculate timeline items
  const timelineItems = useMemo(() => {
    if (!items) return []

    const now = new Date()
    let currentTime = now
    const timeline: TimelineItem[] = []

    // Process in-progress items first
    const safeItems = ensureArray<QueueItem>(items)
    const inProgressItems = safeItems.filter((i) => i.status === 'in_progress')
    const queuedItems = safeItems.filter((i) => i.status === 'queued')
    const completedItems = safeItems.filter(
      (i) => i.status === 'completed' || i.status === 'failed' || i.status === 'cancelled'
    )

    // Add in-progress items
    inProgressItems.forEach((item) => {
      const startTime = item.startedAt ? new Date(item.startedAt * 1000) : now
      const estimatedDuration = avgProcessingTime / 1000 / 60 // Convert to minutes
      const endTime = addMinutes(startTime, estimatedDuration)

      const details = getTaskDetails(item)
      timeline.push({
        item,
        startTime,
        endTime,
        duration: estimatedDuration,
        taskTitle: details?.task.content,
        ticketTitle: details?.ticket.title
      })

      currentTime = endTime
    })

    // Add queued items
    queuedItems.forEach((item) => {
      const estimatedDuration = avgProcessingTime / 1000 / 60
      const startTime = new Date(currentTime)
      const endTime = addMinutes(startTime, estimatedDuration)

      const details = getTaskDetails(item)
      timeline.push({
        item,
        startTime,
        endTime,
        duration: estimatedDuration,
        taskTitle: details?.task.content,
        ticketTitle: details?.ticket.title
      })

      currentTime = endTime
    })

    // Add completed items at the beginning
    completedItems.reverse().forEach((item) => {
      if (item.startedAt && item.completedAt) {
        const startTime = new Date(item.startedAt * 1000)
        const endTime = new Date(item.completedAt * 1000)
        const duration = (endTime.getTime() - startTime.getTime()) / 1000 / 60

        const details = getTaskDetails(item)
        timeline.unshift({
          item,
          startTime,
          endTime,
          duration,
          taskTitle: details?.task.content,
          ticketTitle: details?.ticket.title
        })
      }
    })

    return timeline
  }, [items, avgProcessingTime, ticketsWithTasks])

  // Get task details
  const getTaskDetails = (item: QueueItem) => {
    if (!item.ticketId || !item.taskId || !ticketsWithTasks) return null

    const ticket = ticketsWithTasks.find((t) => t.ticket.id === item.ticketId)
    if (!ticket) return null

    const task = ticket.tasks.find((t) => t.id === item.taskId)
    return task ? { ticket: ticket.ticket, task } : null
  }

  const statusConfig = {
    queued: { icon: Clock, color: 'text-blue-600', bgColor: 'bg-blue-100' },
    in_progress: { icon: Play, color: 'text-green-600', bgColor: 'bg-green-100' },
    completed: { icon: CheckCircle2, color: 'text-green-600', bgColor: 'bg-green-100' },
    failed: { icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-100' },
    cancelled: { icon: XCircle, color: 'text-gray-600', bgColor: 'bg-gray-100' }
  }

  // Calculate estimated completion time
  const estimatedCompletion = timelineItems.length > 0 ? timelineItems[timelineItems.length - 1].endTime : null

  const totalQueuedTime = timelineItems
    .filter((t) => t.item.status === 'queued')
    .reduce((sum, t) => sum + t.duration, 0)

  return (
    <div className='flex flex-col h-full'>
      {/* Header */}
      <div className='p-6 border-b'>
        <div className='flex items-center justify-between mb-4'>
          <div>
            <h2 className='text-2xl font-bold'>Processing Timeline</h2>
            <p className='text-muted-foreground'>Visual timeline of queue processing</p>
          </div>

          {/* Queue selector */}
          <Select
            value={selectedQueueId?.toString() || ''}
            onValueChange={(value) => (window.location.search = `?selectedQueueId=${value}`)}
          >
            <SelectTrigger className='w-[200px]'>
              <SelectValue placeholder='Select a queue' />
            </SelectTrigger>
            <SelectContent>
              {queuesWithStats?.map((q) => (
                <SelectItem key={q.queue.id} value={q.queue.id.toString()}>
                  {q.queue.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Summary stats */}
        {selectedQueue && (
          <div className='grid grid-cols-3 gap-4'>
            <div className='space-y-1'>
              <p className='text-sm text-muted-foreground'>Queue Status</p>
              <div className='flex items-center gap-2'>
                {selectedQueue.queue.status === 'active' ? (
                  <Play className='h-4 w-4 text-green-600' />
                ) : (
                  <Pause className='h-4 w-4 text-muted-foreground' />
                )}
                <p className='font-semibold capitalize'>{selectedQueue.queue.status}</p>
              </div>
            </div>
            <div className='space-y-1'>
              <p className='text-sm text-muted-foreground'>Estimated Completion</p>
              <p className='font-semibold'>
                {estimatedCompletion ? format(estimatedCompletion, 'MMM d, h:mm a') : 'N/A'}
              </p>
            </div>
            <div className='space-y-1'>
              <p className='text-sm text-muted-foreground'>Total Queue Time</p>
              <p className='font-semibold'>
                {totalQueuedTime > 60
                  ? `${Math.round(totalQueuedTime / 60)} hours`
                  : `${Math.round(totalQueuedTime)} minutes`}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Timeline */}
      <ScrollArea className='flex-1 p-6'>
        {!selectedQueueId ? (
          <div className='flex flex-col items-center justify-center h-full text-center'>
            <AlertCircle className='h-12 w-12 text-muted-foreground mb-4' />
            <h3 className='text-lg font-semibold mb-2'>No Queue Selected</h3>
            <p className='text-muted-foreground max-w-sm'>
              Select a queue from the dropdown above to view its processing timeline
            </p>
          </div>
        ) : isLoading ? (
          <div className='space-y-4'>
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className='h-24' />
            ))}
          </div>
        ) : timelineItems.length === 0 ? (
          <div className='flex flex-col items-center justify-center h-full text-center'>
            <Clock className='h-12 w-12 text-muted-foreground mb-4' />
            <h3 className='text-lg font-semibold mb-2'>No Timeline Data</h3>
            <p className='text-muted-foreground max-w-sm'>This queue has no items to display in the timeline</p>
          </div>
        ) : (
          <div className='relative'>
            {/* Current time indicator */}
            <div
              className='absolute left-0 right-0 top-0 h-px bg-primary z-10'
              style={{
                top: `${getTimelinePosition(new Date(), timelineItems)}%`
              }}
            >
              <div className='absolute -left-2 -top-2 w-4 h-4 bg-primary rounded-full' />
              <div className='absolute left-6 -top-3 text-xs font-medium text-primary'>Now</div>
            </div>

            {/* Timeline items */}
            <div className='space-y-2'>
              {timelineItems.map((timeline, idx) => {
                const config = statusConfig[timeline.item.status]
                const Icon = config.icon

                return (
                  <div
                    key={timeline.item.id}
                    className={cn(
                      'relative pl-10 pr-4 py-4 rounded-lg border transition-colors',
                      timeline.item.status === 'in_progress' && 'border-green-500 bg-green-50',
                      timeline.item.status === 'queued' && 'border-blue-500 bg-blue-50',
                      timeline.item.status === 'completed' && 'opacity-75'
                    )}
                  >
                    {/* Status icon */}
                    <div className={cn('absolute left-3 top-4 p-2 rounded-full', config.bgColor)}>
                      <Icon className={cn('h-4 w-4', config.color)} />
                    </div>

                    {/* Content */}
                    <div className='ml-8'>
                      <div className='flex items-start justify-between mb-2'>
                        <div>
                          <div className='flex items-center gap-2 mb-1'>
                            {timeline.ticketTitle && (
                              <>
                                <ListTodo className='h-3 w-3 text-muted-foreground' />
                                <span className='text-sm font-medium'>{timeline.ticketTitle}</span>
                              </>
                            )}
                          </div>
                          {timeline.taskTitle && (
                            <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                              <FileText className='h-3 w-3' />
                              <span>{timeline.taskTitle}</span>
                            </div>
                          )}
                        </div>

                        <div className='text-right'>
                          <Badge variant='outline' className='text-xs'>
                            Priority {timeline.item.priority}
                          </Badge>
                          {timeline.item.agentId && (
                            <div className='flex items-center gap-1 mt-1 text-xs text-muted-foreground'>
                              <Bot className='h-3 w-3' />
                              <span>{timeline.item.agentId}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Time information */}
                      <div className='flex items-center gap-4 text-xs text-muted-foreground'>
                        <span>{format(timeline.startTime, 'h:mm a')}</span>
                        <span>→</span>
                        <span>{format(timeline.endTime, 'h:mm a')}</span>
                        <span className='text-foreground font-medium'>{Math.round(timeline.duration)} min</span>
                      </div>

                      {/* Error message */}
                      {timeline.item.errorMessage && (
                        <Alert className='mt-2' variant='destructive'>
                          <AlertCircle className='h-4 w-4' />
                          <AlertDescription className='text-xs'>{timeline.item.errorMessage}</AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

// Helper function to calculate position on timeline
function getTimelinePosition(time: Date, items: TimelineItem[]): number {
  if (items.length === 0) return 0

  const firstTime = items[0].startTime.getTime()
  const lastTime = items[items.length - 1].endTime.getTime()
  const currentTime = time.getTime()

  if (currentTime <= firstTime) return 0
  if (currentTime >= lastTime) return 100

  return ((currentTime - firstTime) / (lastTime - firstTime)) * 100
}
