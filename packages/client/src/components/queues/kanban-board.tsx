import { useState, useCallback, useEffect, memo, useMemo } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import { restrictToWindowEdges } from '@dnd-kit/modifiers'
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { KanbanColumn } from './kanban-column'
import { KanbanCard } from './kanban-card'
import { Skeleton } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { toast } from 'sonner'
import { Plus, RefreshCw } from 'lucide-react'
import { useGetQueuesWithStats, useCreateQueue } from '@/hooks/api/use-queue-api'
import {
  useGetFlowData,
  useEnqueueTicket,
  useEnqueueTask,
  useDequeueTicket,
  useDequeueTask,
  useMoveItem,
  useBulkMoveItems
} from '@/hooks/api/use-flow-api'
import { promptlianoClient } from '@/hooks/promptliano-client'
import { QueueWithStats } from '@promptliano/schemas'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@promptliano/ui'
import { Input } from '@promptliano/ui'
import { Label } from '@promptliano/ui'
import { Textarea } from '@promptliano/ui'

interface KanbanBoardProps {
  projectId: number
  onCreateTicket?: () => void
}

interface DragItem {
  id: string
  title: string
  type: 'ticket' | 'task'
  priority?: string
  estimatedHours?: number
  ticketTitle?: string
  currentQueueId?: string
  ticketId?: number // For tasks
  queuePosition?: number | null // Position in queue
  actualId: number // The actual ticket or task ID
  taskCount?: number // For tickets
  completedTaskCount?: number // For tickets
}

