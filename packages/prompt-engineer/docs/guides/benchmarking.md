# Benchmarking Guide

## Overview

The @promptliano/prompt-engineer package includes industry-standard benchmarks for evaluating prompt optimization and LLM performance. This guide covers how to use the built-in benchmarks (HumanEval, MBPP) and create custom benchmarks for your specific use cases.

## Table of Contents

1. [Built-in Benchmarks](#built-in-benchmarks)
2. [Running Benchmarks](#running-benchmarks)
3. [Pass@k Evaluation](#passk-evaluation)
4. [Creating Custom Benchmarks](#creating-custom-benchmarks)
5. [Performance Metrics](#performance-metrics)
6. [Comparing Models](#comparing-models)
7. [Best Practices](#best-practices)
8. [Examples](#examples)

## Built-in Benchmarks

### HumanEval

HumanEval is a benchmark for measuring functional correctness of code generation. It consists of 164 Python programming problems.

```typescript
import { createBenchmarkRunner } from '@promptliano/prompt-engineer/benchmarks'

const runner = createBenchmarkRunner()

// Run HumanEval benchmark
const results = await runner.runDataset('humaneval', 
  async (task) => {
    // Your code generation function
    return await generateCode(task.prompt)
  },
  { 
    maxTasks: 164,  // Run all tasks
    timeout: 30000  // 30 seconds per task
  }
)

console.log(`Pass rate: ${(results.aggregateMetrics.passRate * 100).toFixed(2)}%`)
console.log(`Average time: ${results.aggregateMetrics.averageExecutionTime}ms`)
```

**HumanEval Metrics:**
- **Pass Rate**: Percentage of tasks passed
- **Syntax Validity**: Code compiles without errors
- **Functional Correctness**: Passes all test cases
- **Execution Time**: Time to generate solution

### MBPP (Mostly Basic Programming Problems)

MBPP contains simpler programming problems suitable for evaluating basic code generation capabilities.

```typescript
import { runMBPP } from '@promptliano/prompt-engineer/benchmarks/datasets'

const results = await runMBPP(
  async (prompt) => {
    return await generateCode(prompt)
  },
  {
    includeChallenge: true,  // Include harder test cases
    tasks: [1, 2, 3, 4, 5]   // Specific task IDs (optional)
  }
)

console.log('MBPP Results:')
console.log(`Pass rate: ${(results.passRate * 100).toFixed(2)}%`)
console.log(`Syntax valid: ${(results.metrics.get('syntax_valid_rate') * 100).toFixed(2)}%`)
```

**MBPP Metrics:**
- **Pass Rate**: Overall success rate
- **Test Pass Rate**: Individual test case success
- **Challenge Pass Rate**: Success on harder tests
- **Syntax Validity**: Valid Python syntax

## Running Benchmarks

### Basic Benchmark Execution

```typescript
import { PromptEngineer } from '@promptliano/prompt-engineer'
import { createBenchmarkRunner } from '@promptliano/prompt-engineer/benchmarks'

// Initialize prompt engineer
const engineer = new PromptEngineer()

// Create benchmark runner
const runner = createBenchmarkRunner()

// Define your generation function
async function generateWithOptimization(task: BenchmarkTask): Promise<string> {
  // Optimize the prompt first
  const optimized = await engineer.optimize(task.prompt, {
    optimizers: ['scot'],  // Use SCoT for code generation
    style: 'technical'
  })
  
  // Generate code with your LLM
  const code = await callYourLLM(optimized.improved)
  
  return code
}

// Run benchmark
const evaluation = await runner.runDataset(
  'humaneval',
  generateWithOptimization,
  {
    maxTasks: 10,      // Start with subset
    random: true,      // Random sampling
    seed: 42,          // Reproducible results
    timeout: 30000     // 30s timeout per task
  }
)

// Analyze results
console.log('Benchmark Complete!')
console.log(`Tasks evaluated: ${evaluation.aggregateMetrics.totalTasks}`)
console.log(`Pass rate: ${(evaluation.aggregateMetrics.passRate * 100).toFixed(2)}%`)
console.log(`Average time: ${evaluation.aggregateMetrics.averageExecutionTime}ms`)

// Get detailed metrics
for (const [metric, stats] of evaluation.aggregateMetrics.metrics) {
  console.log(`${metric}:`)
  console.log(`  Mean: ${stats.mean.toFixed(3)}`)
  console.log(`  Median: ${stats.median.toFixed(3)}`)
  console.log(`  StdDev: ${stats.stdDev.toFixed(3)}`)
}
```

### Filtering Benchmark Tasks

```typescript
// Filter by difficulty
const easyTasks = await runner.runDataset('humaneval', generateFn, {
  difficulty: 'easy',
  maxTasks: 20
})

// Filter by tags
const stringTasks = await runner.runDataset('humaneval', generateFn, {
  tags: ['string-manipulation', 'algorithms']
})

// Filter by language (for multi-language benchmarks)
const pythonTasks = await runner.runDataset('humaneval', generateFn, {
  languages: ['python']
})

// Custom filter function
const customFiltered = await runner.runDataset('humaneval', generateFn, {
  filter: (task) => task.id.includes('sort') || task.id.includes('search')
})
```

### Batch Processing

```typescript
// Process benchmarks in batches for better resource management
async function runBatchedBenchmark() {
  const batchSize = 10
  const totalTasks = 164
  const allResults = []
  
  for (let i = 0; i < totalTasks; i += batchSize) {
    const batchResults = await runner.runDataset('humaneval', generateFn, {
      offset: i,
      maxTasks: Math.min(batchSize, totalTasks - i)
    })
    
    allResults.push(...batchResults.results)
    
    // Progress update
    console.log(`Processed ${i + batchSize}/${totalTasks} tasks`)
    
    // Optional: Add delay between batches
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  return allResults
}
```

## Pass@k Evaluation

Pass@k measures the probability that at least one of k generated solutions passes all tests.

### Understanding Pass@k

- **pass@1**: Success rate with single attempt
- **pass@10**: Success rate with best of 10 attempts
- **pass@100**: Success rate with best of 100 attempts

### Running Pass@k Evaluation

```typescript
import { evaluatePassAtK } from '@promptliano/prompt-engineer/benchmarks/datasets'

// Evaluate with different k values
const passAtKResults = await evaluatePassAtK(
  'humaneval',
  async (prompt) => {
    // Generate code with some randomness
    return await generateCode(prompt, {
      temperature: 0.8,  // Higher temperature for diversity
      topP: 0.95
    })
  },
  {
    k: [1, 10, 100],    // Evaluate pass@1, pass@10, pass@100
    n: 200,             // Generate 200 samples per task
    temperature: 0.8    // Generation temperature
  }
)

// Display results
console.log('Pass@k Results:')
for (const [k, score] of passAtKResults.passAtK) {
  console.log(`  pass@${k}: ${(score * 100).toFixed(2)}%`)
}

// Task-level analysis
for (const [taskId, result] of passAtKResults.taskResults) {
  console.log(`Task ${taskId}:`)
  for (const [k, score] of result.passAtK) {
    console.log(`  pass@${k}: ${(score * 100).toFixed(2)}%`)
  }
}
```

### Unbiased Pass@k Estimator

The package uses an unbiased estimator for pass@k:

```typescript
// The unbiased estimator formula
function calculatePassAtK(n: number, c: number, k: number): number {
  if (n - c < k) return 1.0
  
  return 1.0 - combination(n - c, k) / combination(n, k)
}

// Where:
// n = total samples generated
// c = number of correct samples
// k = k value for pass@k
```

## Creating Custom Benchmarks

### Benchmark Structure

```typescript
import { BenchmarkDataset, BenchmarkTask, DatasetPlugin } from '@promptliano/prompt-engineer/benchmarks'

interface CustomTask extends BenchmarkTask {
  // Your custom fields
  category: string
  expectedOutput: string
  constraints?: string[]
}

class CustomBenchmark implements DatasetPlugin {
  name = 'custom-benchmark'
  version = '1.0.0'
  capabilities = ['filtering', 'sampling'] as const
  
  async load(): Promise<BenchmarkDataset> {
    const tasks = await this.loadTasks()
    
    return {
      name: this.name,
      version: this.version,
      description: 'Custom benchmark for specific use case',
      category: 'custom',
      languages: ['english'],
      size: tasks.length,
      difficulty: 'medium',
      metrics: ['accuracy', 'relevance', 'completeness'],
      tasks,
      metadata: {
        authors: ['Your Name'],
        license: 'MIT',
        homepage: 'https://your-benchmark.com'
      }
    }
  }
  
  async evaluate(
    response: string,
    task: BenchmarkTask,
    config?: EvaluationConfig
  ): Promise<EvaluationResult> {
    const customTask = task as CustomTask
    const startTime = Date.now()
    
    // Evaluate response
    const accuracy = this.calculateAccuracy(response, customTask.expectedOutput)
    const relevance = this.calculateRelevance(response, task.prompt)
    const completeness = this.checkCompleteness(response, customTask.constraints)
    
    return {
      taskId: task.id,
      response,
      metrics: new Map([
        ['accuracy', { value: accuracy, normalized: accuracy }],
        ['relevance', { value: relevance, normalized: relevance }],
        ['completeness', { value: completeness, normalized: completeness }]
      ]),
      passed: accuracy > 0.8 && relevance > 0.7 && completeness === 1,
      executionTime: Date.now() - startTime
    }
  }
  
  private loadTasks(): CustomTask[] {
    return [
      {
        id: 'custom_001',
        prompt: 'Write a function to validate email addresses',
        category: 'validation',
        expectedOutput: 'function that returns boolean',
        constraints: ['regex pattern', 'handle edge cases'],
        difficulty: 'easy',
        tags: ['validation', 'regex']
      },
      // More tasks...
    ]
  }
  
  private calculateAccuracy(response: string, expected: string): number {
    // Implement accuracy calculation
    return 0.85
  }
  
  private calculateRelevance(response: string, prompt: string): number {
    // Implement relevance calculation
    return 0.9
  }
  
  private checkCompleteness(response: string, constraints?: string[]): number {
    // Check if all constraints are met
    if (!constraints) return 1
    
    const met = constraints.filter(c => response.includes(c)).length
    return met / constraints.length
  }
}
```

### Registering Custom Benchmarks

```typescript
import { DatasetRegistry } from '@promptliano/prompt-engineer/benchmarks'

// Create registry
const registry = new DatasetRegistry()

// Register custom benchmark
registry.register('custom-benchmark', new CustomBenchmark())

// Use with runner
const runner = new BenchmarkRunner(registry)
const results = await runner.runDataset('custom-benchmark', generateFn)
```

## Performance Metrics

### Standard Metrics

```typescript
interface StandardMetrics {
  // Accuracy metrics
  accuracy: number         // Correctness of response
  passRate: number         // Percentage of passed tests
  
  // Performance metrics
  executionTime: number    // Time to generate response
  tokenCount: number       // Tokens in response
  tokensPerSecond: number  // Generation speed
  
  // Quality metrics
  coherence: number        // Logical flow
  relevance: number        // On-topic response
  completeness: number     // All requirements met
  
  // Efficiency metrics
  compressionRatio: number // Input vs output size
  costPerTask: number      // API cost if applicable
}
```

### Custom Metrics

```typescript
// Define custom metrics for your use case
interface CustomMetrics {
  technicalAccuracy: number
  codeQuality: number
  documentationScore: number
  securityScore: number
}

// Implement custom metric calculation
function calculateCustomMetrics(
  response: string,
  task: BenchmarkTask
): CustomMetrics {
  return {
    technicalAccuracy: evaluateTechnicalAccuracy(response),
    codeQuality: evaluateCodeQuality(response),
    documentationScore: evaluateDocumentation(response),
    securityScore: evaluateSecurity(response)
  }
}

// Add to evaluation
const customEvaluation = {
  ...standardEvaluation,
  customMetrics: calculateCustomMetrics(response, task)
}
```

### Aggregate Metrics

```typescript
// The benchmark runner automatically calculates aggregates
const aggregateMetrics = evaluation.aggregateMetrics

// Access aggregate statistics
console.log('Aggregate Metrics:')
console.log(`Total tasks: ${aggregateMetrics.totalTasks}`)
console.log(`Passed tasks: ${aggregateMetrics.passedTasks}`)
console.log(`Pass rate: ${aggregateMetrics.passRate}`)

// Metric statistics (mean, median, stdDev, min, max)
for (const [metric, stats] of aggregateMetrics.metrics) {
  console.log(`\n${metric}:`)
  console.log(`  Mean: ${stats.mean}`)
  console.log(`  Median: ${stats.median}`)
  console.log(`  Std Dev: ${stats.stdDev}`)
  console.log(`  Min: ${stats.min}`)
  console.log(`  Max: ${stats.max}`)
}

// Execution time percentiles
console.log('\nExecution Time Percentiles:')
console.log(`  P50: ${aggregateMetrics.percentiles.p50}ms`)
console.log(`  P90: ${aggregateMetrics.percentiles.p90}ms`)
console.log(`  P95: ${aggregateMetrics.percentiles.p95}ms`)
console.log(`  P99: ${aggregateMetrics.percentiles.p99}ms`)
```

## Comparing Models

### Side-by-Side Comparison

```typescript
import { compareModels } from '@promptliano/prompt-engineer/benchmarks/datasets'

// Define generation functions for each model
async function model1Generate(task: BenchmarkTask): Promise<string> {
  return await callModel1API(task.prompt)
}

async function model2Generate(task: BenchmarkTask): Promise<string> {
  return await callModel2API(task.prompt)
}

// Compare models
const comparison = await compareModels(
  'humaneval',
  model1Generate,
  model2Generate,
  {
    maxTasks: 50,
    seed: 42  // Same tasks for fair comparison
  }
)

// Analyze comparison
console.log('Model Comparison:')
console.log(`Model 1 pass rate: ${(comparison.model1.aggregateMetrics.passRate * 100).toFixed(2)}%`)
console.log(`Model 2 pass rate: ${(comparison.model2.aggregateMetrics.passRate * 100).toFixed(2)}%`)
console.log(`Improvement: ${comparison.comparison.improvement.toFixed(2)}%`)

// Task-level analysis
console.log('\nTask-level differences:')
console.log(`Tasks improved: ${comparison.comparison.improvements.length}`)
console.log(`Tasks regressed: ${comparison.comparison.regressions.length}`)

// Detailed comparison
for (const improvement of comparison.comparison.improvements) {
  console.log(`  ✅ ${improvement}: Model 2 passed, Model 1 failed`)
}

for (const regression of comparison.comparison.regressions) {
  console.log(`  ❌ ${regression}: Model 1 passed, Model 2 failed`)
}
```

### A/B Testing

```typescript
// A/B test different optimization strategies
async function runABTest() {
  const strategies = [
    { name: 'SCoT', optimizers: ['scot'] },
    { name: 'Self-Consistency', optimizers: ['self-consistency'] },
    { name: 'Combined', optimizers: ['scot', 'self-consistency'] },
    { name: 'None', optimizers: [] }
  ]
  
  const results = new Map()
  
  for (const strategy of strategies) {
    const evaluation = await runner.runDataset(
      'humaneval',
      async (task) => {
        // Apply optimization strategy
        const optimized = await engineer.optimize(task.prompt, {
          optimizers: strategy.optimizers
        })
        
        // Generate code
        return await generateCode(
          strategy.optimizers.length > 0 ? optimized.improved : task.prompt
        )
      },
      { maxTasks: 20, seed: 42 }
    )
    
    results.set(strategy.name, evaluation.aggregateMetrics.passRate)
  }
  
  // Compare results
  console.log('A/B Test Results:')
  for (const [name, passRate] of results) {
    console.log(`  ${name}: ${(passRate * 100).toFixed(2)}%`)
  }
  
  // Find best strategy
  const best = Array.from(results.entries())
    .sort((a, b) => b[1] - a[1])[0]
  
  console.log(`\nBest strategy: ${best[0]} with ${(best[1] * 100).toFixed(2)}% pass rate`)
}
```

## Best Practices

### 1. Start Small

Begin with a subset of tasks to validate your approach:

```typescript
// Start with 5-10 tasks
const pilot = await runner.runDataset('humaneval', generateFn, {
  maxTasks: 5,
  random: true
})

// If results are promising, scale up
if (pilot.aggregateMetrics.passRate > 0.3) {
  const full = await runner.runDataset('humaneval', generateFn, {
    maxTasks: 164
  })
}
```

### 2. Use Consistent Seeds

For reproducible results:

```typescript
const seed = 42  // Or use date-based: Date.now()

// Run 1
const run1 = await runner.runDataset('humaneval', generateFn, {
  seed,
  random: true,
  maxTasks: 20
})

// Run 2 - same tasks
const run2 = await runner.runDataset('humaneval', generateFn, {
  seed,
  random: true,
  maxTasks: 20
})

// Results should evaluate same tasks
```

### 3. Monitor Resource Usage

```typescript
// Track resource consumption
const startMemory = process.memoryUsage()
const startTime = Date.now()

const results = await runner.runDataset('humaneval', generateFn, {
  maxTasks: 50,
  onProgress: (completed, total) => {
    const memory = process.memoryUsage()
    const elapsed = Date.now() - startTime
    
    console.log(`Progress: ${completed}/${total}`)
    console.log(`Memory: ${(memory.heapUsed / 1024 / 1024).toFixed(2)} MB`)
    console.log(`Time: ${(elapsed / 1000).toFixed(2)}s`)
    console.log(`Rate: ${(completed / (elapsed / 1000)).toFixed(2)} tasks/s`)
  }
})

const endMemory = process.memoryUsage()
const totalTime = Date.now() - startTime

console.log('\nResource Usage Summary:')
console.log(`Total time: ${(totalTime / 1000).toFixed(2)}s`)
console.log(`Memory delta: ${((endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024).toFixed(2)} MB`)
```

### 4. Cache Results

Avoid re-running expensive benchmarks:

```typescript
import { createFileStorage } from '@promptliano/prompt-engineer/plugins/storage'

const storage = createFileStorage({ path: './benchmark-cache' })

async function cachedBenchmark(datasetName: string, config: any) {
  const cacheKey = `${datasetName}_${JSON.stringify(config)}`
  
  // Check cache
  const cached = await storage.get(cacheKey)
  if (cached) {
    console.log('Using cached results')
    return cached
  }
  
  // Run benchmark
  const results = await runner.runDataset(datasetName, generateFn, config)
  
  // Cache results
  await storage.set(cacheKey, results)
  
  return results
}
```

### 5. Statistical Significance

Ensure results are statistically significant:

```typescript
// Run multiple iterations
async function runWithConfidence(n: number = 5) {
  const iterations = []
  
  for (let i = 0; i < n; i++) {
    const result = await runner.runDataset('humaneval', generateFn, {
      maxTasks: 50,
      random: true,
      seed: Date.now() + i
    })
    
    iterations.push(result.aggregateMetrics.passRate)
  }
  
  // Calculate statistics
  const mean = iterations.reduce((a, b) => a + b) / n
  const variance = iterations.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / n
  const stdDev = Math.sqrt(variance)
  const stderr = stdDev / Math.sqrt(n)
  const confidence95 = stderr * 1.96
  
  console.log(`Mean pass rate: ${(mean * 100).toFixed(2)}%`)
  console.log(`Std deviation: ${(stdDev * 100).toFixed(2)}%`)
  console.log(`95% CI: ±${(confidence95 * 100).toFixed(2)}%`)
  console.log(`Range: ${((mean - confidence95) * 100).toFixed(2)}% - ${((mean + confidence95) * 100).toFixed(2)}%`)
}
```

## Examples

### Complete Benchmark Pipeline

```typescript
import { PromptEngineer } from '@promptliano/prompt-engineer'
import { createBenchmarkRunner } from '@promptliano/prompt-engineer/benchmarks'
import { createSecurityManager } from '@promptliano/prompt-engineer/security'

async function completeBenchmarkPipeline() {
  // Initialize components
  const engineer = new PromptEngineer()
  const security = createSecurityManager()
  const runner = createBenchmarkRunner()
  
  // Define optimized generation
  async function secureOptimizedGeneration(task: BenchmarkTask): Promise<string> {
    // 1. Security check
    const securityAnalysis = await security.analyzePrompt(task.prompt)
    if (securityAnalysis.riskLevel === 'critical') {
      throw new Error('Security risk detected')
    }
    
    // 2. Optimize prompt
    const optimized = await engineer.optimize(task.prompt, {
      optimizers: ['scot', 'context'],
      maxTokens: 2000
    })
    
    // 3. Generate code
    const code = await generateCode(optimized.improved)
    
    // 4. Post-process
    return postProcessCode(code)
  }
  
  // Run benchmark with progress tracking
  console.log('Starting benchmark evaluation...')
  
  const evaluation = await runner.runDataset(
    'humaneval',
    secureOptimizedGeneration,
    {
      maxTasks: 50,
      timeout: 30000,
      onProgress: (completed, total) => {
        const percentage = (completed / total * 100).toFixed(1)
        console.log(`Progress: ${completed}/${total} (${percentage}%)`)
      }
    }
  )
  
  // Generate report
  generateBenchmarkReport(evaluation)
}

function generateBenchmarkReport(evaluation: DatasetEvaluation) {
  const report = `
# Benchmark Report

## Summary
- **Dataset**: ${evaluation.dataset}
- **Date**: ${evaluation.timestamp}
- **Tasks**: ${evaluation.aggregateMetrics.totalTasks}
- **Pass Rate**: ${(evaluation.aggregateMetrics.passRate * 100).toFixed(2)}%

## Metrics
${Array.from(evaluation.aggregateMetrics.metrics)
  .map(([name, stats]) => `- **${name}**: ${stats.mean.toFixed(3)} (±${stats.stdDev.toFixed(3)})`)
  .join('\n')}

## Performance
- **Average Time**: ${evaluation.aggregateMetrics.averageExecutionTime}ms
- **P50**: ${evaluation.aggregateMetrics.percentiles.p50}ms
- **P95**: ${evaluation.aggregateMetrics.percentiles.p95}ms

## Task Results
${evaluation.results
  .slice(0, 10)
  .map(r => `- ${r.taskId}: ${r.passed ? '✅' : '❌'} (${r.executionTime}ms)`)
  .join('\n')}
`
  
  console.log(report)
  
  // Save to file
  fs.writeFileSync(`benchmark-${Date.now()}.md`, report)
}
```

### Continuous Benchmarking

Set up automated benchmarking for CI/CD:

```typescript
// benchmark-ci.ts
import { runBenchmark, compareWithBaseline } from './benchmark-utils'

async function continuousBenchmark() {
  // Run current version
  const current = await runBenchmark('current')
  
  // Load baseline
  const baseline = await loadBaseline()
  
  // Compare
  const comparison = compareWithBaseline(baseline, current)
  
  // Check regression
  if (comparison.regression > 0.05) {
    console.error(`⚠️ Performance regression detected: ${(comparison.regression * 100).toFixed(2)}%`)
    process.exit(1)
  }
  
  // Check improvement
  if (comparison.improvement > 0.05) {
    console.log(`🎉 Performance improvement: ${(comparison.improvement * 100).toFixed(2)}%`)
    
    // Update baseline
    await saveBaseline(current)
  }
  
  // Generate PR comment
  const comment = generatePRComment(comparison)
  await postToPR(comment)
}

// Run in CI
if (process.env.CI) {
  continuousBenchmark().catch(console.error)
}
```

## Troubleshooting

### Common Issues

1. **Timeout errors**
   ```typescript
   // Increase timeout for complex tasks
   { timeout: 60000 }  // 60 seconds
   ```

2. **Memory issues**
   ```typescript
   // Process in smaller batches
   { maxTasks: 10 }
   ```

3. **Inconsistent results**
   ```typescript
   // Use fixed seed and temperature
   { seed: 42, temperature: 0 }
   ```

4. **Slow execution**
   ```typescript
   // Enable parallel processing
   { parallel: true, maxConcurrency: 5 }
   ```

## Next Steps

1. **Start with HumanEval** - Industry standard benchmark
2. **Optimize your prompts** - Use the optimization features
3. **Track improvements** - Monitor pass@k over time
4. **Create domain-specific benchmarks** - For your use case
5. **Share results** - Contribute to the community

Happy benchmarking! 📊