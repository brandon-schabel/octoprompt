# Shared Package - Cross-Package Utilities and Types

You are an expert TypeScript developer working on the @promptliano/shared package. This package contains shared utilities, types, constants, and helper functions used across both client and server packages in the Promptliano ecosystem.

## Package Overview

The @promptliano/shared package provides:

- Common error classes and error handling utilities
- Cryptographic utilities for encryption/decryption
- File tree manipulation and import resolution utilities
- Pattern matching and path validation
- Structured output utilities for AI interactions
- Project utilities and formatters
- Shared constants and type definitions

### Architecture

```
packages/shared/
├── src/
│   ├── error/                    # Error classes and handling
│   │   ├── api-error.ts         # HTTP API errors
│   │   └── domain-error.ts      # Domain-specific errors
│   ├── utils/                    # Utility functions
│   │   ├── crypto.ts            # Encryption/decryption
│   │   ├── file-tree-utils/     # File tree operations
│   │   ├── pattern-matcher.ts   # Glob pattern matching
│   │   ├── parse-timestamp.ts   # Timestamp parsing
│   │   ├── merge-deep.ts       # Deep object merging
│   │   ├── projects-utils.ts   # Project-related utilities
│   │   ├── service-utils.ts    # Service layer helpers
│   │   └── zod-utils.ts        # Zod schema utilities
│   ├── constants/               # Shared constants
│   │   └── file-limits.ts      # File size/count limits
│   ├── structured-outputs/      # AI structured output utilities
│   └── claude-hook-templates.ts # Claude hook configurations
```

## Agent Integration Requirements

### Mandatory Agent Usage

When working in this package, these agents MUST be used:

1. **After Feature Implementation**
   - Always use `staff-engineer-code-reviewer` to review your code
   - The reviewer will analyze utility quality, edge cases, and cross-package compatibility
   - Ensure proper error handling and type safety

2. **When Refactoring**
   - Use `code-modularization-expert` for simplifying and modularizing code
   - Automatically triggered if reviewer suggests modularization
   - Focus on pure functions and composability

3. **Package-Specific Agents**
   - Use `typescript-expert` for advanced TypeScript patterns
   - Use `functional-programming-expert` for pure function design
   - Use `testing-expert` for comprehensive test coverage
   - Use `security-expert` for crypto and validation utilities

### Proactive Usage

- Don't wait for user requests - use agents automatically
- Provide clear context about utility purpose and usage
- Use multiple agents concurrently for maximum efficiency
- Document all edge cases and error conditions

## Feature Development Flow

This package is part of the 12-step fullstack feature development process:

1. **Zod schemas** - Utility schemas and validators
2. **Storage layer** - N/A for utilities
3. **Services** - Service utilities (this package)
4. **MCP tools** - N/A for utilities
5. **API routes** - N/A for utilities
6. **API client** - N/A for utilities
7. **React hooks** - N/A for utilities
8. **UI components** - N/A for utilities
9. **Page integration** - N/A for utilities
10. **Lint & typecheck** - Ensure code quality
11. **Code review** - MANDATORY staff-engineer-code-reviewer
12. **Address feedback** - Iterate based on review

### This Package's Role

This package provides foundational utilities and types that ensure consistency and reduce code duplication across all Promptliano packages.

## Core Design Principles

### 1. Pure Functions

All utilities should be pure functions with no side effects:

```typescript
// ✅ Good - Pure function
export function parseTimestamp(input: string | number | Date): number {
  if (typeof input === 'number') {
    return input > 1e12 ? input : input * 1000
  }
  if (input instanceof Date) {
    return input.getTime()
  }
  if (typeof input === 'string') {
    const parsed = Date.parse(input)
    if (!isNaN(parsed)) return parsed
  }
  throw new Error(`Invalid timestamp: ${input}`)
}

// ❌ Bad - Has side effects
let cache = {}
export function parseWithCache(input: string): any {
  if (cache[input]) return cache[input] // Side effect: reads external state
  const result = parse(input)
  cache[input] = result // Side effect: modifies external state
  return result
}
```

### 2. Comprehensive Error Handling

Provide detailed error information:

```typescript
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message)
    this.name = 'ApiError'

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError)
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      code: this.code,
      details: this.details
    }
  }

  static fromResponse(response: Response, body?: any): ApiError {
    return new ApiError(response.status, body?.message || response.statusText, body?.code, body?.details)
  }
}
```

