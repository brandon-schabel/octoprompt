/**
 * Metrics Collection System
 * Advanced metrics for optimization performance and quality
 */

import { Effect, Ref, HashMap, Option, pipe, Schedule, Duration } from 'effect'
import type { OptimizedPrompt } from '../types'

// ============================================================================
// Metric Types
// ============================================================================

export interface MetricValue {
  readonly value: number
  readonly timestamp: number
  readonly tags?: Record<string, string>
}

export interface MetricSummary {
  readonly count: number
  readonly sum: number
  readonly min: number
  readonly max: number
  readonly mean: number
  readonly median: number
  readonly p50: number
  readonly p75: number
  readonly p90: number
  readonly p95: number
  readonly p99: number
  readonly stdDev: number
}

export interface TimeSeriesData {
  readonly metric: string
  readonly values: readonly MetricValue[]
  readonly summary: MetricSummary
  readonly period: {
    readonly start: number
    readonly end: number
  }
}

// ============================================================================
// Optimization Metrics
// ============================================================================

export interface OptimizationMetrics {
  // Performance metrics
  readonly duration: number
  readonly throughput: number // Optimizations per second
  readonly latency: {
    readonly p50: number
    readonly p95: number
    readonly p99: number
  }
  
  // Quality metrics
  readonly tokenReduction: number // Percentage
  readonly improvementScore: number
  readonly consistency: number // Variance across runs
  readonly reliability: number // Success rate
  
  // Resource metrics
  readonly memoryUsage: number // MB
  readonly cpuUsage: number // Percentage
  readonly apiCalls: number
  readonly cacheHitRate: number
  
  // Cost metrics
  readonly estimatedCost: number
  readonly costPerToken: number
  readonly savingsPerOptimization: number
}

// ============================================================================
// Metrics Collector
// ============================================================================

export class MetricsCollector {
  private metrics: Ref.Ref<HashMap.HashMap<string, MetricValue[]>>
  private aggregationInterval: number
  private retentionPeriod: number
  private aggregationSchedule: any = null

  constructor(options: {
    aggregationInterval?: number // ms
    retentionPeriod?: number // ms
  } = {}) {
    this.metrics = Ref.unsafeMake(HashMap.empty())
    this.aggregationInterval = options.aggregationInterval || 60000 // 1 minute
    this.retentionPeriod = options.retentionPeriod || 3600000 // 1 hour
  }

  /**
   * Start automatic aggregation
   */
  startAggregation(): Effect.Effect<void, never> {
    return Effect.gen(function* (_) {
      // Schedule periodic aggregation
      this.aggregationSchedule = yield* _(
        Effect.repeat(
          this.aggregateMetrics(),
          Schedule.fixed(Duration.millis(this.aggregationInterval))
        ).pipe(
          Effect.fork // Run in background
        )
      )
    }.bind(this))
  }

  /**
   * Stop automatic aggregation
   */
  stopAggregation(): Effect.Effect<void, never> {
    return Effect.sync(() => {
      if (this.aggregationSchedule) {
        // Would need proper fiber cancellation in real implementation
        this.aggregationSchedule = null
      }
    })
  }

  /**
   * Record a metric value
   */
  record(
    metric: string,
    value: number,
    tags?: Record<string, string>
  ): Effect.Effect<void, never> {
    return Ref.update(this.metrics, (map) => {
      const existing = HashMap.get(map, metric)
      const metricValue: MetricValue = {
        value,
        timestamp: Date.now(),
        tags
      }
      
      if (Option.isSome(existing)) {
        return HashMap.set(map, metric, [...existing.value, metricValue])
      } else {
        return HashMap.set(map, metric, [metricValue])
      }
    })
  }

  /**
   * Record optimization metrics
   */
  recordOptimization(
    optimizer: string,
    original: string,
    optimized: OptimizedPrompt,
    duration: number
  ): Effect.Effect<void, never> {
    return Effect.gen(function* (_) {
      const originalTokens = this.estimateTokens(original)
      const optimizedTokens = optimized.estimatedTokens
      const tokenReduction = ((originalTokens - optimizedTokens) / originalTokens) * 100
      
      // Record various metrics
      yield* _(this.record(`optimization.duration.${optimizer}`, duration))
      yield* _(this.record(`optimization.token_reduction.${optimizer}`, tokenReduction))
      yield* _(this.record(`optimization.improvement_score.${optimizer}`, optimized.improvementScore))
      yield* _(this.record(`optimization.tokens.original`, originalTokens))
      yield* _(this.record(`optimization.tokens.optimized`, optimizedTokens))
      
      // Record cost metrics
      const costPerToken = 0.00002 // Example cost
      const originalCost = originalTokens * costPerToken
      const optimizedCost = optimizedTokens * costPerToken
      const savings = originalCost - optimizedCost
      
      yield* _(this.record(`optimization.cost.original`, originalCost))
      yield* _(this.record(`optimization.cost.optimized`, optimizedCost))
      yield* _(this.record(`optimization.cost.savings`, savings))
      
      // Record strategy metrics
      for (const technique of optimized.optimizationStrategy.techniques) {
        yield* _(this.record(`optimization.technique.${technique}`, 1))
      }
      
      yield* _(this.record(`optimization.confidence.${optimizer}`, 
        optimized.optimizationStrategy.confidence))
    }.bind(this))
  }

