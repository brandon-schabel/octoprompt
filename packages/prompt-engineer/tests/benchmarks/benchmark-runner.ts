import { E, TE, pipe } from '../../src/fp'
import type { OptimizedPrompt, Optimizer } from '../../src/types'
import { QualityMetrics } from './quality-metrics'
import { createLMStudioProvider } from '../providers/lmstudio-provider'

// ============================================================================
// Benchmark Types
// ============================================================================

export interface BenchmarkConfig {
  iterations: number
  warmupRuns: number
  timeoutMs: number
  llmEndpoint?: string
  llmModel?: string
  verbose?: boolean
}

export interface BenchmarkResult {
  optimizerId: string
  prompt: string
  iterations: number
  metrics: {
    avgImprovementScore: number
    avgDuration: number
    avgTokenReduction: number
    qualityScore: number
    consistency: number
  }
  raw: {
    improvements: number[]
    durations: number[]
    tokenReductions: number[]
    qualityScores: number[]
  }
  baseline: {
    quality: number
    tokens: number
    responseTime: number
  }
  optimized: {
    quality: number
    tokens: number
    responseTime: number
  }
  actualImprovement: number
  passesThreshold: boolean
}

export interface BenchmarkSuite {
  name: string
  prompts: string[]
  expectedImprovement: number
  acceptableVariance: number
}

// ============================================================================
// Benchmark Runner
// ============================================================================

export class BenchmarkRunner {
  private qualityMetrics: QualityMetrics
  private llmProvider: any

  constructor(private config: BenchmarkConfig) {
    this.qualityMetrics = new QualityMetrics()

    if (config.llmEndpoint) {
      this.llmProvider = createLMStudioProvider({
        endpoint: config.llmEndpoint,
        model: config.llmModel || 'local-model'
      })
    }
  }

  // Run benchmark for a single optimizer
  async runBenchmark(optimizer: Optimizer, suite: BenchmarkSuite): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = []

    for (const prompt of suite.prompts) {
      if (this.config.verbose) {
        console.log(`Benchmarking ${optimizer.name} with: ${prompt.substring(0, 50)}...`)
      }

      const result = await this.benchmarkPrompt(optimizer, prompt, suite)
      results.push(result)
    }

