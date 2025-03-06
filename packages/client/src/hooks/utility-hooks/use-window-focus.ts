/*
 * File: use-window-focus.ts
 * Purpose: Manages window focus and visibility state changes
 * Key Features:
 * - Detects when window regains focus
 * - Handles visibility state changes
 * - Provides callbacks for focus/blur events
 * 
 * Most Recent Changes:
 * - Initial implementation
 * - Added support for visibility change events
 */

import { useEffect, useCallback } from 'react'

interface WindowFocusOptions {
  onFocus?: () => void | Promise<void>
  onBlur?: () => void | Promise<void>
  onVisibilityChange?: (isVisible: boolean) => void | Promise<void>
  enabled?: boolean
}

export function useWindowFocus({
  onFocus,
  onBlur,
  onVisibilityChange,
  enabled = true,
}: WindowFocusOptions = {}) {
  const handleFocus = useCallback(async () => {
    if (!enabled) return
    try {
      await onFocus?.()
    } catch (error) {
      console.error('Error in window focus handler:', error)
    }
  }, [onFocus, enabled])

  const handleBlur = useCallback(async () => {
    if (!enabled) return
    try {
      await onBlur?.()
    } catch (error) {
      console.error('Error in window blur handler:', error)
    }
  }, [onBlur, enabled])

  const handleVisibilityChange = useCallback(async () => {
    if (!enabled) return
    try {
      const isVisible = document.visibilityState === 'visible'
      await onVisibilityChange?.(isVisible)
    } catch (error) {
      console.error('Error in visibility change handler:', error)
    }
  }, [onVisibilityChange, enabled])

  useEffect(() => {
    if (!enabled) return

    // Add event listeners
    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Initial check
    if (document.hasFocus()) {
      handleFocus()
    }

    // Cleanup
    return () => {
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [handleFocus, handleBlur, handleVisibilityChange, enabled])
} 