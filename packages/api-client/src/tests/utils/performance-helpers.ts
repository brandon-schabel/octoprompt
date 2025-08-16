import type { PromptlianoClient } from '@promptliano/api-client'
import type { TestEnvironment } from '../test-environment'

/**
 * Performance measurement and analysis utilities for API load testing
 */

export interface PerformanceMetrics {
  /** Response time percentiles */
  responseTime: {
    min: number
    max: number
    mean: number
    median: number
    p95: number
    p99: number
    standardDeviation: number
  }
  /** Throughput measurements */
  throughput: {
    requestsPerSecond: number
    requestsPerMinute: number
    totalRequests: number
    duration: number
  }
  /** Error analysis */
  errors: {
    totalErrors: number
    errorRate: number
    errorsByType: Record<string, number>
    timeouts: number
  }
  /** Resource utilization */
  resources: {
    memoryUsage?: NodeJS.MemoryUsage
    cpuTimes?: NodeJS.CpuUsage
    gcMetrics?: {
      totalCollections: number
      totalTime: number
    }
  }
  /** Concurrent user simulation */
  concurrency: {
    targetUsers: number
    actualConcurrentPeak: number
    averageConcurrentUsers: number
    userRampupTime: number
  }
}

export interface LoadTestResult {
  testName: string
  startTime: number
  endTime: number
  totalDuration: number
  metrics: PerformanceMetrics
  rawTimings: number[]
  errors: Array<{
    timestamp: number
    error: string
    endpoint: string
    statusCode?: number
  }>
  timeline: Array<{
    timestamp: number
    activeUsers: number
    requestsPerSecond: number
    averageResponseTime: number
    errorRate: number
  }>
}

export interface LoadTestConfig {
  /** Test identification */
  name: string
  description?: string
  
  /** Load pattern configuration */
  users: {
    initial: number
    target: number
    rampupTimeMs: number
    sustainTimeMs: number
    rampdownTimeMs?: number
  }
  
  /** Request configuration */
  requests: {
    thinkTimeMs?: number
    timeoutMs?: number
    retryCount?: number
    requestsPerUser?: number
  }
  
  /** Performance thresholds */
  thresholds?: {
    maxResponseTimeMs?: number
    maxErrorRate?: number
    minThroughputRps?: number
    maxMemoryMB?: number
  }
  
  /** Resource monitoring */
  monitoring?: {
    enableMemoryTracking?: boolean
    enableCpuTracking?: boolean
    enableGcTracking?: boolean
    sampleIntervalMs?: number
  }
}

export interface EndpointTestScenario {
  name: string
  weight: number // Relative frequency (1-10)
  execute: (client: PromptlianoClient, context: ScenarioContext) => Promise<void>
  setup?: (client: PromptlianoClient, context: ScenarioContext) => Promise<void>
  teardown?: (client: PromptlianoClient, context: ScenarioContext) => Promise<void>
}

export interface ScenarioContext {
  userId: number
  iterationCount: number
  testData: Record<string, any>
  sharedState: Record<string, any>
}

/**
 * Advanced performance measurement class with statistical analysis
 */
export class PerformanceMeasurement {
  private timings: number[] = []
  private errors: Array<{ timestamp: number; error: string; endpoint: string; statusCode?: number }> = []
  private startTime: number = 0
  private endTime: number = 0
  private activeUsers: number = 0
  private peakConcurrentUsers: number = 0
  private userConcurrencyTimeline: Array<{ timestamp: number; count: number }> = []
  private timeline: Array<{
    timestamp: number
    activeUsers: number
    requestsPerSecond: number
    averageResponseTime: number
    errorRate: number
  }> = []
  private resourceUsage: NodeJS.MemoryUsage[] = []
  private cpuUsage: NodeJS.CpuUsage[] = []
  private gcData: { collections: number; time: number }[] = []
  private intervals: NodeJS.Timeout[] = []

  constructor(private config: LoadTestConfig) {}

