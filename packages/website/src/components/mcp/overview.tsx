import { motion } from 'framer-motion'
import { GlassCard, AnimateOnScroll, fadeInUp, staggerContainer, staggerItem } from '@/components/ui'
import { CheckCircle, Zap, Shield, Code2, Layers, Brain } from 'lucide-react'

const benefits = [
  {
    icon: <Brain className='w-6 h-6' />,
    title: 'Context-Aware AI',
    description: 'Provides rich project context to AI models for better code understanding'
  },
  {
    icon: <Zap className='w-6 h-6' />,
    title: 'Lightning Fast',
    description: '60-70% token reduction with intelligent file suggestions and caching'
  },
  {
    icon: <Shield className='w-6 h-6' />,
    title: 'Secure & Local',
    description: 'All data stays on your machine with full control over what AI sees'
  },
  {
    icon: <Code2 className='w-6 h-6' />,
    title: 'Universal Support',
    description: 'Works with VSCode, Cursor, Claude Desktop, and Claude Code'
  },
  {
    icon: <Layers className='w-6 h-6' />,
    title: 'Multi-Modal',
    description: 'Handles code, documentation, tickets, and git operations seamlessly'
  },
  {
    icon: <CheckCircle className='w-6 h-6' />,
    title: 'Human-in-the-Loop',
    description: 'Designed for collaborative AI workflows with full transparency'
  }
]

const ArchitectureDiagram = () => (
  <div className="flex flex-col items-center gap-4 p-4 max-w-full">
    {/* Your Development Environment */}
    <div className="w-full max-w-2xl">
      <div className="border-2 border-border rounded-lg p-4 bg-card/50">
        <h3 className="text-center font-semibold mb-4">Your Development Environment</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="border border-border/50 rounded p-2 text-center text-sm">VS Code</div>
          <div className="border border-border/50 rounded p-2 text-center text-sm">Cursor</div>
          <div className="border border-border/50 rounded p-2 text-center text-sm">Claude Desktop</div>
          <div className="border border-border/50 rounded p-2 text-center text-sm">Claude Code</div>
        </div>
      </div>
    </div>
    
    {/* Connection Line */}
    <div className="h-8 w-0.5 bg-border"></div>
    
    {/* MCP Protocol */}
    <div className="border-2 border-primary/50 rounded-lg p-4 bg-primary/5">
      <h3 className="text-center font-semibold">MCP Protocol</h3>
      <p className="text-center text-sm text-muted-foreground">(JSON-RPC)</p>
    </div>
    
    {/* Connection Line */}
    <div className="h-8 w-0.5 bg-border"></div>
    
    {/* Promptliano MCP Server */}
    <div className="border-2 border-accent rounded-lg p-4 bg-accent/10">
      <h3 className="text-center font-semibold">Promptliano</h3>
      <p className="text-center text-sm text-muted-foreground">MCP Server</p>
    </div>
    
    {/* Connection Line */}
    <div className="h-8 w-0.5 bg-border"></div>
    
    {/* Core Services */}
    <div className="w-full max-w-2xl">
      <div className="border-2 border-border rounded-lg p-4 bg-card/50">
        <h3 className="text-center font-semibold mb-4">Core Services</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="border border-border/50 rounded p-2 text-center text-sm">Project Manager</div>
          <div className="border border-border/50 rounded p-2 text-center text-sm">File System</div>
          <div className="border border-border/50 rounded p-2 text-center text-sm">Ticket System</div>
          <div className="border border-border/50 rounded p-2 text-center text-sm">Git Ops</div>
        </div>
      </div>
    </div>
  </div>
)

