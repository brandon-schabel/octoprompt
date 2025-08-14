import { ApiError } from '@promptliano/shared'
import { logger } from './logger'
import dns from 'dns'
import { promisify } from 'util'
import net from 'net'

const resolveDns = promisify(dns.resolve4)

/**
 * SSRF (Server-Side Request Forgery) protection utilities
 * Prevents requests to internal networks and sensitive endpoints
 */

// Private IP ranges (RFC 1918 and others)
const PRIVATE_IP_RANGES = [
  { start: '10.0.0.0', end: '10.255.255.255', name: 'Private Class A' },
  { start: '172.16.0.0', end: '172.31.255.255', name: 'Private Class B' },
  { start: '192.168.0.0', end: '192.168.255.255', name: 'Private Class C' },
  { start: '127.0.0.0', end: '127.255.255.255', name: 'Loopback' },
  { start: '169.254.0.0', end: '169.254.255.255', name: 'Link-local' },
  { start: '0.0.0.0', end: '0.255.255.255', name: 'Current network' },
  { start: '100.64.0.0', end: '100.127.255.255', name: 'Shared Address Space' },
  { start: '224.0.0.0', end: '239.255.255.255', name: 'Multicast' },
  { start: '240.0.0.0', end: '255.255.255.255', name: 'Reserved' }
]

// Blocked hostnames
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '::',
  'metadata.google.internal',
  'metadata.azure.com',
  'meta-data.ec2.internal'
])

// Cloud metadata endpoints that should be blocked
const METADATA_ENDPOINTS = [
  '169.254.169.254', // AWS, GCP, Azure
  'fd00:ec2::254', // AWS IPv6
  '100.100.100.200', // Alibaba Cloud
  '169.254.169.254' // DigitalOcean, others
]

// Allowed schemes
const ALLOWED_SCHEMES = new Set(['http:', 'https:'])

// Maximum number of redirects to follow when validating
const MAX_REDIRECTS = 5

export interface URLValidationResult {
  valid: boolean
  error?: string
  warnings: string[]
  resolvedIPs?: string[]
}

/**
 * Validates a URL for SSRF vulnerabilities
 * @param urlString - The URL to validate
 * @param allowLocalhost - Whether to allow localhost for development (default: false)
 * @returns Validation result with any errors or warnings
 */
