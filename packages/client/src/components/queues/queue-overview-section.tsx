import { Card, CardContent, CardHeader, CardTitle } from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { Progress } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { Skeleton } from '@promptliano/ui'
import { useGetQueuesWithStats } from '@/hooks/api/use-queue-api'
import { AlertCircle, Clock, CheckCircle2, PlayCircle, ListPlus, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Link } from '@tanstack/react-router'

interface QueueOverviewSectionProps {
  projectId: number
}

export function QueueOverviewSection({ projectId }: QueueOverviewSectionProps) {
  const { data: queuesWithStats, isLoading } = useGetQueuesWithStats(projectId)

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='text-lg'>Task Queues</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className='h-24' />
        </CardContent>
      </Card>
    )
  }

  if (!queuesWithStats || queuesWithStats.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='text-lg'>Task Queues</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='flex items-center justify-between'>
            <p className='text-sm text-muted-foreground'>No queues created yet</p>
            <Link to='/projects' search={{ projectId, activeView: 'queues' }}>
              <Button variant='outline' size='sm'>
                <ListPlus className='mr-2 h-4 w-4' />
                Create Queue
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Calculate totals
  const totalQueued = queuesWithStats.reduce((sum, q) => sum + q.stats.queuedItems, 0)
  const totalInProgress = queuesWithStats.reduce((sum, q) => sum + q.stats.inProgressItems, 0)
  const totalCompleted = queuesWithStats.reduce((sum, q) => sum + q.stats.completedItems, 0)
  const totalItems = queuesWithStats.reduce((sum, q) => sum + q.stats.totalItems, 0)
  const activeQueues = queuesWithStats.filter((q) => q.queue.status === 'active')

  const progressPercentage = totalItems > 0 ? (totalCompleted / totalItems) * 100 : 0

  return (
    <Card>
      <CardHeader className='pb-3'>
        <div className='flex items-center justify-between'>
          <CardTitle className='text-lg'>Task Queues</CardTitle>
          <Link to='/projects' search={{ projectId, activeView: 'queues' }}>
            <Button variant='ghost' size='sm'>
              View All
              <ArrowRight className='ml-2 h-4 w-4' />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className='space-y-4'>
          {/* Summary stats */}
          <div className='grid grid-cols-4 gap-4 text-center'>
            <div>
              <div className='text-2xl font-semibold'>{activeQueues.length}</div>
              <p className='text-xs text-muted-foreground'>Active Queues</p>
            </div>
            <div>
              <div className='text-2xl font-semibold text-orange-600'>{totalQueued}</div>
              <p className='text-xs text-muted-foreground'>Queued</p>
            </div>
            <div>
              <div className='text-2xl font-semibold text-blue-600'>{totalInProgress}</div>
              <p className='text-xs text-muted-foreground'>In Progress</p>
            </div>
            <div>
              <div className='text-2xl font-semibold text-green-600'>{totalCompleted}</div>
              <p className='text-xs text-muted-foreground'>Completed</p>
            </div>
          </div>

          {/* Overall progress */}
          {totalItems > 0 && (
            <div className='space-y-2'>
              <div className='flex justify-between text-sm'>
                <span className='text-muted-foreground'>Overall Progress</span>
                <span className='font-medium'>{Math.round(progressPercentage)}%</span>
              </div>
              <Progress value={progressPercentage} className='h-2' />
            </div>
          )}

          {/* Active queues list */}
          {activeQueues.length > 0 && (
            <div className='space-y-2 pt-2 border-t'>
              <p className='text-sm font-medium mb-2'>Active Queues:</p>
              {activeQueues.slice(0, 3).map((queueWithStats) => {
                const { queue, stats } = queueWithStats
                const pendingItems = stats.queuedItems + stats.inProgressItems

                return (
                  <div key={queue.id} className='flex items-center justify-between text-sm'>
                    <div className='flex items-center gap-2'>
                      <span className='font-medium'>{queue.name}</span>
                      {pendingItems > 0 && (
                        <Badge variant='secondary' className='text-xs'>
                          {pendingItems} pending
                        </Badge>
                      )}
                    </div>
                    <div className='flex items-center gap-4 text-muted-foreground'>
                      {stats.currentAgents.length > 0 && (
                        <span className='text-xs'>{stats.currentAgents.join(', ')}</span>
                      )}
                    </div>
                  </div>
                )
              })}
              {activeQueues.length > 3 && (
                <p className='text-xs text-muted-foreground'>and {activeQueues.length - 3} more...</p>
              )}
            </div>
          )}

          {/* Call to action for AI agents */}
          {totalQueued > 0 && (
            <div
              className={cn(
                'p-3 rounded-lg text-sm',
                'bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800'
              )}
            >
              <div className='flex items-start gap-2'>
                <PlayCircle className='h-4 w-4 text-orange-600 mt-0.5' />
                <div>
                  <p className='font-medium text-orange-900 dark:text-orange-200'>
                    {totalQueued} tasks ready for processing
                  </p>
                  <p className='text-xs text-orange-700 dark:text-orange-300 mt-0.5'>
                    Use the queue_processor MCP tool to start processing tasks
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
