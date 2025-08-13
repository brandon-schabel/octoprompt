/**
 * Monitoring Hooks System
 * Lifecycle hooks and observability for all operations
 */

import { Effect, Metric, MetricRegistry, Ref, Duration, pipe } from 'effect'
import type { OptimizedPrompt, PromptAnalysis } from '../types'

// ============================================================================
// Event Types
// ============================================================================

export type MonitoringEventType = 
  | 'optimization_start'
  | 'optimization_complete'
  | 'optimization_error'
  | 'analysis_start'
  | 'analysis_complete'
  | 'analysis_error'
  | 'cache_hit'
  | 'cache_miss'
  | 'cache_eviction'
  | 'provider_request'
  | 'provider_response'
  | 'provider_error'
  | 'plugin_initialized'
  | 'plugin_error'

export interface MonitoringEvent {
  readonly type: MonitoringEventType
  readonly timestamp: number
  readonly data: Record<string, unknown>
  readonly duration?: number
  readonly error?: unknown
  readonly metadata?: {
    readonly optimizerId?: string
    readonly providerId?: string
    readonly pluginId?: string
    readonly cacheKey?: string
    readonly userId?: string
    readonly sessionId?: string
    readonly traceId?: string
  }
}

export interface OptimizationEvent extends MonitoringEvent {
  readonly type: 'optimization_start' | 'optimization_complete' | 'optimization_error'
  readonly data: {
    readonly prompt: string
    readonly optimizer: string
    readonly context?: any
    readonly result?: OptimizedPrompt
    readonly error?: unknown
  }
}

export interface CacheEvent extends MonitoringEvent {
  readonly type: 'cache_hit' | 'cache_miss' | 'cache_eviction'
  readonly data: {
    readonly key: string
    readonly storage: string
    readonly size?: number
    readonly ttl?: number
  }
}

// ============================================================================
// Hook Interfaces
// ============================================================================

export interface MonitoringHooks {
  readonly onOptimizationStart?: (event: OptimizationEvent) => Effect.Effect<void, never>
  readonly onOptimizationComplete?: (event: OptimizationEvent) => Effect.Effect<void, never>
  readonly onOptimizationError?: (event: OptimizationEvent) => Effect.Effect<void, never>
  readonly onCacheHit?: (event: CacheEvent) => Effect.Effect<void, never>
  readonly onCacheMiss?: (event: CacheEvent) => Effect.Effect<void, never>
  readonly onEvent?: (event: MonitoringEvent) => Effect.Effect<void, never>
}

// ============================================================================
// Metrics Registry
// ============================================================================

export interface PromptEngineerMetrics {
  // Counters
  readonly optimizationCount: Metric.Metric.Counter<number>
  readonly cacheHits: Metric.Metric.Counter<number>
  readonly cacheMisses: Metric.Metric.Counter<number>
  readonly errors: Metric.Metric.Counter<number>
  
  // Histograms
  readonly optimizationDuration: Metric.Metric.Histogram<number>
  readonly tokenReduction: Metric.Metric.Histogram<number>
  readonly improvementScore: Metric.Metric.Histogram<number>
  readonly cacheSize: Metric.Metric.Histogram<number>
  
  // Gauges
  readonly activeOptimizations: Metric.Metric.Gauge<number>
  readonly cacheUtilization: Metric.Metric.Gauge<number>
  readonly memoryUsage: Metric.Metric.Gauge<number>
}

export const createMetrics = (): PromptEngineerMetrics => ({
  // Counters
  optimizationCount: Metric.counter('prompt_engineer.optimizations.total', {
    description: 'Total number of optimizations performed'
  }),
  cacheHits: Metric.counter('prompt_engineer.cache.hits', {
    description: 'Number of cache hits'
  }),
  cacheMisses: Metric.counter('prompt_engineer.cache.misses', {
    description: 'Number of cache misses'
  }),
  errors: Metric.counter('prompt_engineer.errors.total', {
    description: 'Total number of errors'
  }),
  
  // Histograms
  optimizationDuration: Metric.histogram('prompt_engineer.optimization.duration_ms', {
    description: 'Optimization duration in milliseconds',
    boundaries: [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000]
  }),
  tokenReduction: Metric.histogram('prompt_engineer.token.reduction_percent', {
    description: 'Token reduction percentage',
    boundaries: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
  }),
  improvementScore: Metric.histogram('prompt_engineer.improvement.score', {
    description: 'Improvement score',
    boundaries: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
  }),
  cacheSize: Metric.histogram('prompt_engineer.cache.size_bytes', {
    description: 'Cache entry size in bytes',
    boundaries: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000]
  }),
  
  // Gauges
  activeOptimizations: Metric.gauge('prompt_engineer.optimizations.active', {
    description: 'Number of active optimizations'
  }),
  cacheUtilization: Metric.gauge('prompt_engineer.cache.utilization_percent', {
    description: 'Cache utilization percentage'
  }),
  memoryUsage: Metric.gauge('prompt_engineer.memory.usage_mb', {
    description: 'Memory usage in megabytes'
  })
})

