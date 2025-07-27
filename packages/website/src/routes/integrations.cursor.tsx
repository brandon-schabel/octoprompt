import { createFileRoute, Link } from '@tanstack/react-router'
import { SeoMetadata } from '@/schemas/seo.schemas'
import { GlassCard, CTAButton, CodeBlock, AnimateOnScroll } from '@/components/ui'
import { Zap, Check, Brain, Sparkles, Command, ArrowRight } from 'lucide-react'

export const Route = createFileRoute('/integrations/cursor')({
  loader: () => {
    return {
      meta: {
        title: 'Cursor Integration - Promptliano',
        description: 'Set up Promptliano MCP server in Cursor IDE for enhanced AI-powered development.',
        keywords: ['Cursor', 'MCP', 'Promptliano', 'IDE', 'setup guide']
      } as SeoMetadata
    }
  },
  component: CursorIntegrationPage
})

const features = [
  {
    icon: <Brain className='w-6 h-6' />,
    title: 'AI-First Design',
    description: 'Built from the ground up for AI-assisted development'
  },
  {
    icon: <Zap className='w-6 h-6' />,
    title: 'Lightning Fast',
    description: 'Native performance with instant context switching'
  },
  {
    icon: <Sparkles className='w-6 h-6' />,
    title: 'Smart Completions',
    description: 'Context-aware suggestions powered by Promptliano'
  },
  {
    icon: <Command className='w-6 h-6' />,
    title: 'Seamless Integration',
    description: "Works perfectly with Cursor's AI features"
  }
]

const configExample = `{
  "mcp": {
    "servers": {
      "promptliano": {
        "command": "promptliano",
        "args": ["start", "--mcp"]
      }
    }
  }
}`

const advancedFeatures = [
  {
    title: 'Codebase Indexing',
    description: 'Automatic indexing of your entire project for instant search',
    example: 'Ask: "Find all API endpoints" and get instant results'
  },
  {
    title: 'Multi-File Context',
    description: 'Understand relationships between files and modules',
    example: 'Cursor sees how components, services, and tests connect'
  },
  {
    title: 'Smart Refactoring',
    description: 'AI-powered refactoring with full project awareness',
    example: 'Rename a function and update all references automatically'
  },
  {
    title: 'Ticket Integration',
    description: 'Link code changes to tickets and track progress',
    example: 'Create tickets from TODOs or link commits to existing tickets'
  }
]

