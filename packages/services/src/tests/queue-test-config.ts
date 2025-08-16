/**
 * Queue Test Configuration
 * 
 * This file documents the CI/test environment improvements made to the queue tests
 * to ensure reliable execution in both local development and CI environments.
 */

import { randomBytes } from 'crypto'

/**
 * Test environment configuration that adapts based on execution context
 */
export const getTestConfig = () => {
  const isCI = process.env.CI === 'true' || process.env.NODE_ENV === 'test'
  
  return {
    // Environment detection
    isCI,
    
    // Timeouts adapted for CI environment
    testTimeout: isCI ? 15000 : 10000,          // Per-test timeout
    asyncWaitTime: isCI ? 100 : 50,             // Delay between async operations
    cleanupWaitTime: isCI ? 200 : 100,          // Extra cleanup delay
    
    // Test data isolation
    generateSuiteId: () => randomBytes(6).toString('hex'),
    generateResourceId: () => randomBytes(4).toString('hex'),
    
    // Resource cleanup configuration
    enableVerboseCleanup: isCI,                 // More detailed cleanup in CI
    enforceStrictIsolation: true,               // Always enforce test isolation
  }
}

/**
 * Test resource manager for tracking and cleaning up test artifacts
 */
export class TestResourceManager {
  private resources: Array<{ type: 'project' | 'ticket' | 'task' | 'queue', id: number }> = []
  private config = getTestConfig()
  
  /**
   * Track a resource for cleanup
   */
  track(type: 'project' | 'ticket' | 'task' | 'queue', id: number): void {
    this.resources.push({ type, id })
  }
  
  /**
   * Clean up all tracked resources in proper order
   */
  async cleanup(): Promise<void> {
    // Clean up in reverse order to avoid foreign key constraints
    for (const resource of this.resources.reverse()) {
      try {
        switch (resource.type) {
          case 'queue':
            const { deleteQueue } = await import('../queue-service')
            await deleteQueue(resource.id).catch(() => {})
            break
          case 'project':
            const { deleteProject } = await import('../project-service')
            await deleteProject(resource.id).catch(() => {})
            break
          // Tickets and tasks are cleaned up via cascading deletes
        }
      } catch (error) {
        if (this.config.enableVerboseCleanup) {
          console.warn(`Failed to cleanup ${resource.type} ${resource.id}:`, error)
        }
        // Ignore cleanup errors - database reset will handle remaining items
      }
    }
    
    // Add delay in CI to prevent race conditions between tests
    if (this.config.isCI) {
      await new Promise(resolve => setTimeout(resolve, this.config.cleanupWaitTime))
    }
    
    // Reset tracking
    this.resources = []
  }
  
  /**
   * Get count of tracked resources
   */
  getTrackedCount(): number {
    return this.resources.length
  }
}

/**
 * Async operation helper that adds appropriate delays for CI environments
 */
export class AsyncOperationHelper {
  private config = getTestConfig()
  
  /**
   * Wait for database operation to be committed (especially important in CI)
   */
  async waitForCommit(): Promise<void> {
    if (this.config.isCI) {
      await new Promise(resolve => setTimeout(resolve, this.config.asyncWaitTime))
    }
  }
  
  /**
   * Wait for multiple database operations to be committed
   */
  async waitForMultipleCommits(count: number = 2): Promise<void> {
    if (this.config.isCI) {
      await new Promise(resolve => setTimeout(resolve, this.config.asyncWaitTime * count))
    }
  }
  
  /**
   * Wait between test iterations (for loops creating multiple resources)
   */
  async waitBetweenIterations(): Promise<void> {
    if (this.config.isCI) {
      await new Promise(resolve => setTimeout(resolve, this.config.asyncWaitTime / 2))
    }
  }
}

/**
 * Test naming helper for unique resource names
 */
export class TestNamingHelper {
  private suiteId: string
  
  constructor(suiteId?: string) {
    this.suiteId = suiteId || getTestConfig().generateSuiteId()
  }
  
  /**
   * Generate a unique name for a test resource
   */
  generateName(baseName: string, resourceType?: string): string {
    const resourceId = getTestConfig().generateResourceId()
    const suffix = resourceType ? `-${resourceType}` : ''
    return `${baseName} ${this.suiteId}-${resourceId}${suffix}`
  }
  
  /**
   * Generate a unique agent ID for queue processing tests
   */
  generateAgentId(baseName: string = 'agent'): string {
    const resourceId = getTestConfig().generateResourceId()
    return `${baseName}-${this.suiteId}-${resourceId}`
  }
  
  /**
   * Generate a unique project path
   */
  generateProjectPath(baseName: string = 'test'): string {
    const resourceId = getTestConfig().generateResourceId()
    return `/test/${baseName}-${this.suiteId}-${resourceId}`
  }
}

/**
 * CI-specific test improvements implemented:
 * 
 * 1. **Database isolation**: Complete database reset between tests with proper cleanup
 * 2. **Timing robustness**: CI-aware delays for async operations and commits
 * 3. **Resource tracking**: Systematic tracking and cleanup of test resources
 * 4. **Unique identifiers**: Cryptographically unique test data to prevent conflicts
 * 5. **Error resilience**: Graceful handling of cleanup failures with fallback mechanisms
 * 6. **Environment adaptation**: Different timeouts and behaviors for CI vs local
 * 7. **Parallel safety**: Resource isolation prevents conflicts in parallel test execution
 * 
 * Key patterns implemented:
 * - Use `randomBytes()` for truly unique test identifiers
 * - Add delays after database operations in CI environments
 * - Track all created resources for proper cleanup
 * - Use proper test timeouts (15s for CI, 10s for local)
 * - Implement graceful error handling in cleanup operations
 * - Reset database instance completely in afterAll hooks
 */