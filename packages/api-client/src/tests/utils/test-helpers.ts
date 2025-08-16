import { expect } from 'bun:test'
import type { PromptlianoClient } from '@promptliano/api-client'
import { createPromptlianoClient } from '@promptliano/api-client'
import type { TestEnvironment } from '../test-environment'

/**
 * Common assertion helpers for API responses
 */
export const assertions = {
  /**
   * Asserts that an API response has the expected success structure
   */
  assertSuccessResponse<T>(response: any, expectedDataShape?: Partial<T>): asserts response is { success: true; data: T } {
    expect(response).toBeDefined()
    expect(response.success).toBe(true)
    expect(response.data).toBeDefined()
    
    if (expectedDataShape) {
      Object.keys(expectedDataShape).forEach(key => {
        expect(response.data).toHaveProperty(key)
      })
    }
  },

  /**
   * Asserts that an API response has the expected error structure
   */
  assertErrorResponse(response: any, expectedStatus?: number, expectedCode?: string): asserts response is { success: false; error: any } {
    expect(response).toBeDefined()
    expect(response.success).toBe(false)
    expect(response.error).toBeDefined()
    expect(response.error.message).toBeDefined()
    expect(typeof response.error.message).toBe('string')
    
    if (expectedCode) {
      expect(response.error.code).toBe(expectedCode)
    }
  },

  /**
   * Asserts that a value is a valid timestamp
   */
  assertValidTimestamp(value: any): asserts value is number {
    expect(value).toBeTypeOf('number')
    expect(value).toBeGreaterThan(0)
    expect(value).toBeLessThan(Date.now() + 60000) // Within 1 minute of now
  },

  /**
   * Asserts that a value is a valid ID (positive integer)
   */
  assertValidId(value: any): asserts value is number {
    expect(value).toBeTypeOf('number')
    expect(value).toBeGreaterThan(0)
    expect(Number.isInteger(value)).toBe(true)
  },

  /**
   * Asserts that an array contains items with expected structure
   */
  assertArrayOfItems<T>(array: any, minLength = 0, itemShape?: Partial<T>): asserts array is T[] {
    expect(Array.isArray(array)).toBe(true)
    expect(array.length).toBeGreaterThanOrEqual(minLength)
    
    if (itemShape && array.length > 0) {
      Object.keys(itemShape).forEach(key => {
        expect(array[0]).toHaveProperty(key)
      })
    }
  },

  /**
   * Asserts that a ticket has the expected structure
   */
  assertValidTicket(ticket: any): asserts ticket is {
    id: number
    title: string
    overview: string
    status: string
    priority: string
    projectId: number
    created: number
    updated: number
  } {
    expect(ticket).toBeDefined()
    this.assertValidId(ticket.id)
    expect(ticket.title).toBeTypeOf('string')
    expect(ticket.overview).toBeTypeOf('string')
    expect(ticket.status).toBeTypeOf('string')
    expect(ticket.priority).toBeTypeOf('string')
    this.assertValidId(ticket.projectId)
    this.assertValidTimestamp(ticket.created)
    this.assertValidTimestamp(ticket.updated)
  },

  /**
   * Asserts that a task has the expected structure
   */
  assertValidTask(task: any): asserts task is {
    id: number
    content: string
    description?: string
    done: boolean
    ticketId: number
    order: number
    createdAt: number
    updatedAt: number
  } {
    expect(task).toBeDefined()
    this.assertValidId(task.id)
    expect(task.content).toBeTypeOf('string')
    expect(task.done).toBeTypeOf('boolean')
    this.assertValidId(task.ticketId)
    expect(task.order).toBeTypeOf('number')
    this.assertValidTimestamp(task.createdAt)
    this.assertValidTimestamp(task.updatedAt)
  },

  /**
   * Asserts that a queue has the expected structure
   */
  assertValidQueue(queue: any): asserts queue is {
    id: number
    name: string
    description: string
    maxParallelItems: number
    projectId: number
    created: number
    updated: number
  } {
    expect(queue).toBeDefined()
    this.assertValidId(queue.id)
    expect(queue.name).toBeTypeOf('string')
    expect(queue.description).toBeTypeOf('string')
    expect(queue.maxParallelItems).toBeTypeOf('number')
    this.assertValidId(queue.projectId)
    this.assertValidTimestamp(queue.created)
    this.assertValidTimestamp(queue.updated)
  },

  /**
   * Asserts that a queue item has the expected structure
   */
  assertValidQueueItem(queueItem: any): asserts queueItem is {
    id: number
    queueId: number
    itemType: 'ticket' | 'task'
    itemId: number
    priority: number
    status: string
    createdAt: number
    updatedAt: number
  } {
    expect(queueItem).toBeDefined()
    this.assertValidId(queueItem.id)
    this.assertValidId(queueItem.queueId)
    expect(['ticket', 'task']).toContain(queueItem.itemType)
    this.assertValidId(queueItem.itemId)
    expect(queueItem.priority).toBeTypeOf('number')
    expect(queueItem.status).toBeTypeOf('string')
    this.assertValidTimestamp(queueItem.createdAt)
    this.assertValidTimestamp(queueItem.updatedAt)
  },

  /**
   * Asserts that queue stats have the expected structure
   */
  assertValidQueueStats(stats: any): asserts stats is {
    totalItems: number
    pendingItems: number
    inProgressItems: number
    completedItems: number
    failedItems: number
    estimatedCompletionTime?: number
  } {
    expect(stats).toBeDefined()
    expect(stats.totalItems).toBeTypeOf('number')
    expect(stats.pendingItems).toBeTypeOf('number')
    expect(stats.inProgressItems).toBeTypeOf('number')
    expect(stats.completedItems).toBeTypeOf('number')
    expect(stats.failedItems).toBeTypeOf('number')
    
    if (stats.estimatedCompletionTime !== undefined) {
      expect(stats.estimatedCompletionTime).toBeTypeOf('number')
    }
  },

  /**
   * Asserts that a job has the expected structure
   */
  assertValidJob(job: any): asserts job is {
    id: number
    type: string
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
    priority: 'low' | 'normal' | 'high'
    projectId?: number
    userId?: string
    input: Record<string, any>
    result?: Record<string, any>
    error?: { message: string; code?: string; details?: any }
    progress?: { current: number; total: number; message?: string }
    metadata?: Record<string, any>
    createdAt: number
    startedAt?: number
    completedAt?: number
    updatedAt: number
    timeoutMs?: number
    maxRetries: number
    retryCount: number
    retryDelayMs: number
  } {
    expect(job).toBeDefined()
    this.assertValidId(job.id)
    expect(job.type).toBeTypeOf('string')
    expect(['pending', 'running', 'completed', 'failed', 'cancelled']).toContain(job.status)
    expect(['low', 'normal', 'high']).toContain(job.priority)
    expect(job.input).toBeTypeOf('object')
    expect(job.maxRetries).toBeTypeOf('number')
    expect(job.retryCount).toBeTypeOf('number')
    expect(job.retryDelayMs).toBeTypeOf('number')
    this.assertValidTimestamp(job.createdAt)
    this.assertValidTimestamp(job.updatedAt)
    
    if (job.projectId !== undefined) {
      this.assertValidId(job.projectId)
    }
    
    if (job.startedAt !== undefined) {
      this.assertValidTimestamp(job.startedAt)
    }
    
    if (job.completedAt !== undefined) {
      this.assertValidTimestamp(job.completedAt)
    }
    
    if (job.result !== undefined) {
      expect(job.result).toBeTypeOf('object')
    }
    
    if (job.error !== undefined) {
      expect(job.error).toBeTypeOf('object')
      expect(job.error.message).toBeTypeOf('string')
    }
    
    if (job.progress !== undefined) {
      expect(job.progress).toBeTypeOf('object')
      expect(job.progress.current).toBeTypeOf('number')
      expect(job.progress.total).toBeTypeOf('number')
    }
  },

  /**
   * Asserts that job statistics have the expected structure
   */
  assertValidJobStats(stats: any): asserts stats is {
    total: number
    byStatus: Record<string, number>
    byType: Record<string, number>
    byPriority: Record<string, number>
    avgDurationMs?: number
    oldestPendingJob?: {
      id: number
      createdAt: number
      ageMs: number
    }
  } {
    expect(stats).toBeDefined()
    expect(stats.total).toBeTypeOf('number')
    expect(stats.byStatus).toBeTypeOf('object')
    expect(stats.byType).toBeTypeOf('object')
    expect(stats.byPriority).toBeTypeOf('object')
    
    if (stats.avgDurationMs !== undefined) {
      expect(stats.avgDurationMs).toBeTypeOf('number')
    }
    
    if (stats.oldestPendingJob !== undefined) {
      expect(stats.oldestPendingJob).toBeTypeOf('object')
      this.assertValidId(stats.oldestPendingJob.id)
      this.assertValidTimestamp(stats.oldestPendingJob.createdAt)
      expect(stats.oldestPendingJob.ageMs).toBeTypeOf('number')
    }
  }
}

