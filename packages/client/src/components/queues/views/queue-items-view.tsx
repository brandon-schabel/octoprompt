import { useState, useMemo } from 'react'
import { ScrollArea } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { Input } from '@promptliano/ui'
import { Label } from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { Skeleton } from '@promptliano/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@promptliano/ui'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@promptliano/ui'
import { DataTable } from '@promptliano/ui'
import type { ColumnDef } from '@tanstack/react-table'
import { QueueItem, QueueItemStatus } from '@promptliano/schemas'
import {
  useGetQueuesWithStats,
  useGetQueueItems,
  useUpdateQueueItem,
  useDeleteQueueItem
} from '@/hooks/api/use-queue-api'
import { useGetTicketsWithTasks } from '@/hooks/api/use-tickets-api'
import { formatDistanceToNow } from 'date-fns'
import { ensureArray, safeFormatDate } from '@/utils/queue-item-utils'
import {
  Search,
  Filter,
  MoreHorizontal,
  ListTodo,
  FileText,
  Play,
  XCircle,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  Trash2,
  ChevronRight,
  FileIcon,
  Bot
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { QueueItemDetailsDialog } from '../queue-item-details-dialog'

interface QueueItemsViewProps {
  projectId: number
  selectedQueueId?: number
  onQueueSelect: (queueId: number | undefined) => void
}

export function QueueItemsView({ projectId, selectedQueueId, onQueueSelect }: QueueItemsViewProps) {
  const [statusFilter, setStatusFilter] = useState<QueueItemStatus | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null)

  const { data: queuesWithStats } = useGetQueuesWithStats(projectId)
  const { data: items, isLoading } = useGetQueueItems(
    selectedQueueId || 0,
    statusFilter === 'all' ? undefined : statusFilter
  )
  const { data: ticketsWithTasks } = useGetTicketsWithTasks(projectId)

  const updateItemMutation = useUpdateQueueItem()
  const deleteItemMutation = useDeleteQueueItem()

  // Find selected queue
  const selectedQueue = queuesWithStats?.find((q) => q.queue.id === selectedQueueId)

  // Filter items based on search
  const filteredItems = useMemo(() => {
    const safeItems = ensureArray(items)
    if (!searchQuery) return safeItems

    const query = searchQuery.toLowerCase()
    return safeItems.filter((itemWithRelations: any) => {
      const item = itemWithRelations.queueItem
      // Search in ticket/task IDs
      if (item.ticketId && item.ticketId.toString().includes(query)) return true
      if (item.taskId && item.taskId.toString().includes(query)) return true

      // Search in agent ID
      if (item.agentId?.toLowerCase().includes(query)) return true

      // Search in error message
      if (item.errorMessage?.toLowerCase().includes(query)) return true

      return false
    })
  }, [items, searchQuery])

  // Get task details for an item
  const getTaskDetails = (item: QueueItem) => {
    if (!item.ticketId || !item.taskId || !ticketsWithTasks) return null

    const ticket = ticketsWithTasks.find((t) => t.ticket.id === item.ticketId)
    if (!ticket) return null

    const task = ticket.tasks.find((t) => t.id === item.taskId)
    return task ? { ticket: ticket.ticket, task } : null
  }

  const handleStatusChange = async (item: QueueItem, status: QueueItemStatus) => {
    await updateItemMutation.mutateAsync({
      itemId: item.id,
      data: { status }
    })
  }

  const handleDelete = async (item: QueueItem) => {
    await deleteItemMutation.mutateAsync(item.id)
  }

  const handleRetry = async (item: QueueItem) => {
    await updateItemMutation.mutateAsync({
      itemId: item.id,
      data: {
        status: 'queued',
        errorMessage: null,
        agentId: null
      }
    })
  }

  const statusConfig = {
    queued: { icon: AlertCircle, color: 'text-muted-foreground', bgColor: 'bg-muted' },
    in_progress: { icon: Clock, color: 'text-blue-600', bgColor: 'bg-blue-100' },
    completed: { icon: CheckCircle2, color: 'text-green-600', bgColor: 'bg-green-100' },
    failed: { icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-100' },
    cancelled: { icon: XCircle, color: 'text-gray-600', bgColor: 'bg-gray-100' }
  }

  const columns: ColumnDef<QueueItem>[] = [
    {
      header: 'Status',
      accessorFn: (item: QueueItem) => item.status,
      cell: ({ row }) => {
        const item = row.original
        // Ensure status has a value, default to 'queued' if undefined
        const status = item.status || 'queued'
        const config = statusConfig[status] || statusConfig.queued
        const Icon = config.icon
        return (
          <div className={cn('flex items-center gap-2', config.color)}>
            <Icon className='h-4 w-4' />
            <span className='capitalize'>{status.replace('_', ' ')}</span>
          </div>
        )
      }
    },
    {
      header: 'Task',
      accessorFn: (item: QueueItem) => item.ticketId || item.taskId || item.id,
      cell: ({ row }) => {
        const item = row.original
        const details = getTaskDetails(item)
        if (!details) {
          return (
            <div className='text-muted-foreground'>{item.ticketId ? `Ticket #${item.ticketId}` : 'Unknown task'}</div>
          )
        }

        return (
          <div className='space-y-1'>
            <div className='flex items-center gap-2'>
              <ListTodo className='h-3 w-3 text-muted-foreground' />
              <span className='font-medium'>{details.ticket.title}</span>
            </div>
            <div className='flex items-center gap-2 text-sm text-muted-foreground'>
              <FileText className='h-3 w-3' />
              <span className='truncate max-w-[300px]'>{details.task.content}</span>
            </div>
            {details.task.suggestedFileIds && details.task.suggestedFileIds.length > 0 && (
              <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                <FileIcon className='h-3 w-3' />
                <span>{details.task.suggestedFileIds.length} suggested files</span>
              </div>
            )}
          </div>
        )
      }
    },
    {
      header: 'Priority',
      accessorFn: (item: QueueItem) => item.priority,
      cell: ({ row }) => {
        const item = row.original
        return (
          <Badge variant='outline' className='text-xs'>
            Priority {item.priority}
          </Badge>
        )
      }
    },
    {
      header: 'Agent',
      accessorFn: (item: QueueItem) => item.agentId || 'unassigned',
      cell: ({ row }) => {
        const item = row.original
        if (!item.agentId) {
          return <span className='text-muted-foreground'>Unassigned</span>
        }
        return (
          <div className='flex items-center gap-2'>
            <Bot className='h-3 w-3' />
            <span className='text-sm'>{item.agentId}</span>
          </div>
        )
      }
    },
    {
      header: 'Time',
      accessorFn: (item: QueueItem) => item.created,
      cell: ({ row }) => {
        const item = row.original
        if (item.completedAt && item.completedAt > 0) {
          const startTime = item.startedAt && item.startedAt > 0 ? item.startedAt : item.created
          const duration = item.completedAt - startTime
          return <span>{Math.round(duration / 1000)}s</span>
        }
        if (item.startedAt && item.startedAt > 0) {
          try {
            return <span>Started {formatDistanceToNow(new Date(item.startedAt * 1000))} ago</span>
          } catch (e) {
            return <span>Started recently</span>
          }
        }
        if (item.created && item.created > 0) {
          try {
            return <span>Added {safeFormatDate(item.created)}</span>
          } catch (e) {
            return <span>Added recently</span>
          }
        }
        return <span>-</span>
      }
    },
    {
      header: 'Actions',
      accessorFn: (item: QueueItem) => item.id,
      cell: ({ row }) => {
        const item = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='ghost' size='icon' className='h-8 w-8'>
                <MoreHorizontal className='h-4 w-4' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuItem onClick={() => setSelectedItem(item)}>
                <ChevronRight className='mr-2 h-4 w-4' />
                View Details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {item.status === 'queued' && (
                <>
                  <DropdownMenuItem onClick={() => handleStatusChange(item, 'in_progress')}>
                    <Play className='mr-2 h-4 w-4' />
                    Start Processing
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleStatusChange(item, 'cancelled')}>
                    <XCircle className='mr-2 h-4 w-4' />
                    Cancel
                  </DropdownMenuItem>
                </>
              )}
              {item.status === 'in_progress' && (
                <>
                  <DropdownMenuItem onClick={() => handleStatusChange(item, 'completed')}>
                    <CheckCircle2 className='mr-2 h-4 w-4' />
                    Mark Complete
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleStatusChange(item, 'failed')}>
                    <XCircle className='mr-2 h-4 w-4' />
                    Mark Failed
                  </DropdownMenuItem>
                </>
              )}
              {(item.status === 'failed' || item.status === 'cancelled') && (
                <DropdownMenuItem onClick={() => handleRetry(item)}>
                  <RefreshCw className='mr-2 h-4 w-4' />
                  Retry
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleDelete(item)} className='text-destructive'>
                <Trash2 className='mr-2 h-4 w-4' />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      }
    }
  ]

  return (
    <div className='flex flex-col h-full'>
      {/* Header */}
      <div className='p-6 border-b'>
        <div className='flex items-center justify-between mb-4'>
          <div>
            <h2 className='text-2xl font-bold'>Queue Items</h2>
            <p className='text-muted-foreground'>
              {selectedQueue ? `Managing items in ${selectedQueue.queue.name}` : 'Select a queue to view items'}
            </p>
          </div>

          {/* Queue selector */}
          <Select
            value={selectedQueueId?.toString() || ''}
            onValueChange={(value) => onQueueSelect(value ? parseInt(value) : undefined)}
          >
            <SelectTrigger className='w-[200px]'>
              <SelectValue placeholder='Select a queue' />
            </SelectTrigger>
            <SelectContent>
              {queuesWithStats?.map((q) => (
                <SelectItem key={q.queue.id} value={q.queue.id.toString()}>
                  {q.queue.name} ({q.stats.queuedItems} queued)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Filters */}
        <div className='flex gap-4'>
          <div className='relative flex-1'>
            <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground' />
            <Input
              placeholder='Search by ID, agent, or error message...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='pl-9'
            />
          </div>

          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
            <SelectTrigger className='w-[150px]'>
              <Filter className='mr-2 h-4 w-4' />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Status</SelectItem>
              <SelectItem value='queued'>Queued</SelectItem>
              <SelectItem value='in_progress'>In Progress</SelectItem>
              <SelectItem value='completed'>Completed</SelectItem>
              <SelectItem value='failed'>Failed</SelectItem>
              <SelectItem value='cancelled'>Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content */}
      <div className='flex-1 p-6'>
        {!selectedQueueId ? (
          <div className='flex flex-col items-center justify-center h-full text-center'>
            <AlertCircle className='h-12 w-12 text-muted-foreground mb-4' />
            <h3 className='text-lg font-semibold mb-2'>No Queue Selected</h3>
            <p className='text-muted-foreground max-w-sm'>
              Select a queue from the dropdown above to view and manage its items
            </p>
          </div>
        ) : isLoading ? (
          <div className='space-y-4'>
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className='h-20' />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className='flex flex-col items-center justify-center h-full text-center'>
            <AlertCircle className='h-12 w-12 text-muted-foreground mb-4' />
            <h3 className='text-lg font-semibold mb-2'>No Items Found</h3>
            <p className='text-muted-foreground max-w-sm'>
              {searchQuery || statusFilter !== 'all' ? 'Try adjusting your filters' : 'This queue is empty'}
            </p>
          </div>
        ) : (
          <DataTable
            data={filteredItems.map((item: any) => item.queueItem)}
            columns={columns}
            className='border rounded-lg'
          />
        )}
      </div>

      {/* Item details dialog */}
      {selectedItem && (
        <QueueItemDetailsDialog
          item={selectedItem}
          projectId={projectId}
          open={!!selectedItem}
          onOpenChange={(open) => !open && setSelectedItem(null)}
        />
      )}
    </div>
  )
}
