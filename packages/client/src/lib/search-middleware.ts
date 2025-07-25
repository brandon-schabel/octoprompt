import type { SearchMiddleware } from '@tanstack/react-router'
import { defaultSearchParams } from './search-schemas'

/**
 * Middleware to retain project context (projectId, tab) across navigation
 */
export const retainProjectContext: SearchMiddleware = ({ search, next }) => {
  // Preserve projectId and tab if they exist in current search
  const preserved: Record<string, any> = {}

  if ('projectId' in search && search.projectId !== undefined) {
    preserved.projectId = search.projectId
  }

  if ('tab' in search && search.tab !== undefined && search.tab !== '') {
    preserved.tab = search.tab
  }

  return next({
    ...preserved,
    ...search
  })
}

/**
 * Middleware to strip default search params from URLs
 * This keeps URLs clean by removing parameters that match their default values
 */
export const stripDefaultSearchParams: SearchMiddleware = ({ search, next }) => {
  const cleaned = { ...search }

  // Remove params that match default values
  Object.entries(defaultSearchParams).forEach(([key, defaultValue]) => {
    if (key in cleaned && cleaned[key] === defaultValue) {
      delete cleaned[key]
    }
  })

  return next(cleaned)
}

/**
 * Middleware to validate and transform search parameters
 * Ensures numeric params are properly coerced
 */
export const validateAndTransformSearch: SearchMiddleware = ({ search, next }) => {
  const transformed = { ...search }

  // Coerce numeric fields
  if ('projectId' in transformed && typeof transformed.projectId === 'string') {
    transformed.projectId = parseInt(transformed.projectId, 10)
    if (isNaN(transformed.projectId)) {
      delete transformed.projectId
    }
  }

  if ('ticketId' in transformed && typeof transformed.ticketId === 'string') {
    transformed.ticketId = parseInt(transformed.ticketId, 10)
    if (isNaN(transformed.ticketId)) {
      delete transformed.ticketId
    }
  }

  // Ensure boolean fields are properly typed
  if ('prefill' in transformed && typeof transformed.prefill === 'string') {
    transformed.prefill = transformed.prefill === 'true'
  }

  return next(transformed)
}

/**
 * Combined middleware for project-related routes
 * Applies validation, transformation, and context retention
 */
export const projectRouteMiddleware: SearchMiddleware[] = [
  validateAndTransformSearch,
  retainProjectContext,
  stripDefaultSearchParams
]

/**
 * Middleware for chat route
 * Retains projectId context if available
 */
export const chatRouteMiddleware: SearchMiddleware[] = [
  validateAndTransformSearch,
  ({ search, next }) => {
    const preserved: Record<string, any> = {}

    // Preserve projectId from previous route if not explicitly set
    if (!('projectId' in search) && window.location.search.includes('projectId')) {
      const params = new URLSearchParams(window.location.search)
      const projectId = params.get('projectId')
      if (projectId) {
        preserved.projectId = parseInt(projectId, 10)
      }
    }

    return next({
      ...preserved,
      ...search
    })
  },
  stripDefaultSearchParams
]

/**
 * Helper to create route-specific middleware
 */
export function createRouteMiddleware(
  options: {
    retain?: string[]
    strip?: boolean
    validate?: boolean
  } = {}
): SearchMiddleware[] {
  const middleware: SearchMiddleware[] = []

  if (options.validate !== false) {
    middleware.push(validateAndTransformSearch)
  }

  if (options.retain && options.retain.length > 0) {
    middleware.push(({ search, next }) => {
      const preserved: Record<string, any> = {}

      options.retain!.forEach((key) => {
        if (key in search && search[key] !== undefined) {
          preserved[key] = search[key]
        }
      })

      return next({
        ...preserved,
        ...search
      })
    })
  }

  if (options.strip !== false) {
    middleware.push(stripDefaultSearchParams)
  }

  return middleware
}
