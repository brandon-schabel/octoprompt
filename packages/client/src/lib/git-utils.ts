import type { GitFileStatus } from '@promptliano/schemas'

/**
 * Get the appropriate color class for a git file status
 */
export function getGitStatusColor(status: string, isStaged: boolean = false): string {
  if (isStaged) {
    return 'text-green-600 dark:text-green-400'
  }

  switch (status) {
    case 'modified':
      return 'text-yellow-600 dark:text-yellow-400'
    case 'added':
      return 'text-green-600 dark:text-green-400'
    case 'deleted':
      return 'text-red-600 dark:text-red-400'
    case 'renamed':
      return 'text-blue-600 dark:text-blue-400'
    case 'untracked':
      return 'text-gray-600 dark:text-gray-400'
    default:
      return 'text-muted-foreground'
  }
}

/**
 * Get a human-readable label for git status
 */
export function getGitStatusLabel(status: string, isStaged: boolean = false): string {
  if (isStaged) {
    return 'staged'
  }
  return status
}

/**
 * Extract filename from a file path
 */
export function getFileName(path: string): string {
  return path.split('/').pop() || path
}

/**
 * Get directory path from a file path
 */
export function getDirectoryPath(path: string): string {
  const parts = path.split('/')
  parts.pop()
  return parts.join('/') || '/'
}
