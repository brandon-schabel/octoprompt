import { AnimateOnScroll, GlassCard } from '@/components/ui'
import { HeroButton } from '@/components/ui/hero-button'
import { McpEditor, McpIntegration } from '@/schemas'
import { motion } from 'framer-motion'
import { Check, ArrowRight } from 'lucide-react'

const mcpData: McpIntegration = {
  overview: {
    title: 'Works with Your Favorite AI-Powered Editors',
    description:
      'Promptliano seamlessly integrates with all MCP-compatible editors, providing consistent context management across your entire development workflow.',
    benefits: [
      'Single source of truth for all AI assistants',
      'Consistent context across different editors',
      'Zero configuration required',
      'Real-time synchronization'
    ]
  },
  supportedEditors: [
    {
      name: 'vscode',
      displayName: 'Visual Studio Code',
      icon: 'https://code.visualstudio.com/assets/images/code-stable.png',
      description: 'The most popular code editor with AI extensions',
      setupUrl: '/docs/setup/vscode',
      supported: true
    },
    {
      name: 'cursor',
      displayName: 'Cursor',
      icon: 'https://cursor.sh/favicon.ico',
      description: 'AI-first code editor built for pair programming with AI',
      setupUrl: '/docs/setup/cursor',
      supported: true
    },
    {
      name: 'claude-desktop',
      displayName: 'Claude Desktop',
      icon: 'https://claude.ai/favicon.ico',
      description: 'Native desktop app for Claude AI assistant',
      setupUrl: '/docs/setup/claude-desktop',
      supported: true
    },
    {
      name: 'claude-code',
      displayName: 'Claude Code',
      icon: 'https://claude.ai/favicon.ico',
      description: 'Advanced AI coding assistant in your browser',
      setupUrl: '/docs/setup/claude-code',
      supported: true
    }
  ],
  setupSteps: {},
  tools: [],
  compatibility: {
    minimumNodeVersion: '18.0.0',
    supportedPlatforms: ['windows', 'macos', 'linux'],
    requiredDependencies: ['node', 'npm']
  }
}

export function McpIntegrationSection() {
  return (
    <section className='relative py-24 overflow-hidden'>
      {/* Background gradient */}
      <div className='absolute inset-0 -z-10'>
        <div className='absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5' />
        <div className='absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-primary/10 blur-[128px]' />
      </div>

      <div className='container mx-auto px-4'>
        <AnimateOnScroll>
          <div className='text-center max-w-3xl mx-auto mb-16'>
            <h2 className='text-3xl md:text-4xl font-bold mb-4'>{mcpData.overview.title}</h2>
            <p className='text-lg text-muted-foreground mb-8'>{mcpData.overview.description}</p>
          </div>
        </AnimateOnScroll>

        {/* Editor logos grid */}
        <div className='grid grid-cols-2 md:grid-cols-4 gap-6 mb-16 max-w-4xl mx-auto'>
          {mcpData.supportedEditors.map((editor, index) => (
            <AnimateOnScroll key={editor.name} delay={index * 0.1}>
              <GlassCard className='p-6 text-center hover:scale-105 transition-transform cursor-pointer'>
                <motion.div whileHover={{ rotate: [0, -5, 5, 0] }} transition={{ duration: 0.5 }}>
                  <img src={editor.icon} alt={editor.displayName} className='w-16 h-16 mx-auto mb-4 rounded-lg' />
                </motion.div>
                <h3 className='font-semibold mb-1'>{editor.displayName}</h3>
                <p className='text-sm text-muted-foreground'>{editor.description}</p>
              </GlassCard>
            </AnimateOnScroll>
          ))}
        </div>

        {/* Benefits list */}
        <AnimateOnScroll>
          <div className='max-w-3xl mx-auto'>
            <GlassCard className='p-8'>
              <h3 className='text-xl font-semibold mb-6 text-center'>Why Choose Promptliano for MCP?</h3>
              <div className='grid md:grid-cols-2 gap-4'>
                {mcpData.overview.benefits.map((benefit, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className='flex items-start gap-3'
                  >
                    <Check className='h-5 w-5 text-green-500 mt-0.5 flex-shrink-0' />
                    <span className='text-muted-foreground'>{benefit}</span>
                  </motion.div>
                ))}
              </div>
              <div className='mt-8 text-center'>
                <HeroButton href='/docs/getting-started' size='lg'>
                  Get Started with MCP
                  <ArrowRight className='ml-2 h-4 w-4' />
                </HeroButton>
              </div>
            </GlassCard>
          </div>
        </AnimateOnScroll>
      </div>
    </section>
  )
}
