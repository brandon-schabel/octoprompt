import { redirect } from '@tanstack/react-router'

/**
 * Authentication state interface
 */
export interface AuthState {
  isAuthenticated: boolean
  user: {
    id: string
    name: string
    email: string
  } | null
  apiKey?: string
}

/**
 * Get current authentication state
 * In a real app, this would check tokens, session storage, etc.
 */
export function getAuthState(): AuthState {
  // Check for API key in localStorage
  const apiKey = localStorage.getItem('promptliano_api_key')

  // For now, we consider having an API key as being authenticated
  // In a full implementation, this would validate the key
  const isAuthenticated = !!apiKey

  return {
    isAuthenticated,
    user: isAuthenticated
      ? {
          id: 'user-1',
          name: 'Promptliano User',
          email: 'user@promptliano.com'
        }
      : null,
    apiKey: apiKey || undefined
  }
}

/**
 * beforeLoad function to check authentication
 * Redirects to login if not authenticated
 */
export async function requireAuth({ location, context }: { location: any; context: any }) {
  const auth = getAuthState()

  if (!auth.isAuthenticated) {
    throw redirect({
      to: '/'
    })
  }

  // Return auth state to be merged into context
  return {
    auth
  }
}

/**
 * beforeLoad function for admin-only routes
 */
export async function requireAdmin({ location, context }: { location: any; context: any }) {
  const auth = getAuthState()

  if (!auth.isAuthenticated) {
    throw redirect({
      to: '/'
    })
  }

  // Check for admin role (simplified for demo)
  const isAdmin = auth.user?.email?.endsWith('@admin.promptliano.com')

  if (!isAdmin) {
    throw redirect({
      to: '/'
    })
  }

  return {
    auth: {
      ...auth,
      isAdmin
    }
  }
}

/**
 * Helper to check if user has specific permissions
 */
export function hasPermission(auth: AuthState, permission: string): boolean {
  if (!auth.isAuthenticated) return false

  // Simplified permission check
  // In a real app, this would check against user roles/permissions
  const permissions: Record<string, string[]> = {
    'user-1': ['read', 'write', 'delete']
  }

  return permissions[auth.user?.id || '']?.includes(permission) || false
}
