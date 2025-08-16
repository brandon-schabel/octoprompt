import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { Input } from '@promptliano/ui'
import { Textarea } from '@promptliano/ui'
import { ToggleGroup, ToggleGroupItem } from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { Separator } from '@promptliano/ui'
import { cn } from '@promptliano/ui'
import { useCreateTicket, useUpdateTicket } from '@/hooks/api/use-tickets-api'
import { PromptlianoTooltip } from '../promptliano/promptliano-tooltip'
import { TicketTasksPanel } from './ticket-tasks-panel'
import { QueueBadge, AddToQueueButton } from '../queues/queue-badge'
import { QueueSelectionDialog } from '../queues/queue-selection-dialog'
import type { TicketWithTasks } from '@promptliano/schemas'
import {
  Flame,
  Zap,
  Leaf,
  Circle,
  Clock,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  Calendar,
  User,
  Hash,
  FileText,
  Loader2
} from 'lucide-react'

interface TicketDialogProps {
  isOpen: boolean
  onClose: () => void
  ticketWithTasks: TicketWithTasks | null
  projectId: string
}

const priorityConfig = {
  high: {
    label: 'High',
    icon: Flame,
    color: 'from-red-500 to-orange-500',
    bgColor: 'bg-red-500/20 dark:bg-red-500/30',
    borderColor: 'border-red-500/50 dark:border-red-400/50',
    textColor: 'text-red-700 dark:text-red-300',
    description: 'Urgent priority'
  },
  normal: {
    label: 'Normal',
    icon: Zap,
    color: 'from-amber-500 to-yellow-500',
    bgColor: 'bg-amber-500/20 dark:bg-amber-500/30',
    borderColor: 'border-amber-500/50 dark:border-amber-400/50',
    textColor: 'text-amber-700 dark:text-amber-300',
    description: 'Standard priority'
  },
  low: {
    label: 'Low',
    icon: Leaf,
    color: 'from-green-500 to-emerald-500',
    bgColor: 'bg-green-500/20 dark:bg-green-500/30',
    borderColor: 'border-green-500/50 dark:border-green-400/50',
    textColor: 'text-green-700 dark:text-green-300',
    description: 'Can wait'
  }
}

const statusConfig = {
  open: {
    label: 'Open',
    icon: Circle,
    color: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-blue-500/20 dark:bg-blue-500/30',
    borderColor: 'border-blue-500/50 dark:border-blue-400/50',
    textColor: 'text-blue-700 dark:text-blue-300',
    description: 'Ready to start'
  },
  in_progress: {
    label: 'In Progress',
    icon: Clock,
    color: 'from-amber-500 to-orange-500',
    bgColor: 'bg-amber-500/20 dark:bg-amber-500/30',
    borderColor: 'border-amber-500/50 dark:border-amber-400/50',
    textColor: 'text-amber-700 dark:text-amber-300',
    description: 'Currently working'
  },
  closed: {
    label: 'Closed',
    icon: CheckCircle2,
    color: 'from-green-500 to-emerald-500',
    bgColor: 'bg-green-500/20 dark:bg-green-500/30',
    borderColor: 'border-green-500/50 dark:border-green-400/50',
    textColor: 'text-green-700 dark:text-green-300',
    description: 'Completed'
  }
}

