import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import './index.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@ui'
import { client } from './generated/client.gen'
import { SERVER_HTTP_ENDPOINT } from './constants/server-constants'

// Initialize core services
const queryClient = new QueryClient()

client.setConfig({
  baseUrl: SERVER_HTTP_ENDPOINT
})

// Create router instance with context
const router = createRouter<typeof routeTree, 'never', true>({
  routeTree,
  defaultPreload: 'intent'
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
