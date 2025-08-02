import * as path from 'path'
import * as os from 'os'

export interface PathValidationResult {
  valid: boolean
  safePath?: string
  error?: string
}

/**
 * Validates and sanitizes file paths to prevent directory traversal attacks
 * Simplified version for shared use across packages
 */
export class SecurePathValidator {
  private allowedBasePaths: Set<string> = new Set()

  constructor(allowedPaths: string[] = []) {
    // Default allowed paths for local-first app
    this.allowedBasePaths.add(path.normalize(os.homedir()))
    this.allowedBasePaths.add(path.normalize(process.cwd()))
    
    // Add any custom allowed paths
    allowedPaths.forEach(p => this.addAllowedPath(p))
  }

  /**
   * Add an allowed base path
   */
  addAllowedPath(basePath: string): void {
    const normalized = path.normalize(path.resolve(basePath))
    this.allowedBasePaths.add(normalized)
  }

  /**
   * Validate that a path is safe and within allowed directories
   */
  validatePath(inputPath: string, basePath?: string): PathValidationResult {
    try {
      // Handle empty input
      if (!inputPath || inputPath.trim() === '') {
        return { valid: false, error: 'Path cannot be empty' }
      }

      // Check for null bytes
      if (inputPath.includes('\0')) {
        return { valid: false, error: 'Path contains null bytes' }
      }

      // Resolve the full path
      const fullPath = basePath 
        ? path.resolve(basePath, inputPath)
        : path.resolve(inputPath)
      
      const normalizedPath = path.normalize(fullPath)

      // Check if resolved path is within allowed base paths
      const isWithinAllowed = Array.from(this.allowedBasePaths).some(allowedPath => {
        const relative = path.relative(allowedPath, normalizedPath)
        // Path is within allowed if relative path doesn't start with '..'
        return !relative.startsWith('..') && !path.isAbsolute(relative)
      })

      if (!isWithinAllowed) {
        return { 
          valid: false, 
          error: 'Path is outside allowed directories' 
        }
      }

      // Check for system directories (for extra safety in local-first app)
      const systemPatterns = [
        /^\/etc\//,
        /^\/sys\//,
        /^\/proc\//,
        /^\/bin\//,
        /^\/sbin\//,
        /^\/usr\/bin\//,
        /^\/usr\/sbin\//,
        /^C:\\Windows\\System32/i,
        /^C:\\Windows\\System/i,
        /^C:\\Program Files/i
      ]

      for (const pattern of systemPatterns) {
        if (pattern.test(normalizedPath)) {
          return { 
            valid: false, 
            error: 'Path points to system directory' 
          }
        }
      }

      return { 
        valid: true, 
        safePath: normalizedPath 
      }
    } catch (error) {
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : 'Invalid path' 
      }
    }
  }

  /**
   * Sanitize a filename to remove dangerous characters
   */
  sanitizeFilename(filename: string): string {
    return filename
      .replace(/[\/\\]/g, '_')        // Replace path separators
      .replace(/\.\./g, '_')          // Replace directory traversal
      .replace(/[<>:"|?*\0]/g, '_')   // Replace invalid characters
      .replace(/^\.+/, '_')           // Replace leading dots
      .replace(/\s+/g, '_')           // Replace whitespace
      .substring(0, 255)              // Limit length
  }

  /**
   * Validate command name (more restrictive than filename)
   */
  validateCommandName(name: string): PathValidationResult {
    if (!name || name.trim() === '') {
      return { valid: false, error: 'Command name cannot be empty' }
    }

    // Command names should be lowercase alphanumeric with hyphens
    if (!/^[a-z][a-z0-9-]*[a-z0-9]$/.test(name)) {
      return { 
        valid: false, 
        error: 'Command name must start with a letter, end with a letter or number, and contain only lowercase letters, numbers, and hyphens' 
      }
    }

    // Reasonable length limit
    if (name.length > 50) {
      return { valid: false, error: 'Command name too long (max 50 characters)' }
    }

    return { valid: true, safePath: name }
  }

  /**
   * Validate namespace (allows slashes for hierarchical organization)
   */
  validateNamespace(namespace: string): PathValidationResult {
    if (!namespace) {
      return { valid: true } // Empty namespace is valid (root)
    }

    // Check each segment
    const segments = namespace.split('/')
    for (const segment of segments) {
      if (!segment || segment.trim() === '') {
        return { valid: false, error: 'Namespace segments cannot be empty' }
      }

      // Each segment should follow similar rules to command names
      if (!/^[a-z][a-z0-9-]*[a-z0-9]?$/.test(segment)) {
        return { 
          valid: false, 
          error: `Invalid namespace segment '${segment}': must contain only lowercase letters, numbers, and hyphens` 
        }
      }
    }

    // Check for directory traversal
    if (namespace.includes('..')) {
      return { valid: false, error: 'Namespace cannot contain directory traversal' }
    }

    // Reasonable depth limit
    if (segments.length > 5) {
      return { valid: false, error: 'Namespace too deep (max 5 levels)' }
    }

    return { valid: true, safePath: namespace }
  }
}