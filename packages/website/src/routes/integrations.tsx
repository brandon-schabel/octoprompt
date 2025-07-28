import { createFileRoute, Outlet } from '@tanstack/react-router'
import { SeoMetadata } from '@/schemas/seo.schemas'

export const Route = createFileRoute()({
  loader: () => {
    return {
      meta: {
        title: 'MCP Integrations - Promptliano',
        description:
          'Integrate Promptliano with VS Code, Cursor, Claude Desktop, and more through the Model Context Protocol for efficient AI-powered development.',
        keywords: ['MCP integration', 'VS Code', 'Cursor', 'Claude Desktop', 'developer tools integration', 'AI development']
      } as SeoMetadata
    }
  },
  component: IntegrationsLayout
}) as any

function IntegrationsLayout() {
  return <Outlet />
}
