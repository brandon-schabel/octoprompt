import React from 'react'
import { cn } from '@/lib/utils'
import { SectionedSidebarNav } from '@promptliano/ui'
import { BarChart3, Activity, FileText, Settings } from 'lucide-react'

export type ManageView = 'statistics' | 'mcp-analytics' | 'summarization' | 'project-settings'

interface ManageSidebarNavProps {
  activeView: ManageView
  onViewChange: (view: ManageView) => void
  className?: string
}

export function ManageSidebarNav({ activeView, onViewChange, className }: ManageSidebarNavProps) {
  const sections = [
    {
      title: 'Analytics',
      items: [
        {
          id: 'statistics',
          title: 'Statistics',
          href: '#statistics',
          icon: BarChart3,
          description: 'Project insights and metrics',
          isActive: activeView === 'statistics'
        },
        {
          id: 'mcp-analytics',
          title: 'MCP Analytics',
          href: '#mcp-analytics',
          icon: Activity,
          description: 'Model Context Protocol usage',
          isActive: activeView === 'mcp-analytics'
        }
      ]
    },
    {
      title: 'Configuration',
      items: [
        {
          id: 'summarization',
          title: 'Summarization',
          href: '#summarization',
          icon: FileText,
          description: 'File summary generation',
          isActive: activeView === 'summarization'
        },
        {
          id: 'project-settings',
          title: 'Project Settings',
          href: '#project-settings',
          icon: Settings,
          description: 'Configure project options',
          isActive: activeView === 'project-settings'
        }
      ]
    }
  ]

  return (
    <div className={className}>
      <SectionedSidebarNav
        sections={sections.map(section => ({
          ...section,
          items: section.items.map(item => ({
            ...item,
            label: item.title
          }))
        }))}
        activeItem={activeView}
        onItemClick={(item: any) => onViewChange(item.id as ManageView)}
      />
    </div>
  )
}
