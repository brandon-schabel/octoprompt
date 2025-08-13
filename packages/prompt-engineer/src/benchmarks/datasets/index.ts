/**
 * Benchmark Dataset Exports
 * Unified interface for evaluation datasets
 */

export * from './types'
export * from './humaneval'
export * from './mbpp'

import { Effect, pipe } from 'effect'
import { HumanEvalDataset, createHumanEvalDataset } from './humaneval'
import { MBPPDataset, createMBPPDataset } from './mbpp'
import type {
  BenchmarkDataset,
  BenchmarkTask,
  DatasetPlugin,
  EvaluationResult,
  EvaluationConfig,
  DatasetEvaluation,
  AggregateMetrics,
  PassAtKConfig,
  PassAtKResult,
  DatasetFilter,
  ComparisonResult
} from './types'

// ============================================================================
// Dataset Registry
// ============================================================================

export class DatasetRegistry {
  private datasets: Map<string, DatasetPlugin> = new Map()
  
  constructor() {
    // Register built-in datasets
    this.register('humaneval', createHumanEvalDataset())
    this.register('mbpp', createMBPPDataset())
  }
  
  /**
   * Register a dataset plugin
   */
  register(name: string, plugin: DatasetPlugin): void {
    this.datasets.set(name.toLowerCase(), plugin)
  }
  
  /**
   * Get a dataset by name
   */
  get(name: string): DatasetPlugin | undefined {
    return this.datasets.get(name.toLowerCase())
  }
  
  /**
   * List available datasets
   */
  list(): string[] {
    return Array.from(this.datasets.keys())
  }
  
  /**
   * Load a dataset by name
   */
  async load(name: string): Promise<BenchmarkDataset> {
    const plugin = this.get(name)
    if (!plugin) {
      throw new Error(`Dataset '${name}' not found. Available: ${this.list().join(', ')}`)
    }
    return plugin.load()
  }
}

// ============================================================================
// Benchmark Runner
// ============================================================================

export class BenchmarkRunner {
  private registry: DatasetRegistry
  
  constructor(registry?: DatasetRegistry) {
    this.registry = registry || new DatasetRegistry()
  }
  