### 3. Type Safety First

Use TypeScript's type system extensively:

```typescript
// Generic type-safe deep merge
export function mergeDeep<T extends Record<string, any>>(target: T, ...sources: Partial<T>[]): T {
  if (!sources.length) return target

  const source = sources.shift()

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} })
        mergeDeep(target[key], source[key])
      } else {
        Object.assign(target, { [key]: source[key] })
      }
    }
  }

  return mergeDeep(target, ...sources)
}

// Type guard
function isObject(item: any): item is Record<string, any> {
  return item && typeof item === 'object' && !Array.isArray(item)
}
```

## Error Handling Utilities

### API Error Class

Standardized API error handling:

```typescript
export class ApiError extends Error {
  static badRequest(message: string, details?: any): ApiError {
    return new ApiError(400, message, 'BAD_REQUEST', details)
  }

  static unauthorized(message = 'Unauthorized'): ApiError {
    return new ApiError(401, message, 'UNAUTHORIZED')
  }

  static forbidden(message = 'Forbidden'): ApiError {
    return new ApiError(403, message, 'FORBIDDEN')
  }

  static notFound(resource: string): ApiError {
    return new ApiError(404, `${resource} not found`, 'NOT_FOUND')
  }

  static conflict(message: string): ApiError {
    return new ApiError(409, message, 'CONFLICT')
  }

  static internal(message = 'Internal server error', details?: any): ApiError {
    return new ApiError(500, message, 'INTERNAL_ERROR', details)
  }
}
```

### Domain Error Class

Business logic errors:

```typescript
export class DomainError extends Error {
  constructor(
    public code: string,
    message: string,
    public context?: Record<string, any>
  ) {
    super(message)
    this.name = 'DomainError'
  }

  static validation(field: string, message: string): DomainError {
    return new DomainError('VALIDATION_ERROR', message, { field })
  }

  static businessRule(rule: string, message: string): DomainError {
    return new DomainError('BUSINESS_RULE_VIOLATION', message, { rule })
  }

  static stateTransition(from: string, to: string): DomainError {
    return new DomainError('INVALID_STATE_TRANSITION', `Cannot transition from ${from} to ${to}`, { from, to })
  }
}
```

## Cryptographic Utilities

### Encryption and Decryption

Secure data handling:

```typescript
import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto'
import { promisify } from 'util'

const scryptAsync = promisify(scrypt)

export class CryptoUtils {
  private static algorithm = 'aes-256-gcm'

  static async encrypt(text: string, password: string): Promise<string> {
    const salt = randomBytes(16)
    const iv = randomBytes(16)
    const key = (await scryptAsync(password, salt, 32)) as Buffer

    const cipher = createCipheriv(this.algorithm, key, iv)

    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    const authTag = cipher.getAuthTag()

    // Combine salt, iv, authTag, and encrypted data
    return Buffer.concat([salt, iv, authTag, Buffer.from(encrypted, 'hex')]).toString('base64')
  }

  static async decrypt(encryptedData: string, password: string): Promise<string> {
    const buffer = Buffer.from(encryptedData, 'base64')

    const salt = buffer.subarray(0, 16)
    const iv = buffer.subarray(16, 32)
    const authTag = buffer.subarray(32, 48)
    const encrypted = buffer.subarray(48)

    const key = (await scryptAsync(password, salt, 32)) as Buffer

    const decipher = createDecipheriv(this.algorithm, key, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encrypted, undefined, 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  }

  static generateKey(): string {
    return randomBytes(32).toString('base64')
  }
}
```

## File Tree Utilities

### File Node Operations

Manipulate file tree structures:

