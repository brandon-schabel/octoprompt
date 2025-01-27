import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import './index.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { APIInterface } from './utils/api/api-interface'
import { SERVER_HTTP_ENDPOINT } from './constants/server-constants'
import { Toaster } from './components/ui/sonner'
import { GlobalStateProvider } from './websocket-state/context/global-state-provider'

// Initialize core services
const queryClient = new QueryClient()
const apiInterface = new APIInterface(
  SERVER_HTTP_ENDPOINT
)

// Define the router context interface
interface RouterContext {
  api: APIInterface
}

// Create router instance with context
const router = createRouter<typeof routeTree, "never", true>({
  routeTree,
  defaultPreload: 'intent',
  context: {
    api: apiInterface,
  } satisfies RouterContext
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
      <GlobalStateProvider>
        <RouterProvider router={router} />
        <Toaster />
      </GlobalStateProvider>
    </QueryClientProvider>
  )
}