export function McpOverview() {
  return (
    <div className='py-16 space-y-16'>
      {/* What is MCP Section */}
      <AnimateOnScroll>
        <section className='text-center max-w-4xl mx-auto'>
          <h2 className='text-3xl md:text-4xl font-bold mb-6'>What is Model Context Protocol (MCP)?</h2>
          <p className='text-lg text-muted-foreground mb-8'>
            MCP is an open protocol that enables seamless integration between AI models and development tools. It
            provides a standardized way for AI assistants to understand and interact with your codebase, making them
            more helpful and context-aware.
          </p>
          <div className='grid md:grid-cols-3 gap-6 mt-12'>
            <GlassCard className='p-6'>
              <h3 className='text-xl font-semibold mb-3'>Standardized API</h3>
              <p className='text-muted-foreground'>Consistent interface across all AI tools and editors</p>
            </GlassCard>
            <GlassCard className='p-6'>
              <h3 className='text-xl font-semibold mb-3'>Rich Context</h3>
              <p className='text-muted-foreground'>Provides project structure, files, and metadata to AI</p>
            </GlassCard>
            <GlassCard className='p-6'>
              <h3 className='text-xl font-semibold mb-3'>Tool Agnostic</h3>
              <p className='text-muted-foreground'>Works with any MCP-compatible AI assistant</p>
            </GlassCard>
          </div>
        </section>
      </AnimateOnScroll>

      {/* Benefits Section */}
      <AnimateOnScroll>
        <section>
          <h2 className='text-3xl md:text-4xl font-bold text-center mb-12'>Why Promptliano as Your MCP Server?</h2>
          <motion.div
            className='grid md:grid-cols-2 lg:grid-cols-3 gap-6'
            variants={staggerContainer}
            initial='hidden'
            whileInView='visible'
            viewport={{ once: true }}
          >
            {benefits.map((benefit, index) => (
              <motion.div key={index} variants={staggerItem}>
                <GlassCard className='p-6 h-full hover:border-primary/50 transition-colors'>
                  <div className='flex items-start gap-4'>
                    <div className='text-primary bg-primary/10 p-3 rounded-lg'>{benefit.icon}</div>
                    <div>
                      <h3 className='text-xl font-semibold mb-2'>{benefit.title}</h3>
                      <p className='text-muted-foreground'>{benefit.description}</p>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </motion.div>
        </section>
      </AnimateOnScroll>

      {/* Architecture Section */}
      <AnimateOnScroll>
        <section>
          <h2 className='text-3xl md:text-4xl font-bold text-center mb-12'>Architecture Overview</h2>
          <GlassCard className='p-4 md:p-8 max-w-5xl mx-auto overflow-hidden'>
            <ArchitectureDiagram />
          </GlassCard>
          <div className='mt-8 grid md:grid-cols-2 gap-6 max-w-4xl mx-auto'>
            <div>
              <h3 className='text-xl font-semibold mb-3'>How It Works</h3>
              <ol className='space-y-2 text-muted-foreground'>
                <li className='flex gap-2'>
                  <span className='text-primary font-semibold'>1.</span>
                  Your editor connects to Promptliano via MCP
                </li>
                <li className='flex gap-2'>
                  <span className='text-primary font-semibold'>2.</span>
                  AI requests project context through standardized tools
                </li>
                <li className='flex gap-2'>
                  <span className='text-primary font-semibold'>3.</span>
                  Promptliano provides optimized, relevant information
                </li>
                <li className='flex gap-2'>
                  <span className='text-primary font-semibold'>4.</span>
                  AI uses context to generate better code and suggestions
                </li>
              </ol>
            </div>
            <div>
              <h3 className='text-xl font-semibold mb-3'>Key Components</h3>
              <ul className='space-y-2 text-muted-foreground'>
                <li className='flex items-start gap-2'>
                  <CheckCircle className='w-5 h-5 text-primary mt-0.5' />
                  <span>
                    <strong>MCP Server:</strong> Handles all communication
                  </span>
                </li>
                <li className='flex items-start gap-2'>
                  <CheckCircle className='w-5 h-5 text-primary mt-0.5' />
                  <span>
                    <strong>Project Manager:</strong> Tracks files and structure
                  </span>
                </li>
                <li className='flex items-start gap-2'>
                  <CheckCircle className='w-5 h-5 text-primary mt-0.5' />
                  <span>
                    <strong>Smart Search:</strong> AI-powered file suggestions
                  </span>
                </li>
                <li className='flex items-start gap-2'>
                  <CheckCircle className='w-5 h-5 text-primary mt-0.5' />
                  <span>
                    <strong>Git Integration:</strong> Version control awareness
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </section>
      </AnimateOnScroll>
    </div>
  )
}
