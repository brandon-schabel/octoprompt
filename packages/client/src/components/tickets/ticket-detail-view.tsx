import React, { useState } from 'react'
import { TicketWithTasks } from '@promptliano/schemas'
import { Badge } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@promptliano/ui'
import { Checkbox } from '@promptliano/ui'
import { cn } from '@/lib/utils'
import { CalendarDays, Clock, FileText, Hash, Link2, Plus, Edit } from 'lucide-react'
import { useUpdateTask } from '@/hooks/api/use-tickets-api'
import { toast } from 'sonner'
import { TicketDialog } from './ticket-dialog'
import { formatDistanceToNow } from 'date-fns'

interface TicketDetailViewProps {
  ticket: TicketWithTasks | null
  projectId: number
  onTicketUpdate?: () => void
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

export function TicketDetailView({ ticket, projectId, onTicketUpdate }: TicketDetailViewProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const updateTask = useUpdateTask()

  if (!ticket) {
    return (
      <div className='flex items-center justify-center h-full text-muted-foreground'>
        Select a ticket to view details
      </div>
    )
  }

  const completedTasks = ticket.tasks.filter((task) => task.done).length
  const totalTasks = ticket.tasks.length
  const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  const handleTaskToggle = async (taskId: number, done: boolean) => {
    try {
      await updateTask.mutateAsync({
        ticketId: ticket.ticket.id,
        taskId,
        data: { done }
      })
    } catch (error) {
      toast.error('Failed to update task')
    }
  }

  return (
    <div className='h-full overflow-y-auto p-6'>
      <div className='max-w-4xl mx-auto space-y-6'>
        {/* Header */}
        <div className='flex items-start justify-between'>
          <div className='space-y-1'>
            <h1 className='text-2xl font-bold'>{ticket.ticket.title}</h1>
            <p className='text-muted-foreground'>Created {formatDistanceToNow(new Date(ticket.ticket.created))} ago</p>
          </div>
          <Button onClick={() => setIsEditDialogOpen(true)}>
            <Edit className='h-4 w-4 mr-2' />
            Edit Ticket
          </Button>
        </div>

        {/* Status and Priority */}
        <div className='flex items-center gap-3'>
          <Badge className={cn(STATUS_COLORS[ticket.ticket.status as keyof typeof STATUS_COLORS])}>
            {ticket.ticket.status?.replace('_', ' ').toUpperCase()}
          </Badge>
          <Badge className={cn(PRIORITY_COLORS[ticket.ticket.priority as keyof typeof PRIORITY_COLORS])}>
            {ticket.ticket.priority?.toUpperCase()} PRIORITY
          </Badge>
          <div className='ml-auto text-sm text-muted-foreground'>
            {completedTasks} of {totalTasks} tasks completed ({completionPercentage}%)
          </div>
        </div>

        {/* Overview */}
        {ticket.ticket.overview && (
          <Card>
            <CardHeader>
              <CardTitle className='text-lg'>Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <p className='whitespace-pre-wrap'>{ticket.ticket.overview}</p>
            </CardContent>
          </Card>
        )}

        {/* Tasks */}
        <Card>
          <CardHeader className='flex flex-row items-center justify-between'>
            <div>
              <CardTitle className='text-lg'>Tasks</CardTitle>
              <CardDescription>Track progress on individual tasks</CardDescription>
            </div>
            <Button size='sm' onClick={() => setIsEditDialogOpen(true)}>
              <Plus className='h-4 w-4 mr-1' />
              Add Task
            </Button>
          </CardHeader>
          <CardContent>
            {ticket.tasks.length === 0 ? (
              <p className='text-muted-foreground text-sm'>No tasks yet. Add tasks to track progress.</p>
            ) : (
              <div className='space-y-3'>
                {ticket.tasks.map((task) => (
                  <div
                    key={task.id}
                    className={cn('flex items-start gap-3 p-3 rounded-lg border', task.done && 'bg-muted/50')}
                  >
                    <Checkbox
                      checked={task.done}
                      onCheckedChange={(checked) => handleTaskToggle(task.id, checked as boolean)}
                      className='mt-0.5'
                    />
                    <div className='flex-1 space-y-1'>
                      <div className={cn('font-medium', task.done && 'line-through text-muted-foreground')}>
                        {task.content}
                      </div>
                      {task.description && (
                        <p className={cn('text-sm text-muted-foreground', task.done && 'line-through')}>
                          {task.description}
                        </p>
                      )}
                      <div className='flex items-center gap-4 text-xs text-muted-foreground'>
                        {task.estimatedHours && (
                          <span className='flex items-center gap-1'>
                            <Clock className='h-3 w-3' />
                            {task.estimatedHours}h estimated
                          </span>
                        )}
                        {task.tags.length > 0 && (
                          <span className='flex items-center gap-1'>
                            <Hash className='h-3 w-3' />
                            {task.tags.join(', ')}
                          </span>
                        )}
                        {task.suggestedFileIds.length > 0 && (
                          <span className='flex items-center gap-1'>
                            <FileText className='h-3 w-3' />
                            {task.suggestedFileIds.length} files
                          </span>
                        )}
                        {task.dependencies.length > 0 && (
                          <span className='flex items-center gap-1'>
                            <Link2 className='h-3 w-3' />
                            {task.dependencies.length} dependencies
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Metadata */}
        <Card>
          <CardHeader>
            <CardTitle className='text-lg'>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className='grid grid-cols-2 gap-4 text-sm'>
              <div>
                <dt className='font-medium text-muted-foreground'>Created</dt>
                <dd className='flex items-center gap-1 mt-1'>
                  <CalendarDays className='h-3 w-3' />
                  {new Date(ticket.ticket.created).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className='font-medium text-muted-foreground'>Last Updated</dt>
                <dd className='flex items-center gap-1 mt-1'>
                  <CalendarDays className='h-3 w-3' />
                  {new Date(ticket.ticket.updated).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className='font-medium text-muted-foreground'>Associated Files</dt>
                <dd className='flex items-center gap-1 mt-1'>
                  <FileText className='h-3 w-3' />
                  {ticket.ticket.suggestedFileIds.length} files
                </dd>
              </div>
              <div>
                <dt className='font-medium text-muted-foreground'>Total Estimated Time</dt>
                <dd className='flex items-center gap-1 mt-1'>
                  <Clock className='h-3 w-3' />
                  {ticket.tasks.reduce((sum, task) => sum + (task.estimatedHours || 0), 0)}h
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      <TicketDialog
        isOpen={isEditDialogOpen}
        onClose={() => {
          setIsEditDialogOpen(false)
          onTicketUpdate?.()
        }}
        ticketWithTasks={ticket}
        projectId={projectId.toString()}
      />
    </div>
  )
}
