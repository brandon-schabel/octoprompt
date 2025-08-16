import { describe, test, beforeAll, afterAll, expect } from 'bun:test'
import { createTestEnvironment, type TestEnvironment } from './test-environment'
import { createPromptlianoClient, type PromptlianoClient } from '@promptliano/api-client'
import { TestDataManager, assertions } from './utils/test-helpers'
import {
  LoadTestRunner,
  PerformanceMeasurement,
  PerformanceRegression,
  PerformanceReporter,
  type LoadTestConfig,
  type EndpointTestScenario,
  type LoadTestResult,
  type ScenarioContext
} from './utils/performance-helpers'
import * as path from 'path'

/**
 * Comprehensive Performance and Load Testing Suite
 * 
 * Tests API performance under various load conditions:
 * - Baseline performance (single user)
 * - Light load (10 concurrent users)
 * - Medium load (50 concurrent users) 
 * - Heavy load (100 concurrent users)
 * - Stress testing (breaking point identification)
 * - Endurance testing (sustained load)
 * - Performance regression detection
 */

describe('Performance and Load Testing', () => {
  let testEnv: TestEnvironment
  let client: PromptlianoClient
  let dataManager: TestDataManager
  let baselineResults: Record<string, LoadTestResult> = {}
  
  // Test data setup
  let testProject: any
  let testQueue: any
  let testTickets: any[] = []

  beforeAll(async () => {
    console.log('🚀 Setting up performance test environment...')
    
    // Create test environment optimized for performance testing
    testEnv = await createTestEnvironment({
      useIsolatedServer: true,
      database: { useMemory: true }, // Use memory DB for speed
      execution: {
        apiTimeout: 30000, // Longer timeout for load tests
        enableRateLimit: false, // Disable rate limiting
        logLevel: 'error' // Reduce logging noise
      },
      monitoring: {
        enableMemoryTracking: true,
        enableCpuTracking: true,
        sampleIntervalMs: 1000
      }
    })
    
    client = createPromptlianoClient({ 
      baseUrl: testEnv.baseUrl,
      timeout: 30000
    })
    
    dataManager = new TestDataManager(client)
    
    // Create test data for performance testing
    await setupPerformanceTestData()
    
    console.log('✅ Performance test environment ready')
  }, 60000) // 60 second timeout for setup

  afterAll(async () => {
    console.log('🧹 Cleaning up performance test environment...')
    
    try {
      await dataManager.cleanup()
      await testEnv.cleanup()
      
      // Print performance summary
      if (Object.keys(baselineResults).length > 0) {
        console.log('\n📊 Performance Test Summary:')
        Object.entries(baselineResults).forEach(([testName, result]) => {
          console.log(`\n${testName}:`)
          console.log(`  Throughput: ${result.metrics.throughput.requestsPerSecond.toFixed(2)} RPS`)
          console.log(`  P95 Response Time: ${result.metrics.responseTime.p95.toFixed(2)}ms`)
          console.log(`  Error Rate: ${result.metrics.errors.errorRate.toFixed(2)}%`)
        })
      }
    } catch (error) {
      console.warn('Cleanup error:', error)
    }
  }, 30000)

  /**
   * Setup test data for performance testing
   */
  async function setupPerformanceTestData(): Promise<void> {
    // Create test project
    testProject = await dataManager.createProject({
      name: 'Performance Test Project',
      description: 'Project for load testing',
      path: '/tmp/perf-test-project'
    })

    // Create test queue
    testQueue = await dataManager.createQueue(testProject.id, {
      name: 'Performance Test Queue',
      description: 'Queue for load testing',
      maxParallelItems: 10
    })

    // Create multiple test tickets for load testing
    for (let i = 1; i <= 20; i++) {
      const ticket = await dataManager.createTicket({
        title: `Performance Test Ticket ${i}`,
        overview: `Test ticket ${i} for performance testing`,
        projectId: testProject.id,
        priority: i % 2 === 0 ? 'high' : 'normal'
      })
      testTickets.push(ticket)

      // Add tasks to some tickets
      if (i <= 10) {
        await dataManager.createTask(ticket.id, {
          content: `Task 1 for Ticket ${i}`,
          description: `Performance test task ${i}`,
          estimatedHours: 2,
          tags: ['performance', 'test']
        })
      }
    }

    console.log(`✅ Created test data: 1 project, 1 queue, ${testTickets.length} tickets`)
  }

  /**
   * Core service test scenarios
   */
  const coreServiceScenarios: EndpointTestScenario[] = [
    {
      name: 'list_projects',
      weight: 8,
      execute: async (client: PromptlianoClient) => {
        const result = await client.projects.listProjects()
        assertions.assertSuccessResponse(result)
      }
    },
    {
      name: 'get_project',
      weight: 6,
      execute: async (client: PromptlianoClient) => {
        const result = await client.projects.getProject(testProject.id)
        assertions.assertSuccessResponse(result)
      }
    },
    {
      name: 'list_tickets',
      weight: 10,
      execute: async (client: PromptlianoClient) => {
        const result = await client.tickets.listTickets(testProject.id)
        assertions.assertSuccessResponse(result)
      }
    },
    {
      name: 'get_ticket',
      weight: 7,
      execute: async (client: PromptlianoClient, context: ScenarioContext) => {
        const ticketIndex = context.userId % testTickets.length
        const result = await client.tickets.getTicket(testTickets[ticketIndex].id)
        assertions.assertSuccessResponse(result)
      }
    },
    {
      name: 'list_tasks',
      weight: 5,
      execute: async (client: PromptlianoClient, context: ScenarioContext) => {
        const ticketIndex = context.userId % 10 // Only first 10 tickets have tasks
        const result = await client.tickets.listTasks(testTickets[ticketIndex].id)
        assertions.assertSuccessResponse(result)
      }
    },
    {
      name: 'get_queue_stats',
      weight: 4,
      execute: async (client: PromptlianoClient) => {
        const result = await client.queues.getQueueStats(testQueue.id)
        assertions.assertSuccessResponse(result)
      }
    },
    {
      name: 'list_queues',
      weight: 3,
      execute: async (client: PromptlianoClient) => {
        const result = await client.queues.listQueues(testProject.id)
        assertions.assertSuccessResponse(result)
      }
    }
  ]

  /**
   * Write-heavy test scenarios (for stress testing)
   */
  const writeScenarios: EndpointTestScenario[] = [
    {
      name: 'create_ticket',
      weight: 5,
      execute: async (client: PromptlianoClient, context: ScenarioContext) => {
        const result = await client.tickets.createTicket({
          title: `Load Test Ticket ${context.userId}-${context.iterationCount}`,
          overview: 'Ticket created during load testing',
          projectId: testProject.id,
          priority: 'normal'
        })
        assertions.assertSuccessResponse(result)
        
        // Store for cleanup
        context.testData.createdTickets = context.testData.createdTickets || []
        context.testData.createdTickets.push(result.data.id)
      },
      teardown: async (client: PromptlianoClient, context: ScenarioContext) => {
        // Cleanup created tickets
        if (context.testData.createdTickets) {
          for (const ticketId of context.testData.createdTickets) {
            try {
              await client.tickets.deleteTicket(ticketId)
            } catch (error) {
              // Ignore cleanup errors
            }
          }
        }
      }
    },
    {
      name: 'update_ticket',
      weight: 3,
      execute: async (client: PromptlianoClient, context: ScenarioContext) => {
        const ticketIndex = context.userId % testTickets.length
        const result = await client.tickets.updateTicket(testTickets[ticketIndex].id, {
          title: `Updated by User ${context.userId} - ${Date.now()}`
        })
        assertions.assertSuccessResponse(result)
      }
    },
    {
      name: 'create_task',
      weight: 4,
      execute: async (client: PromptlianoClient, context: ScenarioContext) => {
        const ticketIndex = context.userId % testTickets.length
        const result = await client.tickets.createTask(testTickets[ticketIndex].id, {
          content: `Load test task ${context.userId}-${context.iterationCount}`,
          description: 'Task created during load testing',
          estimatedHours: 1,
          tags: ['load-test']
        })
        assertions.assertSuccessResponse(result)
        
        // Store for cleanup
        context.testData.createdTasks = context.testData.createdTasks || []
        context.testData.createdTasks.push({ ticketId: testTickets[ticketIndex].id, taskId: result.data.id })
      },
      teardown: async (client: PromptlianoClient, context: ScenarioContext) => {
        // Cleanup created tasks
        if (context.testData.createdTasks) {
          for (const { ticketId, taskId } of context.testData.createdTasks) {
            try {
              await client.tickets.deleteTask(ticketId, taskId)
            } catch (error) {
              // Ignore cleanup errors
            }
          }
        }
      }
    },
    {
      name: 'enqueue_ticket',
      weight: 2,
      execute: async (client: PromptlianoClient, context: ScenarioContext) => {
        const ticketIndex = context.userId % testTickets.length
        const result = await client.queues.enqueueItem(testQueue.id, {
          type: 'ticket',
          itemId: testTickets[ticketIndex].id,
          priority: 5
        })
        assertions.assertSuccessResponse(result)
      }
    }
  ]

  /**
   * Baseline Performance Test (Single User)
   */
  test('Baseline Performance - Single User', async () => {
    console.log('📊 Running baseline performance test...')
    
    const config: LoadTestConfig = {
      name: 'Baseline Performance',
      description: 'Single user baseline performance measurement',
      users: {
        initial: 1,
        target: 1,
        rampupTimeMs: 100,
        sustainTimeMs: 30000 // 30 seconds
      },
      requests: {
        thinkTimeMs: 100,
        timeoutMs: 10000,
        requestsPerUser: 50
      },
      thresholds: {
        maxResponseTimeMs: 1000,
        maxErrorRate: 1,
        minThroughputRps: 1
      },
      monitoring: {
        enableMemoryTracking: true,
        enableCpuTracking: true,
        sampleIntervalMs: 1000
      }
    }

    const runner = new LoadTestRunner(config, client, coreServiceScenarios)
    const result = await runner.run()
    
    // Store baseline for comparison
    baselineResults['baseline'] = result
    
    // Validate performance thresholds
    expect(result.metrics.responseTime.p95).toBeLessThan(config.thresholds?.maxResponseTimeMs || 1000)
    expect(result.metrics.errors.errorRate).toBeLessThan(config.thresholds?.maxErrorRate || 1)
    expect(result.metrics.throughput.requestsPerSecond).toBeGreaterThan(config.thresholds?.minThroughputRps || 1)
    
    console.log('✅ Baseline test completed')
    console.log(`   Throughput: ${result.metrics.throughput.requestsPerSecond.toFixed(2)} RPS`)
    console.log(`   P95: ${result.metrics.responseTime.p95.toFixed(2)}ms`)
    console.log(`   Error Rate: ${result.metrics.errors.errorRate.toFixed(2)}%`)
  }, 120000)

  /**
   * Light Load Test (10 concurrent users)
   */
  test('Light Load - 10 Concurrent Users', async () => {
    console.log('📊 Running light load test...')
    
    const config: LoadTestConfig = {
      name: 'Light Load',
      description: '10 concurrent users for 60 seconds',
      users: {
        initial: 1,
        target: 10,
        rampupTimeMs: 10000, // 10 second ramp-up
        sustainTimeMs: 60000 // 1 minute
      },
      requests: {
        thinkTimeMs: 200,
        timeoutMs: 15000,
        requestsPerUser: 30
      },
      thresholds: {
        maxResponseTimeMs: 2000,
        maxErrorRate: 2,
        minThroughputRps: 5
      },
      monitoring: {
        enableMemoryTracking: true,
        enableCpuTracking: true,
        sampleIntervalMs: 2000
      }
    }

    const runner = new LoadTestRunner(config, client, coreServiceScenarios)
    const result = await runner.run()
    
    baselineResults['light_load'] = result
    
    // Performance should be stable under light load
    expect(result.metrics.responseTime.p95).toBeLessThan(2000)
    expect(result.metrics.errors.errorRate).toBeLessThan(2)
    expect(result.metrics.throughput.requestsPerSecond).toBeGreaterThan(5)
    expect(result.metrics.concurrency.actualConcurrentPeak).toBe(10)
    
    console.log('✅ Light load test completed')
    console.log(`   Peak Users: ${result.metrics.concurrency.actualConcurrentPeak}`)
    console.log(`   Throughput: ${result.metrics.throughput.requestsPerSecond.toFixed(2)} RPS`)
    console.log(`   P95: ${result.metrics.responseTime.p95.toFixed(2)}ms`)
  }, 180000)

  /**
   * Medium Load Test (50 concurrent users)
   */
  test('Medium Load - 50 Concurrent Users', async () => {
    console.log('📊 Running medium load test...')
    
    const config: LoadTestConfig = {
      name: 'Medium Load',
      description: '50 concurrent users for 90 seconds',
      users: {
        initial: 5,
        target: 50,
        rampupTimeMs: 20000, // 20 second ramp-up
        sustainTimeMs: 90000 // 1.5 minutes
      },
      requests: {
        thinkTimeMs: 300,
        timeoutMs: 20000,
        requestsPerUser: 25
      },
      thresholds: {
        maxResponseTimeMs: 5000,
        maxErrorRate: 5,
        minThroughputRps: 15
      },
      monitoring: {
        enableMemoryTracking: true,
        enableCpuTracking: true,
        sampleIntervalMs: 3000
      }
    }

    const runner = new LoadTestRunner(config, client, coreServiceScenarios)
    const result = await runner.run()
    
    baselineResults['medium_load'] = result
    
    // Performance may degrade but should remain acceptable
    expect(result.metrics.responseTime.p95).toBeLessThan(5000)
    expect(result.metrics.errors.errorRate).toBeLessThan(5)
    expect(result.metrics.throughput.requestsPerSecond).toBeGreaterThan(15)
    expect(result.metrics.concurrency.actualConcurrentPeak).toBe(50)
    
    console.log('✅ Medium load test completed')
    console.log(`   Peak Users: ${result.metrics.concurrency.actualConcurrentPeak}`)
    console.log(`   Throughput: ${result.metrics.throughput.requestsPerSecond.toFixed(2)} RPS`)
    console.log(`   P95: ${result.metrics.responseTime.p95.toFixed(2)}ms`)
    console.log(`   Error Rate: ${result.metrics.errors.errorRate.toFixed(2)}%`)
  }, 240000)

  /**
   * Heavy Load Test (100 concurrent users)
   */
  test('Heavy Load - 100 Concurrent Users', async () => {
    console.log('📊 Running heavy load test...')
    
    const config: LoadTestConfig = {
      name: 'Heavy Load',
      description: '100 concurrent users for 2 minutes',
      users: {
        initial: 10,
        target: 100,
        rampupTimeMs: 30000, // 30 second ramp-up
        sustainTimeMs: 120000, // 2 minutes
        rampdownTimeMs: 20000 // 20 second ramp-down
      },
      requests: {
        thinkTimeMs: 500,
        timeoutMs: 30000,
        requestsPerUser: 20
      },
      thresholds: {
        maxResponseTimeMs: 10000,
        maxErrorRate: 10,
        minThroughputRps: 20
      },
      monitoring: {
        enableMemoryTracking: true,
        enableCpuTracking: true,
        sampleIntervalMs: 5000
      }
    }

    const runner = new LoadTestRunner(config, client, coreServiceScenarios)
    const result = await runner.run()
    
    baselineResults['heavy_load'] = result
    
    // System should handle heavy load with some degradation
    expect(result.metrics.responseTime.p95).toBeLessThan(10000)
    expect(result.metrics.errors.errorRate).toBeLessThan(10)
    expect(result.metrics.throughput.requestsPerSecond).toBeGreaterThan(20)
    expect(result.metrics.concurrency.actualConcurrentPeak).toBe(100)
    
    console.log('✅ Heavy load test completed')
    console.log(`   Peak Users: ${result.metrics.concurrency.actualConcurrentPeak}`)
    console.log(`   Throughput: ${result.metrics.throughput.requestsPerSecond.toFixed(2)} RPS`)
    console.log(`   P95: ${result.metrics.responseTime.p95.toFixed(2)}ms`)
    console.log(`   Error Rate: ${result.metrics.errors.errorRate.toFixed(2)}%`)
    
    // Check for memory leaks
    if (result.metrics.resources.memoryUsage) {
      const memoryMB = result.metrics.resources.memoryUsage.heapUsed / 1024 / 1024
      console.log(`   Memory Usage: ${memoryMB.toFixed(2)} MB`)
      expect(memoryMB).toBeLessThan(500) // Should not exceed 500MB
    }
  }, 360000)

  /**
   * Stress Test - Write Operations
   */
  test('Stress Test - Write Operations', async () => {
    console.log('📊 Running write operations stress test...')
    
    const config: LoadTestConfig = {
      name: 'Write Stress Test',
      description: 'Heavy write operations to test data consistency',
      users: {
        initial: 5,
        target: 25,
        rampupTimeMs: 15000,
        sustainTimeMs: 60000
      },
      requests: {
        thinkTimeMs: 1000, // Longer think time for writes
        timeoutMs: 20000,
        requestsPerUser: 15
      },
      thresholds: {
        maxResponseTimeMs: 8000,
        maxErrorRate: 15, // Higher error tolerance for writes
        minThroughputRps: 5
      },
      monitoring: {
        enableMemoryTracking: true,
        enableCpuTracking: true,
        sampleIntervalMs: 2000
      }
    }

    const runner = new LoadTestRunner(config, client, writeScenarios)
    const result = await runner.run()
    
    baselineResults['write_stress'] = result
    
    // Write operations may have higher latency and error rates
    expect(result.metrics.responseTime.p95).toBeLessThan(8000)
    expect(result.metrics.errors.errorRate).toBeLessThan(15)
    expect(result.metrics.throughput.requestsPerSecond).toBeGreaterThan(5)
    
    console.log('✅ Write stress test completed')
    console.log(`   Throughput: ${result.metrics.throughput.requestsPerSecond.toFixed(2)} RPS`)
    console.log(`   P95: ${result.metrics.responseTime.p95.toFixed(2)}ms`)
    console.log(`   Error Rate: ${result.metrics.errors.errorRate.toFixed(2)}%`)
    
    // Verify data consistency after stress test
    const projectResult = await client.projects.getProject(testProject.id)
    assertions.assertSuccessResponse(projectResult)
    
    const ticketsResult = await client.tickets.listTickets(testProject.id)
    assertions.assertSuccessResponse(ticketsResult)
    expect(ticketsResult.data.length).toBeGreaterThanOrEqual(testTickets.length)
  }, 180000)

  /**
   * Endurance Test - Long Duration
   */
  test.skip('Endurance Test - 15 Minutes Sustained Load', async () => {
    console.log('📊 Running endurance test (15 minutes)...')
    
    const config: LoadTestConfig = {
      name: 'Endurance Test',
      description: '15 minute sustained load test',
      users: {
        initial: 5,
        target: 20,
        rampupTimeMs: 60000, // 1 minute ramp-up
        sustainTimeMs: 900000, // 15 minutes
        rampdownTimeMs: 60000 // 1 minute ramp-down
      },
      requests: {
        thinkTimeMs: 2000, // 2 second think time
        timeoutMs: 30000,
        requestsPerUser: 200 // Many requests per user
      },
      thresholds: {
        maxResponseTimeMs: 5000,
        maxErrorRate: 5,
        minThroughputRps: 8
      },
      monitoring: {
        enableMemoryTracking: true,
        enableCpuTracking: true,
        enableGcTracking: true,
        sampleIntervalMs: 10000 // Sample every 10 seconds
      }
    }

    const runner = new LoadTestRunner(config, client, coreServiceScenarios)
    const result = await runner.run()
    
    baselineResults['endurance'] = result
    
    // System should maintain stability over extended period
    expect(result.metrics.responseTime.p95).toBeLessThan(5000)
    expect(result.metrics.errors.errorRate).toBeLessThan(5)
    expect(result.metrics.throughput.requestsPerSecond).toBeGreaterThan(8)
    
    console.log('✅ Endurance test completed')
    console.log(`   Duration: ${(result.totalDuration / 1000 / 60).toFixed(1)} minutes`)
    console.log(`   Total Requests: ${result.metrics.throughput.totalRequests}`)
    console.log(`   Average RPS: ${result.metrics.throughput.requestsPerSecond.toFixed(2)}`)
    console.log(`   Memory Stability: ${result.metrics.resources.memoryUsage ? 'Tracked' : 'Not tracked'}`)
    
    // Check for memory leaks over long duration
    if (result.metrics.resources.memoryUsage) {
      const memoryMB = result.metrics.resources.memoryUsage.heapUsed / 1024 / 1024
      expect(memoryMB).toBeLessThan(1000) // Should not exceed 1GB even after 15 minutes
    }
  }, 1200000) // 20 minute timeout

  /**
   * Breaking Point Test - Find System Limits
   */
  test.skip('Breaking Point Test - Progressive Load Increase', async () => {
    console.log('📊 Running breaking point test...')
    
    const maxUsers = 200
    const stepSize = 25
    const stepDuration = 30000 // 30 seconds per step
    
    for (let targetUsers = stepSize; targetUsers <= maxUsers; targetUsers += stepSize) {
      console.log(`🔄 Testing with ${targetUsers} users...`)
      
      const config: LoadTestConfig = {
        name: `Breaking Point - ${targetUsers} Users`,
        description: `Progressive load test with ${targetUsers} concurrent users`,
        users: {
          initial: Math.max(1, targetUsers - stepSize),
          target: targetUsers,
          rampupTimeMs: 10000,
          sustainTimeMs: stepDuration
        },
        requests: {
          thinkTimeMs: 500,
          timeoutMs: 20000,
          requestsPerUser: 10
        },
        monitoring: {
          enableMemoryTracking: true,
          sampleIntervalMs: 5000
        }
      }

      const runner = new LoadTestRunner(config, client, coreServiceScenarios)
      const result = await runner.run()
      
      baselineResults[`breaking_point_${targetUsers}`] = result
      
      console.log(`   ${targetUsers} users: ${result.metrics.throughput.requestsPerSecond.toFixed(2)} RPS, ${result.metrics.errors.errorRate.toFixed(1)}% errors`)
      
      // Stop if error rate exceeds 25% or response time exceeds 30 seconds
      if (result.metrics.errors.errorRate > 25 || result.metrics.responseTime.p95 > 30000) {
        console.log(`💥 Breaking point reached at ${targetUsers} users`)
        console.log(`   Error Rate: ${result.metrics.errors.errorRate.toFixed(2)}%`)
        console.log(`   P95 Response Time: ${result.metrics.responseTime.p95.toFixed(2)}ms`)
        break
      }
      
      // Brief pause between test steps
      await new Promise(resolve => setTimeout(resolve, 10000))
    }
  }, 600000) // 10 minute timeout

  /**
   * Performance Regression Detection
   */
  test('Performance Regression Detection', async () => {
    console.log('📊 Running regression detection test...')
    
    // Only run if we have baseline results
    if (!baselineResults['baseline']) {
      console.log('⏭️  Skipping regression test - no baseline available')
      return
    }

    // Run a current performance test
    const config: LoadTestConfig = {
      name: 'Regression Test',
      description: 'Current performance vs baseline comparison',
      users: {
        initial: 1,
        target: 10,
        rampupTimeMs: 5000,
        sustainTimeMs: 30000
      },
      requests: {
        thinkTimeMs: 200,
        timeoutMs: 15000,
        requestsPerUser: 25
      },
      monitoring: {
        enableMemoryTracking: true,
        sampleIntervalMs: 2000
      }
    }

    const runner = new LoadTestRunner(config, client, coreServiceScenarios)
    const currentResult = await runner.run()
    
    // Compare with baseline
    const comparison = PerformanceRegression.compareWithBaseline(
      currentResult,
      baselineResults['baseline'],
      {
        responseTimeDegradation: 50, // 50% response time degradation threshold
        throughputDegradation: -30, // 30% throughput degradation threshold
        errorRateIncrease: 5 // 5 percentage point error rate increase
      }
    )
    
    console.log('📈 Performance Comparison Results:')
    console.log(`   Response Time Change: ${comparison.metrics.responseTimeChange.toFixed(1)}%`)
    console.log(`   Throughput Change: ${comparison.metrics.throughputChange.toFixed(1)}%`)
    console.log(`   Error Rate Change: ${comparison.metrics.errorRateChange.toFixed(1)} pp`)
    
    if (!comparison.passed) {
      console.log('⚠️  Performance Issues Detected:')
      comparison.issues.forEach(issue => console.log(`   - ${issue}`))
    } else {
      console.log('✅ No significant performance regressions detected')
    }
    
    // Test should pass if no critical regressions
    expect(comparison.passed).toBe(true)
  }, 120000)

  /**
   * Performance Report Generation
   */
  test('Performance Report Generation', async () => {
    console.log('📊 Generating performance reports...')
    
    if (Object.keys(baselineResults).length === 0) {
      console.log('⏭️  Skipping report generation - no test results available')
      return
    }

    // Generate reports for each test
    for (const [testName, result] of Object.entries(baselineResults)) {
      console.log(`\n📋 Report for ${testName}:`)
      console.log(PerformanceReporter.generateReport(result))
      
      // Validate report generation doesn't throw
      expect(typeof PerformanceReporter.generateReport(result)).toBe('string')
      expect(typeof PerformanceReporter.exportToJson(result)).toBe('string')
      expect(typeof PerformanceReporter.exportToCsv(result)).toBe('string')
    }
    
    console.log('✅ Performance reports generated successfully')
  })

  /**
   * Resource Utilization Test
   */
  test('Resource Utilization Analysis', async () => {
    console.log('📊 Running resource utilization test...')
    
    const config: LoadTestConfig = {
      name: 'Resource Utilization',
      description: 'Monitor system resource usage under load',
      users: {
        initial: 1,
        target: 30,
        rampupTimeMs: 15000,
        sustainTimeMs: 60000
      },
      requests: {
        thinkTimeMs: 300,
        timeoutMs: 15000,
        requestsPerUser: 25
      },
      monitoring: {
        enableMemoryTracking: true,
        enableCpuTracking: true,
        enableGcTracking: true,
        sampleIntervalMs: 1000
      }
    }

    const runner = new LoadTestRunner(config, client, coreServiceScenarios)
    const result = await runner.run()
    
    // Analyze resource usage
    const { resources } = result.metrics
    
    if (resources.memoryUsage) {
      const memoryMB = resources.memoryUsage.heapUsed / 1024 / 1024
      console.log(`💾 Memory Usage: ${memoryMB.toFixed(2)} MB`)
      expect(memoryMB).toBeLessThan(800) // Should not exceed 800MB under moderate load
    }
    
    if (resources.gcMetrics) {
      console.log(`🗑️  Garbage Collection: ${resources.gcMetrics.totalCollections} collections, ${resources.gcMetrics.totalTime.toFixed(2)}ms total`)
      expect(resources.gcMetrics.totalTime).toBeLessThan(result.totalDuration * 0.1) // GC should not exceed 10% of total time
    }
    
    console.log('✅ Resource utilization test completed')
    console.log(`   Peak Concurrent Users: ${result.metrics.concurrency.actualConcurrentPeak}`)
    console.log(`   Average Response Time: ${result.metrics.responseTime.mean.toFixed(2)}ms`)
    console.log(`   System Efficiency: ${(result.metrics.throughput.requestsPerSecond / result.metrics.concurrency.actualConcurrentPeak).toFixed(2)} RPS/user`)
  }, 180000)

  /**
   * Mixed Workload Test
   */
  test('Mixed Workload - Read/Write Balance', async () => {
    console.log('📊 Running mixed workload test...')
    
    // Combine read and write scenarios with realistic distribution
    const mixedScenarios: EndpointTestScenario[] = [
      ...coreServiceScenarios.map(s => ({ ...s, weight: s.weight * 0.7 })), // 70% reads
      ...writeScenarios.map(s => ({ ...s, weight: s.weight * 0.3 })) // 30% writes
    ]
    
    const config: LoadTestConfig = {
      name: 'Mixed Workload',
      description: '70% read, 30% write operations under load',
      users: {
        initial: 5,
        target: 40,
        rampupTimeMs: 20000,
        sustainTimeMs: 90000
      },
      requests: {
        thinkTimeMs: 400,
        timeoutMs: 20000,
        requestsPerUser: 30
      },
      thresholds: {
        maxResponseTimeMs: 6000,
        maxErrorRate: 8,
        minThroughputRps: 12
      },
      monitoring: {
        enableMemoryTracking: true,
        enableCpuTracking: true,
        sampleIntervalMs: 3000
      }
    }

    const runner = new LoadTestRunner(config, client, mixedScenarios)
    const result = await runner.run()
    
    baselineResults['mixed_workload'] = result
    
    // Mixed workload should balance performance
    expect(result.metrics.responseTime.p95).toBeLessThan(6000)
    expect(result.metrics.errors.errorRate).toBeLessThan(8)
    expect(result.metrics.throughput.requestsPerSecond).toBeGreaterThan(12)
    
    console.log('✅ Mixed workload test completed')
    console.log(`   Throughput: ${result.metrics.throughput.requestsPerSecond.toFixed(2)} RPS`)
    console.log(`   P95: ${result.metrics.responseTime.p95.toFixed(2)}ms`)
    console.log(`   Error Rate: ${result.metrics.errors.errorRate.toFixed(2)}%`)
    console.log(`   Read/Write Balance: Optimal`)
    
    // Verify data consistency after mixed operations
    const finalTicketsResult = await client.tickets.listTickets(testProject.id)
    assertions.assertSuccessResponse(finalTicketsResult)
    expect(finalTicketsResult.data.length).toBeGreaterThanOrEqual(testTickets.length)
  }, 240000)
})

