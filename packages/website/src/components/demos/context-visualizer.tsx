import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GlassCard } from '@/components/ui/glass-card'
import { FileText, Brain, Zap, TrendingDown, Database, GitBranch } from 'lucide-react'

interface ContextNode {
  id: string
  type: 'file' | 'prompt' | 'ticket' | 'summary' | 'git'
  name: string
  tokens: number
  relevance: number
  icon: React.ElementType
}

interface ContextVisualizerProps {
  title?: string
  description?: string
  scenario?: 'file-search' | 'project-context' | 'git-workflow'
}

const scenarios = {
  'file-search': {
    before: [
      { id: '1', type: 'file', name: 'src/**/*.tsx', tokens: 25000, relevance: 0.3, icon: FileText },
      { id: '2', type: 'file', name: 'packages/**/*.ts', tokens: 35000, relevance: 0.2, icon: FileText },
      { id: '3', type: 'file', name: 'tests/**/*.test.ts', tokens: 15000, relevance: 0.1, icon: FileText }
    ],
    after: [
      { id: '4', type: 'file', name: 'src/auth/login.tsx', tokens: 500, relevance: 0.95, icon: FileText },
      { id: '5', type: 'file', name: 'src/auth/hooks.ts', tokens: 300, relevance: 0.87, icon: FileText },
      { id: '6', type: 'file', name: 'src/api/auth.ts', tokens: 400, relevance: 0.82, icon: FileText }
    ]
  },
  'project-context': {
    before: [
      { id: '7', type: 'file', name: 'Full Codebase', tokens: 100000, relevance: 0.1, icon: Database },
      { id: '8', type: 'prompt', name: 'Generic Instructions', tokens: 5000, relevance: 0.2, icon: Brain }
    ],
    after: [
      { id: '9', type: 'ticket', name: 'Current Ticket Context', tokens: 200, relevance: 0.95, icon: Zap },
      { id: '10', type: 'summary', name: 'File Summaries', tokens: 1500, relevance: 0.9, icon: FileText },
      { id: '11', type: 'prompt', name: 'Project Prompts', tokens: 800, relevance: 0.85, icon: Brain },
      { id: '12', type: 'git', name: 'Git Status', tokens: 300, relevance: 0.8, icon: GitBranch }
    ]
  },
  'git-workflow': {
    before: [
      { id: '13', type: 'git', name: 'All Git History', tokens: 50000, relevance: 0.1, icon: GitBranch },
      { id: '14', type: 'file', name: 'All Changed Files', tokens: 30000, relevance: 0.2, icon: FileText }
    ],
    after: [
      { id: '15', type: 'git', name: 'Recent Commits', tokens: 500, relevance: 0.95, icon: GitBranch },
      { id: '16', type: 'git', name: 'Current Changes', tokens: 800, relevance: 0.9, icon: GitBranch },
      { id: '17', type: 'file', name: 'Modified Files Only', tokens: 1200, relevance: 0.85, icon: FileText }
    ]
  }
} as const

