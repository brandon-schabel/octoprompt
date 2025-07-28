import { createFileRoute, redirect } from '@tanstack/react-router'

// Redirect to projects page with assets tab
export const Route = createFileRoute('/assets')({
  beforeLoad: () => {
    throw redirect({
      to: '/projects',
      search: {
        activeView: 'assets'
      }
    })
  }
})
