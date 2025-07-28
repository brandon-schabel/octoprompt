import { AnimateOnScroll, GlassCard, CodeBlock } from '@/components/ui'
import { motion } from 'framer-motion'
import { Terminal, Settings, Rocket } from 'lucide-react'

const steps = [
  {
    number: 1,
    title: 'Install Promptliano',
    description: 'Clone the repository and set up Promptliano with Bun',
    icon: Terminal,
    code: `# Clone the repository
git clone https://github.com/brandon-schabel/promptliano.git

# Install Bun globally (if not already installed)
npm install -g bun

# Navigate to the directory
cd promptliano

# Install dependencies
bun install

# Start the application
bun run start`,
    language: 'bash'
  },
  {
    number: 2,
    title: 'Configure Your Editor',
    description: 'Set up MCP integration with your AI editor',
    icon: Settings,
    code: `# Promptliano includes a quick installer!

Once Promptliano is running:
1. Navigate to http://localhost:3579
2. Click on "settings" in the project tab navigation
3. Scrll down to "Project MCP Configuration" and install the MCP server for your editor
4. Find your editor (VSCode, Cursor, Universal, etc.)
5. Click "

The installer will generate the correct configuration
based on your system and editor choice.`,
    language: 'bash'
  },
  {
    number: 3,
    title: 'Start Building',
    description: 'Access Promptliano and start using AI with full context',
    icon: Rocket,
    code: `# Promptliano is now running!

# Access the web interface:
http://localhost:1420

# The MCP server runs on port 3147 (default)

# Your AI assistant now has access to:
✓ Full project context and structure
✓ Git history and branch information  
✓ Ticket and task management
✓ Smart file suggestions
✓ Optimized token usage

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
              <a href='/docs/installation' className='text-primary hover:underline inline-flex items-center gap-1'>
                Installation Guide →
              </a>
              <a href='/docs/configuration' className='text-primary hover:underline inline-flex items-center gap-1'>
                Configuration Options →
              </a>
            </div>
          </div>
        </AnimateOnScroll>
      </div>
    </section>
  )
}
