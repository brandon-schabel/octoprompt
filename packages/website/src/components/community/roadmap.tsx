import { GlassCard } from '@/components/ui/glass-card'
import { CheckCircle2, Circle, Clock, ChevronUp } from 'lucide-react'
import { useState } from 'react'

interface RoadmapItem {
  id: string
  title: string
  description: string
  status: 'completed' | 'in-progress' | 'planned'
  quarter: string
  votes: number
  voted?: boolean
}

const roadmapData: RoadmapItem[] = [
  {
    id: '1',
    title: 'Multi-Agent Collaboration',
    description: 'Enable multiple AI agents to work together on complex tasks',
    status: 'completed',
    quarter: 'Q4 2024',
    votes: 234,
    voted: false
  },
  {
    id: '2',
    title: 'Claude Code Integration',
    description: 'Deep integration with Claude Code for seamless AI-powered development',
    status: 'in-progress',
    quarter: 'Q1 2025',
    votes: 189,
    voted: true
  },
  {
    id: '3',
    title: 'Visual Project Builder',
    description: 'Drag-and-drop interface for creating and managing project structures',
    status: 'in-progress',
    quarter: 'Q1 2025',
    votes: 156,
    voted: false
  },
  {
    id: '4',
    title: 'Plugin Marketplace',
    description: 'Community-driven marketplace for sharing Promptliano extensions',
    status: 'planned',
    quarter: 'Q2 2025',
    votes: 298,
    voted: false
  },
  {
    id: '5',
    title: 'AI Code Review',
    description: 'Automated code review with context-aware suggestions',
    status: 'planned',
    quarter: 'Q2 2025',
    votes: 245,
    voted: true
  },
  {
    id: '6',
    title: 'Real-time Collaboration',
    description: 'Work with team members in real-time with shared AI context',
    status: 'planned',
    quarter: 'Q3 2025',
    votes: 312,
    voted: false
  }
]

const statusConfig = {
  completed: {
    icon: CheckCircle2,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    label: 'Completed'
  },
  'in-progress': {
    icon: Clock,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    label: 'In Progress'
  },
  planned: {
    icon: Circle,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/10',
    label: 'Planned'
  }
}

export function Roadmap() {
  const [items, setItems] = useState(roadmapData)
  const [filter, setFilter] = useState<'all' | 'completed' | 'in-progress' | 'planned'>('all')

  const handleVote = (id: string) => {
    setItems(
      items.map((item) =>
        item.id === id ? { ...item, votes: item.voted ? item.votes - 1 : item.votes + 1, voted: !item.voted } : item
      )
    )
  }

  const filteredItems = filter === 'all' ? items : items.filter((item) => item.status === filter)

  const groupedItems = filteredItems.reduce(
    (acc, item) => {
      if (!acc[item.quarter]) acc[item.quarter] = []
      acc[item.quarter].push(item)
      return acc
    },
    {} as Record<string, RoadmapItem[]>
  )

  return (
    <GlassCard className='p-8'>
      <div className='mb-6'>
        <h3 className='text-2xl font-bold mb-2'>Product Roadmap</h3>
        <p className='text-muted-foreground mb-4'>See what's coming next and vote for features you want to see</p>

        <div className='flex gap-2 flex-wrap'>
          {(['all', 'completed', 'in-progress', 'planned'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === status ? 'bg-primary text-primary-foreground' : 'bg-background/50 hover:bg-background/80'
              }`}
            >
              {status === 'all' ? 'All' : statusConfig[status].label}
            </button>
          ))}
        </div>
      </div>

      <div className='space-y-8'>
        {Object.entries(groupedItems).map(([quarter, quarterItems]) => (
          <div key={quarter}>
            <h4 className='text-lg font-semibold mb-4 text-muted-foreground'>{quarter}</h4>
            <div className='space-y-3'>
              {quarterItems.map((item) => {
                const config = statusConfig[item.status]
                const Icon = config.icon

                return (
                  <div
                    key={item.id}
                    className='relative bg-background/50 rounded-lg p-4 hover:bg-background/80 transition-colors'
                  >
                    <div className='flex items-start gap-4'>
                      <div className={`${config.bgColor} rounded-lg p-2`}>
                        <Icon className={`w-5 h-5 ${config.color}`} />
                      </div>

                      <div className='flex-1'>
                        <h5 className='font-semibold mb-1'>{item.title}</h5>
                        <p className='text-sm text-muted-foreground mb-3'>{item.description}</p>

                        <div className='flex items-center gap-4'>
                          <span className={`text-xs ${config.color} font-medium`}>{config.label}</span>

                          {item.status === 'planned' && (
                            <button
                              onClick={() => handleVote(item.id)}
                              className={`inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full transition-colors ${
                                item.voted ? 'bg-primary/20 text-primary' : 'bg-background hover:bg-background/80'
                              }`}
                            >
                              <ChevronUp className='w-3 h-3' />
                              {item.votes} votes
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className='mt-8 p-4 bg-primary/5 rounded-lg text-center'>
        <p className='text-sm'>
          Have a feature request?{' '}
          <a
            href='https://github.com/brandon-schabel/promptliano/issues/new?template=feature_request.md'
            className='font-medium text-primary hover:underline'
            target='_blank'
            rel='noopener noreferrer'
          >
            Submit it on GitHub
          </a>
        </p>
      </div>
    </GlassCard>
  )
}
