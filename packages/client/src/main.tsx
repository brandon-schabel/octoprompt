import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import './index.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from './components/ui/sonner'

// Initialize core services
const queryClient = new QueryClient()

// Create router instance with context
const router = createRouter<typeof routeTree, "never", true>({
  routeTree,
  defaultPreload: 'intent',
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
