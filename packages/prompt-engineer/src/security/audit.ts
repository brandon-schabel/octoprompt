/**
 * Security Audit Logging System
 * Comprehensive logging for security events and prompt analysis
 */

import { Effect, Ref, Queue, Stream, Schema, pipe, Chunk } from 'effect'
import type { SanitizationResult, SecurityThreat } from './sanitizer'
import type { RCIResult, Vulnerability } from './rci'

// ============================================================================
// Audit Types
// ============================================================================

export interface AuditEvent {
  readonly id: string
  readonly timestamp: Date
  readonly type: AuditEventType
  readonly severity: 'info' | 'warning' | 'error' | 'critical'
  readonly source: string
  readonly userId?: string
  readonly sessionId?: string
  readonly details: AuditDetails
  readonly metadata?: Record<string, any>
  readonly stackTrace?: string
}

export type AuditEventType =
  | 'prompt_sanitized'
  | 'threat_detected'
  | 'injection_blocked'
  | 'rci_analysis'
  | 'vulnerability_found'
  | 'prompt_hardened'
  | 'access_denied'
  | 'rate_limit_exceeded'
  | 'suspicious_pattern'
  | 'data_exfiltration_attempt'
  | 'jailbreak_attempt'
  | 'model_manipulation'
  | 'unauthorized_access'

export interface AuditDetails {
  readonly action: string
  readonly result: 'success' | 'failure' | 'blocked' | 'modified'
  readonly prompt?: string
  readonly sanitizedPrompt?: string
  readonly threats?: SecurityThreat[]
  readonly vulnerabilities?: Vulnerability[]
  readonly modifications?: string[]
  readonly riskScore?: number
  readonly mitigationApplied?: boolean
}

export interface AuditConfig {
  readonly maxEvents: number
  readonly retentionDays: number
  readonly logLevel: 'debug' | 'info' | 'warning' | 'error'
  readonly enableStackTrace: boolean
  readonly enableMetrics: boolean
  readonly exportFormat: 'json' | 'csv' | 'syslog'
  readonly exportInterval?: number // ms
  readonly exportPath?: string
  readonly alertThreshold?: {
    readonly critical: number
    readonly high: number
  }
}

export interface AuditMetrics {
  readonly totalEvents: number
  readonly eventsByType: Map<AuditEventType, number>
  readonly eventsBySeverity: Map<string, number>
  readonly threatsBlocked: number
  readonly vulnerabilitiesFound: number
  readonly averageRiskScore: number
  readonly topThreats: Array<{ type: string; count: number }>
  readonly recentAlerts: AuditEvent[]
}

export interface AuditReport {
  readonly startDate: Date
  readonly endDate: Date
  readonly summary: AuditMetrics
  readonly criticalEvents: AuditEvent[]
  readonly recommendations: string[]
  readonly complianceStatus: ComplianceStatus
}

export interface ComplianceStatus {
  readonly compliant: boolean
  readonly violations: ComplianceViolation[]
  readonly lastAudit: Date
  readonly nextAudit: Date
}

export interface ComplianceViolation {
  readonly rule: string
  readonly description: string
  readonly severity: 'low' | 'medium' | 'high' | 'critical'
  readonly events: string[] // Event IDs
  readonly remediation: string
}

// ============================================================================
// Audit Logger Implementation
// ============================================================================

export class AuditLogger {
  private config: AuditConfig
  private events: Ref.Ref<Chunk.Chunk<AuditEvent>>
  private metrics: Ref.Ref<AuditMetrics>
  private alertQueue: Queue.Queue<AuditEvent>
  private exportTimer: NodeJS.Timeout | null = null

  constructor(
    config: AuditConfig = {
      maxEvents: 10000,
      retentionDays: 30,
      logLevel: 'info',
      enableStackTrace: false,
      enableMetrics: true,
      exportFormat: 'json'
    }
  ) {
    this.config = config
    this.events = Ref.unsafeMake(Chunk.empty())
    this.metrics = Ref.unsafeMake(this.initializeMetrics())
    this.alertQueue = Queue.unbounded<AuditEvent>()

    // Start export timer if configured
    if (config.exportInterval && config.exportInterval > 0) {
      this.startExportTimer()
    }
  }

