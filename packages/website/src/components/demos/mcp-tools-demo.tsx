import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GlassCard } from '@/components/ui/glass-card'
import { CodeTerminal } from '@/components/ui/code-terminal'
import {
  Terminal,
  Play,
  FileSearch,
  GitBranch,
  Database,
  Ticket,
  Brain,
  Clock,
  CheckCircle,
  Loader2
} from 'lucide-react'

interface MCPTool {
  id: string
  name: string
  description: string
  icon: React.ElementType
  action: string
  input: string
  output: string
  executionTime: number
}

const mcpTools: MCPTool[] = [
  {
    id: 'project-overview',
    name: 'Project Manager',
    description: 'Get comprehensive project context and structure',
    icon: Database,
    action: 'overview',
    input: `mcp__promptliano__project_manager(
  action: "overview",
  projectId: 1753220774680
)`,
    output: `{
  "project": "Promptliano",
  "activeTab": "Project Overview & Files",
  "recentTickets": [
    {
      "id": 1753633266818,
      "title": "Interactive Demo Section",
      "status": "in_progress",
      "tasks": 8
    }
  ],
  "fileStats": {
    "total": 629,
    "unsummarized": 150,
    "sourceFiles": 474
  },
  "tokensSaved": "95%"
}`,
    executionTime: 1200
  },
  {
    id: 'file-suggestions',
    name: 'File Suggester',
    description: 'AI-powered file recommendations based on context',
    icon: FileSearch,
    action: 'suggest_files',
    input: `mcp__promptliano__ticket_manager(
  action: "suggest_files",
  ticketId: 456,
  data: {
    strategy: "balanced",
    maxResults: 5
  }
)`,
    output: `{
  "suggestedFiles": [
    { "path": "src/auth/login.tsx", "score": 0.95 },
    { "path": "src/auth/hooks.ts", "score": 0.87 },
    { "path": "src/api/auth.ts", "score": 0.82 },
    { "path": "src/components/AuthForm.tsx", "score": 0.78 },
    { "path": "tests/auth.test.ts", "score": 0.72 }
  ],
  "tokensUsed": 250,
  "tokensSaved": 4750,
  "strategy": "balanced"
}`,
    executionTime: 800
  },
  {
    id: 'git-workflow',
    name: 'Git Manager',
    description: 'Comprehensive Git operations with worktree support',
    icon: GitBranch,
    action: 'status',
    input: `mcp__promptliano__git_manager(
  action: "status",
  projectId: 1753220774680
)`,
    output: `{
  "branch": "feature/demo-section",
  "ahead": 3,
  "behind": 0,
  "staged": [
    "packages/website/src/components/demos/live-demo.tsx",
    "packages/website/src/components/demos/context-visualizer.tsx"
  ],
  "modified": [
    "packages/website/src/routes/demos.tsx"
  ],
  "untracked": [],
  "lastCommit": {
    "hash": "3493e7a",
    "message": "Add interactive demo components",
    "author": "developer",
    "date": "2 hours ago"
  }
}`,
    executionTime: 500
  },
  {
    id: 'ticket-management',
    name: 'Ticket Manager',
    description: 'Track and manage development tasks',
    icon: Ticket,
    action: 'create',
    input: `mcp__promptliano__ticket_manager(
  action: "create",
  projectId: 1753220774680,
  data: {
    title: "Add API integration tests",
    priority: "high",
    overview: "Create comprehensive tests for API endpoints"
  }
)`,
    output: `{
  "ticket": {
    "id": 1753634567890,
    "title": "Add API integration tests",
    "status": "open",
    "priority": "high",
    "created": "2025-07-27T10:45:00Z"
  },
  "suggestedTasks": [
    "Setup test environment",
    "Write auth endpoint tests",
    "Test error handling",
    "Add CI/CD integration"
  ]
}`,
    executionTime: 600
  },
  {
    id: 'ai-assistant',
    name: 'AI Assistant',
    description: 'Optimize prompts and generate summaries',
    icon: Brain,
    action: 'optimize_prompt',
    input: `mcp__promptliano__ai_assistant(
  action: "optimize_prompt",
  projectId: 1753220774680,
  data: {
    prompt: "help me fix the authentication"
  }
)`,
    output: `{
  "optimizedPrompt": "Debug and fix authentication flow issues in the React application, focusing on login/logout functionality, session management, and API token handling",
  "suggestedContext": [
    "Current auth implementation",
    "Recent auth-related commits",
    "Error logs from auth endpoints"
  ],
  "relevantFiles": [
    "src/auth/",
    "src/hooks/useAuth.ts",
    "src/api/auth.service.ts"
  ]
}`,
    executionTime: 1000
  }
]

interface MCPToolsDemoProps {
  title?: string
  description?: string
}