// ============================================================================
// Monitoring Service
// ============================================================================

export class MonitoringService {
  private hooks: MonitoringHooks
  private metrics: PromptEngineerMetrics
  private events: Ref.Ref<MonitoringEvent[]>
  private maxEventHistory: number

  constructor(
    hooks: MonitoringHooks = {},
    enableMetrics: boolean = true,
    maxEventHistory: number = 1000
  ) {
    this.hooks = hooks
    this.metrics = createMetrics()
    this.events = Ref.unsafeMake<MonitoringEvent[]>([])
    this.maxEventHistory = maxEventHistory
  }

  /**
   * Record an event
   */
  recordEvent(event: MonitoringEvent): Effect.Effect<void, never> {
    return Effect.gen(function* (_) {
      // Store event in history
      yield* _(Ref.update(this.events, (events) => {
        const updated = [...events, event]
        // Keep only the last N events
        return updated.slice(-this.maxEventHistory)
      }))
      
      // Call general event hook
      if (this.hooks.onEvent) {
        yield* _(this.hooks.onEvent(event))
      }
      
      // Call specific hooks based on event type
      switch (event.type) {
        case 'optimization_start':
          if (this.hooks.onOptimizationStart) {
            yield* _(this.hooks.onOptimizationStart(event as OptimizationEvent))
          }
          yield* _(this.metrics.activeOptimizations.update(1))
          break
          
        case 'optimization_complete':
          if (this.hooks.onOptimizationComplete) {
            yield* _(this.hooks.onOptimizationComplete(event as OptimizationEvent))
          }
          yield* _(this.metrics.activeOptimizations.update(-1))
          yield* _(this.metrics.optimizationCount.update(1))
          
          if (event.duration) {
            yield* _(this.metrics.optimizationDuration.update(event.duration))
          }
          
          const optimizationData = event.data as any
          if (optimizationData.result?.improvementScore) {
            yield* _(this.metrics.improvementScore.update(optimizationData.result.improvementScore))
          }
          break
          
        case 'optimization_error':
          if (this.hooks.onOptimizationError) {
            yield* _(this.hooks.onOptimizationError(event as OptimizationEvent))
          }
          yield* _(this.metrics.activeOptimizations.update(-1))
          yield* _(this.metrics.errors.update(1))
          break
          
        case 'cache_hit':
          if (this.hooks.onCacheHit) {
            yield* _(this.hooks.onCacheHit(event as CacheEvent))
          }
          yield* _(this.metrics.cacheHits.update(1))
          break
          
        case 'cache_miss':
          if (this.hooks.onCacheMiss) {
            yield* _(this.hooks.onCacheMiss(event as CacheEvent))
          }
          yield* _(this.metrics.cacheMisses.update(1))
          break
      }
    }.bind(this))
  }

  /**
   * Start timing an operation
   */
  startTimer(): {
    stop: () => number
    stopAndRecord: (type: MonitoringEventType, data: Record<string, unknown>) => Effect.Effect<void, never>
  } {
    const startTime = Date.now()
    
    return {
      stop: () => Date.now() - startTime,
      stopAndRecord: (type: MonitoringEventType, data: Record<string, unknown>) => {
        const duration = Date.now() - startTime
        return this.recordEvent({
          type,
          timestamp: Date.now(),
          duration,
          data
        })
      }
    }
  }

  /**
   * Wrap an Effect with monitoring
   */
  monitor<R, E, A>(
    effect: Effect.Effect<A, E, R>,
    options: {
      name: string
      type?: 'optimization' | 'analysis' | 'cache' | 'provider'
      metadata?: Record<string, unknown>
    }
  ): Effect.Effect<A, E, R> {
    const timer = this.startTimer()
    const startType = `${options.type || 'optimization'}_start` as MonitoringEventType
    const completeType = `${options.type || 'optimization'}_complete` as MonitoringEventType
    const errorType = `${options.type || 'optimization'}_error` as MonitoringEventType
    
    return pipe(
      Effect.Do,
      Effect.tap(() => this.recordEvent({
        type: startType,
        timestamp: Date.now(),
        data: {
          name: options.name,
          ...options.metadata
        }
      })),
      Effect.flatMap(() => effect),
      Effect.tap((result) => timer.stopAndRecord(completeType, {
        name: options.name,
        result,
        ...options.metadata
      })),
      Effect.catchAll((error) => 
        pipe(
          timer.stopAndRecord(errorType, {
            name: options.name,
            error: String(error),
            ...options.metadata
          }),
          Effect.flatMap(() => Effect.fail(error))
        )
      )
    )
  }

