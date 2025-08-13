/**
 * Benchmark Dataset Types and Interfaces
 * Core infrastructure for evaluation datasets
 */

import { Schema } from 'effect'

// ============================================================================
// Core Dataset Types
// ============================================================================

export interface BenchmarkDataset {
  readonly name: string
  readonly version: string
  readonly description: string
  readonly category: DatasetCategory
  readonly languages: string[]
  readonly size: number // number of tasks
  readonly difficulty: 'easy' | 'medium' | 'hard' | 'mixed'
  readonly metrics: EvaluationMetric[]
  readonly tasks: readonly BenchmarkTask[]
  readonly metadata?: DatasetMetadata
}

export type DatasetCategory = 
  | 'code_generation'
  | 'code_completion'
  | 'bug_fixing'
  | 'code_translation'
  | 'natural_language'
  | 'reasoning'
  | 'mathematics'
  | 'multimodal'
  | 'custom'

export interface BenchmarkTask {
  readonly id: string
  readonly prompt: string
  readonly context?: string
  readonly expectedOutput?: string
  readonly testCases?: TestCase[]
  readonly metadata?: TaskMetadata
  readonly difficulty?: 'easy' | 'medium' | 'hard'
  readonly tags?: string[]
  readonly timeout?: number // milliseconds
}

export interface TestCase {
  readonly input: any
  readonly expectedOutput: any
  readonly description?: string
  readonly weight?: number // importance weight for scoring
  readonly hidden?: boolean // hidden from user during evaluation
}

export interface TaskMetadata {
  readonly language?: string
  readonly framework?: string
  readonly domain?: string
  readonly source?: string
  readonly humanEvalScore?: number
  readonly averageTime?: number // average human completion time in seconds
  readonly requiredKnowledge?: string[]
}

export interface DatasetMetadata {
  readonly authors?: string[]
  readonly paper?: string // arxiv or paper reference
  readonly license?: string
  readonly homepage?: string
  readonly citation?: string
  readonly dateCreated?: Date
  readonly lastUpdated?: Date
}

// ============================================================================
// Evaluation Types
// ============================================================================

export type EvaluationMetric = 
  | 'exact_match'
  | 'pass_at_k'
  | 'bleu'
  | 'rouge'
  | 'code_bleu'
  | 'test_pass_rate'
  | 'syntax_valid'
  | 'semantic_similarity'
  | 'functional_correctness'
  | 'custom'

export interface EvaluationResult {
  readonly taskId: string
  readonly response: string
  readonly metrics: Map<EvaluationMetric, MetricScore>
  readonly passed: boolean
  readonly executionTime: number // milliseconds
  readonly testResults?: TestResult[]
  readonly error?: string
}

export interface MetricScore {
  readonly value: number
  readonly normalized: number // 0-1
  readonly details?: Record<string, any>
}

export interface TestResult {
  readonly testCase: TestCase
  readonly actual: any
  readonly passed: boolean
  readonly executionTime?: number
  readonly error?: string
}

export interface DatasetEvaluation {
  readonly dataset: string
  readonly timestamp: Date
  readonly results: EvaluationResult[]
  readonly aggregateMetrics: AggregateMetrics
  readonly configuration: EvaluationConfig
}

export interface AggregateMetrics {
  readonly totalTasks: number
  readonly passedTasks: number
  readonly passRate: number
  readonly metrics: Map<EvaluationMetric, AggregateScore>
  readonly averageExecutionTime: number
  readonly percentiles: {
    readonly p50: number
    readonly p90: number
    readonly p95: number
    readonly p99: number
  }
}

export interface AggregateScore {
  readonly mean: number
  readonly median: number
  readonly stdDev: number
  readonly min: number
  readonly max: number
}

export interface EvaluationConfig {
  readonly model?: string
  readonly temperature?: number
  readonly maxTokens?: number
  readonly topP?: number
  readonly numSamples?: number // for pass@k
  readonly timeout?: number
  readonly parallel?: boolean
  readonly customParams?: Record<string, any>
}

// ============================================================================
// Code Evaluation Types
// ============================================================================

export interface CodeTask extends BenchmarkTask {
  readonly functionSignature?: string
  readonly imports?: string[]
  readonly setupCode?: string
  readonly teardownCode?: string
  readonly language: ProgrammingLanguage
  readonly testFramework?: TestFramework
}

export type ProgrammingLanguage = 
  | 'python'
  | 'javascript'
  | 'typescript'
  | 'java'
  | 'cpp'
  | 'csharp'
  | 'go'
  | 'rust'
  | 'ruby'
  | 'php'
  | 'swift'
  | 'kotlin'

export type TestFramework = 
  | 'pytest'
  | 'unittest'
  | 'jest'
  | 'mocha'
  | 'junit'
  | 'gtest'
  | 'cargo_test'
  | 'rspec'

