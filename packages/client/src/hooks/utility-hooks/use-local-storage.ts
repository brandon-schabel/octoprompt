import { useState, useEffect, useCallback } from 'react'

type SetValueFunction<T> = (value: T | ((prev: T) => T)) => void

function getStorageValue<T>(key: string, initialValue: T): T {
  if (typeof window === 'undefined') {
    return initialValue
  }

  try {
    const item = window.localStorage.getItem(key)
    return item ? JSON.parse(item) : initialValue
  } catch (error) {
    console.error(`Error reading localStorage key "${key}":`, error)
    return initialValue
  }
}

export function useLocalStorage<T>(key: string, initialValue: T): [T, SetValueFunction<T>] {
  // Initialize state with the value from localStorage or initial value
  const [storedValue, setStoredValue] = useState<T>(() => getStorageValue(key, initialValue))

  // Handle storage events from other tabs/windows
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      // Ensure the event is for localStorage and for the correct key
      if (event.storageArea === window.localStorage && event.key === key) {
        if (event.newValue === null) {
          // Key was removed or cleared from another tab/window
          // Reset to initialValue if current value is different
          if (JSON.stringify(storedValue) !== JSON.stringify(initialValue)) {
            setStoredValue(initialValue)
          }
          return
        }
        try {
          const newValueFromStorage = JSON.parse(event.newValue)
          // Optimization: only update React state if the new value from storage is different
          // from the current React state.
          if (JSON.stringify(newValueFromStorage) !== JSON.stringify(storedValue)) {
            setStoredValue(newValueFromStorage)
          }
        } catch (error) {
          console.error(`Error parsing storage value for key "${key}" from storage event:`, error)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [key, storedValue, initialValue]) // Updated dependencies

  // Memoized setValue function
  const setValue: SetValueFunction<T> = useCallback(
    (valueOrFn) => {
      try {
        const currentValue = storedValue
        const newValue = valueOrFn instanceof Function ? valueOrFn(currentValue) : valueOrFn

        // Optimization: Only update if the value has actually changed.
        if (JSON.stringify(newValue) === JSON.stringify(currentValue)) {
          return
        }

        setStoredValue(newValue) // Update React state

        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(newValue)) // Update localStorage

          // Manually dispatch event. This is useful if localStorage.setItem itself doesn't
          // trigger the 'storage' event reliably for the current tab in all browsers/scenarios,
          // or to ensure immediate propagation for other hook instances in the same tab.
          window.dispatchEvent(
            new StorageEvent('storage', {
              key,
              newValue: JSON.stringify(newValue),
              oldValue: JSON.stringify(currentValue), // Add oldValue
              storageArea: window.localStorage, // Add storageArea
              url: window.location.href // Add url
            })
          )
        }
      } catch (error) {
        console.error(`Error setting localStorage key "${key}":`, error)
      }
    },
    [key, storedValue] // storedValue is crucial here
  )

  return [storedValue, setValue]
}

// Optional: Type-safe wrapper for specific data structures
export function createTypedLocalStorage<T extends object>() {
  return (key: string, initialValue: T) => useLocalStorage<T>(key, initialValue)
}
