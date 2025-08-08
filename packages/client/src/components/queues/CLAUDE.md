# Queue Management & Kanban Board Components

A comprehensive React UI system for managing AI task queues with a drag-and-drop Kanban board interface built using `@dnd-kit/core` and modern React patterns.

## Architecture Overview

### Component Hierarchy

```
queues/
├── kanban-board.tsx              # Main Kanban board with drag-and-drop
├── kanban-card.tsx              # Individual task/ticket cards
├── kanban-column.tsx            # Queue columns with drop zones
├── queue-dashboard.tsx          # Detailed queue management
├── queue-stats-card.tsx         # Queue statistics display
├── queue-management-panel.tsx   # Queue control panel
├── views/
│   ├── queue-overview-view.tsx  # Grid view of all queues
│   ├── queue-items-view.tsx     # Table view of queue items
│   ├── queue-analytics-view.tsx # Analytics and metrics
│   └── queue-timeline-view.tsx  # Timeline visualization
└── dialogs/
    ├── queue-create-dialog.tsx
    ├── queue-details-dialog.tsx
    └── queue-item-details-dialog.tsx
```

### Data Flow Architecture

1. **Unified Flow System**: Uses `useGetFlowData()` for centralized queue and item state
2. **Queue Stats**: Separate `useGetQueuesWithStats()` for performance metrics
3. **Real-time Updates**: Automatic invalidation and refetching after mutations
4. **Optimistic Updates**: UI updates immediately, falls back on error

## Kanban Board Implementation

### Core Drag and Drop System

```typescript
// Main DndContext setup in kanban-board.tsx
<DndContext
  sensors={sensors}
  collisionDetection={rectIntersection}
  modifiers={[restrictToWindowEdges]}
  onDragStart={handleDragStart}
  onDragEnd={handleDragEnd}
>
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
    {/* Unqueued column */}
    <KanbanColumn items={itemsByQueue.unqueued || []} isUnqueued />

    {/* Queue columns */}
    {queuesWithStats?.map((queue) => (
      <KanbanColumn
        key={queue.queue.id}
        queue={queue}
        items={itemsByQueue[queue.queue.id.toString()] || []}
      />
    ))}
  </div>

  <DragOverlay>
    {activeItem && (
      <KanbanCard {...activeItem} isDragging overlay />
    )}
  </DragOverlay>
</DndContext>
```

### Drag and Drop Features

#### Sensors Configuration

```typescript
const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: { distance: 8 } // Prevents accidental drags
  }),
  useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates // Accessibility
  })
)
```

#### Drop Zone Logic

- **Cross-queue Movement**: Moves items between different queues
- **Intra-queue Reordering**: Changes priority within the same queue
- **Unqueue Operations**: Returns items to unqueued state
- **Bulk Operations**: Moves tickets with all their tasks

#### Drag States

```typescript
interface DragItem {
  id: string
  title: string
  type: 'ticket' | 'task'
  priority?: string
  estimatedHours?: number
  ticketTitle?: string
  currentQueueId?: string
  actualId: number // Maps to backend ID
  queuePosition?: number | null
}
```

## Card Component Patterns

### Ticket Cards (Primary Items)

```typescript
// Prominent styling with task progress
<Card className="cursor-move hover:shadow-lg border-2 bg-card/50 backdrop-blur-sm">
  <CardContent>
    <div className="flex items-start gap-3">
      <div className="p-2 rounded-lg bg-blue-100">
        <ListTodo className="h-5 w-5 text-blue-600" />
      </div>
      <div>
        <h4 className="font-semibold">{title}</h4>
        {/* Task progress bar */}
        <div className="flex items-center gap-2">
          <span>{completedTaskCount} of {taskCount} tasks</span>
          <Progress value={progressPercentage} />
        </div>
      </div>
    </div>

    {/* Priority and metadata badges */}
    <div className="flex gap-2 mt-3">
      <Badge variant="secondary">{priority}</Badge>
      <Badge variant="outline">{estimatedHours}h</Badge>
    </div>
  </CardContent>
</Card>
```

### Task Cards (Nested Items)

