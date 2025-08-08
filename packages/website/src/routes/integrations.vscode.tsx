import { createFileRoute, Link } from '@tanstack/react-router'
import { SeoMetadata } from '@/schemas/seo.schemas'
import { GlassCard, HeroButton, CodeBlock, AnimateOnScroll, FeatureScreenshot } from '@/components/ui'
import { FileCode, Check, Settings, Puzzle, Terminal, ArrowRight } from 'lucide-react'

export const Route = createFileRoute('/integrations/vscode')({
  loader: () => {
    return {
      meta: {
        title: 'VS Code Integration - Promptliano',
        description: 'Set up Promptliano MCP server in Visual Studio Code for enhanced AI-powered development.',
        keywords: ['VS Code', 'MCP', 'Promptliano', 'extension', 'setup guide']
      } as SeoMetadata
    }
  },
  component: VSCodeIntegrationPage
})

const features = [
  {
    icon: <FileCode className='w-6 h-6' />,
    title: 'IntelliSense Integration',
    description: 'Get AI-powered code completions with full project context'
  },
  {
    icon: <Puzzle className='w-6 h-6' />,
    title: 'Extension Ecosystem',
    description: 'Works seamlessly with your existing VS Code extensions'
  },
  {
    icon: <Settings className='w-6 h-6' />,
    title: 'Customizable',
    description: 'Fine-tune behavior with VS Code settings and keybindings'
  },
  {
    icon: <Terminal className='w-6 h-6' />,
    title: 'Terminal Integration',
    description: 'Access Promptliano commands directly from the integrated terminal'
  }
]

const configExample = `{
  "mcp.servers": {
    "promptliano": {
      "command": "promptliano",
      "args": ["start", "--mcp"],
      "cwd": "~"
    }
  }
}`

const advancedConfig = `{
  "mcp.servers": {
    "promptliano": {
      "command": "promptliano",
      "args": ["start", "--mcp", "--verbose"],
      "cwd": "~",
      "env": {
        "NODE_ENV": "production",
        "PROMPTLIANO_LOG_LEVEL": "debug"
      },
      "settings": {
        "autoStart": true,
        "restartOnFailure": true,
        "maxRestarts": 3
      }
    }
  }
}`

