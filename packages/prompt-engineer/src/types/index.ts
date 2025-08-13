import { z } from 'zod'
import { E, TE } from '../fp'

// ============================================================================
// Core Types for Prompt Engineering
// ============================================================================

export interface ProblemDescription {
  description: string
  language?: string
  constraints?: string[]
  examples?: Array<{ input: string; output: string }>
  performance?: string
  context?: string
}

// ============================================================================
// Structural Analysis Types
// ============================================================================

export interface StructuralAnalysis {
  sequences: SequenceStep[]
  branches: BranchCondition[]
  loops: LoopStructure[]
  dataFlow: DataFlowPattern[]
  complexity: ComplexityScore
}

export interface SequenceStep {
  order: number
  description: string
  dependencies: string[]
  output: string
  estimatedTokens?: number
}

export interface BranchCondition {
  condition: string
  trueBranch: string
  falseBranch: string
  edgeCases: string[]
  probability?: number
}

export interface LoopStructure {
  type: 'for' | 'while' | 'recursive' | 'map' | 'reduce'
  iterationTarget: string
  terminationCondition: string
  invariants: string[]
  estimatedIterations?: number
}

export interface DataFlowPattern {
  input: string
  transformations: string[]
  output: string
  sideEffects?: string[]
}

export interface ComplexityScore {
  cognitive: number // How hard for humans to understand
  computational: number // How hard for LLMs to process
  structural: number // How complex the structure is
  overall: number // Weighted average
}

// ============================================================================
// Optimization Types
// ============================================================================

export interface OptimizedPrompt {
  originalPrompt: string
  optimizedPrompt: string
  systemPrompt: string
  userPrompt: string
  reasoningStructure: StructuralAnalysis
  optimizationStrategy: OptimizationStrategy
  estimatedTokens: number
  improvementScore: number
  metadata: OptimizationMetadata
}

export interface OptimizationStrategy {
  name: string
  techniques: string[]
  parameters: Record<string, any>
  confidence: number
}

export interface OptimizationMetadata {
  optimizerId: string
  timestamp: number
  duration: number
  modelRecommendation?: ModelRecommendation
  cacheable: boolean
  ttl?: number
}

export interface ModelRecommendation {
  primary: string
  fallback: string
  reasoning: string
  estimatedCost: number
  estimatedLatency: number
}

// ============================================================================
// Self-Consistency Types
// ============================================================================

export interface SelfConsistencyConfig {
  samples: number
  temperatureRange: [number, number]
  topPRange: [number, number]
  votingStrategy: 'majority' | 'weighted' | 'ensemble' | 'confidence'
  maxRetries: number
  timeoutMs: number
}

export interface ConsistentResult<T = any> {
  solution: T
  confidence: number
  alternatives: T[]
  votingResults: VotingResult[]
  metadata: ConsistencyMetadata
}

export interface VotingResult {
  solution: any
  votes: number
  weight: number
  temperature: number
  topP: number
}

export interface ConsistencyMetadata {
  totalSamples: number
  validSamples: number
  consensusLevel: number
  divergenceScore: number
  timeElapsed: number
}

// ============================================================================
// Context Optimization Types
// ============================================================================

export interface ContextConfig {
  maxTokens: number
  priorityStrategy: 'relevance' | 'recency' | 'importance' | 'hybrid'
  chunkingStrategy: 'semantic' | 'structural' | 'fixed' | 'adaptive'
  overlapRatio: number
  compressionLevel: 'none' | 'light' | 'moderate' | 'aggressive'
}

export interface ContextWindow {
  content: string
  tokens: number
  priority: number
  metadata: ContextMetadata
}

export interface ContextMetadata {
  source: string
  relevanceScore: number
  semanticDensity: number
  compressed: boolean
  originalTokens?: number
}

// ============================================================================
// Task Decomposition Types
// ============================================================================

export interface DecomposedTask {
  id: string
  title: string
  description: string
  dependencies: string[]
  parallelizable: boolean
  estimatedComplexity: number
  suggestedAgent?: string
  suggestedModel?: string
  subtasks?: DecomposedTask[]
}

export interface TaskGraph {
  nodes: DecomposedTask[]
  edges: TaskDependency[]
  criticalPath: string[]
  parallelGroups: string[][]
}

export interface TaskDependency {
  from: string
  to: string
  type: 'blocks' | 'informs' | 'optional'
  weight: number
}

// ============================================================================
// Prompt Chaining Types
// ============================================================================

export interface PromptChain {
  id: string
  steps: ChainStep[]
  aggregationStrategy: 'sequential' | 'parallel' | 'conditional' | 'iterative'
  errorHandling: ErrorStrategy
  maxRetries: number
}

export interface ChainStep {
  id: string
  prompt: string
  inputMapping: Record<string, string>
  outputMapping: Record<string, string>
  condition?: string
  retryable: boolean
  timeout: number
}

