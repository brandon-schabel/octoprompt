/**
 * Monitoring System Exports
 * Comprehensive monitoring, metrics, and observability
 */

export * from './hooks'
export * from './metrics'

import { Effect, pipe } from 'effect'
import { MonitoringService, getMonitoringService, type MonitoringHooks } from './hooks'
import { MetricsCollector, getMetricsCollector } from './metrics'
import type { OptimizedPrompt } from '../types'

// ============================================================================
// Unified Monitoring Interface
// ============================================================================

export interface MonitoringConfig {
  enabled?: boolean
  hooks?: MonitoringHooks
  metrics?: {
    enabled?: boolean
    aggregationInterval?: number
    retentionPeriod?: number
  }
  export?: {
    format?: 'prometheus' | 'json'
    endpoint?: string
    interval?: number
  }
}

export class UnifiedMonitoring {
  private monitoring: MonitoringService
  private metrics: MetricsCollector
  private config: MonitoringConfig

  constructor(config: MonitoringConfig = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      hooks: config.hooks || {},
      metrics: {
        enabled: config.metrics?.enabled ?? true,
        aggregationInterval: config.metrics?.aggregationInterval || 60000,
        retentionPeriod: config.metrics?.retentionPeriod || 3600000
      },
      export: config.export
    }

    this.monitoring = new MonitoringService(this.config.hooks)
    this.metrics = new MetricsCollector(this.config.metrics)
  }

  /**
   * Initialize monitoring
   */
  initialize(): Effect.Effect<void, never> {
    return Effect.gen(
      function* (_) {
        if (this.config.metrics?.enabled) {
          yield* _(this.metrics.startAggregation())
        }

        if (this.config.export?.endpoint && this.config.export.interval) {
          yield* _(this.startExport())
        }
      }.bind(this)
    )
  }

  /**
   * Shutdown monitoring
   */
  shutdown(): Effect.Effect<void, never> {
    return Effect.gen(
      function* (_) {
        yield* _(this.metrics.stopAggregation())
        // Export final metrics
        if (this.config.export?.endpoint) {
          yield* _(this.exportMetrics())
        }
      }.bind(this)
    )
  }

  /**
   * Monitor an optimization
   */
  monitorOptimization<E>(
    optimizer: string,
    prompt: string,
    optimization: Effect.Effect<OptimizedPrompt, E, any>
  ): Effect.Effect<OptimizedPrompt, E, any> {
    if (!this.config.enabled) {
      return optimization
    }

    const timer = this.monitoring.startTimer()

    return pipe(
      Effect.Do,
      Effect.tap(() =>
        this.monitoring.recordEvent({
          type: 'optimization_start',
          timestamp: Date.now(),
          data: { prompt, optimizer }
        })
      ),
      Effect.flatMap(() => optimization),
      Effect.tap((result) => {
        const duration = timer.stop()

        // Record to monitoring
        return Effect.all([
          this.monitoring.recordEvent({
            type: 'optimization_complete',
            timestamp: Date.now(),
            duration,
            data: { prompt, optimizer, result }
          }),
          // Record to metrics
          this.metrics.recordOptimization(optimizer, prompt, result, duration)
        ])
      }),
      Effect.catchAll((error) => {
        const duration = timer.stop()

        return pipe(
          Effect.all([
            this.monitoring.recordEvent({
              type: 'optimization_error',
              timestamp: Date.now(),
              duration,
              data: { prompt, optimizer, error: String(error) },
              error
            }),
            this.metrics.record(`optimization.failure.${optimizer}`, 1)
          ]),
          Effect.flatMap(() => Effect.fail(error))
        )
      })
    )
  }

  /**
   * Monitor cache operations
   */
  monitorCache<T, E>(
    operation: 'get' | 'set' | 'delete',
    key: string,
    storage: string,
    effect: Effect.Effect<T, E, any>
  ): Effect.Effect<T, E, any> {
    if (!this.config.enabled) {
      return effect
    }

    return pipe(
      effect,
      Effect.tap((result) => {
        if (operation === 'get' && result !== null) {
          return this.monitoring.recordEvent({
            type: 'cache_hit',
            timestamp: Date.now(),
            data: { key, storage }
          })
        } else if (operation === 'get') {
          return this.monitoring.recordEvent({
            type: 'cache_miss',
            timestamp: Date.now(),
            data: { key, storage }
          })
        }
        return Effect.succeed(undefined)
      })
    )
  }

  /**
   * Get monitoring dashboard data
   */
  getDashboard(): Effect.Effect<
    {
      events: any[]
      metrics: Record<string, any>
      optimization: any
      health: {
        status: 'healthy' | 'degraded' | 'unhealthy'
        uptime: number
        errors: number
      }
    },
    never
  > {
    return Effect.gen(
      function* (_) {
        const events = yield* _(this.monitoring.getEventHistory())
        const metrics = yield* _(this.monitoring.getMetricsSnapshot())
        const optimization = yield* _(this.metrics.getOptimizationReport())

        // Calculate health status
        const errorRate = metrics['errors.total'] / Math.max(1, metrics['optimizations.total'])
        const status = errorRate < 0.01 ? 'healthy' : errorRate < 0.05 ? 'degraded' : 'unhealthy'

        return {
          events: Array.from(events).slice(-100), // Last 100 events
          metrics,
          optimization,
          health: {
            status,
            uptime: Date.now(), // Would track actual start time
            errors: metrics['errors.total'] || 0
          }
        }
      }.bind(this)
    )
  }

  /**
   * Export metrics to external system
   */
  private exportMetrics(): Effect.Effect<void, never> {
    return Effect.gen(
      function* (_) {
        if (!this.config.export?.endpoint) {
          return
        }

        const format = this.config.export.format || 'json'
        const data = yield* _(this.monitoring.exportMetrics(format))

        // Would send to endpoint
        // await fetch(this.config.export.endpoint, {
        //   method: 'POST',
        //   body: data,
        //   headers: { 'Content-Type': format === 'json' ? 'application/json' : 'text/plain' }
        // })
      }.bind(this)
    )
  }

  /**
   * Start periodic metric export
   */
  private startExport(): Effect.Effect<void, never> {
    // Would implement periodic export
    return Effect.succeed(undefined)
  }

  /**
   * Get monitoring service
   */
  getMonitoringService(): MonitoringService {
    return this.monitoring
  }

  /**
   * Get metrics collector
   */
  getMetricsCollector(): MetricsCollector {
    return this.metrics
  }
}