export async function validateProviderURL(
  urlString: string,
  allowLocalhost = false
): Promise<URLValidationResult> {
  const warnings: string[] = []
  
  try {
    // Parse URL
    const url = new URL(urlString)
    
    // Check scheme
    if (!ALLOWED_SCHEMES.has(url.protocol)) {
      return {
        valid: false,
        error: `Invalid URL scheme: ${url.protocol}. Only HTTP(S) is allowed.`,
        warnings
      }
    }
    
    // Extract hostname
    const hostname = url.hostname.toLowerCase()
    
    // Check blocked hostnames
    if (!allowLocalhost && BLOCKED_HOSTNAMES.has(hostname)) {
      return {
        valid: false,
        error: `Blocked hostname: ${hostname}`,
        warnings
      }
    }
    
    // Check for metadata endpoints
    if (METADATA_ENDPOINTS.includes(hostname)) {
      return {
        valid: false,
        error: 'Cloud metadata endpoints are not allowed',
        warnings
      }
    }
    
    // Check if hostname is an IP address
    if (net.isIP(hostname)) {
      const ipValidation = validateIPAddress(hostname, allowLocalhost)
      if (!ipValidation.valid) {
        return ipValidation
      }
    } else {
      // Resolve DNS to check final IPs
      try {
        const ips = await resolveDns(hostname)
        
        for (const ip of ips) {
          const ipValidation = validateIPAddress(ip, allowLocalhost)
          if (!ipValidation.valid) {
            return {
              ...ipValidation,
              error: `${ipValidation.error} (resolved from ${hostname})`,
              resolvedIPs: ips
            }
          }
        }
        
        return {
          valid: true,
          warnings,
          resolvedIPs: ips
        }
      } catch (dnsError) {
        // DNS resolution failed
        logger.warn('DNS resolution failed', { hostname, error: dnsError })
        warnings.push(`Could not resolve DNS for ${hostname}`)
        
        // Allow the URL but with a warning
        // Some providers might use custom DNS or be temporarily unreachable
        return {
          valid: true,
          warnings
        }
      }
    }
    
    return {
      valid: true,
      warnings
    }
    
  } catch (error) {
    return {
      valid: false,
      error: `Invalid URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
      warnings
    }
  }
}

/**
 * Validates an IP address for SSRF vulnerabilities
 */
function validateIPAddress(
  ip: string,
  allowLocalhost = false
): URLValidationResult {
  const warnings: string[] = []
  
  // Check if it's IPv6
  if (net.isIPv6(ip)) {
    // Block IPv6 loopback
    if (!allowLocalhost && (ip === '::1' || ip === '::')) {
      return {
        valid: false,
        error: 'IPv6 loopback address is not allowed',
        warnings
      }
    }
    
    // Allow other IPv6 for now (could add more checks)
    return { valid: true, warnings }
  }
  
  // Check IPv4
  if (!net.isIPv4(ip)) {
    return {
      valid: false,
      error: 'Invalid IP address format',
      warnings
    }
  }
  
  // Check against private ranges
  for (const range of PRIVATE_IP_RANGES) {
    if (isIPInRange(ip, range.start, range.end)) {
      if (allowLocalhost && range.name === 'Loopback') {
        warnings.push('Using loopback address (development mode)')
        return { valid: true, warnings }
      }
      
      return {
        valid: false,
        error: `IP address is in private range: ${range.name}`,
        warnings
      }
    }
  }
  
  return { valid: true, warnings }
}

/**
 * Checks if an IP address is within a range
 */
function isIPInRange(ip: string, start: string, end: string): boolean {
  const ipNum = ipToNumber(ip)
  const startNum = ipToNumber(start)
  const endNum = ipToNumber(end)
  
  return ipNum >= startNum && ipNum <= endNum
}

/**
 * Converts an IPv4 address to a number for comparison
 */
function ipToNumber(ip: string): number {
  const parts = ip.split('.').map(Number)
  return (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]
}

/**
 * Sanitizes and normalizes a provider URL
 */
export function sanitizeProviderURL(urlString: string): string {
  try {
    const url = new URL(urlString)
    
    // Remove credentials if present
    url.username = ''
    url.password = ''
    
    // Remove fragment
    url.hash = ''
    
    // Normalize path (remove double slashes, etc.)
    url.pathname = url.pathname.replace(/\/+/g, '/')
    
    // Remove trailing slash unless it's the root path
    if (url.pathname !== '/' && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.slice(0, -1)
    }
    
    return url.toString()
  } catch {
    // If URL parsing fails, return original
    return urlString
  }
}

/**
 * Creates a safe fetch function with SSRF protection
 */
export async function safeFetch(
  url: string,
  options?: RequestInit,
  allowLocalhost = false
): Promise<Response> {
  // Validate URL first
  const validation = await validateProviderURL(url, allowLocalhost)
  
  if (!validation.valid) {
    throw new ApiError(
      400,
      validation.error || 'Invalid URL',
      'SSRF_PROTECTION_BLOCKED'
    )
  }
  
  // Log warnings if any
  if (validation.warnings.length > 0) {
    logger.warn('URL validation warnings', {
      url,
      warnings: validation.warnings
    })
  }
  
  // Perform the fetch
  return fetch(url, {
    ...options,
    redirect: 'manual' // Don't follow redirects automatically
  })
}

/**
 * Validates a batch of URLs
 */
export async function validateURLBatch(
  urls: string[],
  allowLocalhost = false
): Promise<Map<string, URLValidationResult>> {
  const results = new Map<string, URLValidationResult>()
  
  await Promise.all(
    urls.map(async (url) => {
      const result = await validateProviderURL(url, allowLocalhost)
      results.set(url, result)
    })
  )
  
  return results
}