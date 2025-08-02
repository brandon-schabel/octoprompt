import { GlassCard } from '@/components/ui/glass-card'
import { motion } from 'framer-motion'
import {
  Database,
  Lock,
  Cloud,
  Shield,
  HardDrive,
  Zap,
  Code2,
  Brain,
  CheckCircle,
  Server,
  FileKey,
  GitBranch,
  Github
} from 'lucide-react'

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
}

export function LocalFirstContent() {
  return (
    <div className='py-20 px-4 md:px-6 lg:px-8'>
      {/* Hero Section */}
      <motion.div
        className='mx-auto max-w-6xl text-center mb-20'
        initial='hidden'
        animate='visible'
        variants={fadeIn}
        transition={{ duration: 0.6 }}
      >
        <h1 className='text-5xl md:text-6xl font-bold mb-6'>Your Code. Your Machine. Your Control.</h1>
        <p className='text-xl text-muted-foreground max-w-3xl mx-auto'>
          Promptliano runs entirely on your computer. No cloud dependencies, no data collection, no external servers.
          Just powerful development tools that respect your privacy.
        </p>
      </motion.div>

      {/* Core Principles */}
      <div className='mx-auto max-w-6xl mb-20'>
        <motion.h2
          className='text-3xl font-bold text-center mb-12'
          initial='hidden'
          animate='visible'
          variants={fadeIn}
          transition={{ delay: 0.2 }}
        >
          Built on Privacy-First Principles
        </motion.h2>

        <div className='grid md:grid-cols-3 gap-8'>
          <motion.div initial='hidden' animate='visible' variants={fadeIn} transition={{ delay: 0.3 }}>
            <GlassCard className='p-6 h-full'>
              <HardDrive className='h-12 w-12 text-primary mb-4' />
              <h3 className='text-xl font-semibold mb-3'>100% Local Storage</h3>
              <p className='text-muted-foreground'>
                All your project data, tickets, and configurations are stored in a local SQLite database on your
                machine. No cloud sync required.
              </p>
            </GlassCard>
          </motion.div>

          <motion.div initial='hidden' animate='visible' variants={fadeIn} transition={{ delay: 0.4 }}>
            <GlassCard className='p-6 h-full'>
              <Lock className='h-12 w-12 text-primary mb-4' />
              <h3 className='text-xl font-semibold mb-3'>End-to-End Encryption</h3>
              <p className='text-muted-foreground'>
                Your API keys and sensitive data are encrypted using industry-standard encryption before being stored
                locally.
              </p>
            </GlassCard>
          </motion.div>

          <motion.div initial='hidden' animate='visible' variants={fadeIn} transition={{ delay: 0.5 }}>
            <GlassCard className='p-6 h-full'>
              <Shield className='h-12 w-12 text-primary mb-4' />
              <h3 className='text-xl font-semibold mb-3'>Zero Tracking</h3>
              <p className='text-muted-foreground'>
                No analytics, no telemetry, no usage tracking. What you do with Promptliano stays on your machine.
              </p>
            </GlassCard>
          </motion.div>
        </div>
      </div>

      {/* Free and Open Source */}
      <div className='mx-auto max-w-6xl mb-20'>
        <motion.h2
          className='text-3xl font-bold text-center mb-12'
          initial='hidden'
          animate='visible'
          variants={fadeIn}
          transition={{ delay: 0.6 }}
        >
          Forever Free and Open Source
        </motion.h2>

        <motion.div initial='hidden' animate='visible' variants={fadeIn} transition={{ delay: 0.7 }}>
          <GlassCard className='p-8 bg-green-500/5 border-green-500/20'>
            <div className='text-center mb-8'>
              <div className='inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/10 mb-6'>
                <Code2 className='h-10 w-10 text-green-500' />
              </div>
              <h3 className='text-2xl font-bold mb-4'>MIT Licensed</h3>
              <p className='text-lg text-muted-foreground max-w-3xl mx-auto'>
                Promptliano is and will always be free and open source software. We believe in transparency, community
                collaboration, and user freedom.
              </p>
            </div>

            <div className='grid md:grid-cols-3 gap-6 mt-8'>
              <div className='text-center'>
                <div className='inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/10 mb-3'>
                  <CheckCircle className='h-6 w-6 text-green-500' />
                </div>
                <h4 className='font-semibold mb-2'>Free Forever</h4>
                <p className='text-sm text-muted-foreground'>
                  No premium tiers, no paywalls, no subscription fees. Every feature is available to everyone.
                </p>
              </div>

              <div className='text-center'>
                <div className='inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/10 mb-3'>
                  <GitBranch className='h-6 w-6 text-green-500' />
                </div>
                <h4 className='font-semibold mb-2'>Community Driven</h4>
                <p className='text-sm text-muted-foreground'>
                  Built by developers, for developers. Contributions, feedback, and ideas from the community shape our
                  roadmap.
                </p>
              </div>

              <div className='text-center'>
                <div className='inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/10 mb-3'>
                  <Shield className='h-6 w-6 text-green-500' />
                </div>
                <h4 className='font-semibold mb-2'>No Vendor Lock-in</h4>
                <p className='text-sm text-muted-foreground'>
                  Fork it, modify it, self-host it. Your tools should work for you, not the other way around.
                </p>
              </div>
            </div>

            <div className='mt-8 p-6 bg-background/50 rounded-lg'>
              <h4 className='font-semibold mb-3'>Our Commitment</h4>
              <ul className='space-y-2 text-muted-foreground'>
                <li className='flex items-start gap-2'>
                  <CheckCircle className='h-5 w-5 text-green-500 flex-shrink-0 mt-0.5' />
                  <span>The core application will always remain open source under the MIT license</span>
                </li>
                <li className='flex items-start gap-2'>
                  <CheckCircle className='h-5 w-5 text-green-500 flex-shrink-0 mt-0.5' />
                  <span>All features available in the repository are free to use</span>
                </li>
                <li className='flex items-start gap-2'>
                  <CheckCircle className='h-5 w-5 text-green-500 flex-shrink-0 mt-0.5' />
                  <span>No artificial limitations or feature gates</span>
                </li>
                <li className='flex items-start gap-2'>
                  <CheckCircle className='h-5 w-5 text-green-500 flex-shrink-0 mt-0.5' />
                  <span>Transparent development process on GitHub</span>
                </li>
              </ul>
            </div>

            <div className='mt-6 text-center'>
              <a
                href='https://github.com/brandon-schabel/promptliano'
                target='_blank'
                rel='noopener noreferrer'
                className='inline-flex items-center gap-2 text-primary hover:underline'
              >
                <Github className='h-5 w-5' />
                View on GitHub
              </a>
            </div>
          </GlassCard>
        </motion.div>
      </div>

      {/* How It Works */}
      <div className='mx-auto max-w-6xl mb-20'>
        <motion.h2
          className='text-3xl font-bold text-center mb-12'
          initial='hidden'
          animate='visible'
          variants={fadeIn}
          transition={{ delay: 0.8 }}
        >
          How Local-First Works
        </motion.h2>

        <div className='space-y-8'>
          <motion.div initial='hidden' animate='visible' variants={fadeIn} transition={{ delay: 0.7 }}>
            <GlassCard className='p-8'>
              <div className='flex items-start gap-4'>
                <Database className='h-8 w-8 text-primary flex-shrink-0 mt-1' />
                <div>
                  <h3 className='text-2xl font-semibold mb-3'>Local Database Creation</h3>
                  <p className='text-muted-foreground mb-4'>
                    When you first launch Promptliano, it automatically creates a SQLite database in your application
                    data directory. This database stores:
                  </p>
                  <ul className='space-y-2 text-muted-foreground'>
                    <li className='flex items-center gap-2'>
                      <CheckCircle className='h-5 w-5 text-green-500 flex-shrink-0' />
                      Project configurations and metadata
                    </li>
                    <li className='flex items-center gap-2'>
                      <CheckCircle className='h-5 w-5 text-green-500 flex-shrink-0' />
                      Tickets, tasks, and their relationships
                    </li>
                    <li className='flex items-center gap-2'>
                      <CheckCircle className='h-5 w-5 text-green-500 flex-shrink-0' />
                      File summaries and search indices
                    </li>
                    <li className='flex items-center gap-2'>
                      <CheckCircle className='h-5 w-5 text-green-500 flex-shrink-0' />
                      Custom prompts and agent configurations
                    </li>
                  </ul>
                </div>
              </div>
            </GlassCard>
          </motion.div>

          <motion.div initial='hidden' animate='visible' variants={fadeIn} transition={{ delay: 0.8 }}>
            <GlassCard className='p-8'>
              <div className='flex items-start gap-4'>
                <FileKey className='h-8 w-8 text-primary flex-shrink-0 mt-1' />
                <div>
                  <h3 className='text-2xl font-semibold mb-3'>Secure Key Management</h3>
                  <p className='text-muted-foreground mb-4'>
                    API keys for AI providers are encrypted before storage using:
                  </p>
                  <ul className='space-y-2 text-muted-foreground'>
                    <li className='flex items-center gap-2'>
                      <CheckCircle className='h-5 w-5 text-green-500 flex-shrink-0' />
                      AES-256 encryption for key storage
                    </li>
                    <li className='flex items-center gap-2'>
                      <CheckCircle className='h-5 w-5 text-green-500 flex-shrink-0' />
                      Unique encryption keys per installation
                    </li>
                    <li className='flex items-center gap-2'>
                      <CheckCircle className='h-5 w-5 text-green-500 flex-shrink-0' />
                      Keys never leave your machine
                    </li>
                    <li className='flex items-center gap-2'>
                      <CheckCircle className='h-5 w-5 text-green-500 flex-shrink-0' />
                      Support for environment variable overrides
                    </li>
                  </ul>
                </div>
              </div>
            </GlassCard>
          </motion.div>

          <motion.div initial='hidden' animate='visible' variants={fadeIn} transition={{ delay: 0.9 }}>
            <GlassCard className='p-8'>
              <div className='flex items-start gap-4'>
                <GitBranch className='h-8 w-8 text-primary flex-shrink-0 mt-1' />
                <div>
                  <h3 className='text-2xl font-semibold mb-3'>Git Integration</h3>
                  <p className='text-muted-foreground mb-4'>Direct integration with your local Git repositories:</p>
                  <ul className='space-y-2 text-muted-foreground'>
                    <li className='flex items-center gap-2'>
                      <CheckCircle className='h-5 w-5 text-green-500 flex-shrink-0' />
                      Works with existing local repositories
                    </li>
                    <li className='flex items-center gap-2'>
                      <CheckCircle className='h-5 w-5 text-green-500 flex-shrink-0' />
                      No need for cloud Git providers
                    </li>
                    <li className='flex items-center gap-2'>
                      <CheckCircle className='h-5 w-5 text-green-500 flex-shrink-0' />
                      Supports Git worktrees for parallel development
                    </li>
                    <li className='flex items-center gap-2'>
                      <CheckCircle className='h-5 w-5 text-green-500 flex-shrink-0' />
                      All Git operations run locally
                    </li>
                  </ul>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        </div>
      </div>

      {/* Works Without AI */}
      <div className='mx-auto max-w-6xl mb-20'>
        <motion.h2
          className='text-3xl font-bold text-center mb-12'
          initial='hidden'
          animate='visible'
          variants={fadeIn}
          transition={{ delay: 1.0 }}
        >
          Powerful Without AI, Enhanced With AI
        </motion.h2>

        <div className='grid md:grid-cols-2 gap-8'>
          <motion.div initial='hidden' animate='visible' variants={fadeIn} transition={{ delay: 1.1 }}>
            <GlassCard className='p-8 h-full'>
              <Code2 className='h-12 w-12 text-primary mb-4' />
              <h3 className='text-2xl font-semibold mb-4'>Core Features (No AI Required)</h3>
              <ul className='space-y-3 text-muted-foreground'>
                <li className='flex items-start gap-2'>
                  <Zap className='h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5' />
                  <span>Project and file management with instant search</span>
                </li>
                <li className='flex items-start gap-2'>
                  <Zap className='h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5' />
                  <span>Ticket and task tracking system</span>
                </li>
                <li className='flex items-start gap-2'>
                  <Zap className='h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5' />
                  <span>Git integration and worktree management</span>
                </li>
                <li className='flex items-start gap-2'>
                  <Zap className='h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5' />
                  <span>Code navigation and file relationships</span>
                </li>
                <li className='flex items-start gap-2'>
                  <Zap className='h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5' />
                  <span>Custom prompt and documentation storage</span>
                </li>
              </ul>
            </GlassCard>
          </motion.div>

          <motion.div initial='hidden' animate='visible' variants={fadeIn} transition={{ delay: 1.2 }}>
            <GlassCard className='p-8 h-full'>
              <Brain className='h-12 w-12 text-primary mb-4' />
              <h3 className='text-2xl font-semibold mb-4'>AI Enhancements (Optional)</h3>
              <ul className='space-y-3 text-muted-foreground'>
                <li className='flex items-start gap-2'>
                  <Zap className='h-5 w-5 text-purple-500 flex-shrink-0 mt-0.5' />
                  <span>Intelligent file suggestions based on context</span>
                </li>
                <li className='flex items-start gap-2'>
                  <Zap className='h-5 w-5 text-purple-500 flex-shrink-0 mt-0.5' />
                  <span>Automated task generation from tickets</span>
                </li>
                <li className='flex items-start gap-2'>
                  <Zap className='h-5 w-5 text-purple-500 flex-shrink-0 mt-0.5' />
                  <span>Code summaries and documentation generation</span>
                </li>
                <li className='flex items-start gap-2'>
                  <Zap className='h-5 w-5 text-purple-500 flex-shrink-0 mt-0.5' />
                  <span>Smart project overviews and insights</span>
                </li>
                <li className='flex items-start gap-2'>
                  <Zap className='h-5 w-5 text-purple-500 flex-shrink-0 mt-0.5' />
                  <span>Context-aware development assistance</span>
                </li>
              </ul>
            </GlassCard>
          </motion.div>
        </div>
      </div>

      {/* Local AI Support */}
      <div className='mx-auto max-w-6xl mb-20'>
        <motion.h2
          className='text-3xl font-bold text-center mb-12'
          initial='hidden'
          animate='visible'
          variants={fadeIn}
          transition={{ delay: 1.3 }}
        >
          Support for Local AI Providers
        </motion.h2>

        <motion.div initial='hidden' animate='visible' variants={fadeIn} transition={{ delay: 1.4 }}>
          <GlassCard className='p-8'>
            <div className='flex items-start gap-4'>
              <Server className='h-8 w-8 text-primary flex-shrink-0 mt-1' />
              <div>
                <h3 className='text-2xl font-semibold mb-4'>Run AI Models Locally</h3>
                <p className='text-muted-foreground mb-6'>
                  For complete privacy, Promptliano supports local AI providers. Your code never leaves your machine,
                  even when using AI features:
                </p>

                <div className='grid md:grid-cols-2 gap-6'>
                  <div>
                    <h4 className='font-semibold mb-3 flex items-center gap-2'>
                      <Cloud className='h-5 w-5' />
                      Ollama Integration
                    </h4>
                    <ul className='space-y-2 text-muted-foreground text-sm'>
                      <li>• Run open-source models locally</li>
                      <li>• Support for Code Llama, Mistral, and more</li>
                      <li>• No internet connection required</li>
                      <li>• Full control over model selection</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className='font-semibold mb-3 flex items-center gap-2'>
                      <Cloud className='h-5 w-5' />
                      LM Studio Support
                    </h4>
                    <ul className='space-y-2 text-muted-foreground text-sm'>
                      <li>• GUI for local model management</li>
                      <li>• Compatible with any GGUF model</li>
                      <li>• Easy model switching</li>
                      <li>• Resource usage control</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      </div>

      {/* CTA Section */}
      <motion.div
        className='mx-auto max-w-4xl text-center'
        initial='hidden'
        animate='visible'
        variants={fadeIn}
        transition={{ delay: 1.5 }}
      >
        <GlassCard className='p-12'>
          <h2 className='text-3xl font-bold mb-4'>Take Control of Your Development Environment</h2>
          <p className='text-xl text-muted-foreground mb-8'>
            Experience the power of local-first development. No cloud lock-in, no privacy concerns, just pure
            productivity.
          </p>
          <div className='flex gap-4 justify-center'>
            <a
              href='/docs/getting-started'
              className='inline-flex items-center px-6 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium'
            >
              Get Started Locally
            </a>
            <a
              href='/docs/guides'
              className='inline-flex items-center px-6 py-3 rounded-lg border border-border hover:bg-accent transition-colors font-medium'
            >
              Learn More
            </a>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  )
}