```typescript
// Compact styling for nested tasks
<Card className="cursor-move hover:shadow-md border border-l-4 border-l-primary/40">
  <CardContent className="p-2.5 pl-3">
    <div className="flex items-center gap-2">
      <ChevronRight className="h-3.5 w-3.5 text-primary/60" />
      <h4 className="text-sm font-medium">{title}</h4>
      {estimatedHours && (
        <Badge variant="outline" className="text-xs">{estimatedHours}h</Badge>
      )}
    </div>
    {ticketTitle && (
      <p className="text-xs text-muted-foreground">From: {ticketTitle}</p>
    )}
  </CardContent>
</Card>
```

## Column Component Architecture

### Drop Zone Implementation

```typescript
const { setNodeRef, isOver } = useDroppable({ id: queueId })

return (
  <div
    ref={setNodeRef}
    className={cn(
      'flex flex-col bg-muted/30 rounded-lg h-[600px]',
      isOver && 'bg-muted/50 ring-2 ring-primary/50 scale-[1.01]'
    )}
  >
    {/* Column header with queue stats */}
    <div className="p-3 border-b bg-muted/20">
      <h3>{queue?.name || 'Unqueued Items'}</h3>
      <div className="flex items-center gap-2">
        <Badge>{stats.queuedItems} queued</Badge>
        {stats.inProgressItems > 0 && (
          <Badge variant="outline">{stats.inProgressItems} in progress</Badge>
        )}
      </div>
    </div>

    {/* Scrollable content area */}
    <ScrollArea className="flex-1">
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        {/* Grouped rendering: tickets with their tasks */}
        {renderGroupedItems()}
      </SortableContext>
    </ScrollArea>
  </div>
)
```

### Hierarchical Item Rendering

```typescript
// Groups tickets with their associated tasks
const renderGroupedItems = () => {
  const tickets = items.filter(item => item.type === 'ticket')
  const tasks = items.filter(item => item.type === 'task')

  return tickets.map(ticket => (
    <div key={ticket.id} className="space-y-2">
      <KanbanCard {...ticket} />

      {/* Nested tasks */}
      <div className="space-y-1.5 ml-2">
        {getTicketTasks(ticket.id).map(task => (
          <KanbanCard key={task.id} {...task} isNested />
        ))}
      </div>
    </div>
  ))
}
```

## State Management Patterns

### Unified Flow Data Processing

```typescript
// Transforms flow data into Kanban-friendly structure
const itemsByQueue = useMemo(() => {
  const result: Record<string, DragItem[]> = { unqueued: [] }

  if (!flowData) return result

  // Process unqueued items
  flowData.unqueued?.tickets?.forEach((ticket) => {
    result.unqueued.push({
      id: `ticket-${ticket.id}`,
      title: ticket.title,
      type: 'ticket',
      actualId: ticket.id,
      taskCount: calculateTaskCount(ticket.id),
      completedTaskCount: calculateCompletedCount(ticket.id)
    })
  })

  // Process queued items by queue ID
  Object.entries(flowData.queues || {}).forEach(([queueId, queueData]) => {
    result[queueId] =
      queueData.tickets?.map((ticket) => ({
        id: `ticket-${ticket.id}`,
        title: ticket.title,
        type: 'ticket',
        actualId: ticket.id,
        currentQueueId: queueId,
        queuePosition: ticket.queuePosition
      })) || []

    // Sort by queue position
    result[queueId].sort((a, b) => (a.queuePosition || 0) - (b.queuePosition || 0))
  })

  return result
}, [flowData])
```

### Drag Operation Handlers

```typescript
const handleDragEnd = async (event: DragEndEvent) => {
  const { active, over } = event

  if (!over || !activeItem) return

  const fromQueueId = activeItem.currentQueueId
  const toQueueId = determineTargetQueue(over.id)

  if (fromQueueId !== toQueueId) {
    // Cross-queue movement
    if (fromQueueId === 'unqueued') {
      // Enqueue operation
      if (activeItem.type === 'ticket') {
        await enqueueTicketMutation.mutateAsync({
          ticketId: activeItem.actualId,
          queueId: parseInt(toQueueId),
          includeTasks: true
        })
      } else {
        await enqueueTaskMutation.mutateAsync({
          taskId: activeItem.actualId,
          queueId: parseInt(toQueueId)
        })
      }
    } else if (toQueueId === 'unqueued') {
      // Dequeue operation
      if (activeItem.type === 'ticket') {
        await dequeueTicketMutation.mutateAsync(activeItem.actualId)
      } else {
        await dequeueTaskMutation.mutateAsync(activeItem.actualId)
      }
    } else {
      // Queue-to-queue movement
      await moveItemMutation.mutateAsync({
        itemType: activeItem.type,
        itemId: activeItem.actualId,
        targetQueueId: parseInt(toQueueId)
      })
    }

    // Refresh data
    await refetchFlow()
  }
}
```

