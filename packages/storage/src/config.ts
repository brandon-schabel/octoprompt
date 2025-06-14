import { join, resolve } from 'path'
import { existsSync } from 'fs'

/**
 * Get the base path for storage data
 * This ensures data is always stored in a consistent location
 */
export function getStorageBasePath(): string {
  // Start from current working directory and search upwards for the project root
  let currentPath = process.cwd()

  // Keep going up until we find the root directory with package.json and data directory
  while (currentPath !== '/' && currentPath !== '') {
    const packageJsonPath = join(currentPath, 'package.json')
    const dataPath = join(currentPath, 'data')

    // Check if we found the project root (has package.json)
    if (existsSync(packageJsonPath)) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const pkg = require(packageJsonPath)
        // Check if this is the root package.json (workspace)
        if (pkg.workspaces) {
          // Return the root directory, not packages/server
          return currentPath
        }
      } catch (e) {
        // Ignore error, continue searching
      }
    }

    // Go up one directory
    const parentPath = resolve(currentPath, '..')
    if (parentPath === currentPath) {
      // We've reached the root
      break
    }
    currentPath = parentPath
  }

  // Fallback: Try to use an absolute path if we know the structure
  const fallbackPath = resolve(process.cwd(), '..', '..')
  const fallbackDataPath = join(fallbackPath, 'data')
  if (existsSync(fallbackDataPath)) {
    return fallbackPath
  }

  // Last resort: use current directory
  console.warn('Could not find project root directory, using current directory for storage')
  return process.cwd()
}

/**
 * Storage configuration
 */
export const STORAGE_CONFIG = {
  basePath: getStorageBasePath(),
  cacheEnabled: true,
  cacheTTL: 5 * 60 * 1000, // 5 minutes
  maxCacheSize: 100
} as const
