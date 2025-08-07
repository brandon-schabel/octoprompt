import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@promptliano/ui'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@promptliano/ui'
import { ScrollArea } from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { Skeleton } from '@promptliano/ui'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@promptliano/ui'
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
import { QueueWithStats, QueueItem, QueueItemStatus } from '@promptliano/schemas'
import {
  useGetQueueItems,
  useUpdateQueueItem,
  useDeleteQueueItem,
  useBatchUpdateQueueItems
} from '@/hooks/api/use-queue-api'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { safeFormatDate, ensureArray, normalizeQueueItem } from '@/utils/queue-item-utils'
import {
  MoreHorizontal,
  Play,
  XCircle,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  Trash2,
  User,
  Users,
  ListTodo,
  FileText,
  Hash
} from 'lucide-react'

interface QueueDetailsDialogProps {
  queue: QueueWithStats
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface QueueItemWithDetails {
  queueItem: QueueItem
  ticket?: any // Will be Ticket type
  task?: any // Will be TicketTask type
}

interface QueueItemRowProps {
  itemData: QueueItemWithDetails
  onStatusChange: (itemId: number, status: QueueItemStatus) => void
  onDelete: (itemId: number) => void
  onRetry: (itemId: number) => void
}

function QueueItemRow({ itemData, onStatusChange, onDelete, onRetry }: QueueItemRowProps) {
  const [isActionsOpen, setIsActionsOpen] = useState(false)
  const { queueItem: item, ticket, task } = itemData

  const statusConfig = {
    queued: { icon: AlertCircle, color: 'text-muted-foreground', bgColor: 'bg-muted' },
    in_progress: { icon: Clock, color: 'text-blue-600', bgColor: 'bg-blue-100' },
    completed: { icon: CheckCircle2, color: 'text-green-600', bgColor: 'bg-green-100' },
    failed: { icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-100' },
    cancelled: { icon: XCircle, color: 'text-gray-600', bgColor: 'bg-gray-100' }
  }

  const config = statusConfig[item.status]
  const Icon = config.icon

  return (
    <div className='flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors'>
      <div className={cn('p-2 rounded-full', config.bgColor)}>
        <Icon className={cn('h-4 w-4', config.color)} />
      </div>

      <div className='flex-1 min-w-0'>
        <div className='flex flex-col gap-1'>
          {/* Main title - ticket title or task content */}
          <div className='font-medium text-sm'>{ticket ? ticket.title : task ? task.content : `Item #${item.id}`}</div>

          {/* Secondary info - IDs and type */}
          <div className='flex items-center gap-2 text-xs text-muted-foreground'>
            {item.ticketId && (
              <div className='flex items-center gap-1'>
                <ListTodo className='h-3 w-3' />
                <span>Ticket #{item.ticketId}</span>
              </div>
            )}
            {item.taskId && (
              <div className='flex items-center gap-1'>
                <FileText className='h-3 w-3' />
                <span>Task #{item.taskId}</span>
                {ticket && <span className='text-muted-foreground'>• {ticket.title}</span>}
              </div>
            )}
            <Badge variant='outline' className='text-xs'>
              Priority {item.priority}
            </Badge>
          </div>
        </div>

        <div className='flex items-center gap-4 text-xs text-muted-foreground'>
          <span>Added {safeFormatDate(item.created)}</span>
          {item.agentId && (
            <div className='flex items-center gap-1'>
              <User className='h-3 w-3' />
              <span>{item.agentId}</span>
            </div>
          )}
          {item.startedAt && <span>Started {safeFormatDate(item.startedAt)}</span>}
        </div>

        {item.errorMessage && <p className='text-xs text-red-600 mt-1 truncate'>{item.errorMessage}</p>}
      </div>

      <DropdownMenu open={isActionsOpen} onOpenChange={setIsActionsOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' size='icon' className='h-8 w-8'>
            <MoreHorizontal className='h-4 w-4' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          {item.status === 'queued' && (
            <>
              <DropdownMenuItem onClick={() => onStatusChange(item.id, 'in_progress')}>
                <Play className='mr-2 h-4 w-4' />
                Start Processing
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange(item.id, 'cancelled')}>
                <XCircle className='mr-2 h-4 w-4' />
                Cancel
              </DropdownMenuItem>
            </>
          )}
          {item.status === 'in_progress' && (
            <>
              <DropdownMenuItem onClick={() => onStatusChange(item.id, 'completed')}>
                <CheckCircle2 className='mr-2 h-4 w-4' />
                Mark Complete
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange(item.id, 'failed')}>
                <XCircle className='mr-2 h-4 w-4' />
                Mark Failed
              </DropdownMenuItem>
            </>
          )}
          {(item.status === 'failed' || item.status === 'cancelled') && (
            <DropdownMenuItem onClick={() => onRetry(item.id)}>
              <RefreshCw className='mr-2 h-4 w-4' />
              Retry
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onDelete(item.id)} className='text-destructive'>
            <Trash2 className='mr-2 h-4 w-4' />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export function QueueDetailsDialog({ queue, open, onOpenChange }: QueueDetailsDialogProps) {
  const [activeTab, setActiveTab] = useState<QueueItemStatus | 'all'>('all')
  const [itemToDelete, setItemToDelete] = useState<number | null>(null)

  // API hooks
  const { data: items, isLoading } = useGetQueueItems(queue.queue.id, activeTab === 'all' ? undefined : activeTab)
  const updateItemMutation = useUpdateQueueItem()
  const deleteItemMutation = useDeleteQueueItem()
  const batchUpdateMutation = useBatchUpdateQueueItems()

  const handleStatusChange = async (itemId: number, status: QueueItemStatus) => {
    await updateItemMutation.mutateAsync({
      itemId,
      data: { status }
    })
  }

  const handleDelete = async (itemId: number) => {
    await deleteItemMutation.mutateAsync(itemId)
    setItemToDelete(null)
  }

  const handleRetry = async (itemId: number) => {
    await updateItemMutation.mutateAsync({
      itemId,
      data: {
        status: 'queued',
        errorMessage: null,
        agentId: null,
        startedAt: null,
        completedAt: null
      }
    })
  }

  const handleCancelAll = async () => {
    const itemsToCancel = Array.isArray(items)
      ? items
          .filter((item) => item.queueItem.status === 'queued')
          .map((item) => ({
            itemId: item.queueItem.id,
            status: 'cancelled' as QueueItemStatus
          }))
      : []

    if (itemsToCancel.length > 0) {
      await batchUpdateMutation.mutateAsync({ updates: itemsToCancel })
    }
  }

  const tabCounts = {
    all: Array.isArray(items) ? items.length : 0,
    queued: Array.isArray(items) ? items.filter((i) => i.queueItem.status === 'queued').length : 0,
    in_progress: Array.isArray(items) ? items.filter((i) => i.queueItem.status === 'in_progress').length : 0,
    completed: Array.isArray(items) ? items.filter((i) => i.queueItem.status === 'completed').length : 0,
    failed: Array.isArray(items) ? items.filter((i) => i.queueItem.status === 'failed').length : 0,
    cancelled: Array.isArray(items) ? items.filter((i) => i.queueItem.status === 'cancelled').length : 0
  }

  const filteredItems = !Array.isArray(items)
    ? []
    : activeTab === 'all'
      ? items
      : items.filter((item) => item.queueItem.status === activeTab)

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className='max-w-4xl max-h-[80vh]'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              {queue.queue.name}
              <Badge variant={queue.queue.status === 'active' ? 'default' : 'secondary'}>{queue.queue.status}</Badge>
            </DialogTitle>
            <DialogDescription>
              {queue.queue.description || 'Manage queue items and monitor processing progress'}
            </DialogDescription>
          </DialogHeader>

          <div className='flex items-center justify-between py-2'>
            <div className='flex items-center gap-4 text-sm text-muted-foreground'>
              <div className='flex items-center gap-1'>
                <Hash className='h-3 w-3' />
                <span>{queue.stats.totalItems} total items</span>
              </div>
              <div className='flex items-center gap-1'>
                <Users className='h-3 w-3' />
                <span>Max {queue.queue.maxParallelItems} parallel</span>
              </div>
              {queue.stats.averageProcessingTime && (
                <div className='flex items-center gap-1'>
                  <Clock className='h-3 w-3' />
                  <span>{Math.round(queue.stats.averageProcessingTime / 1000)}s avg</span>
                </div>
              )}
            </div>

            {tabCounts.queued > 0 && (
              <Button variant='outline' size='sm' onClick={handleCancelAll}>
                <XCircle className='mr-2 h-4 w-4' />
                Cancel All Queued
              </Button>
            )}
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className='grid grid-cols-6 w-full'>
              <TabsTrigger value='all'>All ({tabCounts.all})</TabsTrigger>
              <TabsTrigger value='queued'>Queued ({tabCounts.queued})</TabsTrigger>
              <TabsTrigger value='in_progress'>In Progress ({tabCounts.in_progress})</TabsTrigger>
              <TabsTrigger value='completed'>Completed ({tabCounts.completed})</TabsTrigger>
              <TabsTrigger value='failed'>Failed ({tabCounts.failed})</TabsTrigger>
              <TabsTrigger value='cancelled'>Cancelled ({tabCounts.cancelled})</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className='mt-4'>
              <ScrollArea className='h-[400px] pr-4'>
                {isLoading ? (
                  <div className='space-y-4'>
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className='h-20' />
                    ))}
                  </div>
                ) : filteredItems && filteredItems.length > 0 ? (
                  <div className='space-y-2'>
                    {filteredItems.map((itemData) => (
                      <QueueItemRow
                        key={itemData.queueItem.id}
                        itemData={itemData}
                        onStatusChange={handleStatusChange}
                        onDelete={(id) => setItemToDelete(id)}
                        onRetry={handleRetry}
                      />
                    ))}
                  </div>
                ) : (
                  <div className='flex flex-col items-center justify-center h-[300px] text-center'>
                    <div className='rounded-full bg-muted p-3 mb-4'>
                      <AlertCircle className='h-6 w-6 text-muted-foreground' />
                    </div>
                    <p className='text-muted-foreground'>
                      No {activeTab === 'all' ? 'items' : activeTab.replace('_', ' ')} items in this queue
                    </p>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Queue Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this queue item? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => itemToDelete && handleDelete(itemToDelete)}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              Delete Item
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
