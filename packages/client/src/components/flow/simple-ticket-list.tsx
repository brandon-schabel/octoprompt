import React from 'react'
import { TicketWithTasks } from '@promptliano/schemas'
import { Badge } from '@promptliano/ui'
import { ScrollArea } from '@promptliano/ui'
import { cn } from '@/lib/utils'
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { QueueBadge } from '@/components/queues/queue-badge'

interface SimpleTicketListProps {
  tickets: TicketWithTasks[]
  selectedTicket: TicketWithTasks | null
  onSelectTicket: (ticket: TicketWithTasks) => void
  loading?: boolean
  projectId?: number
}

const STATUS_COLORS = {
  open: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  in_progress: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
  closed: 'bg-green-500/10 text-green-700 dark:text-green-400'
} as const

const PRIORITY_COLORS = {
  low: 'bg-gray-500/10 text-gray-700 dark:text-gray-400',
  normal: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  high: 'bg-red-500/10 text-red-700 dark:text-red-400'
} as const

const STATUS_ICONS = {
  open: AlertCircle,
  in_progress: Clock,
  closed: CheckCircle2
} as const

export function SimpleTicketList({
  tickets,
  selectedTicket,
  onSelectTicket,
  loading,
  projectId
}: SimpleTicketListProps) {
  if (loading) {
    return (
      <div className='flex items-center justify-center h-full p-8'>
        <p className='text-muted-foreground'>Loading tickets...</p>
      </div>
    )
  }

  if (!tickets || tickets.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center h-full p-8 text-center'>
        <div className='text-4xl mb-4'>📋</div>
        <h3 className='text-lg font-semibold mb-2'>No tickets yet</h3>
        <p className='text-sm text-muted-foreground'>Create your first ticket to get started</p>
      </div>
    )
  }

  return (
    <ScrollArea className='h-full'>
      <div className='p-2'>
        {tickets.map((ticketWithTasks) => {
          const ticket = ticketWithTasks.ticket
          const tasks = ticketWithTasks.tasks || []
          const completedTasks = tasks.filter((t) => t.done).length
          const totalTasks = tasks.length
          const StatusIcon = STATUS_ICONS[ticket.status || 'open'] || AlertCircle
          const isSelected = selectedTicket?.ticket.id === ticket.id

          return (
            <div
              key={ticket.id}
              onClick={() => onSelectTicket(ticketWithTasks)}
              className={cn(
                'p-3 mb-2 rounded-lg cursor-pointer transition-all',
                'hover:bg-accent/50',
                isSelected && 'bg-accent border-l-4 border-primary'
              )}
            >
              <div className='flex items-start justify-between mb-2'>
                <h4 className='font-medium text-sm line-clamp-2 flex-1'>{ticket.title}</h4>
                <StatusIcon className='h-4 w-4 text-muted-foreground ml-2 flex-shrink-0' />
              </div>

              {ticket.overview && <p className='text-xs text-muted-foreground line-clamp-2 mb-2'>{ticket.overview}</p>}

              <div className='flex items-center gap-2 flex-wrap'>
                {ticket.queueId && <QueueBadge item={ticket} projectId={projectId} size='sm' clickable={false} />}
                <Badge variant='secondary' className={cn('text-xs', STATUS_COLORS[ticket.status || 'open'])}>
                  {(ticket.status || 'open').replace('_', ' ')}
                </Badge>

                {ticket.priority && ticket.priority !== 'normal' && (
                  <Badge variant='secondary' className={cn('text-xs', PRIORITY_COLORS[ticket.priority])}>
                    {ticket.priority}
                  </Badge>
                )}

                {totalTasks > 0 && (
                  <div className='flex items-center gap-1 text-xs text-muted-foreground'>
                    <CheckCircle2 className='h-3 w-3' />
                    <span>
                      {completedTasks}/{totalTasks}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}
