import { SERVER_HTTP_ENDPOINT } from '@/constants/server-constants'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/health')({
  component: RouteComponent
})

function RouteComponent() {
  return (
    <div>
      Hello "/health"! Server Endpoint:
      {SERVER_HTTP_ENDPOINT}
    </div>
  )
}
