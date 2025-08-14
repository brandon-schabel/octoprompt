/**
 * Prompt Sanitization Module
 * Input validation, cleaning, and injection attack prevention
 */

import { Effect, pipe } from 'effect'

// ============================================================================
// Security Types
// ============================================================================

export interface SanitizationResult {
  readonly sanitized: string
  readonly original: string
  readonly threats: SecurityThreat[]
  readonly modifications: Modification[]
  readonly riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical'
}

export interface SecurityThreat {
  readonly type: ThreatType
  readonly severity: 'low' | 'medium' | 'high' | 'critical'
  readonly location: {
    readonly start: number
    readonly end: number
  }
  readonly description: string
  readonly mitigation: string
}

export type ThreatType =
  | 'prompt_injection'
  | 'jailbreak_attempt'
  | 'data_exfiltration'
  | 'system_command'
  | 'role_manipulation'
  | 'context_overflow'
  | 'encoding_attack'
  | 'recursive_prompt'
  | 'adversarial_suffix'
  | 'harmful_content'

export interface Modification {
  readonly type: 'removed' | 'replaced' | 'escaped'
  readonly original: string
  readonly modified: string
  readonly reason: string
}

export interface SanitizationConfig {
  readonly strict: boolean
  readonly maxLength?: number
  readonly allowedPatterns?: RegExp[]
  readonly blockedPatterns?: RegExp[]
  readonly customFilters?: SanitizationFilter[]
  readonly preserveFormatting?: boolean
  readonly detectLanguage?: boolean
}

export interface SanitizationFilter {
  readonly name: string
  readonly pattern: RegExp | ((text: string) => boolean)
  readonly action: 'remove' | 'replace' | 'escape' | 'reject'
  readonly replacement?: string
  readonly severity: 'low' | 'medium' | 'high' | 'critical'
}

// ============================================================================
// Threat Detection Patterns
// ============================================================================