  /**
   * Starts the performance measurement session
   */
  start(): void {
    this.startTime = performance.now()
    this.timings = []
    this.errors = []
    this.userConcurrencyTimeline = []
    this.timeline = []
    this.activeUsers = 0
    this.peakConcurrentUsers = 0
    
    if (this.config.monitoring?.enableMemoryTracking) {
      this.startMemoryTracking()
    }
    
    if (this.config.monitoring?.enableCpuTracking) {
      this.startCpuTracking()
    }
    
    if (this.config.monitoring?.enableGcTracking) {
      this.startGcTracking()
    }
  }

  /**
   * Records a single request timing
   */
  recordTiming(durationMs: number, endpoint?: string): void {
    this.timings.push(durationMs)
  }

  /**
   * Records an error
   */
  recordError(error: string, endpoint: string, statusCode?: number): void {
    this.errors.push({
      timestamp: performance.now(),
      error,
      endpoint,
      statusCode
    })
  }

  /**
   * Updates active user count
   */
  updateActiveUsers(count: number): void {
    this.activeUsers = count
    this.peakConcurrentUsers = Math.max(this.peakConcurrentUsers, count)
    this.userConcurrencyTimeline.push({
      timestamp: performance.now(),
      count
    })
  }

  /**
   * Records timeline snapshot
   */
  recordTimelineSnapshot(): void {
    const now = performance.now()
    const recentTimings = this.timings.slice(-100) // Last 100 requests
    const recentErrors = this.errors.filter(e => now - e.timestamp < 10000) // Last 10 seconds
    
    this.timeline.push({
      timestamp: now,
      activeUsers: this.activeUsers,
      requestsPerSecond: this.calculateCurrentRps(),
      averageResponseTime: recentTimings.length > 0 
        ? recentTimings.reduce((sum, t) => sum + t, 0) / recentTimings.length 
        : 0,
      errorRate: this.timings.length > 0 
        ? (recentErrors.length / Math.min(100, this.timings.length)) * 100 
        : 0
    })
  }

  /**
   * Ends measurement and returns results
   */
  end(): LoadTestResult {
    this.endTime = performance.now()
    const totalDuration = this.endTime - this.startTime

    // Clean up all monitoring intervals
    this.intervals.forEach(interval => clearInterval(interval))
    this.intervals = []

    return {
      testName: this.config.name,
      startTime: this.startTime,
      endTime: this.endTime,
      totalDuration,
      metrics: this.calculateMetrics(totalDuration),
      rawTimings: [...this.timings],
      errors: [...this.errors],
      timeline: [...this.timeline]
    }
  }

  /**
   * Measures and records a single operation
   */
  async measureOperation<T>(
    operation: () => Promise<T>, 
    endpoint: string = 'unknown'
  ): Promise<T> {
    const start = performance.now()
    
    try {
      const result = await operation()
      this.recordTiming(performance.now() - start, endpoint)
      return result
    } catch (error) {
      const statusCode = error && typeof error === 'object' && 'status' in error 
        ? (error as any).status 
        : undefined
      this.recordError(error instanceof Error ? error.message : String(error), endpoint, statusCode)
      throw error
    }
  }

