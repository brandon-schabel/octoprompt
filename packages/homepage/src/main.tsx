import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import './index.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from 'sonner'

// Initialize core services
const queryClient = new QueryClient()


// Define the router context interface

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
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools
        initialIsOpen={false}
        position='bottom'
        buttonPosition='bottom-left'
      />}
      <Toaster />
    </QueryClientProvider>
  )
}
