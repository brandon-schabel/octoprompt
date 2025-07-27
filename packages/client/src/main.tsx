import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import './index.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@ui'
import { promptlianoClient } from '@/hooks/promptliano-client'

// Initialize core services
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000 // 10 minutes (formerly cacheTime)
    }
  }
})

// Router context interface
export interface RouterContext {
  queryClient: QueryClient
  promptlianoClient: typeof promptlianoClient
}

// Create router instance with context
const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  context: {
    queryClient,
    promptlianoClient: promptlianoClient
  }
})

// Type registration for router
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
    routeTree: typeof routeTree
  }
}

const rootElement = document.getElementById('root') as HTMLElement

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>
  )
}