## Real-time Updates & Performance

### Query Invalidation Strategy

```typescript
// Optimized invalidation patterns
const createQueueMutation = useMutation({
  mutationFn: createQueue,
  onSuccess: (data) => {
    queryClient.invalidateQueries({ queryKey: queueKeys.list(projectId) })
    queryClient.invalidateQueries({ queryKey: queueKeys.allStats(projectId) })
  }
})

const moveItemMutation = useMutation({
  mutationFn: moveItem,
  onSuccess: () => {
    // Invalidate flow data to refresh Kanban board
    queryClient.invalidateQueries({ queryKey: ['flow', projectId] })
  }
})
```

### Loading States & Skeletons

```typescript
// Conditional loading based on data fetching state
const isInitialLoading = !flowDataFetched || !queuesWithStatsFetched

if (isInitialLoading) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-6">
      {[1, 2, 3, 4].map(i => (
        <Skeleton key={i} className="h-[600px]" />
      ))}
    </div>
  )
}
```

## Queue Management Features

### Queue Dashboard

- **Real-time Statistics**: Progress bars, completion rates, processing times
- **Agent Management**: View active agents and their assignments
- **Batch Operations**: Clear queue, bulk status updates, priority reordering
- **Performance Metrics**: Success rates, average processing time, throughput

### Queue Controls

```typescript
// Pause/resume queue operations
const handleToggleStatus = async (queue: QueueWithStats) => {
  await updateQueueMutation.mutateAsync({
    status: queue.queue.status === 'active' ? 'paused' : 'active'
  })
}

// Bulk queue operations
const handleClearQueue = async (queueId: number) => {
  await clearQueueMutation.mutateAsync(queueId)
  toast.success('Queue cleared successfully')
}
```

### Item Management

```typescript
// Queue item status transitions
const statusConfig = {
  queued: { icon: AlertCircle, color: 'text-muted-foreground' },
  in_progress: { icon: Clock, color: 'text-blue-600' },
  completed: { icon: CheckCircle2, color: 'text-green-600' },
  failed: { icon: XCircle, color: 'text-red-600' },
  cancelled: { icon: XCircle, color: 'text-gray-600' }
}

// Status change handlers
const handleStatusChange = async (item: QueueItem, status: QueueItemStatus) => {
  await updateItemMutation.mutateAsync({
    itemId: item.id,
    data: { status }
  })
}
```

## Visual Design Patterns

### Priority-Based Styling

```typescript
const priorityColors = {
  low: 'bg-green-500/10 text-green-700 border-green-200',
  normal: 'bg-blue-500/10 text-blue-700 border-blue-200',
  high: 'bg-orange-500/10 text-orange-700 border-orange-200',
  urgent: 'bg-red-500/10 text-red-700 border-red-200'
}

// Applied to cards based on priority
className={cn(
  'card-base',
  priority === 'urgent' && 'border-red-300 bg-red-50/50',
  priority === 'high' && 'border-orange-300 bg-orange-50/50'
)}
```

### Progress Visualization

```typescript
// Task completion progress bar
<div className="flex items-center gap-2">
  <span className="text-xs">
    {completedTaskCount} of {taskCount} tasks complete
  </span>
  <div className="flex-1 h-2 bg-gray-200 rounded-full">
    <div
      className="h-full bg-primary transition-all duration-300"
      style={{
        width: `${taskCount > 0 ? (completedTaskCount / taskCount) * 100 : 0}%`
      }}
    />
  </div>
</div>
```

### Status Indicators

