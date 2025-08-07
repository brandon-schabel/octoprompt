import React from 'react'
import { Badge } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { cn } from '@/lib/utils'
import { useNavigate } from '@tanstack/react-router'
import { useGetQueueWithStats } from '@/hooks/api/use-queue-api'
import { Loader2, Inbox, Pause, Play, AlertCircle, Clock, CheckCircle } from 'lucide-react'
import type { Ticket, TicketTask } from '@promptliano/schemas'

interface QueueBadgeProps {
  item: Partial<Ticket> | Partial<TicketTask>
  projectId?: number
  className?: string
  size?: 'sm' | 'md' | 'lg'
  showPosition?: boolean
  clickable?: boolean
}

const statusIcons = {
  queued: Clock,
  in_progress: Loader2,
  completed: CheckCircle,
  failed: AlertCircle,
  cancelled: AlertCircle
}

const statusColors = {
  queued: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  in_progress: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  completed: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
  failed: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
  cancelled: 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-800'
}

export function QueueBadge({
  item,
  projectId,
  className,
  size = 'sm',
  showPosition = true,
  clickable = true
}: QueueBadgeProps) {
  const navigate = useNavigate()
  const queueId = item.queueId
  const queueStatus = item.queueStatus
  const queuePosition = item.queuePosition

  // Fetch queue details if we have a queueId
  const { data: queueData, isLoading } = useGetQueueWithStats(queueId || 0, { enabled: !!queueId })

  // Don't render if no queue
  if (!queueId) {
    return null
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (clickable && queueId) {
      navigate({
        to: '/queue-dashboard/$queueId',
        params: { queueId: String(queueId) },
        search: { projectId }
      })
    }
  }

  const StatusIcon = queueStatus ? statusIcons[queueStatus] : Inbox
  const colorClass = queueStatus ? statusColors[queueStatus] : statusColors.queued

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5'
  }

  const iconSizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  }

  if (isLoading) {
    return (
      <Badge variant='outline' className={cn(sizeClasses[size], 'gap-1', className)}>
        <Loader2 className={cn(iconSizeClasses[size], 'animate-spin')} />
        Loading...
      </Badge>
    )
  }

  const queueName = queueData?.queue?.name || `Queue ${queueId}`
  const isPaused = queueData?.queue?.status === 'paused'

  return (
    <Badge
      variant='outline'
      className={cn(
        sizeClasses[size],
        colorClass,
        'gap-1.5 font-medium border',
        clickable && 'cursor-pointer hover:shadow-md transition-all',
        isPaused && 'opacity-60',
        className
      )}
      onClick={clickable ? handleClick : undefined}
    >
      {queueStatus === 'in_progress' ? (
        <StatusIcon className={cn(iconSizeClasses[size], 'animate-spin')} />
      ) : (
        <StatusIcon className={iconSizeClasses[size]} />
      )}

      <span className='font-semibold'>{queueName}</span>

      {showPosition && queuePosition !== null && queuePosition !== undefined && (
        <span className='opacity-75'>#{queuePosition + 1}</span>
      )}

      {isPaused && <Pause className={cn(iconSizeClasses[size], 'opacity-60')} />}
    </Badge>
  )
}

interface AddToQueueButtonProps {
  onAddToQueue: () => void
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'outline' | 'ghost'
  className?: string
}

export function AddToQueueButton({ onAddToQueue, size = 'sm', variant = 'outline', className }: AddToQueueButtonProps) {
  const sizeMap = {
    sm: 'sm' as const,
    md: 'default' as const,
    lg: 'lg' as const
  }

  return (
    <Button variant={variant} size={sizeMap[size]} onClick={onAddToQueue} className={cn('gap-1.5', className)}>
      <Inbox className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
      Add to Queue
    </Button>
  )
}