```typescript
export interface FileNode {
  id: string
  name: string
  type: 'file' | 'directory'
  path: string
  children?: FileNode[]
  content?: string
  size?: number
}

export class FileTreeUtils {
  static buildTree(files: FileNode[]): FileNode {
    const root: FileNode = {
      id: 'root',
      name: '/',
      type: 'directory',
      path: '/',
      children: []
    }

    const nodeMap = new Map<string, FileNode>()
    nodeMap.set('/', root)

    // Sort files by path depth
    files.sort((a, b) => a.path.split('/').length - b.path.split('/').length)

    for (const file of files) {
      const parts = file.path.split('/').filter(Boolean)
      let currentPath = ''
      let parent = root

      for (let i = 0; i < parts.length - 1; i++) {
        currentPath += '/' + parts[i]

        if (!nodeMap.has(currentPath)) {
          const dir: FileNode = {
            id: currentPath,
            name: parts[i],
            type: 'directory',
            path: currentPath,
            children: []
          }
          parent.children!.push(dir)
          nodeMap.set(currentPath, dir)
        }

        parent = nodeMap.get(currentPath)!
      }

      parent.children!.push(file)
    }

    return root
  }

  static flattenTree(node: FileNode): FileNode[] {
    const result: FileNode[] = []

    function traverse(n: FileNode) {
      result.push(n)
      if (n.children) {
        for (const child of n.children) {
          traverse(child)
        }
      }
    }

    traverse(node)
    return result
  }

  static findNode(root: FileNode, path: string): FileNode | null {
    if (root.path === path) return root

    if (root.children) {
      for (const child of root.children) {
        const found = this.findNode(child, path)
        if (found) return found
      }
    }

    return null
  }
}
```

### Import Resolution

Resolve file imports:

```typescript
export class ImportResolver {
  static resolveImports(content: string, currentPath: string, fileMap: Map<string, FileNode>): string[] {
    const imports: string[] = []
    const importRegex = /import\s+.*?\s+from\s+['"](.+?)['"]/g

    let match
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1]
      const resolved = this.resolvePath(importPath, currentPath)

      if (fileMap.has(resolved)) {
        imports.push(resolved)
      }
    }

    return imports
  }

  private static resolvePath(importPath: string, fromPath: string): string {
    // Handle relative imports
    if (importPath.startsWith('.')) {
      const dir = path.dirname(fromPath)
      return path.resolve(dir, importPath)
    }

    // Handle alias imports
    if (importPath.startsWith('@/')) {
      return importPath.replace('@/', '/src/')
    }

    // Handle node_modules
    return importPath
  }
}
```

## Pattern Matching Utilities

### Glob Pattern Matcher

Match files against patterns:

```typescript
export class PatternMatcher {
  private static cache = new Map<string, RegExp>()

  static match(pattern: string, path: string): boolean {
    const regex = this.patternToRegex(pattern)
    return regex.test(path)
  }

  static matchAny(patterns: string[], path: string): boolean {
    return patterns.some((pattern) => this.match(pattern, path))
  }

  static matchAll(patterns: string[], path: string): boolean {
    return patterns.every((pattern) => this.match(pattern, path))
  }

  private static patternToRegex(pattern: string): RegExp {
    if (this.cache.has(pattern)) {
      return this.cache.get(pattern)!
    }

    // Convert glob to regex
    let regex = pattern.replace(/\./g, '\\.').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]').replace(/\*\*/g, '.*')

    regex = `^${regex}$`

    const compiled = new RegExp(regex)
    this.cache.set(pattern, compiled)

    return compiled
  }

  static isIgnored(path: string, ignorePatterns: string[], allowPatterns: string[] = []): boolean {
    // Check allow patterns first (higher priority)
    if (allowPatterns.length > 0 && this.matchAny(allowPatterns, path)) {
      return false
    }

    // Check ignore patterns
    return this.matchAny(ignorePatterns, path)
  }
}
```

## Service Utilities

### Retry Logic

Implement retry with exponential backoff:

```typescript
export interface RetryOptions {
  maxAttempts?: number
  initialDelay?: number
  maxDelay?: number
  factor?: number
  shouldRetry?: (error: any, attempt: number) => boolean
}

export async function retry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { maxAttempts = 3, initialDelay = 1000, maxDelay = 10000, factor = 2, shouldRetry = () => true } = options

  let lastError: any

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      if (attempt === maxAttempts || !shouldRetry(error, attempt)) {
        throw error
      }

      const delay = Math.min(initialDelay * Math.pow(factor, attempt - 1), maxDelay)

      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError
}
```

### Circuit Breaker

Prevent cascading failures:

```typescript
export class CircuitBreaker {
  private failures = 0
  private lastFailureTime = 0
  private state: 'closed' | 'open' | 'half-open' = 'closed'

  constructor(
    private threshold = 5,
    private timeout = 60000,
    private resetTimeout = 30000
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'half-open'
      } else {
        throw new Error('Circuit breaker is open')
      }
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess() {
    if (this.state === 'half-open') {
      this.state = 'closed'
    }
    this.failures = 0
  }

  private onFailure() {
    this.failures++
    this.lastFailureTime = Date.now()

    if (this.failures >= this.threshold) {
      this.state = 'open'
    }
  }
}
```

