import { createFileRoute, Link } from '@tanstack/react-router'
import { SeoMetadata } from '@/schemas/seo.schemas'
import { GlassCard, CTAButton, CodeBlock, AnimateOnScroll, FeatureScreenshot } from '@/components/ui'
import { Bot, Check, FileJson, Sparkles, Terminal, ArrowRight } from 'lucide-react'

export const Route = createFileRoute('/integrations/claude-desktop')({
  loader: () => {
    return {
      meta: {
        title: 'Claude Desktop Integration - Promptliano',
        description: 'Integrate Promptliano with Claude Desktop for seamless AI-powered development',
        keywords: ['Claude Desktop', 'MCP', 'AI integration', 'Anthropic']
      } as SeoMetadata
    }
  },
  component: ClaudeDesktopPage
})

const features = [
  {
    icon: <Bot className='w-6 h-6' />,
    title: 'Native Integration',
    description: 'Direct MCP support built into Claude Desktop'
  },
  {
    icon: <Sparkles className='w-6 h-6' />,
    title: 'Context Awareness',
    description: 'Claude understands your entire project structure'
  },
  {
    icon: <FileJson className='w-6 h-6' />,
    title: 'Smart Suggestions',
    description: 'AI-powered file suggestions with 60-70% token reduction'
  },
  {
    icon: <Terminal className='w-6 h-6' />,
    title: 'Tool Access',
    description: 'Full access to all Promptliano MCP tools'
  }
]

const configExample = `{
  "mcpServers": {
    "promptliano": {
      "command": "promptliano",
      "args": ["start", "--mcp"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}`

function ClaudeDesktopPage() {
  return (
    <div className='py-20 px-4 md:px-6 lg:px-8'>
      <div className='mx-auto max-w-5xl'>
        {/* Header */}
        <AnimateOnScroll>
          <div className='text-center mb-12'>
            <div className='inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-6'>
              <Bot className='w-8 h-8 text-primary' />
            </div>
            <h1 className='text-4xl md:text-5xl font-bold mb-4'>Claude Desktop Integration</h1>
            <p className='text-lg text-muted-foreground max-w-2xl mx-auto'>
              Enhance Claude Desktop with Promptliano's powerful project management and context awareness
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
                <h3 className='font-semibold mb-2'>2. Configure Claude Desktop</h3>
                <p className='text-sm text-muted-foreground mb-3'>
                  Add to: ~/Library/Application Support/Claude/mcp.json (macOS)
                </p>
                <CodeBlock code={configExample} language='json' filename='mcp.json' />
              </div>

              <div>
                <h3 className='font-semibold mb-2'>3. Restart Claude Desktop</h3>
                <p className='text-muted-foreground'>Quit and reopen Claude Desktop to load the MCP server</p>
              </div>
            </div>

            <div className='mt-6'>
              <FeatureScreenshot
                src='/assets/screenshots/mcp-tools-configuration.webp'
                alt='MCP Configuration'
                title='MCP Tools in Claude Desktop'
                description='Once configured, Claude Desktop will have access to all Promptliano MCP tools'
                layout='centered'
              />
            </div>
          </GlassCard>
        </AnimateOnScroll>

        {/* Usage Examples */}
        <AnimateOnScroll>
          <div className='mb-16'>
            <h2 className='text-2xl font-bold mb-6'>How to Use</h2>
            <div className='space-y-4'>
              <GlassCard className='p-6'>
                <h3 className='font-semibold mb-2'>Ask about your project</h3>
                <p className='text-muted-foreground mb-3'>"What's the structure of my React app?"</p>
                <div className='text-sm text-primary'>
                  Claude will use Promptliano to analyze your project files and provide insights
                </div>
              </GlassCard>

              <GlassCard className='p-6'>
                <h3 className='font-semibold mb-2'>Get file suggestions</h3>
                <p className='text-muted-foreground mb-3'>"Find files related to authentication"</p>
                <div className='text-sm text-primary'>
                  Promptliano's AI-powered search will find relevant files instantly
                </div>
              </GlassCard>

              <GlassCard className='p-6'>
                <h3 className='font-semibold mb-2'>Work with tickets</h3>
                <p className='text-muted-foreground mb-3'>"Show me open tickets for the frontend"</p>
                <div className='text-sm text-primary'>Access and manage your project tickets directly in Claude</div>
              </GlassCard>
            </div>
          </div>

          <div className='mt-6'>
            <FeatureScreenshot
              src='/assets/screenshots/project-chat-interface.webp'
              alt='Claude Desktop Chat'
              title='Claude Desktop with Promptliano Context'
              description='Claude can access your entire project structure and provide contextual assistance'
              layout='centered'
            />
          </div>
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
