import { resolve as pathResolve, sep, posix, join, relative, isAbsolute } from 'node:path'
import { homedir } from 'node:os'

/**
 * Expands tilde (~) in a path to the user's home directory.
 *
 * @param path The path that may contain a tilde
 * @returns The path with tilde expanded to the home directory
 */
export function expandTilde(path: string): string {
  if (path.startsWith('~/') || path === '~') {
    return path.replace(/^~/, homedir())
  }
  return path
}

/**
 * Resolves a path, expanding tilde if present.
 * Combines expandTilde and node's path.resolve.
 *
 * @param path The path to resolve, may contain tilde
 * @returns Absolute path with tilde expanded
 */
export function resolvePath(path: string): string {
  return pathResolve(expandTilde(path))
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
 * Converts any path to POSIX format (forward slashes).
 * Essential for cross-platform compatibility in storage and APIs.
 *
 * @param path Path to convert
 * @returns Path with forward slashes
 */
export function toPosixPath(path: string): string {
  return path.split(sep).join(posix.sep)
}

/**
 * Converts a POSIX path to the current OS format.
 * Use when passing paths to OS-specific operations.
 *
 * @param path POSIX-formatted path
 * @returns Path with OS-appropriate separators
 */
export function toOSPath(path: string): string {
  return path.split(posix.sep).join(sep)
}

/**
 * Joins path segments and normalizes to POSIX format.
 * Use for creating paths that will be stored or transmitted.
 *
 * @param segments Path segments to join
 * @returns Joined path in POSIX format
 */
export function joinPosix(...segments: string[]): string {
  return toPosixPath(join(...segments))
}

/**
 * Creates a relative path and normalizes to POSIX format.
 * Use for storing relative paths in databases or configs.
 *
 * @param from Starting path
 * @param to Target path
 * @returns Relative path in POSIX format
 */
export function relativePosix(from: string, to: string): string {
  return toPosixPath(relative(from, to))
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
  return isAbsolute(path)
}

/**
 * Ensures a path uses forward slashes for URLs and web contexts.
 * Also handles file:// protocol correctly.
 *
 * @param path Path to convert
 * @returns URL-safe path
 */
export function toUrlPath(path: string): string {
  const posixPath = toPosixPath(path)
  // Handle Windows drive letters for file:// URLs
  if (/^[a-zA-Z]:\//.test(posixPath)) {
    return `file:///${posixPath}`
  }
  return posixPath
}
