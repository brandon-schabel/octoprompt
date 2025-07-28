import { createFileRoute, Link } from '@tanstack/react-router'
import { SeoMetadata } from '@/schemas/seo.schemas'
import {
  GlassCard,
  CTAButton,
  CTAButtonOutline,
  AnimateOnScroll,
  fadeInUp,
  staggerContainer,
  staggerItem
} from '@/components/ui'
import { DownloadButton } from '@/components/ui/download-button'
import { McpOverview, SetupWizard, CompatibilityMatrix, Troubleshooting } from '@/components/mcp'
import { motion } from 'framer-motion'
import {
  ChevronRight,
  Zap,
  Shield,
  Code2,
  Terminal,
  CheckCircle,
  ArrowRight,
  Sparkles,
  Settings,
  AlertCircle,
  Download
} from 'lucide-react'

export const Route = createFileRoute('/integrations/')({
  loader: () => {
    return {
      meta: {
        title: 'MCP Integrations - Promptliano | AI-Powered Development',
        description:
          'Integrate Promptliano with VS Code, Cursor, Claude Desktop, and more through Model Context Protocol. Easy installer, 60-70% token efficiency.',
        keywords: [
          'MCP',
          'Model Context Protocol',
          'integrations',
          'VS Code',
          'Cursor',
          'Claude Desktop',
          'Claude Code',
          'AI development',
          'token efficiency'
        ]
      } as SeoMetadata
    }
  },
  component: IntegrationsPage
})

const supportedEditors = [
  {
    name: 'VS Code',
    description: 'Full MCP integration with Visual Studio Code',
    icon: <Code2 className='w-6 h-6' />,
    status: 'stable',
    features: ['MCP extension support', 'IntelliSense integration', 'Debugging tools']
  },
  {
    name: 'Cursor',
    description: 'Native MCP support with enhanced AI features',
    icon: <Zap className='w-6 h-6' />,
    status: 'stable',
    features: ['Built-in MCP client', 'AI-powered code completion', 'Seamless setup']
  },
  {
    name: 'Claude Desktop',
    description: 'Direct integration for AI-assisted development',
    icon: <Terminal className='w-6 h-6' />,
    status: 'stable',
    features: ['Native MCP support', 'Project context awareness', 'Multi-file editing']
  },
  {
    name: 'Claude Code',
    description: 'Optimized for advanced code understanding',
    icon: <Sparkles className='w-6 h-6' />,
    status: 'stable',
    features: ['Enhanced code analysis', 'Smart refactoring', 'Context-aware suggestions']
  },
  {
    name: 'Windsurf',
    description: 'Modern IDE with MCP integration',
    icon: <Shield className='w-6 h-6' />,
    status: 'stable',
    features: ['MCP protocol support', 'Collaborative features', 'Cloud sync']
  }
]

const keyFeatures = [
  {
    title: '60-70% Token Efficiency',
    description: 'Revolutionary token reduction through intelligent file suggestions and caching',
    icon: <Zap className='w-5 h-5' />
  },
  {
    title: 'Universal Editor Support',
    description: 'Works seamlessly with all major MCP-compatible editors and IDEs',
    icon: <Code2 className='w-5 h-5' />
  },
  {
    title: 'Local-First Architecture',
    description: 'All data stays on your machine with full control and privacy',
    icon: <Shield className='w-5 h-5' />
  },
  {
    title: 'Easy One-Click Install',
    description: 'Simple setup process with automated configuration for all editors',
    icon: <CheckCircle className='w-5 h-5' />
  }
]

