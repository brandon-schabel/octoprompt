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
          setStoredValue(initialValue)
          return
        }
        try {
          const newValueFromStorage = JSON.parse(event.newValue)
          setStoredValue(newValueFromStorage)
        } catch (error) {
          console.error(`Error parsing storage value for key "${key}" from storage event:`, error)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [key, initialValue]) // Remove storedValue from dependencies to prevent loops

  // Memoized setValue function
  const setValue: SetValueFunction<T> = useCallback(
    (valueOrFn) => {
      setStoredValue((currentValue) => {
        try {
          const newValue = valueOrFn instanceof Function ? valueOrFn(currentValue) : valueOrFn

          // Optimization: Only update if the value has actually changed.
          if (JSON.stringify(newValue) === JSON.stringify(currentValue)) {
            return currentValue
          }

          if (typeof window !== 'undefined') {
            window.localStorage.setItem(key, JSON.stringify(newValue)) // Update localStorage

            // Manually dispatch event for other tabs/windows
            window.dispatchEvent(
              new StorageEvent('storage', {
                key,
                newValue: JSON.stringify(newValue),
                oldValue: JSON.stringify(currentValue),
                storageArea: window.localStorage,
                url: window.location.href
              })
            )
          }
          
          return newValue
        } catch (error) {
          console.error(`Error setting localStorage key "${key}":`, error)
          return currentValue
        }
      })
    },
    [key] // Only depend on key, not storedValue
  )

  return [storedValue, setValue]
}

// Optional: Type-safe wrapper for specific data structures
export function createTypedLocalStorage<T extends object>() {
  return (key: string, initialValue: T) => useLocalStorage<T>(key, initialValue)
}
