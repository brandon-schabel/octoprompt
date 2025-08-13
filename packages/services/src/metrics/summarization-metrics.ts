import { createLogger } from '../utils/logger'
import type { ProjectFile } from '@promptliano/schemas'

const logger = createLogger('SummarizationMetrics')

export interface SummarizationMetrics {
  fileId: number
  projectId: number
  tokensUsed: number
  tokensAvailable: number
  utilizationRate: number
  processingTime: number
  cacheHit: boolean
  truncated: boolean
  promptStrategy: string
  modelUsed: string
  timestamp: number
}

export interface AggregateMetrics {
  totalFiles: number
  totalTokensUsed: number
  averageUtilizationRate: number
  averageProcessingTime: number
  cacheHitRate: number
  truncationRate: number
  tokensSaved: number
  costSavings: number
  performanceScore: number
}

export interface BatchMetrics {
  batchId: string
  filesProcessed: number
  totalTokensUsed: number
  averageTokensPerFile: number
  processingTime: number
  efficiency: number
  errors: number
}

/**
 * Service for tracking and analyzing summarization performance metrics
 */
export class SummarizationMetricsService {
  private metrics: SummarizationMetrics[] = []
  private batchMetrics: BatchMetrics[] = []
  
  // Configuration constants
  private readonly MAX_METRICS_RETAINED = 10000
  private readonly MAX_BATCH_METRICS_RETAINED = 1000
  private readonly COST_PER_1K_TOKENS = 0.001 // Example cost
  private readonly OLD_TOKEN_LIMIT = 8000 // Previous token limit for comparison
  private readonly MS_PER_SECOND = 1000
  
  // Performance thresholds
  private readonly LOW_UTILIZATION_THRESHOLD = 0.5
  private readonly SLOW_PROCESSING_THRESHOLD_MS = 10000
  private readonly GOOD_UTILIZATION_THRESHOLD = 0.6
  private readonly GOOD_CACHE_HIT_THRESHOLD = 0.3
  private readonly HIGH_TRUNCATION_THRESHOLD = 0.5
  private readonly SLOW_AVG_PROCESSING_THRESHOLD_MS = 5000
  private readonly GOOD_PERFORMANCE_SCORE = 70
  private readonly EXCELLENT_PERFORMANCE_SCORE = 85