  private calculateMetrics(totalDuration: number): PerformanceMetrics {
    const sortedTimings = [...this.timings].sort((a, b) => a - b)
    const errorsByType: Record<string, number> = {}
    
    // Categorize errors
    this.errors.forEach(error => {
      const errorType = this.categorizeError(error)
      errorsByType[errorType] = (errorsByType[errorType] || 0) + 1
    })

    // Calculate response time statistics
    const mean = sortedTimings.length > 0 
      ? sortedTimings.reduce((sum, t) => sum + t, 0) / sortedTimings.length 
      : 0
    
    const variance = sortedTimings.length > 0
      ? sortedTimings.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / sortedTimings.length
      : 0
    
    const standardDeviation = Math.sqrt(variance)

    // Calculate average concurrent users
    const averageConcurrentUsers = this.userConcurrencyTimeline.length > 0
      ? this.userConcurrencyTimeline.reduce((sum, point) => sum + point.count, 0) / this.userConcurrencyTimeline.length
      : 0

    return {
      responseTime: {
        min: sortedTimings.length > 0 ? sortedTimings[0] : 0,
        max: sortedTimings.length > 0 ? sortedTimings[sortedTimings.length - 1] : 0,
        mean,
        median: this.calculatePercentile(sortedTimings, 50),
        p95: this.calculatePercentile(sortedTimings, 95),
        p99: this.calculatePercentile(sortedTimings, 99),
        standardDeviation
      },
      throughput: {
        requestsPerSecond: totalDuration > 0 ? (sortedTimings.length / totalDuration) * 1000 : 0,
        requestsPerMinute: totalDuration > 0 ? (sortedTimings.length / totalDuration) * 60000 : 0,
        totalRequests: sortedTimings.length,
        duration: totalDuration
      },
      errors: {
        totalErrors: this.errors.length,
        errorRate: sortedTimings.length > 0 ? (this.errors.length / (sortedTimings.length + this.errors.length)) * 100 : 0,
        errorsByType,
        timeouts: this.errors.filter(e => e.error.toLowerCase().includes('timeout')).length
      },
      resources: {
        memoryUsage: this.resourceUsage.length > 0 ? this.resourceUsage[this.resourceUsage.length - 1] : undefined,
        cpuTimes: this.cpuUsage.length > 0 ? this.cpuUsage[this.cpuUsage.length - 1] : undefined,
        gcMetrics: this.gcData.length > 0 ? {
          totalCollections: this.gcData.reduce((sum, gc) => sum + gc.collections, 0),
          totalTime: this.gcData.reduce((sum, gc) => sum + gc.time, 0)
        } : undefined
      },
      concurrency: {
        targetUsers: this.config.users.target,
        actualConcurrentPeak: this.peakConcurrentUsers,
        averageConcurrentUsers,
        userRampupTime: this.config.users.rampupTimeMs
      }
    }
  }

  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0
    
    const index = (percentile / 100) * (sortedArray.length - 1)
    const lower = Math.floor(index)
    const upper = Math.ceil(index)
    
    if (lower === upper) {
      return sortedArray[lower]
    }
    
    const weight = index - lower
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight
  }

  private categorizeError(error: { error: string; statusCode?: number }): string {
    if (error.statusCode) {
      if (error.statusCode >= 500) return 'server_error'
      if (error.statusCode >= 400) return 'client_error'
      if (error.statusCode >= 300) return 'redirect'
    }
    
    if (error.error.toLowerCase().includes('timeout')) return 'timeout'
    if (error.error.toLowerCase().includes('network')) return 'network'
    if (error.error.toLowerCase().includes('connection')) return 'connection'
    
    return 'unknown'
  }

  private calculateCurrentRps(): number {
    const now = performance.now()
    const recentRequests = this.timings.filter((_, index) => {
      // Approximate timing based on index and current time
      return true // Simplified for now
    })
    
    return recentRequests.length / 10 // Requests per 10-second window
  }

  private startMemoryTracking(): void {
    const interval = setInterval(() => {
      this.resourceUsage.push(process.memoryUsage())
      
      // Limit memory samples to prevent memory leaks
      const maxSamples = this.config.monitoring?.maxSamples || 1000
      if (this.resourceUsage.length > maxSamples) {
        this.resourceUsage.splice(0, this.resourceUsage.length - maxSamples)
      }
    }, this.config.monitoring?.sampleIntervalMs || 1000)

    this.intervals.push(interval)
  }

  private startCpuTracking(): void {
    let lastCpuUsage = process.cpuUsage()
    
    const interval = setInterval(() => {
      const currentCpuUsage = process.cpuUsage(lastCpuUsage)
      this.cpuUsage.push(currentCpuUsage)
      lastCpuUsage = process.cpuUsage()
      
      // Limit CPU samples to prevent memory leaks
      const maxSamples = this.config.monitoring?.maxSamples || 1000
      if (this.cpuUsage.length > maxSamples) {
        this.cpuUsage.splice(0, this.cpuUsage.length - maxSamples)
      }
    }, this.config.monitoring?.sampleIntervalMs || 1000)

    this.intervals.push(interval)
  }

  private startGcTracking(): void {
    // Simple GC tracking implementation
    let gcCount = 0
    let gcTime = 0
    
    const interval = setInterval(() => {
      // This is a simplified version - in practice you'd use perf_hooks
      this.gcData.push({ collections: gcCount, time: gcTime })
      
      // Limit GC samples to prevent memory leaks
      const maxSamples = this.config.monitoring?.maxSamples || 1000
      if (this.gcData.length > maxSamples) {
        this.gcData.splice(0, this.gcData.length - maxSamples)
      }
    }, this.config.monitoring?.sampleIntervalMs || 1000)

    this.intervals.push(interval)
  }
}

