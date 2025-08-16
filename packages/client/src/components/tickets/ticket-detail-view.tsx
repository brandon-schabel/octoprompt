import React, { useState } from 'react'
import { TicketWithTasks, TicketTask } from '@promptliano/schemas'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@promptliano/ui'
import { Popover, PopoverContent, PopoverTrigger } from '@promptliano/ui'
import { ScrollArea } from '@promptliano/ui'
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
  CheckCircle2,
  MoreHorizontal,
  ListPlus,
  Trash2,
  Bot,
  MessageSquare
} from 'lucide-react'
import {
  useUpdateTask,
  useCompleteTicket,
  useGetTicket,
  useUpdateTicket,
  useGetTasks,
  useDeleteTicket,
  useDeleteTask,
  useAutoGenerateTasks
} from '@/hooks/api/use-tickets-api'
import { useDequeueTicket, useDequeueTask, useMoveItem, useGetFlowData } from '@/hooks/api/use-flow-api'
import { useInvalidateTickets } from '@/hooks/api/use-tickets-api'
import { useApiClient } from '@/hooks/api/use-api-client'
import { useGetQueue } from '@/hooks/api/use-queue-api'
import { useGetProject } from '@/hooks/api/use-projects-api'
import { useCopyClipboard } from '@/hooks/utility-hooks/use-copy-clipboard'
import { toast } from 'sonner'
import { TicketDialog } from './ticket-dialog'
import { AddToQueueDialog } from './add-to-queue-dialog'
import { AddTaskToQueueDialog } from './add-task-to-queue-dialog'
import { TaskEditDialog } from './task-edit-dialog'
import { AgentSelectorPopover } from './agent-selector-popover'
import { PromptSelectorPopover } from './prompt-selector-popover'
import { AgentDisplay } from './agent-display'
import { FileDisplayItem } from './file-display-item'
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
  const [isAddToQueueDialogOpen, setIsAddToQueueDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<TicketTask | null>(null)
  const [isTaskEditDialogOpen, setIsTaskEditDialogOpen] = useState(false)
  const [deletingTaskId, setDeletingTaskId] = useState<number | null>(null)
  const [isAgentDialogOpen, setIsAgentDialogOpen] = useState(false)
  const [taskToQueue, setTaskToQueue] = useState<TicketTask | null>(null)
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const completeTicket = useCompleteTicket()
  const updateTicket = useUpdateTicket()
  const deleteTicket = useDeleteTicket()
  const autoGenerateTasks = useAutoGenerateTasks()
  const navigate = useNavigate()
  const dequeueTicket = useDequeueTicket()
  const dequeueTask = useDequeueTask()
  const moveItem = useMoveItem()
  const client = useApiClient()
  const { data: flowData, refetch: refetchFlow } = useGetFlowData(projectId)
  const { data: liveTicket, refetch: refetchTicket } = useGetTicket(ticket ? ticket.ticket.id : 0)
  const { data: liveTasks, refetch: refetchTasks } = useGetTasks(ticket ? ticket.ticket.id : 0)
  const t = (liveTicket || ticket?.ticket) as NonNullable<typeof ticket>['ticket']
  const { invalidateTicketData, invalidateProjectTickets, invalidateTicketTasks } = useInvalidateTickets()

  const bumpTicketPosition = async (delta: -1 | 1) => {
    if (!client || !ticket?.ticket.queueId || !flowData) return
    const q = (flowData as any).queues[String(ticket.ticket.queueId)]
    if (!q) return
    const merged = [
      ...q.tickets.map((t: any) => ({ itemType: 'ticket' as const, itemId: t.id, pos: t.queuePosition ?? 0 })),
      ...q.tasks.map((tk: any) => ({
        itemType: 'task' as const,
        itemId: tk.id,
        ticketId: tk.ticketId,
        pos: tk.queuePosition ?? 0
      }))
    ].sort((a, b) => a.pos - b.pos)
    const index = merged.findIndex((it) => it.itemType === 'ticket' && it.itemId === ticket.ticket.id)
    if (index < 0) return
    const target = Math.max(0, Math.min(merged.length - 1, index + delta))
    if (target === index) return
    const temp = merged[index]
    merged[index] = merged[target]
    merged[target] = temp
    const res = await client.flow.reorderQueueItems({
      queueId: ticket.ticket.queueId,
      items: merged.map((it) => ({ itemType: it.itemType, itemId: it.itemId, ticketId: (it as any).ticketId }))
    })
    if ((res as any)?.success !== false) {
      await Promise.all([
        refetchFlow(),
        (async () => invalidateTicketData(ticket.ticket.id))(),
        (async () => invalidateProjectTickets(projectId))()
      ])
    }
  }

  const { copyToClipboard } = useCopyClipboard()

  // Fetch queue information if ticket is in a queue
  const { data: queueData } = useGetQueue(t.queueId || 0)

  // Fetch project data to get the project root path
  const { data: projectData } = useGetProject(projectId)

  if (!ticket) {
    return (
      <div className='flex items-center justify-center h-full text-muted-foreground'>
        Select a ticket to view details
      </div>
    )
  }

  const tasks = liveTasks || ticket.tasks
  const completedTasks = tasks.filter((task) => task.done).length
  const totalTasks = tasks.length
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

  const handleDeleteTask = async (taskId: number) => {
    if (!ticket) return

    try {
      await deleteTask.mutateAsync({ ticketId: ticket.ticket.id, taskId })
      toast.success('Task deleted successfully')
      setDeletingTaskId(null)
    } catch (error: any) {
      // Provide more specific error messages based on error type
      if (error?.message?.includes('queue')) {
        toast.error('Cannot delete task that is currently in a queue. Please unqueue first.')
      } else if (error?.message?.includes('dependencies')) {
        toast.error('Cannot delete task with active dependencies')
      } else {
        toast.error('Failed to delete task. Please try again.')
      }
      console.error('Task deletion error:', error)
    }
  }

  const handleEditTask = (task: TicketTask) => {
    // Close any other task dialogs first
    setDeletingTaskId(null)
    setEditingTask(task)
    setIsTaskEditDialogOpen(true)
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

  const handleReopenTicket = async () => {
    try {
      await updateTicket.mutateAsync({ ticketId: ticket!.ticket.id, data: { status: 'open' } })
      toast.success('Ticket reopened')
      onTicketUpdate?.()
    } catch (error) {
      toast.error('Failed to reopen ticket')
    }
  }

  const handleDeleteTicket = async () => {
    if (!ticket) return

    try {
      await deleteTicket.mutateAsync({
        ticketId: ticket.ticket.id,
        projectId: ticket.ticket.projectId
      })
      toast.success('Ticket deleted successfully')
      setIsDeleteDialogOpen(false)
      onTicketUpdate?.()
      // Navigate back to tickets list after deletion
      navigate({
        to: '/projects',
        search: (prev: any) => ({
          ...prev,
          activeView: 'flow',
          flowView: 'tickets',
          selectedTicketId: undefined
        })
      })
    } catch (error) {
      toast.error('Failed to delete ticket')
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='ghost' size='icon'>
                <MoreHorizontal className='h-4 w-4' />
                <span className='sr-only'>More actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuItem onClick={handleCopyAsMarkdown}>
                <Copy className='h-4 w-4 mr-2' />
                Copy as Markdown
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsAddToQueueDialogOpen(true)}>
                <ListPlus className='h-4 w-4 mr-2' />
                Add to Queue
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsAgentDialogOpen(true)}>
                <Bot className='h-4 w-4 mr-2' />
                Set Default Agent
              </DropdownMenuItem>
              {ticket.ticket.status !== 'closed' && (
                <DropdownMenuItem onClick={() => setIsCompleteDialogOpen(true)} disabled={completeTicket.isPending}>
                  <CheckCircle2 className='h-4 w-4 mr-2' />
                  Complete Ticket
                </DropdownMenuItem>
              )}
              {ticket.ticket.status === 'closed' && (
                <DropdownMenuItem onClick={handleReopenTicket} disabled={updateTicket.isPending}>
                  <CheckCircle2 className='h-4 w-4 mr-2' />
                  Reopen Ticket
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)}>
                <Edit className='h-4 w-4 mr-2' />
                Edit Ticket
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setIsDeleteDialogOpen(true)}
                className='text-destructive focus:text-destructive'
              >
                <Trash2 className='h-4 w-4 mr-2' />
                Delete Ticket
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Status and Priority */}
        <div className='flex items-center gap-3'>
          <Badge className={cn(STATUS_COLORS[t.status as keyof typeof STATUS_COLORS])}>
            {t.status?.replace('_', ' ').toUpperCase()}
          </Badge>
          <Badge className={cn(PRIORITY_COLORS[t.priority as keyof typeof PRIORITY_COLORS])}>
            {t.priority?.toUpperCase()} PRIORITY
          </Badge>
          <div className='ml-auto text-sm text-muted-foreground'>
            {completedTasks} of {totalTasks} tasks completed ({completionPercentage}%)
          </div>
        </div>

        {/* Queue Information */}
        {t.queueId && queueData && (
          <Card className='border-l-4 border-l-blue-500'>
            <CardHeader className='pb-3'>
              <div className='flex items-center justify-between'>
                <CardTitle className='text-lg flex items-center gap-2'>
                  <ListOrdered className='h-5 w-5' />
                  Queue Information
                </CardTitle>
                <div className='flex items-center gap-2'>
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
                          selectedQueueId: t.queueId
                        })
                      })
                    }}
                  >
                    View Queue
                    <ArrowRight className='h-4 w-4 ml-1' />
                  </Button>
                  <Button
                    variant='destructive'
                    size='sm'
                    disabled={dequeueTicket.isPending}
                    onClick={async () => {
                      await dequeueTicket.mutateAsync(t.id)
                    }}
                  >
                    Unqueue Ticket
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className='space-y-2'>
              <div className='flex items-center justify-between text-sm'>
                <span className='text-muted-foreground'>Queue Name:</span>
                <span className='font-medium'>{queueData.name}</span>
              </div>
              {t.queuePosition !== null && t.queuePosition !== undefined && (
                <div className='flex items-center justify-between text-sm'>
                  <span className='text-muted-foreground'>Position in Queue:</span>
                  <div className='flex items-center gap-2'>
                    <Button
                      variant='outline'
                      size='icon'
                      className='h-6 w-6'
                      disabled={moveItem.isPending}
                      onClick={() => bumpTicketPosition(-1)}
                    >
                      −
                    </Button>
                    <Badge variant='secondary'>#{t.queuePosition}</Badge>
                    <Button
                      variant='outline'
                      size='icon'
                      className='h-6 w-6'
                      disabled={moveItem.isPending}
                      onClick={() => bumpTicketPosition(1)}
                    >
                      +
                    </Button>
                  </div>
                </div>
              )}
              {t.queueStatus && (
                <div className='flex items-center justify-between text-sm'>
                  <span className='text-muted-foreground'>Queue Status:</span>
                  <Badge
                    variant={t.queueStatus === 'completed' ? 'default' : 'secondary'}
                    className={cn(
                      t.queueStatus === 'in_progress' && 'bg-yellow-500/10 text-yellow-700',
                      t.queueStatus === 'completed' && 'bg-green-500/10 text-green-700',
                      t.queueStatus === 'failed' && 'bg-red-500/10 text-red-700'
                    )}
                  >
                    {t.queueStatus.replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>
              )}
              {t.queuePriority !== null && t.queuePriority !== undefined && (
                <div className='flex items-center justify-between text-sm'>
                  <span className='text-muted-foreground'>Queue Priority:</span>
                  <span className='font-medium'>{t.queuePriority}</span>
                </div>
              )}
              {t.queuedAt && (
                <div className='flex items-center justify-between text-sm'>
                  <span className='text-muted-foreground'>Queued:</span>
                  <span className='text-xs'>{formatDistanceToNow(new Date(t.queuedAt))} ago</span>
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
            {tasks.length === 0 ? (
              <div className='flex flex-col items-center justify-center py-8 px-4 text-center'>
                <div className='p-3 rounded-full bg-muted/50 mb-4'>
                  <Bot className='h-6 w-6 text-muted-foreground' />
                </div>
                <p className='text-muted-foreground text-sm mb-4'>
                  No tasks yet. Generate tasks from the overview or add manually.
                </p>
                <div className='flex gap-2'>
                  {ticket.ticket.overview && (
                    <Button
                      size='sm'
                      variant='default'
                      onClick={() => {
                        // Prevent double-clicks by checking if already pending
                        if (!autoGenerateTasks.isPending) {
                          autoGenerateTasks.mutate(ticket.ticket.id, {
                            onSuccess: () => {
                              toast.success('Tasks generated successfully!')
                            }
                            // Error handling is done by commonErrorHandler in the hook
                          })
                        }
                      }}
                      disabled={autoGenerateTasks.isPending}
                      aria-label='Generate tasks automatically from ticket overview'
                      aria-busy={autoGenerateTasks.isPending}
                    >
                      {autoGenerateTasks.isPending ? (
                        <>
                          <Bot className='h-4 w-4 mr-1 animate-pulse' />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Bot className='h-4 w-4 mr-1' />
                          Generate Tasks
                        </>
                      )}
                    </Button>
                  )}
                  {!ticket.ticket.overview ? (
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() => {
                        // Try to generate tasks even without overview
                        // The API will return an error message guiding the user
                        if (!autoGenerateTasks.isPending) {
                          autoGenerateTasks.mutate(ticket.ticket.id, {
                            onError: () => {
                              toast.error('Please add an overview to the ticket first to enable AI task generation', {
                                action: {
                                  label: 'Edit Ticket',
                                  onClick: () => setIsEditDialogOpen(true)
                                }
                              })
                            }
                          })
                        }
                      }}
                      disabled={autoGenerateTasks.isPending}
                      aria-label='Generate tasks from AI'
                      aria-busy={autoGenerateTasks.isPending}
                    >
                      {autoGenerateTasks.isPending ? (
                        <>
                          <Bot className='h-4 w-4 mr-1 animate-pulse' />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Bot className='h-4 w-4 mr-1' />
                          Generate Tasks
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() => setIsEditDialogOpen(true)}
                      aria-label='Add tasks manually'
                    >
                      <Plus className='h-4 w-4 mr-1' />
                      Add Manually
                    </Button>
                  )}
                </div>
                {!ticket.ticket.overview && (
                  <p className='text-xs text-muted-foreground mt-4'>
                    Tip: Add an overview to the ticket to enable automatic task generation from AI.
                  </p>
                )}
              </div>
            ) : (
              <div className='space-y-3'>
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className={cn('group flex items-start gap-3 p-3 rounded-lg border', task.done && 'bg-muted/50')}
                  >
                    <Checkbox
                      checked={task.done}
                      onCheckedChange={(checked) => handleTaskToggle(task.id, checked as boolean)}
                      className='mt-0.5'
                    />
                    <div className='flex-1 space-y-1'>
                      <div className='flex items-start justify-between gap-2'>
                        <div className='flex-1'>
                          <div className={cn('font-medium', task.done && 'line-through text-muted-foreground')}>
                            {task.content}
                          </div>
                          {task.description && (
                            <p className={cn('text-sm text-muted-foreground mt-1', task.done && 'line-through')}>
                              {task.description}
                            </p>
                          )}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant='ghost'
                              size='icon'
                              className='h-8 w-8 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity'
                              aria-label={`Actions for task: ${task.content.substring(0, 50)}${task.content.length > 50 ? '...' : ''}`}
                              aria-haspopup='menu'
                            >
                              <MoreHorizontal className='h-4 w-4' />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align='end'>
                            <DropdownMenuItem onClick={() => handleEditTask(task)}>
                              <Edit className='h-4 w-4 mr-2' />
                              Edit Task
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                // Close any other task dialogs first
                                setIsTaskEditDialogOpen(false)
                                setEditingTask(null)
                                setDeletingTaskId(task.id)
                              }}
                              className='text-destructive focus:text-destructive'
                            >
                              <Trash2 className='h-4 w-4 mr-2' />
                              Delete Task
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className='flex items-center gap-4 text-xs text-muted-foreground'>
                        {/* {task.estimatedHours && (
                          <span className='flex items-center gap-1'>
                            <Clock className='h-3 w-3' />
                            {task.estimatedHours}h estimated
                          </span>
                        )} */}
                        {task.tags && task.tags.length > 0 && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <span className='flex items-center gap-1 cursor-pointer hover:text-primary transition-colors'>
                                <Hash className='h-3 w-3' />
                                {task.tags?.length} tags
                              </span>
                            </PopoverTrigger>
                            <PopoverContent className='w-64' align='start'>
                              <div className='space-y-2'>
                                <div className='font-medium text-sm'>Tags</div>
                                <div className='flex flex-wrap gap-1'>
                                  {task.tags?.map((tag, index) => (
                                    <Badge key={index} variant='secondary' className='text-xs'>
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}
                        {task.suggestedFileIds && task.suggestedFileIds.length > 0 && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <span className='flex items-center gap-1 cursor-pointer hover:text-primary transition-colors'>
                                <FileText className='h-3 w-3' />
                                {task.suggestedFileIds?.length} files
                              </span>
                            </PopoverTrigger>
                            <PopoverContent className='w-96' align='start'>
                              <div className='space-y-2'>
                                <div className='font-medium text-sm'>Associated Files</div>
                                <ScrollArea className='h-[200px]'>
                                  <div className='space-y-1'>
                                    {task.suggestedFileIds?.map((fileId, index) => (
                                      <FileDisplayItem
                                        key={index}
                                        fileId={fileId}
                                        projectId={projectId}
                                        projectRoot={projectData?.data?.path}
                                      />
                                    ))}
                                  </div>
                                </ScrollArea>
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}
                        <AgentSelectorPopover
                          currentAgentId={task.agentId}
                          onAgentSelect={async (agentId) => {
                            try {
                              await updateTask.mutateAsync({
                                ticketId: ticket.ticket.id,
                                taskId: task.id,
                                data: { agentId: agentId || undefined }
                              })
                              toast.success(agentId ? 'Agent assigned to task' : 'Agent removed from task')
                              // Explicitly refetch tasks to ensure UI updates immediately
                              await refetchTasks()
                              onTicketUpdate?.()
                            } catch (error) {
                              toast.error('Failed to update task agent')
                              console.error('Error updating task agent:', error)
                            }
                          }}
                          projectId={projectId}
                          triggerClassName='text-xs'
                          placeholder='Select agent'
                        />
                        <PromptSelectorPopover
                          currentPromptIds={task.suggestedPromptIds || []}
                          onPromptsSelect={async (promptIds) => {
                            try {
                              await updateTask.mutateAsync({
                                ticketId: ticket.ticket.id,
                                taskId: task.id,
                                data: { suggestedPromptIds: promptIds }
                              })
                              toast.success(
                                promptIds.length > 0 ? 'Prompts updated for task' : 'Prompts removed from task'
                              )
                              // Explicitly refetch tasks to ensure UI updates immediately
                              await refetchTasks()
                              // Also invalidate related queries
                              invalidateTicketTasks(ticket.ticket.id)
                              onTicketUpdate?.()
                            } catch (error) {
                              toast.error('Failed to update task prompts')
                              console.error('Error updating task prompts:', error)
                            }
                          }}
                          projectId={projectId}
                          triggerClassName='text-xs'
                          placeholder='Select prompts'
                        />
                        {task.dependencies && task.dependencies.length > 0 && (
                          <span className='flex items-center gap-1'>
                            <Link2 className='h-3 w-3' />
                            {task.dependencies?.length} dependencies
                          </span>
                        )}
                        {task.queueId ? (
                          <Button
                            variant='ghost'
                            size='sm'
                            className='h-6 px-2 text-red-600 hover:text-red-700'
                            disabled={dequeueTask.isPending}
                            onClick={async () => {
                              await dequeueTask.mutateAsync(task.id)
                            }}
                          >
                            Unqueue Task
                          </Button>
                        ) : (
                          <Button
                            variant='ghost'
                            size='sm'
                            className='h-6 px-2 text-blue-600 hover:text-blue-700'
                            onClick={() => setTaskToQueue(task)}
                          >
                            <ListPlus className='h-3 w-3 mr-1' />
                            {ticket.ticket.queueId && queueData ? `Queue to ${queueData.name}` : 'Add to Queue'}
                          </Button>
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
                  {ticket.ticket.suggestedFileIds?.length || 0} files
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

      <AddToQueueDialog
        isOpen={isAddToQueueDialogOpen}
        onClose={() => {
          setIsAddToQueueDialogOpen(false)
          onTicketUpdate?.()
        }}
        ticketId={ticket?.ticket.id || 0}
        projectId={projectId}
        ticketTitle={ticket?.ticket.title}
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Ticket</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this ticket? This will:
              <ul className='mt-2 ml-4 list-disc space-y-1'>
                <li>Permanently delete the ticket "{ticket?.ticket.title}"</li>
                <li>Delete all {ticket?.tasks.length || 0} associated tasks</li>
                {ticket?.ticket.queueId && <li>Remove the ticket from any active queues</li>}
              </ul>
              <div className='mt-3 font-semibold'>This action cannot be undone.</div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTicket}
              disabled={deleteTicket.isPending}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {deleteTicket.isPending ? 'Deleting...' : 'Delete Ticket'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isAgentDialogOpen} onOpenChange={setIsAgentDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Set Default Agent for Ticket</AlertDialogTitle>
            <AlertDialogDescription>
              Select a default agent for this ticket. You can optionally apply this agent to all existing tasks.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className='py-4'>
            <AgentSelectorPopover
              currentAgentId={ticket?.ticket.suggestedAgentIds?.[0]}
              onAgentSelect={async (agentId) => {
                try {
                  // Update ticket with selected agent
                  await updateTicket.mutateAsync({
                    ticketId: ticket!.ticket.id,
                    data: {
                      suggestedAgentIds: agentId ? [agentId] : []
                    }
                  })

                  // Optionally update all tasks
                  const shouldUpdateTasks = await new Promise<boolean>((resolve) => {
                    if (tasks.length === 0 || !agentId) {
                      resolve(false)
                      return
                    }

                    // Simple confirmation - in production you might want a proper dialog
                    const confirmed = window.confirm(`Apply this agent to all ${tasks.length} existing tasks?`)
                    resolve(confirmed)
                  })

                  if (shouldUpdateTasks && agentId) {
                    // Update all tasks with the selected agent
                    await Promise.all(
                      tasks.map((task) =>
                        updateTask.mutateAsync({
                          ticketId: ticket!.ticket.id,
                          taskId: task.id,
                          data: { agentId }
                        })
                      )
                    )
                    toast.success(`Agent applied to ticket and all ${tasks.length} tasks`)
                  } else {
                    toast.success(agentId ? 'Default agent set for ticket' : 'Default agent removed')
                  }

                  setIsAgentDialogOpen(false)
                  onTicketUpdate?.()
                } catch (error) {
                  toast.error('Failed to update ticket agent')
                }
              }}
              projectId={projectId}
              triggerClassName='w-full justify-between'
              placeholder='Select default agent...'
            />
            {ticket?.ticket.suggestedAgentIds?.[0] && (
              <div className='mt-3 text-sm text-muted-foreground'>
                Current default:{' '}
                <AgentDisplay
                  agentId={ticket.ticket.suggestedAgentIds[0]}
                  projectId={projectId}
                  className='inline-flex ml-1'
                />
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AddTaskToQueueDialog
        isOpen={!!taskToQueue}
        onClose={() => {
          setTaskToQueue(null)
          onTicketUpdate?.()
        }}
        task={taskToQueue}
        projectId={projectId}
        ticketQueueId={ticket?.ticket.queueId}
        ticketQueueName={queueData?.name}
      />

      <TaskEditDialog
        isOpen={isTaskEditDialogOpen}
        onClose={() => {
          setIsTaskEditDialogOpen(false)
          setEditingTask(null)
          onTicketUpdate?.()
        }}
        task={editingTask}
        ticketId={ticket?.ticket.id || 0}
        projectId={projectId}
      />

      <AlertDialog open={!!deletingTaskId} onOpenChange={(open) => !open && setDeletingTaskId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this task?
              {deletingTaskId && tasks.find((t) => t.id === deletingTaskId) && (
                <div className='mt-3 p-3 rounded-md bg-muted'>
                  <p className='font-medium text-sm'>{tasks.find((t) => t.id === deletingTaskId)?.content}</p>
                </div>
              )}
              <div className='mt-3 font-semibold'>This action cannot be undone.</div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingTaskId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingTaskId && handleDeleteTask(deletingTaskId)}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              Delete Task
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