export function KanbanBoard({ projectId, onCreateTicket }: KanbanBoardProps) {
  const [activeItem, setActiveItem] = useState<DragItem | null>(null)
  const [isCreateQueueOpen, setIsCreateQueueOpen] = useState(false)
  const [newQueueName, setNewQueueName] = useState('')
  const [newQueueDescription, setNewQueueDescription] = useState('')
  const [maxParallelItems, setMaxParallelItems] = useState('1')

  // Fetch data using unified flow system
  const {
    data: flowData,
    isLoading: flowLoading,
    status: flowStatus,
    isFetched: flowDataFetched,
    refetch: refetchFlow
  } = useGetFlowData(projectId)
  const {
    data: queuesWithStats,
    isLoading: queuesLoading,
    status: queuesStatus,
    refetch: refetchQueues,
    isFetched: queuesWithStatsFetched
  } = useGetQueuesWithStats(projectId)

  console.log({
    flowDataPending: flowDataFetched,
    queuesWithStatsPending: queuesWithStatsFetched
  })

  // Mutations using flow system
  const enqueueTicketMutation = useEnqueueTicket()
  const enqueueTaskMutation = useEnqueueTask()
  const dequeueTicketMutation = useDequeueTicket()
  const dequeueTaskMutation = useDequeueTask()
  const moveItemMutation = useMoveItem()
  const bulkMoveMutation = useBulkMoveItems()
  const createQueueMutation = useCreateQueue(projectId)

  // Process flow data from unified system (no need for separate queue queries)

  // Transform flow data for Kanban
  const itemsByQueue = useMemo(() => {
    const result: Record<string, DragItem[]> = {
      unqueued: []
    }

    if (!flowData) {
      return result
    }

    // Add unqueued items
    if (flowData.unqueued?.tickets) {
      flowData.unqueued.tickets.forEach((ticket) => {
        // Count tasks for this ticket
        let totalTaskCount = 0
        let completedTaskCount = 0

        // Check unqueued tasks
        flowData.unqueued.tasks?.forEach((task) => {
          if (task.ticketId === ticket.id) {
            totalTaskCount++
            if (task.done) {
              completedTaskCount++
            }
          }
        })

        // Also check queued tasks
        Object.values(flowData.queues || {}).forEach((queueData) => {
          queueData.tasks?.forEach((task) => {
            if (task.ticketId === ticket.id) {
              totalTaskCount++
              if (task.done) {
                completedTaskCount++
              }
            }
          })
        })

        result.unqueued.push({
          id: `ticket-${ticket.id}`,
          title: ticket.title,
          type: 'ticket',
          priority: ticket.priority,
          actualId: ticket.id,
          taskCount: totalTaskCount,
          completedTaskCount: completedTaskCount
        })
      })
    }

    if (flowData.unqueued?.tasks) {
      flowData.unqueued.tasks.forEach((task) => {
        // Find parent ticket for title
        let ticketTitle: string | undefined
        const parentTicket = flowData.unqueued.tickets?.find((t) => t.id === task.ticketId)
        if (parentTicket) {
          ticketTitle = parentTicket.title
        } else {
          // Check in queued tickets
          Object.values(flowData.queues || {}).forEach((queueData) => {
            const ticket = queueData.tickets?.find((t) => t.id === task.ticketId)
            if (ticket) ticketTitle = ticket.title
          })
        }

        result.unqueued.push({
          id: `task-${task.id}`,
          title: task.content,
          type: 'task',
          estimatedHours: task.estimatedHours ?? undefined,
          ticketTitle,
          ticketId: task.ticketId,
          actualId: task.id
        })
      })
    }

    // Add queued items
    Object.entries(flowData.queues || {}).forEach(([queueId, queueData]) => {
      result[queueId] = []

      // Add queued tickets
      queueData.tickets?.forEach((ticket) => {
        // Count all tasks for this ticket
        let totalTaskCount = 0
        let completedTaskCount = 0

        // Check tasks in all locations
        flowData.unqueued.tasks?.forEach((task) => {
          if (task.ticketId === ticket.id) {
            totalTaskCount++
            if (task.done) completedTaskCount++
          }
        })

        Object.values(flowData.queues || {}).forEach((q) => {
          q.tasks?.forEach((task) => {
            if (task.ticketId === ticket.id) {
              totalTaskCount++
              if (task.done) completedTaskCount++
            }
          })
        })

        result[queueId].push({
          id: `ticket-${ticket.id}`,
          title: ticket.title,
          type: 'ticket',
          priority: ticket.priority,
          actualId: ticket.id,
          currentQueueId: queueId,
          queuePosition: ticket.queuePosition,
          taskCount: totalTaskCount,
          completedTaskCount: completedTaskCount
        })
      })

      // Add queued tasks
      queueData.tasks?.forEach((task) => {
        // Find parent ticket for title
        let ticketTitle: string | undefined
        Object.values(flowData.queues || {}).forEach((q) => {
          const ticket = q.tickets?.find((t) => t.id === task.ticketId)
          if (ticket) ticketTitle = ticket.title
        })
        if (!ticketTitle) {
          const ticket = flowData.unqueued.tickets?.find((t) => t.id === task.ticketId)
          if (ticket) ticketTitle = ticket.title
        }

        result[queueId].push({
          id: `task-${task.id}`,
          title: task.content,
          type: 'task',
          estimatedHours: task.estimatedHours ?? undefined,
          ticketTitle,
          ticketId: task.ticketId,
          actualId: task.id,
          currentQueueId: queueId,
          queuePosition: task.queuePosition
        })
      })

      // Sort by queue position
      result[queueId].sort((a, b) => (a.queuePosition || 0) - (b.queuePosition || 0))
    })

    return result
  }, [flowData])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  const [activeId, setActiveId] = useState<string | null>(null)

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    setActiveId(active.id as string)

    // Find which queue contains this item
    for (const [queueId, items] of Object.entries(itemsByQueue)) {
      const item = items.find((item) => item.id === active.id)
      if (item) {
        setActiveItem({
          ...item,
          currentQueueId: queueId
        })
        break
      }
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    setActiveId(null)

    if (!over || !activeItem) {
      setActiveItem(null)
      return
    }

    const activeId = active.id as string
    const overId = over.id as string
    const fromQueueId = activeItem.currentQueueId

    // Determine target queue - check if dropped on a column or an item
    let toQueueId: string | undefined

    // If dropped on a column directly
    if (overId === 'unqueued' || queuesWithStats?.some((q) => q.queue.id.toString() === overId)) {
      toQueueId = overId
    } else {
      // If dropped on an item, find which queue contains that item
      for (const [queueId, items] of Object.entries(itemsByQueue)) {
        if (items.some((item) => item.id === overId)) {
          toQueueId = queueId
          break
        }
      }
    }

    if (!fromQueueId || !toQueueId) {
      setActiveItem(null)
      return
    }

    // If moving to a different queue
    if (fromQueueId !== toQueueId) {
      try {
        if (fromQueueId === 'unqueued' && toQueueId !== 'unqueued') {
          // Moving from unqueued to a queue
          const targetQueueIdNum = parseInt(toQueueId)

          if (activeItem.type === 'ticket') {
            // Enqueue ticket (optionally with tasks)
            await enqueueTicketMutation.mutateAsync({
              ticketId: activeItem.actualId,
              queueId: targetQueueIdNum,
              priority: 0,
              includeTasks: true // Include all tasks when moving ticket
            })
            toast.success('Ticket and tasks added to queue')
          } else {
            // Enqueue individual task
            await enqueueTaskMutation.mutateAsync({
              taskId: activeItem.actualId,
              queueId: targetQueueIdNum,
              priority: 0
            })
            toast.success('Task added to queue')
          }
        } else if (fromQueueId !== 'unqueued' && toQueueId !== 'unqueued') {
          // Moving between queues
          await moveItemMutation.mutateAsync({
            itemType: activeItem.type,
            itemId: activeItem.actualId,
            targetQueueId: parseInt(toQueueId),
            priority: 0
          })
          toast.success('Item moved to queue')
        } else if (fromQueueId !== 'unqueued' && toQueueId === 'unqueued') {
          // Moving from a queue back to unqueued
          if (activeItem.type === 'ticket') {
            // Dequeue ticket (and its tasks)
            await dequeueTicketMutation.mutateAsync(activeItem.actualId)
            toast.success('Ticket and tasks moved back to unqueued')
          } else {
            // Dequeue single task
            await dequeueTaskMutation.mutateAsync(activeItem.actualId)
            toast.success('Task moved back to unqueued')
          }
        }

        // Refresh flow data
        await refetchFlow()
      } catch (error: any) {
        console.error('Drag and drop error:', error)
        toast.error(error.message || 'Failed to move item')
      }
    } else if (fromQueueId !== 'unqueued') {
      // Reordering within the same queue (not unqueued)
      const items = itemsByQueue[fromQueueId] || []
      const fromIndex = items.findIndex((item) => item.id === activeId)
      const toIndex = items.findIndex((item) => item.id === overId)

      if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
        const newItems = arrayMove(items, fromIndex, toIndex)

        // Update positions for all items in the new order
        try {
          // For now, we'll just refetch as reordering within queue
          // will need a dedicated endpoint in the flow system
          toast.info('Reordering within queue - refreshing...')
          await refetchFlow()
        } catch (error) {
          toast.error('Failed to reorder items')
        }
      }
    }

    setActiveItem(null)
  }

  const handleCreateQueue = async () => {
    if (!newQueueName.trim()) return

    try {
      await createQueueMutation.mutateAsync({
        name: newQueueName.trim(),
        description: newQueueDescription.trim(),
        maxParallelItems: parseInt(maxParallelItems) || 1
      })

      // Reset form
      setNewQueueName('')
      setNewQueueDescription('')
      setMaxParallelItems('1')
      setIsCreateQueueOpen(false)

      toast.success('Queue created successfully')
    } catch (error) {
      toast.error('Failed to create queue')
    }
  }

  const handlePauseQueue = useCallback(
    async (queue: QueueWithStats) => {
      try {
        await promptlianoClient.queues.updateQueue(queue.queue.id, { status: 'paused' })
        toast.success('Queue paused')
        refetchQueues()
      } catch (error) {
        toast.error('Failed to pause queue')
      }
    },
    [refetchQueues]
  )

  const handleResumeQueue = useCallback(
    async (queue: QueueWithStats) => {
      try {
        await promptlianoClient.queues.updateQueue(queue.queue.id, { status: 'active' })
        toast.success('Queue resumed')
        refetchQueues()
      } catch (error) {
        toast.error('Failed to resume queue')
      }
    },
    [refetchQueues]
  )

  // Only show loading skeleton on initial load, not on refetch
  const isInitialLoading = !flowDataFetched || !queuesWithStatsFetched

  if (isInitialLoading) {
    return (
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-6'>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className='h-[600px]' />
        ))}
      </div>
    )
  }

  return (
    <>
      <div className='p-6 h-full overflow-hidden flex flex-col'>
        {/* Header */}
        <div className='flex items-center justify-between mb-6'>
          <div>
            <h2 className='text-2xl font-bold'>Task Queue Board</h2>
            <p className='text-muted-foreground'>Drag and drop tickets and tasks between queues</p>
          </div>
          <div className='flex items-center gap-2'>
            <Button
              variant='outline'
              size='sm'
              onClick={() => {
                refetchFlow()
                refetchQueues()
              }}
            >
              <RefreshCw className='h-4 w-4 mr-1' />
              Refresh
            </Button>
            <Button size='sm' onClick={() => setIsCreateQueueOpen(true)}>
              <Plus className='h-4 w-4 mr-1' />
              Create Queue
            </Button>
          </div>
        </div>

        {/* Kanban Board */}
        <DndContext
          sensors={sensors}
          collisionDetection={rectIntersection}
          modifiers={[restrictToWindowEdges]}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => {
            setActiveId(null)
            setActiveItem(null)
          }}
        >
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-x-auto flex-1'>
            {/* Unqueued column */}
            <KanbanColumn items={itemsByQueue.unqueued || []} isUnqueued onAddToQueue={onCreateTicket} />

            {/* Queue columns */}
            {queuesWithStats?.map((queueWithStats) => {
              console.log({
                queueWithStats,
                itemsByQueue
              })
              return (
                <KanbanColumn
                  key={queueWithStats.queue.id}
                  queue={queueWithStats}
                  items={itemsByQueue[queueWithStats.queue.id.toString()] || []}
                  onPauseQueue={() => handlePauseQueue(queueWithStats)}
                  onResumeQueue={() => handleResumeQueue(queueWithStats)}
                />
              )
            })}
          </div>

          <DragOverlay>
            {activeItem && (
              <KanbanCard
                id={activeItem.id}
                title={activeItem.title}
                type={activeItem.type}
                priority={activeItem.priority}
                estimatedHours={activeItem.estimatedHours}
                ticketTitle={activeItem.ticketTitle}
                isDragging
                overlay
                isNested={activeItem.type === 'task'}
              />
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Create Queue Dialog */}
      <Dialog open={isCreateQueueOpen} onOpenChange={setIsCreateQueueOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Queue</DialogTitle>
            <DialogDescription>Create a new task processing queue for AI agents</DialogDescription>
          </DialogHeader>

          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <Label htmlFor='queue-name'>Queue Name</Label>
              <Input
                id='queue-name'
                placeholder='e.g., Main Queue, Bug Fixes, Features'
                value={newQueueName}
                onChange={(e) => setNewQueueName(e.target.value)}
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='queue-description'>Description (optional)</Label>
              <Textarea
                id='queue-description'
                placeholder='Describe what this queue is for...'
                value={newQueueDescription}
                onChange={(e) => setNewQueueDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='max-parallel'>Max Parallel Items</Label>
              <Input
                id='max-parallel'
                type='number'
                min='1'
                max='10'
                value={maxParallelItems}
                onChange={(e) => setMaxParallelItems(e.target.value)}
              />
              <p className='text-sm text-muted-foreground'>
                Maximum number of items an agent can process simultaneously
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant='outline' onClick={() => setIsCreateQueueOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateQueue} disabled={!newQueueName.trim() || createQueueMutation.isPending}>
              Create Queue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
