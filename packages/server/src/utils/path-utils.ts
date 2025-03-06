import { resolve as pathResolve } from 'node:path';
import { homedir } from 'node:os';

/**
 * Expands tilde (~) in a path to the user's home directory.
 * 
 * @param path The path that may contain a tilde
 * @returns The path with tilde expanded to the home directory
 */
export function expandTilde(path: string): string {
  if (path.startsWith('~/') || path === '~') {
    return path.replace(/^~/, homedir());
  }
  return path;
}

/**
 * Resolves a path, expanding tilde if present.
 * Combines expandTilde and node's path.resolve.
 * 
 * @param path The path to resolve, may contain tilde
 * @returns Absolute path with tilde expanded
 */
export function resolvePath(path: string): string {
  return pathResolve(expandTilde(path));
}

/**
 * Normalizes a path for database storage.
 * Ensures consistent path format regardless of OS.
 * 
 * @param path Path to normalize
 * @returns Normalized path with forward slashes
 */
export function normalizePathForDb(path: string): string {
  return path.replace(/\\/g, '/');
} 