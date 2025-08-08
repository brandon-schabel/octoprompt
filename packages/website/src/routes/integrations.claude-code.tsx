import { createFileRoute, Link } from '@tanstack/react-router'
import { SeoMetadata } from '@/schemas/seo.schemas'
import { GlassCard, HeroButton, CodeBlock, AnimateOnScroll } from '@/components/ui'
import { Code2, Check, Zap, GitBranch, Search, ArrowRight, AlertCircle } from 'lucide-react'

export const Route = createFileRoute('/integrations/claude-code')({
  loader: () => {
    return {
      meta: {
        title: 'Claude Code Integration - Promptliano',
        description: 'Supercharge Claude Code with Promptliano for enhanced code understanding and project management',
        keywords: ['Claude Code', 'MCP', 'AI coding', 'code assistant']
      } as SeoMetadata
    }
  },
  component: ClaudeCodePage
})

const features = [
  {
    icon: <Code2 className='w-6 h-6' />,
    title: 'Deep Code Understanding',
    description: 'Claude Code leverages Promptliano to understand your entire codebase'
  },
  {
    icon: <Zap className='w-6 h-6' />,
    title: 'Lightning Fast Search',
    description: 'Find files and code patterns instantly with AI-powered search'
  },
  {
    icon: <GitBranch className='w-6 h-6' />,
    title: 'Git Integration',
    description: 'Full git awareness for better code suggestions and commits'
  },
  {
    icon: <Search className='w-6 h-6' />,
    title: 'Smart Navigation',
    description: 'Navigate large codebases efficiently with intelligent file suggestions'
  }
]

const configExample = `{
  "mcpServers": {
    "promptliano": {
      "command": "promptliano",
      "args": ["start", "--mcp"],
      "env": {
        "CLAUDE_CODE": "true"
      }
    }
  }
}`

const usageExamples = [
  {
    prompt: '"Explain the authentication flow in this project"',
    description: 'Claude Code will analyze all auth-related files and provide a comprehensive overview'
  },
  {
    prompt: '"Refactor the user service to use async/await"',
    description: 'Get intelligent refactoring suggestions based on your project patterns'
  },
  {
    prompt: '"Create a new API endpoint for user profiles"',
    description: 'Claude Code will follow your existing patterns and conventions'
  },
  {
    prompt: '"Find all places where we handle errors"',
    description: 'Quickly locate error handling patterns across your codebase'
  }
]

function ClaudeCodePage() {
  return (
    <div className='py-20 px-4 md:px-6 lg:px-8'>
      <div className='mx-auto max-w-5xl'>
        {/* Header */}
        <AnimateOnScroll>
          <div className='text-center mb-12'>
            <div className='inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-6'>
              <Code2 className='w-8 h-8 text-primary' />
            </div>
            <h1 className='text-4xl md:text-5xl font-bold mb-4'>Claude Code Integration</h1>
            <p className='text-lg text-muted-foreground max-w-2xl mx-auto'>
              Transform Claude Code into your ultimate coding companion with Promptliano's powerful context engine
            </p>
          </div>
        </AnimateOnScroll>

        {/* Status Badge */}
        <AnimateOnScroll>
          <div className='flex justify-center mb-12'>
            <div className='inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/10 text-yellow-500 rounded-full'>
              <AlertCircle className='w-4 h-4' />
              <span className='font-medium'>Beta Integration</span>
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
                <h3 className='font-semibold mb-2'>2. Configure Claude Code</h3>
                <p className='text-sm text-muted-foreground mb-3'>Add to: ~/.claude-code/mcp.json</p>
                <CodeBlock code={configExample} language='json' filename='mcp.json' />
              </div>

              <div>
                <h3 className='font-semibold mb-2'>3. Launch Claude Code</h3>
                <p className='text-muted-foreground'>
                  Claude Code will automatically detect and connect to Promptliano
                </p>
              </div>
            </div>
          </GlassCard>
        </AnimateOnScroll>

        {/* Usage Examples */}
        <AnimateOnScroll>
          <div className='mb-16'>
            <h2 className='text-2xl font-bold mb-6'>Powerful Usage Examples</h2>
            <div className='grid md:grid-cols-2 gap-4'>
              {usageExamples.map((example, index) => (
                <GlassCard key={index} className='p-6'>
                  <div className='mb-3'>
                    <code className='text-sm text-primary bg-primary/10 px-2 py-1 rounded'>{example.prompt}</code>
                  </div>
                  <p className='text-sm text-muted-foreground'>{example.description}</p>
                </GlassCard>
              ))}
            </div>
          </div>
        </AnimateOnScroll>

        {/* Advanced Features */}
        <AnimateOnScroll>
          <GlassCard className='p-8 mb-16 border-primary/30'>
            <h2 className='text-2xl font-bold mb-6'>Advanced Features</h2>
            <div className='grid md:grid-cols-2 gap-6'>
              <div>
                <h3 className='font-semibold mb-3'>Ticket Integration</h3>
                <ul className='space-y-2 text-muted-foreground'>
                  <li className='flex items-start gap-2'>
                    <Check className='w-4 h-4 text-primary mt-0.5' />
                    <span>Create and manage tickets from Claude Code</span>
                  </li>
                  <li className='flex items-start gap-2'>
                    <Check className='w-4 h-4 text-primary mt-0.5' />
                    <span>Link code changes to specific tickets</span>
                  </li>
                  <li className='flex items-start gap-2'>
                    <Check className='w-4 h-4 text-primary mt-0.5' />
                    <span>Track progress on tasks automatically</span>
                  </li>
                </ul>
              </div>
              <div>
                <h3 className='font-semibold mb-3'>Smart Context</h3>
                <ul className='space-y-2 text-muted-foreground'>
                  <li className='flex items-start gap-2'>
                    <Check className='w-4 h-4 text-primary mt-0.5' />
                    <span>Automatic file summaries for better understanding</span>
                  </li>
                  <li className='flex items-start gap-2'>
                    <Check className='w-4 h-4 text-primary mt-0.5' />
                    <span>Import graph analysis for dependencies</span>
                  </li>
                  <li className='flex items-start gap-2'>
                    <Check className='w-4 h-4 text-primary mt-0.5' />
                    <span>Project-wide pattern recognition</span>
                  </li>
                </ul>
              </div>
            </div>
          </GlassCard>
        </AnimateOnScroll>

        {/* Beta Notice */}
        <AnimateOnScroll>
          <div className='bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-6 mb-16'>
            <div className='flex items-start gap-3'>
              <AlertCircle className='w-5 h-5 text-yellow-500 mt-0.5' />
              <div>
                <h3 className='font-semibold text-yellow-500 mb-2'>Beta Feature</h3>
                <p className='text-sm text-muted-foreground'>
                  Claude Code integration is currently in beta. Some features may change as we improve the integration.
                  We welcome your feedback to make it even better!
                </p>
              </div>
            </div>
          </div>
        </AnimateOnScroll>

        {/* CTA */}
        <AnimateOnScroll>
          <div className='text-center'>
            <div className='inline-flex gap-4'>
              <Link to='/integrations/setup'>
                <HeroButton>
                  Full Setup Guide
                  <ArrowRight className='w-4 h-4 ml-2' />
                </HeroButton>
              </Link>
              <Link to='/integrations/config'>
                <HeroButton variant='outline'>Configuration Generator</HeroButton>
              </Link>
            </div>
          </div>
        </AnimateOnScroll>
      </div>
    </div>
  )
}
