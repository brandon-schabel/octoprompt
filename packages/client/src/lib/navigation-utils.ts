import React from 'react'
import { Link, useNavigate, type LinkProps } from '@tanstack/react-router'
import type { ProjectsSearch, ChatSearch, TicketsSearch, AssetsSearch } from './search-schemas'

/**
 * Type-safe navigation utilities for OctoPrompt
 * These provide better type inference and developer experience
 */

// Type-safe route paths
export const routes = {
  projects: '/projects',
  chat: '/chat',
  tickets: '/tickets',
  assets: '/assets',
  prompts: '/prompts',
  keys: '/keys',
  health: '/health',
  projectSummarization: '/project-summarization'
} as const

// Type-safe Link components with proper search param types
export const ProjectsLink = (
  props: Omit<LinkProps, 'to' | 'search'> & {
    search?: ProjectsSearch | ((prev: ProjectsSearch) => ProjectsSearch)
  }
) => {
  return React.createElement(Link, { to: '/projects', ...props })
}

export const ChatLink = (
  props: Omit<LinkProps, 'to' | 'search'> & {
    search?: ChatSearch | ((prev: ChatSearch) => ChatSearch)
  }
) => {
  return React.createElement(Link, { to: '/chat', ...props })
}

// Navigation hook with type-safe search params
export function useTypedNavigate() {
  const navigate = useNavigate()

  return {
    toProjects: (search?: ProjectsSearch, options?: { replace?: boolean }) => {
      navigate({ to: routes.projects, search, ...options })
    },

    toChat: (search?: ChatSearch, options?: { replace?: boolean }) => {
      navigate({ to: routes.chat, search, ...options })
    },

    toProjectsWithTab: (tabId: number | string, options?: { replace?: boolean }) => {
      navigate({
        to: routes.projects,
        search: (prev) => ({ ...prev, tab: tabId.toString() }),
        ...options
      })
    },

    toProjectsWithView: (activeView: ProjectsSearch['activeView'], options?: { replace?: boolean }) => {
      navigate({
        to: routes.projects,
        search: (prev) => ({ ...prev, activeView }),
        ...options
      })
    },

    updateProjectView: (activeView: ProjectsSearch['activeView']) => {
      navigate({
        to: routes.projects,
        search: (prev) => ({ ...prev, activeView }),
        replace: true
      })
    },

    toChatWithProject: (projectId: number, prefill?: boolean, options?: { replace?: boolean }) => {
      navigate({
        to: routes.chat,
        search: { projectId, prefill: prefill ?? false },
        ...options
      })
    }
  }
}

// Helper to update search params while preserving others
export function updateSearchParams<T extends Record<string, any>>(updates: Partial<T>): (prev: T) => T {
  return (prev) => {
    const updated = { ...prev }

    // Remove undefined values
    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined) {
        delete updated[key]
      } else {
        updated[key] = value
      }
    })

    return updated
  }
}

// Helper to clear specific search params
export function clearSearchParams<T extends Record<string, any>>(...keys: (keyof T)[]): (prev: T) => Partial<T> {
  return (prev) => {
    const updated = { ...prev }
    keys.forEach((key) => delete updated[key])
    return updated
  }
}

// Type guard for search params
export function hasSearchParam<T extends Record<string, any>, K extends keyof T>(
  search: T,
  key: K
): search is T & Required<Pick<T, K>> {
  return key in search && search[key] !== undefined
}

// Utility to build search params with defaults
export function buildSearchParams<T extends Record<string, any>>(params: Partial<T>, defaults: T): T {
  return {
    ...defaults,
    ...Object.fromEntries(Object.entries(params).filter(([_, value]) => value !== undefined))
  } as T
}