/**
 * Performance Test Utilities
 */
describe('Performance Test Utilities', () => {
  test('PerformanceMeasurement - Basic Functionality', async () => {
    const config: LoadTestConfig = {
      name: 'Utility Test',
      users: { initial: 1, target: 1, rampupTimeMs: 100, sustainTimeMs: 1000 },
      requests: { timeoutMs: 5000 }
    }
    
    const measurement = new PerformanceMeasurement(config)
    
    measurement.start()
    
    // Simulate some operations
    await measurement.measureOperation(async () => {
      await new Promise(resolve => setTimeout(resolve, 100))
      return 'success'
    }, 'test_operation')
    
    measurement.recordError('Test error', 'test_endpoint', 500)
    measurement.updateActiveUsers(5)
    
    const result = measurement.end()
    
    expect(result.testName).toBe('Utility Test')
    expect(result.metrics.throughput.totalRequests).toBe(1)
    expect(result.metrics.errors.totalErrors).toBe(1)
    expect(result.metrics.concurrency.actualConcurrentPeak).toBe(5)
    expect(result.rawTimings.length).toBe(1)
    expect(result.rawTimings[0]).toBeGreaterThan(90) // Should be around 100ms
  })

  test('PerformanceRegression - Comparison Logic', () => {
    const baseline: LoadTestResult = {
      testName: 'baseline',
      startTime: 0,
      endTime: 1000,
      totalDuration: 1000,
      metrics: {
        responseTime: { min: 10, max: 100, mean: 50, median: 45, p95: 80, p99: 95, standardDeviation: 20 },
        throughput: { requestsPerSecond: 100, requestsPerMinute: 6000, totalRequests: 100, duration: 1000 },
        errors: { totalErrors: 1, errorRate: 1, errorsByType: { 'server_error': 1 }, timeouts: 0 },
        resources: {},
        concurrency: { targetUsers: 10, actualConcurrentPeak: 10, averageConcurrentUsers: 8, userRampupTime: 5000 }
      },
      rawTimings: [50],
      errors: [],
      timeline: []
    }
    
    const current: LoadTestResult = {
      ...baseline,
      metrics: {
        ...baseline.metrics,
        responseTime: { ...baseline.metrics.responseTime, mean: 75 }, // 50% increase
        throughput: { ...baseline.metrics.throughput, requestsPerSecond: 80 }, // 20% decrease
        errors: { ...baseline.metrics.errors, errorRate: 3 } // 2 percentage point increase
      }
    }
    
    const comparison = PerformanceRegression.compareWithBaseline(current, baseline, {
      responseTimeDegradation: 30, // 30% threshold
      throughputDegradation: -15, // 15% threshold
      errorRateIncrease: 1 // 1 percentage point threshold
    })
    
    expect(comparison.passed).toBe(false)
    expect(comparison.issues.length).toBe(3) // All three metrics exceeded thresholds
    expect(comparison.metrics.responseTimeChange).toBe(50)
    expect(comparison.metrics.throughputChange).toBe(-20)
    expect(comparison.metrics.errorRateChange).toBe(2)
  })

  test('PerformanceReporter - Report Generation', () => {
    const testResult: LoadTestResult = {
      testName: 'Test Report',
      startTime: 0,
      endTime: 1000,
      totalDuration: 1000,
      metrics: {
        responseTime: { min: 10, max: 200, mean: 75, median: 70, p95: 150, p99: 180, standardDeviation: 25 },
        throughput: { requestsPerSecond: 50, requestsPerMinute: 3000, totalRequests: 50, duration: 1000 },
        errors: { totalErrors: 2, errorRate: 4, errorsByType: { 'timeout': 1, 'server_error': 1 }, timeouts: 1 },
        resources: {
          memoryUsage: { rss: 50000000, heapUsed: 30000000, heapTotal: 40000000, external: 5000000, arrayBuffers: 2000000 }
        },
        concurrency: { targetUsers: 10, actualConcurrentPeak: 10, averageConcurrentUsers: 8, userRampupTime: 5000 }
      },
      rawTimings: [75],
      errors: [],
      timeline: []
    }
    
    const report = PerformanceReporter.generateReport(testResult)
    const jsonExport = PerformanceReporter.exportToJson(testResult)
    const csvExport = PerformanceReporter.exportToCsv(testResult)
    
    expect(report).toContain('Performance Test Report: Test Report')
    expect(report).toContain('Mean: 75.00ms')
    expect(report).toContain('Requests/Second: 50.00')
    expect(report).toContain('Error Rate: 4.00%')
    expect(report).toContain('RSS: 47.68 MB')
    
    expect(typeof jsonExport).toBe('string')
    expect(JSON.parse(jsonExport)).toEqual(testResult)
    
    expect(typeof csvExport).toBe('string')
    expect(csvExport).toContain('timestamp,response_time_ms,endpoint,success,error_type')
  })
})