  /**
   * Log an audit event
   */
  log(event: Omit<AuditEvent, 'id' | 'timestamp'>): Effect.Effect<void, never> {
    return Effect.gen(
      function* (_) {
        const fullEvent: AuditEvent = {
          ...event,
          id: this.generateEventId(),
          timestamp: new Date(),
          stackTrace: this.config.enableStackTrace ? this.captureStackTrace() : undefined
        }

        // Check severity level
        if (!this.shouldLog(fullEvent.severity)) {
          return
        }

        // Add to events
        yield* _(
          Ref.update(this.events, (events) => {
            const updated = pipe(events, Chunk.prepend(fullEvent))
            // Maintain max events
            return Chunk.take(updated, this.config.maxEvents)
          })
        )

        // Update metrics
        if (this.config.enableMetrics) {
          yield* _(this.updateMetrics(fullEvent))
        }

        // Check for alerts
        if (this.shouldAlert(fullEvent)) {
          yield* _(Queue.offer(this.alertQueue, fullEvent))
        }

        // Log to console in development
        if (process.env.NODE_ENV === 'development') {
          console.log(`[AUDIT] ${fullEvent.type}: ${fullEvent.details.action}`)
        }
      }.bind(this)
    )
  }

  /**
   * Log a sanitization event
   */
  logSanitization(result: SanitizationResult, userId?: string): Effect.Effect<void, never> {
    return this.log({
      type: 'prompt_sanitized',
      severity: this.getSeverityFromRisk(result.riskLevel),
      source: 'sanitizer',
      userId,
      details: {
        action: 'sanitize_prompt',
        result: result.threats.length > 0 ? 'modified' : 'success',
        prompt: result.original,
        sanitizedPrompt: result.sanitized,
        threats: result.threats,
        modifications: result.modifications.map((m) => m.reason),
        riskScore: this.calculateRiskScore(result.riskLevel)
      }
    })
  }

  /**
   * Log an RCI analysis
   */
  logRCIAnalysis(result: RCIResult, userId?: string): Effect.Effect<void, never> {
    return this.log({
      type: 'rci_analysis',
      severity: result.robustnessScore < 50 ? 'critical' : result.robustnessScore < 70 ? 'warning' : 'info',
      source: 'rci',
      userId,
      details: {
        action: 'analyze_robustness',
        result: result.vulnerabilities.length > 0 ? 'modified' : 'success',
        prompt: result.original,
        sanitizedPrompt: result.hardened,
        vulnerabilities: result.vulnerabilities,
        riskScore: 100 - result.robustnessScore,
        mitigationApplied: result.hardened !== result.original
      }
    })
  }

  /**
   * Log a threat detection
   */
  logThreatDetection(threat: SecurityThreat, blocked: boolean, userId?: string): Effect.Effect<void, never> {
    return this.log({
      type: 'threat_detected',
      severity: threat.severity,
      source: 'threat_detector',
      userId,
      details: {
        action: `detect_${threat.type}`,
        result: blocked ? 'blocked' : 'failure',
        threats: [threat],
        mitigationApplied: blocked
      }
    })
  }

  /**
   * Log a jailbreak attempt
   */
  logJailbreakAttempt(prompt: string, method: string, blocked: boolean, userId?: string): Effect.Effect<void, never> {
    return this.log({
      type: 'jailbreak_attempt',
      severity: 'critical',
      source: 'security',
      userId,
      details: {
        action: `jailbreak_${method}`,
        result: blocked ? 'blocked' : 'failure',
        prompt,
        mitigationApplied: blocked
      },
      metadata: {
        method,
        timestamp: Date.now()
      }
    })
  }

