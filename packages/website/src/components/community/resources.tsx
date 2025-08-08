import { GlassCard } from '@/components/ui'
import { Download, FileText, Package, Code, ArrowRight, ExternalLink } from 'lucide-react'
import type { DownloadItem, ResourceItem } from '@/schemas/community.schemas'

const mockDownloads: DownloadItem[] = [
  {
    id: '1',
    name: 'Promptliano Logo Pack',
    version: '1.0.0',
    platform: 'universal',
    size: '2.4 MB',
    url: '/downloads/promptliano-logos.zip',
    releaseDate: '2025-01-15T00:00:00Z',
    releaseNotes: 'SVG and PNG logos in various sizes and colors'
  },
  {
    id: '2',
    name: 'Quick Start Template',
    version: '2.1.0',
    platform: 'universal',
    size: '156 KB',
    url: '/downloads/promptliano-template.zip',
    releaseDate: '2025-01-20T00:00:00Z',
    releaseNotes: 'Basic project structure with example configurations'
  },
  {
    id: '3',
    name: 'VS Code Extension',
    version: '0.5.2',
    platform: 'universal',
    size: '4.8 MB',
    url: 'https://marketplace.visualstudio.com/items?itemName=promptliano.vscode',
    releaseDate: '2025-01-25T00:00:00Z',
    releaseNotes: 'Syntax highlighting and IntelliSense for Promptliano files'
  }
]

const mockResources: ResourceItem[] = [
  {
    id: '1',
    title: 'Getting Started with Promptliano',
    type: 'video',
    description: 'Complete walkthrough of setting up your first Promptliano project',
    url: 'https://youtube.com/watch?v=example1',
    thumbnail: '/images/video-thumb-1.jpg',
    author: 'Promptliano Team',
    duration: '12:34',
    difficulty: 'beginner',
    tags: ['tutorial', 'setup', 'basics']
  },
  {
    id: '2',
    title: 'Advanced MCP Configuration Guide',
    type: 'article',
    description: 'Deep dive into MCP configuration options and best practices',
    url: '/docs/advanced-mcp-config',
    author: 'Brandon',
    difficulty: 'advanced',
    tags: ['mcp', 'configuration', 'advanced']
  },
  {
    id: '3',
    title: 'Multi-Agent Workflow Template',
    type: 'template',
    description: 'Pre-configured template for complex multi-agent development workflows',
    url: '/templates/multi-agent-workflow',
    difficulty: 'intermediate',
    tags: ['agents', 'workflow', 'template']
  },
  {
    id: '4',
    title: 'Building a Full-Stack App',
    type: 'example',
    description: 'Complete example of building a full-stack application with Promptliano',
    url: 'https://github.com/promptliano/examples/tree/main/full-stack-app',
    author: 'Community',
    difficulty: 'intermediate',
    tags: ['example', 'full-stack', 'tutorial']
  }
]

const platformIcons = {
  windows: '🪟',
  macos: '🍎',
  linux: '🐧',
  universal: '🌍'
}

const typeIcons = {
  video: '📹',
  article: '📄',
  tutorial: '📚',
  example: '💡',
  template: '📋'
}

const difficultyColors = {
  beginner: 'text-green-500 bg-green-500/10',
  intermediate: 'text-yellow-500 bg-yellow-500/10',
  advanced: 'text-red-500 bg-red-500/10'
}

interface ResourcesProps {
  downloads?: DownloadItem[]
  resources?: ResourceItem[]
}

export function Resources({ downloads = mockDownloads, resources = mockResources }: ResourcesProps) {
  return (
    <div className='space-y-8'>
      {/* Downloads Section */}
      <GlassCard className='p-8'>
        <div className='flex items-center gap-3 mb-6'>
          <div className='w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center'>
            <Download className='w-5 h-5 text-primary' />
          </div>
          <div>
            <h3 className='text-2xl font-bold'>Downloads</h3>
            <p className='text-muted-foreground'>Logos, templates, and tools to get started</p>
          </div>
        </div>

        <div className='grid gap-4'>
          {downloads.map((item) => (
            <div
              key={item.id}
              className='flex items-center justify-between p-4 bg-background/50 rounded-lg hover:bg-background/80 transition-colors'
            >
              <div className='flex items-center gap-4'>
                <div className='text-2xl'>
                  {item.name.includes('Logo')
                    ? '🎨'
                    : item.name.includes('Template')
                      ? '📋'
                      : item.name.includes('Extension')
                        ? '🔌'
                        : '📦'}
                </div>
                <div>
                  <h4 className='font-semibold'>{item.name}</h4>
                  <p className='text-sm text-muted-foreground'>{item.releaseNotes}</p>
                  <div className='flex items-center gap-3 mt-1 text-xs text-muted-foreground'>
                    <span>
                      {platformIcons[item.platform]} {item.platform}
                    </span>
                    <span>v{item.version}</span>
                    <span>{item.size}</span>
                  </div>
                </div>
              </div>

              <a
                href={item.url}
                download={!item.url.startsWith('http')}
                target={item.url.startsWith('http') ? '_blank' : undefined}
                rel={item.url.startsWith('http') ? 'noopener noreferrer' : undefined}
                className='inline-flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg font-medium text-sm transition-colors'
              >
                <Download className='w-4 h-4' />
                Download
              </a>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Learning Resources Section */}
      <GlassCard className='p-8'>
        <div className='flex items-center gap-3 mb-6'>
          <div className='w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center'>
            <FileText className='w-5 h-5 text-primary' />
          </div>
          <div>
            <h3 className='text-2xl font-bold'>Learning Resources</h3>
            <p className='text-muted-foreground'>Tutorials, examples, and guides to master Promptliano</p>
          </div>
        </div>

        <div className='grid md:grid-cols-2 gap-4'>
          {resources.map((resource) => (
            <a
              key={resource.id}
              href={resource.url}
              target={resource.url.startsWith('http') ? '_blank' : undefined}
              rel={resource.url.startsWith('http') ? 'noopener noreferrer' : undefined}
              className='group block p-4 bg-background/50 rounded-lg hover:bg-background/80 transition-colors'
            >
              <div className='flex items-start gap-3'>
                <span className='text-2xl'>{typeIcons[resource.type]}</span>
                <div className='flex-1'>
                  <h4 className='font-semibold group-hover:text-primary transition-colors'>{resource.title}</h4>
                  <p className='text-sm text-muted-foreground mt-1'>{resource.description}</p>

                  <div className='flex items-center gap-3 mt-3'>
                    {resource.difficulty && (
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${difficultyColors[resource.difficulty]}`}
                      >
                        {resource.difficulty}
                      </span>
                    )}
                    {resource.author && <span className='text-xs text-muted-foreground'>by {resource.author}</span>}
                    {resource.duration && <span className='text-xs text-muted-foreground'>{resource.duration}</span>}
                  </div>

                  {resource.tags.length > 0 && (
                    <div className='flex gap-1 mt-2'>
                      {resource.tags.map((tag) => (
                        <span key={tag} className='text-xs bg-background px-2 py-0.5 rounded'>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <ExternalLink className='w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors' />
              </div>
            </a>
          ))}
        </div>

        <div className='mt-6 text-center'>
          <a href='/docs' className='inline-flex items-center gap-2 text-primary hover:underline font-medium'>
            Browse all documentation
            <ArrowRight className='w-4 h-4' />
          </a>
        </div>
      </GlassCard>
    </div>
  )
}
