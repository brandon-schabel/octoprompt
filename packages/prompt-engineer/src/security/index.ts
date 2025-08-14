/**
 * Security Module Exports
 * Comprehensive security framework for prompt engineering
 */

export * from './sanitizer'
export * from './rci'
export * from './audit'

import { Effect, pipe } from 'effect'
import { PromptSanitizer, createSanitizer } from './sanitizer'
import { RCIFramework, createRCIFramework } from './rci'
import { AuditLogger, createAuditLogger } from './audit'
import type { SanitizationResult, SanitizationConfig, SecurityThreat } from './sanitizer'
import type { RCIResult, RCIConfig, Vulnerability } from './rci'
import type { AuditConfig, AuditEvent, AuditReport } from './audit'

// ============================================================================
// Integrated Security Manager
// ============================================================================

export interface SecurityConfig {
  readonly sanitization?: SanitizationConfig
  readonly rci?: RCIConfig
  readonly audit?: AuditConfig
  readonly enableAll?: boolean
  readonly strictMode?: boolean
}

export interface SecurityAnalysisResult {
  readonly original: string
  readonly final: string
  readonly safe: boolean
  readonly sanitization?: SanitizationResult
  readonly rci?: RCIResult
  readonly threats: SecurityThreat[]
  readonly vulnerabilities: Vulnerability[]
  readonly recommendations: string[]
  readonly auditId?: string
}

/**
 * Integrated security manager combining all security components
 */
export class SecurityManager {
  private sanitizer: PromptSanitizer
  private rciFramework: RCIFramework
  private auditLogger: AuditLogger
  private config: SecurityConfig

  constructor(config: SecurityConfig = {}) {
    this.config = {
      enableAll: config.enableAll ?? true,
      strictMode: config.strictMode ?? false,
      ...config
    }

    this.sanitizer = createSanitizer({
      strict: this.config.strictMode,
      ...config.sanitization
    })

    this.rciFramework = createRCIFramework({
      autoHarden: this.config.strictMode,
      ...config.rci
    })

    this.auditLogger = createAuditLogger({
      logLevel: this.config.strictMode ? 'info' : 'warning',
      ...config.audit
    })
  }

  /**
   * Perform comprehensive security analysis
   */
  analyzePrompt(prompt: string, userId?: string, sessionId?: string): Effect.Effect<SecurityAnalysisResult, never> {
    return Effect.gen(
      function* (_) {
        const threats: SecurityThreat[] = []
        const vulnerabilities: Vulnerability[] = []
        const recommendations: string[] = []
        let finalPrompt = prompt
        let safe = true

        // Step 1: Sanitization
        let sanitizationResult: SanitizationResult | undefined
        if (this.config.enableAll || this.config.sanitization) {
          sanitizationResult = yield* _(this.sanitizer.sanitize(prompt))
          threats.push(...sanitizationResult.threats)
          finalPrompt = sanitizationResult.sanitized

          if (sanitizationResult.riskLevel !== 'safe' && sanitizationResult.riskLevel !== 'low') {
            safe = false
          }

          // Log sanitization
          yield* _(this.auditLogger.logSanitization(sanitizationResult, userId))
        }

        // Step 2: RCI Analysis
        let rciResult: RCIResult | undefined
        if (this.config.enableAll || this.config.rci) {
          rciResult = yield* _(this.rciFramework.analyzeRobustness(finalPrompt))
          vulnerabilities.push(...rciResult.vulnerabilities)
          recommendations.push(...rciResult.recommendations)

          if (rciResult.robustnessScore < 70) {
            safe = false
            finalPrompt = rciResult.hardened
          }

          // Log RCI analysis
          yield* _(this.auditLogger.logRCIAnalysis(rciResult, userId))
        }

        // Step 3: Additional checks for high-risk patterns
        if (threats.some((t) => t.severity === 'critical')) {
          yield* _(this.auditLogger.logJailbreakAttempt(prompt, 'detected_in_analysis', true, userId))

          if (this.config.strictMode) {
            // In strict mode, completely block critical threats
            finalPrompt = '[BLOCKED: Security threat detected]'
            safe = false
          }
        }

        // Generate combined recommendations
        if (!safe) {
          recommendations.push('Consider rephrasing your prompt to avoid security concerns')
        }

        if (threats.length > 3) {
          recommendations.push('Multiple security threats detected - review prompt carefully')
        }

        if (vulnerabilities.length > 2) {
          recommendations.push('Prompt has structural vulnerabilities - apply hardening')
        }

        // Create audit event for the complete analysis
        const auditEvent: Omit<AuditEvent, 'id' | 'timestamp'> = {
          type: 'prompt_sanitized',
          severity: safe ? 'info' : threats.some((t) => t.severity === 'critical') ? 'critical' : 'warning',
          source: 'security_manager',
          userId,
          sessionId,
          details: {
            action: 'comprehensive_analysis',
            result: safe ? 'success' : 'modified',
            prompt,
            sanitizedPrompt: finalPrompt,
            threats,
            vulnerabilities,
            riskScore: rciResult ? 100 - rciResult.robustnessScore : undefined,
            mitigationApplied: finalPrompt !== prompt
          }
        }

        yield* _(this.auditLogger.log(auditEvent))

        return {
          original: prompt,
          final: finalPrompt,
          safe,
          sanitization: sanitizationResult,
          rci: rciResult,
          threats,
          vulnerabilities,
          recommendations,
          auditId: `analysis-${Date.now()}`
        }
      }.bind(this)
    )
  }