export function TicketDialog({ isOpen, onClose, ticketWithTasks, projectId }: TicketDialogProps) {
  const createTicket = useCreateTicket()
  const updateTicket = useUpdateTicket()

  const [title, setTitle] = useState('')
  const [overview, setOverview] = useState('')
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal')
  const [status, setStatus] = useState<'open' | 'in_progress' | 'closed'>('open')
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isQueueDialogOpen, setIsQueueDialogOpen] = useState(false)

  // Character counters
  const titleCharCount = title.length
  const overviewCharCount = overview.length
  const maxTitleLength = 100
  const maxOverviewLength = 1000

  // Reset form to initial state
  const resetForm = () => {
    setTitle('')
    setOverview('')
    setPriority('normal')
    setStatus('open')
    setSelectedFileIds([])
  }

  useEffect(() => {
    if (ticketWithTasks) {
      setTitle(ticketWithTasks.ticket.title)
      setOverview(ticketWithTasks.ticket.overview ?? '')
      setPriority(ticketWithTasks.ticket.priority as 'low' | 'normal' | 'high')
      setStatus(ticketWithTasks.ticket.status as 'open' | 'in_progress' | 'closed')
      setSelectedFileIds(ticketWithTasks.ticket.suggestedFileIds || [])
    } else {
      resetForm()
    }
  }, [ticketWithTasks])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isSubmitting) return

    setIsSubmitting(true)
    try {
      if (ticketWithTasks) {
        await updateTicket.mutateAsync({
          ticketId: ticketWithTasks.ticket.id,
          data: {
            title,
            overview,
            priority,
            status
          }
        })
      } else {
        await createTicket.mutateAsync({
          projectId: Number(projectId),
          title,
          overview,
          priority,
          status,
          suggestedFileIds: selectedFileIds
        })
        // Reset form after successful creation
        resetForm()
      }
      onClose()
    } catch (err) {
      console.error('Failed to save ticket:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      onClose()
    }
  }

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen && (e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        handleSubmit(e as any)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, title, overview, priority, status])

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isSubmitting) {
          handleClose()
        }
      }}
      modal
    >
      <DialogContent
        className='sm:max-w-[750px] max-h-[90vh] p-0 overflow-hidden flex flex-col'
        onInteractOutside={(e) => {
          e.preventDefault()
        }}
        onEscapeKeyDown={(e) => {
          if (isSubmitting) {
            e.preventDefault()
          }
        }}
      >
        {/* Fixed Gradient Header */}
        <div
          className={cn(
            'relative overflow-hidden bg-gradient-to-r p-6 flex-shrink-0',
            ticketWithTasks ? statusConfig[status].color : 'from-purple-500 to-pink-500'
          )}
        >
          <div className='absolute inset-0 bg-black/20' />
          <div className='relative z-10'>
            <DialogTitle className='flex items-center justify-between text-white'>
              <div className='flex items-center gap-3'>
                <div className='p-2 bg-white/20 backdrop-blur-sm rounded-lg'>
                  <Sparkles className='h-5 w-5' />
                </div>
                <div>
                  <span className='text-xl font-semibold'>{ticketWithTasks ? 'Edit Ticket' : 'Create New Ticket'}</span>
                  <p className='text-sm text-white/80 mt-1'>
                    {ticketWithTasks
                      ? 'Update ticket details and manage tasks'
                      : 'Start with a clear title and detailed overview'}
                  </p>
                </div>
              </div>
              {ticketWithTasks && (
                <div className='flex items-center gap-2'>
                  {ticketWithTasks.ticket.queueId ? (
                    <QueueBadge
                      item={ticketWithTasks.ticket}
                      projectId={Number(projectId)}
                      size='md'
                      className='bg-white/20 backdrop-blur-sm border-white/30 text-white'
                    />
                  ) : (
                    <AddToQueueButton
                      onAddToQueue={() => setIsQueueDialogOpen(true)}
                      size='sm'
                      variant='outline'
                      className='bg-white/20 backdrop-blur-sm border-white/30 text-white hover:bg-white/30'
                    />
                  )}
                </div>
              )}
            </DialogTitle>
          </div>
        </div>

        {/* Scrollable Form Content */}
        <form id='ticket-form' onSubmit={handleSubmit} className='flex-1 overflow-y-auto p-6 space-y-6'>
          {/* Title Input with Character Counter */}
          <div className='space-y-2'>
            <div className='flex items-center justify-between'>
              <label htmlFor='title' className='text-sm font-medium flex items-center gap-2'>
                <FileText className='h-4 w-4 text-muted-foreground' />
                Title
              </label>
              <span
                className={cn(
                  'text-xs',
                  titleCharCount > maxTitleLength * 0.9 ? 'text-red-500' : 'text-muted-foreground'
                )}
              >
                {titleCharCount}/{maxTitleLength}
              </span>
            </div>
            <Input
              id='title'
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, maxTitleLength))}
              required
              placeholder='Enter a clear, descriptive title...'
              className='transition-all focus:scale-[1.01]'
            />
          </div>

          {/* Priority and Status Selection */}
          <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
            {/* Priority Selection */}
            <div className='space-y-3'>
              <label className='text-sm font-medium flex items-center gap-2'>
                <AlertCircle className='h-4 w-4 text-muted-foreground' />
                Priority
              </label>
              <ToggleGroup
                type='single'
                value={priority}
                onValueChange={(value) => value && setPriority(value as any)}
                className='grid grid-cols-3 gap-2'
              >
                {Object.entries(priorityConfig).map(([key, config]) => {
                  const Icon = config.icon
                  const isSelected = priority === key
                  return (
                    <ToggleGroupItem
                      key={key}
                      value={key}
                      aria-label={config.label}
                      className={cn(
                        'relative flex flex-col items-center gap-1.5 h-auto py-3 px-2',
                        'border-2 rounded-lg transition-all duration-200',
                        'hover:scale-105 hover:shadow-md',
                        isSelected
                          ? [
                              config.bgColor,
                              config.borderColor,
                              config.textColor,
                              'shadow-lg scale-105',
                              'ring-2 ring-offset-2 ring-offset-background',
                              key === 'high' && 'ring-red-400 dark:ring-red-500',
                              key === 'normal' && 'ring-amber-400 dark:ring-amber-500',
                              key === 'low' && 'ring-green-400 dark:ring-green-500'
                            ]
                          : [
                              'border-muted-foreground/30 dark:border-muted-foreground/20',
                              'hover:border-muted-foreground/50',
                              'bg-background/50'
                            ]
                      )}
                    >
                      <Icon className={cn('h-5 w-5 transition-all', isSelected ? 'scale-110' : 'opacity-70')} />
                      <span className={cn('text-xs font-semibold', !isSelected && 'text-muted-foreground')}>
                        {config.label}
                      </span>
                      {isSelected && (
                        <div
                          className={cn(
                            'absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full',
                            'bg-gradient-to-r shadow-lg',
                            config.color,
                            'animate-pulse'
                          )}
                        />
                      )}
                    </ToggleGroupItem>
                  )
                })}
              </ToggleGroup>
              <p className='text-xs text-muted-foreground'>{priorityConfig[priority].description}</p>
            </div>

            {/* Status Selection */}
            <div className='space-y-3'>
              <label className='text-sm font-medium flex items-center gap-2'>
                <Hash className='h-4 w-4 text-muted-foreground' />
                Status
              </label>
              <ToggleGroup
                type='single'
                value={status}
                onValueChange={(value) => value && setStatus(value as any)}
                className='grid grid-cols-3 gap-2'
              >
                {Object.entries(statusConfig).map(([key, config]) => {
                  const Icon = config.icon
                  const isSelected = status === key
                  return (
                    <ToggleGroupItem
                      key={key}
                      value={key}
                      aria-label={config.label}
                      className={cn(
                        'relative flex flex-col items-center gap-1.5 h-auto py-3 px-2',
                        'border-2 rounded-lg transition-all duration-200',
                        'hover:scale-105 hover:shadow-md',
                        isSelected
                          ? [
                              config.bgColor,
                              config.borderColor,
                              config.textColor,
                              'shadow-lg scale-105',
                              'ring-2 ring-offset-2 ring-offset-background',
                              key === 'open' && 'ring-blue-400 dark:ring-blue-500',
                              key === 'in_progress' && 'ring-amber-400 dark:ring-amber-500',
                              key === 'closed' && 'ring-green-400 dark:ring-green-500'
                            ]
                          : [
                              'border-muted-foreground/30 dark:border-muted-foreground/20',
                              'hover:border-muted-foreground/50',
                              'bg-background/50'
                            ]
                      )}
                    >
                      <Icon className={cn('h-5 w-5 transition-all', isSelected ? 'scale-110' : 'opacity-70')} />
                      <span className={cn('text-xs font-semibold', !isSelected && 'text-muted-foreground')}>
                        {config.label}
                      </span>
                      {isSelected && (
                        <div
                          className={cn(
                            'absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full',
                            'bg-gradient-to-r shadow-lg',
                            config.color,
                            'animate-pulse'
                          )}
                        />
                      )}
                    </ToggleGroupItem>
                  )
                })}
              </ToggleGroup>
              <p className='text-xs text-muted-foreground'>{statusConfig[status].description}</p>
            </div>
          </div>

          <Separator className='my-6' />

          {/* Overview with Character Counter */}
          <div className='space-y-2'>
            <div className='flex items-center justify-between'>
              <label htmlFor='overview' className='text-sm font-medium flex items-center gap-2'>
                <FileText className='h-4 w-4 text-muted-foreground' />
                Overview
                <PromptlianoTooltip className='max-w-xs'>
                  <span className='text-xs'>A detailed overview helps auto-generate tasks & file suggestions!</span>
                </PromptlianoTooltip>
              </label>
              <span
                className={cn(
                  'text-xs',
                  overviewCharCount > maxOverviewLength * 0.9 ? 'text-red-500' : 'text-muted-foreground'
                )}
              >
                {overviewCharCount}/{maxOverviewLength}
              </span>
            </div>
            <Textarea
              id='overview'
              value={overview}
              onChange={(e) => setOverview(e.target.value.slice(0, maxOverviewLength))}
              placeholder='Provide a detailed overview to help auto-generate tasks and file suggestions...'
              className='min-h-[120px] transition-all focus:scale-[1.01] resize-none'
            />
          </div>

          {/* Tasks Panel */}
          {ticketWithTasks && (
            <div className='space-y-2'>
              <Separator className='my-6' />
              <div className='flex items-center gap-2 mb-4'>
                <Badge variant='default' className='gap-1'>
                  <CheckCircle2 className='h-3 w-3' />
                  {ticketWithTasks.tasks.filter((t) => t.done).length}/{ticketWithTasks.tasks.length} Complete
                </Badge>
              </div>
              <TicketTasksPanel ticketId={String(ticketWithTasks.ticket.id)} overview={overview} />
            </div>
          )}
        </form>

        {/* Fixed Footer with Action Buttons */}
        <div className='flex items-center justify-between p-6 pt-4 border-t bg-background flex-shrink-0'>
          <div className='text-xs text-muted-foreground'>
            Tip: Press <kbd className='px-1.5 py-0.5 bg-muted rounded text-xs'>⌘</kbd> +{' '}
            <kbd className='px-1.5 py-0.5 bg-muted rounded text-xs'>Enter</kbd> to submit
          </div>
          <div className='flex gap-3'>
            <Button
              type='button'
              variant='outline'
              onClick={handleClose}
              disabled={isSubmitting}
              className='min-w-[100px]'
            >
              Cancel
            </Button>
            <Button
              type='submit'
              form='ticket-form'
              disabled={isSubmitting || !title.trim()}
              className={cn('min-w-[120px] transition-all', isSubmitting && 'animate-pulse')}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Saving...
                </>
              ) : (
                <>{ticketWithTasks ? 'Update' : 'Create'} Ticket</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Queue Selection Dialog */}
      {ticketWithTasks && (
        <QueueSelectionDialog
          isOpen={isQueueDialogOpen}
          onClose={() => setIsQueueDialogOpen(false)}
          ticketId={ticketWithTasks.ticket.id}
          projectId={Number(projectId)}
        />
      )}
    </Dialog>
  )
}
