import { resolve, normalize, relative, isAbsolute, join } from 'path';
import { homedir } from 'os';
import { logger } from './logger.js';

/**
 * Validates and sanitizes file paths to prevent directory traversal attacks
 */
export class SecurePathValidator {
  private allowedPaths: string[] = [];
  
  constructor() {
    // Default allowed paths
    this.allowedPaths = [
      homedir(),
      process.cwd(),
      '/tmp',
      '/var/tmp'
    ];
  }
  
  /**
   * Add an allowed base path
   */
  addAllowedPath(path: string): void {
    const normalizedPath = normalize(resolve(path));
    if (!this.allowedPaths.includes(normalizedPath)) {
      this.allowedPaths.push(normalizedPath);
    }
  }
  
  /**
   * Validate that a path is safe and within allowed directories
   */
  validatePath(inputPath: string, basePath?: string): { valid: boolean; safePath?: string; error?: string } {
    try {
      // Normalize and resolve the path
      const resolvedPath = basePath 
        ? resolve(basePath, inputPath)
        : resolve(inputPath);
      
      const normalizedPath = normalize(resolvedPath);
      
      // Check for null bytes
      if (inputPath.includes('\0') || normalizedPath.includes('\0')) {
        return {
          valid: false,
          error: 'Path contains null bytes'
        };
      }
      
      // Check for directory traversal patterns
      if (inputPath.includes('..') && !this.isPathWithinAllowed(normalizedPath)) {
        return {
          valid: false,
          error: 'Directory traversal detected'
        };
      }
      
      // Ensure absolute paths are within allowed directories
      if (isAbsolute(inputPath) && !this.isPathWithinAllowed(normalizedPath)) {
        return {
          valid: false,
          error: 'Path is outside allowed directories'
        };
      }
      
      // Check for suspicious patterns
      const suspiciousPatterns = [
        /^\/etc\//,
        /^\/sys\//,
        /^\/proc\//,
        /^C:\\Windows\\System32/i,
        /^C:\\Windows\\System/i
      ];
      
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(normalizedPath)) {
          return {
            valid: false,
            error: 'Path points to system directory'
          };
        }
      }
      
      return {
        valid: true,
        safePath: normalizedPath
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid path'
      };
    }
  }
  
  /**
   * Check if a path is within allowed directories
   */
  private isPathWithinAllowed(path: string): boolean {
    const normalizedPath = normalize(path);
    
    for (const allowedPath of this.allowedPaths) {
      const relativePath = relative(allowedPath, normalizedPath);
      
      // If relative path doesn't start with '..', it's within the allowed path
      if (!relativePath.startsWith('..') && !isAbsolute(relativePath)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Sanitize a filename to remove dangerous characters
   */
  sanitizeFilename(filename: string): string {
    // Remove path separators and other dangerous characters
    return filename
      .replace(/[\/\\]/g, '_')
      .replace(/\.\./g, '_')
      .replace(/[<>:"|?*\0]/g, '_')
      .replace(/^\.+/, '_') // Remove leading dots
      .replace(/\s+/g, '_') // Replace whitespace
      .substring(0, 255); // Limit length
  }
  
  /**
   * Create a safe path for user-provided input
   */
  createSafePath(basePath: string, userInput: string): string {
    const sanitizedName = this.sanitizeFilename(userInput);
    return join(basePath, sanitizedName);
  }
}

/**
 * Global instance for path validation
 */
export const pathValidator = new SecurePathValidator();

/**
 * Validate installation path
 */
export function validateInstallPath(path: string): { valid: boolean; error?: string } {
  // Don't allow installation in root or system directories
  const dangerousPaths = [
    '/',
    '/bin',
    '/etc',
    '/usr',
    '/var',
    '/opt',
    '/System',
    '/Windows',
    'C:\\',
    'C:\\Windows',
    'C:\\Program Files',
    'C:\\Program Files (x86)'
  ];
  
  const normalizedPath = normalize(resolve(path));
  
  for (const dangerous of dangerousPaths) {
    if (normalizedPath === normalize(dangerous) || normalizedPath.startsWith(normalize(dangerous) + '/')) {
      return {
        valid: false,
        error: `Cannot install in system directory: ${dangerous}`
      };
    }
  }
  
  // Ensure path is reasonable
  if (normalizedPath.length > 1000) {
    return {
      valid: false,
      error: 'Path is too long'
    };
  }
  
  return { valid: true };
}

/**
 * Safe file operations wrapper
 */
export class SafeFileOperations {
  private validator: SecurePathValidator;
  
  constructor() {
    this.validator = new SecurePathValidator();
  }
  
  /**
   * Validate before any file operation
   */
  async validateOperation(
    operation: 'read' | 'write' | 'delete',
    path: string
  ): Promise<void> {
    const validation = this.validator.validatePath(path);
    
    if (!validation.valid) {
      throw new Error(`Invalid ${operation} operation: ${validation.error}`);
    }
    
    // Additional checks for destructive operations
    if (operation === 'delete') {
      const safePath = validation.safePath!;
      
      // Never delete these paths
      const protectedPaths = [
        homedir(),
        '/',
        process.cwd()
      ];
      
      for (const protectedPath of protectedPaths) {
        if (normalize(safePath) === normalize(protectedPath)) {
          throw new Error('Cannot delete protected directory');
        }
      }
    }
  }
}