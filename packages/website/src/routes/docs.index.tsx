import { createFileRoute, Link } from '@tanstack/react-router'
import { SeoMetadata } from '@/schemas/seo.schemas'
import { GlassCard } from '@/components/ui/glass-card'

export const Route = createFileRoute('/docs/')({
  loader: () => {
    return {
      meta: {
        title: 'Documentation Hub - Promptliano',
        description: 'Explore comprehensive documentation, guides, and API references for Promptliano.',
        keywords: ['documentation', 'getting started', 'API', 'guides', 'tutorials']
      } as SeoMetadata
    }
  },
  component: DocsIndexPage
})

interface DocSection {
  title: string
  description: string
  links: Array<{
    label: string
    href: string
    badge?: string
  }>
}

const docSections: DocSection[] = [
  {
    title: 'Getting Started',
    description: 'Everything you need to know to get up and running with Promptliano',
    links: [
      { label: 'Quick Start Guide', href: '/docs/getting-started' },
      { label: 'Installation', href: '/docs/getting-started#installation' },
      { label: 'First Project', href: '/docs/getting-started#first-project' },
      { label: 'Configuration', href: '/docs/getting-started#configuration' }
    ]
  },
  {
    title: 'API Reference',
    description: 'Detailed documentation of all Promptliano APIs and MCP tools',
    links: [
      { label: 'Project Manager', href: '/docs/api#project-manager' },
      { label: 'Prompt Manager', href: '/docs/api#prompt-manager' },
      { label: 'Task Manager', href: '/docs/api#task-manager' },
      { label: 'Git Manager', href: '/docs/api#git-manager', badge: 'Enhanced' }
    ]
  },
  {
    title: 'Guides & Tutorials',
    description: 'In-depth guides for common use cases and best practices',
    links: [
      { label: 'Building Context Efficiently', href: '/docs/guides#context' },
      { label: 'Working with Tickets', href: '/docs/guides#tickets' },
      { label: 'File Suggestions', href: '/docs/guides#file-suggestions', badge: 'New' },
      { label: 'Using Agents', href: '/docs/guides#agents' }
    ]
  }
]

function DocsIndexPage() {
  return (
    <div className='py-20 px-4 md:px-6 lg:px-8'>
      <div className='mx-auto max-w-7xl'>
        <div className='text-center mb-12'>
          <h1 className='text-4xl md:text-5xl font-bold mb-4'>Documentation</h1>
          <p className='text-lg text-muted-foreground max-w-2xl mx-auto'>
            Everything you need to master Promptliano and transform your development workflow
          </p>
        </div>

        <div className='grid md:grid-cols-3 gap-8 mb-12'>
          {docSections.map((section, index) => (
            <GlassCard key={index} className='p-8'>
              <h2 className='text-2xl font-semibold mb-3'>{section.title}</h2>
              <p className='text-muted-foreground mb-6'>{section.description}</p>
              <ul className='space-y-2'>
                {section.links.map((link, linkIndex) => (
                  <li key={linkIndex}>
                    <Link to={link.href} className='text-primary hover:underline flex items-center justify-between'>
                      {link.label}
                      {link.badge && (
                        <span className='text-xs bg-primary/20 text-primary px-2 py-1 rounded'>{link.badge}</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </GlassCard>
          ))}
        </div>

        <GlassCard className='p-8'>
          <div className='flex items-start'>
            <span className='text-3xl mr-4'>💡</span>
            <div>
              <h3 className='text-xl font-semibold mb-2'>Pro Tip: Use the Search</h3>
              <p className='text-muted-foreground'>
                Looking for something specific? Use <kbd className='px-2 py-1 bg-muted rounded text-sm'>Cmd+K</kbd> to
                quickly search through all documentation.
              </p>
            </div>
          </div>
        </GlassCard>

        <div className='mt-12 text-center'>
          <p className='text-muted-foreground mb-4'>Can't find what you're looking for?</p>
          <Link to='/community' className='btn btn-outline'>
            Ask the Community
          </Link>
        </div>
      </div>
    </div>
  )
}
