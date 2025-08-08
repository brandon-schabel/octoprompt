import React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@promptliano/ui'
import { FileText, Building2, Code2, Database, BookOpen, GitBranch, Clock } from 'lucide-react'

export type AssetView =
  | 'project-docs'
  | 'architecture'
  | 'api-docs'
  | 'database-schema'
  | 'user-guides'
  | 'diagrams'
  | 'recent'

interface AssetsSidebarNavProps {
  activeView: AssetView
  onViewChange: (view: AssetView) => void
  className?: string
}

export function AssetsSidebarNav({ activeView, onViewChange, className }: AssetsSidebarNavProps) {
  const navItems = [
    {
      id: 'project-docs' as AssetView,
      label: 'Project Docs',
      icon: FileText,
      description: 'Project documentation'
    },
    {
      id: 'architecture' as AssetView,
      label: 'Architecture',
      icon: Building2,
      description: 'System design & diagrams'
    },
    {
      id: 'api-docs' as AssetView,
      label: 'API Docs',
      icon: Code2,
      description: 'API reference documentation'
    },
    {
      id: 'database-schema' as AssetView,
      label: 'Database',
      icon: Database,
      description: 'Schema diagrams & docs'
    },
    {
      id: 'user-guides' as AssetView,
      label: 'User Guides',
      icon: BookOpen,
      description: 'End-user documentation'
    },
    {
      id: 'diagrams' as AssetView,
      label: 'Diagrams',
      icon: GitBranch,
      description: 'Flowcharts & visualizations'
    },
    {
      id: 'recent' as AssetView,
      label: 'Recent Assets',
      icon: Clock,
      description: 'Recently generated docs'
    }
  ]

  return (
    <div className={cn('flex flex-col gap-1 p-2', className)}>
      {navItems.map((item) => (
        <Button
          key={item.id}
          variant={activeView === item.id ? 'secondary' : 'ghost'}
          className={cn('w-full justify-start gap-3 h-auto py-3 px-3', activeView === item.id && 'bg-secondary')}
          onClick={() => onViewChange(item.id)}
        >
          <item.icon className='h-4 w-4 shrink-0' />
          <div className='flex flex-col items-start text-left'>
            <span className='text-sm font-medium whitespace-nowrap'>{item.label}</span>
            <span className='text-xs text-muted-foreground/90 whitespace-nowrap'>{item.description}</span>
          </div>
        </Button>
      ))}
    </div>
  )
}