  /**
   * Run a complete dataset evaluation
   */
  async runDataset(
    datasetName: string,
    generateFn: (task: BenchmarkTask) => Promise<string>,
    config?: EvaluationConfig & DatasetFilter
  ): Promise<DatasetEvaluation> {
    const dataset = await this.registry.load(datasetName)
    const plugin = this.registry.get(datasetName)!
    
    // Filter tasks if needed
    let tasks = dataset.tasks
    if (config) {
      tasks = this.filterTasks(tasks, config)
    }
    
    // Run evaluation
    const results: EvaluationResult[] = []
    const startTime = Date.now()
    
    for (const task of tasks) {
      try {
        // Preprocess task if plugin supports it
        const processedTask = plugin.preprocess ? plugin.preprocess(task) : task
        
        // Generate response
        const response = await generateFn(processedTask)
        
        // Evaluate response
        const result = await plugin.evaluate(response, task, config)
        
        // Postprocess result if plugin supports it
        const finalResult = plugin.postprocess ? plugin.postprocess(result) : result
        
        results.push(finalResult)
      } catch (error) {
        results.push({
          taskId: task.id,
          response: '',
          metrics: new Map(),
          passed: false,
          executionTime: 0,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }
    
    // Calculate aggregate metrics
    const aggregateMetrics = this.calculateAggregateMetrics(results)
    
    return {
      dataset: datasetName,
      timestamp: new Date(),
      results,
      aggregateMetrics,
      configuration: config || {}
    }
  }
  
  /**
   * Run a single task
   */
  async runTask(
    datasetName: string,
    taskId: string,
    generateFn: (task: BenchmarkTask) => Promise<string>,
    config?: EvaluationConfig
  ): Promise<EvaluationResult> {
    const dataset = await this.registry.load(datasetName)
    const plugin = this.registry.get(datasetName)!
    
    const task = dataset.tasks.find(t => t.id === taskId)
    if (!task) {
      throw new Error(`Task '${taskId}' not found in dataset '${datasetName}'`)
    }
    
    // Preprocess task if plugin supports it
    const processedTask = plugin.preprocess ? plugin.preprocess(task) : task
    
    // Generate response
    const response = await generateFn(processedTask)
    
    // Evaluate response
    const result = await plugin.evaluate(response, task, config)
    
    // Postprocess result if plugin supports it
    return plugin.postprocess ? plugin.postprocess(result) : result
  }
  
  /**
   * Run pass@k evaluation
   */
  async runPassAtK(
    datasetName: string,
    generateFn: (prompt: string) => Promise<string>,
    config: PassAtKConfig
  ): Promise<Map<string, PassAtKResult>> {
    const dataset = await this.registry.load(datasetName)
    const plugin = this.registry.get(datasetName)!
    
    const results = new Map<string, PassAtKResult>()
    
    // Check if plugin supports pass@k evaluation
    if (!('evaluatePassAtK' in plugin)) {
      throw new Error(`Dataset '${datasetName}' does not support pass@k evaluation`)
    }
    
    const evaluator = plugin as any
    
    for (const task of dataset.tasks) {
      const result = await evaluator.evaluatePassAtK(task, generateFn, config)
      results.set(task.id, result)
    }
    
    return results
  }
  
  /**
   * Compare two evaluation results
   */
  compareResults(
    baseline: DatasetEvaluation,
    comparison: DatasetEvaluation
  ): ComparisonResult {
    // Calculate improvement
    const baselinePass = baseline.aggregateMetrics.passRate
    const comparisonPass = comparison.aggregateMetrics.passRate
    const improvement = ((comparisonPass - baselinePass) / baselinePass) * 100
    
    // Compare metrics
    const metrics = new Map()
    for (const [key, baselineScore] of baseline.aggregateMetrics.metrics) {
      const comparisonScore = comparison.aggregateMetrics.metrics.get(key)
      if (comparisonScore) {
        const change = ((comparisonScore.mean - baselineScore.mean) / baselineScore.mean) * 100
        metrics.set(key, {
          baseline: baselineScore.mean,
          comparison: comparisonScore.mean,
          change,
          significant: Math.abs(change) > 5 // Simple significance threshold
        })
      }
    }
    
    // Find regressions and improvements
    const regressions: string[] = []
    const improvements: string[] = []
    
    for (const baselineResult of baseline.results) {
      const compResult = comparison.results.find(r => r.taskId === baselineResult.taskId)
      if (compResult) {
        if (baselineResult.passed && !compResult.passed) {
          regressions.push(baselineResult.taskId)
        } else if (!baselineResult.passed && compResult.passed) {
          improvements.push(baselineResult.taskId)
        }
      }
    }
    
    const summary = `Overall improvement: ${improvement.toFixed(1)}%. ` +
                   `${improvements.length} tasks improved, ${regressions.length} tasks regressed.`
    
    return {
      improvement,
      metrics,
      regressions,
      improvements,
      summary
    }
  }
  
  // Private helper methods
  
  private filterTasks(tasks: readonly BenchmarkTask[], filter: DatasetFilter): BenchmarkTask[] {
    let filtered = [...tasks]
    
    if (filter.difficulty) {
      filtered = filtered.filter(t => t.difficulty === filter.difficulty)
    }
    
    if (filter.tags && filter.tags.length > 0) {
      filtered = filtered.filter(t => 
        t.tags?.some(tag => filter.tags!.includes(tag))
      )
    }
    
    if (filter.languages && filter.languages.length > 0) {
      filtered = filtered.filter(t => {
        const lang = (t as any).language
        return lang && filter.languages!.includes(lang)
      })
    }
    
    if (filter.random && filter.seed !== undefined) {
      // Seeded random shuffle
      filtered = this.shuffleWithSeed(filtered, filter.seed)
    }
    
    if (filter.maxTasks) {
      filtered = filtered.slice(0, filter.maxTasks)
    }
    
    return filtered
  }
  
  private shuffleWithSeed(array: BenchmarkTask[], seed: number): BenchmarkTask[] {
    const shuffled = [...array]
    let currentSeed = seed
    
    for (let i = shuffled.length - 1; i > 0; i--) {
      currentSeed = (currentSeed * 9301 + 49297) % 233280
      const j = Math.floor((currentSeed / 233280) * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    
    return shuffled
  }
  
  private calculateAggregateMetrics(results: EvaluationResult[]): AggregateMetrics {
    const totalTasks = results.length
    const passedTasks = results.filter(r => r.passed).length
    const passRate = totalTasks > 0 ? passedTasks / totalTasks : 0
    
    // Calculate metrics aggregates
    const metricsMap = new Map()
    const allMetricNames = new Set<string>()
    
    for (const result of results) {
      for (const [name, score] of result.metrics) {
        allMetricNames.add(name)
        if (!metricsMap.has(name)) {
          metricsMap.set(name, [])
        }
        metricsMap.get(name).push(score.normalized)
      }
    }
    
    const metrics = new Map()
    for (const [name, values] of metricsMap) {
      const sorted = values.sort((a: number, b: number) => a - b)
      const mean = values.reduce((a: number, b: number) => a + b, 0) / values.length
      const median = sorted[Math.floor(sorted.length / 2)]
      const stdDev = Math.sqrt(
        values.reduce((sum: number, val: number) => sum + Math.pow(val - mean, 2), 0) / values.length
      )
      
      metrics.set(name, {
        mean,
        median,
        stdDev,
        min: sorted[0],
        max: sorted[sorted.length - 1]
      })
    }
    
    // Calculate execution time percentiles
    const times = results.map(r => r.executionTime).sort((a, b) => a - b)
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length
    
    return {
      totalTasks,
      passedTasks,
      passRate,
      metrics,
      averageExecutionTime: avgTime,
      percentiles: {
        p50: times[Math.floor(times.length * 0.5)],
        p90: times[Math.floor(times.length * 0.9)],
        p95: times[Math.floor(times.length * 0.95)],
        p99: times[Math.floor(times.length * 0.99)]
      }
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a dataset registry with built-in datasets
 */
export function createDatasetRegistry(): DatasetRegistry {
  return new DatasetRegistry()
}

/**
 * Create a benchmark runner
 */
export function createBenchmarkRunner(registry?: DatasetRegistry): BenchmarkRunner {
  return new BenchmarkRunner(registry)
}

/**
 * Run a quick benchmark on a dataset
 */
export async function quickBenchmark(
  datasetName: string,
  generateFn: (task: BenchmarkTask) => Promise<string>,
  maxTasks: number = 10
): Promise<{
  passRate: number
  avgTime: number
  results: EvaluationResult[]
}> {
  const runner = createBenchmarkRunner()
  const evaluation = await runner.runDataset(datasetName, generateFn, {
    maxTasks,
    random: true,
    seed: Date.now()
  })
  
  return {
    passRate: evaluation.aggregateMetrics.passRate,
    avgTime: evaluation.aggregateMetrics.averageExecutionTime,
    results: evaluation.results
  }
}

/**
 * Run pass@k evaluation on a dataset
 */
export async function evaluatePassAtK(
  datasetName: string,
  generateFn: (prompt: string) => Promise<string>,
  k: number[] = [1, 10, 100],
  n: number = 200
): Promise<{
  dataset: string
  passAtK: Map<number, number>
  taskResults: Map<string, PassAtKResult>
}> {
  const runner = createBenchmarkRunner()
  const taskResults = await runner.runPassAtK(datasetName, generateFn, {
    k,
    n,
    temperature: 0.8
  })
  
  // Calculate overall pass@k
  const overallPassAtK = new Map<number, number>()
  for (const kValue of k) {
    const taskScores: number[] = []
    for (const result of taskResults.values()) {
      const score = result.passAtK.get(kValue)
      if (score !== undefined) {
        taskScores.push(score)
      }
    }
    
    const avgScore = taskScores.reduce((a, b) => a + b, 0) / taskScores.length
    overallPassAtK.set(kValue, avgScore)
  }
  
  return {
    dataset: datasetName,
    passAtK: overallPassAtK,
    taskResults
  }
}

/**
 * Compare two models on a dataset
 */
export async function compareModels(
  datasetName: string,
  model1Fn: (task: BenchmarkTask) => Promise<string>,
  model2Fn: (task: BenchmarkTask) => Promise<string>,
  config?: EvaluationConfig & DatasetFilter
): Promise<{
  model1: DatasetEvaluation
  model2: DatasetEvaluation
  comparison: ComparisonResult
}> {
  const runner = createBenchmarkRunner()
  
  const model1 = await runner.runDataset(datasetName, model1Fn, config)
  const model2 = await runner.runDataset(datasetName, model2Fn, config)
  const comparison = runner.compareResults(model1, model2)
  
  return { model1, model2, comparison }
}