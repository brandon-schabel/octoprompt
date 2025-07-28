import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GlassCard, CodeBlock, AnimateOnScroll } from '@/components/ui'
import { ChevronDown, AlertCircle, CheckCircle, XCircle, Terminal, Search, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TroubleshootingItem {
  id: string
  question: string
  answer: string
  category: 'installation' | 'configuration' | 'connection' | 'performance' | 'general'
  debugCommands?: string[]
  solution?: {
    steps: string[]
    code?: string
  }
}

const troubleshootingItems: TroubleshootingItem[] = [
  {
    id: 'install-permission',
    question: 'Getting permission errors during installation?',
    answer: 'This usually happens when npm tries to install global packages without proper permissions.',
    category: 'installation',
    solution: {
      steps: ['Use npm with proper permissions', 'Or configure npm to use a different directory'],
      code: `# Option 1: Use sudo (not recommended)
sudo npm install -g promptliano

# Option 2: Fix npm permissions (recommended)
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
npm install -g promptliano`
    }
  },
  {
    id: 'mcp-not-found',
    question: 'MCP server not found or not starting?',
    answer: 'The MCP server might not be in your PATH or there could be a configuration issue.',
    category: 'connection',
    debugCommands: ['which promptliano', 'promptliano --version', 'promptliano doctor'],
    solution: {
      steps: [
        'Verify Promptliano is installed correctly',
        'Check if the command is in your PATH',
        'Run the doctor command to diagnose issues'
      ]
    }
  },
  {
    id: 'editor-connection',
    question: 'Editor not connecting to Promptliano MCP server?',
    answer: 'This can happen due to incorrect configuration or the server not running.',
    category: 'connection',
    debugCommands: ['promptliano status', 'ps aux | grep promptliano', 'lsof -i :3333'],
    solution: {
      steps: [
        'Ensure the MCP server is running',
        'Check the port is not in use',
        'Verify your editor configuration matches the server settings',
        'Restart both the editor and the MCP server'
      ]
    }
  },
  {
    id: 'slow-suggestions',
    question: 'File suggestions are slow or timing out?',
    answer: 'Large projects can cause performance issues. Use the optimized strategies.',
    category: 'performance',
    solution: {
      steps: [
        'Use the "fast" strategy for large projects',
        'Limit the number of results',
        'Ensure file summaries are up to date'
      ],
      code: `// In your MCP request, use:
{
  "action": "suggest_files",
  "ticketId": 456,
  "data": {
    "strategy": "fast",
    "maxResults": 10
  }
}`
    }
  },
  {
    id: 'config-location',
    question: 'Where should I place the MCP configuration file?',
    answer: 'The location depends on your editor and operating system.',
    category: 'configuration',
    solution: {
      steps: [
        'VS Code: Add to settings.json',
        'Cursor: ~/.cursor/config.json',
        'Claude Desktop (Mac): ~/Library/Application Support/Claude/mcp.json',
        'Claude Desktop (Windows): %APPDATA%\\Claude\\mcp.json',
        'Claude Code: ~/.claude-code/mcp.json'
      ]
    }
  },
  {
    id: 'env-vars',
    question: 'Environment variables not working?',
    answer: 'Make sure environment variables are properly set in your MCP configuration.',
    category: 'configuration',
    solution: {
      steps: [
        'Add env variables to your MCP config',
        'Ensure quotes are properly escaped',
        'Restart the MCP server after changes'
      ],
      code: `{
  "mcpServers": {
    "promptliano": {
      "command": "promptliano",
      "args": ["start", "--mcp"],
      "env": {
        "NODE_ENV": "production",
        "DEBUG": "promptliano:*"
      }
    }
  }
}`
    }
  },
  {
    id: 'version-mismatch',
    question: 'Getting version compatibility errors?',
    answer: "Ensure your Promptliano version is compatible with your editor's MCP implementation.",
    category: 'general',
    debugCommands: ['promptliano --version', 'npm list -g promptliano'],
    solution: {
      steps: [
        'Check the compatibility matrix below',
        'Update Promptliano to the latest version',
        'Update your editor or MCP extension'
      ],
      code: 'npm update -g promptliano'
    }
  },
  {
    id: 'logs-location',
    question: 'Where can I find debug logs?',
    answer: 'Promptliano stores logs in your home directory for debugging.',
    category: 'general',
    debugCommands: ['tail -f ~/.promptliano/logs/mcp.log', 'promptliano logs --tail 50'],
    solution: {
      steps: [
        'Check ~/.promptliano/logs/ directory',
        'Use the built-in log viewer',
        'Enable debug mode for more verbose logging'
      ]
    }
  }
]

const categories = [
  { id: 'all', name: 'All Issues', icon: '🔍' },
  { id: 'installation', name: 'Installation', icon: '📦' },
  { id: 'configuration', name: 'Configuration', icon: '⚙️' },
  { id: 'connection', name: 'Connection', icon: '🔌' },
  { id: 'performance', name: 'Performance', icon: '⚡' },
  { id: 'general', name: 'General', icon: '❓' }
]

const debugCommands = [
  {
    command: 'promptliano doctor',
    description: 'Run a comprehensive diagnostic check'
  },
  {
    command: 'promptliano status',
    description: 'Check if the MCP server is running'
  },
  {
    command: 'promptliano logs --tail 50',
    description: 'View the last 50 log entries'
  },
  {
    command: 'promptliano config --check',
    description: 'Validate your configuration'
  },
  {
    command: 'promptliano restart',
    description: 'Restart the MCP server'
  },
  {
    command: 'promptliano --version',
    description: 'Check installed version'
  }
]

export function Troubleshooting() {
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [expandedItems, setExpandedItems] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedCommands, setCopiedCommands] = useState<string[]>([])

  const filteredItems = troubleshootingItems.filter((item) => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory
    const matchesSearch =
      searchQuery === '' ||
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const toggleExpanded = (id: string) => {
    setExpandedItems((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
  }

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedCommands([...copiedCommands, id])
    setTimeout(() => {
      setCopiedCommands((prev) => prev.filter((cmd) => cmd !== id))
    }, 2000)
  }

  return (
    <div className='space-y-8'>
      {/* Header */}
      {/* <div className='text-center'>
        <h2 className='text-3xl font-bold mb-4'>Troubleshooting Guide</h2>
        <p className='text-muted-foreground max-w-2xl mx-auto'>
          Find solutions to common issues and learn how to debug problems with Promptliano MCP integration
        </p>
      </div>

      Quick Debug Commands */}
      {/* <AnimateOnScroll>
        <GlassCard className='p-6'>
          <h3 className='text-xl font-semibold mb-4 flex items-center gap-2'>
            <Terminal className='w-5 h-5' />
            Quick Debug Commands
          </h3>
          <div className='grid md:grid-cols-2 gap-4'>
            {debugCommands.map((cmd, index) => (
              <div key={index} className='flex items-start gap-3'>
                <div className='bg-primary/10 p-2 rounded'>
                  <Terminal className='w-4 h-4 text-primary' />
                </div>
                <div className='flex-1'>
                  <div className='flex items-center gap-2'>
                    <code className='text-sm font-mono text-primary'>{cmd.command}</code>
                    <button
                      onClick={() => handleCopy(cmd.command, `debug-${index}`)}
                      className='p-1 rounded hover:bg-primary/10 transition-colors'
                    >
                      {copiedCommands.includes(`debug-${index}`) ? (
                        <Check className='w-3 h-3 text-green-500' />
                      ) : (
                        <Copy className='w-3 h-3' />
                      )}
                    </button>
                  </div>
                  <p className='text-sm text-muted-foreground mt-1'>{cmd.description}</p>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </AnimateOnScroll> */}

      {/* Search and Filter */}
      {/* <div className='flex flex-col md:flex-row gap-4'>
        <div className='relative flex-1'>
          <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground' />
          <input
            type='text'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder='Search issues...'
            className='w-full pl-10 pr-4 py-3 bg-background border border-border rounded-lg focus:border-primary focus:outline-none'
          />
        </div>
        <div className='flex gap-2 flex-wrap'>
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={cn(
                'px-4 py-2 rounded-lg border transition-all flex items-center gap-2',
                selectedCategory === category.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-primary/50'
              )}
            >
              <span>{category.icon}</span>
              <span>{category.name}</span>
            </button>
          ))}
        </div>
      </div> */}

      {/* FAQ Items */}
      {/* <div className='space-y-4'>
        <AnimatePresence>
          {filteredItems.map((item) => {
            const isExpanded = expandedItems.includes(item.id)

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <GlassCard className='overflow-hidden'>
                  <button
                    onClick={() => toggleExpanded(item.id)}
                    className='w-full p-6 text-left flex items-start gap-4 hover:bg-primary/5 transition-colors'
                  >
                    <div
                      className={cn(
                        'p-2 rounded-lg',
                        item.category === 'installation' && 'bg-blue-500/10 text-blue-500',
                        item.category === 'configuration' && 'bg-purple-500/10 text-purple-500',
                        item.category === 'connection' && 'bg-orange-500/10 text-orange-500',
                        item.category === 'performance' && 'bg-yellow-500/10 text-yellow-500',
                        item.category === 'general' && 'bg-gray-500/10 text-gray-500'
                      )}
                    >
                      <AlertCircle className='w-5 h-5' />
                    </div>
                    <div className='flex-1'>
                      <h4 className='text-lg font-semibold mb-1'>{item.question}</h4>
                      <p className='text-sm text-muted-foreground'>{item.answer}</p>
                    </div>
                    <ChevronDown className={cn('w-5 h-5 transition-transform', isExpanded && 'rotate-180')} />
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className='border-t border-border'
                      >
                        <div className='p-6 space-y-4'>
                          {item.solution && (
                            <div>
                              <h5 className='font-semibold mb-2 flex items-center gap-2'>
                                <CheckCircle className='w-4 h-4 text-green-500' />
                                Solution
                              </h5>
                              <ol className='space-y-2'>
                                {item.solution.steps.map((step, index) => (
                                  <li key={index} className='flex gap-2 text-sm'>
                                    <span className='text-primary font-semibold'>{index + 1}.</span>
                                    <span>{step}</span>
                                  </li>
                                ))}
                              </ol>
                              {item.solution.code && (
                                <div className='mt-4'>
                                  <CodeBlock code={item.solution.code} language='bash' />
                                </div>
                              )}
                            </div>
                          )}

                          {item.debugCommands && (
                            <div>
                              <h5 className='font-semibold mb-2 flex items-center gap-2'>
                                <Terminal className='w-4 h-4 text-primary' />
                                Debug Commands
                              </h5>
                              <div className='space-y-2'>
                                {item.debugCommands.map((cmd, index) => (
                                  <div
                                    key={index}
                                    className='flex items-center gap-2 bg-black/50 backdrop-blur rounded p-3 font-mono text-sm'
                                  >
                                    <code className='flex-1 text-green-400'>{cmd}</code>
                                    <button
                                      onClick={() => handleCopy(cmd, `${item.id}-${index}`)}
                                      className='p-1 rounded hover:bg-white/10 transition-colors'
                                    >
                                      {copiedCommands.includes(`${item.id}-${index}`) ? (
                                        <Check className='w-4 h-4 text-green-500' />
                                      ) : (
                                        <Copy className='w-4 h-4' />
                                      )}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </GlassCard>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div> */}

      {/* No Results */}
      {/* {filteredItems.length === 0 && (
        <div className='text-center py-12'>
          <XCircle className='w-12 h-12 text-muted-foreground mx-auto mb-4' />
          <p className='text-muted-foreground'>No troubleshooting items found matching your criteria</p>
        </div>
      )} */}

      {/* Still Need Help */}
      {/* <AnimateOnScroll>
        <GlassCard className='p-8 text-center'>
          <h3 className='text-2xl font-bold mb-4'>Still Need Help?</h3>
          <p className='text-muted-foreground mb-6'>
            Can't find a solution to your problem? Get help from our community or report an issue.
          </p>
          <div className='flex gap-4 justify-center'>
            <a
              href='https://github.com/brandon-schabel/promptliano/issues'
              target='_blank'
              rel='noopener noreferrer'
              className='px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors'
            >
              Report Issue
            </a>
            <a
              href='/community'
              className='px-6 py-3 border border-primary text-primary rounded-lg hover:bg-primary/10 transition-colors'
            >
              Join Community
            </a>
          </div>
        </GlassCard>
      </AnimateOnScroll> */}
    </div>
  )
}
