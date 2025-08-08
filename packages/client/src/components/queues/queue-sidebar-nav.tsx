import React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { ScrollArea } from '@promptliano/ui'
import { Skeleton } from '@promptliano/ui'
import { Plus, ListOrdered, TrendingUp, Clock, LayoutGrid, Pause, Play, AlertCircle } from 'lucide-react'
import { useGetQueuesWithStats } from '@/hooks/api/use-queue-api'
import { type QueueView } from '@/lib/search-schemas'

interface QueueSidebarNavProps {
  projectId: number
  activeView: QueueView
  selectedQueueId?: number
  onViewChange: (view: QueueView) => void
  onQueueSelect: (queueId: number | undefined) => void
  onCreateQueue: () => void
  className?: string
}

interface NavItem {
  id: QueueView
  label: string
  icon: React.ElementType
  description: string
}

const navItems: NavItem[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: LayoutGrid,
    description: 'All queues summary'
  },
  {
    id: 'items',
    label: 'Queue Items',
    icon: ListOrdered,
    description: 'Detailed queue items'
  },
  {
    id: 'timeline',
    label: 'Timeline',
    icon: Clock,
    description: 'Processing timeline'
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: TrendingUp,
    description: 'Performance metrics'
  }
]

export function QueueSidebarNav({
  projectId,
  activeView,
  selectedQueueId,
  onViewChange,
  onQueueSelect,
  onCreateQueue,
  className
}: QueueSidebarNavProps) {
  const { data: queuesWithStats, isLoading } = useGetQueuesWithStats(projectId)

  // Calculate summary stats
  const totalQueued = queuesWithStats?.reduce((sum, q) => sum + q.stats.queuedItems, 0) || 0
  const totalInProgress = queuesWithStats?.reduce((sum, q) => sum + q.stats.inProgressItems, 0) || 0
  const activeQueues = queuesWithStats?.filter((q) => q.queue.status === 'active').length || 0

  return (
    <div className={cn('flex flex-col h-full bg-muted/30', className)}>
      {/* Header */}
      <div className='p-4 border-b'>
        <div className='flex items-center justify-between mb-3'>
          <h3 className='font-semibold'>Queue Management</h3>
          <Button size='sm' variant='ghost' onClick={onCreateQueue} className='h-7 px-2'>
            <Plus className='h-3.5 w-3.5' />
          </Button>
        </div>

        {/* Quick Stats */}
        <div className='space-y-1 text-xs text-muted-foreground'>
          <div className='flex justify-between'>
            <span>Active Queues</span>
            <span className='font-medium text-foreground'>{activeQueues}</span>
          </div>
          <div className='flex justify-between'>
            <span>Total Queued</span>
            <span className='font-medium text-foreground'>{totalQueued}</span>
          </div>
          <div className='flex justify-between'>
            <span>In Progress</span>
            <span className='font-medium text-foreground'>{totalInProgress}</span>
          </div>
        </div>
      </div>

      {/* Navigation Items */}
      <div className='p-2 border-b'>
        <div className='space-y-1'>
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Button
                key={item.id}
                variant={activeView === item.id ? 'secondary' : 'ghost'}
                className='w-full justify-start h-auto py-2 px-3'
                onClick={() => onViewChange(item.id)}
              >
                <Icon className='mr-2 h-4 w-4 flex-shrink-0' />
                <div className='flex-1 text-left'>
                  <div className='text-sm font-medium'>{item.label}</div>
                  <div className='text-xs text-muted-foreground'>{item.description}</div>
                </div>
              </Button>
            )
          })}
        </div>
      </div>

      {/* Queue List */}
      <ScrollArea className='flex-1'>
        <div className='p-2'>
          <div className='text-xs font-medium text-muted-foreground px-3 py-2'>QUEUES</div>

          {isLoading ? (
            <div className='space-y-2'>
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className='h-16 w-full' />
              ))}
            </div>
          ) : queuesWithStats && queuesWithStats.length > 0 ? (
            <div className='space-y-1'>
              {queuesWithStats.map((queueWithStats) => {
                const { queue, stats } = queueWithStats
                const isSelected = selectedQueueId === queue.id
                const isPaused = queue.status === 'paused'

                return (
                  <Button
                    key={queue.id}
                    variant={isSelected ? 'secondary' : 'ghost'}
                    className='w-full justify-start h-auto py-2 px-3'
                    onClick={() => onQueueSelect(queue.id)}
                  >
                    <div className='flex items-start gap-2 w-full'>
                      <div className='mt-0.5'>
                        {isPaused ? (
                          <Pause className='h-4 w-4 text-muted-foreground' />
                        ) : stats.inProgressItems > 0 ? (
                          <Play className='h-4 w-4 text-blue-600' />
                        ) : (
                          <AlertCircle className='h-4 w-4 text-muted-foreground' />
                        )}
                      </div>
                      <div className='flex-1 text-left'>
                        <div className='flex items-center gap-2'>
                          <span className='text-sm font-medium truncate'>{queue.name}</span>
                          {isPaused && (
                            <Badge variant='secondary' className='text-xs px-1 py-0'>
                              Paused
                            </Badge>
                          )}
                        </div>
                        <div className='flex items-center gap-3 text-xs text-muted-foreground mt-0.5'>
                          <span>{stats.queuedItems} queued</span>
                          {stats.inProgressItems > 0 && (
                            <span className='text-blue-600'>{stats.inProgressItems} active</span>
                          )}
                        </div>
                        {stats.completedItems > 0 && (
                          <div className='mt-1'>
                            <div className='h-1 bg-muted rounded-full overflow-hidden'>
                              <div
                                className='h-full bg-green-600 transition-all duration-500'
                                style={{
                                  width: `${(stats.completedItems / stats.totalItems) * 100}%`
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </Button>
                )
              })}
            </div>
          ) : (
            <div className='px-3 py-8 text-center'>
              <AlertCircle className='h-8 w-8 mx-auto text-muted-foreground mb-2' />
              <p className='text-sm text-muted-foreground'>No queues yet</p>
              <Button size='sm' variant='link' onClick={onCreateQueue} className='mt-1'>
                Create your first queue
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
