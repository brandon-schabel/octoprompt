# Queue Field Utilities

This module provides type-safe utilities for managing queue-related fields in tickets and tasks, preventing null vs undefined bugs that can occur when clearing or updating queue state.

## Problem Solved

Before this utility, queue field management was prone to inconsistencies:

```typescript
// PROBLEMATIC - mixing null and undefined
const badUpdate = {
  queueId: null,           // null
  queueStatus: undefined,  // undefined  
  queuePriority: null      // null
}

// This could cause runtime errors and type safety issues
```

## Solution

The queue field utilities ensure consistent, type-safe handling:

```typescript
import { 
  clearQueueFields,
  createEnqueueUpdate,
  createStartProcessingUpdate,
  createCompleteProcessingUpdate,
  isQueued,
  isInProgress,
  isCompleted
} from '@promptliano/shared'

// SAFE - consistent undefined usage
const goodUpdate = clearQueueFields()
// All fields are consistently undefined
```

## Core Functions

### `clearQueueFields()`

Clears all queue fields by setting them to `undefined`:

```typescript
// Clear all queue fields when dequeuing
const clearedFields = clearQueueFields()
await ticketStorage.updateTicket(ticketId, clearedFields)

// Partial clearing with additional updates
const updates = {
  ...clearQueueFields(),
  status: 'closed' as const
}
await ticketStorage.updateTicket(ticketId, updates)
```

### `createEnqueueUpdate(queueId, priority?)`

Creates a proper enqueue update with all necessary fields:

```typescript
// Enqueue with priority 5
const enqueueUpdate = createEnqueueUpdate(123, 5)
await ticketStorage.updateTicket(ticketId, enqueueUpdate)

// Default priority (0)
const defaultPriorityUpdate = createEnqueueUpdate(123)
```

### `createStartProcessingUpdate(agentId?)`

Creates an update for starting item processing:

```typescript
// Start processing with agent
const startProcessing = createStartProcessingUpdate('ai-agent-1')
await ticketStorage.updateTicket(ticketId, startProcessing)

// Start processing without specific agent
const startGeneric = createStartProcessingUpdate()
```

### `createCompleteProcessingUpdate(success, errorMessage?)`

Creates an update for completing item processing:

```typescript
// Successful completion
const completeUpdate = createCompleteProcessingUpdate(true)
await ticketStorage.updateTicket(ticketId, completeUpdate)

// Failed completion with error
const failUpdate = createCompleteProcessingUpdate(false, 'Validation failed')
await ticketStorage.updateTask(ticketId, taskId, failUpdate)
```

## Helper Functions

### State Checking

```typescript
// Check if item is queued
if (isQueued(ticket)) {
  console.log(`Ticket is in queue ${ticket.queueId}`)
}

// Check if item is being processed
if (isInProgress(task)) {
  console.log(`Task is being processed by ${task.queueAgentId}`)
}

// Check if item has completed
if (isCompleted(ticket)) {
  const duration = getProcessingDuration(ticket)
  console.log(`Ticket completed in ${duration}ms`)
}
```

### Processing Duration

```typescript
const duration = getProcessingDuration(task)
if (duration !== null) {
  console.log(`Task took ${duration / 1000} seconds to complete`)
}
```

## Type Safety Features

- **Consistent undefined usage**: Never mixes null and undefined
- **Strong typing**: All functions are fully typed with TypeScript
- **Schema compatibility**: Works with existing Zod schemas
- **Storage layer compatibility**: Handles database null/undefined conversion

## Usage in Services

The queue service has been updated to use these utilities:

```typescript
// Before (manual field clearing - error prone)
const updatedTicket = await ticketStorage.updateTicket(ticketId, {
  queueId: undefined,
  queueStatus: undefined,
  queuePriority: undefined,
  // ... many more fields
})

// After (type-safe utility)
const updatedTicket = await ticketStorage.updateTicket(ticketId, clearQueueFields())
```

## Benefits

1. **Prevents runtime errors** from null/undefined inconsistencies
2. **Improves maintainability** with centralized queue field logic
3. **Enhances type safety** with strong TypeScript typing
4. **Reduces code duplication** across queue operations
5. **Provides clear documentation** of null vs undefined usage

## Testing

Comprehensive tests ensure reliability:
- Unit tests for all utility functions
- Type safety validation
- Integration with real data structures
- Edge case handling

Run tests with:
```bash
bun test packages/shared/src/utils/queue-field-utils.test.ts
```