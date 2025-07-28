import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen.ts'
import { NotFound } from './components/NotFound'
import { performanceMonitor, registerServiceWorker, addResourceHints } from './utils/performance'
import './styles/globals.css'

// Create a new router instance
const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
  defaultNotFoundComponent: NotFound,
  context: {
    seo: {
      title: 'Promptliano',
      description: 'AI-powered development assistant',
      keywords: []
    },
    navigation: {
      items: [],
      logoHref: '/'
    }
  }
})

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// Initialize performance monitoring
performanceMonitor.init((metrics) => {
  if (import.meta.env.DEV) {
    console.log('Performance metrics:', metrics)
  }
})

// Register service worker in production
registerServiceWorker()

// Add resource hints for faster loading
addResourceHints()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)
