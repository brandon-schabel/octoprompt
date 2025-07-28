import { useState } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import {
  ChevronDown,
  ChevronRight,
  Book,
  Code,
  Zap,
  Settings,
  GitBranch,
  Users,
  FileText,
  Terminal
} from 'lucide-react'

interface NavItem {
  title: string
  href?: string
  icon?: React.ElementType
  items?: NavItem[]
  badge?: string
}

const navigation: NavItem[] = [
  {
    title: 'Getting Started',
    icon: Book,
    items: [
      { title: 'Introduction', href: '/docs' },
      { title: 'Installation', href: '/docs/getting-started#installation' },
      { title: 'Quick Start', href: '/docs/getting-started#quick-start' },
      { title: 'Configuration', href: '/docs/getting-started#configuration' }
    ]
  },
  {
    title: 'Core Concepts',
    icon: Zap,
    items: [
      { title: 'Projects', href: '/docs/guides#projects' },
      { title: 'Tickets & Tasks', href: '/docs/guides#tickets' },
      { title: 'Prompts', href: '/docs/guides#prompts' },
      { title: 'File Context', href: '/docs/guides#context' }
    ]
  },
  {
    title: 'API Reference',
    icon: Code,
    items: [
      { title: 'Project Manager', href: '/docs/api#project-manager' },
      { title: 'Prompt Manager', href: '/docs/api#prompt-manager' },
      { title: 'Ticket Manager', href: '/docs/api#ticket-manager' },
      { title: 'Task Manager', href: '/docs/api#task-manager' },
      { title: 'Git Manager', href: '/docs/api#git-manager', badge: 'Enhanced' },
      { title: 'File Summarization', href: '/docs/api#file-summarization', badge: 'New' }
    ]
  },
  {
    title: 'MCP Tools',
    icon: Terminal,
    items: [
      { title: 'Overview', href: '/docs/guides#mcp-overview' },
      { title: 'Tool Reference', href: '/docs/guides#mcp-tools' },
      { title: 'Integration Guide', href: '/docs/guides#mcp-integration' },
      { title: 'Best Practices', href: '/docs/guides#mcp-best-practices' }
    ]
  },
  {
    title: 'Advanced Features',
    icon: Settings,
    items: [
      { title: 'File Suggestions', href: '/docs/guides#file-suggestions', badge: 'Optimized' },
      { title: 'AI Agents', href: '/docs/guides#agents' },
      { title: 'Git Worktrees', href: '/docs/guides#git-worktrees' },
      { title: 'Background Jobs', href: '/docs/guides#jobs' }
    ]
  },
  {
    title: 'Guides',
    icon: FileText,
    items: [
      { title: 'Building Context', href: '/docs/guides#building-context' },
      { title: 'Workflow Patterns', href: '/docs/guides#workflow-patterns' },
      { title: 'Performance Tips', href: '/docs/guides#performance' },
      { title: 'Troubleshooting', href: '/docs/guides#troubleshooting' }
    ]
  },
  {
    title: 'Community',
    icon: Users,
    items: [
      { title: 'Contributing', href: '/docs/guides#contributing' },
      { title: 'Discord Server', href: '/community' },
      { title: 'GitHub', href: 'https://github.com/Promptliano/promptliano' }
    ]
  }
]

interface CollapsibleSectionProps {
  item: NavItem
  depth?: number
}

function CollapsibleSection({ item, depth = 0 }: CollapsibleSectionProps) {
  const location = useLocation()
  const [isOpen, setIsOpen] = useState(() => {
    // Auto-expand if current route is within this section
    if (item.items) {
      return item.items.some((subItem) => subItem.href && location.pathname.startsWith(subItem.href.split('#')[0]))
    }
    return false
  })

  const hasActiveChild = item.items?.some(
    (subItem) => subItem.href && location.pathname.startsWith(subItem.href.split('#')[0])
  )

  const Icon = item.icon

  if (!item.items) {
    return (
      <Link
        to={item.href || '#'}
        className={cn(
          'flex items-center justify-between px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground rounded-md transition-colors',
          depth > 0 && 'ml-6',
          item.href && location.pathname.startsWith(item.href.split('#')[0]) && 'bg-accent text-accent-foreground'
        )}
      >
        <span className='flex items-center gap-2'>
          {Icon && <Icon className='h-4 w-4' />}
          {item.title}
        </span>
        {item.badge && <span className='text-xs bg-primary/20 text-primary px-2 py-0.5 rounded'>{item.badge}</span>}
      </Link>
    )
  }

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center justify-between w-full px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground rounded-md transition-colors',
          hasActiveChild && 'text-primary'
        )}
      >
        <span className='flex items-center gap-2'>
          {Icon && <Icon className='h-4 w-4' />}
          {item.title}
        </span>
        {isOpen ? <ChevronDown className='h-4 w-4' /> : <ChevronRight className='h-4 w-4' />}
      </button>
      {isOpen && (
        <div className='mt-1 space-y-1'>
          {item.items.map((subItem, index) => (
            <CollapsibleSection key={index} item={subItem} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export function DocsSidebar() {
  return (
    <nav className='flex-1 overflow-y-auto px-4 pb-6'>
      <div className='space-y-1'>
        {navigation.map((item, index) => (
          <CollapsibleSection key={index} item={item} />
        ))}
      </div>
    </nav>
  )
}
