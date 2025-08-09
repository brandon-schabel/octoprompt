import React, { useState } from 'react'
import { TicketWithTasks } from '@promptliano/schemas'
import { Badge } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@promptliano/ui'
import { Checkbox } from '@promptliano/ui'
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
import { cn } from '@/lib/utils'
import {
  CalendarDays,
  Clock,
  FileText,
  Hash,
  Link2,
  Plus,
  Edit,
  ListOrdered,
  ArrowRight,
  Copy,
  CheckCircle2
} from 'lucide-react'
import { useUpdateTask, useCompleteTicket } from '@/hooks/api/use-tickets-api'
import { useGetQueue } from '@/hooks/api/use-queue-api'
import { useCopyClipboard } from '@/hooks/utility-hooks/use-copy-clipboard'
import { toast } from 'sonner'
import { TicketDialog } from './ticket-dialog'
import { formatDistanceToNow } from 'date-fns'
import { useNavigate } from '@tanstack/react-router'

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
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false)
  const updateTask = useUpdateTask()
  const completeTicket = useCompleteTicket()
  const navigate = useNavigate()
  const { copyToClipboard } = useCopyClipboard()

  // Fetch queue information if ticket is in a queue
  const { data: queueData } = useGetQueue(ticket?.ticket.queueId || 0)

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

  const generateMarkdown = () => {
    if (!ticket) return ''

    let markdown = `# ${ticket.ticket.title}\n\n`

    // Add overview if exists
    if (ticket.ticket.overview) {
      markdown += `## Overview\n\n${ticket.ticket.overview}\n\n`
    }

    // Add tasks
    if (ticket.tasks.length > 0) {
      markdown += `## Tasks\n\n`
      ticket.tasks.forEach((task) => {
        // Add checkbox - checked if done, unchecked if not
        markdown += `- [${task.done ? 'x' : ' '}] ${task.content}\n`
        // Add description if exists (indented)
        if (task.description) {
          markdown += `  ${task.description}\n`
        }
      })
    }

    return markdown
  }

  const handleCopyAsMarkdown = () => {
    const markdown = generateMarkdown()
    copyToClipboard(markdown, {
      successMessage: 'Ticket copied as Markdown',
      errorMessage: 'Failed to copy ticket'
    })
  }

  const handleCompleteTicket = async () => {
    if (!ticket) return

    try {
      await completeTicket.mutateAsync(ticket.ticket.id)
      toast.success('Ticket completed successfully')
      setIsCompleteDialogOpen(false)
      onTicketUpdate?.()
    } catch (error) {
      toast.error('Failed to complete ticket')
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
          <div className='flex gap-2'>
            <Button variant='outline' onClick={handleCopyAsMarkdown}>
              <Copy className='h-4 w-4 mr-2' />
              Copy as Markdown
            </Button>
            {ticket.ticket.status !== 'closed' && (
              <Button
                variant='outline'
                onClick={() => setIsCompleteDialogOpen(true)}
                disabled={completeTicket.isPending}
              >
                <CheckCircle2 className='h-4 w-4 mr-2' />
                Complete Ticket
              </Button>
            )}
            <Button onClick={() => setIsEditDialogOpen(true)}>
              <Edit className='h-4 w-4 mr-2' />
              Edit Ticket
            </Button>
          </div>
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

        {/* Queue Information */}
        {ticket.ticket.queueId && queueData && (
          <Card className='border-l-4 border-l-blue-500'>
            <CardHeader className='pb-3'>
              <div className='flex items-center justify-between'>
                <CardTitle className='text-lg flex items-center gap-2'>
                  <ListOrdered className='h-5 w-5' />
                  Queue Information
                </CardTitle>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => {
                    navigate({
                      to: '/projects',
                      search: (prev: any) => ({
                        ...prev,
                        activeView: 'flow',
                        flowView: 'queues',
                        selectedQueueId: ticket.ticket.queueId
                      })
                    })
                  }}
                >
                  View Queue
                  <ArrowRight className='h-4 w-4 ml-1' />
                </Button>
              </div>
            </CardHeader>
            <CardContent className='space-y-2'>
              <div className='flex items-center justify-between text-sm'>
                <span className='text-muted-foreground'>Queue Name:</span>
                <span className='font-medium'>{queueData.name}</span>
              </div>
              {ticket.ticket.queuePosition !== null && ticket.ticket.queuePosition !== undefined && (
                <div className='flex items-center justify-between text-sm'>
                  <span className='text-muted-foreground'>Position in Queue:</span>
                  <Badge variant='secondary'>#{ticket.ticket.queuePosition}</Badge>
                </div>
              )}
              {ticket.ticket.queueStatus && (
                <div className='flex items-center justify-between text-sm'>
                  <span className='text-muted-foreground'>Queue Status:</span>
                  <Badge
                    variant={ticket.ticket.queueStatus === 'completed' ? 'default' : 'secondary'}
                    className={cn(
                      ticket.ticket.queueStatus === 'in_progress' && 'bg-yellow-500/10 text-yellow-700',
                      ticket.ticket.queueStatus === 'completed' && 'bg-green-500/10 text-green-700',
                      ticket.ticket.queueStatus === 'failed' && 'bg-red-500/10 text-red-700'
                    )}
                  >
                    {ticket.ticket.queueStatus.replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>
              )}
              {ticket.ticket.queuePriority !== null && ticket.ticket.queuePriority !== undefined && (
                <div className='flex items-center justify-between text-sm'>
                  <span className='text-muted-foreground'>Queue Priority:</span>
                  <span className='font-medium'>{ticket.ticket.queuePriority}</span>
                </div>
              )}
              {ticket.ticket.queuedAt && (
                <div className='flex items-center justify-between text-sm'>
                  <span className='text-muted-foreground'>Queued:</span>
                  <span className='text-xs'>{formatDistanceToNow(new Date(ticket.ticket.queuedAt))} ago</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

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

      <AlertDialog open={isCompleteDialogOpen} onOpenChange={setIsCompleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete Ticket</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to complete this ticket? This will:
              <ul className='mt-2 ml-4 list-disc space-y-1'>
                <li>Mark the ticket status as "Closed"</li>
                <li>Mark all {ticket?.tasks.length || 0} tasks as completed</li>
                {ticket?.ticket.queueId && <li>Remove the ticket from any active queues</li>}
              </ul>
              <div className='mt-3'>
                This action cannot be undone. You can still edit the ticket after completion if needed.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCompleteTicket} disabled={completeTicket.isPending}>
              {completeTicket.isPending ? 'Completing...' : 'Complete Ticket'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
