import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent } from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { cn } from '@/lib/utils'
import { ListTodo, FileText, Clock, AlertCircle, ChevronRight, Inbox, CheckCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useCompleteQueueItem, useDequeueTask } from '@/hooks/api/use-flow-api'
import { toast } from 'sonner'

interface KanbanCardProps {
  id: string
  title: string
  type: 'ticket' | 'task'
  priority?: string
  estimatedHours?: number
  ticketTitle?: string // For tasks
  isDragging?: boolean
  overlay?: boolean
  taskCount?: number // For tickets to show number of tasks
  completedTaskCount?: number // For tickets to show progress
  isNested?: boolean // For tasks that are nested under tickets
  queueName?: string // Queue name for display
  queuePosition?: number | null // Position in queue
  actualId?: number // The actual ticket or task ID from the database
  ticketId?: number // The parent ticket ID for tasks
  onComplete?: () => void // Optional callback after completion
  onOpenTicket?: (ticketId: number) => void
}

export function KanbanCard({
  id,
  title,
  type,
  priority,
  estimatedHours,
  ticketTitle,
  isDragging,
  overlay,
  taskCount,
  completedTaskCount,
  isNested = false,
  queueName,
  queuePosition,
  actualId,
  ticketId,
  onComplete,
  onOpenTicket
}: KanbanCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const completeQueueItemMutation = useCompleteQueueItem()
  const dequeueTaskMutation = useDequeueTask()

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.5 : 1
  }

  const handleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()

    // Prevent completion during drag or if already completing
    if (isDragging || isSortableDragging || completeQueueItemMutation.isPending) {
      return
    }

    if (!actualId) {
      toast.error('Unable to complete item: missing ID')
      return
    }

    try {
      await completeQueueItemMutation.mutateAsync({
        itemType: type,
        itemId: actualId,
        ticketId: type === 'task' ? ticketId : undefined
      })
      if (type === 'task') {
        try {
          await dequeueTaskMutation.mutateAsync(actualId)
        } catch {}
      }
      toast.success(`${type === 'ticket' ? 'Ticket' : 'Task'} completed successfully`)
      onComplete?.()
    } catch (error) {
      // Error is already handled by commonErrorHandler in the mutation
      console.error('Failed to complete item:', error)
    }
  }

  const priorityColors = {
    low: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
    normal: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    high: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800',
    urgent: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
  }

  // Ticket styling - more prominent
  if (type === 'ticket') {
    return (
      <div
        ref={setNodeRef}
        style={!overlay ? style : undefined}
        {...attributes}
        {...listeners}
        className={cn('touch-none relative group', overlay && 'opacity-100')}
        data-item-id={id}
        data-item-type={type}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onDoubleClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (!isDragging && !isSortableDragging && actualId) onOpenTicket?.(actualId)
        }}
      >
        <Card
          className={cn(
            'cursor-move hover:shadow-lg transition-all duration-200 border-2 bg-card/50 backdrop-blur-sm',
            isDragging && 'shadow-xl ring-2 ring-primary scale-105',
            overlay && 'shadow-2xl',
            priority === 'urgent' && 'border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-950/20',
            priority === 'high' && 'border-orange-300 dark:border-orange-700 bg-orange-50/50 dark:bg-orange-950/20',
            priority === 'low' && 'border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-950/20',
            (!priority || priority === 'normal') &&
              'border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/20',
            completeQueueItemMutation.isPending && 'opacity-50'
          )}
        >
          <CardContent className='p-4 relative'>
            {/* Completion button - shows on hover */}
            {isHovered && !overlay && !isDragging && (
              <Button
                size='sm'
                variant='ghost'
                className='absolute top-2 right-2 h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-background/90 hover:bg-success/20 z-10'
                onClick={handleComplete}
                disabled={completeQueueItemMutation.isPending}
                aria-label={`Mark ${type} "${title}" as complete`}
                aria-busy={completeQueueItemMutation.isPending}
                title='Mark as complete'
              >
                <CheckCircle
                  className={cn('h-4 w-4', completeQueueItemMutation.isPending ? 'animate-pulse' : 'text-success')}
                />
              </Button>
            )}

            <div className='flex items-start gap-3 mb-3'>
              <div
                className={cn(
                  'p-2 rounded-lg shadow-sm',
                  priority === 'urgent'
                    ? 'bg-red-100 dark:bg-red-900/30'
                    : priority === 'high'
                      ? 'bg-orange-100 dark:bg-orange-900/30'
                      : priority === 'low'
                        ? 'bg-green-100 dark:bg-green-900/30'
                        : 'bg-blue-100 dark:bg-blue-900/30'
                )}
              >
                <ListTodo
                  className={cn(
                    'h-5 w-5',
                    priority === 'urgent'
                      ? 'text-red-600 dark:text-red-400'
                      : priority === 'high'
                        ? 'text-orange-600 dark:text-orange-400'
                        : priority === 'low'
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-blue-600 dark:text-blue-400'
                  )}
                />
              </div>
              <div className='flex-1 min-w-0'>
                <h4 className='text-base font-semibold line-clamp-2 mb-1 text-foreground'>{title}</h4>
                {taskCount !== undefined && taskCount > 0 && (
                  <div className='flex items-center gap-2'>
                    <div className='flex items-center gap-1.5 text-xs text-muted-foreground'>
                      <FileText className='h-3 w-3' />
                      <span className='font-medium'>
                        {completedTaskCount || 0} of {taskCount} tasks complete
                      </span>
                    </div>
                    <div className='flex-1 max-w-[80px] h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden'>
                      <div
                        className='h-full bg-primary transition-all duration-300 ease-out'
                        style={{ width: `${taskCount > 0 ? ((completedTaskCount || 0) / taskCount) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className='flex items-center gap-2 flex-wrap'>
              {queueName && (
                <Badge
                  variant='outline'
                  className='text-xs gap-1 bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                >
                  <Inbox className='h-3 w-3' />
                  {queueName}
                  {queuePosition !== null && queuePosition !== undefined && (
                    <span className='opacity-75'>#{queuePosition + 1}</span>
                  )}
                </Badge>
              )}
              {priority && (
                <Badge
                  variant='secondary'
                  className={cn(
                    'text-xs font-semibold uppercase tracking-wider',
                    priority === 'urgent'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800'
                      : priority === 'high'
                        ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200 dark:border-orange-800'
                        : priority === 'low'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border-green-200 dark:border-green-800'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                  )}
                >
                  {priority}
                </Badge>
              )}
              {estimatedHours && (
                <div className='flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md'>
                  <Clock className='h-3 w-3' />
                  <span className='font-medium'>{estimatedHours}h</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Task styling - smaller and nested appearance
  return (
    <div
      ref={setNodeRef}
      style={!overlay ? style : undefined}
      {...attributes}
      {...listeners}
      className={cn('touch-none relative group', overlay && 'opacity-100')}
      data-item-id={id}
      data-item-type={type}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Card
        className={cn(
          'cursor-move hover:shadow-md transition-all duration-200 border bg-background/50',
          isDragging && 'shadow-lg ring-1 ring-primary scale-[1.02]',
          overlay && 'shadow-xl',
          isNested && 'border-l-4 border-l-primary/40 hover:border-l-primary/60',
          !isNested && 'border-muted-foreground/20',
          completeQueueItemMutation.isPending && 'opacity-50'
        )}
      >
        <CardContent className={cn('p-2.5 relative', isNested && 'pl-3')}>
          {/* Completion button for tasks - shows on hover */}
          {isHovered && !overlay && !isDragging && (
            <Button
              size='sm'
              variant='ghost'
              className='absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-background/90 hover:bg-success/20 z-10'
              onClick={handleComplete}
              disabled={completeQueueItemMutation.isPending}
              aria-label={`Mark task "${title}" as complete`}
              aria-busy={completeQueueItemMutation.isPending}
              title='Mark task as complete'
            >
              <CheckCircle
                className={cn('h-3.5 w-3.5', completeQueueItemMutation.isPending ? 'animate-pulse' : 'text-success')}
              />
            </Button>
          )}

          <div className='flex items-center gap-2'>
            <div className='flex items-center gap-1.5 shrink-0'>
              {isNested ? (
                <button
                  className='p-0.5 rounded hover:bg-muted'
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setExpanded((v) => !v)
                  }}
                  aria-label='Toggle task details'
                >
                  <ChevronRight
                    className={cn('h-3.5 w-3.5 text-primary/60 transition-transform', expanded && 'rotate-90')}
                  />
                </button>
              ) : (
                <FileText className='h-3.5 w-3.5 text-muted-foreground' />
              )}
            </div>
            <div className='flex-1 min-w-0'>
              <h4 className='text-sm line-clamp-1 font-medium'>{title}</h4>
              {!isNested && ticketTitle && (
                <p className='text-xs text-muted-foreground mt-0.5 line-clamp-1'>From: {ticketTitle}</p>
              )}
              {isNested && expanded && (
                <div className='mt-1 text-xs text-muted-foreground space-y-1'>
                  {ticketTitle && <p>From: {ticketTitle}</p>}
                  {estimatedHours && <p>Est: {estimatedHours}h</p>}
                </div>
              )}
              {queueName && (
                <div className='flex items-center gap-1 mt-0.5'>
                  <Badge variant='outline' className='text-[10px] px-1 py-0 gap-0.5 h-4'>
                    <Inbox className='h-2.5 w-2.5' />
                    {queueName}
                    {queuePosition !== null && queuePosition !== undefined && (
                      <span className='opacity-75'>#{queuePosition + 1}</span>
                    )}
                  </Badge>
                </div>
              )}
            </div>
            {estimatedHours && (
              <div className='flex items-center gap-1 text-xs text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded'>
                <Clock className='h-3 w-3' />
                <span>{estimatedHours}h</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
