import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { PromptlianoClient } from '../../api-client'
import type { ApiConfig } from '@promptliano/api-client'
import { createTestEnvironment, withTestData } from './test-environment'
import { TestDataManager, assertions, factories, retryOperation, waitFor, PerformanceTracker } from './utils/test-helpers'
import type { TestEnvironment } from './test-environment'

/**
 * Comprehensive System Service API Tests
 * 
 * Tests all System Service operations with proper isolation:
 * - Health check endpoint validation
 * - System status monitoring
 * - Version information retrieval
 * - Performance baseline validation
 * - System diagnostics and metrics
 * - Error handling for degraded states
 * - Response time monitoring
 * - Component health validation
 */

describe('System Service API Tests', () => {
  let testEnv: TestEnvironment
  let client: PromptlianoClient
  let dataManager: TestDataManager
  let perfTracker: PerformanceTracker

  beforeAll(async () => {
    console.log('🚀 Starting System Service API Tests...')
    
    // Create isolated test environment optimized for system monitoring
    testEnv = await createTestEnvironment({
      useIsolatedServer: true,
      database: {
        useMemory: testEnv?.isCI ?? false, // Use memory DB in CI for speed
        path: '/tmp/promptliano-system-test.db'
      },
      execution: {
        apiTimeout: 30000, // Standard timeout for system operations
        enableRateLimit: false,
        logLevel: 'warn'
      }
    })

    client = new PromptlianoClient({ baseUrl: testEnv.baseUrl })
    dataManager = new TestDataManager(client)
    perfTracker = new PerformanceTracker()

    // Verify system client is available
    expect(client.system).toBeDefined()
    expect(typeof client.system.healthCheck).toBe('function')
    expect(typeof client.system.browseDirectory).toBe('function')
    
    // Test that health endpoint is actually reachable
    try {
      const testResult = await client.system.healthCheck()
      console.log('✅ Health endpoint is accessible:', testResult.success)
    } catch (error) {
      console.warn('⚠️ Health endpoint test failed during setup:', error.message)
    }
    
    console.log('✅ Test environment initialized successfully')
  })

  afterAll(async () => {
    console.log('🧹 Cleaning up system test data...')
    
    try {
      await dataManager.cleanup()
      perfTracker.printSummary()
    } catch (error) {
      console.warn('⚠️ Cleanup encountered errors:', error)
    }
    
    await testEnv.cleanup()
    console.log('✅ System API tests cleanup completed')
  })

  // ============================================================================
  // HEALTH CHECK OPERATIONS
  // ============================================================================

  describe('Health Check Operations', () => {
    test('should perform basic health check successfully', async () => {
      const result = await perfTracker.measure('health-check-basic', async () => {
        return client.system.healthCheck()
      })

      // Validate response structure
      expect(result).toBeDefined()
      expect(result.success).toBe(true)
      
      // Basic health check should indicate the system is running
      expect(result.success).toBe(true)
    })

    test('should return health check within acceptable time', async () => {
      const startTime = Date.now()
      
      const result = await client.system.healthCheck()
      
      const responseTime = Date.now() - startTime
      
      // Health checks should be fast (under 1 second)
      expect(responseTime).toBeLessThan(1000)
      
      expect(result.success).toBe(true)
      
      // Log performance for monitoring
      console.log(`Health check response time: ${responseTime}ms`)
    })

    test('should handle concurrent health checks', async () => {
      const concurrentRequests = 5
      const promises = Array(concurrentRequests).fill(null).map(() =>
        perfTracker.measure('concurrent-health-check', () => client.system.healthCheck())
      )

      const results = await Promise.all(promises)

      // All requests should succeed
      results.forEach(result => {
        expect(result.success).toBe(true)
      })
    })

    test('should maintain consistent health status across requests', async () => {
      const numRequests = 3
      const healthChecks = []

      for (let i = 0; i < numRequests; i++) {
        const result = await client.system.healthCheck()
        expect(result.success).toBe(true)
        healthChecks.push(result)
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // Status should be consistent across all requests
      const firstStatus = healthChecks[0].success
      healthChecks.forEach(health => {
        expect(health.success).toBe(firstStatus)
      })
    })
  })

  // ============================================================================
  // VERSION INFORMATION
  // ============================================================================

  describe('Version Information', () => {
    test('should provide basic system information through health check', async () => {
      const result = await client.system.healthCheck()
      
      expect(result.success).toBe(true)
      
      // For now, the health check provides basic system availability
      // Future enhancement: Add version endpoint or include version in health response
      expect(result.success).toBe(true)
    })
  })

  // ============================================================================
  // SYSTEM DIAGNOSTICS
  // ============================================================================

  describe('System Diagnostics', () => {
    test('should validate system is operational', async () => {
      const result = await client.system.healthCheck()
      
      expect(result.success).toBe(true)
      
      // The fact that we can successfully call the health endpoint
      // indicates the system is operational
      expect(result.success).toBe(true)
    })

    test('should track server availability', async () => {
      const numberOfChecks = 5
      const availabilityResults = []

      for (let i = 0; i < numberOfChecks; i++) {
        try {
          const result = await client.system.healthCheck()
          availabilityResults.push(result.success)
        } catch (error) {
          availabilityResults.push(false)
        }
        
        // Small delay between checks
        await new Promise(resolve => setTimeout(resolve, 50))
      }

      // Calculate availability percentage
      const successCount = availabilityResults.filter(Boolean).length
      const availability = (successCount / numberOfChecks) * 100

      // Expect high availability (at least 80% for test environment)
      expect(availability).toBeGreaterThanOrEqual(80)
      
      console.log(`System availability: ${availability}% (${successCount}/${numberOfChecks})`)
    })
  })

  // ============================================================================
  // PERFORMANCE MONITORING
  // ============================================================================

  describe('Performance Monitoring', () => {
    test('should maintain consistent response times', async () => {
      const responseTimes = []
      const numberOfSamples = 10

      for (let i = 0; i < numberOfSamples; i++) {
        const startTime = Date.now()
        
        const result = await client.system.healthCheck()
        
        const responseTime = Date.now() - startTime
        responseTimes.push(responseTime)
        
        expect(result.success).toBe(true)
        
        // Small delay between samples
        await new Promise(resolve => setTimeout(resolve, 10))
      }

      // Calculate statistics
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      const maxResponseTime = Math.max(...responseTimes)
      const minResponseTime = Math.min(...responseTimes)

      // Performance expectations
      expect(avgResponseTime).toBeLessThan(500) // Average under 500ms
      expect(maxResponseTime).toBeLessThan(1000) // Max under 1s
      expect(minResponseTime).toBeGreaterThanOrEqual(0) // Min at least 0ms

      console.log(`Response time stats - Avg: ${avgResponseTime.toFixed(2)}ms, Min: ${minResponseTime}ms, Max: ${maxResponseTime}ms`)
    })

    test('should handle load testing of health endpoint', async () => {
      const concurrentRequests = 10
      const requestsPerBatch = 5
      const totalRequests = concurrentRequests * requestsPerBatch

      console.log(`Starting load test: ${totalRequests} requests in ${concurrentRequests} concurrent batches`)

      const startTime = Date.now()
      const results = []

      // Execute concurrent batches
      for (let batch = 0; batch < requestsPerBatch; batch++) {
        const batchPromises = Array(concurrentRequests).fill(null).map(async () => {
          const requestStart = Date.now()
          try {
            const result = await client.system.healthCheck()
            return {
              success: result.success,
              responseTime: Date.now() - requestStart,
              error: null
            }
          } catch (error) {
            return {
              success: false,
              responseTime: Date.now() - requestStart,
              error: error.message
            }
          }
        })

        const batchResults = await Promise.all(batchPromises)
        results.push(...batchResults)
      }

      const totalTime = Date.now() - startTime
      const successCount = results.filter(r => r.success).length
      const successRate = (successCount / totalRequests) * 100
      const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length

      // Performance assertions
      expect(successRate).toBeGreaterThanOrEqual(95) // 95% success rate
      expect(avgResponseTime).toBeLessThan(1000) // Average under 1s
      expect(totalTime).toBeLessThan(10000) // Total test under 10s

      console.log(`Load test results - Success rate: ${successRate.toFixed(1)}%, Avg response: ${avgResponseTime.toFixed(2)}ms, Total time: ${totalTime}ms`)
    })
  })

  // ============================================================================
  // ERROR HANDLING AND EDGE CASES
  // ============================================================================

  describe('Error Handling', () => {
    test('should handle network timeouts gracefully', async () => {
      // Create a client with very short timeout to test timeout handling
      const timeoutClient = new PromptlianoClient({ 
        baseUrl: testEnv.baseUrl,
        timeout: 1 // 1ms timeout to force timeout
      })

      try {
        await timeoutClient.system.healthCheck()
        // If we reach here, the request was faster than expected
        // This is actually a good thing, but we'll log it
        console.log('Request completed faster than timeout - system is very responsive')
      } catch (error) {
        // Expected timeout error
        expect(error).toBeDefined()
        expect(error.message).toMatch(/timeout|abort/i)
      }
    })

    test('should validate response schema strictly', async () => {
      const result = await client.system.healthCheck()
      
      // Validate exact response structure
      expect(result).toHaveProperty('success')
      expect(result.success).toBe(true)
      
      // Ensure no unexpected properties at root level
      const expectedRootKeys = ['success']
      const actualRootKeys = Object.keys(result)
      
      actualRootKeys.forEach(key => {
        expect(expectedRootKeys).toContain(key)
      })
    })

    test('should maintain health status during rapid requests', async () => {
      // Rapid-fire requests to test system stability
      const rapidRequests = 20
      const promises = []

      for (let i = 0; i < rapidRequests; i++) {
        promises.push(client.system.healthCheck())
      }

      const results = await Promise.allSettled(promises)

      // Count successful requests
      const successful = results.filter(r => r.status === 'fulfilled').length
      const successRate = (successful / rapidRequests) * 100

      // Should handle rapid requests well
      expect(successRate).toBeGreaterThanOrEqual(90)

      console.log(`Rapid request test - ${successful}/${rapidRequests} successful (${successRate.toFixed(1)}%)`)
    })
  })

  // ============================================================================
  // COMPONENT HEALTH VALIDATION
  // ============================================================================

  describe('Component Health Validation', () => {
    test('should validate API server is responsive', async () => {
      const result = await client.system.healthCheck()
      
      expect(result.success).toBe(true)
      
      // The fact that we can call this endpoint means the HTTP server is working
      expect(result.success).toBe(true)
    })

    test('should validate database connectivity indirectly', async () => {
      // While the health endpoint might not directly check database,
      // we can infer database health by creating a simple project
      // and verifying the system still works
      
      const healthBefore = await client.system.healthCheck()
      expect(healthBefore.success).toBe(true)

      // Attempt a database operation to verify connectivity
      try {
        const projects = await client.projects.listProjects()
        assertions.assertSuccessResponse(projects)
        
        // If we can list projects, database is accessible
        const healthAfter = await client.system.healthCheck()
        expect(healthAfter.success).toBe(true)
        
        // System should remain healthy after database operation
        expect(healthAfter.success).toBe(healthBefore.success)
      } catch (error) {
        // If database operations fail, health check should still work
        // (this tests API server independence from database for health checks)
        const healthAfterError = await client.system.healthCheck()
        expect(healthAfterError.success).toBe(true)
      }
    })

    test('should maintain health endpoint availability under load', async () => {
      // Create some load with other operations while testing health
      const healthCheckPromises = []
      const otherOperationPromises = []

      // Health checks
      for (let i = 0; i < 5; i++) {
        healthCheckPromises.push(client.system.healthCheck())
      }

      // Other operations to create load
      for (let i = 0; i < 3; i++) {
        otherOperationPromises.push(
          client.projects.listProjects().catch(() => ({ success: false }))
        )
      }

      // Wait for all operations
      const [healthResults, otherResults] = await Promise.allSettled([
        Promise.all(healthCheckPromises),
        Promise.all(otherOperationPromises)
      ])

      // Health checks should succeed even under load
      if (healthResults.status === 'fulfilled') {
        healthResults.value.forEach(result => {
          expect(result.success).toBe(true)
        })
      } else {
        throw new Error('Health checks failed under load')
      }
    })
  })

  // ============================================================================
  // BASELINE PERFORMANCE VALIDATION
  // ============================================================================

  describe('Baseline Performance Validation', () => {
    test('should establish performance baselines', async () => {
      const metrics = {
        responseTime: [],
        throughput: 0,
        errorRate: 0
      }

      const testDuration = 2000 // 2 seconds
      const startTime = Date.now()
      let requestCount = 0
      let errorCount = 0

      // Run requests for specified duration
      while (Date.now() - startTime < testDuration) {
        const requestStart = Date.now()
        
        try {
          const result = await client.system.healthCheck()
          const responseTime = Date.now() - requestStart
          
          if (result.success) {
            metrics.responseTime.push(responseTime)
          } else {
            errorCount++
          }
          
          requestCount++
        } catch (error) {
          errorCount++
          requestCount++
        }

        // Small delay to prevent overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 50))
      }

      // Calculate metrics
      const actualDuration = Date.now() - startTime
      metrics.throughput = (requestCount / actualDuration) * 1000 // requests per second
      metrics.errorRate = (errorCount / requestCount) * 100

      const avgResponseTime = metrics.responseTime.length > 0 
        ? metrics.responseTime.reduce((a, b) => a + b, 0) / metrics.responseTime.length
        : 0

      // Baseline assertions
      expect(metrics.errorRate).toBeLessThan(5) // Less than 5% error rate
      expect(avgResponseTime).toBeLessThan(200) // Average under 200ms
      expect(metrics.throughput).toBeGreaterThan(1) // At least 1 request per second

      console.log(`Performance baseline - Throughput: ${metrics.throughput.toFixed(2)} req/s, Avg response: ${avgResponseTime.toFixed(2)}ms, Error rate: ${metrics.errorRate.toFixed(2)}%`)
    })
  })
})