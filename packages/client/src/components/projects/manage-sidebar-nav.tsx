import React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { BarChart3, Activity, FileText, Settings } from 'lucide-react'

export type ManageView = 'statistics' | 'mcp-analytics' | 'summarization' | 'project-settings'

interface ManageSidebarNavProps {
  activeView: ManageView
  onViewChange: (view: ManageView) => void
  className?: string
}

export function ManageSidebarNav({ activeView, onViewChange, className }: ManageSidebarNavProps) {
  const navItems = [
    {
      id: 'statistics' as ManageView,
      label: 'Statistics',
      icon: BarChart3,
      description: 'Project insights and metrics'
    },
    {
      id: 'mcp-analytics' as ManageView,
      label: 'MCP Analytics',
      icon: Activity,
      description: 'Model Context Protocol usage'
    },
    {
      id: 'summarization' as ManageView,
      label: 'Summarization',
      icon: FileText,
      description: 'File summary generation'
    },
    {
      id: 'project-settings' as ManageView,
      label: 'Project Settings',
      icon: Settings,
      description: 'Configure project options'
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
            <span className='text-xs text-muted-foreground whitespace-nowrap'>{item.description}</span>
          </div>
        </Button>
      ))}
    </div>
  )
}