import { Card, CardContent, CardHeader, CardTitle } from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { Progress } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { cn } from '@/lib/utils'
import { QueueWithStats } from '@promptliano/schemas'
import { Play, Pause, Trash2, Users, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface QueueStatsCardProps {
  queueWithStats: QueueWithStats
  onPause: () => void
  onResume: () => void
  onDelete: () => void
  onViewDetails: () => void
  isSelected?: boolean
  onSelect?: () => void
}

export function QueueStatsCard({
  queueWithStats,
  onPause,
  onResume,
  onDelete,
  onViewDetails,
  isSelected,
  onSelect
}: QueueStatsCardProps) {
  const { queue, stats } = queueWithStats
  const isActive = queue.status === 'active'

  const totalProcessed = stats.completedItems + stats.failedItems + stats.cancelledItems
  const progressPercentage = stats.totalItems > 0 ? (totalProcessed / stats.totalItems) * 100 : 0

  const avgProcessingTimeDisplay = stats.averageProcessingTime
    ? `${Math.round(stats.averageProcessingTime / 1000)}s avg`
    : 'N/A'

  return (
    <Card
      className={cn('relative overflow-hidden cursor-pointer transition-colors', isSelected && 'ring-2 ring-primary')}
      onClick={onSelect}
    >
      <CardHeader className='pb-2'>
        <div className='flex items-start justify-between'>
          <div className='flex items-center gap-2'>
            <CardTitle className='text-lg'>{queue.name}</CardTitle>
            <Badge variant={isActive ? 'default' : 'secondary'}>{isActive ? 'Active' : 'Paused'}</Badge>
          </div>
          <div className='flex items-center gap-1'>
            <Button
              variant='ghost'
              size='icon'
              onClick={(e) => {
                e.stopPropagation()
                isActive ? onPause() : onResume()
              }}
              title={isActive ? 'Pause queue' : 'Resume queue'}
            >
              {isActive ? <Pause className='h-4 w-4' /> : <Play className='h-4 w-4' />}
            </Button>
            <Button
              variant='ghost'
              size='icon'
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              title='Delete queue'
            >
              <Trash2 className='h-4 w-4' />
            </Button>
          </div>
        </div>
        {queue.description && <p className='text-sm text-muted-foreground mt-1'>{queue.description}</p>}
      </CardHeader>

      <CardContent>
        <div className='space-y-4'>
          {/* Progress bar */}
          <div className='space-y-2'>
            <div className='flex justify-between text-sm'>
              <span className='text-muted-foreground'>Progress</span>
              <span className='font-medium'>{Math.round(progressPercentage)}%</span>
            </div>
            <Progress value={progressPercentage} className='h-2' />
          </div>

          {/* Stats grid */}
          <div className='grid grid-cols-2 gap-4'>
            <div className='space-y-1'>
              <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                <AlertCircle className='h-3 w-3' />
                <span>Queued</span>
              </div>
              <p className='text-2xl font-semibold'>{stats.queuedItems}</p>
            </div>

            <div className='space-y-1'>
              <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                <Clock className='h-3 w-3' />
                <span>In Progress</span>
              </div>
              <p className='text-2xl font-semibold'>{stats.inProgressItems}</p>
            </div>

            <div className='space-y-1'>
              <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                <CheckCircle2 className='h-3 w-3 text-green-500' />
                <span>Completed</span>
              </div>
              <p className='text-2xl font-semibold text-green-600'>{stats.completedItems}</p>
            </div>

            <div className='space-y-1'>
              <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                <XCircle className='h-3 w-3 text-red-500' />
                <span>Failed</span>
              </div>
              <p className='text-2xl font-semibold text-red-600'>{stats.failedItems}</p>
            </div>
          </div>

          {/* Active agents and processing time */}
          <div className='pt-2 border-t space-y-2'>
            <div className='flex items-center justify-between text-sm'>
              <div className='flex items-center gap-2 text-muted-foreground'>
                <Users className='h-3 w-3' />
                <span>Active Agents</span>
              </div>
              <div className='font-medium'>
                {stats.currentAgents.length > 0 ? (
                  <span className='text-xs'>{stats.currentAgents.join(', ')}</span>
                ) : (
                  <span className='text-muted-foreground'>None</span>
                )}
              </div>
            </div>

            <div className='flex items-center justify-between text-sm'>
              <div className='flex items-center gap-2 text-muted-foreground'>
                <Clock className='h-3 w-3' />
                <span>Processing Time</span>
              </div>
              <span className='font-medium'>{avgProcessingTimeDisplay}</span>
            </div>
          </div>

          {/* View details button */}
          <Button
            variant='outline'
            className='w-full'
            onClick={(e) => {
              e.stopPropagation()
              onViewDetails()
            }}
          >
            View Queue Details
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