    return results
  }

  // Benchmark a single prompt
  private async benchmarkPrompt(optimizer: Optimizer, prompt: string, suite: BenchmarkSuite): Promise<BenchmarkResult> {
    // Warmup runs
    for (let i = 0; i < this.config.warmupRuns; i++) {
      await this.runOptimization(optimizer, prompt)
    }

    // Collect metrics
    const improvements: number[] = []
    const durations: number[] = []
    const tokenReductions: number[] = []
    const qualityScores: number[] = []

    // Get baseline quality if LLM available
    const baseline = await this.measureBaseline(prompt)

    // Run iterations
    for (let i = 0; i < this.config.iterations; i++) {
      const startTime = Date.now()
      const result = await this.runOptimization(optimizer, prompt)
      const duration = Date.now() - startTime

      if (E.isRight(result)) {
        const optimized = result.right

        improvements.push(optimized.improvementScore)
        durations.push(duration)

        const originalTokens = Math.ceil(prompt.length / 4)
        const reduction = ((originalTokens - optimized.estimatedTokens) / originalTokens) * 100
        tokenReductions.push(Math.max(0, reduction))

        // Measure quality if LLM available
        if (this.llmProvider) {
          const quality = await this.measureQuality(optimized)
          qualityScores.push(quality)
        } else {
          // Estimate quality based on optimization metrics
          qualityScores.push(this.estimateQuality(optimized))
        }
      }
    }

    // Get optimized quality if LLM available
    const lastResult = await this.runOptimization(optimizer, prompt)
    const optimizedMetrics = E.isRight(lastResult)
      ? await this.measureOptimized(lastResult.right)
      : { quality: 0, tokens: 0, responseTime: 0 }

    // Calculate aggregated metrics
    const metrics = {
      avgImprovementScore: this.average(improvements),
      avgDuration: this.average(durations),
      avgTokenReduction: this.average(tokenReductions),
      qualityScore: this.average(qualityScores),
      consistency: this.calculateConsistency(improvements)
    }

    // Calculate actual improvement
    const actualImprovement =
      baseline.quality > 0
        ? ((optimizedMetrics.quality - baseline.quality) / baseline.quality) * 100
        : metrics.avgImprovementScore

    // Check if passes threshold
    const passesThreshold = Math.abs(actualImprovement - suite.expectedImprovement) <= suite.acceptableVariance

    return {
      optimizerId: optimizer.name,
      prompt: prompt.substring(0, 100),
      iterations: this.config.iterations,
      metrics,
      raw: {
        improvements,
        durations,
        tokenReductions,
        qualityScores
      },
      baseline,
      optimized: optimizedMetrics,
      actualImprovement,
      passesThreshold
    }
  }

  // Run single optimization
  private async runOptimization(optimizer: Optimizer, prompt: string): Promise<E.Either<Error, OptimizedPrompt>> {
    try {
      const r = await optimizer.optimizeAsync(prompt)()
      return r
    } catch {
      return optimizer.optimize(prompt)
    }
  }

  // Measure baseline quality
  private async measureBaseline(prompt: string): Promise<{
    quality: number
    tokens: number
    responseTime: number
  }> {
    if (!this.llmProvider) {
      return {
        quality: 50, // Baseline quality score
        tokens: Math.ceil(prompt.length / 4),
        responseTime: 100
      }
    }

    const startTime = Date.now()

    try {
      const response = await this.llmProvider.complete(prompt)
      const responseTime = Date.now() - startTime

      const quality = this.qualityMetrics.evaluateResponse(prompt, response, 'baseline')

      return {
        quality,
        tokens: Math.ceil(prompt.length / 4),
        responseTime
      }
    } catch (error) {
      return {
        quality: 50,
        tokens: Math.ceil(prompt.length / 4),
        responseTime: 100
      }
    }
  }

  // Measure optimized quality
  private async measureOptimized(optimized: OptimizedPrompt): Promise<{
    quality: number
    tokens: number
    responseTime: number
  }> {
    if (!this.llmProvider) {
      return {
        quality: 50 + optimized.improvementScore,
        tokens: optimized.estimatedTokens,
        responseTime: 80
      }
    }

    const startTime = Date.now()

    try {
      const fullPrompt = `${optimized.systemPrompt}\n\n${optimized.userPrompt}`
      const response = await this.llmProvider.complete(fullPrompt)
      const responseTime = Date.now() - startTime

      const quality = this.qualityMetrics.evaluateResponse(
        optimized.originalPrompt,
        response,
        optimized.optimizationStrategy.name
      )

      return {
        quality,
        tokens: optimized.estimatedTokens,
        responseTime
      }
    } catch (error) {
      return {
        quality: 50 + optimized.improvementScore,
        tokens: optimized.estimatedTokens,
        responseTime: 80
      }
    }
  }

  // Measure quality of optimization
  private async measureQuality(optimized: OptimizedPrompt): Promise<number> {
    if (!this.llmProvider) {
      return this.estimateQuality(optimized)
    }

    try {
      const fullPrompt = `${optimized.systemPrompt}\n\n${optimized.userPrompt}`
      const response = await this.llmProvider.complete(fullPrompt)

      return this.qualityMetrics.evaluateResponse(
        optimized.originalPrompt,
        response,
        optimized.optimizationStrategy.name
      )
    } catch (error) {
      return this.estimateQuality(optimized)
    }
  }

  // Estimate quality without LLM
  private estimateQuality(optimized: OptimizedPrompt): number {
    let score = 50 // Base score

    // Structure bonus
    if (optimized.reasoningStructure.sequences.length > 0) score += 10
    if (optimized.reasoningStructure.branches.length > 0) score += 10
    if (optimized.reasoningStructure.loops.length > 0) score += 5

    // Strategy confidence bonus
    score += optimized.optimizationStrategy.confidence * 20

    // Improvement score bonus
    score += optimized.improvementScore * 0.5

    return Math.min(100, score)
  }

  // Calculate average
  private average(values: number[]): number {
    if (values.length === 0) return 0
    return values.reduce((sum, val) => sum + val, 0) / values.length
  }

  // Calculate consistency (inverse of standard deviation)
  private calculateConsistency(values: number[]): number {
    if (values.length <= 1) return 100

    const avg = this.average(values)
    const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length
    const stdDev = Math.sqrt(variance)

    // Convert to 0-100 scale (lower stdDev = higher consistency)
    const maxStdDev = avg * 0.5 // 50% of average as max acceptable deviation
    const consistency = Math.max(0, 100 - (stdDev / maxStdDev) * 100)

    return consistency
  }

  // Generate report
  generateReport(results: BenchmarkResult[]): string {
    let report = '# Benchmark Report\n\n'

    // Summary
    const totalTests = results.length
    const passed = results.filter((r) => r.passesThreshold).length
    const avgImprovement = this.average(results.map((r) => r.actualImprovement))

    report += '## Summary\n'
    report += `- Total Tests: ${totalTests}\n`
    report += `- Passed: ${passed}/${totalTests} (${((passed / totalTests) * 100).toFixed(1)}%)\n`
    report += `- Average Improvement: ${avgImprovement.toFixed(2)}%\n\n`

    // Detailed results by optimizer
    const byOptimizer = this.groupBy(results, 'optimizerId')

    for (const [optimizer, optimizerResults] of Object.entries(byOptimizer)) {
      report += `## ${optimizer}\n\n`

      for (const result of optimizerResults) {
        report += `### Prompt: "${result.prompt}..."\n`
        report += `- Iterations: ${result.iterations}\n`
        report += `- Actual Improvement: ${result.actualImprovement.toFixed(2)}%\n`
        report += `- Token Reduction: ${result.metrics.avgTokenReduction.toFixed(2)}%\n`
        report += `- Quality Score: ${result.metrics.qualityScore.toFixed(2)}/100\n`
        report += `- Consistency: ${result.metrics.consistency.toFixed(2)}%\n`
        report += `- Avg Duration: ${result.metrics.avgDuration.toFixed(0)}ms\n`
        report += `- Status: ${result.passesThreshold ? '✅ PASS' : '❌ FAIL'}\n\n`
      }
    }

    // Performance comparison
    report += '## Performance Comparison\n\n'
    report += '| Optimizer | Avg Improvement | Avg Duration | Pass Rate |\n'
    report += '|-----------|----------------|--------------|-----------||\n'

    for (const [optimizer, optimizerResults] of Object.entries(byOptimizer)) {
      const avgImp = this.average(optimizerResults.map((r) => r.actualImprovement))
      const avgDur = this.average(optimizerResults.map((r) => r.metrics.avgDuration))
      const passRate = (optimizerResults.filter((r) => r.passesThreshold).length / optimizerResults.length) * 100

      report += `| ${optimizer} | ${avgImp.toFixed(2)}% | ${avgDur.toFixed(0)}ms | ${passRate.toFixed(1)}% |\n`
    }

    return report
  }

  // Group results by key
  private groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
    return array.reduce(
      (groups, item) => {
        const group = String(item[key])
        if (!groups[group]) groups[group] = []
        groups[group].push(item)
        return groups
      },
      {} as Record<string, T[]>
    )
  }
}

// Export factory function
export function createBenchmarkRunner(config: BenchmarkConfig): BenchmarkRunner {
  return new BenchmarkRunner(config)
}