export function MCPToolsDemo({
  title = 'MCP Tools Showcase',
  description = "Experience the power of Promptliano's Model Context Protocol tools"
}: MCPToolsDemoProps) {
  const [selectedTool, setSelectedTool] = useState(mcpTools[0])
  const [isExecuting, setIsExecuting] = useState(false)
  const [executed, setExecuted] = useState(false)
  const [progress, setProgress] = useState(0)

  const handleExecute = () => {
    setIsExecuting(true)
    setExecuted(false)
    setProgress(0)

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          setIsExecuting(false)
          setExecuted(true)
          return 100
        }
        return prev + 100 / (selectedTool.executionTime / 100)
      })
    }, 100)
  }

  const handleReset = () => {
    setExecuted(false)
    setProgress(0)
  }

  return (
    <div className='space-y-6'>
      <div className='text-center'>
        <h2 className='text-3xl font-bold mb-2'>{title}</h2>
        <p className='text-muted-foreground'>{description}</p>
      </div>

      {/* Tool Selector */}
      <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4'>
        {mcpTools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => {
              setSelectedTool(tool)
              handleReset()
            }}
            className={`p-4 rounded-lg transition-all ${
              selectedTool.id === tool.id ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-secondary/80'
            }`}
          >
            <tool.icon className='h-6 w-6 mx-auto mb-2' />
            <div className='text-sm font-medium'>{tool.name}</div>
          </button>
        ))}
      </div>

      <GlassCard className='p-6'>
        {/* Tool Header */}
        <div className='flex items-start justify-between mb-6'>
          <div>
            <h3 className='text-2xl font-semibold mb-2 flex items-center space-x-2'>
              <selectedTool.icon className='h-6 w-6' />
              <span>{selectedTool.name}</span>
            </h3>
            <p className='text-muted-foreground'>{selectedTool.description}</p>
          </div>
          <div className='text-right'>
            <div className='text-sm text-muted-foreground'>Execution Time</div>
            <div className='font-mono'>{selectedTool.executionTime}ms</div>
          </div>
        </div>

        {/* Input Section */}
        <div className='mb-6'>
          <h4 className='font-medium mb-2 flex items-center space-x-2'>
            <Terminal className='h-4 w-4' />
            <span>Input</span>
          </h4>
          <CodeTerminal code={selectedTool.input} language='typescript' />
        </div>

        {/* Execution Progress */}
        {isExecuting && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className='mb-6'>
            <div className='flex items-center justify-between mb-2'>
              <div className='flex items-center space-x-2'>
                <Loader2 className='h-4 w-4 animate-spin' />
                <span className='text-sm'>Executing...</span>
              </div>
              <span className='text-sm font-mono'>{Math.round(progress)}%</span>
            </div>
            <div className='h-2 bg-secondary rounded-full overflow-hidden'>
              <motion.div
                className='h-full bg-primary'
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
          </motion.div>
        )}

        {/* Output Section */}
        <AnimatePresence>
          {executed && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <h4 className='font-medium mb-2 flex items-center space-x-2'>
                <CheckCircle className='h-4 w-4 text-green-500' />
                <span>Output</span>
              </h4>
              <CodeTerminal code={selectedTool.output} language='json' />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Button */}
        <div className='flex justify-center mt-6'>
          {!executed ? (
            <button
              onClick={handleExecute}
              disabled={isExecuting}
              className='btn btn-primary flex items-center space-x-2'
            >
              <Play className='h-4 w-4' />
              <span>{isExecuting ? 'Executing...' : 'Execute Tool'}</span>
            </button>
          ) : (
            <button onClick={handleReset} className='btn btn-outline flex items-center space-x-2'>
              <Terminal className='h-4 w-4' />
              <span>Try Again</span>
            </button>
          )}
        </div>

        {/* Tool Benefits */}
        <AnimatePresence>
          {executed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className='mt-6 p-4 bg-primary/10 rounded-lg'
            >
              <h5 className='font-medium mb-2 flex items-center space-x-2'>
                <Clock className='h-4 w-4' />
                <span>Performance Impact</span>
              </h5>
              <div className='grid grid-cols-3 gap-4 text-sm'>
                <div>
                  <div className='font-mono text-lg'>{selectedTool.executionTime}ms</div>
                  <div className='text-muted-foreground'>Response Time</div>
                </div>
                <div>
                  <div className='font-mono text-lg'>95%</div>
                  <div className='text-muted-foreground'>Tokens Saved</div>
                </div>
                <div>
                  <div className='font-mono text-lg'>10x</div>
                  <div className='text-muted-foreground'>Faster Context</div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>

      {/* Integration Info */}
      <div className='text-center'>
        <p className='text-muted-foreground mb-4'>
          All MCP tools are available through Claude, Cursor, and other AI assistants
        </p>
        <a href='/docs/mcp-integration' className='btn btn-outline'>
          Learn More About MCP
        </a>
      </div>
    </div>
  )
}