  /**
   * Validate a prompt without modification
   */
  validatePrompt(prompt: string): Effect.Effect<boolean, never> {
    return Effect.gen(
      function* (_) {
        const validationResult = yield* _(this.sanitizer.validate(prompt))

        if (!validationResult.valid) {
          return false
        }

        if (this.config.rci) {
          const rciResult = yield* _(this.rciFramework.analyzeRobustness(prompt))
          if (rciResult.robustnessScore < 60) {
            return false
          }
        }

        return true
      }.bind(this)
    )
  }

  /**
   * Harden a prompt
   */
  hardenPrompt(prompt: string): Effect.Effect<string, never> {
    return Effect.gen(
      function* (_) {
        // First sanitize
        const sanitized = yield* _(this.sanitizer.sanitize(prompt))

        // Then apply RCI hardening
        const rciAnalysis = yield* _(this.rciFramework.analyzeRobustness(sanitized.sanitized))

        return rciAnalysis.hardened
      }.bind(this)
    )
  }

  /**
   * Get security report
   */
  getSecurityReport(startDate: Date, endDate: Date): Effect.Effect<AuditReport, never> {
    return this.auditLogger.generateReport(startDate, endDate)
  }

  /**
   * Get recent security events
   */
  getRecentEvents(limit: number = 100): Effect.Effect<AuditEvent[], never> {
    return this.auditLogger.getEvents({ limit })
  }

  /**
   * Subscribe to security alerts
   */
  subscribeToAlerts() {
    return this.auditLogger.subscribeToAlerts()
  }

  /**
   * Cleanup resources
   */
  cleanup(): Effect.Effect<void, never> {
    return this.auditLogger.cleanup()
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create default security manager
 */
export function createSecurityManager(config?: SecurityConfig): SecurityManager {
  return new SecurityManager(config)
}

/**
 * Create strict security manager
 */
export function createStrictSecurityManager(): SecurityManager {
  return new SecurityManager({
    enableAll: true,
    strictMode: true,
    sanitization: {
      strict: true,
      maxLength: 5000
    },
    rci: {
      testDepth: 'comprehensive',
      autoHarden: true,
      targetRobustness: 90
    },
    audit: {
      logLevel: 'info',
      enableStackTrace: true,
      alertThreshold: {
        critical: 1,
        high: 3
      }
    }
  })
}

/**
 * Create development security manager
 */
export function createDevSecurityManager(): SecurityManager {
  return new SecurityManager({
    enableAll: true,
    strictMode: false,
    sanitization: {
      strict: false
    },
    rci: {
      testDepth: 'basic',
      autoHarden: false
    },
    audit: {
      logLevel: 'debug',
      enableStackTrace: true
    }
  })
}

// ============================================================================
// Security Utilities
// ============================================================================

/**
 * Quick security check for a prompt
 */
export function quickSecurityCheck(prompt: string): Effect.Effect<
  {
    safe: boolean
    reason?: string
  },
  never
> {
  const manager = createSecurityManager({ enableAll: false, sanitization: { strict: false } })

  return Effect.gen(function* (_) {
    const result = yield* _(manager.validatePrompt(prompt))

    if (!result) {
      return {
        safe: false,
        reason: 'Prompt failed security validation'
      }
    }

    return { safe: true }
  })
}

/**
 * Apply default security hardening
 */
export function applyDefaultHardening(prompt: string): Effect.Effect<string, never> {
  const manager = createSecurityManager()
  return manager.hardenPrompt(prompt)
}

/**
 * Check for specific threat types
 */
export function checkForThreats(prompt: string, threatTypes: string[]): Effect.Effect<SecurityThreat[], never> {
  const sanitizer = createSanitizer()

  return Effect.gen(function* (_) {
    const result = yield* _(sanitizer.sanitize(prompt))
    return result.threats.filter((t) => threatTypes.includes(t.type))
  })
}
