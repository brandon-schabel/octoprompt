import type { QueueItem } from '@promptliano/schemas'

// Performance metrics collection
export class QueuePerformanceMonitor {
  private metrics: {
    throughput: number[]
    latency: number[]
    memoryUsage: number[]
    queryTimes: Map<string, number[]>
  }

  constructor() {
    this.metrics = {
      throughput: [],
      latency: [],
      memoryUsage: [],
      queryTimes: new Map()
    }
  }

  // Throughput measurement
  async measureThroughput(operation: () => Promise<void>, itemCount: number): Promise<number> {
    const startTime = performance.now()
    await operation()
    const endTime = performance.now()

    const duration = endTime - startTime
    const throughput = (itemCount / duration) * 1000 // items per second

    this.metrics.throughput.push(throughput)
    return throughput
  }

  // Latency tracking
  async measureLatency<T>(operation: () => Promise<T>): Promise<{ result: T; latency: number }> {
    const startTime = performance.now()
    const result = await operation()
    const endTime = performance.now()

    const latency = endTime - startTime
    this.metrics.latency.push(latency)

    return { result, latency }
  }

  // Memory usage monitoring
  captureMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage()
      const totalMemory = usage.heapUsed + usage.external
      this.metrics.memoryUsage.push(totalMemory)
      return totalMemory
    }
    return 0
  }

  // Database query profiling
  async profileQuery<T>(queryName: string, query: () => Promise<T>): Promise<{ result: T; time: number }> {
    const startTime = performance.now()
    const result = await query()
    const endTime = performance.now()

    const time = endTime - startTime

    if (!this.metrics.queryTimes.has(queryName)) {
      this.metrics.queryTimes.set(queryName, [])
    }
    this.metrics.queryTimes.get(queryName)!.push(time)

    return { result, time }
  }

  // Get statistics
  getStats() {
    return {
      throughput: this.calculateStats(this.metrics.throughput),
      latency: this.calculateStats(this.metrics.latency),
      memoryUsage: this.calculateStats(this.metrics.memoryUsage),
      queryTimes: this.getQueryStats()
    }
  }

  private calculateStats(values: number[]) {
    if (values.length === 0) {
      return { min: 0, max: 0, avg: 0, median: 0, p95: 0, p99: 0 }
    }

    const sorted = [...values].sort((a, b) => a - b)
    const sum = values.reduce((a, b) => a + b, 0)

    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / values.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    }
  }

  private getQueryStats() {
    const stats: Record<string, any> = {}
    for (const [name, times] of this.metrics.queryTimes) {
      stats[name] = this.calculateStats(times)
    }
    return stats
  }

  // Reset metrics
  reset() {
    this.metrics = {
      throughput: [],
      latency: [],
      memoryUsage: [],
      queryTimes: new Map()
    }
  }
}

// Load testing utilities
export class QueueLoadTester {
  constructor(
    private queueService: any,
    private monitor: QueuePerformanceMonitor
  ) {}

  // Test concurrent enqueue operations
  async testConcurrentEnqueue(
    queueId: number,
    itemCount: number,
    concurrency: number = 10
  ): Promise<{
    totalTime: number
    throughput: number
    errors: number
  }> {
    const startTime = performance.now()
    let errors = 0

    // Create batches
    const batchSize = Math.ceil(itemCount / concurrency)
    const batches: Promise<any>[] = []

    for (let i = 0; i < concurrency; i++) {
      const batch = async () => {
        for (let j = 0; j < batchSize && i * batchSize + j < itemCount; j++) {
          try {
            await this.queueService.enqueueItem(queueId, {
              taskId: Math.floor(Math.random() * 100000),
              priority: Math.floor(Math.random() * 10)
            })
          } catch (error) {
            errors++
          }
        }
      }
      batches.push(batch())
    }

    await Promise.all(batches)

    const totalTime = performance.now() - startTime
    const throughput = (itemCount / totalTime) * 1000

    return { totalTime, throughput, errors }
  }

