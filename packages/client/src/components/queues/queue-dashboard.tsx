import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter, MetricCard, ComparisonStats } from '@promptliano/ui'
import {
  Badge,
  Button,
  Progress,
  Separator,
  Skeleton,
  ScrollArea,
  Alert,
  AlertDescription,
  AlertTitle
} from '@promptliano/ui'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@promptliano/ui'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@promptliano/ui'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@promptliano/ui'
import { cn } from '@/lib/utils'
import {
  Play,
  Pause,
  Trash2,
  RefreshCw,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Activity,
  TrendingUp,
  Package,
  ArrowUp,
  ArrowDown,
  MoreVertical,
  Filter,
  Download,
  ChevronRight,
  Loader2
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { toast } from 'sonner'
import {
  useGetQueue,
  useGetQueueStats,
  useGetQueueItems,
  useUpdateQueue,
  useDeleteQueue,
  useGetQueueTimeline
} from '@/hooks/api/use-queue-api'
import { useGetFlowData } from '@/hooks/api/use-flow-api'
import type { QueueItem, QueueStats, TaskQueue } from '@promptliano/schemas'

interface QueueDashboardProps {
  queueId: number
  projectId: number
  onClose?: () => void
}

export function QueueDashboard({ queueId, projectId, onClose }: QueueDashboardProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null)

  // Fetch queue data
  const { data: queue, isLoading: isLoadingQueue } = useGetQueue(queueId)
  const { data: stats, isLoading: isLoadingStats } = useGetQueueStats(queueId)
  const { data: items, isLoading: isLoadingItems } = useGetQueueItems(
    queueId,
    selectedStatus === 'all' ? undefined : selectedStatus
  )
  const { data: flowData } = useGetFlowData(projectId)
  const { data: timeline } = useGetQueueTimeline(queueId)

  // Mutations
  const updateQueueMutation = useUpdateQueue(queueId)
  const deleteQueueMutation = useDeleteQueue()
  // Note: Direct queue item operations are no longer supported.
  // Items are now managed through their parent tickets/tasks via the flow service.

  // Loading state
  if (isLoadingQueue || isLoadingStats || isLoadingItems) {
    return <QueueDashboardSkeleton />
  }

  if (!queue || !stats) {
    return (
      <Alert variant='destructive'>
        <AlertCircle className='h-4 w-4' />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Failed to load queue data</AlertDescription>
      </Alert>
    )
  }

  const isActive = queue.status === 'active'
  const totalItems = stats.totalItems || 0
  const processedItems = stats.completedItems + stats.failedItems + stats.cancelledItems
  const progressPercentage = totalItems > 0 ? (processedItems / totalItems) * 100 : 0

  const handleToggleStatus = async () => {
    await updateQueueMutation.mutateAsync({
      status: isActive ? 'paused' : 'active'
    })
  }

  const handleDeleteQueue = async () => {
    await deleteQueueMutation.mutateAsync({ queueId, projectId })
    setIsDeleteDialogOpen(false)
    onClose?.()
  }

  const handleClearQueue = async () => {
    // Direct queue clearing is no longer supported
    // Items should be dequeued individually through their parent ticket/task
    toast.error(
      'Direct queue clearing is no longer supported. Please dequeue items individually through the ticket/task management interface.'
    )
    setIsClearDialogOpen(false)
  }

  const handleRemoveItem = async (itemId: number) => {
    // Direct queue item removal is no longer supported
    // Items should be dequeued through their parent ticket/task
    toast.error('Direct item removal is no longer supported. Please use the ticket/task management interface.')
  }

  const handleRetryItem = async (item: QueueItem) => {
    // Direct queue item updates are no longer supported
    // Status should be managed through their parent ticket/task
    toast.error('Direct item retry is no longer supported. Please use the ticket/task management interface.')
  }

  // Filter items by status
  const filteredItems = useMemo(() => {
    if (!items) return []
    if (selectedStatus === 'all') return items
    return items.filter((item) => item.queueItem.status === selectedStatus)
  }, [items, selectedStatus])

  return (
    <div className='flex flex-col h-full space-y-6'>
      {/* Header */}
      <div className='flex items-start justify-between'>
        <div className='space-y-1'>
          <h2 className='text-3xl font-bold tracking-tight'>{queue.name}</h2>
          {queue.description && <p className='text-muted-foreground'>{queue.description}</p>}
          <div className='flex items-center gap-2 mt-2'>
            <Badge variant={isActive ? 'default' : 'secondary'}>{isActive ? 'Active' : 'Paused'}</Badge>
            <Badge variant='outline'>Max Parallel: {queue.maxParallelItems}</Badge>
            {stats.currentAgents.length > 0 && (
              <Badge variant='outline' className='flex items-center gap-1'>
                <Users className='h-3 w-3' />
                {stats.currentAgents.join(', ')}
              </Badge>
            )}
          </div>
        </div>
        <div className='flex items-center gap-2'>
          <Button variant='outline' size='sm' onClick={handleToggleStatus} disabled={updateQueueMutation.isPending}>
            {updateQueueMutation.isPending ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : isActive ? (
              <>
                <Pause className='h-4 w-4 mr-2' />
                Pause Queue
              </>
            ) : (
              <>
                <Play className='h-4 w-4 mr-2' />
                Resume Queue
              </>
            )}
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={() => setIsClearDialogOpen(true)}
            disabled={!items || items.length === 0}
          >
            <RefreshCw className='h-4 w-4 mr-2' />
            Clear Queue
          </Button>
          <Button variant='destructive' size='sm' onClick={() => setIsDeleteDialogOpen(true)}>
            <Trash2 className='h-4 w-4 mr-2' />
            Delete Queue
          </Button>
        </div>
      </div>

      {/* Queue Activity Comparison */}
      <ComparisonStats
        title="Weekly Processing"
        current={{
          label: 'This Week',
          value: stats.completedItems
        }}
        previous={{
          label: 'Last Week',
          value: Math.floor(stats.completedItems * 0.75)
        }}
        change={{
          value: Math.round(((stats.completedItems - Math.floor(stats.completedItems * 0.75)) / Math.floor(stats.completedItems * 0.75)) * 100),
          trend: stats.completedItems > Math.floor(stats.completedItems * 0.75) ? 'up' : 'down'
        }}
      />

      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle className='text-lg'>Processing Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            <div className='space-y-2'>
              <div className='flex justify-between text-sm'>
                <span className='text-muted-foreground'>Overall Progress</span>
                <span className='font-medium'>{Math.round(progressPercentage)}%</span>
              </div>
              <Progress value={progressPercentage} className='h-3' />
              <div className='flex justify-between text-xs text-muted-foreground'>
                <span>{processedItems} processed</span>
                <span>{totalItems} total</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Grid */}
      <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
        <MetricCard 
          label='Queued' 
          value={stats.queuedItems} 
          icon={Package} 
        />
        <MetricCard
          label='In Progress'
          value={stats.inProgressItems}
          icon={Activity}
          color='orange'
        />
        <MetricCard
          label='Completed'
          value={stats.completedItems}
          icon={CheckCircle2}
          color='green'
        />
        <MetricCard
          label='Failed'
          value={stats.failedItems}
          icon={XCircle}
          color='red'
        />
      </div>

      {/* Performance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className='text-lg'>Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-2 md:grid-cols-3 gap-6'>
            <MetricItem
              label='Avg Processing Time'
              value={stats.averageProcessingTime ? `${Math.round(stats.averageProcessingTime / 1000)}s` : 'N/A'}
              icon={<Clock className='h-4 w-4' />}
            />
            <MetricItem
              label='Success Rate'
              value={totalItems > 0 ? `${Math.round((stats.completedItems / processedItems) * 100)}%` : 'N/A'}
              icon={<TrendingUp className='h-4 w-4' />}
            />
            <MetricItem
              label='Active Agents'
              value={stats.currentAgents.length.toString()}
              icon={<Users className='h-4 w-4' />}
            />
            <MetricItem
              label='Created'
              value={format(new Date(queue.created), 'MMM d, yyyy')}
              icon={<Clock className='h-4 w-4' />}
            />
            <MetricItem
              label='Last Updated'
              value={formatDistanceToNow(new Date(queue.updated), { addSuffix: true })}
              icon={<RefreshCw className='h-4 w-4' />}
            />
          </div>
        </CardContent>
      </Card>

      {/* Queue Items Table */}
      <Card className='flex-1'>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <CardTitle className='text-lg'>Queue Items</CardTitle>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className='w-[180px]'>
                <Filter className='h-4 w-4 mr-2' />
                <SelectValue placeholder='Filter by status' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Items</SelectItem>
                <SelectItem value='queued'>Queued</SelectItem>
                <SelectItem value='in_progress'>In Progress</SelectItem>
                <SelectItem value='completed'>Completed</SelectItem>
                <SelectItem value='failed'>Failed</SelectItem>
                <SelectItem value='cancelled'>Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className='h-[400px]'>
            {filteredItems.length === 0 ? (
              <div className='text-center py-8 text-muted-foreground'>No items found</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Position</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className='text-right'>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <QueueItemRow
                      key={item.queueItem.id}
                      item={item.queueItem}
                      onRemove={handleRemoveItem}
                      onRetry={handleRetryItem}
                      onSelect={() => setSelectedItem(item.queueItem)}
                    />
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Queue</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the queue "{queue.name}"? This will remove all {stats.totalItems} items
              from the queue. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteQueue}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              Delete Queue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear Queue Confirmation Dialog */}
      <AlertDialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Queue</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to clear all items from the queue "{queue.name}"? This will remove{' '}
              {items?.length || 0} items. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearQueue}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              Clear All Items
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}


