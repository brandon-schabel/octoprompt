# Queue System Architecture Guide

This comprehensive guide documents the queue system architecture in Promptliano, including the flow service, queue management, task processing, and automatic ticket completion behaviors.

## System Overview

The queue system provides AI-powered task processing with automatic state management, ticket/task queueing, and completion tracking. It follows a unified flow architecture where queue state is directly attached to tickets and tasks rather than using separate queue_items tables.

## Core Architecture Components

### 1. Flow Service (`flow-service.ts`)

- **Unified Management**: Combines ticket and queue management
- **Direct State Tracking**: Queue properties stored on tickets/tasks
- **Automatic Dequeuing**: Handles completion-based dequeuing

### 2. Queue Service (`queue-service.ts`)

- **Queue Lifecycle**: Create, update, delete queues
- **Statistics**: Real-time queue metrics and performance
- **Batch Operations**: Bulk enqueue/dequeue operations

### 3. Queue State Machine (`queue-state-machine.ts`)

- **State Transitions**: Manages item status transitions
- **Valid States**: `queued`, `in_progress`, `completed`, `failed`, `cancelled`
- **Automatic Progression**: Handles state changes based on actions

### 4. Ticket Service Integration (`ticket-service.ts`)

- **Complete Ticket**: Marks tickets as closed and all tasks as done
- **Automatic Dequeue**: Removes from queues when completed
- **Queue Field Clearing**: Resets all queue-related fields

## Queue Data Model

### Ticket Queue Properties

```typescript
interface Ticket {
  // Core fields
  id: number
  title: string
  status: 'open' | 'in_progress' | 'closed'

  // Queue-related fields
  queueId?: number | null // Current queue assignment
  queuePosition?: number | null // Position within queue
  queueStatus?: string | null // Item processing status
  queuePriority?: number | null // Priority for processing (1-10)
  queuedAt?: number | null // Timestamp when queued
}
```

### Task Queue Properties

```typescript
interface TicketTask {
  // Core fields
  id: number
  ticketId: number
  content: string
  done: boolean

  // Queue-related fields (same as ticket)
  queueId?: number | null
  queuePosition?: number | null
  queueStatus?: string | null
  queuePriority?: number | null
  queuedAt?: number | null
}
```

## Complete Ticket Feature Integration

### Automatic Behaviors

When a ticket is marked as complete using the `completeTicket()` function:

1. **Status Update**: Ticket status changes to `'closed'`
2. **Task Completion**: All associated tasks are marked as `done: true`
3. **Queue Removal**: If queued, ticket is automatically dequeued
4. **Field Clearing**: All queue-related fields are set to `null`
5. **Cache Invalidation**: Queue and ticket caches are refreshed

### Implementation Details

```typescript
// In ticket-service.ts
export async function completeTicket(ticketId: number): Promise<{ ticket: Ticket; tasks: TicketTask[] }> {
  const existingTicket = await getTicketById(ticketId)

  // Step 1: Dequeue if in a queue
  if (existingTicket.queueId) {
    await ticketStorage.dequeueTicket(ticketId)
  }

  // Step 2: Update ticket status and clear queue fields
  const updatedTicket: Ticket = {
    ...existingTicket,
    status: 'closed',
    queueId: null,
    queuePosition: null,
    queueStatus: null,
    queuePriority: null,
    queuedAt: null,
    updated: Date.now()
  }

  // Step 3: Mark all tasks as done
  const tasks = await getTasks(ticketId)
  for (const task of tasks) {
    if (!task.done) {
      await ticketStorage.replaceTask({
        ...task,
        done: true,
        updated: Date.now()
      })
    }
  }

  return { ticket: updatedTicket, tasks: updatedTasks }
}
```

## Queue Operations

### Enqueue Operations

#### Single Item Enqueue

```typescript
// Enqueue a ticket
await flowService.enqueueTicket(ticketId, queueId, {
  priority: 5,
  includeTasks: true // Also enqueue all tasks
})

// Enqueue a task
await flowService.enqueueTask(taskId, queueId, {
  priority: 3
})
```

#### Batch Enqueue