/**
 * Test data factories for creating consistent test data
 */
export const factories = {
  /**
   * Creates test project data
   */
  createProjectData(overrides: Partial<{
    name: string
    description: string
    path: string
  }> = {}) {
    const timestamp = Date.now()
    return {
      name: `Test Project ${timestamp}`,
      description: `Test project created at ${new Date().toISOString()}`,
      path: `/tmp/test-project-${timestamp}`,
      ...overrides
    }
  },

  /**
   * Creates test chat data
   */
  createChatData(overrides: Partial<{
    title: string
    projectId: number
  }> = {}) {
    const timestamp = Date.now()
    return {
      title: `Test Chat ${timestamp}`,
      ...overrides
    }
  },

  /**
   * Creates test ticket data
   */
  createTicketData(overrides: Partial<{
    title: string
    overview: string
    projectId: number
    priority: string
  }> = {}) {
    const timestamp = Date.now()
    return {
      title: `Test Ticket ${timestamp}`,
      overview: `Test ticket created at ${new Date().toISOString()}`,
      priority: 'normal',
      ...overrides
    }
  },

  /**
   * Creates test prompt data
   */
  createPromptData(overrides: Partial<{
    title: string
    content: string
    projectId: number
  }> = {}) {
    const timestamp = Date.now()
    return {
      title: `Test Prompt ${timestamp}`,
      content: `This is a test prompt created at ${new Date().toISOString()}`,
      ...overrides
    }
  },

  /**
   * Creates test provider key data
   */
  createProviderKeyData(overrides: Partial<{
    provider: string
    keyValue: string
    name: string
  }> = {}) {
    const timestamp = Date.now()
    return {
      provider: 'openai',
      keyValue: `test-key-${timestamp}`,
      name: `Test Key ${timestamp}`,
      ...overrides
    }
  },

  /**
   * Creates test queue data
   */
  createQueueData(overrides: Partial<{
    name: string
    description: string
    maxParallelItems: number
    priority: number
  }> = {}) {
    const timestamp = Date.now()
    return {
      name: `Test Queue ${timestamp}`,
      description: `Test queue created at ${new Date().toISOString()}`,
      maxParallelItems: 3,
      priority: 1,
      ...overrides
    }
  },

  /**
   * Creates test task data
   */
  createTaskData(overrides: Partial<{
    content: string
    description: string
    estimatedHours: number
    tags: string[]
    priority: number
  }> = {}) {
    const timestamp = Date.now()
    return {
      content: `Test Task ${timestamp}`,
      description: `Test task created at ${new Date().toISOString()}`,
      estimatedHours: 2,
      tags: ['test'],
      priority: 3,
      ...overrides
    }
  },

  /**
   * Creates enqueue item data
   */
  createEnqueueItemData(overrides: Partial<{
    type: 'ticket' | 'task'
    itemId: number
    priority: number
  }> = {}) {
    return {
      type: 'ticket' as const,
      itemId: 1,
      priority: 5,
      ...overrides
    }
  },

  /**
   * Creates test job data
   */
  createJobData(overrides: Partial<{
    type: string
    priority: 'low' | 'normal' | 'high'
    projectId: number
    userId: string
    input: Record<string, any>
    metadata: Record<string, any>
    timeoutMs: number
    maxRetries: number
    retryDelayMs: number
  }> = {}) {
    const timestamp = Date.now()
    return {
      type: `test-job-${timestamp}`,
      priority: 'normal' as const,
      input: { 
        action: 'test-action',
        timestamp,
        data: `Test job data ${timestamp}`
      },
      metadata: {
        source: 'test-factory',
        created: new Date().toISOString()
      },
      maxRetries: 0,
      retryDelayMs: 1000,
      ...overrides
    }
  }
}

