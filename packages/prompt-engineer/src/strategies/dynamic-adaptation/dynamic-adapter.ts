/**
 * Dynamic Prompt Adaptation System
 * Adapts prompts in real-time based on context, performance, and feedback
 */

import { Effect, Context, Layer, pipe, Schema, Either, Option, Ref, Stream, Fiber } from 'effect'
import type { OptimizedPrompt } from '../../types'

// ============================================================================
// Service Tags and Core Types
// ============================================================================

export interface AdaptationContext {
  readonly domain: string
  readonly userPreferences: UserPreferences
  readonly performanceHistory: PerformanceMetrics[]
  readonly environmentState: EnvironmentState
  readonly feedbackHistory: FeedbackEntry[]
}

export interface UserPreferences {
  readonly verbosity: 'concise' | 'balanced' | 'detailed'
  readonly complexity: 'simple' | 'moderate' | 'advanced'
  readonly style: 'formal' | 'casual' | 'technical'
  readonly responseFormat: 'text' | 'structured' | 'code'
  readonly language: string
}

export interface PerformanceMetrics {
  readonly timestamp: number
  readonly promptId: string
  readonly latency: number
  readonly tokenCount: number
  readonly qualityScore: number
  readonly userSatisfaction?: number
  readonly errorRate: number
  readonly retryCount: number
}

export interface EnvironmentState {
  readonly modelCapabilities: ModelCapabilities
  readonly resourceConstraints: ResourceConstraints
  readonly activeFeatures: string[]
  readonly apiQuota: ApiQuota
}

export interface ModelCapabilities {
  readonly maxTokens: number
  readonly supportsStreaming: boolean
  readonly supportsFunctionCalling: boolean
  readonly supportsVision: boolean
  readonly contextWindow: number
  readonly knowledgeCutoff: string
}

export interface ResourceConstraints {
  readonly maxLatency: number
  readonly maxCost: number
  readonly maxRetries: number
  readonly priorityLevel: 'low' | 'normal' | 'high'
}

export interface ApiQuota {
  readonly remaining: number
  readonly limit: number
  readonly resetTime: number
}

export interface FeedbackEntry {
  readonly timestamp: number
  readonly promptId: string
  readonly type: 'positive' | 'negative' | 'neutral'
  readonly category: 'accuracy' | 'relevance' | 'clarity' | 'completeness'
  readonly details?: string
  readonly suggestions?: string[]
}

export interface AdaptationStrategy {
  readonly name: string
  readonly triggers: AdaptationTrigger[]
  readonly actions: AdaptationAction[]
  readonly priority: number
  readonly enabled: boolean
}

export interface AdaptationTrigger {
  readonly type: 'threshold' | 'pattern' | 'event' | 'schedule'
  readonly condition: (context: AdaptationContext) => boolean
  readonly description: string
}

export interface AdaptationAction {
  readonly type: 'modify' | 'replace' | 'augment' | 'fallback'
  readonly apply: (prompt: string, context: AdaptationContext) => Effect.Effect<string, AdaptationError>
  readonly rollback?: (prompt: string) => Effect.Effect<string, never>
}

export class AdaptationError extends Schema.TaggedError<AdaptationError>("AdaptationError")(
  "AdaptationError",
  {
    reason: Schema.String,
    context: Schema.optional(Schema.Unknown),
    recoverable: Schema.Boolean
  }
) {}

// ============================================================================
// Adaptation Service
// ============================================================================

export interface AdaptationService {
  readonly adapt: (
    prompt: string,
    context: AdaptationContext
  ) => Effect.Effect<AdaptedPrompt, AdaptationError>
  
  readonly registerStrategy: (
    strategy: AdaptationStrategy
  ) => Effect.Effect<void, never>
  
  readonly updateContext: (
    update: Partial<AdaptationContext>
  ) => Effect.Effect<void, never>
  
  readonly getMetrics: () => Effect.Effect<AdaptationMetrics, never>
  
  readonly startMonitoring: () => Effect.Effect<Fiber.Fiber<never, never>, never>
}

export const AdaptationServiceTag = Context.GenericTag<AdaptationService>("AdaptationService")

export interface AdaptedPrompt {
  original: string
  adapted: string
  strategies: string[]
  modifications: Modification[]
  confidence: number
  metadata: AdaptationMetadata
}