/**
 * Load test execution engine
 */
export class LoadTestRunner {
  private measurement: PerformanceMeasurement
  private abortController = new AbortController()
  private activeSessions = new Set<Promise<void>>()

  constructor(
    private config: LoadTestConfig,
    private client: PromptlianoClient,
    private scenarios: EndpointTestScenario[]
  ) {
    this.measurement = new PerformanceMeasurement(config)
  }

  /**
   * Executes the load test
   */
  async run(): Promise<LoadTestResult> {
    console.log(`🚀 Starting load test: ${this.config.name}`)
    console.log(`📊 Target: ${this.config.users.initial} → ${this.config.users.target} users over ${this.config.users.rampupTimeMs}ms`)
    
    this.measurement.start()

    try {
      // Setup phase
      await this.setupScenarios()

      // Execute load test phases
      await this.executeRampup()
      await this.executeSustain()
      
      if (this.config.users.rampdownTimeMs) {
        await this.executeRampdown()
      }

      // Teardown phase
      await this.teardownScenarios()

    } catch (error) {
      console.error('❌ Load test failed:', error)
      this.measurement.recordError(error instanceof Error ? error.message : String(error), 'test_execution')
    } finally {
      this.abortController.abort()
      // Wait for all active sessions to complete or timeout
      await this.waitForSessionsToComplete()
    }

    const result = this.measurement.end()
    console.log(`✅ Load test completed: ${result.metrics.throughput.totalRequests} requests, ${result.metrics.errors.errorRate.toFixed(2)}% errors`)
    
    return result
  }

  /**
   * Stops the load test early
   */
  async stop(): Promise<void> {
    this.abortController.abort()
    await this.waitForSessionsToComplete()
  }

  /**
   * Waits for all active sessions to complete with timeout
   */
  private async waitForSessionsToComplete(timeoutMs: number = 10000): Promise<void> {
    if (this.activeSessions.size === 0) return

    console.log(`⏳ Waiting for ${this.activeSessions.size} active sessions to complete...`)
    
    try {
      // Wait for all sessions with timeout
      await Promise.race([
        Promise.allSettled(this.activeSessions),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Session cleanup timeout')), timeoutMs)
        )
      ])
    } catch (error) {
      console.warn('⚠️ Some sessions did not complete gracefully:', error)
    }
    