```typescript
// Enqueue all tickets in a project
await queueService.enqueueProjectTickets(projectId, queueId, {
  status: 'open', // Only open tickets
  priority: 5
})
```

### Dequeue Operations

#### Manual Dequeue

```typescript
// Dequeue a ticket (and optionally its tasks)
await flowService.dequeueTicket(ticketId)

// Dequeue a task
await flowService.dequeueTask(taskId)
```

#### Automatic Dequeue Triggers

1. **Ticket Completion**: Via `completeTicket()` function
2. **Status Change**: When ticket status changes to `'closed'`
3. **Queue Clearing**: When entire queue is cleared
4. **Failed Processing**: Optional dequeue on failure

### Queue Processing

#### Get Next Item

```typescript
// AI agents pull next item from queue
const nextItem = await queueService.getNextQueueItem(queueId, {
  agentId: 'promptliano-ui-architect',
  preferredType: 'task' // Prefer tasks over tickets
})
```

#### Update Item Status

```typescript
// Mark as in progress
await queueService.updateQueueItem(itemId, {
  status: 'in_progress',
  agentId: 'backend-api-architect',
  startedAt: Date.now()
})

// Mark as completed
await queueService.updateQueueItem(itemId, {
  status: 'completed',
  completedAt: Date.now(),
  completionNotes: 'Successfully implemented feature'
})
```

## State Transitions

### Valid State Transitions

```
queued → in_progress → completed
       → in_progress → failed → queued (retry)
       → cancelled
```

### State Machine Rules

1. **Queued**: Initial state when item enters queue
2. **In Progress**: When agent starts processing
3. **Completed**: Successfully processed
   - Triggers task `done: true` if applicable
   - May trigger ticket dequeue if all tasks complete
4. **Failed**: Processing failed
   - Can be retried (back to queued)
   - Or manually resolved
5. **Cancelled**: Manually removed from processing

## Queue Statistics

### Real-time Metrics

```typescript
interface QueueStats {
  queuedItems: number // Items waiting
  inProgressItems: number // Currently processing
  completedItems: number // Successfully completed
  failedItems: number // Failed processing
  avgProcessingTime: number // Average time to complete
  successRate: number // Percentage of successful completions
  throughput: number // Items processed per hour
}
```

### Performance Tracking

```typescript
// Get queue performance metrics
const stats = await queueService.getQueueStats(queueId)

// Get project-wide queue statistics
const projectStats = await queueService.getProjectQueueStats(projectId)
```

## API Endpoints

### Queue Management

- `POST /api/queues` - Create new queue
- `GET /api/queues/:projectId` - List project queues
- `PATCH /api/queues/:queueId` - Update queue settings
- `DELETE /api/queues/:queueId` - Delete queue

### Queue Operations

- `POST /api/flow/tickets/:ticketId/enqueue` - Enqueue ticket
- `POST /api/flow/tickets/:ticketId/dequeue` - Dequeue ticket
- `POST /api/flow/tasks/:taskId/enqueue` - Enqueue task
- `POST /api/flow/tasks/:taskId/dequeue` - Dequeue task

### Ticket Completion

- `POST /api/tickets/:ticketId/complete` - Complete ticket (auto-dequeue)

### Queue Processing

- `POST /api/queues/:queueId/next` - Get next item for processing
- `PATCH /api/queue-items/:itemId` - Update item status
- `POST /api/queues/:queueId/clear` - Clear all items from queue

## MCP Tool Integration

### Queue Manager Tool

```typescript
mcp__promptliano__queue_manager(
  action: "enqueue_ticket",
  projectId: 1754713756748,
  data: {
    queueId: 123,
    ticketId: 456,
    priority: 5,
    includeTasks: true
  }
)
```

### Queue Processor Tool

```typescript
mcp__promptliano__queue_processor(
  action: "get_next_task",
  data: {
    queueId: 123,
    agentId: "promptliano-ui-architect"
  }
)

mcp__promptliano__queue_processor(
  action: "complete_task",
  data: {
    itemId: 789,
    completionNotes: "Task completed successfully"
  }
)
```

## Automatic Behaviors

### When All Tasks Complete