  // Test processing throughput
  async testProcessingThroughput(
    queueId: number,
    agentCount: number,
    duration: number
  ): Promise<{
    processedCount: number
    throughput: number
    avgLatency: number
  }> {
    const agents: string[] = []
    for (let i = 0; i < agentCount; i++) {
      agents.push(`agent-${i}`)
    }

    const startTime = performance.now()
    let processedCount = 0
    const latencies: number[] = []

    // Run agents for specified duration
    const agentPromises = agents.map(async (agentId) => {
      while (performance.now() - startTime < duration) {
        const itemStart = performance.now()

        const result = await this.queueService.getNextTaskFromQueue(queueId, agentId)
        if (!result.queueItem) {
          // No more items, wait a bit
          await new Promise((resolve) => setTimeout(resolve, 100))
          continue
        }

        // Simulate processing
        await new Promise((resolve) => setTimeout(resolve, 50))

        // Complete the item
        await this.queueService.updateQueueItem(result.queueItem.id, {
          status: 'completed'
        })

        const itemLatency = performance.now() - itemStart
        latencies.push(itemLatency)
        processedCount++
      }
    })

    await Promise.all(agentPromises)

    const totalTime = performance.now() - startTime
    const throughput = (processedCount / totalTime) * 1000
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length

    return { processedCount, throughput, avgLatency }
  }

  // Stress test with increasing load
  async stressTest(
    queueId: number,
    stages: Array<{ duration: number; rate: number }>
  ): Promise<{
    stages: Array<{
      rate: number
      successCount: number
      errorCount: number
      avgLatency: number
    }>
  }> {
    const results: any[] = []

    for (const stage of stages) {
      const stageStart = performance.now()
      let successCount = 0
      let errorCount = 0
      const latencies: number[] = []

      // Calculate interval between requests
      const interval = 1000 / stage.rate // milliseconds between requests

      while (performance.now() - stageStart < stage.duration) {
        const requestStart = performance.now()

        try {
          await this.queueService.enqueueItem(queueId, {
            taskId: Math.floor(Math.random() * 100000),
            priority: 5
          })
          successCount++
        } catch (error) {
          errorCount++
        }

        const latency = performance.now() - requestStart
        latencies.push(latency)

        // Wait for next request
        const elapsed = performance.now() - requestStart
        if (elapsed < interval) {
          await new Promise((resolve) => setTimeout(resolve, interval - elapsed))
        }
      }

      results.push({
        rate: stage.rate,
        successCount,
        errorCount,
        avgLatency: latencies.reduce((a, b) => a + b, 0) / latencies.length
      })
    }

    return { stages: results }
  }
}

// Benchmark suite
export class QueueBenchmark {
  private results: Map<string, any> = new Map()

  async run(
    name: string,
    fn: () => Promise<void>,
    options: {
      warmup?: number
      iterations?: number
      timeout?: number
    } = {}
  ): Promise<{
    name: string
    iterations: number
    totalTime: number
    avgTime: number
    minTime: number
    maxTime: number
    opsPerSecond: number
  }> {
    const { warmup = 3, iterations = 100, timeout = 30000 } = options

    // Warmup runs
    for (let i = 0; i < warmup; i++) {
      await fn()
    }

    // Actual benchmark
    const times: number[] = []
    const startTotal = performance.now()

    for (let i = 0; i < iterations; i++) {
      if (performance.now() - startTotal > timeout) {
        console.warn(`Benchmark "${name}" timed out after ${i} iterations`)
        break
      }

      const start = performance.now()
      await fn()
      const end = performance.now()
      times.push(end - start)
    }

    const totalTime = performance.now() - startTotal
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length
    const minTime = Math.min(...times)
    const maxTime = Math.max(...times)
    const opsPerSecond = 1000 / avgTime

    const result = {
      name,
      iterations: times.length,
      totalTime,
      avgTime,
      minTime,
      maxTime,
      opsPerSecond
    }

    this.results.set(name, result)
    return result
  }

  async compare(
    benchmarks: Array<{ name: string; fn: () => Promise<void> }>,
    options?: any
  ): Promise<Map<string, any>> {
    for (const { name, fn } of benchmarks) {
      await this.run(name, fn, options)
    }

    return this.results
  }

  getResults() {
    return this.results
  }

  printResults() {
    console.table(Array.from(this.results.values()))
  }
}

// Helper to measure queue item processing lifecycle
export function measureItemLifecycle(item: QueueItem): {
  queueTime?: number
  processingTime?: number
  totalTime?: number
} {
  const result: any = {}

  if (item.startedAt && item.created) {
    result.queueTime = item.startedAt - item.created
  }

  if (item.completedAt && item.startedAt) {
    result.processingTime = item.completedAt - item.startedAt
  }

  if (item.completedAt && item.created) {
    result.totalTime = item.completedAt - item.created
  }

  return result
}
