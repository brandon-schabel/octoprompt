// Fixed Tauri fetch wrapper that properly maintains context

// Global variable to track if we're in Tauri environment
const isTauri = typeof window !== 'undefined' && window.__TAURI__ !== undefined

// Create a properly bound native fetch function
const createBoundFetch = (): typeof fetch => {
  if (typeof window !== 'undefined' && window.fetch) {
    return window.fetch.bind(window)
  }
  if (typeof global !== 'undefined' && global.fetch) {
    return global.fetch.bind(global)
  }
  return fetch
}

// Store the bound native fetch
const nativeFetch = createBoundFetch()

// Tauri fetch will be loaded dynamically
let tauriFetch: typeof fetch | undefined
let tauriLoadPromise: Promise<void> | undefined

// Load Tauri HTTP plugin if in Tauri environment
if (isTauri) {
  console.log('[TauriFetch] Detected Tauri environment, loading HTTP plugin...')
  tauriLoadPromise = import('@tauri-apps/plugin-http')
    .then((module) => {
      // Ensure Tauri fetch is also bound properly
      tauriFetch = module.fetch as typeof fetch
      console.log('[TauriFetch] Tauri HTTP plugin loaded successfully')
    })
    .catch((error) => {
      console.error('[TauriFetch] Failed to load Tauri HTTP plugin:', error)
      console.log('[TauriFetch] Will use native fetch as fallback')
    })
}

// Create the custom fetch function that returns a bound function
const createCustomFetch = () => {
  // This function will be called with proper context
  const fetchWrapper = async (input: RequestInfo | URL, init?: RequestInit) => {
    console.log('[TauriFetch] Fetch called for:', input)
    
    // Ensure input is a valid URL
    let url: string
    try {
      if (typeof input === 'string') {
        // If it's a relative URL, resolve it against the current origin
        url = input.startsWith('http') ? input : new URL(input, window.location.origin).toString()
      } else if (input instanceof URL) {
        url = input.toString()
      } else {
        url = input.url
      }
    } catch (error) {
      console.error('[TauriFetch] Failed to resolve URL:', error)
      throw new Error(`Invalid URL: ${input}`)
    }
    
    console.log('[TauriFetch] Resolved URL:', url)

    // In Tauri environment
    if (isTauri) {
      // Wait for Tauri plugin to load if it's still loading
      if (tauriLoadPromise) {
        try {
          await tauriLoadPromise
        } catch (e) {
          console.warn('[TauriFetch] Failed to wait for Tauri plugin load')
        }
      }

      // If Tauri fetch is available, use it
      if (tauriFetch) {
        console.log('[TauriFetch] Using Tauri HTTP plugin')
        try {
          // Call Tauri fetch with the resolved URL
          const response = await tauriFetch(url, init)
          console.log('[TauriFetch] Tauri fetch successful, status:', response.status)
          return response
        } catch (error) {
          console.error('[TauriFetch] Tauri fetch failed:', error)
          console.log('[TauriFetch] Falling back to native fetch...')
        }
      }
    }

    // Use native fetch (already bound to window)
    console.log('[TauriFetch] Using native fetch')
    try {
      const response = await nativeFetch(url, init)
      console.log('[TauriFetch] Native fetch successful, status:', response.status)
      return response
    } catch (error) {
      console.error('[TauriFetch] Native fetch failed:', error)
      throw error
    }
  }

  // Add preconnect as a no-op to match the fetch type
  ;(fetchWrapper as any).preconnect = (origin: string) => {
    console.log('[TauriFetch] Preconnect called for:', origin)
  }

  // Return the wrapper function directly - it doesn't need binding
  return fetchWrapper as typeof fetch
}

// Export the custom fetch function
export const customFetch = createCustomFetch()

// Helper to check if we're in Tauri
export const isRunningInTauri = () => isTauri

// Helper to check if Tauri fetch is available
export const isTauriFetchAvailable = () => Boolean(tauriFetch)

// Debug function
export const debugFetchAvailability = () => {
  console.log('[TauriFetch] Debug Info:')
  console.log('  - In Tauri environment:', isTauri)
  console.log('  - Tauri fetch available:', Boolean(tauriFetch))
  console.log('  - Native fetch available:', Boolean(nativeFetch))
  console.log('  - Window object:', typeof window !== 'undefined')
  console.log('  - Window.fetch:', typeof window !== 'undefined' && Boolean(window.fetch))
}

// Auto-run debug on load in development
if (import.meta.env.DEV) {
  console.log('[TauriFetch] Module loaded (fixed version)')
  debugFetchAvailability()
}