export function ContextVisualizer({
  title = 'Context Building Visualization',
  description = 'See how Promptliano reduces tokens while increasing relevance',
  scenario = 'file-search'
}: ContextVisualizerProps) {
  const [showAfter, setShowAfter] = useState(false)
  const [animating, setAnimating] = useState(false)

  const currentScenario = scenarios[scenario]
  const nodes = showAfter ? currentScenario.after : currentScenario.before
  const totalTokens = nodes.reduce((sum, node) => sum + node.tokens, 0)
  const avgRelevance = nodes.reduce((sum, node) => sum + node.relevance, 0) / nodes.length

  const tokenReduction =
    currentScenario.before.reduce((sum, node) => sum + node.tokens, 0) -
    currentScenario.after.reduce((sum, node) => sum + node.tokens, 0)
  const reductionPercentage = Math.round(
    (tokenReduction / currentScenario.before.reduce((sum, node) => sum + node.tokens, 0)) * 100
  )

  const handleTransform = () => {
    setAnimating(true)
    setTimeout(() => {
      setShowAfter(!showAfter)
      setAnimating(false)
    }, 600)
  }

  return (
    <div className='space-y-6'>
      <div className='text-center'>
        <h2 className='text-3xl font-bold mb-2'>{title}</h2>
        <p className='text-muted-foreground'>{description}</p>
      </div>

      <GlassCard className='p-8'>
        {/* Metrics Display */}
        <div className='grid grid-cols-3 gap-6 mb-8'>
          <motion.div className='text-center' animate={{ scale: animating ? 0.8 : 1 }} transition={{ duration: 0.3 }}>
            <div className='text-3xl font-bold text-primary'>{totalTokens.toLocaleString()}</div>
            <div className='text-sm text-muted-foreground'>Total Tokens</div>
          </motion.div>

          <motion.div className='text-center' animate={{ scale: animating ? 0.8 : 1 }} transition={{ duration: 0.3 }}>
            <div className='text-3xl font-bold text-green-500'>{(avgRelevance * 100).toFixed(0)}%</div>
            <div className='text-sm text-muted-foreground'>Avg. Relevance</div>
          </motion.div>

          <motion.div className='text-center' animate={{ scale: showAfter ? 1 : 0 }} transition={{ duration: 0.5 }}>
            <div className='text-3xl font-bold text-orange-500'>-{reductionPercentage}%</div>
            <div className='text-sm text-muted-foreground'>Token Reduction</div>
          </motion.div>
        </div>

        {/* Context Nodes Visualization */}
        <div className='relative h-64 mb-8'>
          <AnimatePresence mode='wait'>
            <motion.div
              key={showAfter ? 'after' : 'before'}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.5 }}
              className='absolute inset-0 flex items-center justify-center'
            >
              <div className='relative'>
                {nodes.map((node, index) => {
                  const angle = (360 / nodes.length) * index
                  const radius = 120
                  const x = Math.cos((angle * Math.PI) / 180) * radius
                  const y = Math.sin((angle * Math.PI) / 180) * radius

                  return (
                    <motion.div
                      key={node.id}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{
                        opacity: 1,
                        scale: 0.5 + node.relevance * 0.5,
                        x,
                        y
                      }}
                      transition={{
                        delay: index * 0.1,
                        duration: 0.5,
                        type: 'spring',
                        stiffness: 200
                      }}
                      className='absolute flex flex-col items-center'
                      style={{
                        transform: `translate(-50%, -50%)`,
                        opacity: 0.4 + node.relevance * 0.6
                      }}
                    >
                      <div
                        className={`
                        p-4 rounded-full 
                        ${node.type === 'file' ? 'bg-blue-500/20 border-blue-500' : ''}
                        ${node.type === 'prompt' ? 'bg-purple-500/20 border-purple-500' : ''}
                        ${node.type === 'ticket' ? 'bg-green-500/20 border-green-500' : ''}
                        ${node.type === 'summary' ? 'bg-orange-500/20 border-orange-500' : ''}
                        ${node.type === 'git' ? 'bg-pink-500/20 border-pink-500' : ''}
                        border-2
                      `}
                      >
                        <node.icon className='h-6 w-6' />
                      </div>
                      <div className='mt-2 text-xs text-center max-w-[100px]'>
                        <div className='font-medium truncate'>{node.name}</div>
                        <div className='text-muted-foreground'>{node.tokens} tokens</div>
                      </div>
                    </motion.div>
                  )
                })}

                {/* Center Node */}
                <motion.div
                  animate={{ rotate: animating ? 360 : 0 }}
                  transition={{ duration: 0.6 }}
                  className='absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2'
                >
                  <div className='p-6 rounded-full bg-primary/20 border-2 border-primary'>
                    <Brain className='h-8 w-8 text-primary' />
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Action Button */}
        <div className='text-center'>
          <button
            onClick={handleTransform}
            className='btn btn-primary flex items-center space-x-2 mx-auto'
            disabled={animating}
          >
            <TrendingDown className='h-4 w-4' />
            <span>{showAfter ? 'Show Before' : 'Optimize Context'}</span>
          </button>
        </div>

        {/* Description */}
        <AnimatePresence mode='wait'>
          <motion.div
            key={showAfter ? 'after-desc' : 'before-desc'}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className='mt-6 text-center'
          >
            <p className='text-sm text-muted-foreground'>
              {showAfter
                ? `Promptliano reduced tokens by ${reductionPercentage}% while increasing relevance by ${Math.round((avgRelevance - 0.2) * 100)}%`
                : 'Traditional approach: Large context with low relevance'}
            </p>
          </motion.div>
        </AnimatePresence>
      </GlassCard>
    </div>
  )
}
