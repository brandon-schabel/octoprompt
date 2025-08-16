import { useState, useMemo } from 'react'
import { ScrollArea } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { Input } from '@promptliano/ui'
import { Label } from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { Skeleton } from '@promptliano/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@promptliano/ui'
import { ConfiguredDataTable, createDataTableColumns, type DataTableColumnsConfig } from '@promptliano/ui'
import { QueueItem, ItemQueueStatus } from '@promptliano/schemas'
import { toast } from 'sonner'
import { useGetQueuesWithStats, useGetQueueItems } from '@/hooks/api/use-queue-api'
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
  const [statusFilter, setStatusFilter] = useState<ItemQueueStatus | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null)

  const { data: queuesWithStats } = useGetQueuesWithStats(projectId)
  const { data: items, isLoading } = useGetQueueItems(
    selectedQueueId || 0,
    statusFilter === 'all' ? undefined : statusFilter
  )
  const { data: ticketsWithTasks } = useGetTicketsWithTasks(projectId)

  // Find selected queue
  const selectedQueue = queuesWithStats?.find((q) => q.queue.id === selectedQueueId)

  // Filter items based on search
  const filteredItems = useMemo(() => {
    const safeItems = ensureArray(items)
    if (!searchQuery) return safeItems

    const query = searchQuery.toLowerCase()
    return safeItems.filter((itemWithRelations: any) => {
      const item = itemWithRelations.queueItem
      if (item.ticketId && item.ticketId.toString().includes(query)) return true
      if (item.taskId && item.taskId.toString().includes(query)) return true
      if (item.agentId?.toLowerCase().includes(query)) return true
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

  const handleStatusChange = async (item: QueueItem, status: ItemQueueStatus) => {
    toast.error('Direct item status changes are no longer supported. Please use the ticket/task management interface.')
  }

  const handleDelete = async (item: QueueItem) => {
    toast.error('Direct item deletion is no longer supported. Please use the ticket/task management interface.')
  }

  const handleRetry = async (item: QueueItem) => {
    toast.error('Direct item retry is no longer supported. Please use the ticket/task management interface.')
  }

  // Status configuration for badges
  const statusConfig = {
    queued: { icon: AlertCircle, color: 'text-muted-foreground', variant: 'secondary' as const },
    in_progress: { icon: Clock, color: 'text-blue-600', variant: 'default' as const },
    completed: { icon: CheckCircle2, color: 'text-green-600', variant: 'default' as const },
    failed: { icon: XCircle, color: 'text-red-600', variant: 'destructive' as const },
    cancelled: { icon: XCircle, color: 'text-gray-600', variant: 'secondary' as const },
    timeout: { icon: Clock, color: 'text-orange-600', variant: 'secondary' as const }
  }

  // Column configuration using the factory pattern
  const columnsConfig: DataTableColumnsConfig<QueueItem> = {
    selectable: false,
    columns: [
      {
        type: 'custom',
        column: {
          header: 'Status',
          accessorFn: (item: QueueItem) => item.status,
          cell: ({ row }) => {
            const item = row.original
            const status = item.status || 'queued'
            const config = statusConfig[status] || statusConfig.queued
            const Icon = config.icon
            return (
              <div className={cn('flex items-center gap-2', config.color)}>
                <Icon className='h-4 w-4' />
                <span className='capitalize'>{status.replace('_', ' ')}</span>
              </div>
            )
          },
          enableSorting: true,
                  }
      },
      {
        type: 'custom',
        column: {
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
          },
          enableSorting: true,
                  }
      },
      {
        type: 'custom',
        column: {
          header: 'Priority',
          accessorFn: (item: QueueItem) => item.priority,
          cell: ({ row }) => {
            const item = row.original
            return (
              <Badge variant='outline' className='text-xs'>
                Priority {item.priority}
              </Badge>
            )
          },
          enableSorting: true,
                  }
      },
      {
        type: 'custom',
        column: {
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
          },
          enableSorting: true,
                  }
      },
      {
        type: 'custom',
        column: {
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
          },
          enableSorting: true,
                  }
      }
    ],
    actions: {
      actions: [
        {
          label: 'View Details',
          icon: ChevronRight,
          onClick: (item) => setSelectedItem(item)
        },
        {
          label: 'Start Processing',
          icon: Play,
          onClick: (item) => handleStatusChange(item, 'in_progress'),
          show: (item) => item.status === 'queued'
        },
        {
          label: 'Mark Complete',
          icon: CheckCircle2,
          onClick: (item) => handleStatusChange(item, 'completed'),
          show: (item) => item.status === 'in_progress'
        },
        {
          label: 'Mark Failed',
          icon: XCircle,
          onClick: (item) => handleStatusChange(item, 'failed'),
          show: (item) => item.status === 'in_progress'
        },
        {
          label: 'Cancel',
          icon: XCircle,
          onClick: (item) => handleStatusChange(item, 'cancelled'),
          show: (item) => item.status === 'queued'
        },
        {
          label: 'Retry',
          icon: RefreshCw,
          onClick: (item) => handleRetry(item),
          show: (item) => item.status === 'failed' || item.status === 'cancelled'
        },
        {
          label: 'Delete',
          icon: Trash2,
          onClick: (item) => handleDelete(item),
          variant: 'destructive'
        }
      ]
    }
  }

  const columns = createDataTableColumns(columnsConfig)

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
          <ConfiguredDataTable
            columns={columns}
            data={filteredItems.map((item: any) => item.queueItem)}
            isLoading={isLoading}
            pagination={{ enabled: true, pageSize: 10 }}
            sorting={{ enabled: true }}
            filtering={{ enabled: true }}
            selection={{ enabled: false }}
            getRowId={(item) => item.id.toString()}
            emptyMessage='No queue items found'
            className='border rounded-lg'
            showToolbar={true}
            showPagination={true}
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