/**
 * Cleanup utilities for managing test data
 */
export class TestDataManager {
  private createdEntities: Array<{
    type: string
    id: number
    deleteFunction: () => Promise<void>
  }> = []

  constructor(private client: PromptlianoClient) {}

  /**
   * Tracks an entity for cleanup
   */
  track<T extends { id: number }>(
    type: string,
    entity: T,
    deleteFunction: () => Promise<void>
  ): T {
    this.createdEntities.push({
      type,
      id: entity.id,
      deleteFunction
    })
    return entity
  }

  /**
   * Creates and tracks a project
   */
  async createProject(data = factories.createProjectData()) {
    const result = await this.client.projects.createProject(data)
    assertions.assertSuccessResponse(result)
    
    return this.track('project', result.data, async () => {
      try {
        await this.client.projects.deleteProject(result.data.id)
      } catch (error) {
        // Ignore 404 errors (already deleted)
        if (!(error instanceof Error && error.message.includes('404'))) {
          console.warn(`Failed to cleanup project ${result.data.id}:`, error)
        }
      }
    })
  }

  /**
   * Creates and tracks a chat
   */
  async createChat(data = factories.createChatData()) {
    const result = await this.client.chats.createChat(data)
    assertions.assertSuccessResponse(result)
    
    return this.track('chat', result.data, async () => {
      try {
        await this.client.chats.deleteChat(result.data.id)
      } catch (error) {
        if (!(error instanceof Error && error.message.includes('404'))) {
          console.warn(`Failed to cleanup chat ${result.data.id}:`, error)
        }
      }
    })
  }

