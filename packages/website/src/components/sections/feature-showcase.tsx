import { FeatureGrid, FeatureCardAnimated } from '@/components/ui'
import { AnimateOnScroll } from '@/components/ui'
import type { Feature, FeatureShowcase } from '@/schemas'
import {
  Zap,
  Brain,
  Users,
  Shield,
  Code2,
  Workflow,
  FileSearch,
  GitBranch,
  Sparkles,
  Clock,
  CheckCircle,
  BarChart3
} from 'lucide-react'

const features: Feature[] = [
  {
    id: 'mcp-integration',
    title: 'Native MCP Integration',
    description:
      'Seamlessly works with all MCP-compatible editors including VSCode, Cursor, Claude Desktop, and Claude Code.',
    icon: {
      type: 'icon',
      value: 'Zap',
      color: 'text-yellow-500',
      backgroundColor: 'bg-yellow-500/10'
    },
    highlights: ['Zero configuration setup', 'Real-time synchronization', 'Multi-editor support']
  },
  {
    id: 'context-management',
    title: 'Intelligent Context Management',
    description:
      'Automatically provides relevant context to AI assistants, reducing token usage by up to 90% while improving accuracy.',
    icon: {
      type: 'icon',
      value: 'Brain',
      color: 'text-purple-500',
      backgroundColor: 'bg-purple-500/10'
    },
    highlights: ['Smart file relevance scoring', 'Semantic code understanding', 'Automatic context pruning']
  },
  {
    id: 'human-in-loop',
    title: 'Human-in-the-Loop Workflow',
    description: "Keep control over AI suggestions with a collaborative workflow that puts you in the driver's seat.",
    icon: {
      type: 'icon',
      value: 'Users',
      color: 'text-blue-500',
      backgroundColor: 'bg-blue-500/10'
    },
    highlights: ['Review before execution', 'Guided AI interactions', 'Progressive disclosure']
  },
  {
    id: 'project-management',
    title: 'Advanced Project Management',
    description: 'Organize your work with tickets, tasks, and prompts. Keep your AI assistant focused on what matters.',
    icon: {
      type: 'icon',
      value: 'Workflow',
      color: 'text-green-500',
      backgroundColor: 'bg-green-500/10'
    },
    highlights: ['Ticket & task tracking', 'Prompt library', 'Progress visualization']
  },
  {
    id: 'git-integration',
    title: 'Deep Git Integration',
    description:
      'Full Git workflow support including branches, commits, diffs, and more - all accessible to your AI assistant.',
    icon: {
      type: 'icon',
      value: 'GitBranch',
      color: 'text-orange-500',
      backgroundColor: 'bg-orange-500/10'
    },
    highlights: ['Branch management', 'Commit history analysis', 'Worktree support']
  },
  {
    id: 'performance',
    title: 'Lightning Fast Performance',
    description: 'Optimized for speed with intelligent caching, parallel processing, and minimal overhead.',
    icon: {
      type: 'icon',
      value: 'Zap',
      color: 'text-pink-500',
      backgroundColor: 'bg-pink-500/10'
    },
    highlights: ['Sub-second responses', 'Efficient token usage', 'Smart caching']
  }
]

export function FeatureShowcase() {
  const showcaseData: FeatureShowcase = {
    sectionTitle: 'Everything You Need for AI-Enhanced Development',
    sectionSubtitle:
      'Promptliano provides a comprehensive toolkit to supercharge your development workflow with AI assistance.',
    layout: 'grid',
    columns: {
      mobile: 1,
      tablet: 2,
      desktop: 3
    },
    features
  }

  const iconMap: Record<string, any> = {
    Zap,
    Brain,
    Users,
    Shield,
    Code2,
    Workflow,
    FileSearch,
    GitBranch,
    Sparkles,
    Clock,
    CheckCircle,
    BarChart3
  }

  return (
    <section className='relative py-24 overflow-hidden'>
      {/* Background decoration */}
      <div className='absolute inset-0 -z-10'>
        <div className='absolute inset-0 bg-gradient-to-b from-background via-muted/20 to-background' />
      </div>

      <div className='container mx-auto px-4'>
        <AnimateOnScroll>
          <div className='text-center max-w-3xl mx-auto mb-16'>
            <h2 className='text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent'>
              {showcaseData.sectionTitle}
            </h2>
            <p className='text-lg text-muted-foreground'>{showcaseData.sectionSubtitle}</p>
          </div>
        </AnimateOnScroll>

        <FeatureGrid columns={showcaseData.columns}>
          {showcaseData.features.map((feature, index) => {
            const Icon = iconMap[feature.icon.value] || Code2
            return (
              <AnimateOnScroll key={feature.id} delay={index * 0.1}>
                <FeatureCardAnimated
                  title={feature.title}
                  description={feature.description}
                  icon={Icon}
                  className='h-full'
                >
                  {feature.highlights && (
                    <ul className='mt-4 space-y-2'>
                      {feature.highlights.map((highlight, idx) => (
                        <li key={idx} className='flex items-start gap-2 text-sm text-muted-foreground'>
                          <CheckCircle className='h-4 w-4 text-primary mt-0.5' />
                          <span>{highlight}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </FeatureCardAnimated>
              </AnimateOnScroll>
            )
          })}
        </FeatureGrid>
      </div>
    </section>
  )
}