## Testing Utilities

### Comprehensive Test Coverage

Every utility must have tests:

```typescript
import { describe, test, expect } from 'bun:test'
import { parseTimestamp } from '../parse-timestamp'

describe('parseTimestamp', () => {
  test('parses millisecond timestamps', () => {
    const ms = 1609459200000
    expect(parseTimestamp(ms)).toBe(ms)
  })

  test('parses second timestamps', () => {
    const seconds = 1609459200
    expect(parseTimestamp(seconds)).toBe(seconds * 1000)
  })

  test('parses ISO date strings', () => {
    const iso = '2021-01-01T00:00:00.000Z'
    expect(parseTimestamp(iso)).toBe(1609459200000)
  })

  test('parses Date objects', () => {
    const date = new Date('2021-01-01')
    expect(parseTimestamp(date)).toBe(date.getTime())
  })

  test('throws on invalid input', () => {
    expect(() => parseTimestamp('invalid')).toThrow('Invalid timestamp')
    expect(() => parseTimestamp(null as any)).toThrow()
    expect(() => parseTimestamp(undefined as any)).toThrow()
  })
})
```

### Test Utilities

Helper functions for testing:

```typescript
export class TestUtils {
  static async expectAsync(fn: () => Promise<any>): Promise<void> {
    let error: any

    try {
      await fn()
    } catch (e) {
      error = e
    }

    expect(error).toBeDefined()
  }

  static createMockFile(path: string, content = ''): FileNode {
    return {
      id: path,
      name: path.split('/').pop()!,
      type: 'file',
      path,
      content,
      size: content.length
    }
  }

  static async measureTime<T>(fn: () => Promise<T>): Promise<[T, number]> {
    const start = performance.now()
    const result = await fn()
    const duration = performance.now() - start
    return [result, duration]
  }
}
```

## Constants and Limits

### File Limits

Define system constraints:

```typescript
export const FILE_LIMITS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_FILE_COUNT: 1000,
  MAX_PATH_LENGTH: 260,
  MAX_NAME_LENGTH: 255,
  IGNORED_EXTENSIONS: ['.exe', '.dll', '.so', '.dylib'],
  BINARY_EXTENSIONS: ['.jpg', '.png', '.gif', '.pdf', '.zip'],
  TEXT_EXTENSIONS: ['.txt', '.md', '.ts', '.js', '.json', '.html', '.css']
} as const

export function isFileSizeValid(size: number): boolean {
  return size <= FILE_LIMITS.MAX_FILE_SIZE
}

export function isFileCountValid(count: number): boolean {
  return count <= FILE_LIMITS.MAX_FILE_COUNT
}

export function isPathLengthValid(path: string): boolean {
  return path.length <= FILE_LIMITS.MAX_PATH_LENGTH
}
```

## Best Practices

### 1. Function Design

- Keep functions small and focused
- Use descriptive names
- Document complex algorithms
- Handle edge cases explicitly
- Return early for invalid inputs

### 2. Error Handling

- Throw meaningful errors with context
- Use error classes for different types
- Include recovery suggestions
- Log errors appropriately
- Never swallow errors silently

### 3. Performance

- Cache expensive computations
- Use efficient algorithms
- Avoid unnecessary iterations
- Minimize object creation
- Profile bottlenecks

### 4. Testing

- Test all edge cases
- Test error conditions
- Use property-based testing
- Mock external dependencies
- Maintain high coverage

### 5. Documentation

- Document all public APIs
- Include usage examples
- Explain complex logic
- Note performance characteristics
- List prerequisites

## Common Pitfalls to Avoid

1. **Mutating Input Parameters** - Always return new objects
2. **Hidden Side Effects** - Keep functions pure
3. **Synchronous I/O** - Use async for I/O operations
4. **Missing Validation** - Validate all inputs
5. **Type Assertions** - Use type guards instead
6. **Global State** - Avoid mutable global variables
7. **Circular Dependencies** - Structure exports carefully

## Integration with Other Packages

- Used by **all packages** for common utilities
- Provides error classes used in API responses
- Crypto utilities used for secure data handling
- File utilities used by storage and services
- Pattern matching used by project management

The shared package is the foundation of code reuse in Promptliano. Every utility should be well-tested, documented, and designed for maximum reusability across the ecosystem.