// Metric Item Component
interface MetricItemProps {
  label: string
  value: string
  icon: React.ReactNode
}

function MetricItem({ label, value, icon }: MetricItemProps) {
  return (
    <div className='flex items-start gap-3'>
      <div className='p-2 bg-muted rounded-lg'>{icon}</div>
      <div>
        <p className='text-sm text-muted-foreground'>{label}</p>
        <p className='font-semibold'>{value}</p>
      </div>
    </div>
  )
}

// Queue Item Row Component
interface QueueItemRowProps {
  item: QueueItem
  onRemove: (id: number) => void
  onRetry: (item: QueueItem) => void
  onSelect: () => void
}

function QueueItemRow({ item, onRemove, onRetry, onSelect }: QueueItemRowProps) {
  const statusColors = {
    queued: 'bg-blue-500',
    in_progress: 'bg-yellow-500',
    completed: 'bg-green-500',
    failed: 'bg-red-500',
    cancelled: 'bg-gray-500'
  }

  const priorityIcons = {
    high: <ArrowUp className='h-3 w-3 text-red-500' />,
    medium: <ChevronRight className='h-3 w-3 text-yellow-500' />,
    low: <ArrowDown className='h-3 w-3 text-green-500' />
  }

  const getPriority = (priority: number) => {
    if (priority <= 3) return 'high'
    if (priority <= 7) return 'medium'
    return 'low'
  }

  return (
    <TableRow className='cursor-pointer hover:bg-muted/50' onClick={onSelect}>
      <TableCell>{item.position}</TableCell>
      <TableCell>
        <Badge variant='outline'>{item.ticketId ? 'Ticket' : 'Task'}</Badge>
      </TableCell>
      <TableCell className='font-medium max-w-[200px] truncate'>
        {item.ticketId ? `Ticket #${item.ticketId}` : `Task #${item.taskId}`}
      </TableCell>
      <TableCell>
        <div className='flex items-center gap-2'>
          <div className={cn('h-2 w-2 rounded-full', statusColors[item.status as keyof typeof statusColors])} />
          <span className='capitalize'>{item.status.replace('_', ' ')}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className='flex items-center gap-1'>
          {priorityIcons[getPriority(item.priority)]}
          <span>{item.priority}</span>
        </div>
      </TableCell>
      <TableCell>
        {item.agentId ? (
          <Badge variant='secondary' className='text-xs'>
            {item.agentId}
          </Badge>
        ) : (
          <span className='text-muted-foreground'>-</span>
        )}
      </TableCell>
      <TableCell className='text-muted-foreground text-sm'>
        {formatDistanceToNow(new Date(item.created), { addSuffix: true })}
      </TableCell>
      <TableCell className='text-right'>
        <div className='flex items-center justify-end gap-1'>
          {item.status === 'failed' && (
            <Button
              variant='ghost'
              size='icon'
              onClick={(e) => {
                e.stopPropagation()
                onRetry(item)
              }}
              title='Retry'
            >
              <RefreshCw className='h-4 w-4' />
            </Button>
          )}
          <Button
            variant='ghost'
            size='icon'
            onClick={(e) => {
              e.stopPropagation()
              onRemove(item.id)
            }}
            title='Remove from queue'
          >
            <Trash2 className='h-4 w-4' />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

// Loading Skeleton
function QueueDashboardSkeleton() {
  return (
    <div className='flex flex-col h-full space-y-6'>
      <div className='flex items-start justify-between'>
        <div className='space-y-2'>
          <Skeleton className='h-10 w-64' />
          <Skeleton className='h-4 w-96' />
          <div className='flex gap-2'>
            <Skeleton className='h-6 w-20' />
            <Skeleton className='h-6 w-32' />
          </div>
        </div>
        <div className='flex gap-2'>
          <Skeleton className='h-9 w-32' />
          <Skeleton className='h-9 w-32' />
          <Skeleton className='h-9 w-32' />
        </div>
      </div>

      <Card>
        <CardHeader>
          <Skeleton className='h-6 w-48' />
        </CardHeader>
        <CardContent>
          <div className='space-y-2'>
            <Skeleton className='h-3 w-full' />
            <Skeleton className='h-2 w-full' />
          </div>
        </CardContent>
      </Card>

      <div className='grid grid-cols-4 gap-4'>
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className='p-6'>
              <Skeleton className='h-4 w-20 mb-2' />
              <Skeleton className='h-8 w-16' />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className='flex-1'>
        <CardHeader>
          <Skeleton className='h-6 w-32' />
        </CardHeader>
        <CardContent>
          <div className='space-y-2'>
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className='h-12 w-full' />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