export interface Modification {
  type: 'insertion' | 'deletion' | 'replacement' | 'reordering'
  position: number
  original?: string
  modified: string
  reason: string
}

export interface AdaptationMetadata {
  timestamp: number
  contextSnapshot: Partial<AdaptationContext>
  performanceEstimate: PerformanceEstimate
  fallbackOptions: string[]
}

export interface PerformanceEstimate {
  expectedLatency: number
  expectedTokens: number
  expectedQuality: number
  confidence: number
}

export interface AdaptationMetrics {
  totalAdaptations: number
  successRate: number
  averageLatency: number
  strategyUsage: Map<string, number>
  improvementRate: number
  rollbackCount: number
}

// ============================================================================
// Dynamic Adapter Implementation
// ============================================================================

export class DynamicAdapter implements AdaptationService {
  private strategies: AdaptationStrategy[] = []
  private contextRef: Ref.Ref<AdaptationContext>
  private metricsRef: Ref.Ref<AdaptationMetrics>
  
  constructor(initialContext: AdaptationContext) {
    // Initialize refs (would be created with Effect.gen in real implementation)
    this.contextRef = null as any // Placeholder
    this.metricsRef = null as any // Placeholder
    
    // Register default strategies
    this.registerDefaultStrategies()
  }
  
  /**
   * Adapt prompt based on context
   */
  adapt(
    prompt: string,
    context: AdaptationContext
  ): Effect.Effect<AdaptedPrompt, AdaptationError> {
    return Effect.gen(function* (_) {
      // Find applicable strategies
      const applicable = yield* _(findApplicableStrategies(prompt, context, this.strategies))
      
      if (applicable.length === 0) {
        // No adaptation needed
        return createNoOpAdaptation(prompt, context)
      }
      
      // Apply strategies in order of priority
      let adaptedPrompt = prompt
      const modifications: Modification[] = []
      const usedStrategies: string[] = []
      
      for (const strategy of applicable) {
        const result = yield* _(applyStrategy(strategy, adaptedPrompt, context))
        
        if (result.modified) {
          adaptedPrompt = result.prompt
          modifications.push(...result.modifications)
          usedStrategies.push(strategy.name)
        }
      }
      
      // Estimate performance
      const estimate = yield* _(estimatePerformance(adaptedPrompt, context))
      
      // Update metrics
      yield* _(updateMetrics(this.metricsRef, usedStrategies.length > 0))
      
      return {
        original: prompt,
        adapted: adaptedPrompt,
        strategies: usedStrategies,
        modifications,
        confidence: calculateConfidence(modifications, estimate),
        metadata: {
          timestamp: Date.now(),
          contextSnapshot: extractContextSnapshot(context),
          performanceEstimate: estimate,
          fallbackOptions: generateFallbacks(prompt, context)
        }
      }
    })
  }
  
  /**
   * Register new adaptation strategy
   */
  registerStrategy(strategy: AdaptationStrategy): Effect.Effect<void, never> {
    return Effect.sync(() => {
      this.strategies.push(strategy)
      this.strategies.sort((a, b) => b.priority - a.priority)
    })
  }
  
  /**
   * Update adaptation context
   */
  updateContext(update: Partial<AdaptationContext>): Effect.Effect<void, never> {
    return Ref.update(this.contextRef, current => ({
      ...current,
      ...update
    }))
  }
  
  /**
   * Get adaptation metrics
   */
  getMetrics(): Effect.Effect<AdaptationMetrics, never> {
    return Ref.get(this.metricsRef)
  }
  
  /**
   * Start monitoring for automatic adaptations
   */
  startMonitoring(): Effect.Effect<Fiber.Fiber<never, never>, never> {
    return Effect.gen(function* (_) {
      const fiber = yield* _(
        Effect.fork(
          monitoringLoop(this.contextRef, this.metricsRef)
        )
      )
      return fiber
    })
  }
  