    this.activeSessions.clear()
  }

  private async setupScenarios(): Promise<void> {
    for (const scenario of this.scenarios) {
      if (scenario.setup) {
        await scenario.setup(this.client, this.createScenarioContext(0, 0))
      }
    }
  }

  private async teardownScenarios(): Promise<void> {
    for (const scenario of this.scenarios) {
      if (scenario.teardown) {
        try {
          await scenario.teardown(this.client, this.createScenarioContext(0, 0))
        } catch (error) {
          console.warn(`Teardown error for scenario ${scenario.name}:`, error)
        }
      }
    }
  }

  private async executeRampup(): Promise<void> {
    const { initial, target, rampupTimeMs } = this.config.users
    const userIncrement = target - initial
    const stepDuration = rampupTimeMs / userIncrement
    
    console.log(`📈 Ramping up from ${initial} to ${target} users over ${rampupTimeMs}ms`)

    for (let currentUsers = initial; currentUsers <= target; currentUsers++) {
      if (this.abortController.signal.aborted) break

      this.measurement.updateActiveUsers(currentUsers)
      this.startUserSession(currentUsers)
      
      if (currentUsers < target) {
        await this.sleep(stepDuration)
      }
    }
  }

  private async executeSustain(): Promise<void> {
    const { sustainTimeMs } = this.config.users
    console.log(`⏱️  Sustaining ${this.config.users.target} users for ${sustainTimeMs}ms`)

    const sustainStart = Date.now()
    const timelineInterval = setInterval(() => {
      this.measurement.recordTimelineSnapshot()
    }, 5000) // Record timeline every 5 seconds

    try {
      while (Date.now() - sustainStart < sustainTimeMs && !this.abortController.signal.aborted) {
        await this.sleep(1000)
      }
    } finally {
      clearInterval(timelineInterval)
    }
  }

  private async executeRampdown(): Promise<void> {
    const { target, rampdownTimeMs } = this.config.users
    const stepDuration = rampdownTimeMs! / target
    
    console.log(`📉 Ramping down from ${target} to 0 users over ${rampdownTimeMs}ms`)

    for (let currentUsers = target; currentUsers > 0; currentUsers--) {
      if (this.abortController.signal.aborted) break

      this.measurement.updateActiveUsers(currentUsers)
      
      if (currentUsers > 0) {
        await this.sleep(stepDuration)
      }
    }
  }

  private async startUserSession(userId: number): Promise<void> {
    // Start user session in background with proper tracking
    const sessionPromise = this.runUserSession(userId).catch(error => {
      this.measurement.recordError(
        error instanceof Error ? error.message : String(error),
        `user_session_${userId}`
      )
    }).finally(() => {
      // Remove session from active set when completed
      this.activeSessions.delete(sessionPromise)
    })

    // Track the session for cleanup
    this.activeSessions.add(sessionPromise)
  }

  private async runUserSession(userId: number): Promise<void> {
    const maxRequests = this.config.requests.requestsPerUser || 10
    let iterationCount = 0

    while (iterationCount < maxRequests && !this.abortController.signal.aborted) {
      try {
        // Select scenario based on weight
        const scenario = this.selectScenario()
        const context = this.createScenarioContext(userId, iterationCount)

        // Execute scenario with measurement
        await this.measurement.measureOperation(
          () => scenario.execute(this.client, context),
          scenario.name
        )

        // Think time between requests
        if (this.config.requests.thinkTimeMs) {
          await this.sleep(this.config.requests.thinkTimeMs)
        }

        iterationCount++
      } catch (error) {
        // Error already recorded by measureOperation
        
        // Decide whether to continue or stop this user session
        if (this.shouldStopOnError(error)) {
          break
        }
      }
    }
  }

  private selectScenario(): EndpointTestScenario {
    // Weighted random selection
    const totalWeight = this.scenarios.reduce((sum, scenario) => sum + scenario.weight, 0)
    let random = Math.random() * totalWeight
    
    for (const scenario of this.scenarios) {
      random -= scenario.weight
      if (random <= 0) {
        return scenario
      }
    }
    
    // Fallback to first scenario
    return this.scenarios[0]
  }

  private createScenarioContext(userId: number, iterationCount: number): ScenarioContext {
    return {
      userId,
      iterationCount,
      testData: {},
      sharedState: {}
    }
  }

  private shouldStopOnError(error: any): boolean {
    // Stop user session on certain critical errors
    if (error && typeof error === 'object' && error.status === 401) {
      return true // Unauthorized - stop this user
    }
    
    return false
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * Performance regression detection utilities
 */
export class PerformanceRegression {
  /**
   * Compares current results with baseline
   */
  static compareWithBaseline(
    current: LoadTestResult,
    baseline: LoadTestResult,
    thresholds: {
      responseTimeDegradation?: number // Percentage
      throughputDegradation?: number // Percentage
      errorRateIncrease?: number // Percentage points
    } = {}
  ): {
    passed: boolean
    issues: string[]
    metrics: {
      responseTimeChange: number
      throughputChange: number
      errorRateChange: number
    }
  } {
    const issues: string[] = []
    
    // Compare response times
    const responseTimeChange = ((current.metrics.responseTime.mean - baseline.metrics.responseTime.mean) / baseline.metrics.responseTime.mean) * 100
    const responseTimeThreshold = thresholds.responseTimeDegradation || 20
    
    if (responseTimeChange > responseTimeThreshold) {
      issues.push(`Response time degraded by ${responseTimeChange.toFixed(1)}% (threshold: ${responseTimeThreshold}%)`)
    }

    // Compare throughput
    const throughputChange = ((current.metrics.throughput.requestsPerSecond - baseline.metrics.throughput.requestsPerSecond) / baseline.metrics.throughput.requestsPerSecond) * 100
    const throughputThreshold = thresholds.throughputDegradation || -15
    
    if (throughputChange < throughputThreshold) {
      issues.push(`Throughput degraded by ${Math.abs(throughputChange).toFixed(1)}% (threshold: ${Math.abs(throughputThreshold)}%)`)
    }

    // Compare error rates
    const errorRateChange = current.metrics.errors.errorRate - baseline.metrics.errors.errorRate
    const errorRateThreshold = thresholds.errorRateIncrease || 5
    
    if (errorRateChange > errorRateThreshold) {
      issues.push(`Error rate increased by ${errorRateChange.toFixed(1)} percentage points (threshold: ${errorRateThreshold})`)
    }

    return {
      passed: issues.length === 0,
      issues,
      metrics: {
        responseTimeChange,
        throughputChange,
        errorRateChange
      }
    }
  }

  /**
   * Saves test results for future baseline comparison
   */
  static async saveBaseline(result: LoadTestResult, filePath: string): Promise<void> {
    try {
      const fs = await import('fs/promises')
      await fs.writeFile(filePath, JSON.stringify(result, null, 2))
    } catch (error) {
      console.warn('Failed to save performance baseline:', error)
    }
  }

  /**
   * Loads baseline results from file
   */
  static async loadBaseline(filePath: string): Promise<LoadTestResult | null> {
    try {
      const fs = await import('fs/promises')
      const data = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(data)
    } catch (error) {
      console.warn('Failed to load performance baseline:', error)
      return null
    }
  }
}

/**
 * Performance reporting utilities
 */
export class PerformanceReporter {
  /**
   * Generates a comprehensive performance report
   */
  static generateReport(result: LoadTestResult): string {
    const { metrics, testName, totalDuration } = result
    
    return `
# Performance Test Report: ${testName}

## Overview
- **Duration**: ${(totalDuration / 1000).toFixed(2)}s
- **Total Requests**: ${metrics.throughput.totalRequests}
- **Target Users**: ${metrics.concurrency.targetUsers}
- **Peak Concurrent Users**: ${metrics.concurrency.actualConcurrentPeak}

## Response Time Analysis
- **Mean**: ${metrics.responseTime.mean.toFixed(2)}ms
- **Median (P50)**: ${metrics.responseTime.median.toFixed(2)}ms
- **95th Percentile**: ${metrics.responseTime.p95.toFixed(2)}ms
- **99th Percentile**: ${metrics.responseTime.p99.toFixed(2)}ms
- **Min**: ${metrics.responseTime.min.toFixed(2)}ms
- **Max**: ${metrics.responseTime.max.toFixed(2)}ms
- **Standard Deviation**: ${metrics.responseTime.standardDeviation.toFixed(2)}ms

## Throughput Analysis
- **Requests/Second**: ${metrics.throughput.requestsPerSecond.toFixed(2)}
- **Requests/Minute**: ${metrics.throughput.requestsPerMinute.toFixed(0)}

## Error Analysis
- **Total Errors**: ${metrics.errors.totalErrors}
- **Error Rate**: ${metrics.errors.errorRate.toFixed(2)}%
- **Timeouts**: ${metrics.errors.timeouts}

### Error Breakdown
${Object.entries(metrics.errors.errorsByType)
  .map(([type, count]) => `- **${type}**: ${count}`)
  .join('\n') || 'No errors'}

## Resource Utilization
${metrics.resources.memoryUsage ? `
### Memory Usage
- **RSS**: ${(metrics.resources.memoryUsage.rss / 1024 / 1024).toFixed(2)} MB
- **Heap Used**: ${(metrics.resources.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB
- **Heap Total**: ${(metrics.resources.memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB
- **External**: ${(metrics.resources.memoryUsage.external / 1024 / 1024).toFixed(2)} MB
` : ''}

${metrics.resources.gcMetrics ? `
### Garbage Collection
- **Total Collections**: ${metrics.resources.gcMetrics.totalCollections}
- **Total Time**: ${metrics.resources.gcMetrics.totalTime.toFixed(2)}ms
` : ''}

## Performance Assessment
${this.assessPerformance(metrics)}

---
*Report generated on ${new Date().toISOString()}*
    `.trim()
  }

  /**
   * Provides performance assessment based on metrics
   */
  private static assessPerformance(metrics: PerformanceMetrics): string {
    const assessments: string[] = []

    // Response time assessment
    if (metrics.responseTime.p95 < 100) {
      assessments.push('✅ **Excellent response times** (P95 < 100ms)')
    } else if (metrics.responseTime.p95 < 500) {
      assessments.push('🟡 **Good response times** (P95 < 500ms)')
    } else if (metrics.responseTime.p95 < 1000) {
      assessments.push('🟠 **Acceptable response times** (P95 < 1s)')
    } else {
      assessments.push('❌ **Poor response times** (P95 > 1s)')
    }

    // Error rate assessment
    if (metrics.errors.errorRate < 0.1) {
      assessments.push('✅ **Excellent reliability** (< 0.1% errors)')
    } else if (metrics.errors.errorRate < 1) {
      assessments.push('🟡 **Good reliability** (< 1% errors)')
    } else if (metrics.errors.errorRate < 5) {
      assessments.push('🟠 **Acceptable reliability** (< 5% errors)')
    } else {
      assessments.push('❌ **Poor reliability** (> 5% errors)')
    }

    // Throughput assessment
    if (metrics.throughput.requestsPerSecond > 100) {
      assessments.push('✅ **High throughput** (> 100 RPS)')
    } else if (metrics.throughput.requestsPerSecond > 50) {
      assessments.push('🟡 **Good throughput** (> 50 RPS)')
    } else if (metrics.throughput.requestsPerSecond > 10) {
      assessments.push('🟠 **Moderate throughput** (> 10 RPS)')
    } else {
      assessments.push('❌ **Low throughput** (< 10 RPS)')
    }

    return assessments.join('\n')
  }

  /**
   * Exports results to JSON
   */
  static exportToJson(result: LoadTestResult): string {
    return JSON.stringify(result, null, 2)
  }

  /**
   * Exports results to CSV format
   */
  static exportToCsv(result: LoadTestResult): string {
    const headers = [
      'timestamp',
      'response_time_ms',
      'endpoint',
      'success',
      'error_type'
    ]

    const rows = result.rawTimings.map((timing, index) => {
      const error = result.errors[index]
      return [
        result.startTime + (index * (result.totalDuration / result.rawTimings.length)),
        timing.toFixed(2),
        error?.endpoint || 'unknown',
        error ? 'false' : 'true',
        error?.error || ''
      ].join(',')
    })

    return [headers.join(','), ...rows].join('\n')
  }
}