// ============================================================================
// Global Instance
// ============================================================================

let globalUnifiedMonitoring: UnifiedMonitoring | null = null

/**
 * Get or create unified monitoring
 */
export function getUnifiedMonitoring(config?: MonitoringConfig): UnifiedMonitoring {
  if (!globalUnifiedMonitoring) {
    globalUnifiedMonitoring = new UnifiedMonitoring(config)
  }
  return globalUnifiedMonitoring
}

/**
 * Initialize global monitoring
 */
export function initializeMonitoring(config?: MonitoringConfig): Effect.Effect<void, never> {
  const monitoring = getUnifiedMonitoring(config)
  return monitoring.initialize()
}

/**
 * Shutdown global monitoring
 */
export function shutdownMonitoring(): Effect.Effect<void, never> {
  if (!globalUnifiedMonitoring) {
    return Effect.succeed(undefined)
  }
  return globalUnifiedMonitoring.shutdown()
}

// ============================================================================
// Convenience Decorators (for future use)
// ============================================================================

/**
 * Decorator to monitor a method
 * Usage: @monitored('myOperation')
 */
export function monitored(name: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value

    descriptor.value = function (...args: any[]) {
      const monitoring = getMonitoringService()
      const timer = monitoring.startTimer()

      try {
        const result = originalMethod.apply(this, args)

        if (result && typeof result.then === 'function') {
          // Handle async methods
          return result.then(
            (value: any) => {
              timer.stopAndRecord('optimization_complete', { name, args })
              return value
            },
            (error: any) => {
              timer.stopAndRecord('optimization_error', { name, args, error })
              throw error
            }
          )
        }

        // Handle sync methods
        timer.stopAndRecord('optimization_complete', { name, args })
        return result
      } catch (error) {
        timer.stopAndRecord('optimization_error', { name, args, error })
        throw error
      }
    }

    return descriptor
  }
}