  /**
   * Get audit events
   */
  getEvents(filter?: {
    type?: AuditEventType
    severity?: string
    userId?: string
    startDate?: Date
    endDate?: Date
    limit?: number
  }): Effect.Effect<AuditEvent[], never> {
    return Effect.gen(
      function* (_) {
        const events = yield* _(Ref.get(this.events))
        let filtered = Chunk.toArray(events)

        if (filter) {
          if (filter.type) {
            filtered = filtered.filter((e) => e.type === filter.type)
          }
          if (filter.severity) {
            filtered = filtered.filter((e) => e.severity === filter.severity)
          }
          if (filter.userId) {
            filtered = filtered.filter((e) => e.userId === filter.userId)
          }
          if (filter.startDate) {
            filtered = filtered.filter((e) => e.timestamp >= filter.startDate!)
          }
          if (filter.endDate) {
            filtered = filtered.filter((e) => e.timestamp <= filter.endDate!)
          }
          if (filter.limit) {
            filtered = filtered.slice(0, filter.limit)
          }
        }

        return filtered
      }.bind(this)
    )
  }

  /**
   * Get audit metrics
   */
  getMetrics(): Effect.Effect<AuditMetrics, never> {
    return Ref.get(this.metrics)
  }

  /**
   * Generate audit report
   */
  generateReport(startDate: Date, endDate: Date): Effect.Effect<AuditReport, never> {
    return Effect.gen(
      function* (_) {
        const events = yield* _(this.getEvents({ startDate, endDate }))
        const metrics = yield* _(this.getMetrics())

        // Get critical events
        const criticalEvents = events.filter((e) => e.severity === 'critical')

        // Generate recommendations
        const recommendations = this.generateRecommendations(events, metrics)

        // Check compliance
        const complianceStatus = this.checkCompliance(events)

        return {
          startDate,
          endDate,
          summary: metrics,
          criticalEvents,
          recommendations,
          complianceStatus
        }
      }.bind(this)
    )
  }

  /**
   * Export audit logs
   */
  exportLogs(): Effect.Effect<string, never> {
    return Effect.gen(
      function* (_) {
        const events = yield* _(Ref.get(this.events))

        switch (this.config.exportFormat) {
          case 'json':
            return JSON.stringify(Chunk.toArray(events), null, 2)

          case 'csv':
            return this.exportToCSV(Chunk.toArray(events))

          case 'syslog':
            return this.exportToSyslog(Chunk.toArray(events))

          default:
            return JSON.stringify(Chunk.toArray(events))
        }
      }.bind(this)
    )
  }

  /**
   * Subscribe to alerts
   */
  subscribeToAlerts(): Stream.Stream<AuditEvent, never> {
    return Stream.fromQueue(this.alertQueue)
  }

  /**
   * Cleanup resources
   */
  cleanup(): Effect.Effect<void, never> {
    return Effect.sync(() => {
      if (this.exportTimer) {
        clearInterval(this.exportTimer)
        this.exportTimer = null
      }
    })
  }

  // Private helper methods

  private initializeMetrics(): AuditMetrics {
    return {
      totalEvents: 0,
      eventsByType: new Map(),
      eventsBySeverity: new Map(),
      threatsBlocked: 0,
      vulnerabilitiesFound: 0,
      averageRiskScore: 0,
      topThreats: [],
      recentAlerts: []
    }
  }

  private generateEventId(): string {
    return `audit-${Date.now()}-${Math.random().toString(36).substring(7)}`
  }

  private captureStackTrace(): string {
    const stack = new Error().stack
    return stack ? stack.split('\n').slice(3).join('\n') : ''
  }

  private shouldLog(severity: string): boolean {
    const levels = ['debug', 'info', 'warning', 'error', 'critical']
    const configLevel = levels.indexOf(this.config.logLevel)
    const eventLevel = levels.indexOf(severity)
    return eventLevel >= configLevel
  }

