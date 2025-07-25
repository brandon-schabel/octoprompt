import { retainSearchParams, stripSearchParams } from '@tanstack/react-router'

/**
 * Middleware to persist common project-related search params across navigation
 * This ensures projectId and tab parameters are retained when navigating
 */
export const persistProjectParams = retainSearchParams(['projectId', 'tab'])

/**
 * Middleware to persist authentication-related params
 */
export const persistAuthParams = retainSearchParams(['redirect', 'token'])

/**
 * Middleware to clean up default values from URLs
 * Keeps URLs cleaner by removing params that match their defaults
 */
export const stripDefaultParams = stripSearchParams({
  tab: '0',
  limit: 20,
  offset: 0,
  sort: 'desc'
})

/**
 * Custom middleware to handle active tab synchronization
 * Ensures tab parameter is always a valid number
 */
export const normalizeTabParam = ({ search, next }: { search: any; next: (search: any) => any }) => {
  const normalized = { ...search }

  // Ensure tab is a valid number or remove it
  if (normalized.tab !== undefined) {
    const tabNum = parseInt(normalized.tab, 10)
    if (isNaN(tabNum) || tabNum < 0) {
      delete normalized.tab
    } else {
      normalized.tab = tabNum.toString()
    }
  }

  return next(normalized)
}

/**
 * Composite middleware for project routes
 * Combines multiple middlewares for consistent behavior
 */
export const projectRouteMiddleware = [persistProjectParams, normalizeTabParam, stripDefaultParams]

/**
 * Middleware to persist filter and sort params for list views
 */
export const persistListParams = retainSearchParams(['filter', 'sort', 'sortBy', 'view', 'status', 'priority'])

/**
 * Custom middleware to handle timestamp params
 * Adds last visited timestamp to certain routes
 */
export const addTimestampMiddleware = ({ search, next }: { search: any; next: (search: any) => any }) => {
  const route = window.location.pathname
  const protectedRoutes = ['/projects', '/tickets', '/chat']

  if (protectedRoutes.some((r) => route.startsWith(r))) {
    return next({
      ...search,
      _lastVisited: Date.now()
    })
  }

  return next(search)
}