1. **Check Ticket Status**: If all tasks in a ticket are `done: true`
2. **Auto-Dequeue Option**: Configurable behavior to auto-dequeue ticket
3. **Status Update**: Optionally update ticket status to `'closed'`

### When Ticket Closes

1. **Cascade to Tasks**: All tasks marked as `done: true`
2. **Queue Removal**: Automatically dequeued from any queue
3. **Statistics Update**: Queue metrics updated

### Queue Priority Handling

1. **Priority Sorting**: Items processed by priority (1 = highest)
2. **FIFO Within Priority**: Same priority uses queue position
3. **Dynamic Reprioritization**: Can adjust priority while queued

## Error Handling

### Queue Operation Errors

```typescript
try {
  await flowService.enqueueTicket(ticketId, queueId)
} catch (error) {
  if (error.code === 'ALREADY_QUEUED') {
    // Item already in a queue
  } else if (error.code === 'QUEUE_FULL') {
    // Queue has reached max capacity
  } else if (error.code === 'INVALID_STATUS') {
    // Can't queue closed tickets
  }
}
```

### Recovery Strategies

1. **Retry Logic**: Failed items can be retried with backoff
2. **Dead Letter Queue**: Persistent failures moved to special queue
3. **Manual Intervention**: Failed items flagged for human review

## Performance Considerations

### Optimizations

1. **Batch Operations**: Process multiple items in single transaction
2. **Index Usage**: Queue position and priority indexed for fast queries
3. **Caching**: Queue statistics cached with TTL
4. **Pagination**: Large queues paginated for UI performance

### Scalability

1. **Queue Limits**: Configurable max items per queue
2. **Parallel Processing**: Multiple agents per queue
3. **Priority Lanes**: Separate high-priority processing
4. **Auto-Scaling**: Dynamic agent allocation based on queue depth

## Testing Queue Operations

### Unit Tests

```typescript
describe('Queue Operations', () => {
  test('completeTicket dequeues from active queue', async () => {
    // Setup: Create ticket in queue
    const ticket = await createTicket({ title: 'Test' })
    await enqueueTicket(ticket.id, queueId)

    // Action: Complete the ticket
    const result = await completeTicket(ticket.id)

    // Assert: Ticket is dequeued
    expect(result.ticket.queueId).toBeNull()
    expect(result.ticket.status).toBe('closed')
    expect(result.tasks.every((t) => t.done)).toBe(true)
  })
})
```

### Integration Tests

```typescript
describe('Queue Workflow', () => {
  test('full processing cycle', async () => {
    // 1. Create queue
    const queue = await createQueue({ name: 'Test Queue' })

    // 2. Enqueue ticket with tasks
    await enqueueTicket(ticketId, queue.id, { includeTasks: true })

    // 3. Process items
    const item = await getNextQueueItem(queue.id)
    await updateQueueItem(item.id, { status: 'in_progress' })

    // 4. Complete ticket
    await completeTicket(ticketId)

    // 5. Verify dequeue
    const stats = await getQueueStats(queue.id)
    expect(stats.queuedItems).toBe(0)
  })
})
```

## Best Practices

### Queue Design

1. **Separate by Type**: Different queues for different work types
2. **Priority Lanes**: High-priority items in dedicated queues
3. **Agent Specialization**: Match queue types to agent capabilities
4. **Batch Size**: Optimal batch sizes for processing efficiency

### Error Recovery

1. **Graceful Degradation**: Continue processing other items on failure
2. **Retry Limits**: Maximum retry attempts before manual intervention
3. **Logging**: Comprehensive logging for debugging
4. **Monitoring**: Real-time queue depth and processing rate alerts

### Performance Monitoring

1. **Queue Depth**: Monitor for backing up
2. **Processing Rate**: Track throughput trends
3. **Error Rate**: Alert on high failure rates
4. **Agent Utilization**: Balance load across agents

## Summary

The queue system provides a robust, scalable solution for AI-powered task processing with automatic state management and seamless integration with the ticket system. The automatic dequeuing on ticket completion ensures data consistency and prevents orphaned queue items. The unified flow architecture simplifies state tracking by storing queue properties directly on tickets and tasks, eliminating the complexity of separate queue_items tables while maintaining full queue functionality.