  private shouldAlert(event: AuditEvent): boolean {
    if (!this.config.alertThreshold) return false

    if (event.severity === 'critical' && this.config.alertThreshold.critical > 0) {
      return true
    }

    if (event.severity === 'error' && this.config.alertThreshold.high > 0) {
      return true
    }

    // Alert on specific event types
    const alertTypes: AuditEventType[] = ['jailbreak_attempt', 'data_exfiltration_attempt', 'unauthorized_access']

    return alertTypes.includes(event.type)
  }

  private updateMetrics(event: AuditEvent): Effect.Effect<void, never> {
    return Ref.update(this.metrics, (metrics) => {
      const updated = { ...metrics }

      // Update counts
      updated.totalEvents++

      // Update by type
      const typeCount = updated.eventsByType.get(event.type) || 0
      updated.eventsByType.set(event.type, typeCount + 1)

      // Update by severity
      const severityCount = updated.eventsBySeverity.get(event.severity) || 0
      updated.eventsBySeverity.set(event.severity, severityCount + 1)

      // Update threat metrics
      if (event.details.threats && event.details.threats.length > 0) {
        if (event.details.result === 'blocked') {
          updated.threatsBlocked++
        }
      }

      // Update vulnerability metrics
      if (event.details.vulnerabilities && event.details.vulnerabilities.length > 0) {
        updated.vulnerabilitiesFound += event.details.vulnerabilities.length
      }

      // Update risk score
      if (event.details.riskScore !== undefined) {
        const totalScore = updated.averageRiskScore * (updated.totalEvents - 1) + event.details.riskScore
        updated.averageRiskScore = totalScore / updated.totalEvents
      }

      // Update recent alerts
      if (event.severity === 'critical' || event.severity === 'error') {
        updated.recentAlerts = [event, ...updated.recentAlerts.slice(0, 9)]
      }

      // Update top threats
      updated.topThreats = this.calculateTopThreats(updated.eventsByType)

      return updated
    })
  }

  private calculateTopThreats(eventsByType: Map<AuditEventType, number>): Array<{ type: string; count: number }> {
    const threatTypes: AuditEventType[] = [
      'threat_detected',
      'injection_blocked',
      'jailbreak_attempt',
      'data_exfiltration_attempt'
    ]

    return Array.from(eventsByType.entries())
      .filter(([type]) => threatTypes.includes(type))
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }

  private getSeverityFromRisk(
    risk: 'safe' | 'low' | 'medium' | 'high' | 'critical'
  ): 'info' | 'warning' | 'error' | 'critical' {
    switch (risk) {
      case 'safe':
      case 'low':
        return 'info'
      case 'medium':
        return 'warning'
      case 'high':
        return 'error'
      case 'critical':
        return 'critical'
    }
  }

  private calculateRiskScore(risk: 'safe' | 'low' | 'medium' | 'high' | 'critical'): number {
    switch (risk) {
      case 'safe':
        return 0
      case 'low':
        return 25
      case 'medium':
        return 50
      case 'high':
        return 75
      case 'critical':
        return 100
    }
  }

  private generateRecommendations(events: AuditEvent[], metrics: AuditMetrics): string[] {
    const recommendations: string[] = []

    if (metrics.averageRiskScore > 70) {
      recommendations.push('High average risk score detected. Review security policies.')
    }

    if (metrics.threatsBlocked > 100) {
      recommendations.push('High number of threats blocked. Consider implementing stricter input validation.')
    }

    const jailbreakAttempts = events.filter((e) => e.type === 'jailbreak_attempt').length
    if (jailbreakAttempts > 5) {
      recommendations.push('Multiple jailbreak attempts detected. Enhance prompt hardening.')
    }

    const criticalEvents = events.filter((e) => e.severity === 'critical').length
    if (criticalEvents > 10) {
      recommendations.push('High number of critical events. Immediate security review recommended.')
    }

    return recommendations
  }