  /**
   * Creates and tracks a ticket
   */
  async createTicket(data = factories.createTicketData()) {
    const result = await this.client.tickets.createTicket(data)
    assertions.assertSuccessResponse(result)
    
    return this.track('ticket', result.data, async () => {
      try {
        await this.client.tickets.deleteTicket(result.data.id)
      } catch (error) {
        if (!(error instanceof Error && error.message.includes('404'))) {
          console.warn(`Failed to cleanup ticket ${result.data.id}:`, error)
        }
      }
    })
  }

  /**
   * Creates and tracks a queue
   */
  async createQueue(projectId: number, data = factories.createQueueData()) {
    const result = await this.client.queues.createQueue(projectId, data)
    assertions.assertSuccessResponse(result)
    
    return this.track('queue', result.data, async () => {
      try {
        await this.client.queues.deleteQueue(result.data.id)
      } catch (error) {
        if (!(error instanceof Error && error.message.includes('404'))) {
          console.warn(`Failed to cleanup queue ${result.data.id}:`, error)
        }
      }
    })
  }

  /**
   * Creates and tracks a task for a ticket
   */
  async createTask(ticketId: number, data = factories.createTaskData()) {
    const result = await this.client.tickets.createTask(ticketId, data)
    assertions.assertSuccessResponse(result)
    
    return this.track('task', result.data, async () => {
      try {
        await this.client.tickets.deleteTask(ticketId, result.data.id)
      } catch (error) {
        if (!(error instanceof Error && error.message.includes('404'))) {
          console.warn(`Failed to cleanup task ${result.data.id}:`, error)
        }
      }
    })
  }

  /**
   * Creates and tracks a job
   */
  async createJob(data = factories.createJobData()) {
    const result = await this.client.jobs.createJob(data)
    assertions.assertSuccessResponse(result)
    
    return this.track('job', result.data, async () => {
      try {
        await this.client.jobs.deleteJob(result.data.id)
      } catch (error) {
        if (!(error instanceof Error && error.message.includes('404'))) {
          console.warn(`Failed to cleanup job ${result.data.id}:`, error)
        }
      }
    })
  }