  /**
   * Get metric summary
   */
  getSummary(metric: string): Effect.Effect<MetricSummary | null, never> {
    return Effect.gen(function* (_) {
      const metricsMap = yield* _(Ref.get(this.metrics))
      const values = HashMap.get(metricsMap, metric)
      
      if (Option.isNone(values) || values.value.length === 0) {
        return null
      }
      
      return this.calculateSummary(values.value)
    }.bind(this))
  }

  /**
   * Get time series data
   */
  getTimeSeries(
    metric: string,
    start?: number,
    end?: number
  ): Effect.Effect<TimeSeriesData | null, never> {
    return Effect.gen(function* (_) {
      const metricsMap = yield* _(Ref.get(this.metrics))
      const values = HashMap.get(metricsMap, metric)
      
      if (Option.isNone(values)) {
        return null
      }
      
      const now = Date.now()
      const startTime = start || now - this.retentionPeriod
      const endTime = end || now
      
      // Filter values within time range
      const filteredValues = values.value.filter(v => 
        v.timestamp >= startTime && v.timestamp <= endTime
      )
      
      if (filteredValues.length === 0) {
        return null
      }
      
      return {
        metric,
        values: filteredValues,
        summary: this.calculateSummary(filteredValues),
        period: {
          start: startTime,
          end: endTime
        }
      }
    }.bind(this))
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Effect.Effect<Record<string, MetricSummary>, never> {
    return Effect.gen(function* (_) {
      const metricsMap = yield* _(Ref.get(this.metrics))
      const result: Record<string, MetricSummary> = {}
      
      for (const [name, values] of HashMap.entries(metricsMap)) {
        if (values.length > 0) {
          result[name] = this.calculateSummary(values)
        }
      }
      
      return result
    }.bind(this))
  }

  /**
   * Get optimization report
   */
  getOptimizationReport(optimizer?: string): Effect.Effect<OptimizationMetrics, never> {
    return Effect.gen(function* (_) {
      const prefix = optimizer ? `optimization.*.${optimizer}` : 'optimization.*'
      const allMetrics = yield* _(this.getAllMetrics())
      
      // Extract relevant metrics
      const durationMetrics = this.filterMetrics(allMetrics, 'duration')
      const tokenMetrics = this.filterMetrics(allMetrics, 'token_reduction')
      const scoreMetrics = this.filterMetrics(allMetrics, 'improvement_score')
      const costMetrics = this.filterMetrics(allMetrics, 'cost')
      
      // Calculate aggregate metrics
      const totalOptimizations = Object.values(durationMetrics)
        .reduce((sum, m) => sum + m.count, 0)
      
      const avgDuration = Object.values(durationMetrics)
        .reduce((sum, m) => sum + m.mean, 0) / Math.max(1, Object.keys(durationMetrics).length)
      
      const throughput = totalOptimizations > 0 
        ? (totalOptimizations / (Date.now() - this.getOldestTimestamp())) * 1000
        : 0
      
      // Get cache metrics
      const cacheHits = allMetrics['cache.hits']?.count || 0
      const cacheMisses = allMetrics['cache.misses']?.count || 0
      const cacheTotal = cacheHits + cacheMisses
      const cacheHitRate = cacheTotal > 0 ? (cacheHits / cacheTotal) * 100 : 0
      
      return {
        duration: avgDuration,
        throughput,
        latency: {
          p50: this.getPercentileFromMetrics(durationMetrics, 'p50'),
          p95: this.getPercentileFromMetrics(durationMetrics, 'p95'),
          p99: this.getPercentileFromMetrics(durationMetrics, 'p99')
        },
        tokenReduction: this.getAverageFromMetrics(tokenMetrics),
        improvementScore: this.getAverageFromMetrics(scoreMetrics),
        consistency: this.getConsistencyFromMetrics(scoreMetrics),
        reliability: this.getReliabilityRate(allMetrics),
        memoryUsage: this.getMemoryUsage(),
        cpuUsage: 0, // Would need system metrics
        apiCalls: allMetrics['api.calls']?.count || 0,
        cacheHitRate,
        estimatedCost: this.getTotalCost(costMetrics),
        costPerToken: this.getAverageCostPerToken(costMetrics),
        savingsPerOptimization: this.getAverageSavings(costMetrics)
      }
    }.bind(this))
  }

  /**
   * Clear old metrics
   */
  private aggregateMetrics(): Effect.Effect<void, never> {
    return Ref.update(this.metrics, (map) => {
      const now = Date.now()
      const cutoff = now - this.retentionPeriod
      
      // Remove old values from each metric
      return HashMap.map(map, (values) => 
        values.filter(v => v.timestamp > cutoff)
      )
    })
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(values: MetricValue[]): MetricSummary {
    if (values.length === 0) {
      return {
        count: 0,
        sum: 0,
        min: 0,
        max: 0,
        mean: 0,
        median: 0,
        p50: 0,
        p75: 0,
        p90: 0,
        p95: 0,
        p99: 0,
        stdDev: 0
      }
    }
    
    const sorted = values.map(v => v.value).sort((a, b) => a - b)
    const count = sorted.length
    const sum = sorted.reduce((a, b) => a + b, 0)
    const mean = sum / count
    
    // Calculate percentiles
    const percentile = (p: number) => {
      const index = Math.ceil(count * p / 100) - 1
      return sorted[Math.min(index, count - 1)]
    }
    
    // Calculate standard deviation
    const variance = sorted.reduce((acc, val) => 
      acc + Math.pow(val - mean, 2), 0) / count
    const stdDev = Math.sqrt(variance)
    
    return {
      count,
      sum,
      min: sorted[0],
      max: sorted[count - 1],
      mean,
      median: percentile(50),
      p50: percentile(50),
      p75: percentile(75),
      p90: percentile(90),
      p95: percentile(95),
      p99: percentile(99),
      stdDev
    }
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
  }

  private filterMetrics(
    metrics: Record<string, MetricSummary>,
    pattern: string
  ): Record<string, MetricSummary> {
    const result: Record<string, MetricSummary> = {}
    for (const [key, value] of Object.entries(metrics)) {
      if (key.includes(pattern)) {
        result[key] = value
      }
    }
    return result
  }

  private getPercentileFromMetrics(
    metrics: Record<string, MetricSummary>,
    percentile: keyof MetricSummary
  ): number {
    const values = Object.values(metrics).map(m => m[percentile] as number)
    return values.length > 0 
      ? values.reduce((a, b) => a + b, 0) / values.length
      : 0
  }

  private getAverageFromMetrics(metrics: Record<string, MetricSummary>): number {
    const values = Object.values(metrics).map(m => m.mean)
    return values.length > 0 
      ? values.reduce((a, b) => a + b, 0) / values.length
      : 0
  }

  private getConsistencyFromMetrics(metrics: Record<string, MetricSummary>): number {
    const stdDevs = Object.values(metrics).map(m => m.stdDev)
    if (stdDevs.length === 0) return 100
    
    const avgStdDev = stdDevs.reduce((a, b) => a + b, 0) / stdDevs.length
    const avgMean = this.getAverageFromMetrics(metrics)
    
    // Consistency as inverse of coefficient of variation
    const cv = avgMean > 0 ? avgStdDev / avgMean : 0
    return Math.max(0, Math.min(100, (1 - cv) * 100))
  }

  private getReliabilityRate(metrics: Record<string, MetricSummary>): number {
    const successes = metrics['optimization.success']?.count || 0
    const failures = metrics['optimization.failure']?.count || 0
    const total = successes + failures
    
    return total > 0 ? (successes / total) * 100 : 100
  }

  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed / 1024 / 1024
    }
    return 0
  }

