import { usePromptlianoClientInstance } from '@/context/promptliano-client-context'

// Export hook for accessing the client
export { usePromptlianoClientInstance as usePromptlianoClient }

// Helper to create a proxy that throws meaningful errors
const createDeprecatedProxy = (serviceName: string) => {
  return new Proxy(
    {},
    {
      get(target, prop) {
        const errorMessage = `Direct promptlianoClient.${serviceName} usage is deprecated. Use usePromptlianoClient() hook instead.`
        console.error(errorMessage)
        // Return a function that throws an error when called
        return () => {
          throw new Error(errorMessage)
        }
      }
    }
  )
}

// Temporary compatibility export - will throw errors when accessed
// This helps identify places still using the old pattern
export const promptlianoClient = new Proxy(
  {},
  {
    get(target, prop: string) {
      console.error(`Direct promptlianoClient.${prop} usage is deprecated. Use usePromptlianoClient() hook instead.`)
      return createDeprecatedProxy(prop)
    }
  }
) as any
