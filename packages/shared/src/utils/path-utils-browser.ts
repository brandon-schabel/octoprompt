/**
 * Browser-compatible path utilities
 * These functions provide basic path manipulation without Node.js dependencies
 */

/**
 * Converts any path to POSIX format (forward slashes).
 * Essential for cross-platform compatibility in storage and APIs.
 * Browser-compatible version that doesn't use node:path
 *
 * @param path Path to convert
 * @returns Path with forward slashes
 */
export function toPosixPath(path: string): string {
  return path.replace(/\\/g, '/')
}

/**
 * Converts a POSIX path to the current OS format.
 * In browser context, this just returns the POSIX path since we don't have OS info.
 *
 * @param path POSIX-formatted path
 * @returns Path (unchanged in browser)
 */
export function toOSPath(path: string): string {
  // In browser context, just return as-is since we can't detect OS
  return path
}

/**
 * Joins path segments and normalizes to POSIX format.
 * Browser-compatible version using simple string operations.
 *
 * @param segments Path segments to join
 * @returns Joined path in POSIX format
 */
export function joinPosix(...segments: string[]): string {
  if (segments.length === 0) return ''
  
  const joined = segments
    .filter(segment => segment && segment.length > 0)
    .map(segment => segment.replace(/\\/g, '/')) // Convert to forward slashes
    .join('/')
    .replace(/\/+/g, '/') // Remove duplicate slashes
  
  return joined
}

/**
 * Creates a relative path and normalizes to POSIX format.
 * Simplified browser version using basic string operations.
 *
 * @param from Starting path
 * @param to Target path
 * @returns Relative path in POSIX format
 */
export function relativePosix(from: string, to: string): string {
  // Convert both paths to POSIX format
  const fromPosix = toPosixPath(from)
  const toPosix = toPosixPath(to)
  
  // Split paths into segments
  const fromSegments = fromPosix.split('/').filter(s => s.length > 0)
  const toSegments = toPosix.split('/').filter(s => s.length > 0)
  
  // Find common prefix length
  let commonLength = 0
  while (
    commonLength < fromSegments.length &&
    commonLength < toSegments.length &&
    fromSegments[commonLength] === toSegments[commonLength]
  ) {
    commonLength++
  }
  
  // Build relative path
  const upSegments = Array(fromSegments.length - commonLength).fill('..')
  const downSegments = toSegments.slice(commonLength)
  
  const relativePath = [...upSegments, ...downSegments].join('/')
  return relativePath || '.'
}

/**
 * Checks if a path is absolute in a cross-platform way.
 * Handles both POSIX and Windows absolute paths.
 *
 * @param path Path to check
 * @returns True if path is absolute
 */
export function isAbsolutePath(path: string): boolean {
  // Check for Windows absolute paths (C:\ or \\)
  if (/^[a-zA-Z]:[\\\/]/.test(path) || /^\\\\/.test(path)) {
    return true
  }
  // Check for POSIX absolute paths
  return path.startsWith('/')
}

/**
 * Normalizes a path for database storage.
 * Ensures consistent path format regardless of OS.
 *
 * @param path Path to normalize
 * @returns Normalized path with forward slashes
 */
export function normalizePathForDb(path: string): string {
  return path.replace(/\\/g, '/')
}

/**
 * Ensures a path uses forward slashes for URLs and web contexts.
 * Also handles file:// protocol correctly.
 *
 * @param path Path to convert
 * @returns URL-safe path
 */
export function toUrlPath(path: string): string {
  // First convert to POSIX format to handle backslashes
  const posixPath = path.replace(/\\/g, '/')
  // Handle Windows drive letters for file:// URLs
  if (/^[a-zA-Z]:\//.test(posixPath)) {
    return `file:///${posixPath}`
  }
  return posixPath
}

/**
 * Browser-compatible version of expandTilde.
 * In browser context, we can't access the home directory, so this is a no-op.
 *
 * @param path The path that may contain a tilde
 * @returns The path unchanged (browser can't expand tilde)
 */
export function expandTilde(path: string): string {
  // In browser, we can't determine home directory, so return as-is
  console.warn('expandTilde: Home directory expansion not available in browser context')
  return path
}

/**
 * Browser-compatible version of resolvePath.
 * Simplified path resolution without Node.js filesystem access.
 *
 * @param path The path to resolve
 * @returns Simplified resolved path
 */
export function resolvePath(path: string): string {
  // In browser context, we can't do full path resolution
  // Just normalize the path and make it absolute-like
  let resolved = expandTilde(path)
  resolved = toPosixPath(resolved)
  
  // If not already absolute, make it absolute-like
  if (!isAbsolutePath(resolved)) {
    resolved = '/' + resolved
  }
  
  return resolved
}