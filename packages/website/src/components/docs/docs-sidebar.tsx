import { useState, useEffect } from 'react'
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
      { title: 'Download & Installation', href: '/docs/download-installation' },
      { title: 'Quick Start', href: '/docs/getting-started' },
      { title: 'UI Overview', href: '/docs/ui-overview', badge: 'New' }
    ]
  },
  {
    title: 'How-To Guides',
    icon: FileText,
    items: [
      { title: 'Your First Project', href: '/docs/how-to/first-project' },
      { title: 'Building Context for AI', href: '/docs/how-to/building-context' },
      { title: 'Managing Tickets & Tasks', href: '/docs/how-to/tickets-tasks' },
      { title: 'Using File Suggestions', href: '/docs/guides#file-suggestions' },
      { title: 'Working with Prompts', href: '/docs/guides#prompts' }
    ]
  },
  {
    title: 'Features',
    icon: Zap,
    items: [
      { title: 'Features Overview', href: '/docs/features' },
      { title: 'Project Management', href: '/docs/guides#projects' },
      { title: 'Smart File Discovery', href: '/docs/guides#file-suggestions', badge: 'AI' },
      { title: 'Ticket System', href: '/docs/guides#tickets' },
      { title: 'Prompt Library', href: '/docs/guides#prompts' },
      { title: 'Git Integration', href: '/docs/guides#git-worktrees' }
    ]
  },
  {
    title: 'MCP Integration',
    icon: Terminal,
    items: [
      { title: 'What is MCP?', href: '/docs/guides#mcp-overview' },
      { title: 'Setup Guide', href: '/integrations' },
      { title: 'MCP Tools Reference', href: '/docs/api#mcp-tools' },
      { title: 'Best Practices', href: '/docs/guides#mcp-best-practices' }
    ]
  },
  {
    title: 'API Reference',
    icon: Code,
    items: [
      { title: 'Overview', href: '/docs/api' },
      { title: 'Project Manager', href: '/docs/api#project-manager' },
      { title: 'Ticket Manager', href: '/docs/api#ticket-manager' },
      { title: 'Task Manager', href: '/docs/api#task-manager' },
      { title: 'Git Manager', href: '/docs/api#git-manager' },
      { title: 'All MCP Tools', href: '/docs/api#mcp-tools' }
    ]
  },
  {
    title: 'Advanced Topics',
    icon: Settings,
    items: [
      { title: 'AI Agents', href: '/docs/guides#agents' },
      { title: 'Git Worktrees', href: '/docs/guides#git-worktrees' },
      { title: 'Performance Tips', href: '/docs/guides#performance' },
      { title: 'Troubleshooting', href: '/docs/guides#troubleshooting' }
    ]
  },
  {
    title: 'Community',
    icon: Users,
    items: [
      { title: 'Discord Server', href: 'https://discord.gg/dTSy42g8bV' },
      { title: 'GitHub', href: 'https://github.com/brandon-schabel/promptliano' },
      { title: 'Contributing', href: '/docs/guides#contributing' }
    ]
  }
]

interface CollapsibleSectionProps {
  item: NavItem
  depth?: number
  isOpen: boolean
  onToggle: () => void
}

function CollapsibleSection({ item, depth = 0, isOpen, onToggle }: CollapsibleSectionProps) {
  const location = useLocation()
  const Icon = item.icon

  // More precise path matching
  const isActive = (href: string) => {
    const [path, hash] = href.split('#')
    const currentPath = location.pathname
    const currentHash = location.hash.slice(1)

    if (hash && currentPath === path) {
      return currentHash === hash
    }
    return currentPath === path
  }

  if (!item.items) {
    const active = item.href && isActive(item.href)

    return (
      <Link
        to={item.href || '#'}
        className={cn(
          'flex items-center justify-between px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground rounded-md transition-colors',
          depth > 0 && 'ml-6',
          active && 'bg-accent text-accent-foreground'
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

  const hasActiveChild = item.items.some((subItem) => subItem.href && isActive(subItem.href))

  return (
    <div>
      <button
        onClick={onToggle}
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
            <CollapsibleSection key={index} item={subItem} depth={depth + 1} isOpen={false} onToggle={() => {}} />
          ))}
        </div>
      )}
    </div>
  )
}

export function DocsSidebar() {
  const location = useLocation()

  const findActiveSection = () => {
    for (let i = 0; i < navigation.length; i++) {
      const item = navigation[i]
      if (item.items) {
        const hasActive = item.items.some((subItem) => {
          if (!subItem.href) return false
          const [path, hash] = subItem.href.split('#')
          if (hash && location.pathname === path) {
            return location.hash.slice(1) === hash
          }
          return location.pathname === path
        })
        if (hasActive) return i
      }
    }
    return null
  }

  const [expandedIndex, setExpandedIndex] = useState<number | null>(findActiveSection)

  // Update expanded section when route changes
  useEffect(() => {
    const activeSection = findActiveSection()
    if (activeSection !== null) {
      setExpandedIndex(activeSection)
    }
  }, [location.pathname, location.hash])

  return (
    <nav className='flex-1 overflow-y-auto px-4 pb-6'>
      <div className='space-y-1'>
        {navigation.map((item, index) => (
          <CollapsibleSection
            key={index}
            item={item}
            isOpen={expandedIndex === index}
            onToggle={() => setExpandedIndex(expandedIndex === index ? null : index)}
          />
        ))}
      </div>
    </nav>
  )
}