  private getTotalCost(metrics: Record<string, MetricSummary>): number {
    return metrics['optimization.cost.optimized']?.sum || 0
  }

  private getAverageCostPerToken(metrics: Record<string, MetricSummary>): number {
    const totalCost = metrics['optimization.cost.optimized']?.sum || 0
    const totalTokens = metrics['optimization.tokens.optimized']?.sum || 1
    return totalCost / totalTokens
  }

  private getAverageSavings(metrics: Record<string, MetricSummary>): number {
    return metrics['optimization.cost.savings']?.mean || 0
  }

  private getOldestTimestamp(): number {
    // Would need to track this properly
    return Date.now() - this.retentionPeriod
  }
}

// ============================================================================
// Global Metrics Instance
// ============================================================================

let globalMetricsCollector: MetricsCollector | null = null

/**
 * Get or create the global metrics collector
 */
export function getMetricsCollector(): MetricsCollector {
  if (!globalMetricsCollector) {
    globalMetricsCollector = new MetricsCollector()
  }
  return globalMetricsCollector
}

/**
 * Record a metric value
 */
export function recordMetric(
  metric: string,
  value: number,
  tags?: Record<string, string>
): Effect.Effect<void, never> {
  return getMetricsCollector().record(metric, value, tags)
}

/**
 * Get optimization report
 */
export function getOptimizationReport(
  optimizer?: string
): Effect.Effect<OptimizationMetrics, never> {
  return getMetricsCollector().getOptimizationReport(optimizer)
}