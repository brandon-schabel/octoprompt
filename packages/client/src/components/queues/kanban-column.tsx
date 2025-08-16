import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { cn } from '@/lib/utils'
import { Badge } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { ScrollArea } from '@promptliano/ui'
import { Pause, Play, Clock, AlertCircle, Plus } from 'lucide-react'
import { KanbanCard } from './kanban-card'
import { QueueWithStats } from '@promptliano/schemas'

interface KanbanItem {
  id: string
  title: string
  type: 'ticket' | 'task'
  priority?: string
  estimatedHours?: number
  ticketTitle?: string
  ticketId?: number // For tasks to group by parent ticket
  taskCount?: number // For tickets - total number of tasks
  completedTaskCount?: number // For tickets - number of completed tasks
  actualId?: number // The actual database ID for the ticket or task
}

interface KanbanColumnProps {
  queue?: QueueWithStats
  items: KanbanItem[]
  isUnqueued?: boolean
  onAddToQueue?: () => void
  onPauseQueue?: () => void
  onResumeQueue?: () => void
  onItemCompleted?: () => void
  onOpenTicket?: (ticketId: number) => void
}

export function KanbanColumn({
  queue,
  items,
  isUnqueued = false,
  onAddToQueue,
  onPauseQueue,
  onResumeQueue,
  onItemCompleted,
  onOpenTicket
}: KanbanColumnProps) {
  const id = queue?.queue.id.toString() || 'unqueued'
  const { setNodeRef, isOver } = useDroppable({ id })

  const title = isUnqueued ? 'Unqueued Items' : queue?.queue.name || 'Queue'
  const isActive = (queue?.queue.status ?? 'active') === 'active'
  const stats = queue?.stats

  // Calculate estimated time
  const estimatedTime =
    stats?.inProgressItems && stats?.averageProcessingTime
      ? Math.round((stats.queuedItems * (stats.averageProcessingTime / 1000)) / 60) // minutes
      : null

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col bg-muted/30 rounded-lg h-[600px] transition-all duration-200 overflow-hidden border border-border/50',
        isOver && 'bg-muted/50 ring-2 ring-primary/50 border-primary/30 scale-[1.01]'
      )}
    >
      {/* Column Header */}
      <div className='p-3 border-b bg-muted/20'>
        <div className='flex items-center justify-between mb-2'>
          <h3 className='font-semibold text-base'>{title}</h3>
          {!isUnqueued && queue && (
            <div className='flex items-center gap-1'>
              {isActive ? (
                <Button
                  size='icon'
                  variant='ghost'
                  className='h-7 w-7 hover:bg-muted'
                  onClick={onPauseQueue}
                  title='Pause queue'
                >
                  <Pause className='h-3.5 w-3.5' />
                </Button>
              ) : (
                <Button
                  size='icon'
                  variant='ghost'
                  className='h-7 w-7 hover:bg-muted'
                  onClick={onResumeQueue}
                  title='Resume queue'
                >
                  <Play className='h-3.5 w-3.5' />
                </Button>
              )}
            </div>
          )}
        </div>

        <div className='flex items-center gap-2 text-sm'>
          {isUnqueued ? (
            <Badge variant='outline'>{items.length} items</Badge>
          ) : (
            stats && (
              <>
                <Badge variant={isActive ? 'default' : 'secondary'} className='text-xs'>
                  {isActive ? 'Active' : 'Paused'}
                </Badge>
                <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                  <span>{stats.queuedItems} queued</span>
                  {stats.inProgressItems > 0 && (
                    <span className='text-primary'>{stats.inProgressItems} in progress</span>
                  )}
                </div>
              </>
            )
          )}
        </div>

        {!isUnqueued && estimatedTime && (
          <div className='flex items-center gap-1 mt-2 text-xs text-muted-foreground'>
            <Clock className='h-3 w-3' />
            <span>~{estimatedTime} min remaining</span>
          </div>
        )}
      </div>

      {/* Column Content */}
      <div className='flex-1 overflow-hidden'>
        <ScrollArea className='h-full'>
          <div className='p-3'>
            <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
              <div className='space-y-3'>
                {(() => {
                  // Group items by tickets and their tasks
                  const tickets = items.filter((item) => item.type === 'ticket')
                  const tasks = items.filter((item) => item.type === 'task')

                  // Create a map of tasks by their parent ticket ID
                  const tasksByTicketId = tasks.reduce(
                    (acc, task) => {
                      const ticketId = task.ticketId || 0
                      if (!acc[ticketId]) acc[ticketId] = []
                      acc[ticketId].push(task)
                      return acc
                    },
                    {} as Record<number, KanbanItem[]>
                  )

                  // Render tickets with their tasks grouped beneath
                  const renderedItems: React.ReactNode[] = []
                  const renderedTaskIds = new Set<string>()

                  // First, render all tickets with their associated tasks
                  tickets.forEach((ticket) => {
                    const ticketIdNum = parseInt(ticket.id.replace('ticket-', ''))
                    const ticketTasks = tasksByTicketId[ticketIdNum] || []

                    // Track which tasks we've rendered
                    ticketTasks.forEach((task) => renderedTaskIds.add(task.id))

                    renderedItems.push(
                      <div key={ticket.id} className='space-y-2'>
                        <KanbanCard
                          id={ticket.id}
                          title={ticket.title}
                          type={ticket.type}
                          priority={ticket.priority}
                          estimatedHours={ticket.estimatedHours}
                          taskCount={ticket.taskCount}
                          completedTaskCount={ticket.completedTaskCount}
                          actualId={ticket.actualId}
                          onComplete={onItemCompleted}
                          onOpenTicket={onOpenTicket}
                        />
                        {ticketTasks.length > 0 && (
                          <div className='space-y-1.5 ml-2'>
                            {ticketTasks.map((task) => (
                              <KanbanCard
                                key={task.id}
                                id={task.id}
                                title={task.title}
                                type={task.type}
                                estimatedHours={task.estimatedHours}
                                isNested={true}
                                actualId={task.actualId}
                                ticketId={task.ticketId}
                                onComplete={onItemCompleted}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })

                  // Then, render any orphaned tasks (tasks without a parent ticket in this column)
                  const orphanedTasks = tasks.filter((task) => !renderedTaskIds.has(task.id))

                  if (orphanedTasks.length > 0) {
                    renderedItems.push(
                      <div key='orphaned-tasks' className='space-y-2 pt-2 border-t border-border/50'>
                        <p className='text-xs text-muted-foreground px-1'>Standalone Tasks</p>
                        {orphanedTasks.map((task) => (
                          <KanbanCard
                            key={task.id}
                            id={task.id}
                            title={task.title}
                            type={task.type}
                            estimatedHours={task.estimatedHours}
                            ticketTitle={task.ticketTitle}
                            actualId={task.actualId}
                            ticketId={task.ticketId}
                            onComplete={onItemCompleted}
                          />
                        ))}
                      </div>
                    )
                  }

                  return renderedItems
                })()}
              </div>
            </SortableContext>

            {items.length === 0 && (
              <div className='flex flex-col items-center justify-center py-12 text-center px-4'>
                <div className='p-3 rounded-full bg-muted/50 mb-3'>
                  <AlertCircle className='h-6 w-6 text-muted-foreground' />
                </div>
                <p className='text-sm font-medium text-muted-foreground mb-1'>
                  {isUnqueued ? 'All items are queued' : 'Queue is empty'}
                </p>
                <p className='text-xs text-muted-foreground/70'>
                  {isUnqueued ? 'Create new tickets or move items from queues' : 'Drag items here to add them'}
                </p>
                {isUnqueued && onAddToQueue && (
                  <Button size='sm' variant='outline' className='mt-4' onClick={onAddToQueue}>
                    <Plus className='h-3 w-3 mr-1' />
                    Create Ticket
                  </Button>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