  /**
   * Creates and tracks a prompt
   */
  async createPrompt(name: string, content: string) {
    const result = await this.client.prompts.createPrompt({
      name,
      content
    })
    assertions.assertSuccessResponse(result)
    
    return this.track('prompt', result.data, async () => {
      try {
        await this.client.prompts.deletePrompt(result.data.id)
      } catch (error) {
        if (!(error instanceof Error && error.message.includes('404'))) {
          console.warn(`Failed to cleanup prompt ${result.data.id}:`, error)
        }
      }
    })
  }

  /**
   * Convenience method for creating test prompts
   */
  async createTestPrompt(name: string, content: string) {
    return this.createPrompt(name, content)
  }

  /**
   * Convenience method for creating test projects
   */
  async createTestProject(name: string, description?: string) {
    return this.createProject({ 
      name, 
      description: description || `Test project: ${name}`,
      path: `/tmp/test-${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`
    })
  }

  /**
   * Creates and tracks multiple entities for comprehensive testing
   */
  async createFlowTestData() {
    // Create project first
    const project = await this.createProject()
    
    // Create tickets with proper projectId
    const ticket1 = await this.createTicket(factories.createTicketData({ 
      projectId: project.id,
      title: 'Flow Test Ticket 1',
      priority: 'high'
    }))
    
    const ticket2 = await this.createTicket(factories.createTicketData({ 
      projectId: project.id,
      title: 'Flow Test Ticket 2',
      priority: 'normal'
    }))
    
    // Create tasks for tickets
    const task1 = await this.createTask(ticket1.id, factories.createTaskData({
      content: 'Task 1 for Ticket 1',
      estimatedHours: 3
    }))
    
    const task2 = await this.createTask(ticket1.id, factories.createTaskData({
      content: 'Task 2 for Ticket 1',
      estimatedHours: 1
    }))
    
    const task3 = await this.createTask(ticket2.id, factories.createTaskData({
      content: 'Task 1 for Ticket 2',
      estimatedHours: 2
    }))
    
    // Create queue
    const queue = await this.createQueue(project.id, factories.createQueueData({
      name: 'Flow Test Queue',
      maxParallelItems: 2
    }))
    
    return {
      project,
      tickets: [ticket1, ticket2],
      tasks: [task1, task2, task3],
      queue
    }
  }

  /**
   * Cleanup all tracked entities
   */
  async cleanup(): Promise<void> {
    const errors: Error[] = []

    // Cleanup in reverse order (last created, first deleted)
    for (const entity of this.createdEntities.reverse()) {
      try {
        await entity.deleteFunction()
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)))
      }
    }

    this.createdEntities.length = 0

    if (errors.length > 0) {
      console.warn(`Cleanup completed with ${errors.length} errors:`)
      errors.forEach((error, index) => {
        console.warn(`  ${index + 1}. ${error.message}`)
      })
    }
  }

  /**
   * Gets summary of tracked entities
   */
  getSummary(): Record<string, number> {
    const summary: Record<string, number> = {}
    for (const entity of this.createdEntities) {
      summary[entity.type] = (summary[entity.type] || 0) + 1
    }
    return summary
  }
}

/**
 * Retry utility for flaky operations
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number
    delay?: number
    backoff?: boolean
    shouldRetry?: (error: any) => boolean
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    delay = 1000,
    backoff = true,
    shouldRetry = () => true
  } = options

  let lastError: any
  let currentDelay = delay

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error

      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, currentDelay))

      // Increase delay for backoff
      if (backoff) {
        currentDelay *= 2
      }
    }
  }

  throw lastError
}

/**
 * Waits for a condition to be true
 */
export async function waitFor(
  condition: () => Promise<boolean> | boolean,
  options: {
    timeout?: number
    interval?: number
    message?: string
  } = {}
): Promise<void> {
  const {
    timeout = 5000,
    interval = 100,
    message = 'Condition not met within timeout'
  } = options

  const start = Date.now()

  while (Date.now() - start < timeout) {
    if (await condition()) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, interval))
  }

  throw new Error(message)
}

/**
 * Performance measurement utility
 */
export class PerformanceTracker {
  private measurements: Record<string, number[]> = {}

