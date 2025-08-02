import React from 'react'
import { ManageSidebarNav, type ManageView } from './manage-sidebar-nav'
import { StatisticsView, MCPAnalyticsView, SummarizationView, ProjectSettingsView } from './manage-views'
import { cn } from '@/lib/utils'

interface ManageTabWithSidebarProps {
  projectId: number
  manageView?: ManageView
  onManageViewChange: (view: ManageView) => void
  className?: string
}

export function ManageTabWithSidebar({
  projectId,
  manageView = 'statistics',
  onManageViewChange,
  className
}: ManageTabWithSidebarProps) {
  return (
    <div className={cn('flex h-full', className)}>
      {/* Left Sidebar */}
      <div className='w-56 border-r bg-muted/30 flex-shrink-0'>
        <ManageSidebarNav activeView={manageView} onViewChange={onManageViewChange} className='h-full' />
      </div>

      {/* Content Area */}
      <div className='flex-1 overflow-y-auto'>
        {manageView === 'statistics' && <StatisticsView projectId={projectId} />}
        {manageView === 'mcp-analytics' && <MCPAnalyticsView projectId={projectId} />}
        {manageView === 'summarization' && <SummarizationView />}
        {manageView === 'project-settings' && <ProjectSettingsView />}
      </div>
    </div>
  )
}