const THREAT_PATTERNS: Record<ThreatType, RegExp[]> = {
  prompt_injection: [
    /ignore\s+(previous|all|above)\s+(instructions?|prompts?)/gi,
    /disregard\s+.*\s+instructions?/gi,
    /new\s+instructions?:\s*/gi,
    /system:\s*you\s+are/gi,
    /\[\[.*\]\]/g, // Double bracket injection
    /<\|.*\|>/g // Special delimiter injection
  ],

  jailbreak_attempt: [
    /pretend\s+you\s+are/gi,
    /act\s+as\s+if/gi,
    /roleplay\s+as/gi,
    /you\s+are\s+now/gi,
    /developer\s+mode/gi,
    /unlock\s+.*\s+mode/gi,
    /bypass\s+.*\s+restrictions?/gi,
    /without\s+.*\s+limitations?/gi
  ],

  data_exfiltration: [
    /repeat\s+.*\s+verbatim/gi,
    /output\s+.*\s+training\s+data/gi,
    /show\s+.*\s+system\s+prompt/gi,
    /reveal\s+.*\s+instructions?/gi,
    /what\s+are\s+your\s+instructions?/gi
  ],

  system_command: [
    /\$\{.*\}/g, // Template injection
    /`.*`/g, // Backtick command
    /exec\s*\(/gi,
    /eval\s*\(/gi,
    /system\s*\(/gi,
    /subprocess/gi,
    /os\.\w+/gi
  ],

  role_manipulation: [
    /you\s+must/gi,
    /you\s+have\s+to/gi,
    /it\s+is\s+imperative/gi,
    /mandatory\s+to/gi,
    /required\s+to/gi
  ],

  context_overflow: [
    /(.)\1{50,}/g, // Repeated characters
    /[\s\S]{10000,}/g // Very long prompts
  ],

  encoding_attack: [
    /\\x[0-9a-f]{2}/gi, // Hex encoding
    /\\u[0-9a-f]{4}/gi, // Unicode escape
    /%[0-9a-f]{2}/gi, // URL encoding
    /base64:/gi
  ],

  recursive_prompt: [/repeat\s+this\s+prompt/gi, /ask\s+me\s+to\s+ask\s+you/gi, /infinite\s+loop/gi],

  adversarial_suffix: [
    /\s{20,}$/g, // Excessive trailing spaces
    /[^\x20-\x7E]/g, // Non-printable characters
    /[\u200B-\u200F\u202A-\u202E]/g // Zero-width characters
  ],

  harmful_content: [
    // Patterns for harmful content detection
    // This would be more comprehensive in production
    /\b(harm|hurt|damage|destroy)\b.*\b(someone|people|myself)\b/gi
  ]
}

// ============================================================================
// Prompt Sanitizer
// ============================================================================

export class PromptSanitizer {
  private config: SanitizationConfig

  constructor(config: SanitizationConfig = { strict: false }) {
    this.config = {
      maxLength: config.maxLength || 10000,
      preserveFormatting: config.preserveFormatting ?? true,
      detectLanguage: config.detectLanguage ?? false,
      ...config
    }
  }

  /**
   * Sanitize a prompt
   */
  sanitize(prompt: string): Effect.Effect<SanitizationResult, never> {
    return Effect.gen(
      function* (_) {
        const threats: SecurityThreat[] = []
        const modifications: Modification[] = []
        let sanitized = prompt

        // Length check
        if (sanitized.length > this.config.maxLength!) {
          sanitized = sanitized.substring(0, this.config.maxLength)
          modifications.push({
            type: 'removed',
            original: prompt.substring(this.config.maxLength!),
            modified: '',
            reason: 'Exceeded maximum length'
          })
        }

        // Detect threats
        for (const [threatType, patterns] of Object.entries(THREAT_PATTERNS)) {
          for (const pattern of patterns) {
            const matches = [...sanitized.matchAll(pattern)]
            for (const match of matches) {
              if (match.index !== undefined) {
                threats.push({
                  type: threatType as ThreatType,
                  severity: this.getThreatSeverity(threatType as ThreatType),
                  location: {
                    start: match.index,
                    end: match.index + match[0].length
                  },
                  description: this.getThreatDescription(threatType as ThreatType),
                  mitigation: this.getThreatMitigation(threatType as ThreatType)
                })

                // Apply mitigation
                if (this.config.strict || this.getThreatSeverity(threatType as ThreatType) === 'critical') {
                  const replacement = this.getMitigationReplacement(threatType as ThreatType, match[0])
                  sanitized = sanitized.replace(match[0], replacement)

                  modifications.push({
                    type: replacement === '' ? 'removed' : 'replaced',
                    original: match[0],
                    modified: replacement,
                    reason: `Detected ${threatType}`
                  })
                }
              }
            }
          }
        }

        // Apply custom filters
        if (this.config.customFilters) {
          for (const filter of this.config.customFilters) {
            const result = this.applyCustomFilter(sanitized, filter)
            sanitized = result.text
            modifications.push(...result.modifications)

            if (result.threat) {
              threats.push(result.threat)
            }
          }
        }

        // Apply allowed patterns
        if (this.config.allowedPatterns) {
          const allowed = this.config.allowedPatterns.some((pattern) => pattern.test(sanitized))
          if (!allowed && this.config.strict) {
            return yield* _(
              Effect.succeed({
                sanitized: '',
                original: prompt,
                threats: [
                  {
                    type: 'prompt_injection',
                    severity: 'high',
                    location: { start: 0, end: prompt.length },
                    description: 'Prompt does not match allowed patterns',
                    mitigation: 'Rejected'
                  }
                ],
                modifications: [
                  {
                    type: 'removed',
                    original: prompt,
                    modified: '',
                    reason: 'Does not match allowed patterns'
                  }
                ],
                riskLevel: 'high'
              })
            )
          }
        }

        // Apply blocked patterns
        if (this.config.blockedPatterns) {
          for (const pattern of this.config.blockedPatterns) {
            if (pattern.test(sanitized)) {
              threats.push({
                type: 'prompt_injection',
                severity: 'high',
                location: { start: 0, end: sanitized.length },
                description: 'Contains blocked pattern',
                mitigation: 'Pattern blocked'
              })

              if (this.config.strict) {
                sanitized = sanitized.replace(pattern, '')
                modifications.push({
                  type: 'removed',
                  original: pattern.source,
                  modified: '',
                  reason: 'Blocked pattern'
                })
              }
            }
          }
        }

        // Clean up formatting if needed
        if (!this.config.preserveFormatting) {
          const cleaned = this.cleanFormatting(sanitized)
          if (cleaned !== sanitized) {
            modifications.push({
              type: 'replaced',
              original: sanitized,
              modified: cleaned,
              reason: 'Formatting cleaned'
            })
            sanitized = cleaned
          }
        }

        // Calculate risk level
        const riskLevel = this.calculateRiskLevel(threats)

        return {
          sanitized,
          original: prompt,
          threats,
          modifications,
          riskLevel
        }
      }.bind(this)
    )
  }

  /**
   * Validate a prompt without modifying it
   */
  validate(prompt: string): Effect.Effect<
    {
      valid: boolean
      threats: SecurityThreat[]
      riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical'
    },
    never
  > {
    return Effect.gen(
      function* (_) {
        const result = yield* _(this.sanitize(prompt))

        return {
          valid: result.threats.length === 0 || result.riskLevel === 'safe',
          threats: result.threats,
          riskLevel: result.riskLevel
        }
      }.bind(this)
    )
  }

  /**
   * Check if a prompt is safe
   */
  isSafe(prompt: string): Effect.Effect<boolean, never> {
    return this.validate(prompt).pipe(Effect.map((result) => result.valid))
  }

  // Helper methods

  private getThreatSeverity(type: ThreatType): 'low' | 'medium' | 'high' | 'critical' {
    const severities: Record<ThreatType, 'low' | 'medium' | 'high' | 'critical'> = {
      prompt_injection: 'critical',
      jailbreak_attempt: 'critical',
      data_exfiltration: 'high',
      system_command: 'critical',
      role_manipulation: 'medium',
      context_overflow: 'medium',
      encoding_attack: 'high',
      recursive_prompt: 'medium',
      adversarial_suffix: 'high',
      harmful_content: 'high'
    }

    return severities[type] || 'medium'
  }

  private getThreatDescription(type: ThreatType): string {
    const descriptions: Record<ThreatType, string> = {
      prompt_injection: 'Attempt to override system instructions',
      jailbreak_attempt: 'Attempt to bypass safety restrictions',
      data_exfiltration: 'Attempt to extract system information',
      system_command: 'Potential system command execution',
      role_manipulation: 'Attempt to manipulate AI behavior',
      context_overflow: 'Excessive prompt length or repetition',
      encoding_attack: 'Encoded content that may hide malicious input',
      recursive_prompt: 'Potential infinite loop or recursion',
      adversarial_suffix: 'Hidden or adversarial characters',
      harmful_content: 'Content that may cause harm'
    }

    return descriptions[type] || 'Unknown threat'
  }

  private getThreatMitigation(type: ThreatType): string {
    const mitigations: Record<ThreatType, string> = {
      prompt_injection: 'Remove or escape injection attempts',
      jailbreak_attempt: 'Block role-playing instructions',
      data_exfiltration: 'Prevent data extraction',
      system_command: 'Remove command patterns',
      role_manipulation: 'Neutralize manipulation attempts',
      context_overflow: 'Truncate to safe length',
      encoding_attack: 'Decode and validate content',
      recursive_prompt: 'Break recursion patterns',
      adversarial_suffix: 'Remove hidden characters',
      harmful_content: 'Filter harmful content'
    }

    return mitigations[type] || 'Apply default mitigation'
  }

  private getMitigationReplacement(type: ThreatType, original: string): string {
    switch (type) {
      case 'prompt_injection':
      case 'jailbreak_attempt':
      case 'system_command':
        return '' // Remove completely

      case 'role_manipulation':
        return '[request modified for safety]'

      case 'encoding_attack':
        // Decode if possible, otherwise remove
        return this.decodeString(original) || ''

      case 'adversarial_suffix':
        // Remove non-printable characters
        return original.replace(/[^\x20-\x7E]/g, '')

      default:
        return '[content filtered]'
    }
  }

  private applyCustomFilter(
    text: string,
    filter: SanitizationFilter
  ): {
    text: string
    modifications: Modification[]
    threat?: SecurityThreat
  } {
    const modifications: Modification[] = []
    let threat: SecurityThreat | undefined
    let modified = text

    const matches =
      typeof filter.pattern === 'function' ? (filter.pattern(text) ? [text] : []) : [...text.matchAll(filter.pattern)]

    if (matches.length > 0) {
      switch (filter.action) {
        case 'remove':
          for (const match of matches) {
            const matchText = typeof match === 'string' ? match : match[0]
            modified = modified.replace(matchText, '')
            modifications.push({
              type: 'removed',
              original: matchText,
              modified: '',
              reason: filter.name
            })
          }
          break

        case 'replace':
          for (const match of matches) {
            const matchText = typeof match === 'string' ? match : match[0]
            const replacement = filter.replacement || ''
            modified = modified.replace(matchText, replacement)
            modifications.push({
              type: 'replaced',
              original: matchText,
              modified: replacement,
              reason: filter.name
            })
          }
          break

        case 'escape':
          for (const match of matches) {
            const matchText = typeof match === 'string' ? match : match[0]
            const escaped = this.escapeString(matchText)
            modified = modified.replace(matchText, escaped)
            modifications.push({
              type: 'escaped',
              original: matchText,
              modified: escaped,
              reason: filter.name
            })
          }
          break

        case 'reject':
          threat = {
            type: 'prompt_injection',
            severity: filter.severity,
            location: { start: 0, end: text.length },
            description: `Failed custom filter: ${filter.name}`,
            mitigation: 'Rejected by custom filter'
          }
          break
      }
    }

    return { text: modified, modifications, threat }
  }

  private cleanFormatting(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/^\s+|\s+$/g, '') // Trim
      .replace(/\n{3,}/g, '\n\n') // Limit newlines
  }

  private calculateRiskLevel(threats: SecurityThreat[]): 'safe' | 'low' | 'medium' | 'high' | 'critical' {
    if (threats.length === 0) return 'safe'

    const hasCritical = threats.some((t) => t.severity === 'critical')
    if (hasCritical) return 'critical'

    const hasHigh = threats.some((t) => t.severity === 'high')
    if (hasHigh) return 'high'

    const hasMedium = threats.some((t) => t.severity === 'medium')
    if (hasMedium) return 'medium'

    return 'low'
  }

  private decodeString(str: string): string | null {
    try {
      // Try hex decoding
      if (/^\\x[0-9a-f]+$/i.test(str)) {
        return String.fromCharCode(parseInt(str.slice(2), 16))
      }

      // Try unicode decoding
      if (/^\\u[0-9a-f]{4}$/i.test(str)) {
        return String.fromCharCode(parseInt(str.slice(2), 16))
      }

      // Try URL decoding
      if (/%[0-9a-f]{2}/i.test(str)) {
        return decodeURIComponent(str)
      }

      return null
    } catch {
      return null
    }
  }

  private escapeString(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/'/g, "\\'")
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a default sanitizer
 */
export function createSanitizer(config?: Partial<SanitizationConfig>): PromptSanitizer {
  return new PromptSanitizer({
    strict: false,
    ...config
  })
}

/**
 * Create a strict sanitizer
 */
export function createStrictSanitizer(config?: Partial<SanitizationConfig>): PromptSanitizer {
  return new PromptSanitizer({
    strict: true,
    maxLength: 5000,
    ...config
  })
}

/**
 * Create a sanitizer for specific use case
 */
export function createCustomSanitizer(useCase: 'chat' | 'code' | 'search' | 'creative'): PromptSanitizer {
  const configs: Record<string, SanitizationConfig> = {
    chat: {
      strict: false,
      maxLength: 2000,
      preserveFormatting: true
    },
    code: {
      strict: true,
      maxLength: 10000,
      preserveFormatting: true,
      blockedPatterns: [/exec\s*\(/gi, /eval\s*\(/gi]
    },
    search: {
      strict: false,
      maxLength: 500,
      preserveFormatting: false
    },
    creative: {
      strict: false,
      maxLength: 5000,
      preserveFormatting: true
    }
  }

  return new PromptSanitizer(configs[useCase] || configs.chat)
}