function CursorIntegrationPage() {
  return (
    <div className='py-20 px-4 md:px-6 lg:px-8'>
      <div className='mx-auto max-w-5xl'>
        {/* Header */}
        <AnimateOnScroll>
          <div className='text-center mb-12'>
            <div className='inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-6'>
              <Zap className='w-8 h-8 text-primary' />
            </div>
            <h1 className='text-4xl md:text-5xl font-bold mb-4'>Cursor Integration</h1>
            <p className='text-lg text-muted-foreground max-w-2xl mx-auto'>
              Supercharge Cursor IDE with Promptliano's intelligent project context and AI-powered features
            </p>
          </div>
        </AnimateOnScroll>

        {/* Status Badge */}
        <AnimateOnScroll>
          <div className='flex justify-center mb-12'>
            <div className='inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-500 rounded-full'>
              <Check className='w-4 h-4' />
              <span className='font-medium'>Stable Integration</span>
            </div>
          </div>
        </AnimateOnScroll>

        {/* Features */}
        <AnimateOnScroll>
          <div className='grid md:grid-cols-2 gap-6 mb-16'>
            {features.map((feature, index) => (
              <GlassCard key={index} className='p-6'>
                <div className='flex items-start gap-4'>
                  <div className='text-primary bg-primary/10 p-3 rounded-lg'>{feature.icon}</div>
                  <div>
                    <h3 className='text-xl font-semibold mb-2'>{feature.title}</h3>
                    <p className='text-muted-foreground'>{feature.description}</p>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </AnimateOnScroll>

        {/* Quick Setup */}
        <AnimateOnScroll>
          <GlassCard className='p-8 mb-16'>
            <h2 className='text-2xl font-bold mb-6'>Quick Setup</h2>

            <div className='space-y-6'>
              <div>
                <h3 className='font-semibold mb-2'>1. Install Promptliano</h3>
                <CodeBlock code='npm install -g promptliano' language='bash' />
              </div>

              <div>
                <h3 className='font-semibold mb-2'>2. Configure Cursor</h3>
                <p className='text-sm text-muted-foreground mb-3'>Add to ~/.cursor/config.json</p>
                <CodeBlock code={configExample} language='json' filename='config.json' />
              </div>

              <div>
                <h3 className='font-semibold mb-2'>3. Restart Cursor</h3>
                <p className='text-muted-foreground'>Quit and reopen Cursor to activate the MCP server</p>
              </div>
            </div>
          </GlassCard>
        </AnimateOnScroll>

        {/* Advanced Features */}
        <AnimateOnScroll>
          <div className='mb-16'>
            <h2 className='text-2xl font-bold mb-6 text-center'>Cursor + Promptliano = Superpowers</h2>
            <div className='grid md:grid-cols-2 gap-6'>
              {advancedFeatures.map((feature, index) => (
                <GlassCard key={index} className='p-6'>
                  <h3 className='font-semibold text-lg mb-2'>{feature.title}</h3>
                  <p className='text-muted-foreground mb-3'>{feature.description}</p>
                  <div className='bg-primary/5 p-3 rounded-lg'>
                    <p className='text-sm text-primary'>
                      <strong>Example:</strong> {feature.example}
                    </p>
                  </div>
                </GlassCard>
              ))}
            </div>
          </div>
        </AnimateOnScroll>

        {/* Usage Examples */}
        <AnimateOnScroll>
          <GlassCard className='p-8 mb-16'>
            <h2 className='text-2xl font-bold mb-6'>Pro Tips for Cursor Users</h2>

            <div className='space-y-6'>
              <div className='border-l-4 border-primary pl-4'>
                <h3 className='font-semibold mb-2'>Cmd+K for Everything</h3>
                <p className='text-muted-foreground mb-2'>Use Cmd+K to access Promptliano-enhanced commands:</p>
                <ul className='text-sm text-muted-foreground space-y-1 ml-4'>
                  <li>• "Find files related to [feature]"</li>
                  <li>• "Show project structure"</li>
                  <li>• "List open tickets"</li>
                  <li>• "Summarize recent changes"</li>
                </ul>
              </div>

              <div className='border-l-4 border-primary pl-4'>
                <h3 className='font-semibold mb-2'>Chat Context</h3>
                <p className='text-muted-foreground'>
                  When using Cursor Chat, mention @promptliano to get project-specific context
                </p>
              </div>

              <div className='border-l-4 border-primary pl-4'>
                <h3 className='font-semibold mb-2'>Multi-File Operations</h3>
                <p className='text-muted-foreground'>
                  Select multiple files in the sidebar and ask Cursor to refactor them - Promptliano provides the
                  context
                </p>
              </div>
            </div>
          </GlassCard>
        </AnimateOnScroll>

        {/* Performance Stats */}
        <AnimateOnScroll>
          <GlassCard className='p-8 mb-16 border-primary/30'>
            <h2 className='text-2xl font-bold mb-6 text-center'>Performance Impact</h2>
            <div className='grid md:grid-cols-3 gap-6 text-center'>
              <div>
                <div className='text-3xl font-bold text-primary mb-2'>90%</div>
                <p className='text-muted-foreground'>Fewer tokens used</p>
              </div>
              <div>
                <div className='text-3xl font-bold text-primary mb-2'>3x</div>
                <p className='text-muted-foreground'>Faster file searches</p>
              </div>
              <div>
                <div className='text-3xl font-bold text-primary mb-2'>100%</div>
                <p className='text-muted-foreground'>Local & secure</p>
              </div>
            </div>
          </GlassCard>
        </AnimateOnScroll>

        {/* CTA */}
        <AnimateOnScroll>
          <div className='text-center'>
            <div className='inline-flex gap-4'>
              <Link to='/integrations/setup'>
                <CTAButton>
                  Full Setup Guide
                  <ArrowRight className='w-4 h-4 ml-2' />
                </CTAButton>
              </Link>
              <Link to='/integrations/troubleshooting'>
                <CTAButton variant='ghost'>Troubleshooting</CTAButton>
              </Link>
            </div>
          </div>
        </AnimateOnScroll>
      </div>
    </div>
  )
}