  /**
   * Measures the execution time of an operation
   */
  async measure<T>(name: string, operation: () => Promise<T>): Promise<T> {
    const start = performance.now()
    try {
      return await operation()
    } finally {
      const duration = performance.now() - start
      if (!this.measurements[name]) {
        this.measurements[name] = []
      }
      this.measurements[name].push(duration)
    }
  }

  /**
   * Gets statistics for a measurement
   */
  getStats(name: string): {
    count: number
    min: number
    max: number
    avg: number
    total: number
  } | null {
    const times = this.measurements[name]
    if (!times || times.length === 0) {
      return null
    }

    return {
      count: times.length,
      min: Math.min(...times),
      max: Math.max(...times),
      avg: times.reduce((sum, time) => sum + time, 0) / times.length,
      total: times.reduce((sum, time) => sum + time, 0)
    }
  }

  /**
   * Prints performance summary
   */
  printSummary(): void {
    console.log('📊 Performance Summary:')
    for (const [name, times] of Object.entries(this.measurements)) {
      const stats = this.getStats(name)
      if (stats) {
        console.log(`  ${name}:`)
        console.log(`    Count: ${stats.count}`)
        console.log(`    Average: ${stats.avg.toFixed(2)}ms`)
        console.log(`    Min: ${stats.min.toFixed(2)}ms`)
        console.log(`    Max: ${stats.max.toFixed(2)}ms`)
        console.log(`    Total: ${stats.total.toFixed(2)}ms`)
      }
    }
  }

  /**
   * Resets all measurements
   */
  reset(): void {
    this.measurements = {}
  }
}

/**
 * Test setup and teardown helper
 */
export async function withTestData<T>(
  testEnv: TestEnvironment,
  testFn: (dataManager: TestDataManager) => Promise<T>
): Promise<T> {
  const client = createPromptlianoClient({ baseUrl: testEnv.baseUrl })
  const dataManager = new TestDataManager(client)

  try {
    return await testFn(dataManager)
  } finally {
    await dataManager.cleanup()
  }
}

/**
 * Creates a Promptliano client (re-export for convenience)
 */
export { createPromptlianoClient } from '@promptliano/api-client'

/**
 * Common test patterns
 */
export const patterns = {
  /**
   * Tests CRUD operations for an entity
   */
  async testCrudOperations<TEntity, TCreate, TUpdate>(
    entityName: string,
    operations: {
      create: (data: TCreate) => Promise<{ success: true; data: TEntity }>
      read: (id: number) => Promise<{ success: true; data: TEntity }>
      update: (id: number, data: TUpdate) => Promise<{ success: true; data: TEntity }>
      delete: (id: number) => Promise<void>
      list: () => Promise<{ success: true; data: TEntity[] }>
    },
    testData: {
      create: TCreate
      update: TUpdate
    }
  ) {
    // Test Create
    const createResult = await operations.create(testData.create)
    assertions.assertSuccessResponse(createResult)
    const createdEntity = createResult.data
    assertions.assertValidId((createdEntity as any).id)

    // Test Read
    const readResult = await operations.read((createdEntity as any).id)
    assertions.assertSuccessResponse(readResult)
    expect(readResult.data).toEqual(createdEntity)

    // Test Update
    const updateResult = await operations.update((createdEntity as any).id, testData.update)
    assertions.assertSuccessResponse(updateResult)
    const updatedEntity = updateResult.data
    expect((updatedEntity as any).id).toBe((createdEntity as any).id)

    // Test List (should include our entity)
    const listResult = await operations.list()
    assertions.assertSuccessResponse(listResult)
    assertions.assertArrayOfItems(listResult.data, 1)
    const foundEntity = listResult.data.find((item: any) => item.id === (createdEntity as any).id)
    expect(foundEntity).toBeDefined()

    // Test Delete
    await operations.delete((createdEntity as any).id)

    // Verify deletion
    try {
      await operations.read((createdEntity as any).id)
      throw new Error(`${entityName} should have been deleted`)
    } catch (error) {
      // Expect 404 error
      expect(error instanceof Error).toBe(true)
      expect(error.message).toContain('404')
    }
  }
}