  private checkCompliance(events: AuditEvent[]): ComplianceStatus {
    const violations: ComplianceViolation[] = []

    // Check for unmitigated threats
    const unmitigatedThreats = events.filter(
      (e) => e.details.threats && e.details.threats.length > 0 && !e.details.mitigationApplied
    )

    if (unmitigatedThreats.length > 0) {
      violations.push({
        rule: 'THREAT_MITIGATION',
        description: 'Threats detected without mitigation',
        severity: 'high',
        events: unmitigatedThreats.map((e) => e.id),
        remediation: 'Enable automatic threat mitigation'
      })
    }

    // Check for high-risk prompts
    const highRiskPrompts = events.filter((e) => e.details.riskScore && e.details.riskScore > 80)

    if (highRiskPrompts.length > 5) {
      violations.push({
        rule: 'RISK_THRESHOLD',
        description: 'Multiple high-risk prompts processed',
        severity: 'medium',
        events: highRiskPrompts.map((e) => e.id),
        remediation: 'Implement stricter prompt validation'
      })
    }

    return {
      compliant: violations.length === 0,
      violations,
      lastAudit: new Date(),
      nextAudit: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    }
  }

  private exportToCSV(events: AuditEvent[]): string {
    const headers = ['ID', 'Timestamp', 'Type', 'Severity', 'Source', 'Action', 'Result', 'User']
    const rows = events.map((e) => [
      e.id,
      e.timestamp.toISOString(),
      e.type,
      e.severity,
      e.source,
      e.details.action,
      e.details.result,
      e.userId || ''
    ])

    return [headers, ...rows].map((row) => row.join(',')).join('\n')
  }

  private exportToSyslog(events: AuditEvent[]): string {
    return events
      .map((e) => {
        const priority = this.getSyslogPriority(e.severity)
        const timestamp = e.timestamp.toISOString()
        const message = `${e.type}: ${e.details.action} - ${e.details.result}`
        return `<${priority}>${timestamp} ${e.source} ${message}`
      })
      .join('\n')
  }

  private getSyslogPriority(severity: string): number {
    // Syslog priority calculation: facility * 8 + severity
    const facility = 16 // Local0
    const severityMap: Record<string, number> = {
      debug: 7,
      info: 6,
      warning: 4,
      error: 3,
      critical: 2
    }
    return facility * 8 + (severityMap[severity] || 6)
  }

  private startExportTimer(): void {
    this.exportTimer = setInterval(() => {
      Effect.runPromise(this.performAutoExport()).catch(console.error)
    }, this.config.exportInterval!)
  }

  private performAutoExport(): Effect.Effect<void, never> {
    return Effect.gen(
      function* (_) {
        const exportData = yield* _(this.exportLogs())

        if (this.config.exportPath) {
          // In a real implementation, write to file
          console.log(`Exporting audit logs to ${this.config.exportPath}`)
        }
      }.bind(this)
    )
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create default audit logger
 */
export function createAuditLogger(config?: Partial<AuditConfig>): AuditLogger {
  return new AuditLogger({
    maxEvents: 10000,
    retentionDays: 30,
    logLevel: 'info',
    enableStackTrace: false,
    enableMetrics: true,
    exportFormat: 'json',
    ...config
  })
}

/**
 * Create production audit logger
 */
export function createProductionAuditLogger(): AuditLogger {
  return new AuditLogger({
    maxEvents: 100000,
    retentionDays: 90,
    logLevel: 'warning',
    enableStackTrace: true,
    enableMetrics: true,
    exportFormat: 'json',
    exportInterval: 3600000, // 1 hour
    alertThreshold: {
      critical: 1,
      high: 5
    }
  })
}

/**
 * Create development audit logger
 */
export function createDevelopmentAuditLogger(): AuditLogger {
  return new AuditLogger({
    maxEvents: 1000,
    retentionDays: 7,
    logLevel: 'debug',
    enableStackTrace: true,
    enableMetrics: true,
    exportFormat: 'json'
  })
}