  /**
   * Get event history
   */
  getEventHistory(): Effect.Effect<readonly MonitoringEvent[], never> {
    return Ref.get(this.events)
  }

  /**
   * Get metrics snapshot
   */
  getMetricsSnapshot(): Effect.Effect<Record<string, number>, never> {
    return Effect.gen(function* (_) {
      const snapshot: Record<string, number> = {}
      
      // Get counter values
      snapshot['optimizations.total'] = yield* _(Metric.value(this.metrics.optimizationCount))
      snapshot['cache.hits'] = yield* _(Metric.value(this.metrics.cacheHits))
      snapshot['cache.misses'] = yield* _(Metric.value(this.metrics.cacheMisses))
      snapshot['errors.total'] = yield* _(Metric.value(this.metrics.errors))
      
      // Get gauge values
      snapshot['optimizations.active'] = yield* _(Metric.value(this.metrics.activeOptimizations))
      
      // Calculate cache hit rate
      const hits = snapshot['cache.hits']
      const misses = snapshot['cache.misses']
      const total = hits + misses
      snapshot['cache.hit_rate'] = total > 0 ? (hits / total) * 100 : 0
      
      // Get memory usage
      if (typeof process !== 'undefined' && process.memoryUsage) {
        const memUsage = process.memoryUsage()
        snapshot['memory.heap_used_mb'] = memUsage.heapUsed / 1024 / 1024
        snapshot['memory.heap_total_mb'] = memUsage.heapTotal / 1024 / 1024
      }
      
      return snapshot
    }.bind(this))
  }

  /**
   * Clear event history
   */
  clearHistory(): Effect.Effect<void, never> {
    return Ref.set(this.events, [])
  }

  /**
   * Export metrics for external monitoring systems
   */
  exportMetrics(format: 'prometheus' | 'json' = 'json'): Effect.Effect<string, never> {
    return Effect.gen(function* (_) {
      const snapshot = yield* _(this.getMetricsSnapshot())
      
      if (format === 'prometheus') {
        // Format as Prometheus metrics
        const lines: string[] = []
        for (const [key, value] of Object.entries(snapshot)) {
          const metricName = `prompt_engineer_${key.replace(/\./g, '_')}`
          lines.push(`${metricName} ${value}`)
        }
        return lines.join('\n')
      } else {
        // Format as JSON
        return JSON.stringify(snapshot, null, 2)
      }
    }.bind(this))
  }
}

// ============================================================================
// Global Monitoring Instance
// ============================================================================

let globalMonitoring: MonitoringService | null = null

/**
 * Get or create the global monitoring service
 */
export function getMonitoringService(hooks?: MonitoringHooks): MonitoringService {
  if (!globalMonitoring) {
    globalMonitoring = new MonitoringService(hooks)
  } else if (hooks) {
    // Update hooks if provided
    globalMonitoring = new MonitoringService(hooks)
  }
  return globalMonitoring
}

/**
 * Set custom monitoring hooks
 */
export function setMonitoringHooks(hooks: MonitoringHooks): void {
  globalMonitoring = new MonitoringService(hooks)
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Record an optimization event
 */
export function recordOptimization(
  prompt: string,
  optimizer: string,
  result?: OptimizedPrompt,
  duration?: number,
  error?: unknown
): Effect.Effect<void, never> {
  const monitoring = getMonitoringService()
  const event: OptimizationEvent = {
    type: error ? 'optimization_error' : 'optimization_complete',
    timestamp: Date.now(),
    duration,
    data: {
      prompt,
      optimizer,
      result,
      error
    }
  }
  return monitoring.recordEvent(event)
}

/**
 * Record a cache event
 */
export function recordCacheEvent(
  type: 'hit' | 'miss' | 'eviction',
  key: string,
  storage: string,
  size?: number
): Effect.Effect<void, never> {
  const monitoring = getMonitoringService()
  const event: CacheEvent = {
    type: `cache_${type}` as any,
    timestamp: Date.now(),
    data: {
      key,
      storage,
      size
    }
  }
  return monitoring.recordEvent(event)
}