```typescript
// Visual status indicators with colors and icons
<div className="flex items-center gap-2">
  <div className={cn(
    'h-2 w-2 rounded-full',
    status === 'completed' && 'bg-green-500',
    status === 'failed' && 'bg-red-500',
    status === 'in_progress' && 'bg-blue-500'
  )} />
  <span className="capitalize">{status.replace('_', ' ')}</span>
</div>
```

## Testing Strategies

### Component Testing

```typescript
// Test drag and drop behavior
describe('KanbanBoard', () => {
  it('moves items between queues', async () => {
    render(<KanbanBoard projectId={1} />)

    const ticket = screen.getByTestId('ticket-123')
    const targetQueue = screen.getByTestId('queue-456')

    await dragAndDrop(ticket, targetQueue)

    expect(mockEnqueueTicket).toHaveBeenCalledWith({
      ticketId: 123,
      queueId: 456,
      includeTasks: true
    })
  })

  it('reorders items within same queue', async () => {
    // Test intra-queue reordering logic
  })
})
```

### State Management Testing

```typescript
// Test data transformations
describe('itemsByQueue transformation', () => {
  it('groups items by queue correctly', () => {
    const flowData = mockFlowData()
    const result = transformFlowDataToKanban(flowData)

    expect(result['unqueued']).toHaveLength(3)
    expect(result['123']).toHaveLength(2)
    expect(result['123'][0].queuePosition).toBe(0)
  })
})
```

### Integration Testing

```typescript
// Test full queue workflow
describe('Queue Management Integration', () => {
  it('completes full ticket processing workflow', async () => {
    // 1. Create queue
    // 2. Enqueue ticket
    // 3. Process ticket
    // 4. Complete and verify stats
  })
})
```

## Performance Optimizations

### Memoization Patterns

```typescript
// Expensive transformations are memoized
const itemsByQueue = useMemo(() => {
  return transformFlowDataToKanban(flowData)
}, [flowData])

// Component memoization for large lists
const KanbanCard = memo(({ id, title, ...props }) => {
  // Card implementation
})
```

### Virtualization for Large Queues

```typescript
// For queues with hundreds of items
import { FixedSizeList as List } from 'react-window'

const VirtualizedQueue = ({ items }) => (
  <List
    height={600}
    itemCount={items.length}
    itemSize={80}
    itemData={items}
  >
    {({ index, style, data }) => (
      <div style={style}>
        <KanbanCard {...data[index]} />
      </div>
    )}
  </List>
)
```

### Optimistic Updates

```typescript
// Update UI immediately, rollback on error
const optimisticMutation = useMutation({
  mutationFn: updateItem,
  onMutate: async (newData) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ['items'] })

    // Snapshot previous value
    const previousItems = queryClient.getQueryData(['items'])

    // Optimistically update
    queryClient.setQueryData(['items'], (old) => updateItemInList(old, newData))

    return { previousItems }
  },
  onError: (err, newData, context) => {
    // Rollback on error
    queryClient.setQueryData(['items'], context.previousItems)
  },
  onSettled: () => {
    // Refetch to ensure consistency
    queryClient.invalidateQueries({ queryKey: ['items'] })
  }
})
```

## Accessibility Features

### Keyboard Navigation

- **Arrow Keys**: Navigate between cards
- **Enter/Space**: Select and activate cards
- **Tab**: Focus management within cards
- **Escape**: Cancel drag operations

### Screen Reader Support

```typescript
// ARIA labels and descriptions
<div
  role="button"
  tabIndex={0}
  aria-label={`${type} ${title}, priority ${priority}`}
  aria-describedby={`${id}-description`}
  {...attributes}
  {...listeners}
>
  <div id={`${id}-description`} className="sr-only">
    {type === 'ticket'
      ? `Ticket with ${taskCount} tasks, ${completedTaskCount} completed`
      : `Task from ${ticketTitle}`
    }
  </div>
</div>
```

### Focus Management

```typescript
// Manage focus during drag operations
const handleDragStart = (event: DragStartEvent) => {
  const activeElement = document.activeElement
  // Store focus to restore after drag
}

const handleDragEnd = (event: DragEndEvent) => {
  // Restore focus to appropriate element
  restoreFocus()
}
```

This comprehensive queue management system provides a modern, accessible, and performant interface for managing AI task processing with intuitive drag-and-drop operations and real-time status updates.
