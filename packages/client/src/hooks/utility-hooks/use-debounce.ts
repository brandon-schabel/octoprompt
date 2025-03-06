/*
 * File: use-debounce.ts
 * Purpose: Provides hooks for debouncing values and functions
 * Key Features:
 * - Debounces any value type
 * - Debounces function calls
 * - Configurable delay
 * 
 * Most Recent Changes:
 * - Added value debouncing
 * - Kept function debouncing as useDebounceCallback
 */

import { useCallback, useRef, useState, useEffect } from 'react'

// Debounce values (like search input)
export function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value)

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value)
        }, delay)

        return () => {
            clearTimeout(handler)
        }
    }, [value, delay])

    return debouncedValue
}

// Debounce function calls (original implementation)
export function useDebounceCallback<T extends (...args: any[]) => void>(
    callback: T,
    delay: number
): T {
    const timeoutRef = useRef<ReturnType<typeof setTimeout>>(setTimeout(() => { }))

    const debouncedCallback = useCallback(
        (...args: Parameters<T>) => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
            }

            timeoutRef.current = setTimeout(() => {
                callback(...args)
            }, delay)
        },
        [callback, delay]
    ) as T

    return debouncedCallback
} 