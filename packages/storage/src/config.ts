import { join, resolve } from 'path'
import { existsSync } from 'fs'

/**
 * Get the base path for storage data
 * This ensures data is always stored in a consistent location
 */
export function getStorageBasePath(): string {
  // Start from current working directory and search upwards for the project root
  let currentPath = process.cwd()
  
  // Keep going up until we find the packages directory
  while (currentPath !== '/' && currentPath !== '') {
    const packagesPath = join(currentPath, 'packages')
    const serverPath = join(packagesPath, 'server')
    
    // Check if we found the correct structure
    if (existsSync(packagesPath) && existsSync(serverPath)) {
      return serverPath
    }
    
    // Check if we're already in packages directory
    if (currentPath.endsWith('packages')) {
      const serverPath = join(currentPath, 'server')
      if (existsSync(serverPath)) {
        return serverPath
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
  const fallbackPath = resolve(process.cwd(), '..', '..', 'packages', 'server')
  if (existsSync(fallbackPath)) {
    return fallbackPath
  }
  
  // Last resort: use current directory
  console.warn('Could not find packages/server directory, using current directory for storage')
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