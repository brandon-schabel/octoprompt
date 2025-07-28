import { createFileRoute, Link } from '@tanstack/react-router'
import { SeoMetadata } from '@/schemas/seo.schemas'
import { GlassCard } from '@/components/ui/glass-card'
import { McpOverview } from '@/components/mcp'

export const Route = createFileRoute('/integrations/')({
  loader: () => {
    return {
      meta: {
        title: 'MCP Integrations Hub - Promptliano',
        description:
          'Connect Promptliano with your favorite development tools through Model Context Protocol integrations.',
        keywords: ['MCP', 'integrations', 'VS Code', 'Cursor', 'Claude Desktop', 'Claude Code']
      } as SeoMetadata
    }
  },
  component: IntegrationsPage
})

interface Integration {
  id: string
  name: string
  description: string
  icon: string
  path: string
  status: 'stable' | 'beta' | 'coming-soon'
}

const integrations: Integration[] = [
  {
    id: 'vscode',
    name: 'VS Code',
    description: 'Full integration with Visual Studio Code through our MCP server extension',
    icon: '📝',
    path: '/integrations/vscode',
    status: 'stable'
  },
  {
    id: 'cursor',
    name: 'Cursor',
    description: 'Native support for Cursor IDE with enhanced AI features',
    icon: '⚡',
    path: '/integrations/cursor',
    status: 'stable'
  },
  {
    id: 'claude-desktop',
    name: 'Claude Desktop',
    description: 'Direct integration with Claude Desktop for seamless AI assistance',
    icon: '🤖',
    path: '/integrations/claude-desktop',
    status: 'stable'
  },
  {
    id: 'claude-code',
    name: 'Claude Code',
    description: 'Optimized for Claude Code with advanced code understanding',
    icon: '💻',
    path: '/integrations/claude-code',
    status: 'beta'
  }
]

function IntegrationsPage() {
  return (
    <div className='py-20 px-4 md:px-6 lg:px-8'>
      <div className='mx-auto max-w-7xl'>
        <div className='text-center mb-12'>
          <h1 className='text-4xl md:text-5xl font-bold mb-4'>MCP Integrations</h1>
          <p className='text-lg text-muted-foreground max-w-2xl mx-auto'>
            Connect Promptliano with your favorite development tools through the Model Context Protocol
          </p>
        </div>

        <div className='grid md:grid-cols-2 gap-8'>
          {integrations.map((integration) => (
            <Link key={integration.id} to={integration.path} className='block transition-transform hover:scale-[1.02]'>
              <GlassCard className='p-8 h-full hover:border-primary/50'>
                <div className='flex items-start justify-between mb-4'>
                  <span className='text-4xl'>{integration.icon}</span>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      integration.status === 'stable'
                        ? 'bg-green-500/20 text-green-500'
                        : integration.status === 'beta'
                          ? 'bg-yellow-500/20 text-yellow-500'
                          : 'bg-gray-500/20 text-gray-500'
                    }`}
                  >
                    {integration.status}
                  </span>
                </div>
                <h3 className='text-2xl font-semibold mb-2'>{integration.name}</h3>
                <p className='text-muted-foreground'>{integration.description}</p>
              </GlassCard>
            </Link>
          ))}
        </div>

        <div className='mt-16 text-center'>
          <h2 className='text-2xl font-semibold mb-4'>More Integrations Coming Soon</h2>
          <p className='text-muted-foreground mb-8'>
            We're constantly expanding our integration ecosystem. Have a suggestion?
          </p>
          <Link to='/community' className='btn btn-outline'>
            Request Integration
          </Link>
        </div>

        {/* MCP Overview Section */}
        <div className='mt-20'>
          <McpOverview />
        </div>
      </div>
    </div>
  )
}
