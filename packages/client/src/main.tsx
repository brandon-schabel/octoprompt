import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import './index.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@ui'
import { octoClient } from '@/hooks/octo-client'

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
  octoClient: typeof octoClient
}

// Create router instance with context
const router = createRouter<typeof routeTree, 'never', RouterContext>({
  routeTree,
  defaultPreload: 'intent',
  context: {
    queryClient,
    octoClient
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