  /**
   * Register default adaptation strategies
   */
  private registerDefaultStrategies() {
    // Verbosity adaptation
    this.strategies.push({
      name: 'verbosity-adapter',
      triggers: [{
        type: 'threshold',
        condition: (ctx) => ctx.userPreferences.verbosity !== 'balanced',
        description: 'Adapt verbosity based on user preference'
      }],
      actions: [{
        type: 'modify',
        apply: (prompt, context) => adaptVerbosity(prompt, context.userPreferences.verbosity)
      }],
      priority: 10,
      enabled: true
    })
    
    // Performance optimization
    this.strategies.push({
      name: 'performance-optimizer',
      triggers: [{
        type: 'threshold',
        condition: (ctx) => {
          const avgLatency = calculateAverageLatency(ctx.performanceHistory)
          return avgLatency > ctx.environmentState.resourceConstraints.maxLatency
        },
        description: 'Optimize when latency exceeds threshold'
      }],
      actions: [{
        type: 'modify',
        apply: (prompt) => compressPrompt(prompt)
      }],
      priority: 8,
      enabled: true
    })
    
    // Error recovery
    this.strategies.push({
      name: 'error-recovery',
      triggers: [{
        type: 'pattern',
        condition: (ctx) => {
          const recentErrors = ctx.performanceHistory
            .slice(-5)
            .filter(p => p.errorRate > 0.2)
          return recentErrors.length >= 3
        },
        description: 'Recover from repeated errors'
      }],
      actions: [{
        type: 'augment',
        apply: (prompt) => addErrorHandling(prompt)
      }],
      priority: 9,
      enabled: true
    })
    
    // Context enrichment
    this.strategies.push({
      name: 'context-enricher',
      triggers: [{
        type: 'event',
        condition: (ctx) => ctx.feedbackHistory.some(f => 
          f.category === 'completeness' && f.type === 'negative'
        ),
        description: 'Enrich context when completeness issues detected'
      }],
      actions: [{
        type: 'augment',
        apply: (prompt, context) => enrichContext(prompt, context)
      }],
      priority: 7,
      enabled: true
    })
    
    // Format adaptation
    this.strategies.push({
      name: 'format-adapter',
      triggers: [{
        type: 'threshold',
        condition: (ctx) => ctx.userPreferences.responseFormat !== 'text',
        description: 'Adapt output format'
      }],
      actions: [{
        type: 'augment',
        apply: (prompt, context) => adaptFormat(prompt, context.userPreferences.responseFormat)
      }],
      priority: 6,
      enabled: true
    })
  }
}

// ============================================================================
// Adaptation Functions
// ============================================================================

function findApplicableStrategies(
  prompt: string,
  context: AdaptationContext,
  strategies: AdaptationStrategy[]
): Effect.Effect<AdaptationStrategy[], never> {
  return Effect.succeed(
    strategies.filter(strategy => 
      strategy.enabled &&
      strategy.triggers.some(trigger => trigger.condition(context))
    )
  )
}

function applyStrategy(
  strategy: AdaptationStrategy,
  prompt: string,
  context: AdaptationContext
): Effect.Effect<StrategyResult, AdaptationError> {
  return Effect.gen(function* (_) {
    const modifications: Modification[] = []
    let currentPrompt = prompt
    
    for (const action of strategy.actions) {
      const result = yield* _(action.apply(currentPrompt, context))
      
      if (result !== currentPrompt) {
        modifications.push({
          type: getModificationType(action.type),
          position: 0,
          original: currentPrompt,
          modified: result,
          reason: `Applied ${strategy.name}`
        })
        currentPrompt = result
      }
    }
    
    return {
      modified: modifications.length > 0,
      prompt: currentPrompt,
      modifications
    }
  })
}

interface StrategyResult {
  modified: boolean
  prompt: string
  modifications: Modification[]
}

function getModificationType(actionType: string): Modification['type'] {
  switch (actionType) {
    case 'replace': return 'replacement'
    case 'augment': return 'insertion'
    case 'modify': return 'replacement'
    default: return 'replacement'
  }
}

function adaptVerbosity(
  prompt: string,
  verbosity: 'concise' | 'balanced' | 'detailed'
): Effect.Effect<string, AdaptationError> {
  return Effect.succeed(
    verbosity === 'concise' 
      ? `${prompt}\n\nProvide a concise response focusing on key points.`
      : verbosity === 'detailed'
      ? `${prompt}\n\nProvide a comprehensive, detailed response with examples and explanations.`
      : prompt
  )
}

