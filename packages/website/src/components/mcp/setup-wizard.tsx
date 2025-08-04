import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GlassCard, CodeBlock, AnimateOnScroll, CTAButton } from '@/components/ui'
import { HeroButton } from '@/components/ui/hero-button'
import { ChevronRight, Check, Copy, Terminal, FileJson, Rocket, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type OS = 'macos' | 'windows' | 'linux'
type Editor = 'vscode' | 'cursor' | 'claude-desktop' | 'claude-code'

interface SetupStep {
  id: string
  title: string
  description: string
  command?: string
  code?: string
  language?: string
  filename?: string
  note?: string
}

const osSteps: Record<OS, SetupStep[]> = {
  macos: [
    {
      id: 'install',
      title: 'Install Promptliano',
      description: 'Install Promptliano globally via npm',
      command: 'npm install -g promptliano'
    },
    {
      id: 'init',
      title: 'Initialize Promptliano',
      description: 'Set up Promptliano in your home directory',
      command: 'promptliano init'
    },
    {
      id: 'start',
      title: 'Start the MCP Server',
      description: 'Launch Promptliano as an MCP server',
      command: 'promptliano start --mcp'
    }
  ],
  windows: [
    {
      id: 'install',
      title: 'Install Promptliano',
      description: 'Install Promptliano globally via npm',
      command: 'npm install -g promptliano',
      note: 'Run in Administrator mode if you encounter permission issues'
    },
    {
      id: 'init',
      title: 'Initialize Promptliano',
      description: 'Set up Promptliano in your home directory',
      command: 'promptliano init'
    },
    {
      id: 'start',
      title: 'Start the MCP Server',
      description: 'Launch Promptliano as an MCP server',
      command: 'promptliano start --mcp'
    }
  ],
  linux: [
    {
      id: 'install',
      title: 'Install Promptliano',
      description: 'Install Promptliano globally via npm',
      command: 'sudo npm install -g promptliano'
    },
    {
      id: 'init',
      title: 'Initialize Promptliano',
      description: 'Set up Promptliano in your home directory',
      command: 'promptliano init'
    },
    {
      id: 'start',
      title: 'Start the MCP Server',
      description: 'Launch Promptliano as an MCP server',
      command: 'promptliano start --mcp'
    }
  ]
}

const editorConfigs: Record<Editor, SetupStep[]> = {
  vscode: [
    {
      id: 'extension',
      title: 'Install MCP Extension',
      description: 'Install the official MCP extension from the VS Code marketplace',
      command: 'code --install-extension anthropic.mcp-client'
    },
    {
      id: 'config',
      title: 'Configure MCP Settings',
      description: 'Add Promptliano to your VS Code settings',
      code: JSON.stringify(
        {
          'mcp.servers': {
            promptliano: {
              command: 'promptliano',
              args: ['start', '--mcp'],
              cwd: '~'
            }
          }
        },
        null,
        2
      ),
      language: 'json',
      filename: 'settings.json'
    }
  ],
  cursor: [
    {
      id: 'config',
      title: 'Configure Cursor Settings',
      description: 'Add Promptliano to your Cursor configuration',
      code: JSON.stringify(
        {
          mcp: {
            servers: {
              promptliano: {
                command: 'promptliano',
                args: ['start', '--mcp']
              }
            }
          }
        },
        null,
        2
      ),
      language: 'json',
      filename: '~/.cursor/config.json'
    }
  ],
  'claude-desktop': [
    {
      id: 'config',
      title: 'Configure Claude Desktop',
      description: 'Add Promptliano to your Claude Desktop MCP settings',
      code: JSON.stringify(
        {
          mcpServers: {
            promptliano: {
              command: 'promptliano',
              args: ['start', '--mcp'],
              env: {
                NODE_ENV: 'production'
              }
            }
          }
        },
        null,
        2
      ),
      language: 'json',
      filename: '~/Library/Application Support/Claude/mcp.json',
      note: 'On Windows: %APPDATA%\\Claude\\mcp.json'
    }
  ],
  'claude-code': [
    {
      id: 'config',
      title: 'Configure Claude Code',
      description: 'Claude Code automatically detects MCP servers',
      code: JSON.stringify(
        {
          mcpServers: {
            promptliano: {
              command: 'promptliano',
              args: ['start', '--mcp']
            }
          }
        },
        null,
        2
      ),
      language: 'json',
      filename: '~/.claude-code/mcp.json'
    }
  ]
}

export function SetupWizard() {
  const [selectedOS, setSelectedOS] = useState<OS>('macos')
  const [selectedEditor, setSelectedEditor] = useState<Editor>('vscode')
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<string[]>([])
  const [copiedCommands, setCopiedCommands] = useState<string[]>([])

  const allSteps = [...osSteps[selectedOS], ...editorConfigs[selectedEditor]]

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedCommands([...copiedCommands, id])
    setTimeout(() => {
      setCopiedCommands((prev) => prev.filter((cmd) => cmd !== id))
    }, 2000)
  }

  const markStepComplete = (stepId: string) => {
    if (!completedSteps.includes(stepId)) {
      setCompletedSteps([...completedSteps, stepId])
    }
    if (currentStep < allSteps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const isStepComplete = (stepId: string) => completedSteps.includes(stepId)

  return (
    <div className='space-y-8'>
      {/* OS Selection */}
      <div>
        <h3 className='text-xl font-semibold mb-4'>Select Your Operating System</h3>
        <div className='grid grid-cols-3 gap-4'>
          {(['macos', 'windows', 'linux'] as OS[]).map((os) => (
            <button
              key={os}
              onClick={() => {
                setSelectedOS(os)
                setCurrentStep(0)
                setCompletedSteps([])
              }}
              className={cn(
                'p-4 rounded-lg border-2 transition-all capitalize',
                selectedOS === os ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
              )}
            >
              {os === 'macos' ? 'macOS' : os}
            </button>
          ))}
        </div>
      </div>

      {/* Editor Selection */}
      <div>
        <h3 className='text-xl font-semibold mb-4'>Select Your Editor</h3>
        <div className='grid md:grid-cols-2 gap-4'>
          {Object.entries({
            vscode: 'VS Code',
            cursor: 'Cursor',
            'claude-desktop': 'Claude Desktop',
            'claude-code': 'Claude Code'
          }).map(([key, name]) => (
            <button
              key={key}
              onClick={() => {
                setSelectedEditor(key as Editor)
                setCurrentStep(0)
                setCompletedSteps([])
              }}
              className={cn(
                'p-4 rounded-lg border-2 transition-all',
                selectedEditor === key ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
              )}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {/* Progress Bar */}
      <div className='relative'>
        <div className='flex justify-between mb-2'>
          <span className='text-sm text-muted-foreground'>
            Step {currentStep + 1} of {allSteps.length}
          </span>
          <span className='text-sm text-muted-foreground'>
            {Math.round((completedSteps.length / allSteps.length) * 100)}% Complete
          </span>
        </div>
        <div className='h-2 bg-border rounded-full overflow-hidden'>
          <motion.div
            className='h-full bg-primary'
            animate={{ width: `${(completedSteps.length / allSteps.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className='space-y-4'>
        <AnimatePresence mode='wait'>
          {allSteps.map((step, index) => {
            const isActive = index === currentStep
            const isComplete = isStepComplete(step.id)
            const isPast = index < currentStep

            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{
                  opacity: isActive || isComplete || isPast ? 1 : 0.5,
                  y: 0
                }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <GlassCard
                  className={cn(
                    'p-6 transition-all',
                    isActive && 'border-primary',
                    isComplete && 'border-green-500/50'
                  )}
                >
                  <div className='flex items-start gap-4'>
                    <div
                      className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold',
                        isComplete
                          ? 'bg-green-500 text-white'
                          : isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-border'
                      )}
                    >
                      {isComplete ? <Check className='w-4 h-4' /> : index + 1}
                    </div>
                    <div className='flex-1'>
                      <h4 className='text-lg font-semibold mb-2'>{step.title}</h4>
                      <p className='text-muted-foreground mb-4'>{step.description}</p>

                      {step.command && (
                        <div className='relative group'>
                          <div className='absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/10 rounded-lg blur-xl opacity-0 group-hover:opacity-100 transition-opacity' />
                          <div className='relative bg-black/50 backdrop-blur rounded-lg p-4 font-mono text-sm'>
                            <div className='flex items-center gap-2 mb-2'>
                              <Terminal className='w-4 h-4 text-primary' />
                              <span className='text-xs text-muted-foreground'>Terminal</span>
                            </div>
                            <code className='text-green-400'>{step.command}</code>
                            <button
                              onClick={() => handleCopy(step.command!, step.id)}
                              className='absolute top-4 right-4 p-2 rounded hover:bg-white/10 transition-colors'
                            >
                              {copiedCommands.includes(step.id) ? (
                                <Check className='w-4 h-4 text-green-500' />
                              ) : (
                                <Copy className='w-4 h-4' />
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {step.code && (
                        <div className='relative group'>
                          <div className='absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/10 rounded-lg blur-xl opacity-0 group-hover:opacity-100 transition-opacity' />
                          <CodeBlock code={step.code} language={step.language || 'json'} filename={step.filename} />
                          <button
                            onClick={() => handleCopy(step.code!, step.id)}
                            className='absolute top-4 right-4 p-2 rounded hover:bg-white/10 transition-colors'
                          >
                            {copiedCommands.includes(step.id) ? (
                              <Check className='w-4 h-4 text-green-500' />
                            ) : (
                              <Copy className='w-4 h-4' />
                            )}
                          </button>
                        </div>
                      )}

                      {step.note && (
                        <div className='mt-4 flex items-start gap-2 text-sm text-yellow-500'>
                          <AlertCircle className='w-4 h-4 mt-0.5' />
                          <span>{step.note}</span>
                        </div>
                      )}

                      {isActive && (
                        <div className='mt-4 flex gap-2'>
                          <HeroButton onClick={() => markStepComplete(step.id)} size='md'>
                            Mark Complete
                            <ChevronRight className='w-4 h-4 ml-1' />
                          </HeroButton>
                        </div>
                      )}
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* Completion Message */}
      {completedSteps.length === allSteps.length && (
        <AnimateOnScroll>
          <GlassCard className='p-8 text-center border-green-500/50'>
            <Rocket className='w-12 h-12 text-green-500 mx-auto mb-4' />
            <h3 className='text-2xl font-bold mb-2'>Setup Complete!</h3>
            <p className='text-muted-foreground mb-4'>
              Promptliano is now integrated with your development environment
            </p>
            <CTAButton onClick={() => window.location.reload()}>Start Using Promptliano</CTAButton>
          </GlassCard>
        </AnimateOnScroll>
      )}
    </div>
  )
}