export interface ErrorStrategy {
  onError: 'retry' | 'skip' | 'fallback' | 'abort'
  fallbackPrompt?: string
  maxRetries: number
  backoffMs: number
}

// ============================================================================
// Model Routing Types
// ============================================================================

export interface ModelRoutingConfig {
  models: ModelProfile[]
  routingStrategy: 'cost' | 'performance' | 'balanced' | 'adaptive'
  constraints: RoutingConstraints
  fallbackChain: string[]
}

export interface ModelProfile {
  id: string
  name: string
  provider: string
  contextWindow: number
  strengths: string[]
  weaknesses: string[]
  costPerToken: number
  latencyMs: number
  reliability: number
  optimalTasks: string[]
}

export interface RoutingConstraints {
  maxCost?: number
  maxLatency?: number
  minReliability?: number
  requiredCapabilities?: string[]
  excludeProviders?: string[]
}

export interface RoutingDecision {
  selectedModel: string
  reasoning: string
  estimatedCost: number
  estimatedLatency: number
  confidence: number
  alternatives: string[]
}

// ============================================================================
// Analysis Types
// ============================================================================

export interface PromptAnalysis {
  structure: StructuralAnalysis
  complexity: ComplexityScore
  tokenCount: number
  estimatedCost: number
  recommendedOptimizations: string[]
  potentialIssues: string[]
  improvementPotential: number
}

export interface OptimizationResult {
  success: boolean
  original: string
  optimized: string
  analysis: PromptAnalysis
  improvements: ImprovementMetrics
  errors?: string[]
}

export interface ImprovementMetrics {
  clarityScore: number
  specificityScore: number
  structureScore: number
  tokenReduction: number
  estimatedAccuracyGain: number
  overallImprovement: number
}

// ============================================================================
// Template Types
// ============================================================================

export interface PromptTemplate {
  id: string
  name: string
  description: string
  category: string
  template: string
  variables: TemplateVariable[]
  examples: TemplateExample[]
  metadata: TemplateMetadata
}

export interface TemplateVariable {
  name: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  required: boolean
  default?: any
  description: string
  validation?: string
}

export interface TemplateExample {
  variables: Record<string, any>
  result: string
  description?: string
}

export interface TemplateMetadata {
  author: string
  version: string
  tags: string[]
  successRate: number
  usageCount: number
  lastUpdated: number
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface OptimizerConfig {
  defaultStrategy: OptimizationStrategy
  enableCaching: boolean
  cacheDir?: string
  maxCacheSize?: number
  parallelOptimizers: boolean
  maxParallel: number
  timeout: number
  retryConfig: RetryConfig
}

export interface RetryConfig {
  maxRetries: number
  initialDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
  jitterMs: number
}

// ============================================================================
// Zod Schemas for Validation
// ============================================================================

export const OptimizationStrategySchema = z.object({
  name: z.string(),
  techniques: z.array(z.string()),
  parameters: z.record(z.any()),
  confidence: z.number().min(0).max(1)
})

export const ComplexityScoreSchema = z.object({
  cognitive: z.number().min(0).max(10),
  computational: z.number().min(0).max(10),
  structural: z.number().min(0).max(10),
  overall: z.number().min(0).max(10)
})

export const ModelProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.string(),
  contextWindow: z.number().positive(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  costPerToken: z.number().nonnegative(),
  latencyMs: z.number().positive(),
  reliability: z.number().min(0).max(1),
  optimalTasks: z.array(z.string())
})

// ============================================================================
// Factory Types
// ============================================================================

export type OptimizerFactory<T = any> = (config?: Partial<T>) => Optimizer

export interface Optimizer {
  name: string
  optimize: (prompt: string, context?: any) => E.Either<Error, OptimizedPrompt>
  optimizeAsync: (prompt: string, context?: any) => TE.TaskEither<Error, OptimizedPrompt>
  analyze: (prompt: string) => E.Either<Error, PromptAnalysis>
  supports: (feature: string) => boolean
}

// ============================================================================
// Event Types for Streaming
// ============================================================================

export interface OptimizationEvent {
  type: 'start' | 'progress' | 'complete' | 'error'
  timestamp: number
  data?: any
  error?: Error
  progress?: number
}

export interface StreamingOptimizer extends Optimizer {
  optimizeStream: (prompt: string, onEvent: (event: OptimizationEvent) => void) => Promise<OptimizedPrompt>
}

// ============================================================================
// Export Type Guards
// ============================================================================

export const isOptimizedPrompt = (value: any): value is OptimizedPrompt => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'originalPrompt' in value &&
    'optimizedPrompt' in value &&
    'improvementScore' in value
  )
}

export const isPromptAnalysis = (value: any): value is PromptAnalysis => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'structure' in value &&
    'complexity' in value &&
    'tokenCount' in value
  )
}

// ============================================================================
// Utility Types
// ============================================================================

export type PartialDeep<T> = T extends object
  ? {
      [P in keyof T]?: PartialDeep<T[P]>
    }
  : T

export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>
  }[Keys]

export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P]
}