  /**
   * Record metrics for a single file summarization
   */
  recordFileMetrics(
    file: ProjectFile,
    metrics: {
      tokensUsed: number
      tokensAvailable: number
      processingTime: number
      cacheHit: boolean
      truncated: boolean
      promptStrategy: string
      modelUsed: string
    }
  ): void {
    const metric: SummarizationMetrics = {
      fileId: file.id,
      projectId: file.projectId,
      tokensUsed: metrics.tokensUsed,
      tokensAvailable: metrics.tokensAvailable,
      utilizationRate: metrics.tokensUsed / metrics.tokensAvailable,
      processingTime: metrics.processingTime,
      cacheHit: metrics.cacheHit,
      truncated: metrics.truncated,
      promptStrategy: metrics.promptStrategy,
      modelUsed: metrics.modelUsed,
      timestamp: Date.now()
    }

    this.metrics.push(metric)
    
    // Trim old metrics if needed
    if (this.metrics.length > this.MAX_METRICS_RETAINED) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS_RETAINED)
    }

    // Log performance issues
    if (metric.utilizationRate < this.LOW_UTILIZATION_THRESHOLD) {
      logger.warn(`Low token utilization for file ${file.path}: ${(metric.utilizationRate * 100).toFixed(1)}%`)
    }
    
    if (metric.processingTime > this.SLOW_PROCESSING_THRESHOLD_MS) {
      logger.warn(`Slow processing for file ${file.path}: ${metric.processingTime}ms`)
    }

    logger.debug(`Recorded metrics for file ${file.path}:`, {
      tokensUsed: metrics.tokensUsed,
      utilizationRate: `${(metric.utilizationRate * 100).toFixed(1)}%`,
      processingTime: `${metrics.processingTime}ms`,
      cacheHit: metrics.cacheHit
    })
  }

  /**
   * Record metrics for batch processing
   */
  recordBatchMetrics(
    batchId: string,
    filesProcessed: number,
    totalTokensUsed: number,
    processingTime: number,
    errors: number = 0
  ): void {
    const metric: BatchMetrics = {
      batchId,
      filesProcessed,
      totalTokensUsed,
      averageTokensPerFile: filesProcessed > 0 ? totalTokensUsed / filesProcessed : 0,
      processingTime,
      efficiency: filesProcessed > 0 ? (filesProcessed / processingTime) * this.MS_PER_SECOND : 0, // Files per second
      errors
    }

    this.batchMetrics.push(metric)
    
    // Trim old batch metrics
    if (this.batchMetrics.length > this.MAX_BATCH_METRICS_RETAINED) {
      this.batchMetrics = this.batchMetrics.slice(-this.MAX_BATCH_METRICS_RETAINED)
    }

    logger.info(`Batch ${batchId} completed:`, {
      filesProcessed,
      totalTokensUsed,
      averageTokensPerFile: metric.averageTokensPerFile.toFixed(0),
      processingTime: `${processingTime}ms`,
      efficiency: `${metric.efficiency.toFixed(2)} files/sec`
    })
  }

  /**
   * Get aggregate metrics for a project
   */
  getProjectMetrics(projectId: number, timeWindowMs?: number): AggregateMetrics {
    const cutoff = timeWindowMs ? Date.now() - timeWindowMs : 0
    const projectMetrics = this.metrics.filter(m => 
      m.projectId === projectId && m.timestamp > cutoff
    )

    if (projectMetrics.length === 0) {
      return this.getEmptyMetrics()
    }

    const totalTokensUsed = projectMetrics.reduce((sum, m) => sum + m.tokensUsed, 0)
    const totalTokensAvailable = projectMetrics.reduce((sum, m) => sum + m.tokensAvailable, 0)
    const totalProcessingTime = projectMetrics.reduce((sum, m) => sum + m.processingTime, 0)
    const cacheHits = projectMetrics.filter(m => m.cacheHit).length
    const truncated = projectMetrics.filter(m => m.truncated).length

    // Calculate tokens saved through optimization
    const baselineTokens = projectMetrics.length * this.OLD_TOKEN_LIMIT
    const tokensSaved = Math.max(0, baselineTokens - totalTokensUsed)
    const costSavings = (tokensSaved / this.MS_PER_SECOND) * this.COST_PER_1K_TOKENS

    // Calculate performance score (0-100)
    const utilizationScore = (totalTokensUsed / totalTokensAvailable) * 30
    const cacheScore = (cacheHits / projectMetrics.length) * 30
    const speedScore = Math.min(30, (30000 / (totalProcessingTime / projectMetrics.length)) * 30)
    const errorScore = 10 // Full score if no errors

    return {
      totalFiles: projectMetrics.length,
      totalTokensUsed,
      averageUtilizationRate: totalTokensUsed / totalTokensAvailable,
      averageProcessingTime: totalProcessingTime / projectMetrics.length,
      cacheHitRate: cacheHits / projectMetrics.length,
      truncationRate: truncated / projectMetrics.length,
      tokensSaved,
      costSavings,
      performanceScore: Math.round(utilizationScore + cacheScore + speedScore + errorScore)
    }
  }

  /**
   * Get metrics for all projects
   */
  getGlobalMetrics(timeWindowMs?: number): AggregateMetrics {
    const cutoff = timeWindowMs ? Date.now() - timeWindowMs : 0
    const recentMetrics = this.metrics.filter(m => m.timestamp > cutoff)

    if (recentMetrics.length === 0) {
      return this.getEmptyMetrics()
    }

    const totalTokensUsed = recentMetrics.reduce((sum, m) => sum + m.tokensUsed, 0)
    const totalTokensAvailable = recentMetrics.reduce((sum, m) => sum + m.tokensAvailable, 0)
    const totalProcessingTime = recentMetrics.reduce((sum, m) => sum + m.processingTime, 0)
    const cacheHits = recentMetrics.filter(m => m.cacheHit).length
    const truncated = recentMetrics.filter(m => m.truncated).length

    // Calculate tokens saved
    const baselineTokens = recentMetrics.length * this.OLD_TOKEN_LIMIT
    const tokensSaved = Math.max(0, baselineTokens - totalTokensUsed)
    const costSavings = (tokensSaved / this.MS_PER_SECOND) * this.COST_PER_1K_TOKENS

    return {
      totalFiles: recentMetrics.length,
      totalTokensUsed,
      averageUtilizationRate: totalTokensUsed / totalTokensAvailable,
      averageProcessingTime: totalProcessingTime / recentMetrics.length,
      cacheHitRate: cacheHits / recentMetrics.length,
      truncationRate: truncated / recentMetrics.length,
      tokensSaved,
      costSavings,
      performanceScore: this.calculatePerformanceScore(recentMetrics)
    }
  }

  /**
   * Get batch processing metrics
   */
  getBatchMetrics(batchId?: string): BatchMetrics[] {
    if (batchId) {
      return this.batchMetrics.filter(m => m.batchId === batchId)
    }
    return this.batchMetrics
  }

  /**
   * Get optimization recommendations
   */
  getOptimizationRecommendations(projectId: number): string[] {
    const metrics = this.getProjectMetrics(projectId)
    const recommendations: string[] = []

    // Token utilization recommendations
    if (metrics.averageUtilizationRate < this.GOOD_UTILIZATION_THRESHOLD) {
      recommendations.push(
        `Low token utilization (${(metrics.averageUtilizationRate * 100).toFixed(1)}%). ` +
        `Consider increasing MAX_TOKENS_FOR_SUMMARY or batch processing more files together.`
      )
    }

    // Cache recommendations
    if (metrics.cacheHitRate < this.GOOD_CACHE_HIT_THRESHOLD) {
      recommendations.push(
        `Low cache hit rate (${(metrics.cacheHitRate * 100).toFixed(1)}%). ` +
        `Consider increasing cache TTL or warming cache on project load.`
      )
    }

    // Truncation recommendations
    if (metrics.truncationRate > this.HIGH_TRUNCATION_THRESHOLD) {
      recommendations.push(
        `High truncation rate (${(metrics.truncationRate * 100).toFixed(1)}%). ` +
        `Many files are being truncated. Consider adjusting truncation strategies or token limits.`
      )
    }

    // Processing speed recommendations
    if (metrics.averageProcessingTime > this.SLOW_AVG_PROCESSING_THRESHOLD_MS) {
      recommendations.push(
        `Slow average processing time (${metrics.averageProcessingTime.toFixed(0)}ms). ` +
        `Consider batch processing or using a faster model for initial passes.`
      )
    }

    // Performance score
    if (metrics.performanceScore < this.GOOD_PERFORMANCE_SCORE) {
      recommendations.push(
        `Overall performance score is ${metrics.performanceScore}/100. ` +
        `Review the above recommendations to improve efficiency.`
      )
    } else if (metrics.performanceScore > this.EXCELLENT_PERFORMANCE_SCORE) {
      recommendations.push(
        `Excellent performance score: ${metrics.performanceScore}/100! ` +
        `Current settings are well-optimized.`
      )
    }

    return recommendations
  }

  /**
   * Generate a performance report
   */
  generateReport(projectId?: number): string {
    const metrics = projectId ? this.getProjectMetrics(projectId) : this.getGlobalMetrics()
    const recommendations = projectId ? this.getOptimizationRecommendations(projectId) : []

    const report = `
=== Summarization Performance Report ===
${projectId ? `Project ID: ${projectId}` : 'Global Metrics'}
Generated: ${new Date().toISOString()}

Summary Statistics:
- Total Files Processed: ${metrics.totalFiles}
- Total Tokens Used: ${metrics.totalTokensUsed.toLocaleString()}
- Average Token Utilization: ${(metrics.averageUtilizationRate * 100).toFixed(1)}%
- Average Processing Time: ${metrics.averageProcessingTime.toFixed(0)}ms
- Cache Hit Rate: ${(metrics.cacheHitRate * 100).toFixed(1)}%
- Truncation Rate: ${(metrics.truncationRate * 100).toFixed(1)}%

Efficiency Metrics:
- Tokens Saved: ${metrics.tokensSaved.toLocaleString()} (vs. old 8k limit)
- Estimated Cost Savings: $${metrics.costSavings.toFixed(2)}
- Performance Score: ${metrics.performanceScore}/100

${recommendations.length > 0 ? `
Optimization Recommendations:
${recommendations.map(r => `- ${r}`).join('\n')}
` : ''}

Recent Batch Processing:
${this.batchMetrics.slice(-5).map(b => 
  `- Batch ${b.batchId}: ${b.filesProcessed} files, ${b.totalTokensUsed} tokens, ${b.efficiency.toFixed(2)} files/sec`
).join('\n')}
`.trim()

    return report
  }

  /**
   * Calculate performance score for metrics
   */
  private calculatePerformanceScore(metrics: SummarizationMetrics[]): number {
    if (metrics.length === 0) return 0

    const avgUtilization = metrics.reduce((sum, m) => sum + m.utilizationRate, 0) / metrics.length
    const cacheHitRate = metrics.filter(m => m.cacheHit).length / metrics.length
    const avgProcessingTime = metrics.reduce((sum, m) => sum + m.processingTime, 0) / metrics.length
    
    // Score components (each out of 25)
    const utilizationScore = Math.min(25, avgUtilization * 25)
    const cacheScore = cacheHitRate * 25
    const speedScore = Math.min(25, (5000 / avgProcessingTime) * 25)
    const consistencyScore = 25 // Full score if we got here without errors

    return Math.round(utilizationScore + cacheScore + speedScore + consistencyScore)
  }

  /**
   * Get empty metrics object
   */
  private getEmptyMetrics(): AggregateMetrics {
    return {
      totalFiles: 0,
      totalTokensUsed: 0,
      averageUtilizationRate: 0,
      averageProcessingTime: 0,
      cacheHitRate: 0,
      truncationRate: 0,
      tokensSaved: 0,
      costSavings: 0,
      performanceScore: 0
    }
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics = []
    this.batchMetrics = []
    logger.info('Cleared all summarization metrics')
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(): {
    fileMetrics: SummarizationMetrics[]
    batchMetrics: BatchMetrics[]
    timestamp: number
  } {
    return {
      fileMetrics: this.metrics,
      batchMetrics: this.batchMetrics,
      timestamp: Date.now()
    }
  }
}

// Export singleton instance
export const summarizationMetrics = new SummarizationMetricsService()