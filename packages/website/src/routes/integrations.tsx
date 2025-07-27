import { createFileRoute, Outlet, Link, useLocation } from '@tanstack/react-router'
import { SeoMetadata } from '@/schemas/seo.schemas'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/integrations')({
  loader: () => {
    return {
      meta: {
        title: 'MCP Integrations - Promptliano',
        description:
          'Explore Promptliano integrations with VS Code, Cursor, Claude Desktop, and more through the Model Context Protocol.',
        keywords: ['MCP integration', 'VS Code', 'Cursor', 'Claude Desktop', 'developer tools integration']
      } as SeoMetadata
    }
  },
  component: IntegrationsLayout
})

const navItems = [
  { path: '/integrations', label: 'Overview', exact: true },
  { path: '/integrations/setup', label: 'Setup Wizard' },
  { path: '/integrations/examples', label: 'Examples' },
  { path: '/integrations/config', label: 'Config Generator' },
  { path: '/integrations/videos', label: 'Videos' },
  { path: '/integrations/troubleshooting', label: 'Troubleshooting' },
  { path: '/integrations/compatibility', label: 'Compatibility' }
]

function IntegrationsLayout() {
  const location = useLocation()

  return (
    <div>
      {/* Sub-navigation */}
      <div className='border-b border-border bg-background/95 backdrop-blur sticky top-0 z-10'>
        <div className='max-w-7xl mx-auto px-4 md:px-6 lg:px-8'>
          <nav className='flex gap-6 overflow-x-auto py-4'>
            {navItems.map((item) => {
              const isActive = item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path)

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors rounded-lg',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>

      <Outlet />
    </div>
  )
}
