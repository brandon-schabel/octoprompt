import { AnimateOnScroll, GlassCard, CodeBlock } from '@/components/ui'
import { motion } from 'framer-motion'
import { Terminal, Settings, Rocket } from 'lucide-react'

const steps = [
  {
    number: 1,
    title: 'Install & Start Promptliano',
    description: 'Get up and running with a single command',
    icon: Terminal,
    code: `# Run the interactive setup
npx promptliano@latest

# This command will:
# ✓ Download and install Promptliano automatically
# ✓ Start the Promptliano server
# ✓ Open the UI at http://localhost:3579

# No need to install Bun or clone repos - it's all automatic!`,
    language: 'bash'
  },
  {
    number: 2,
    title: 'Create Your First Project',
    description: 'Start organizing your codebase with Promptliano',
    icon: Settings,
    code: `# In the Promptliano UI:

1. Click "Create New Project"
2. Select your project folder
3. Give it a name

# You can also configure MCP anytime:
# - From the UI: Settings → MCP Configuration
# - From the CLI: npx promptliano config --editor cursor

# Your project is now ready for AI-enhanced development!`,
    language: 'bash'
  },
  {
    number: 3,
    title: 'Start Building',
    description: 'Use AI with full context of your codebase',
    icon: Rocket,
    code: `# Promptliano is now running at:
http://localhost:3579

# Your AI assistant has access to:
✓ Full project context and structure
✓ Git history and branch information  
✓ Ticket and task management
✓ Smart file suggestions
✓ Optimized token usage (60-70% savings)

# Example prompts to try:
"Show me the project overview"
"What tickets are open?"
"Help me implement the user authentication flow"`,
    language: 'bash'
  }
]

export function QuickStartSection() {
  return (
    <section className='relative py-24'>
      <div className='container mx-auto px-4'>
        <AnimateOnScroll>
          <div className='text-center max-w-3xl mx-auto mb-16'>
            <h2 className='text-3xl md:text-4xl font-bold mb-4'>Get Started in 3 Simple Steps</h2>
            <p className='text-lg text-muted-foreground'>
              Set up Promptliano in minutes and start building with AI-enhanced development
            </p>
          </div>
        </AnimateOnScroll>

        <div className='max-w-5xl mx-auto overflow-hidden'>
          <div className='grid gap-8 md:gap-12'>
            {steps.map((step, index) => (
              <AnimateOnScroll key={step.number} delay={index * 0.2}>
                <motion.div
                  className='relative'
                  whileInView={{ opacity: 1, y: 0 }}
                  initial={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  {/* Connection line */}
                  {index < steps.length - 1 && (
                    <div className='absolute left-10 top-24 bottom-0 w-0.5 bg-gradient-to-b from-primary/50 to-transparent hidden md:block' />
                  )}

                  <div className='grid md:grid-cols-[auto,1fr] gap-6 items-start'>
                    {/* Step number and icon */}
                    <div className='flex items-center gap-4'>
                      <motion.div
                        whileHover={{ scale: 1.1, rotate: 360 }}
                        transition={{ duration: 0.5 }}
                        className='relative'
                      >
                        <div className='w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center'>
                          <step.icon className='h-8 w-8 text-primary' />
                        </div>
                        <div className='absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold'>
                          {step.number}
                        </div>
                      </motion.div>
                    </div>

                    {/* Content */}
                    <div className='space-y-4'>
                      <div>
                        <h3 className='text-xl font-semibold mb-2'>{step.title}</h3>
                        <p className='text-muted-foreground'>{step.description}</p>
                      </div>

                      <CodeBlock
                        code={step.code}
                        language={step.language}
                        showLineNumbers={false}
                        className='shadow-lg'
                      />
                    </div>
                  </div>
                </motion.div>
              </AnimateOnScroll>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <AnimateOnScroll>
          <div className='mt-16 text-center'>
            <p className='text-muted-foreground mb-4'>Need help? Check out our detailed documentation</p>
            <div className='flex justify-center gap-4'>
              <a href='/docs/getting-started' className='text-primary hover:underline inline-flex items-center gap-1'>
                Getting Started Guide →
              </a>
              <a href='/docs/download-installation' className='text-primary hover:underline inline-flex items-center gap-1'>
                Manual Installation →
              </a>
            </div>
          </div>
        </AnimateOnScroll>
      </div>
    </section>
  )
}
