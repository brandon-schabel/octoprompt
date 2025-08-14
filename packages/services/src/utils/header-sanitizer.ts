import { logger } from './logger'

/**
 * Security utility for sanitizing HTTP headers to prevent injection attacks
 */

// Headers that must never be overridden by user input
const FORBIDDEN_HEADERS = new Set([
  'host',
  'origin',
  'referer',
  'cookie',
  'authorization', // We handle this separately
  'content-length',
  'content-type', // We handle this separately
  'transfer-encoding',
  'connection',
  'upgrade',
  'sec-',
  'proxy-',
  'x-forwarded-'
])

// Headers that are explicitly allowed for custom providers
const ALLOWED_CUSTOM_HEADER_PREFIXES = [
  'x-api-',
  'x-custom-',
  'x-request-',
  'x-client-',
  'x-tenant-',
  'x-workspace-'
]

// Maximum header value length to prevent overflow attacks
const MAX_HEADER_VALUE_LENGTH = 1000

// Maximum number of custom headers allowed
const MAX_CUSTOM_HEADERS = 10

export interface SanitizationResult {
  sanitized: Record<string, string>
  blocked: string[]
  warnings: string[]
}

/**
 * Sanitizes custom headers to prevent security vulnerabilities
 * @param headers - Raw headers from user input
 * @returns Sanitized headers safe for use in HTTP requests
 */
export function sanitizeCustomHeaders(
  headers: Record<string, string> | undefined
): SanitizationResult {
  const result: SanitizationResult = {
    sanitized: {},
    blocked: [],
    warnings: []
  }

  if (!headers || typeof headers !== 'object') {
    return result
  }

  const entries = Object.entries(headers)
  
  // Check maximum number of headers
  if (entries.length > MAX_CUSTOM_HEADERS) {
    result.warnings.push(
      `Too many custom headers (${entries.length}). Only first ${MAX_CUSTOM_HEADERS} will be processed.`
    )
    entries.splice(MAX_CUSTOM_HEADERS)
  }

  for (const [key, value] of entries) {
    // Skip empty keys or values
    if (!key || !value) {
      result.blocked.push(key || '(empty)')
      continue
    }

    // Normalize header key for checking
    const normalizedKey = key.toLowerCase().trim()
    
    // Check if header is forbidden
    if (isForbiddenHeader(normalizedKey)) {
      result.blocked.push(key)
      logger.warn('Blocked forbidden header', { header: key })
      continue
    }

    // Check if header matches allowed patterns
    if (!isAllowedHeader(normalizedKey)) {
      result.blocked.push(key)
      logger.warn('Blocked non-whitelisted header', { header: key })
      continue
    }

    // Validate header key format (RFC 7230)
    if (!isValidHeaderName(key)) {
      result.blocked.push(key)
      result.warnings.push(`Invalid header name format: ${key}`)
      continue
    }

    // Sanitize header value
    const sanitizedValue = sanitizeHeaderValue(value)
    
    if (sanitizedValue.length > MAX_HEADER_VALUE_LENGTH) {
      result.blocked.push(key)
      result.warnings.push(
        `Header value too long for ${key} (${sanitizedValue.length} > ${MAX_HEADER_VALUE_LENGTH})`
      )
      continue
    }

    // Add sanitized header
    result.sanitized[key] = sanitizedValue
  }

  return result
}

/**
 * Checks if a header name is forbidden
 */
function isForbiddenHeader(headerName: string): boolean {
  // Check exact matches
  if (FORBIDDEN_HEADERS.has(headerName)) {
    return true
  }

  // Check prefixes (e.g., sec-*, proxy-*)
  for (const forbidden of FORBIDDEN_HEADERS) {
    if (forbidden.endsWith('-') && headerName.startsWith(forbidden)) {
      return true
    }
  }

  return false
}

/**
 * Checks if a header name is allowed
 */
function isAllowedHeader(headerName: string): boolean {
  return ALLOWED_CUSTOM_HEADER_PREFIXES.some(prefix => 
    headerName.startsWith(prefix)
  )
}

/**
 * Validates header name according to RFC 7230
 * Header field names must be valid tokens
 */
function isValidHeaderName(name: string): boolean {
  // RFC 7230 token characters
  const tokenRegex = /^[!#$%&'*+\-.0-9A-Z^_`a-z|~]+$/
  return tokenRegex.test(name)
}

/**
 * Sanitizes header value to prevent injection attacks
 */
function sanitizeHeaderValue(value: string): string {
  // Remove control characters and newlines
  let sanitized = value.replace(/[\r\n\0\t]/g, '')
  
  // Trim whitespace
  sanitized = sanitized.trim()
  
  // Remove non-printable characters
  sanitized = sanitized.replace(/[^\x20-\x7E]/g, '')
  
  return sanitized
}

/**
 * Merges sanitized custom headers with base headers
 * Custom headers never override base headers for security
 */
export function mergeHeaders(
  baseHeaders: Record<string, string>,
  customHeaders: Record<string, string> | undefined
): Record<string, string> {
  const { sanitized } = sanitizeCustomHeaders(customHeaders)
  
  // Base headers always take precedence
  return {
    ...sanitized,
    ...baseHeaders
  }
}