function VSCodeIntegrationPage() {
  return (
    <div className='py-20 px-4 md:px-6 lg:px-8'>
      <div className='mx-auto max-w-5xl'>
        {/* Header */}
        <AnimateOnScroll>
          <div className='text-center mb-12'>
            <div className='inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-6'>
              <FileCode className='w-8 h-8 text-primary' />
            </div>
            <h1 className='text-4xl md:text-5xl font-bold mb-4'>VS Code Integration</h1>
            <p className='text-lg text-muted-foreground max-w-2xl mx-auto'>
              Enhance Visual Studio Code with Promptliano's powerful MCP server for AI-assisted development
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
                <h3 className='font-semibold mb-2'>2. Install MCP Extension</h3>
                <CodeBlock code='code --install-extension anthropic.mcp-client' language='bash' />
              </div>

              <div>
                <h3 className='font-semibold mb-2'>3. Configure VS Code</h3>
                <p className='text-sm text-muted-foreground mb-3'>
                  Add to your VS Code settings.json (Cmd+Shift+P → "Preferences: Open Settings (JSON)")
                </p>
                <CodeBlock code={configExample} language='json' filename='settings.json' />
              </div>

              <div>
                <h3 className='font-semibold mb-2'>4. Reload VS Code</h3>
                <p className='text-muted-foreground'>
                  Press Cmd+Shift+P → "Developer: Reload Window" to activate the MCP server
                </p>
              </div>
            </div>

            <div className='mt-6'>
              <FeatureScreenshot
                src='/assets/screenshots/provider-keys-management.webp'
                alt='API Key Management'
                title='API Key Management in VS Code'
                description='Securely manage your API keys for different AI providers'
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
                <h3 className='font-semibold mb-2'>Command Palette Integration</h3>
                <p className='text-muted-foreground mb-3'>Access Promptliano commands via VS Code's command palette</p>
                <div className='text-sm text-primary'>Cmd+Shift+P → "Promptliano: Show Project Overview"</div>
              </GlassCard>

              <GlassCard className='p-6'>
                <h3 className='font-semibold mb-2'>AI Assistant Integration</h3>
                <p className='text-muted-foreground mb-3'>
                  Use with GitHub Copilot or other AI extensions for enhanced suggestions
                </p>
                <div className='text-sm text-primary'>
                  Promptliano provides rich context to make AI suggestions more accurate
                </div>
              </GlassCard>

              <GlassCard className='p-6'>
                <h3 className='font-semibold mb-2'>File Explorer Context</h3>
                <p className='text-muted-foreground mb-3'>Right-click files in the explorer for Promptliano actions</p>
                <div className='text-sm text-primary'>
                  "Add to Promptliano Context" → "Create Ticket" → "Summarize File"
                </div>
              </GlassCard>
            </div>
          </div>
        </AnimateOnScroll>

        {/* Advanced Configuration */}
        <AnimateOnScroll>
          <GlassCard className='p-8 mb-16'>
            <h2 className='text-2xl font-bold mb-6'>Advanced Configuration</h2>
            <p className='text-muted-foreground mb-4'>Customize Promptliano for your specific workflow:</p>
            <CodeBlock code={advancedConfig} language='json' filename='settings.json' />
            <div className='mt-6 space-y-2'>
              <h3 className='font-semibold'>Configuration Options:</h3>
              <ul className='space-y-2 text-sm text-muted-foreground'>
                <li className='flex items-start gap-2'>
                  <Check className='w-4 h-4 text-primary mt-0.5' />
                  <span>
                    <code>autoStart</code> - Automatically start the MCP server
                  </span>
                </li>
                <li className='flex items-start gap-2'>
                  <Check className='w-4 h-4 text-primary mt-0.5' />
                  <span>
                    <code>restartOnFailure</code> - Auto-restart on crashes
                  </span>
                </li>
                <li className='flex items-start gap-2'>
                  <Check className='w-4 h-4 text-primary mt-0.5' />
                  <span>
                    <code>verbose</code> - Enable detailed logging
                  </span>
                </li>
                <li className='flex items-start gap-2'>
                  <Check className='w-4 h-4 text-primary mt-0.5' />
                  <span>
                    <code>env</code> - Set environment variables
                  </span>
                </li>
              </ul>
            </div>

            <div className='mt-6'>
              <FeatureScreenshot
                src='/assets/screenshots/mcp-analytics-overview.webp'
                alt='MCP Analytics'
                title='Performance Analytics'
                description='Monitor token usage and API performance metrics directly in VS Code'
                layout='centered'
              />
            </div>
          </GlassCard>
        </AnimateOnScroll>

        {/* Requirements */}
        <AnimateOnScroll>
          <div className='grid md:grid-cols-2 gap-6 mb-16'>
            <GlassCard className='p-6'>
              <h3 className='text-xl font-semibold mb-3'>System Requirements</h3>
              <ul className='space-y-2 text-muted-foreground'>
                <li className='flex items-start gap-2'>
                  <Check className='w-4 h-4 text-green-500 mt-0.5' />
                  <span>VS Code 1.80.0 or later</span>
                </li>
                <li className='flex items-start gap-2'>
                  <Check className='w-4 h-4 text-green-500 mt-0.5' />
                  <span>Node.js 18.0.0 or later</span>
                </li>
                <li className='flex items-start gap-2'>
                  <Check className='w-4 h-4 text-green-500 mt-0.5' />
                  <span>4GB RAM minimum</span>
                </li>
                <li className='flex items-start gap-2'>
                  <Check className='w-4 h-4 text-green-500 mt-0.5' />
                  <span>macOS, Windows, or Linux</span>
                </li>
              </ul>
            </GlassCard>

            <GlassCard className='p-6'>
              <h3 className='text-xl font-semibold mb-3'>Compatible Extensions</h3>
              <ul className='space-y-2 text-muted-foreground'>
                <li className='flex items-start gap-2'>
                  <Check className='w-4 h-4 text-green-500 mt-0.5' />
                  <span>GitHub Copilot</span>
                </li>
                <li className='flex items-start gap-2'>
                  <Check className='w-4 h-4 text-green-500 mt-0.5' />
                  <span>GitLens</span>
                </li>
                <li className='flex items-start gap-2'>
                  <Check className='w-4 h-4 text-green-500 mt-0.5' />
                  <span>ESLint / Prettier</span>
                </li>
                <li className='flex items-start gap-2'>
                  <Check className='w-4 h-4 text-green-500 mt-0.5' />
                  <span>Any language server</span>
                </li>
              </ul>
            </GlassCard>
          </div>
        </AnimateOnScroll>

        {/* CTA */}
        <AnimateOnScroll>
          <div className='text-center'>
            <div className='inline-flex gap-4'>
              <Link to='/integrations/setup'>
                <HeroButton>
                  Interactive Setup
                  <ArrowRight className='w-4 h-4 ml-2' />
                </HeroButton>
              </Link>
              <Link to='/integrations/troubleshooting'>
                <HeroButton variant='outline'>Troubleshooting</HeroButton>
              </Link>
            </div>
          </div>
        </AnimateOnScroll>
      </div>
    </div>
  )
}