function IntegrationsPage() {
  return (
    <div className='py-20 px-4 md:px-6 lg:px-8'>
      <div className='mx-auto max-w-7xl'>
        {/* Hero Section */}
        <AnimateOnScroll>
          <div className='text-center mb-16'>
            <motion.h1
              className='text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent'
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              First Class MCP Support
            </motion.h1>
            <motion.p
              className='text-xl text-muted-foreground max-w-3xl mx-auto mb-8'
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              Connect Promptliano with your favorite development tools through the Model Context Protocol. Experience
              60-70% token efficiency and seamless AI-powered development.
            </motion.p>
            <motion.div
              className='flex flex-col sm:flex-row gap-4 justify-center items-center'
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <CTAButton href='#setup' size='lg'>
                Quick Setup Guide
                <ArrowRight className='ml-2 w-4 h-4' />
              </CTAButton>
              <CTAButtonOutline href='/docs/mcp' size='lg'>
                MCP Documentation
              </CTAButtonOutline>
            </motion.div>
          </div>
        </AnimateOnScroll>

        {/* Key Features */}
        <AnimateOnScroll>
          <div className='mb-20'>
            <motion.div
              className='grid md:grid-cols-2 lg:grid-cols-4 gap-6'
              variants={staggerContainer}
              initial='hidden'
              whileInView='visible'
              viewport={{ once: true }}
            >
              {keyFeatures.map((feature, index) => (
                <motion.div key={index} variants={staggerItem}>
                  <GlassCard className='p-6 h-full hover:border-primary/50 transition-all hover:scale-[1.02]'>
                    <div className='text-primary bg-primary/10 p-3 rounded-lg w-fit mb-4'>{feature.icon}</div>
                    <h3 className='text-lg font-semibold mb-2'>{feature.title}</h3>
                    <p className='text-sm text-muted-foreground'>{feature.description}</p>
                  </GlassCard>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </AnimateOnScroll>

        {/* Supported Editors */}
        <AnimateOnScroll>
          <section className='mb-20'>
            <h2 className='text-3xl md:text-4xl font-bold text-center mb-12'>Supported Editors</h2>
            <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-6'>
              {supportedEditors.map((editor, index) => (
                <motion.div
                  key={editor.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <GlassCard className='p-6 h-full hover:border-primary/50 transition-all group'>
                    <div className='flex items-start justify-between mb-4'>
                      <div className='text-primary bg-primary/10 p-3 rounded-lg group-hover:scale-110 transition-transform'>
                        {editor.icon}
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          editor.status === 'stable'
                            ? 'bg-green-500/20 text-green-500'
                            : 'bg-yellow-500/20 text-yellow-500'
                        }`}
                      >
                        {editor.status}
                      </span>
                    </div>
                    <h3 className='text-xl font-semibold mb-2'>{editor.name}</h3>
                    <p className='text-muted-foreground mb-4'>{editor.description}</p>
                    <ul className='space-y-2'>
                      {editor.features.map((feature, i) => (
                        <li key={i} className='flex items-center gap-2 text-sm text-muted-foreground'>
                          <CheckCircle className='w-4 h-4 text-primary' />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          </section>
        </AnimateOnScroll>

        {/* Easy Installer Section */}
        <AnimateOnScroll>
          <section className='mb-20'>
            <GlassCard className='p-8 md:p-12 bg-gradient-to-br from-primary/5 to-primary/10'>
              <div className='grid md:grid-cols-2 gap-8 items-center'>
                <div>
                  <h2 className='text-3xl md:text-4xl font-bold mb-4'>Easy One-Click Installer</h2>
                  <p className='text-lg text-muted-foreground mb-6'>
                    Get started with Promptliano in minutes. Our automated installer handles all the configuration for
                    your editor, so you can focus on building amazing software with AI assistance.
                  </p>
                  <ul className='space-y-3 mb-6'>
                    <li className='flex items-center gap-3'>
                      <CheckCircle className='w-5 h-5 text-primary' />
                      <span>Automatic editor detection</span>
                    </li>
                    <li className='flex items-center gap-3'>
                      <CheckCircle className='w-5 h-5 text-primary' />
                      <span>Zero configuration required</span>
                    </li>
                    <li className='flex items-center gap-3'>
                      <CheckCircle className='w-5 h-5 text-primary' />
                      <span>Cross-platform support</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <DownloadButton showPlatforms={true} />
                </div>
              </div>
            </GlassCard>
          </section>
        </AnimateOnScroll>

        {/* MCP Overview Section */}
        <McpOverview />

        {/* Built-in MCP Installer Section */}
        <AnimateOnScroll>
          <section id='setup' className='py-20'>
            <div className='text-center mb-12'>
              <h2 className='text-3xl md:text-4xl font-bold mb-4'>Built-in MCP Installer</h2>
              <p className='text-lg text-muted-foreground max-w-2xl mx-auto'>
                Promptliano includes a built-in MCP installer that makes setup effortless. No manual configuration
                needed!
              </p>
            </div>

            <GlassCard className='max-w-4xl mx-auto p-8'>
              <div className='mb-8'>
                <div className='flex items-center gap-3 mb-4'>
                  <div className='p-2 rounded-lg bg-primary/10'>
                    <Settings className='h-6 w-6 text-primary' />
                  </div>
                  <h3 className='text-2xl font-semibold'>Install MCP from Within Promptliano</h3>
                </div>
                <p className='text-muted-foreground mb-6'>
                  Forget about manual JSON configuration files. Promptliano handles everything for you with its built-in
                  installer.
                </p>
              </div>

              <div className='space-y-6'>
                <div className='flex items-start gap-4'>
                  <div className='flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold'>
                    1
                  </div>
                  <div>
                    <h4 className='font-semibold mb-2'>Open Your Project</h4>
                    <p className='text-muted-foreground'>
                      Launch Promptliano and open any project from the project selector.
                    </p>
                  </div>
                </div>

                <div className='flex items-start gap-4'>
                  <div className='flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold'>
                    2
                  </div>
                  <div>
                    <h4 className='font-semibold mb-2'>Navigate to Project Settings</h4>
                    <p className='text-muted-foreground'>
                      Click on the <span className='font-mono text-sm bg-muted px-1.5 py-0.5 rounded'>Settings</span>{' '}
                      tab in your project view.
                    </p>
                  </div>
                </div>

                <div className='flex items-start gap-4'>
                  <div className='flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold'>
                    3
                  </div>
                  <div>
                    <h4 className='font-semibold mb-2'>Find the MCP Installation Section</h4>
                    <p className='text-muted-foreground'>
                      Scroll down to find the "MCP Server Installation" section. This intelligent installer detects your
                      installed editors automatically.
                    </p>
                  </div>
                </div>

                <div className='flex items-start gap-4'>
                  <div className='flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold'>
                    4
                  </div>
                  <div>
                    <h4 className='font-semibold mb-2'>Click Install</h4>
                    <p className='text-muted-foreground'>
                      Select your editor and click the install button. Promptliano will:
                    </p>
                    <ul className='mt-2 space-y-1'>
                      <li className='flex items-center gap-2 text-sm text-muted-foreground'>
                        <CheckCircle className='w-4 h-4 text-green-500' />
                        Create the correct configuration file
                      </li>
                      <li className='flex items-center gap-2 text-sm text-muted-foreground'>
                        <CheckCircle className='w-4 h-4 text-green-500' />
                        Set up proper paths and permissions
                      </li>
                      <li className='flex items-center gap-2 text-sm text-muted-foreground'>
                        <CheckCircle className='w-4 h-4 text-green-500' />
                        Configure the MCP server connection
                      </li>
                    </ul>
                  </div>
                </div>

                <div className='flex items-start gap-4'>
                  <div className='flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold'>
                    5
                  </div>
                  <div>
                    <h4 className='font-semibold mb-2'>Restart Your Editor</h4>
                    <p className='text-muted-foreground'>
                      Restart your AI editor to activate the MCP connection. You're now ready to use Promptliano!
                    </p>
                  </div>
                </div>
              </div>

              <div className='mt-8 p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20'>
                <div className='flex items-start gap-3'>
                  <AlertCircle className='w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5' />
                  <div>
                    <p className='text-sm'>
                      <strong>Note:</strong> The built-in installer currently supports Claude Desktop, Cursor, VS Code,
                      and other popular editors. More editors are being added regularly.
                    </p>
                  </div>
                </div>
              </div>

              <div className='mt-6 text-center'>
                <CTAButton href='/downloads' size='lg'>
                  Download Promptliano
                  <Download className='ml-2 w-4 h-4' />
                </CTAButton>
              </div>
            </GlassCard>
          </section>
        </AnimateOnScroll>

        {/* Commented out manual setup - keeping for reference
        <AnimateOnScroll>
          <section id='setup' className='py-20'>
            <div className='text-center mb-12'>
              <h2 className='text-3xl md:text-4xl font-bold mb-4'>Quick Setup Guide</h2>
              <p className='text-lg text-muted-foreground max-w-2xl mx-auto'>
                Follow our interactive step-by-step guide to get Promptliano running with your development environment
              </p>
            </div>
            <SetupWizard />
          </section>
        </AnimateOnScroll>
        */}

        {/* Compatibility Matrix */}
        <AnimateOnScroll>
          <section className='py-20'>
            <div className='text-center mb-12'>
              <h2 className='text-3xl md:text-4xl font-bold mb-4'>Compatibility & Requirements</h2>
              <p className='text-lg text-muted-foreground max-w-2xl mx-auto'>
                Detailed compatibility information for Promptliano MCP across all supported editors
              </p>
            </div>
            <CompatibilityMatrix />
          </section>
        </AnimateOnScroll>

        {/* Troubleshooting Section */}
        <AnimateOnScroll>
          <section className='py-20'>
            <div className='text-center mb-12'>
              <h2 className='text-3xl md:text-4xl font-bold mb-4'>Troubleshooting</h2>
              <p className='text-lg text-muted-foreground max-w-2xl mx-auto'>
                Common issues and solutions for MCP integration setup
              </p>
            </div>
            <Troubleshooting />
          </section>
        </AnimateOnScroll>

        {/* CTA Section */}
        <AnimateOnScroll>
          <section className='py-20 text-center'>
            <GlassCard className='p-12 max-w-4xl mx-auto bg-gradient-to-br from-primary/10 to-primary/5'>
              <h2 className='text-3xl md:text-4xl font-bold mb-4'>Ready to Supercharge Your Development?</h2>
              <p className='text-lg text-muted-foreground mb-8 max-w-2xl mx-auto'>
                Join thousands of developers using Promptliano to build faster and smarter with AI-powered context
              </p>
              <div className='flex flex-col sm:flex-row gap-4 justify-center'>
                <CTAButton href='/docs/getting-started' size='lg'>
                  Get Started Free
                  <ChevronRight className='ml-2 w-4 h-4' />
                </CTAButton>
                <CTAButtonOutline href='/community' size='lg'>
                  Join Community
                </CTAButtonOutline>
              </div>
            </GlassCard>
          </section>
        </AnimateOnScroll>
      </div>
    </div>
  )
}