export interface CodeEvaluationResult extends EvaluationResult {
  readonly syntaxValid: boolean
  readonly compilationSuccess?: boolean
  readonly testsPassed: number
  readonly totalTests: number
  readonly coverage?: number
  readonly lintErrors?: string[]
  readonly securityIssues?: string[]
}

// ============================================================================
// Dataset Plugin Interface
// ============================================================================

export interface DatasetPlugin {
  readonly name: string
  readonly version: string
  readonly capabilities: DatasetCapability[]
  
  load(): Promise<BenchmarkDataset>
  evaluate(response: string, task: BenchmarkTask, config?: EvaluationConfig): Promise<EvaluationResult>
  validateResponse?(response: string, task: BenchmarkTask): boolean
  preprocess?(task: BenchmarkTask): BenchmarkTask
  postprocess?(result: EvaluationResult): EvaluationResult
}

export type DatasetCapability = 
  | 'streaming'
  | 'filtering'
  | 'sampling'
  | 'caching'
  | 'remote_execution'
  | 'sandboxed_execution'

// ============================================================================
// Pass@k Evaluation
// ============================================================================

export interface PassAtKConfig {
  readonly k: number[]  // e.g., [1, 10, 100]
  readonly n: number    // number of samples to generate
  readonly temperature: number
  readonly topP?: number
  readonly codeOnly?: boolean // strip comments and docstrings
}

export interface PassAtKResult {
  readonly taskId: string
  readonly samples: CodeSample[]
  readonly passAtK: Map<number, number> // k -> pass rate
  readonly estimator: 'unbiased' | 'empirical'
}

export interface CodeSample {
  readonly code: string
  readonly passed: boolean
  readonly testResults?: TestResult[]
  readonly executionTime?: number
  readonly error?: string
}

// ============================================================================
// Dataset Loader Types
// ============================================================================

export interface DatasetLoader {
  readonly format: 'json' | 'jsonl' | 'csv' | 'parquet' | 'custom'
  
  load(path: string): Promise<BenchmarkTask[]>
  validate(data: any): boolean
  transform?(data: any): BenchmarkTask[]
}

export interface DatasetFilter {
  readonly difficulty?: 'easy' | 'medium' | 'hard'
  readonly tags?: string[]
  readonly languages?: string[]
  readonly maxTasks?: number
  readonly random?: boolean
  readonly seed?: number
}

export interface DatasetSplit {
  readonly train?: BenchmarkTask[]
  readonly validation?: BenchmarkTask[]
  readonly test: BenchmarkTask[]
}

// ============================================================================
// Schemas for Validation
// ============================================================================

export const TestCaseSchema = Schema.Struct({
  input: Schema.Any,
  expectedOutput: Schema.Any,
  description: Schema.optional(Schema.String),
  weight: Schema.optional(Schema.Number),
  hidden: Schema.optional(Schema.Boolean)
})

export const BenchmarkTaskSchema = Schema.Struct({
  id: Schema.String,
  prompt: Schema.String,
  context: Schema.optional(Schema.String),
  expectedOutput: Schema.optional(Schema.String),
  testCases: Schema.optional(Schema.Array(TestCaseSchema)),
  metadata: Schema.optional(Schema.Record(Schema.String, Schema.Any)),
  difficulty: Schema.optional(Schema.Literal('easy', 'medium', 'hard')),
  tags: Schema.optional(Schema.Array(Schema.String)),
  timeout: Schema.optional(Schema.Number)
})

export const EvaluationResultSchema = Schema.Struct({
  taskId: Schema.String,
  response: Schema.String,
  passed: Schema.Boolean,
  executionTime: Schema.Number,
  error: Schema.optional(Schema.String)
})

// ============================================================================
// Utility Types
// ============================================================================

export interface BenchmarkRunner {
  runDataset(
    dataset: BenchmarkDataset,
    generateFn: (task: BenchmarkTask) => Promise<string>,
    config?: EvaluationConfig
  ): Promise<DatasetEvaluation>
  
  runTask(
    task: BenchmarkTask,
    generateFn: (task: BenchmarkTask) => Promise<string>,
    config?: EvaluationConfig
  ): Promise<EvaluationResult>
  
  compareResults(
    baseline: DatasetEvaluation,
    comparison: DatasetEvaluation
  ): ComparisonResult
}

export interface ComparisonResult {
  readonly improvement: number // percentage
  readonly metrics: Map<EvaluationMetric, MetricComparison>
  readonly regressions: string[] // task IDs that got worse
  readonly improvements: string[] // task IDs that got better
  readonly summary: string
}

export interface MetricComparison {
  readonly baseline: number
  readonly comparison: number
  readonly change: number // percentage
  readonly significant: boolean // statistical significance
}