function compressPrompt(prompt: string): Effect.Effect<string, AdaptationError> {
  // Remove redundant words and compress
  const compressed = prompt
    .replace(/\b(very|really|quite|rather|somewhat)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  
  return Effect.succeed(compressed)
}

function addErrorHandling(prompt: string): Effect.Effect<string, AdaptationError> {
  return Effect.succeed(
    `${prompt}\n\nIf any part is unclear or ambiguous, please ask for clarification. Handle edge cases gracefully.`
  )
}

function enrichContext(
  prompt: string,
  context: AdaptationContext
): Effect.Effect<string, AdaptationError> {
  const recentFeedback = context.feedbackHistory
    .slice(-3)
    .map(f => f.suggestions)
    .flat()
    .filter(Boolean)
    .join(', ')
  
  const enriched = recentFeedback
    ? `${prompt}\n\nConsider: ${recentFeedback}`
    : `${prompt}\n\nProvide comprehensive coverage of all relevant aspects.`
  
  return Effect.succeed(enriched)
}

function adaptFormat(
  prompt: string,
  format: 'text' | 'structured' | 'code'
): Effect.Effect<string, AdaptationError> {
  const formatInstructions = {
    structured: '\n\nFormat the response as a structured list or outline with clear sections.',
    code: '\n\nProvide code examples with syntax highlighting and clear comments.',
    text: ''
  }
  
  return Effect.succeed(prompt + formatInstructions[format])
}

function estimatePerformance(
  prompt: string,
  context: AdaptationContext
): Effect.Effect<PerformanceEstimate, never> {
  const tokenCount = Math.ceil(prompt.length / 4)
  const complexity = prompt.split('\n').length + prompt.split(/[.!?]/).length
  
  const historicalAvg = context.performanceHistory.length > 0
    ? context.performanceHistory.reduce((acc, p) => ({
        latency: acc.latency + p.latency,
        quality: acc.quality + p.qualityScore
      }), { latency: 0, quality: 0 })
    : { latency: 1000, quality: 0.7 }
  
  const count = Math.max(1, context.performanceHistory.length)
  
  return Effect.succeed({
    expectedLatency: (historicalAvg.latency / count) * (tokenCount / 100),
    expectedTokens: tokenCount,
    expectedQuality: Math.min(1, historicalAvg.quality / count + 0.1),
    confidence: Math.min(0.9, context.performanceHistory.length / 10)
  })
}

function calculateAverageLatency(history: PerformanceMetrics[]): number {
  if (history.length === 0) return 0
  return history.reduce((sum, p) => sum + p.latency, 0) / history.length
}

function createNoOpAdaptation(
  prompt: string,
  context: AdaptationContext
): AdaptedPrompt {
  return {
    original: prompt,
    adapted: prompt,
    strategies: [],
    modifications: [],
    confidence: 1.0,
    metadata: {
      timestamp: Date.now(),
      contextSnapshot: extractContextSnapshot(context),
      performanceEstimate: {
        expectedLatency: 1000,
        expectedTokens: Math.ceil(prompt.length / 4),
        expectedQuality: 0.7,
        confidence: 0.5
      },
      fallbackOptions: []
    }
  }
}

function extractContextSnapshot(context: AdaptationContext): Partial<AdaptationContext> {
  return {
    domain: context.domain,
    userPreferences: context.userPreferences,
    environmentState: {
      ...context.environmentState,
      apiQuota: { ...context.environmentState.apiQuota }
    }
  }
}

function generateFallbacks(prompt: string, context: AdaptationContext): string[] {
  const fallbacks: string[] = []
  
  // Simplified version
  if (prompt.length > 200) {
    fallbacks.push(prompt.substring(0, 150) + '...')
  }
  
  // Without formatting
  if (context.userPreferences.responseFormat !== 'text') {
    fallbacks.push(prompt.replace(/\n\n.*Format.*$/, ''))
  }
  
  // Basic version
  fallbacks.push(prompt.split('\n')[0])
  
  return fallbacks
}

function calculateConfidence(
  modifications: Modification[],
  estimate: PerformanceEstimate
): number {
  const modificationPenalty = Math.max(0, 1 - modifications.length * 0.1)
  const estimateConfidence = estimate.confidence
  
  return modificationPenalty * estimateConfidence
}

function updateMetrics(
  metricsRef: Ref.Ref<AdaptationMetrics>,
  success: boolean
): Effect.Effect<void, never> {
  return Ref.update(metricsRef, metrics => ({
    ...metrics,
    totalAdaptations: metrics.totalAdaptations + 1,
    successRate: (metrics.successRate * metrics.totalAdaptations + (success ? 1 : 0)) / 
                 (metrics.totalAdaptations + 1)
  }))
}

function monitoringLoop(
  contextRef: Ref.Ref<AdaptationContext>,
  metricsRef: Ref.Ref<AdaptationMetrics>
): Effect.Effect<never, never> {
  return Effect.gen(function* (_) {
    while (true) {
      // Sleep for monitoring interval
      yield* _(Effect.sleep('1 second'))
      
      // Get current context
      const context = yield* _(Ref.get(contextRef))
      
      // Check for anomalies
      const anomalies = detectAnomalies(context)
      
      if (anomalies.length > 0) {
        // Handle anomalies
        yield* _(handleAnomalies(anomalies, contextRef))
      }
      
      // Update metrics
      yield* _(updateMonitoringMetrics(metricsRef, context))
    }
  }) as Effect.Effect<never, never>
}

function detectAnomalies(context: AdaptationContext): Anomaly[] {
  const anomalies: Anomaly[] = []
  
  // Check for performance degradation
  if (context.performanceHistory.length >= 5) {
    const recent = context.performanceHistory.slice(-5)
    const avgQuality = recent.reduce((sum, p) => sum + p.qualityScore, 0) / 5
    
    if (avgQuality < 0.5) {
      anomalies.push({
        type: 'quality-degradation',
        severity: 'high',
        details: `Average quality score: ${avgQuality}`
      })
    }
  }
  
  // Check for quota depletion
  const quotaUsage = context.environmentState.apiQuota.remaining / 
                     context.environmentState.apiQuota.limit
  
  if (quotaUsage < 0.1) {
    anomalies.push({
      type: 'quota-depletion',
      severity: 'critical',
      details: `Only ${context.environmentState.apiQuota.remaining} API calls remaining`
    })
  }
  
  return anomalies
}

interface Anomaly {
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  details: string
}

function handleAnomalies(
  anomalies: Anomaly[],
  contextRef: Ref.Ref<AdaptationContext>
): Effect.Effect<void, never> {
  return Effect.gen(function* (_) {
    for (const anomaly of anomalies) {
      if (anomaly.severity === 'critical') {
        // Update context to trigger fallback strategies
        yield* _(Ref.update(contextRef, ctx => ({
          ...ctx,
          environmentState: {
            ...ctx.environmentState,
            resourceConstraints: {
              ...ctx.environmentState.resourceConstraints,
              priorityLevel: 'low'
            }
          }
        })))
      }
    }
  })
}

function updateMonitoringMetrics(
  metricsRef: Ref.Ref<AdaptationMetrics>,
  context: AdaptationContext
): Effect.Effect<void, never> {
  return Ref.update(metricsRef, metrics => {
    const recentLatencies = context.performanceHistory
      .slice(-10)
      .map(p => p.latency)
    
    const avgLatency = recentLatencies.length > 0
      ? recentLatencies.reduce((sum, l) => sum + l, 0) / recentLatencies.length
      : metrics.averageLatency
    
    return {
      ...metrics,
      averageLatency: avgLatency
    }
  })
}

// ============================================================================
// Factory and Layers
// ============================================================================

export function createDynamicAdapter(
  initialContext: AdaptationContext
): Effect.Effect<AdaptationService, never> {
  return Effect.gen(function* (_) {
    const contextRef = yield* _(Ref.make(initialContext))
    const metricsRef = yield* _(Ref.make<AdaptationMetrics>({
      totalAdaptations: 0,
      successRate: 0,
      averageLatency: 0,
      strategyUsage: new Map(),
      improvementRate: 0,
      rollbackCount: 0
    }))
    
    const adapter = new DynamicAdapter(initialContext)
    
    // Properly initialize refs
    ;(adapter as any).contextRef = contextRef
    ;(adapter as any).metricsRef = metricsRef
    
    return adapter
  })
}

export const DynamicAdapterLive = (initialContext: AdaptationContext) =>
  Layer.effect(
    AdaptationServiceTag,
    createDynamicAdapter(initialContext)
  )